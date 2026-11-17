# FleteYa — panel de propietarios, link del cliente y app del motorista (Partes 1 a 10)

Una sola aplicación web con tres zonas separadas:

- **`/panel`**: solo para propietarios (con correo y contraseña). Los motoristas y los clientes no entran aquí.
- **`/pedir`**: el link del cliente. **El cliente no se registra**: da solo nombre y celular.
- **`/motorista`**: la app del motorista, con su propia sesión (celular y contraseña). Desde la Parte 10 el motorista
  también puede **registrarse solo** en `/motorista/registro`.

## Qué hace

- **Entrar** con correo y contraseña de propietario (no hay registro público). Opción "Recordar 30 días".
- **Motoristas**
  - Agregar motorista: nombre, celular (será su usuario), DUI, correo opcional, licencia, vehículo y las **10 fotos**
    (DUI, licencia y tarjeta de circulación de ambos lados, y el vehículo de frente, atrás y ambos costados — Parte 10). Se le crea una contraseña temporal para enviarle por WhatsApp.
  - Las fotos grandes del celular se achican antes de subirse (máx. 4 MB, JPG/PNG/WEBP o PDF).
  - Lista con pestañas (todos, activos, pendientes, suspendidos) y búsqueda por nombre, teléfono, placa o DUI.
  - Detalle: datos, documentos, historial de cambios, botones Llamar y WhatsApp.
  - Aprobar (solo con las 10 fotos, el pago del acceso de $10 y marcando las 4 revisiones), suspender con motivo, reactivar,
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
  - **Comisión**: al entregar se descuenta el 10 % del precio de sus créditos (se cambia en Créditos → Datos y precios).
    Si no le alcanza, se le avisa al aceptar y el saldo queda negativo: la diferencia se descuenta de la siguiente recarga.
  - **Viajes** (hoy, semana, mes con lo cobrado y la comisión), **Créditos** (saldo, montos sugeridos para recargar — sin planes desde la Parte 10 —,
    movimientos y botón de WhatsApp si se configuró en Tarifas) y **Perfil** (sus datos, cambiar contraseña, términos, privacidad, cerrar sesión).
- El **cliente** ve en `/viaje/[código]` a su motorista (nombre, vehículo, placa, botón Llamar), los pasos con hora y
  la ubicación del motorista en el mapa mientras va a recoger. Puede cancelar hasta que el motorista llega a cargar.
- En el **panel**: el detalle del viaje muestra motorista, precio acordado, comisión, ofertas y tiempos; el detalle
  del motorista tiene la sección «App y créditos» (saldo, si está disponible, entregados, último ingreso, términos y movimientos).

### Parte 4 — Recargas de créditos y recibos

- El motorista recarga **el monto que quiera** (antes eran planes; se quitaron en la Parte 10) a FleteYa **por transferencia** (opción principal) o **en efectivo**.
- En el **panel → Créditos y recargas**:
  - Resumen: recargado este mes, comisión descontada en la semana, motoristas con saldo bajo (< $5) y sin saldo.
  - **Registrar recarga**: motorista, monto y forma de pago. En transferencia se pide el **número de referencia** y
    marcar que se vio el dinero en la cuenta; una referencia ya usada (aunque se escriba con espacios o minúsculas) se
    rechaza. Muestra antes de guardar el saldo nuevo. **Si el saldo era negativo, la deuda se descuenta primero**
    (ej.: -$0.20 + $20 = $19.80). El registro bloquea la fila del motorista para no pisarse con una comisión al mismo tiempo.
  - Al guardar, el saldo se actualiza y se genera el **recibo REC-000123**: fecha y hora, datos de FleteYa (socio
    inscrito, NIT, dirección), motorista, concepto (recarga o acceso), monto, forma de pago y referencia, quién lo registró, saldo anterior, deuda
    descontada y saldo nuevo. Se ve en pantalla y en **PDF**, y se puede mandar por **WhatsApp** al motorista.
  - Saldo por motorista (los de menos saldo primero, botón + para recargar) y **últimas recargas** con búsqueda por
    motorista, celular, REC o referencia; abrir o descargar cualquier recibo y **Exportar** a CSV (para el contador).
  - **Anular** una recarga registrada por error (con motivo): resta el monto, deja un movimiento de ajuste y el recibo
    queda marcado ANULADO.
  - **Datos y precios**: datos que salen en el recibo, la cuenta para transferencias (banco, tipo, número, titular),
    precio del acceso y % de comisión. Los recibos ya emitidos guardan los datos con que se hicieron.
  - El detalle del motorista tiene el botón **Registrar recarga** y sus recargas enlazan al recibo.
