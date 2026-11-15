# FleteYa — Estructura y Flujo de la Aplicación
> Documento de definición de producto · Versión 1.0 · El Salvador

---

## 1. Visión General

FleteYa es una plataforma bajo demanda que conecta a **clientes que necesitan transportar carga** (materiales de ferretería, muebles, mudanzas, mercadería) con **motoristas que cuentan con pick-ups o camiones pequeños**, operando en tiempo real similar a Uber, pero especializada en transporte de carga local.

En las **ferreterías** se colocará un QR que los clientes escanean para pedir el viaje en el momento. En la Fase 1 la ferretería no recibe porcentaje: el enfoque es solo el viaje.

---

## 2. Tipos de Usuario

| Usuario | Acceso | Rol |
|---------|--------|-----|
| **Propietario / Admin** | Panel admin en computadora **y celular** (login) | Gestiona toda la operación: motoristas, tarifas, reportes, viajes |
| **Motorista** | App móvil (login) | Recibe y acepta solicitudes de viaje en tiempo real |
| **Cliente** | Link web (sin registro) | Solicita el viaje de forma rápida y simple |

### 2.1 Accesos separados (regla fija)

Cada tipo de usuario tiene su **propia entrada y su propio perfil**. No comparten pantalla de inicio de sesión ni cuentas.

| Acceso | Dónde entra | Cómo se identifica | ¿Se registra? |
|--------|-------------|--------------------|---------------|
| **Propietarios** | Panel admin (computadora y celular, dirección propia) | Correo + contraseña de propietario | No hay registro público: las cuentas las crean los propios propietarios |
| **Motoristas** | App del motorista | Teléfono + contraseña de motorista | No hay registro libre: el motorista lo da de alta un propietario y recibe sus credenciales |
| **Clientes** | Link web para pedir viaje | Solo nombre y teléfono en cada pedido | **No se registra** — sin cuenta ni contraseña |

- **Decisión: dos apps separadas (Opción A).** La app **FleteYa Motorista** solo tiene el inicio de sesión de motoristas; el **panel de propietarios** es otra app aparte, con su propio inicio de sesión, que se abre en la computadora o se instala en el celular desde su link. Los motoristas no ven ningún botón ni acceso a la parte de propietarios.
- Una cuenta de motorista **no puede** entrar al panel de propietarios, y una de propietario no se usa en la app del motorista.
- Son perfiles diferentes: el perfil del propietario guarda permisos de administración; el del motorista guarda vehículo, documentos, calificación y ganancias.
- Al cliente se le reconoce por su número de teléfono para ver su historial, pero nunca crea una cuenta.

---

## 3. Flujo del Cliente (vía Link Web)

El cliente **no descarga ninguna app**. Recibe o busca el link de FleteYa y desde ahí gestiona todo.

### Pantallas del cliente

**Paso 1 — Identificación básica**
- Nombre
- Número de teléfono (para confirmación por WhatsApp o SMS)
- *(Sin contraseña — el teléfono es suficiente para identificarlo)*

**Paso 2 — Detalles del viaje**
- Punto de recogida (mapa o dirección escrita)
- Punto de destino (mapa o dirección escrita)
- Tipo de carga: `Materiales de construcción / Muebles / Mudanza / Mercadería / Otro`
- Número aproximado de bultos o descripción breve
- ¿Necesita ayuda para cargar? (sí/no) → esto afecta la tarifa

**Paso 3 — Selección de vehículo**
- Pick-up estándar (hasta 500 kg)
- Camión pequeño (hasta 1 ton)
- Camión mediano (hasta 2 ton)
- *(Con foto ilustrativa de cada tipo y precio estimado)*

**Paso 4 — Cotización estimada**
- Precio calculado automáticamente según distancia + tipo de vehículo
- Tiempo estimado de llegada del motorista
- Botón: **"Solicitar FleteYa"**

**Paso 5 — En espera de motorista**
- Pantalla de espera con animación
- Tiempo estimado de respuesta
- Opción de cancelar

**Paso 6 — Motorista asignado**
- Nombre del motorista
- Foto y calificación
- Placa y descripción del vehículo
- Ubicación en tiempo real en el mapa
- Botón para llamar directamente al motorista

