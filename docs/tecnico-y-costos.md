# FleteYa — Parte técnica y costos (Punto 3)

> Fecha: 15 de noviembre de 2026 · Piloto: Lourdes, Colón · ~10 motoristas
> Los precios de proveedores se consultaron en sus sitios públicos en noviembre de 2026 y pueden cambiar. Los montos marcados como **estimado** son aproximaciones, no cotizaciones.
>
> **Decisiones vigentes:** (1) **solo efectivo** por ahora, sin pagos en línea; (2) se usa **la dirección gratuita de Abacus**, sin dominio propio; los QR se crean con esa dirección al publicar la app.

---

## 1. Cómo se va a construir (explicado sencillo)

FleteYa tendrá **un solo sistema** con tres "puertas" separadas, como ya acordamos:

| Puerta | Quién la usa | Cómo entra |
|---|---|---|
| **Link del cliente** | Cliente (no se registra) | Escanea el QR de la ferretería o abre el link `[dirección de Abacus]/pedir?f=FER001` |
| **App del motorista** | Motoristas | Usuario y contraseña que crea el propietario |
| **Panel del propietario** | Socios / gerencia | Usuario y contraseña de propietario |

### Recomendación para el piloto: app web instalable (PWA)
- La app del motorista se abre desde el navegador del celular y se **instala en la pantalla de inicio con un botón**, como si fuera una app normal.
- **No hay que esperar la aprobación de Play Store** ni pagar la cuenta de Apple al inicio.
- Recibe **notificaciones** de nuevas solicitudes (en Android funciona directo; en iPhone se debe instalar primero en la pantalla de inicio).
- Las actualizaciones llegan solas, sin que el motorista descargue nada.
- **Limitación:** el GPS del motorista se actualiza mientras tiene la app abierta. Para el piloto alcanza; si después se necesita rastreo con la app cerrada, se hace la **app nativa de Android** (fase 2).

### Piezas técnicas

| Pieza | Para qué sirve | Herramienta recomendada |
|---|---|---|
| Sistema web (las 3 puertas) | Pantallas que ya diseñamos | Next.js (React), publicado en Abacus con su dirección gratuita |
| Base de datos | Motoristas, viajes, créditos, recibos, ferreterías | PostgreSQL |
| Tiempo real | Que la solicitud llegue al instante y el cliente vea al camión | Actualización en vivo dentro del sistema |
| Mapas y distancia | Calcular los km, saber si pasa de 5 km, mostrar el mapa | Google Maps Platform |
| Recibos PDF | Recibos de recargas (ver, descargar, compartir) | Se generan dentro del mismo sistema |
| Correo (opcional) | Enviar recibos al motorista que dio su correo | Resend o similar (plan gratis) |
| Notificaciones | Avisar al motorista de solicitudes nuevas | Web Push (gratis) |

### Cómo fluye un viaje (técnicamente)
1. El cliente abre el link del QR → el sistema sabe de qué ferretería sale.
2. Arma su lista de materiales → el sistema suma el peso y calcula el precio ($10/ton, mínimo $10).
3. Pone la dirección → Google Maps calcula los km. Si pasa de 5 km, se activa la oferta del motorista.
4. La solicitud llega en tiempo real a los motoristas cercanos que tienen saldo.
5. El motorista acepta → se descuenta el 10% de sus créditos y el cliente ve al camión.
6. Pago: **en efectivo** al motorista al terminar el viaje.

### Cómo fluye una recarga
1. El motorista paga $20 o $60 al propietario (efectivo o transferencia).
2. El propietario la registra en el panel → **Créditos y recargas → Registrar recarga**.
3. Se descuenta la deuda si tenía saldo negativo, se actualiza el saldo y se genera el recibo (ver, PDF, WhatsApp, correo opcional).

---

## 2. Costos

### 2.1 Costos de una sola vez

| Concepto | Costo | Nota |
|---|---|---|
| Dominio | **$0** | Se usa la dirección gratuita de Abacus. |
| Cuenta de desarrollador Google Play | $25 | Solo cuando se haga la app nativa (fase 2). |
| Cuenta de desarrollador Apple | $99/año | No es necesaria para el piloto. |
| Impresión de QR para ferreterías | Por cotizar | Depende de cuántas ferreterías y del material (sticker, acrílico). |

