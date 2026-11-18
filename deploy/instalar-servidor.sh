#!/bin/bash
# Instala o actualiza FleteYa en un servidor Ubuntu que queda encendido (Abacus SuperComputer, VPS, etc.).
# Uso (la primera vez):
#   ADMIN_CORREO="correo@..." ADMIN_NOMBRE="Nombre" GOOGLE_MAPS_API_KEY="AIza..." PUBLIC_URL="https://..." \
#     bash instalar-servidor.sh
# Para actualizar después basta con: bash instalar-servidor.sh
# - Base de datos LIMPIA: sin datos ni cuentas de prueba, sin puntos QR.
# - Las claves (sesión, avisos y base de datos) se crean una sola vez y se guardan en .env; no se cambian al actualizar.
set -euo pipefail

REPO="${REPO:-https://github.com/appferre26-cell/fleteya.git}"
RAMA="${RAMA:-main}"
DIR="${DIR:-$HOME/fleteya-produccion}"
PUERTO="${PUERTO:-3000}"
BD="${BD:-fleteya}"
APP="$DIR/apps/admin-panel"
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo -n"
paso() { echo; echo "== $*"; }

paso "1/7 Programas (Node 22, PostgreSQL, git)"
command -v git >/dev/null || $SUDO apt-get install -y -q git
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO bash - && $SUDO apt-get install -y -q nodejs
fi
if [ -z "${DATABASE_URL:-}" ] && ! command -v psql >/dev/null; then
  $SUDO apt-get update -q && $SUDO apt-get install -y -q postgresql
fi

paso "2/7 Código ($RAMA)"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch -q --depth=50 origin "+refs/heads/$RAMA:refs/remotes/origin/$RAMA"
  git -C "$DIR" checkout -q -B "$RAMA" "origin/$RAMA"
else
  git clone -q --depth=50 --branch "$RAMA" "$REPO" "$DIR"
fi
git -C "$DIR" log --oneline -1

paso "3/7 Configuración (.env)"
if [ ! -f "$APP/.env" ]; then
  : "${ADMIN_CORREO:?Falta ADMIN_CORREO}" "${PUBLIC_URL:?Falta PUBLIC_URL (la dirección pública de la app)}"
  if [ -z "${DATABASE_URL:-}" ]; then
    CLAVE_BD="$(openssl rand -hex 16)"
    $SUDO service postgresql start >/dev/null 2>&1 || true
    sudo -n -u postgres psql -q -c "CREATE USER fleteya WITH PASSWORD '$CLAVE_BD';" 2>/dev/null \
      || sudo -n -u postgres psql -q -c "ALTER USER fleteya WITH PASSWORD '$CLAVE_BD';"
    sudo -n -u postgres psql -q -c "CREATE DATABASE $BD OWNER fleteya;" 2>/dev/null || true
    DATABASE_URL="postgresql://fleteya:$CLAVE_BD@localhost:5432/$BD"
  fi
  cd "$APP" && npm ci --silent --no-audit --no-fund >/dev/null
  VAPID="$(npx --yes web-push generate-vapid-keys --json)"
  umask 077
  cat > "$APP/.env" <<EOF
DATABASE_URL="$DATABASE_URL"
SESSION_SECRET="$(openssl rand -hex 32)"
PUBLIC_URL="${PUBLIC_URL%/}"
GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY:-}"
VAPID_PUBLIC_KEY="$(node -p "JSON.parse(process.argv[1]).publicKey" "$VAPID")"
VAPID_PRIVATE_KEY="$(node -p "JSON.parse(process.argv[1]).privateKey" "$VAPID")"
VAPID_CORREO="mailto:$ADMIN_CORREO"
# Recibos por correo (opcional): SMTP_URL="smtps://usuario:contraseña-de-aplicación@smtp.gmail.com:465"
# CORREO_REMITENTE="FleteYa <correo@...>"
EOF
  echo "Creado $APP/.env (guárdelo: si se pierde, los avisos dejan de funcionar en los celulares ya inscritos)."
else
  echo "Se conserva el .env existente."
fi

paso "4/7 Dependencias"
cd "$APP" && npm ci --silent --no-audit --no-fund >/dev/null

paso "5/7 Base de datos"
npm run -s db:migrar

paso "6/7 Compilar"
npm run -s build >/dev/null

if [ -n "${ADMIN_CORREO:-}" ]; then
  paso "Cuenta de propietario"
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -base64 12 | tr -d '/+=')}"
  ADMIN_NOMBRE="${ADMIN_NOMBRE:-Propietario}" ADMIN_CORREO="$ADMIN_CORREO" ADMIN_PASSWORD="$ADMIN_PASSWORD" npm run -s crear-propietario
  echo "Contraseña temporal: $ADMIN_PASSWORD  (cámbiela en el panel → Administradores)"
fi

paso "7/7 Encender en el puerto $PUERTO"
if [ -d /run/systemd/system ] && [ -n "$SUDO$(id -u | grep -x 0)" ]; then
  $SUDO tee /etc/systemd/system/fleteya.service >/dev/null <<EOF
[Unit]
Description=FleteYa
After=network.target postgresql.service
[Service]
WorkingDirectory=$APP
ExecStart=$(command -v npm) run start -- -p $PUERTO
Restart=always
User=$(id -un)
Environment=NODE_ENV=production
[Install]
WantedBy=multi-user.target
EOF
  $SUDO systemctl daemon-reload && $SUDO systemctl enable -q fleteya && $SUDO systemctl restart fleteya
else
  pkill -f "next start -p $PUERTO" 2>/dev/null || true; sleep 1
  nohup npm run start -- -p "$PUERTO" > "$DIR/fleteya.log" 2>&1 &
  echo "Encendida con nohup (sin systemd). Registro: $DIR/fleteya.log"
fi
for _ in $(seq 1 20); do curl -fs -o /dev/null "http://localhost:$PUERTO/login" && break; sleep 2; done
curl -s -o /dev/null -w "Panel responde: HTTP %{http_code}\n" "http://localhost:$PUERTO/login"
