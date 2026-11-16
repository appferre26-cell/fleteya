// Parte 8: zona de servicio. Puede ser un círculo (centro + radio) o un área dibujada en el mapa.
// Se usa en el servidor y en el navegador (no importa nada del servidor).
import { distanciaKm } from "./tarifa";

export type LatLng = { lat: number; lng: number };
export type Zona = { nombre: string; lat: number; lng: number; radioKm: number; poligono: LatLng[] | null };

export const MAX_PUNTOS_ZONA = 60;

/** Lee el área guardada en la base; null si no hay (o no es válida). */
export function leerPoligono(v: unknown): LatLng[] | null {
  if (!Array.isArray(v)) return null;
  const ps = v.filter((p): p is LatLng => !!p && typeof p.lat === "number" && typeof p.lng === "number" && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  return ps.length >= 3 ? ps.slice(0, MAX_PUNTOS_ZONA) : null;
}

/** ¿El punto está dentro del área? (método del rayo; para áreas del tamaño de un departamento basta con lat/lng planos). */
export function dentroDePoligono(p: LatLng, poli: LatLng[]) {
  let dentro = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const a = poli[i], b = poli[j];
    if ((a.lat > p.lat) !== (b.lat > p.lat) && p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng) dentro = !dentro;
  }
  return dentro;
}

export function dentroDeZona(p: LatLng, z: Pick<Zona, "lat" | "lng" | "radioKm" | "poligono">) {
  return z.poligono ? dentroDePoligono(p, z.poligono) : distanciaKm(p, z) <= z.radioKm;
}

/** Centro aproximado del área (promedio de sus puntos). */
export function centroDe(poli: LatLng[]): LatLng {
  return { lat: poli.reduce((s, p) => s + p.lat, 0) / poli.length, lng: poli.reduce((s, p) => s + p.lng, 0) / poli.length };
}

/** Área aproximada en km² (para mostrarla en el panel). */
export function areaKm2(poli: LatLng[]) {
  const lat0 = (centroDe(poli).lat * Math.PI) / 180;
  const xy = poli.map((p) => ({ x: p.lng * 111.32 * Math.cos(lat0), y: p.lat * 110.57 }));
  let a = 0;
  for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) a += xy[j].x * xy[i].y - xy[i].x * xy[j].y;
  return Math.abs(a / 2);
}

/** ¿Algún borde se cruza con otro? (un área con forma de «8» no es válida) */
export function seCruza(poli: LatLng[]) {
  const n = poli.length;
  const cruz = (a: LatLng, b: LatLng, c: LatLng) => (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
  for (let i = 0; i < n; i++) {
    const a = poli[i], b = poli[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      const c = poli[j], d = poli[(j + 1) % n];
      if (cruz(a, b, c) * cruz(a, b, d) < 0 && cruz(c, d, a) * cruz(c, d, b) < 0) return true;
    }
  }
  return false;
}
