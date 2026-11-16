// Pedido rápido por toneladas: el cliente toca un rango y ve el precio al instante.
// Se cobra el tope del rango (1 ton, 2 ton, 3 ton) con el precio por tonelada configurado.
// Se usa igual en el navegador (botones) y en el servidor (precio y peso que se guardan).

export const RANGOS = [
  { id: "0-1", nombre: "0 a 1 tonelada", corto: "Hasta 1 ton", minTon: 0, maxTon: 1 },
  { id: "1-2", nombre: "1 a 2 toneladas", corto: "1 a 2 ton", minTon: 1, maxTon: 2 },
  { id: "2-3", nombre: "2 a 3 toneladas", corto: "2 a 3 ton", minTon: 2, maxTon: 3 },
  { id: "3+", nombre: "Más de 3 toneladas", corto: "Más de 3 ton", minTon: 3, maxTon: null },
] as const;

export type IdRango = (typeof RANGOS)[number]["id"];

export const TON_EXTRA = { min: 3.5, max: 20, paso: 0.5, inicial: 4 };

export function rangoPorId(id: string | null | undefined) {
  return RANGOS.find((r) => r.id === id) ?? null;
}

/** Toneladas que se cobran: el tope del rango, o las que escribió el cliente si es «más de 3». */
export function toneladasDeRango(id: IdRango, tonExtra?: number) {
  const r = rangoPorId(id)!;
  if (r.maxTon !== null) return r.maxTon;
  const t = Math.round((tonExtra ?? TON_EXTRA.inicial) / TON_EXTRA.paso) * TON_EXTRA.paso;
  return Math.min(TON_EXTRA.max, Math.max(TON_EXTRA.min, t));
}

/** Texto para motorista, panel y cliente. */
export function textoRango(id: string | null | undefined, pesoKg: number) {
  const r = rangoPorId(id);
  if (!r) return null;
  return r.maxTon === null ? `${r.nombre} (unas ${pesoKg / 1000} ton)` : r.nombre;
}