**Paso 7 — Viaje en curso**
- Mapa con la ruta activa
- Estado: `En camino a recogida → Cargando → En ruta al destino → Entregado`

**Paso 8 — Viaje completado**
- Resumen del viaje (distancia, duración, precio final)
- Método de pago: `Efectivo al motorista` o `Transferencia`
- Calificación del motorista (1–5 estrellas + comentario opcional)

---

## 4. Flujo del Motorista (App Móvil)

### Pantallas del motorista

**Inicio de sesión**
- Teléfono + contraseña
- *(El admin crea la cuenta; el motorista solo recibe sus credenciales)*

**Dashboard principal**
- Botón ON/OFF: Activar disponibilidad
- Mapa con su ubicación actual
- Contador de viajes del día y ganancias del día
- Historial reciente

**Solicitud entrante** *(notificación + pantalla emergente)*
- Nombre del cliente
- Punto de recogida y destino en el mapa
- Tipo de carga y descripción
- Distancia total del viaje
- Precio del viaje
- Tiempo límite para aceptar (ej. 30 segundos)
- Botones: **Aceptar** / **Rechazar**

**Viaje activo**
- Navegación al punto de recogida (con integración a Google Maps o Waze)
- Confirmación de recogida: botón `"Ya llegué / Iniciar carga"`
- Confirmación de entrega: botón `"Entrega completada"`

**Fin del viaje**
- Resumen del viaje (distancia, precio)
- Calificación del cliente
- Regresa automáticamente al modo disponible

**Perfil del motorista**
- Foto, nombre, placa
- Documentos subidos (licencia, DUI, tarjeta de circulación)
- Calificación promedio
- Historial de viajes

**Mis ganancias**
- Ganancias del día / semana / mes
- Desglose por viaje
- *(Comisión de FleteYa descontada automáticamente)*

---

## 5. Flujo del Propietario / Admin (Panel en computadora y celular)

El panel de propietarios funciona **en computadora y en el celular**:

- **Computadora:** vista completa con menú lateral, mapa grande y tablas.
- **Celular:** el mismo panel adaptado a pantalla pequeña, con barra de navegación inferior, tarjetas en lugar de tablas y botones grandes. Se puede **instalar como app** en la pantalla de inicio del teléfono (PWA), sin pasar por Play Store ni App Store, y recibir notificaciones (por ejemplo, "solicitud sin motorista" o "motorista pendiente de aprobación").
- Es la **misma cuenta de propietario** en ambos dispositivos, y sigue separada de la app del motorista.
- Si más adelante se prefiere una app nativa de propietarios en las tiendas, se puede construir sin cambiar esta estructura.

### Pantallas del panel admin

**Dashboard general**
- Viajes activos en este momento (mapa en vivo)
- Motoristas conectados (online/offline)
- Viajes del día / semana / mes
- Ingresos del día / semana / mes
- Alertas y notificaciones

**Gestión de motoristas**
- Lista de todos los motoristas (activos, inactivos, pendientes)
- Aprobar nuevo motorista (revisar documentos)
- Suspender o dar de baja
- Ver historial y calificación de cada motorista
- Ver ubicación en tiempo real

**Viajes en tiempo real**
- Mapa con todos los viajes activos
- Detalle de cada viaje: cliente, motorista, ruta, estado
- Intervención manual si hay problema

**Historial de viajes**
- Todos los viajes completados, cancelados o con incidencias
- Filtros por fecha, motorista, zona, estado
- Exportar a Excel

**Gestión de tarifas**
- Precio base por tipo de vehículo
- Precio por kilómetro
- Recargo por ayuda con carga
- Tarifa mínima
- Comisión de FleteYa (% que retiene la plataforma)

**Clientes**
- Historial de clientes (por número de teléfono)
- Frecuencia de uso y viajes pasados
- Bloquear cliente si hay abuso

**Reportes y finanzas**
- Reporte de ganancias netas
- Comisiones cobradas
- Pagos a motoristas pendientes

**Configuración**
- Zonas de operación (definir en qué municipios/departamentos opera FleteYa)
- Notificaciones del sistema
- Gestión de administradores adicionales

