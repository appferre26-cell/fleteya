# FleteYa — Parte técnica y costos (Punto 3)

> Fecha: 15 de noviembre de 2026 · Piloto: Lourdes, Colón · ~10 motoristas
> Los precios de proveedores se consultaron en sus sitios públicos en noviembre de 2026 y pueden cambiar. Los montos marcados como **estimado** son aproximaciones, no cotizaciones.

---

## 1. Cómo se va a construir (explicado sencillo)

FleteYa tendrá **un solo sistema** con tres "puertas" separadas, como ya acordamos:

| Puerta | Quién la usa | Cómo entra |
|---|---|---|
| **Link del cliente** | Cliente (no se registra) | Escanea el QR de la ferretería o abre el link `.../pedir?f=FER001` |
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
| Sistema web (las 3 puertas) | Pantallas que ya diseñamos | Next.js (React) |
| Base de datos | Motoristas, viajes, créditos, recibos, ferreterías | PostgreSQL (Supabase) |
| Tiempo real | Que la solicitud llegue al instante y el cliente vea al camión | Supabase Realtime |
| Mapas y distancia | Calcular los km, saber si pasa de 5 km, mostrar el mapa | Google Maps Platform |
| Pagos en línea | Pago del cliente y recargas de créditos | Wompi (Banco Agrícola) — alternativa: n1co |
| Recibos PDF | Recibos de recargas (ver, descargar, compartir) | Se generan dentro del mismo sistema |
| Correo (opcional) | Enviar recibos al motorista que dio su correo | Resend o similar (plan gratis) |
| Notificaciones | Avisar al motorista de solicitudes nuevas | Web Push (gratis) |

### Cómo fluye un viaje (técnicamente)
1. El cliente abre el link del QR → el sistema sabe de qué ferretería sale.
2. Arma su lista de materiales → el sistema suma el peso y calcula el precio ($10/ton, mínimo $10).
3. Pone la dirección → Google Maps calcula los km. Si pasa de 5 km, se activa la oferta del motorista.
4. La solicitud llega en tiempo real a los motoristas cercanos que tienen saldo.
5. El motorista acepta → se descuenta el 10% de sus créditos y el cliente ve al camión.
6. Pago: efectivo al motorista, o en línea con link de Wompi (el dinero va a FleteYa y se liquida al motorista el lunes).

---

## 2. Costos

### 2.1 Costos de una sola vez

| Concepto | Costo | Nota |
|---|---|---|
| Dominio `fleteya.com.sv` (1 año) | $25 | Precio oficial SVNet. `fleteya.sv` cuesta $50/año. Comprar antes de imprimir los QR. |
| Cuenta de desarrollador Google Play | $25 | Solo cuando se haga la app nativa (fase 2). |
| Cuenta de desarrollador Apple | $99/año | Solo si después se quiere app en App Store. No es necesaria para el piloto. |
| Impresión de QR para ferreterías | Por cotizar | Depende de cuántas ferreterías y del material (sticker, acrílico). |

### 2.2 Costos mensuales del piloto (estimado)

| Concepto | Piloto (~10 motoristas) | Cuando crezca |
|---|---|---|
| Hosting del sistema web | $0 – $20 | ~$20/mes |
| Base de datos + tiempo real (Supabase) | $0 (plan gratis) | ~$25/mes (plan Pro) |
| Google Maps | **$0** (10,000 usos gratis al mes por servicio) | Se paga solo si se pasa de los usos gratis |
| Notificaciones push | $0 | $0 |
| Correo de recibos | $0 (plan gratis) | ~$20/mes con mucho volumen |
| **Total estimado** | **$0 – $20/mes** | **~$45 – $90/mes** |

> Cálculo de Google Maps (estimado): 20 viajes al día × 30 días = 600 viajes/mes. Aunque cada viaje use varias consultas al mapa, se queda muy por debajo de 10,000 usos gratis al mes.
> Google pide registrar una tarjeta para activar la cuenta aunque no se cobre nada.

### 2.3 Costo de los pagos en línea (Wompi)

