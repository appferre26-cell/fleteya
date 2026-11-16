// Cálculos de precio y distancia. Se usan igual en el navegador (vista previa) y en el servidor (precio que se guarda).

export type Tarifa = { precioTonelada: number; tarifaMinima: number; kmIncluidos: number };

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

/** $ por tonelada, proporcional al peso, con tarifa mínima. Redondeado al centavo. */
export function precioPorPeso(pesoKg: number, t: Tarifa) {
  return centavos(Math.max(t.tarifaMinima, (pesoKg / 1000) * t.precioTonelada));
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