---

## 6. Estados de un Viaje

```
SOLICITADO → EN BÚSQUEDA DE MOTORISTA → MOTORISTA ASIGNADO
→ MOTORISTA EN CAMINO → CARGANDO → EN RUTA → ENTREGADO
                                                      ↓
                                                  CALIFICADO
         (en cualquier punto antes de ENTREGADO)
                    ↓
                CANCELADO
```

---

## 7. Sistema de Tarifas

### Tarifa base (Fase 1)

| Concepto | Valor |
|----------|-------|
| Precio por tonelada | $10.00 |
| Distancia incluida | 5 km a la redonda desde el punto de salida |
| **Tarifa mínima** | **$10.00** (los motoristas no hacen viajes por menos) |
| Distancia adicional | Negociable entre motorista y cliente (ver abajo) |

**Ejemplos (dentro de los 5 km):**
- 300 kg → paga $10.00 (se aplica la tarifa mínima)
- 1 tonelada → paga $10.00
- 2 toneladas → paga $20.00

### Distancia mayor a 5 km — Modelo InDrive

Cuando el destino está a más de 5 km del punto de salida:

1. El motorista ve la solicitud y puede **modificar el precio** antes de aceptar.
2. El cliente recibe la oferta del motorista y puede **aceptarla o no**.
3. Si la rechaza, el motorista puede hacer otra oferta o cancelar.
4. Solo cuando ambos están de acuerdo se confirma el viaje.

> Este mecanismo protege al motorista en viajes largos sin que FleteYa tenga que definir tarifas por zona.

---

## 8. Métodos de Pago (Fase 1)

- **Efectivo al motorista** — el cliente le paga directo al motorista al terminar el viaje.
- **Pago en línea** — desde el link web del cliente. *(El proveedor de pagos aún no está definido; se integrará cuando se seleccione.)*

### Sistema de créditos del motorista (cómo gana FleteYa)

El motorista trabaja con un **saldo de créditos prepagados**. FleteYa gana de dos formas:

#### 1. Suscripción (recarga de créditos)

| Plan | Precio |
|------|--------|
| Semanal | $20.00 |
| Mensual | $60.00 |

El motorista recarga antes de poder recibir viajes. **Las recargas son solo en línea** (desde la app del motorista, con el mismo proveedor de pagos que se elija para los clientes).

> **Requisito:** todo motorista debe tener **cuenta de banco** para poder recargar créditos y recibir los pagos en línea de los clientes.

#### 2. Comisión por viaje

- FleteYa descuenta automáticamente el **10% de cada viaje** de los créditos del motorista.
- Ejemplo: viaje de $10 → se descuentan $1.00 de créditos.
- Cuando los créditos llegan a **$0**, el motorista queda bloqueado y no puede recibir más viajes hasta recargar.

#### Flujo del crédito

```
Motorista recarga ($20 semana o $60 mes)
        ↓
  Recibe viajes normalmente
        ↓
  Por cada viaje: se descuenta el 10% de sus créditos
        ↓
  Créditos = $0  →  bloqueado hasta próxima recarga
```

> Los créditos **no son dinero para los clientes**: son la forma en que el motorista paga su acceso y la comisión de FleteYa. El cliente paga aparte (efectivo o en línea).

#### Preguntas pendientes sobre créditos
- ¿Qué pasa si el motorista tiene $0.80 en créditos y llega un viaje de $10 (que descontaría $1.00)? ¿Se bloquea antes de aceptar ese viaje?
- ¿El motorista puede ver en su app cuántos créditos le quedan en tiempo real? *(recomendado: sí)*

---

## 9. Tipos de Vehículos Aceptados

| Tipo | Capacidad | Ideal para |
|------|-----------|-----------|
| Pick-up estándar | Hasta 500 kg | Materiales ligeros, compras de ferretería |
| Camión liviano | Hasta 1 tonelada | Muebles, mudanzas pequeñas |
| Camión mediano | Hasta 2 toneladas | Mudanzas medianas, mercadería |

---

## 10. Zonas de Operación y Plan de Expansión

