# 🚚 FleteYa

**Plataforma de transporte de carga bajo demanda — El Salvador 🇸🇻**

FleteYa conecta a personas que necesitan transportar materiales (por ejemplo, al salir de una ferretería) con motoristas de pickups y camiones disponibles en ese momento. Funciona como Uber, pero para fletes: el cliente envía la solicitud y el motorista más cercano la acepta.

## 👥 Tipos de acceso

| Rol | Acceso | Descripción |
|-----|--------|-------------|
| **Propietarios / Admin** | Panel web con inicio de sesión | Gestionan motoristas, viajes, tarifas y reportes |
| **Motoristas** | App móvil con inicio de sesión | Reciben y aceptan solicitudes de viaje en tiempo real |
| **Clientes** | Link web (sin descargar app) | Solicitan un flete de forma rápida y sencilla |

## 🛠️ Tecnologías (propuestas)

- **App motorista:** React Native / Expo
- **Link web del cliente:** Next.js (web responsive / PWA)
- **Panel de administración:** Next.js
- **Backend / API:** Node.js
- **Base de datos:** PostgreSQL
- **Tiempo real:** WebSockets / notificaciones push
- **Mapas:** Google Maps API

> Fase actual: definición y estructura. Aún no hay código.

## 📁 Estructura de carpetas

```
fleteya/
├── apps/
│   ├── motorista/      # App móvil para motoristas
│   ├── cliente-web/    # Link web para que el cliente pida el viaje
│   └── admin-panel/    # Panel de administración (propietarios)
├── docs/
│   └── estructura.md   # Planificación completa del proyecto
└── README.md
```

## 📄 Documentación

Ver [docs/estructura.md](docs/estructura.md) para la planificación completa.
