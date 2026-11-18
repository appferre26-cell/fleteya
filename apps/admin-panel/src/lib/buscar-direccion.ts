// Busca una dirección escrita y devuelve puntos en el mapa.
// Usa el buscador de Google cuando el mapa de Google está cargado; si no (o si falla),
// usa el buscador gratuito de OpenStreetMap (Nominatim). Limitado a El Salvador.
"use client";

export type ResultadoDireccion = { lat: number; lng: number; direccion: string };

// Centro aproximado de El Salvador para dar preferencia a resultados cercanos.
const SV = { lat: 13.7, lng: -89.2 };

type GMaps = {
  Geocoder: new () => {
    geocode: (req: unknown) => Promise<{ results: Array<{ formatted_address: string; geometry: { location: { lat(): number; lng(): number } } }> }>;
  };
};

function googleMaps(): GMaps | null {
  const g = (window as unknown as { google?: { maps?: GMaps } }).google?.maps;
  return g?.Geocoder ? g : null;
}

async function buscarGoogle(g: GMaps, texto: string): Promise<ResultadoDireccion[]> {
  const geocoder = new g.Geocoder();
  const { results } = await geocoder.geocode({
    address: texto,
    componentRestrictions: { country: "SV" },
    region: "sv",
  });
  return (results || []).slice(0, 6).map((r) => ({
    lat: r.geometry.location.lat(),
    lng: r.geometry.location.lng(),
    direccion: r.formatted_address,
  }));
}

async function buscarOsm(texto: string): Promise<ResultadoDireccion[]> {
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=sv&addressdetails=0" +
    `&q=${encodeURIComponent(texto)}`;
  const r = await fetch(url, { headers: { "Accept-Language": "es" } });
  if (!r.ok) return [];
  const data = (await r.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  return (data || [])
    .map((d) => ({ lat: Number(d.lat), lng: Number(d.lon), direccion: d.display_name }))
    .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng));
}

/** Busca la dirección escrita. Prefiere Google; si no está o falla, usa OpenStreetMap. */
export async function buscarDireccion(texto: string): Promise<ResultadoDireccion[]> {
  const q = texto.trim();
  if (q.length < 3) return [];
  const g = googleMaps();
  if (g) {
    try {
      const res = await buscarGoogle(g, q);
      if (res.length) return res;
    } catch {
      /* el buscador de Google no está disponible; se usa OpenStreetMap */
    }
  }
  try {
    return await buscarOsm(q);
  } catch {
    return [];
  }
}

export { SV as centroSV };
