import { NextResponse } from "next/server";
import { rutaPorCalles } from "@/lib/ruta-calles";
import { motoristaActual } from "@/lib/sesion-motorista";

export const dynamic = "force-dynamic";

// Ruta por calles (como Waze, pero DENTRO de la app) para el mapa del viaje activo del motorista.
// La app la consulta cada pocos segundos con su posición en vivo y el punto al que va.
export async function GET(req: Request) {
  const m = await motoristaActual();
  if (!m) return NextResponse.json({ error: "sesion" }, { status: 401 });

  const url = new URL(req.url);
  const num = (k: string) => {
    const v = Number(url.searchParams.get(k));
    return Number.isFinite(v) ? v : null;
  };
  const fromLat = num("fromLat"), fromLng = num("fromLng");
  const toLat = num("toLat"), toLng = num("toLng");
  if (fromLat == null || fromLng == null || toLat == null || toLng == null) {
    return NextResponse.json({ ruta: null }, { headers: { "Cache-Control": "no-store" } });
  }

  const ruta = await rutaPorCalles([{ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng }]);
  return NextResponse.json({ ruta }, { headers: { "Cache-Control": "no-store" } });
}