- En la **app del motorista → Mis créditos**: «¿Cómo recargo?» con la cuenta de FleteYa (botón Copiar), montos sugeridos y el **Historial de recargas**: ver el recibo, descargar el PDF y **Compartir** (menú del celular con el
  PDF; si el celular no lo permite, WhatsApp con el texto). Solo puede abrir sus propios recibos.
- **Correo (opcional)**: si el motorista tiene correo y el servidor tiene `SMTP_URL`, el recibo le llega con el PDF
  adjunto y el panel muestra a qué correo se envió (o el error) y permite **reenviarlo**. Sin `SMTP_URL` no se envía nada
  y el panel lo avisa.
- Cada recarga guarda su forma de pago (`EFECTIVO`, `TRANSFERENCIA`; `EN_LINEA` queda listo para el futuro).
- **Confirmado con el contador (16 nov)**: hay que emitir factura (o crédito fiscal) por el acceso y las recargas; ver Parte 10.

- Lo que aún no hace: **pagos/recargas en línea** (a futuro), **factura electrónica (DTE)** (confirmada, pendiente del registro de la empresa) (los avisos con la app cerrada llegaron en la Parte 8).

### Parte 5 — Pedido rápido por toneladas y contrapropuesta del motorista

- **Link del cliente**: nueva pestaña **Por toneladas** (la que se abre primero) con botones **0 a 1 tonelada**, **1 a 2**,
  **2 a 3** y **Más de 3** (este último con − / + de media tonelada). Cada botón muestra el precio al instante: se cobra el
  tope del rango con el precio por tonelada de Tarifas ($10, $20, $30, $35+). La pestaña **Por materiales** sigue igual.
  Los rangos que ningún vehículo activo puede llevar salen desactivados. El servidor recalcula peso y precio.
- **Contrapropuesta dentro de los km incluidos** (estilo inDrive): el motorista ve «Proponer otro precio» también en viajes
  cercanos; el precio debe ser mayor al de la app. El cliente acepta o dice «No, gracias» y se sigue buscando con el precio
  por peso. Fuera de los km incluidos funciona como antes.
- **Tarifas**: casilla «Permitir contrapropuestas dentro de los km incluidos» (encendida por defecto) y ejemplos de precio por rango.
- El motorista y el panel ven «1 a 2 toneladas» en lugar de la lista de materiales cuando el cliente pidió por rango.
- Pruebas: `tests/rangos.spec.ts`. Capturas: `node tests/capturas-rangos.mjs`.

### Parte 6 — Calificaciones y clientes

- **Cliente**: al entregarse el viaje, su link muestra el **resumen** (distancia, duración, cuánto pagó, pago en efectivo)
  y le pide **calificar al motorista** de 1 a 5 estrellas con comentario opcional. Solo se puede calificar una vez.
  El promedio del motorista aparece en la tarjeta «Te atendió».
- **Motorista**: después de entregar, en Inicio le sale «¿Qué tal …?» para calificar al cliente (o **Omitir**). Solo lo ve
  FleteYa. En **Perfil** ve su promedio y los últimos comentarios.
- **Panel**: nueva sección **Clientes** (se agrupan por celular, porque los clientes no tienen cuenta): búsqueda, filtros
  «Frecuentes (3+ viajes)» y «Bloqueados», y una ficha por cliente con pedidos, entregados, cancelados, total gastado,
  calificación que le dan los motoristas y su lista de pedidos. Desde la ficha se puede **bloquear** (con motivo) y
  **desbloquear**. Un número bloqueado no puede pedir fletes y sus pedidos que esperaban motorista se cancelan.
  Las calificaciones también se ven en el detalle de cada viaje y de cada motorista.