### 2.2 Costos mensuales del piloto (estimado)

| Concepto | Piloto (~10 motoristas) | Cuando crezca |
|---|---|---|
| Publicación del sistema web | Según su plan de Abacus (por confirmar) | Según su plan de Abacus |
| Base de datos | Según su plan de Abacus (por confirmar) | Según su plan de Abacus |
| Google Maps | **$0** (10,000 usos gratis al mes por servicio) | Se paga solo si se pasa de los usos gratis |
| Notificaciones push | $0 | $0 |
| Correo de recibos | $0 (plan gratis) | ~$20/mes con mucho volumen |
| Comisiones de pagos en línea | **$0** (solo efectivo) | $0 mientras sea solo efectivo |
| **Total estimado en servicios externos** | **$0/mes** | **~$0 – $20/mes** |

> Cálculo de Google Maps (estimado): 20 viajes al día × 30 días = 600 viajes/mes. Aunque cada viaje use varias consultas al mapa, se queda muy por debajo de 10,000 usos gratis al mes.
> Google pide registrar una tarjeta para activar la cuenta aunque no se cobre nada.

### 2.3 Pagos en línea (guardado para después)
- Por ahora **no se usa**. Si algún día se activa, la opción revisada es **Wompi**: 3.5% + IVA por pago, sin mensualidad; el cliente **no necesita cuenta**, solo su tarjeta; requiere cuenta de Banco Agrícola a nombre del socio.

### 2.4 Costo de desarrollo
- **Opción A — Construirlo conmigo por partes (recomendado para el piloto):** lo voy armando en esta plataforma, parte por parte, y ustedes revisan cada avance. El costo es el de su plan de Abacus.AI más los servicios externos de la tabla 2.2 (hoy $0 estimado).
- **Opción B — Contratar un programador o agencia:** se les puede entregar este documento y los diseños para que coticen. El precio depende de cada proveedor.

### 2.5 Facturación electrónica (DTE)
- Pendiente de confirmar con el contador si las recargas y comisiones necesitan **factura electrónica (DTE)** además del recibo de la app.
- Si sí, se contrata un proveedor de facturación electrónica autorizado por Hacienda y el sistema se conecta a él. Su costo depende del proveedor y del número de documentos al mes.

---

## 3. Lo que necesitan tener listo ustedes

| # | Qué | Para qué | ¿Cuándo? |
|---|---|---|---|
| 1 | **Cuenta de Google** del negocio + tarjeta | Activar Google Maps | Al empezar a construir |
| 2 | **Correo del negocio** (ej. fleteya.sv@gmail.com) | Cuentas de servicios y envío de recibos | Al empezar a construir |
| 3 | **Lista real de materiales y pesos** de las ferreterías | Catálogo de la app | Durante la construcción |
| 4 | Datos del socio inscrito (nombre, NIT, dirección) | Recibos y documentos legales | Antes del piloto |
| 5 | Respuesta del contador sobre **DTE** | Saber si se necesita factura electrónica | Antes del piloto |
| 6 | Permiso de las ferreterías para pegar el QR | Puntos de pedido | Cuando se publique la app y se creen los QR |

---

## 4. Plan de construcción por partes (avance del Punto 4)

| Parte | Qué se construye | Resultado para probar |
|---|---|---|
| 1 | Panel del propietario: inicio de sesión, alta de motoristas (DUI, licencia, tarjeta de circulación, cuenta bancaria) | Ustedes pueden registrar motoristas |
| 2 | Link del cliente: QR por ferretería, lista de materiales, cálculo de peso y precio | Un cliente puede pedir un flete |
| 3 | App del motorista: inicio de sesión, términos, recibir y aceptar solicitudes en tiempo real, mapa | Un viaje completo de punta a punta (pago en efectivo) |
| 4 | Créditos: planes $20/$60, registro de recargas en el panel, descuento del 10%, bloqueo por saldo negativo, recibos | Control de créditos y recibos descargables |
| 5 | Publicación en Abacus, creación de los QR con esa dirección, ajustes finales y piloto en Lourdes | Lanzamiento con ~10 motoristas |

> Todo funciona con **pago en efectivo**; los pagos en línea quedan para una fase futura.
