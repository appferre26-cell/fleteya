# FleteYa — panel de propietarios, link del cliente y app del motorista (Partes 1 a 4)

Una sola aplicación web con tres zonas separadas:

- **`/panel`**: solo para propietarios (con correo y contraseña). Los motoristas y los clientes no entran aquí.
- **`/pedir`**: el link del cliente. **El cliente no se registra**: da solo nombre y celular.
- **`/motorista`**: la app del motorista, con su propia sesión (celular y contraseña que le crea el propietario).

## Qué hace

- **Entrar** con correo y contraseña de propietario (no hay registro público). Opción "Recordar 30 días".
- **Motoristas**
  - Agregar motorista: nombre, celular (será su usuario), DUI, correo opcional, licencia, vehículo y las fotos de
    **únicamente** DUI, licencia y tarjeta de circulación. Se le crea una contraseña temporal para enviarle por WhatsApp.
  - Las fotos grandes del celular se achican antes de subirse (máx. 4 MB, JPG/PNG/WEBP o PDF).
  - Lista con pestañas (todos, activos, pendientes, suspendidos) y búsqueda por nombre, teléfono, placa o DUI.
  - Detalle: datos, documentos, historial de cambios, botones Llamar y WhatsApp.
  - Aprobar (solo con los 3 documentos y marcando que se revisaron), suspender con motivo, reactivar,
    editar datos y crear una contraseña nueva.
- **Inicio**: totales, pendientes de aprobar, licencias por vencer en 30 días y últimos movimientos.
- **Administradores**: agregar otro propietario, desactivar/activar, contraseña nueva y cambiar mi contraseña.
  No se puede desactivar uno mismo ni al último propietario activo.

### Parte 2 — Link del cliente

- **`/pedir`** (la dirección principal `/` lleva aquí): el cliente marca recogida y destino en el mapa
  (OpenStreetMap, gratis), elige materiales del catálogo o escribe «Otro» con su peso, y ve al instante el peso y el precio:
  **$10 por tonelada, mínimo $10, incluye 5 km** (se cambian en Tarifas). Más lejos de los km incluidos se le avisa
  que el motorista puede ofrecer otro precio. Pago **solo en efectivo**. Acepta Términos y Aviso de Privacidad y envía.
  - Con QR: `/pedir?f=FER001` llena la recogida con la ferretería.
  - Solo acepta recogidas dentro de la zona (círculo de Tarifas y zona) y no deja pedir más peso del que lleva
    el vehículo más grande de un motorista activo.
  - Recuerda nombre y celular en ese teléfono (sin cuenta) y muestra «Ver mi último pedido».
  - Freno contra abusos: máximo 2 pedidos esperando por celular y 8 pedidos por hora por conexión.
- **`/viaje/[código]`**: el cliente ve el estado («Estamos buscando tu motorista»), el detalle, el precio, puede
  compartir el enlace y cancelar. Se actualiza solo cada 10 segundos.
- **`/terminos`** y **`/privacidad`**: se generan desde `docs/legal/` (borradores, falta revisión de un abogado).
- En el panel:
  - **Viajes**: lista con pestañas y búsqueda; detalle con cliente (Llamar/WhatsApp) y **cancelar con motivo**
    (el cliente ve «cancelado por FleteYa» y el motivo).
  - **Catálogo de materiales**: agregar, editar, ocultar. Botón para cargar los 7 ejemplos del documento del proyecto
    (**pesos aproximados, falta el catálogo real**).
  - **Puntos QR**: ferretería con ubicación en el mapa, código FER001…, QR para descargar y **cartel para imprimir**,
    pausar, pedidos del mes.
  - **Tarifas y zona**: precio por tonelada, mínimo, km incluidos, centro y radio de la zona, WhatsApp de ayuda.

### Parte 3 — App del motorista

