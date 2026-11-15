---
name: "FleteYa"
colors:
  primary: "#FF6B00"
  primary-hover: "#E65C00"
  secondary: "#1E1E1E"
  accent: "#FF6B00"
  neutral: "#A0A0A0"
  background: "#121212"
  surface: "#1E1E1E"
  surface-2: "#262626"
  border: "#2C2C2C"
  text: "#F5F5F5"
  text-muted: "#A0A0A0"
  success: "#4CAF50"
  error: "#F44336"
  in-progress: "#FF6B00"
typography:
  display:
    fontFamily: Inter
    fontSize: 1.75rem
    fontWeight: 800
  heading:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: 700
  body:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 400
  label:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: 600
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
rounded:
  sm: "8px"
  md: "12px"
  lg: "24px"
  full: "9999px"
---

## Overview
FleteYa es transporte de carga bajo demanda para El Salvador (fletes, materiales de ferretería, mudanzas). Tono directo, confiable y local. Modo oscuro siempre, pensado para motoristas que miran el teléfono todo el día y clientes que piden desde un link sin instalar nada.

## Color usage
- Fondo base `#121212` (nunca #000). Tarjetas/modales `#1E1E1E`, superficies internas `#262626`, bordes `#2C2C2C`.
- Naranja `#FF6B00` sólo para: botón primario, íconos activos, chips seleccionados, estado "en curso", precios y la ruta del mapa. Hover `#E65C00`.
- Texto `#F5F5F5` (nunca #FFF), secundario `#A0A0A0`.
- Éxito `#4CAF50` (en línea, completado). Error `#F44336` (cancelado, rechazar, suspender).
- Badges de estado: fondo del color al 12–15% de opacidad + texto del color.

## Typography
Inter en todo. Un título display por pantalla (800). Secciones `text-xs font-semibold uppercase tracking-wider text-[#A0A0A0]`. Cuerpo `text-sm`. Precios y KPIs en `font-extrabold` con números tabulares.

## Layout
Ritmo 4/8. Teléfono: padding lateral 20px, tarjetas `rounded-xl bg-[#1E1E1E] border border-[#2C2C2C] p-4`. Campos `rounded-lg` (8px). Botones principales `rounded-3xl` (24px), alto 52–56px. Desktop admin: sidebar 256px, contenido con grid de 12 columnas, gutters 24px.

## Do's and Don'ts
- Do: mapas siempre oscuros con ruta naranja y puntos naranja para motoristas.
- Do: íconos Font Awesome; naranja si activo, gris `#A0A0A0` si inactivo.
- Do: un solo botón naranja lleno por vista.
- Don't: blancos o negros puros, degradados agresivos, sombras en todo.
- Don't: bordes laterales de color como decoración de tarjetas.
