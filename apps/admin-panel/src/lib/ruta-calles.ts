// Calcula la ruta por calles (como Uber/inDrive) entre varios puntos, usando el servicio OSRM.
// Devuelve la lista de coordenadas que siguen las carreteras. Si falla, devuelve null
// para que el mapa dibuje una línea recta como respaldo.
type LatLng = { lat: number; lng: number };

const cache = new Map<string, { t: number; ruta: LatLng[] | null }>();
const TTL = 60_000; // 1 min: evita recalcular en cada consulta mientras el motorista casi no se mueve.
const r4 = (n: number) => Math.round(n * 1e4) / 1e4; // ~11 m: recalcula solo cuando se mueve de verdad.

export async function rutaPorCalles(puntos: LatLng[]): Promise<LatLng[] | null> {
  const validos = puntos.filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (validos.length < 2) return null;
  const clave = validos.map((p) => `${r4(p.lat)},${r4(p.lng)}`).join(";");
  const hit = cache.get(clave);
  if (hit && Date.now() - hit.t < TTL) return hit.ruta;

  const coords = validos.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  let ruta: LatLng[] | null = null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "FleteYa/1.0" } });
    clearTimeout(t);
    if (r.ok) {
      const d = await r.json();
      const linea = d?.routes?.[0]?.geometry?.coordinates;
      if (Array.isArray(linea) && linea.length >= 2) {
        ruta = linea.map((c: [number, number]) => ({ lat: c[1], lng: c[0] }));
      }
    }
  } catch {
    ruta = null;
  }
  cache.set(clave, { t: Date.now(), ruta });
  return ruta;
}