- **`/motorista`**: app web para el celular del motorista (se instala desde el navegador con «Agregar a pantalla de
  inicio»). Sesión **separada** de la del propietario: el motorista entra con su celular y contraseña, y no puede abrir
  `/panel` (ni el propietario la app del motorista con su sesión).
  - Primer ingreso: **cambio obligatorio** de la contraseña temporal y aceptación de los **Términos para Motoristas**
    (`/motorista/legal/terminos`, desde `docs/legal/terminos-motoristas.md`).
  - **Inicio**: botón Disponible, resumen de hoy, mapa con su ubicación (se envía cada 20 s mientras está disponible o en
    viaje) y lista de solicitudes. Solo le llegan pedidos que su vehículo aguanta; no recibe nada si está pendiente,
    suspendido, con licencia vencida o **sin créditos**.
  - **Aviso de solicitud nueva**: ventana con cuenta regresiva de 30 s, sonido que se repite y vibración (con la app
    abierta; la pantalla se mantiene encendida mientras está disponible). Aceptar, Rechazar (ya no le vuelve a salir) o
    Ver después. Si dos aceptan a la vez, **solo uno se lo queda**.
  - **Viaje lejano** (más de los km incluidos): el motorista puede **ofrecer otro precio** (no menor al calculado, máx.
    $500). El cliente lo ve en su enlace y lo acepta o dice «No, gracias»; el motorista puede retirar su oferta.
  - **Viaje en curso**: navegar con Google Maps o Waze, llamar al cliente, pasos *Voy en camino → Ya llegué → Carga
    lista → Entrega completada*, y «No puedo hacer este viaje» (vuelve a la lista para otros). Si el cliente cancela, le avisa.
  - **Comisión**: al entregar se descuenta el 10 % del precio de sus créditos (se cambia en Créditos → Datos y planes).
    Si no le alcanza, se le avisa al aceptar y el saldo queda negativo: la diferencia se descuenta de la siguiente recarga.
  - **Viajes** (hoy, semana, mes con lo cobrado y la comisión), **Créditos** (saldo, planes semanal $20 / mensual $60,
    movimientos y botón de WhatsApp si se configuró en Tarifas) y **Perfil** (sus datos, cambiar contraseña, términos, privacidad, cerrar sesión).
- El **cliente** ve en `/viaje/[código]` a su motorista (nombre, vehículo, placa, botón Llamar), los pasos con hora y
  la ubicación del motorista en el mapa mientras va a recoger. Puede cancelar hasta que el motorista llega a cargar.
- En el **panel**: el detalle del viaje muestra motorista, precio acordado, comisión, ofertas y tiempos; el detalle
  del motorista tiene la sección «App y créditos» (saldo, si está disponible, entregados, último ingreso, términos y movimientos).

### Parte 4 — Recargas de créditos y recibos

- El motorista paga su plan (**semanal $20 / mensual $60**) a FleteYa **por transferencia** (opción principal) o **en efectivo**.
- En el **panel → Créditos y recargas**:
  - Resumen: recargado este mes, comisión descontada en la semana, motoristas con saldo bajo (< $5) y sin saldo.
  - **Registrar recarga**: motorista, plan y forma de pago. En transferencia se pide el **número de referencia** y
    marcar que se vio el dinero en la cuenta; una referencia ya usada (aunque se escriba con espacios o minúsculas) se
    rechaza. Muestra antes de guardar el saldo nuevo. **Si el saldo era negativo, la deuda se descuenta primero**
    (ej.: -$0.20 + $20 = $19.80). El registro bloquea la fila del motorista para no pisarse con una comisión al mismo tiempo.
  - Al guardar, el saldo se actualiza y se genera el **recibo REC-000123**: fecha y hora, datos de FleteYa (socio
    inscrito, NIT, dirección), motorista, plan, forma de pago y referencia, quién lo registró, saldo anterior, deuda
    descontada y saldo nuevo. Se ve en pantalla y en **PDF**, y se puede mandar por **WhatsApp** al motorista.
  - Saldo por motorista (los de menos saldo primero, botón + para recargar) y **últimas recargas** con búsqueda por
    motorista, celular, REC o referencia; abrir o descargar cualquier recibo y **Exportar** a CSV (para el contador).
  - **Anular** una recarga registrada por error (con motivo): resta el monto, deja un movimiento de ajuste y el recibo
    queda marcado ANULADO.
  - **Datos y planes**: datos que salen en el recibo, la cuenta para transferencias (banco, tipo, número, titular),
    precios de los planes y % de comisión. Los recibos ya emitidos guardan los datos con que se hicieron.
  - El detalle del motorista tiene el botón **Registrar recarga** y sus recargas enlazan al recibo.
- En la **app del motorista → Mis créditos**: «¿Cómo recargo?» con la cuenta de FleteYa (botón Copiar), su plan actual
  resaltado y el **Historial de recargas**: ver el recibo, descargar el PDF y **Compartir** (menú del celular con el
  PDF; si el celular no lo permite, WhatsApp con el texto). Solo puede abrir sus propios recibos.