- Wompi cobra **3.5% por transacción**, sin mensualidad ni costo de instalación. Al 3.5% se le suma el IVA sobre la comisión.
- El dinero se deposita al siguiente día hábil en una **cuenta de Banco Agrícola** (requisito de Wompi).
- Pueden aplicar retenciones de impuestos según el tipo de contribuyente — confirmar con el contador.

**Ejemplos (estimado, comisión 3.5% + 13% IVA sobre la comisión):**

| Pago | Comisión Wompi aprox. |
|---|---|
| Viaje de $11.09 pagado en línea | ~$0.44 |
| Recarga semanal de $20 | ~$0.79 |
| Recarga mensual de $60 | ~$2.37 |

> ⚠️ **Decisión pendiente:** en un viaje de $11.09, FleteYa gana $1.11 (10%) y Wompi cobra ~$0.44. **¿Quién paga la comisión de Wompi?** Opciones:
> 1. La absorbe FleteYa (más simple para el cliente, pero reduce la ganancia).
> 2. Se suma al cliente un pequeño cargo por pago en línea (ej. "+3.5% por pagar con tarjeta").
> 3. Se descuenta del pago al motorista en la liquidación del lunes.
> Esta decisión es de ustedes; el sistema puede hacer cualquiera de las tres.

### 2.4 Costo de desarrollo
- **Opción A — Construirlo conmigo por partes (recomendado para el piloto):** lo voy armando en esta plataforma, parte por parte, y ustedes revisan cada avance. El costo es el de su plan de Abacus.AI más los servicios de la tabla 2.2.
- **Opción B — Contratar un programador o agencia:** se les puede entregar este documento y los diseños para que coticen. El precio depende de cada proveedor.

### 2.5 Facturación electrónica (DTE)
- Pendiente de confirmar con el contador si las recargas y comisiones necesitan **factura electrónica (DTE)** además del recibo de la app.
- Si sí, se contrata un proveedor de facturación electrónica autorizado por Hacienda y el sistema se conecta a él. Su costo depende del proveedor y del número de documentos al mes.

---

## 3. Lo que necesitan tener listo ustedes

| # | Qué | Para qué | ¿Cuándo? |
|---|---|---|---|
| 1 | **Cuenta en Banco Agrícola** a nombre del socio inscrito en Hacienda | Recibir los pagos de Wompi | Antes de activar pagos en línea |
| 2 | **Afiliación a Wompi** (con DUI, NIT y documentos del socio) | Cobrar en línea | Antes de activar pagos en línea |
| 3 | **Cuenta de Google** del negocio + tarjeta | Activar Google Maps | Al empezar a construir |
| 4 | **Correo del negocio** (ej. fleteya.sv@gmail.com) | Cuentas de servicios y envío de recibos | Al empezar a construir |
| 5 | **Dominio** `fleteya.com.sv` o `fleteya.sv` | Link del cliente y QR definitivos | Antes de imprimir QR |
| 6 | **Lista real de materiales y pesos** de las ferreterías | Catálogo de la app | Durante la construcción |
| 7 | Respuesta del contador sobre **DTE** | Saber si se necesita factura electrónica | Antes del piloto |

---

## 4. Plan de construcción por partes (avance del Punto 4)

| Parte | Qué se construye | Resultado para probar |
|---|---|---|
| 1 | Panel del propietario: inicio de sesión, alta de motoristas (DUI, licencia, tarjeta de circulación, cuenta bancaria) | Ustedes pueden registrar motoristas |
| 2 | Link del cliente: QR por ferretería, lista de materiales, cálculo de peso y precio | Un cliente puede pedir un flete |
| 3 | App del motorista: inicio de sesión, términos, recibir y aceptar solicitudes en tiempo real, mapa | Un viaje completo de punta a punta (pago en efectivo) |
| 4 | Créditos: planes $20/$60, descuento del 10%, bloqueo por saldo negativo, recibos | Control de créditos y recibos descargables |
| 5 | Pagos en línea con Wompi y liquidación de los lunes | Cobro en línea y pago a motoristas |
| 6 | Ajustes finales y piloto en Lourdes | Lanzamiento con ~10 motoristas |

> Recomendación: empezar las partes 1 a 4 con **pago en efectivo** mientras se tramita la afiliación a Wompi, y activar la parte 5 cuando la cuenta esté lista.
