// Cálculos de precio y distancia. Se usan igual en el navegador (vista previa) y en el servidor (precio que se guarda).

export type Tarifa = { precioTonelada: number; tarifaMinima: number; kmIncluidos: number; recargoKmPct?: number };

/** Distancia en línea recta entre dos puntos, en km ("a la redonda"). */
export function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const centavos = (n: number) => Math.round(n * 100) / 100;

/** $ por tonelada, proporcional al peso, con tarifa mínima. Redondeado al centavo. Solo cobra el peso. */
export function precioPorPeso(pesoKg: number, t: Tarifa) {
  return centavos(Math.max(t.tarifaMinima, (pesoKg / 1000) * t.precioTonelada));
}

/** Km que pasan de los incluidos (fraccional, nunca negativo). */
export function kmExtra(km: number, t: Tarifa) {
  return Math.max(0, km - t.kmIncluidos);
}

/**
 * Precio completo del viaje = precio por peso + recargo por los km que pasen de los incluidos.
 * El recargo = precio base × (recargoKmPct/100) × kmExtra. Ej.: base $10, 3 km extra, 10% → +$3 → total $13.
 */
export function precioViaje(pesoKg: number, km: number, t: Tarifa): { base: number; kmExtra: number; recargoKm: number; total: number } {
  const base = precioPorPeso(pesoKg, t);
  const extra = kmExtra(km, t);
  const recargoKm = centavos(base * ((t.recargoKmPct ?? 0) / 100) * extra);
  return { base, kmExtra: extra, recargoKm, total: centavos(base + recargoKm) };
}

export function dinero(n: number) {
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;
}

export function kg(n: number) {
  return `${new Intl.NumberFormat("es-SV", { maximumFractionDigits: 1 }).format(n)} kg`;
}

export function numeroViaje(n: number) {
  return `FY-${String(n).padStart(4, "0")}`;
}

export const ESTADOS_VIAJE = {
  BUSCANDO: { nombre: "Buscando motorista", clase: "bg-naranja/15 text-naranja", icono: "fa-magnifying-glass" },
  ASIGNADO: { nombre: "Motorista asignado", clase: "bg-exito/15 text-exito", icono: "fa-user-check" },
  EN_CAMINO: { nombre: "En camino a recogida", clase: "bg-exito/15 text-exito", icono: "fa-truck" },
  CARGANDO: { nombre: "Cargando", clase: "bg-exito/15 text-exito", icono: "fa-dolly" },
  EN_RUTA: { nombre: "En ruta al destino", clase: "bg-exito/15 text-exito", icono: "fa-route" },
  ENTREGADO: { nombre: "Entregado", clase: "bg-tarjeta-2 text-texto", icono: "fa-flag-checkered" },
  CANCELADO: { nombre: "Cancelado", clase: "bg-error/15 text-error", icono: "fa-ban" },
} as const;