- **Correo (opcional)**: si el motorista tiene correo y el servidor tiene `SMTP_URL`, el recibo le llega con el PDF
  adjunto y el panel muestra a qué correo se envió (o el error) y permite **reenviarlo**. Sin `SMTP_URL` no se envía nada
  y el panel lo avisa.
- Cada recarga guarda su forma de pago (`EFECTIVO`, `TRANSFERENCIA`; `EN_LINEA` queda listo para el futuro).
- **Por confirmar con el contador**: si además del recibo hace falta factura electrónica (DTE) de Hacienda.

- Lo que aún no hace: **pagos/recargas en línea** (a futuro), **factura electrónica (DTE)** (por confirmar) y
  **notificaciones push con la app cerrada** (hoy el aviso suena con la app abierta en pantalla).

## Cómo correrlo (desarrollo)

Necesitas Node 20+ y PostgreSQL.

```bash
cd apps/admin-panel
npm install
```

Crea el archivo `.env` (no se sube a GitHub):

```
DATABASE_URL="postgresql://USUARIO:CLAVE@localhost:5432/fleteya"
SESSION_SECRET="una-cadena-larga-y-secreta"   # por ejemplo: openssl rand -hex 32
# Opcional: enviar los recibos por correo
# SMTP_URL="smtps://usuario:clave-de-aplicacion@smtp.gmail.com:465"
# CORREO_REMITENTE="FleteYa <recibos@tu-dominio.com>"
```

Crea las tablas y el primer propietario:

```bash
npm run db:migrar
ADMIN_NOMBRE="Gerencia FleteYa" ADMIN_CORREO="gerencia.fleteya@gmail.com" ADMIN_PASSWORD="una-clave-segura" npm run crear-propietario
```

Arranca:

```bash
npm run build && npm run start     # http://localhost:3000
```

## Pruebas automáticas

Con el panel corriendo:

```bash
npx playwright install chromium
E2E_CORREO=gerencia.fleteya@gmail.com E2E_PASSWORD=la-clave npx playwright test
```

Prueban (Parte 1, `tests/panel.spec.ts`): acceso sin sesión, contraseña incorrecta, el flujo completo de un motorista (errores, foto grande,
documento falso, teléfono repetido, búsqueda, aprobar, suspender, reactivar, contraseña nueva, editar) y
agregar/desactivar un propietario. Parte 2 (`tests/cliente.spec.ts`): link sin sesión, catálogo (con nombre
repetido), tarifas (con error), punto QR y cartel, campos obligatorios del cliente, pedido desde QR con cálculo de
precio, cancelar desde el cliente y desde el panel. Parte 3 (`tests/motorista.spec.ts`): sesiones separadas, primer
ingreso (contraseña y términos), cuentas en revisión/suspendidas, viaje completo con aviso, pasos, entrega y comisión
(también con saldo negativo), rechazar, dos motoristas aceptando a la vez, oferta de precio aceptada/rechazada,
cancelación del cliente, soltar un viaje y perfil. Parte 4 (`tests/creditos.spec.ts`): transferencia sin referencia
o sin revisar, deuda descontada en el recibo, referencia repetida, PDF, efectivo mensual, búsqueda y CSV, lo que ve el
motorista (saldo, historial, recibo, PDF) y que no abre recibos ajenos, acceso sin sesión, anular, datos y planes, y que
con saldo ya puede ponerse disponible. La prueba del correo solo corre con un SMTP de prueba:
`node tests/smtp-falso.mjs` (guarda los correos en `SMTP_BUZON`), el servidor arrancado con
`SMTP_URL=smtp://localhost:2525` y `SMTP_BUZON=... npx playwright test tests/creditos.spec.ts`. **Usan la base de datos real que configures**, así que crean motoristas y
propietarios, materiales, puntos QR y viajes de prueba: córrelas solo en una base de pruebas.

`node tests/capturas.mjs` (Parte 1), `node tests/capturas-cliente.mjs` (Parte 2), `node tests/capturas-motorista.mjs` (Parte 3) y `node tests/capturas-creditos.mjs` (Parte 4) sacan capturas de pantalla en
computadora y celular (carpeta `capturas/`, o la que digas en `CAPTURAS`).

## Notas

- Los documentos se guardan dentro de la base de datos y solo se ven con sesión de propietario.
- Al entrar se bloquea 15 minutos después de 5 intentos fallidos.
- Los QR usan la dirección con la que se abre el panel (o `PUBLIC_URL` si se define). Imprime los definitivos
  cuando la app esté publicada.
- `npm run build` y `npm run dev` copian `docs/legal/*.md` a `legal/` (carpeta generada, no se sube).