- Base de datos: correr `npm run db:migrar` (agrega las calificaciones al viaje y la tabla de clientes bloqueados).
- Pruebas: `tests/calificaciones.spec.ts`. Capturas: `node tests/capturas-calificaciones.mjs`.

### Parte 7 — Tablero en vivo, reportes y finanzas

- **Inicio del panel → Ahora mismo**: mapa en vivo (OpenStreetMap) con los motoristas disponibles (verde), los que van en
  viaje (amarillo) y los pedidos que buscan motorista (naranja, con los minutos que llevan esperando; en rojo desde 10 min).
  Se actualiza solo cada 15 s. Un motorista cuenta como conectado si su app habló con el servidor en los últimos 2 minutos.
- **Inicio → Viajes e ingresos**: hoy, esta semana (desde el lunes) y este mes: viajes entregados, lo cobrado por los
  motoristas, la comisión y las recargas.
- **Reportes y finanzas** (`/panel/reportes`): hoy, esta semana, este mes, mes anterior u otras fechas (hora de El Salvador).
  - *Dinero de FleteYa*: **recargas cobradas** (efectivo / transferencia, sin las anuladas), **gastos**,
    **ganancia neta = recargas − gastos** y **comisión de viajes** (se descuenta de los créditos ya pagados, por eso no se suma dos veces).
    También muestra los créditos que los motoristas aún no han usado y lo que deben los que están en negativo.
  - *Viajes*: entregados (por fecha de entrega), cobrado por los motoristas, precio promedio, pedidos y % de cancelados.
  - Gráfica por día (o por mes si son más de 62 días), tabla **por motorista** (viajes, cobrado, comisión, recargas, estrellas)
    y **por punto QR** (pedidos, entregados, cobrado).
  - **Gastos de FleteYa**: anotar fecha, categoría, detalle y monto; se pueden borrar. Botones para descargar en Excel los
    viajes, las recargas y los gastos del periodo.
- **Viajes**: filtros por fechas, motorista, punto QR y búsqueda (además de las pestañas por estado), totales de lo
  filtrado y **Exportar a Excel** con los mismos filtros (todas las filas, no solo las 100 de la pantalla).
- Pruebas: `tests/reportes.spec.ts`. Capturas: `node tests/capturas-reportes.mjs`.

### Parte 8 — Avisos con la app cerrada y zona dibujada en el mapa

- **Avisos (notificaciones) aunque la app esté cerrada**, con el sistema estándar del navegador (Web Push):
  - *Motorista*: le llega «Nueva solicitud de flete» con precio y ferretería (solo si está **Disponible**, abrió la app en
    las últimas 8 horas, tiene saldo, licencia vigente, vehículo con capacidad y no está en otro viaje). También le avisa
    cuando el cliente acepta o rechaza su precio, cuando cancela, cuando el propietario cancela, cuando aprueban su cuenta y
    cuando le cargan una recarga (con link al recibo). Se activan al ponerse «Disponible» o en **Perfil → Avisos con la app cerrada**,
    donde también hay «Probar aviso» y «Desactivar».
  - *Cliente* (sin cuenta): en el link de su pedido aparece **«Avísame en este teléfono»**. Le llega cuando un motorista
    acepta o le propone precio, cuando va en camino, llega, carga, va hacia el destino y entrega, o si se cancela.
  - Al tocar el aviso se abre la pantalla correcta. Si un teléfono quitó el permiso, se borra solo.
  - **Android (Chrome)**: funciona directo. **iPhone**: solo con iOS 16.4 o más nuevo y abriendo FleteYa desde el ícono
    («Compartir → Agregar a inicio»); la pantalla lo explica.
- **Zona de servicio dibujada** (Tarifas y zona): además del círculo, el propietario puede tocar el mapa punto por punto
  para marcar el área exacta (mínimo 3 puntos, máximo 60; «Deshacer punto», «Borrar área»; muestra los km²; no deja
  guardar si las líneas se cruzan). Al guardar avisa qué ferreterías con QR quedaron fuera. El área se ve en el mapa del
  cliente, en Puntos QR y en el mapa en vivo. Fuera del área el cliente no puede pedir y no se pueden crear QR.
  **No cambia el precio**: los $10 por tonelada siguen contando 5 km a la redonda desde la ferretería donde se carga.