### Respuesta rápida: sí, la zona se configura desde el primer día
La zona de cobertura se define en el panel de propietarios. Cuando un cliente pide un viaje desde fuera de la zona activa, la app le muestra un mensaje de "servicio no disponible en tu área todavía". No hay que tocar código: es solo configuración.

### Plan de expansión en 3 fases

| Fase | Zona | Cuándo |
|------|------|--------|
| **Fase 1** | Lourdes, Colón (La Libertad) | Lanzamiento inicial |
| **Fase 2** | Todo el departamento de La Libertad | Al crecer el servicio en Lourdes |
| **Fase 3** | San Salvador y Gran San Salvador | Expansión mayor |

### Cómo funciona la configuración de zona
- En el panel admin → **Configuración → Zonas de operación**, se dibuja el polígono de cobertura sobre el mapa.
- Se puede ampliar la zona en cualquier momento sin redeploy de la app.
- El cliente ve automáticamente si su punto de recogida está dentro o fuera de la zona activa.
- El motorista solo recibe solicitudes dentro de la zona activa.

---

## 11. QR en Ferreterías (punto de pedido)

En la Fase 1 el QR en las ferreterías **solo sirve para que el cliente pida su viaje más fácil**. La ferretería no participa en el proceso ni recibe pago: FleteYa se enfoca únicamente en el viaje.

### Cómo funciona

```
Cliente en la ferretería
        ↓
  Escanea el QR pegado en la ferretería
        ↓
  Se abre el link de FleteYa (el mismo del cliente, sin registro)
        ↓
  Pide el viaje normalmente (nombre, teléfono, destino)
        ↓
  Un motorista acepta y hace el flete
```

- La ferretería solo **pega el QR** en un lugar visible. No necesita instalar nada, no tiene cuenta y no maneja nada.
- El cliente hace exactamente el mismo proceso que con el link normal.
- El link del QR incluye un código de la ferretería (ej. `fleteya.sv/pedir?f=FER001`). Así el punto de recogida ya sale con la dirección de esa ferretería y los propietarios pueden ver de dónde vienen más pedidos.

### En el panel de propietarios

Una sección sencilla **"Puntos QR"**:
- Agregar una ferretería (nombre y dirección)
- Generar e imprimir su QR
- Ver cuántos viajes salieron de cada QR (solo como dato)

### A futuro (no en Fase 1)
- Dar un porcentaje del viaje a las ferreterías y llevar sus pagos. El código en el QR ya deja la base lista para hacerlo sin cambiar los QR impresos.

---

## 12. Consideraciones Clave para el Éxito

1. **Zona de lanzamiento** — Lourdes, Colón. La zona se configura desde el panel antes de abrir el servicio.
2. **Captación de motoristas** — Sin motoristas, no hay servicio. Plan de reclutamiento antes del lanzamiento.
3. **Verificación de motoristas** — DUI, licencia vigente, tarjeta de circulación, foto del vehículo y **cuenta de banco** (obligatoria).
4. **QR en ferreterías** — Pedir permiso a las ferreterías de Lourdes para pegar el QR de FleteYa antes del lanzamiento.
5. **Soporte al cliente** — WhatsApp Business o número directo para quejas/incidencias.
6. **Sistema de calificaciones** — Protege tanto al cliente como al motorista.
7. **Zonas de no cobertura** — El app muestra mensaje claro si el cliente está fuera del área activa.

---

## 13. Lo que FleteYa NO es (límites del servicio)

- No es una mudanza completa con empaque incluido *(a menos que se agregue después)*
- No garantiza vehículos refrigerados
- No hace envíos interdepartamentales de larga distancia en Fase 1
- No ofrece seguro de carga en Fase 1

---

## 14. Resumen de Plataformas a Construir

| Plataforma | Tecnología sugerida | Usuario |
|------------|-------------------|---------|
| App móvil (motorista) | React Native / Flutter | Motorista |
| Link web (cliente) | Página web responsive (PWA) | Cliente |
| Link web con QR (ferretería) | Página web responsive, sin registro | Cliente desde ferretería |
| Panel admin | Web app adaptable a celular, instalable (PWA) | Propietario |

---

*Documento elaborado como base de definición de producto — sujeto a revisiones del equipo FleteYa.*
