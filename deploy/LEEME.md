# Publicar FleteYa para el período de prueba

El instalador `instalar-servidor.sh` deja la app funcionando en cualquier servidor Ubuntu que quede encendido
(Abacus SuperComputer, un VPS, etc.). Base de datos limpia: sin datos ni cuentas de prueba y **sin puntos QR**
(los QR se crean cuando exista el dominio `fleteya.com.sv`).

## En Abacus SuperComputer
1. En Abacus abra **SuperComputer** y active **Always On** (si no, la app se apaga al quedar sin uso).
2. Abra la terminal de SuperComputer y ejecute (cambie el correo y la dirección pública que le asigne SuperComputer):

```bash
curl -fsSL https://raw.githubusercontent.com/appferre26-cell/fleteya/main/deploy/instalar-servidor.sh -o instalar.sh
ADMIN_CORREO="gerencia.fleteya@gmail.com" ADMIN_NOMBRE="Gerencia FleteYa" \
PUBLIC_URL="https://LA-DIRECCION-PUBLICA" GOOGLE_MAPS_API_KEY="AIza..." \
bash instalar.sh
```

3. Al final muestra una **contraseña temporal** del propietario: entre al panel y cámbiela en **Administradores**.
4. Agregue la dirección pública en la restricción de la llave de Google Maps (Credenciales → Sitios web).

> Mientras los PR no estén unidos a `main`, agregue `RAMA=parte-11-publicacion` antes de `bash instalar.sh`.

## Actualizar después
`bash instalar.sh` otra vez: baja el código nuevo, aplica cambios a la base y reinicia. Conserva `.env`.

## Importante
- **Respalde `apps/admin-panel/.env`**. Si se pierde, los avisos dejan de llegar a los celulares ya inscritos.
- Pendiente para después del período de prueba: Wompi, factura electrónica, datos de la empresa, dominio y QR.