- Claves para los avisos (una sola vez): `npx web-push generate-vapid-keys` y ponerlas en `.env` como `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY` y `VAPID_CORREO="mailto:soporte@tu-dominio.com"`. **No cambiarlas después**: los teléfonos ya
  suscritos dejarían de recibir avisos. Sin claves la app funciona igual, solo que sin avisos.
- Base de datos: correr `npm run db:migrar` (agrega la tabla de suscripciones a avisos y el área de la zona).
- Pruebas: `tests/avisos-zonas.spec.ts`. Capturas: `node tests/capturas-avisos-zonas.mjs`.

### Parte 10 — Registro del motorista, acceso de $10 y recargas libres

Decisión del 16 de noviembre de 2026: **ya no hay planes semanales ni mensuales**.

- **Recargas de monto libre** (de $1 a $500): el motorista necesita saldo para recibir viajes. En el panel se escribe el
  monto (con botones rápidos $5/$10/$20/$50) y en la app el motorista ve montos sugeridos con cuántos viajes alcanzan.
- **Acceso a la plataforma: $10, una sola vez** (se cambia en Créditos → Datos y precios). No se convierte en créditos.
  Genera su propio recibo con concepto «Acceso a la plataforma» y se puede anular como una recarga.
- **Registro por el propio motorista** en `/motorista/registro` (enlace en la pantalla de entrar), en 6 pasos:
  Tus datos (con su contraseña) → Licencia → Vehículo → **Fotos** (DUI frente y reverso, licencia frente y reverso,
  tarjeta de circulación frente y reverso, vehículo de frente, atrás y ambos costados) → **Facturación** (opcional: casilla
  «Necesito crédito fiscal (CCF)» con NIT, NRC, razón social, giro y dirección) → **Pago y alta**, con el botón
  **«Pagar $10 y activar mi perfil»**. Si algo falla vuelve al paso con el error sin perder las fotos. Máximo 5 registros
  por hora por conexión.
- Después del registro entra a **Mi alta** (`/motorista/alta`): ve los 3 pasos (fotos, pago, revisión), la cuenta de
  FleteYa para transferir (Copiar), pago en efectivo, WhatsApp y un formulario para **avisar su número de referencia**.
  El botón «Pagar en línea con tarjeta» aparece desactivado («muy pronto») hasta contratar Wompi.
- En el **panel → Motoristas**: la lista marca «se registró solo», cuántas fotos tiene (n/10) y el estado del acceso
  (sin pagar / avisó su pago / pagado). En el detalle: fotos agrupadas, datos fiscales, la tarjeta **Pago del acceso**
  (con la referencia que avisó el motorista, forma de pago y «Registrar pago de $10.00») y aprobar exige las 10 fotos,
  el acceso pagado y 4 casillas de revisión (incluida «Las 4 fotos del vehículo coinciden con la placa y el tipo»).
- Términos para Motoristas y Aviso de Privacidad pasan a **v0.2**: los motoristas actuales los aceptan de nuevo al entrar.
- **Queda para cuando exista el registro de la empresa** (con Wompi contratado): pago en línea del acceso y de las
  recargas, factura electrónica DTE (consumidor final o crédito fiscal) en lugar del comprobante interno, y los datos
  de la empresa en Datos y precios y en los textos legales.
