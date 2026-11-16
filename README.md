# 🚚 FleteYa

**Plataforma de transporte de carga bajo demanda — El Salvador 🇸🇻**

FleteYa conecta a personas que necesitan transportar materiales (por ejemplo, al salir de una ferretería) con motoristas de pickups y camiones disponibles en ese momento. Funciona como Uber, pero para fletes: el cliente envía la solicitud y el motorista más cercano la acepta.

## 👥 Tipos de acceso

| Rol | Acceso | Descripción |
|-----|--------|-------------|
| **Propietarios / Admin** | Panel en computadora y celular, con **su propio** inicio de sesión | Gestionan motoristas, viajes, tarifas y reportes |
| **Motoristas** | App móvil con **otro** inicio de sesión, aparte | Reciben y aceptan solicitudes de viaje en tiempo real |
| **Clientes** | Link web, **sin registro** | Solicitan un flete de forma rápida y sencilla |

> Propietarios y motoristas tienen perfiles e inicios de sesión separados. El cliente no crea cuenta.

## 🛠️ Tecnologías

- **Piloto:** apps web instalables (PWA) para las 3 puertas; app nativa de Android en una fase 2
- **Panel de propietarios:** Next.js 15 + TypeScript + Tailwind
- **Base de datos:** PostgreSQL (con Prisma)
- **Link web del cliente y app del motorista:** Next.js (PWA), en las próximas partes
- **Tiempo real y mapas:** actualización automática, avisos con la app cerrada (Web Push) y mapas de OpenStreetMap

> Avance: **Parte 1 — Panel del propietario** (login, motoristas con DUI, licencia y tarjeta de circulación, aprobar/suspender) y **Parte 2 — Link del cliente** (QR por ferretería, lista de materiales, peso y precio, pedido sin registro, estado del viaje; en el panel: viajes, catálogo, puntos QR, tarifas). Después: **Parte 3** (app del motorista), **Parte 4** (recargas de créditos y recibos), **Parte 5** (pedido por toneladas y contrapropuesta) **Parte 6** (calificaciones y sección Clientes con bloqueo), **Parte 7** (tablero en vivo, reportes y finanzas) y **Parte 8** (avisos con la app cerrada y zona dibujada en el mapa). Ver [apps/admin-panel/README.md](apps/admin-panel/README.md). Aún no está publicado.

## 📁 Estructura de carpetas

```
fleteya/
├── apps/
│   ├── motorista/      # App móvil para motoristas
│   ├── cliente-web/    # Link web para que el cliente pida el viaje
│   └── admin-panel/    # Panel de propietarios y link del cliente (Partes 1 y 2)
├── docs/
│   └── estructura.md   # Planificación completa del proyecto
└── README.md
```

## 📄 Documentación

Ver [docs/estructura.md](docs/estructura.md) para la planificación completa.