- Pruebas: `tests/registro.spec.ts` (y las de `panel.spec.ts` y `creditos.spec.ts` actualizadas).

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
# Avisos con la app cerrada (Parte 8). Generarlas con: npx web-push generate-vapid-keys
# VAPID_PUBLIC_KEY="..."
# VAPID_PRIVATE_KEY="..."
# VAPID_CORREO="mailto:soporte@tu-dominio.com"
# Mapas de Google (ver "Google Maps" abajo). Sin ella se usa OpenStreetMap.
# GOOGLE_MAPS_API_KEY="AIza..."
```

### Google Maps

Todos los mapas (cliente, motorista, Puntos QR, Tarifas y zona, mapa en vivo) usan **Google Maps** cuando el servidor
tiene `GOOGLE_MAPS_API_KEY`. No hace falta volver a compilar: basta con reiniciar el servidor. Si la variable no está,
o Google rechaza la clave, los mapas se muestran con OpenStreetMap para que la app no deje de funcionar.

Cómo sacar la clave (con la cuenta de Google de FleteYa):
1. Entrar a https://console.cloud.google.com, crear el proyecto **FleteYa** y activar la **facturación** (Google da
   un crédito mensual gratis; una app de este tamaño normalmente no lo pasa, pero pide tarjeta).
2. En **APIs y servicios → Biblioteca** activar **Maps JavaScript API**.
3. En **APIs y servicios → Credenciales → Crear credenciales → Clave de API**.
4. Editar la clave: **Restricciones de aplicación → Sitios web (referentes HTTP)** con la dirección de la app
   (por ejemplo `https://tu-dominio/*`), y **Restricciones de API → Maps JavaScript API**.
5. Poner la clave en `.env` como `GOOGLE_MAPS_API_KEY` y reiniciar.

La clave viaja al navegador (así funciona Google Maps); por eso es importante la restricción por dirección del paso 4.

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
motorista (saldo, historial, recibo, PDF) y que no abre recibos ajenos, acceso sin sesión, anular, datos y precios, recarga de monto libre, y que
con saldo ya puede ponerse disponible. Parte 6 (`tests/calificaciones.spec.ts`): entrega completa en la app, resumen y
calificación del cliente (sin estrellas da error, no se califica dos veces), el motorista califica u omite, promedios en
el perfil y en el panel, y la sección Clientes (búsqueda, ficha, bloquear con motivo, pedido rechazado y desbloquear). La prueba del correo solo corre con un SMTP de prueba:
`node tests/smtp-falso.mjs` (guarda los correos en `SMTP_BUZON`), el servidor arrancado con
`SMTP_URL=smtp://localhost:2525` y `SMTP_BUZON=... npx playwright test tests/creditos.spec.ts`. **Usan la base de datos real que configures**, así que crean motoristas y
propietarios, materiales, puntos QR y viajes de prueba: córrelas solo en una base de pruebas.

Parte 8 (`tests/avisos-zonas.spec.ts`): a quién le llega el aviso de un pedido nuevo, avisos al cliente y al motorista,
borrado de teléfonos que quitaron el permiso, el botón de avisos, dibujar el área y pedir/crear QR fuera de ella. Las de
avisos usan un servicio de avisos falso que guarda lo que recibe:

```bash
openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj /CN=localhost -keyout llave.pem -out cert.pem
PUSH_BUZON=$PWD/buzon.jsonl PUSH_CERT=cert.pem PUSH_LLAVE=llave.pem node tests/push-falso.mjs &
NODE_EXTRA_CA_CERTS=cert.pem npm run start     # el panel debe confiar en el certificado de prueba
PUSH_BUZON=$PWD/buzon.jsonl E2E_CORREO=... E2E_PASSWORD=... npx playwright test tests/avisos-zonas.spec.ts
```

`node tests/capturas.mjs` (Parte 1), `node tests/capturas-cliente.mjs` (Parte 2), `node tests/capturas-motorista.mjs` (Parte 3) `node tests/capturas-creditos.mjs` (Parte 4) `node tests/capturas-reportes.mjs` (Parte 7) y `node tests/capturas-avisos-zonas.mjs` (Parte 8) sacan capturas de pantalla en
computadora y celular (carpeta `capturas/`, o la que digas en `CAPTURAS`).

## Notas

- Los documentos se guardan dentro de la base de datos y solo se ven con sesión de propietario.
- Al entrar se bloquea 15 minutos después de 5 intentos fallidos.
- Los QR usan la dirección con la que se abre el panel (o `PUBLIC_URL` si se define). Imprime los definitivos
  cuando la app esté publicada.
- `npm run build` y `npm run dev` copian `docs/legal/*.md` a `legal/` (carpeta generada, no se sube).
