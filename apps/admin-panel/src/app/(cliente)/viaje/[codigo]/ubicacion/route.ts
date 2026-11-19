import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rutaPorCalles } from "@/lib/ruta-calles";

// Ubicación en vivo del motorista para la página del cliente (se consulta cada pocos segundos).
// Es pública como la propia página del viaje: basta con el código del viaje.
export async function GET(_req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const v = await db.viaje.findUnique({
    where: { codigo },
    select: {
      estado: true,
      origenLat: true, origenLng: true, destinoLat: true, destinoLng: true,
      motorista: { select: { nombre: true, lat: true, lng: true, ubicacionEn: true } },
    },
  });
  if (!v) return NextResponse.json({ error: "no-existe" }, { status: 404 });
  const m = v.motorista;
  // El motorista se muestra mientras el viaje está activo y su ubicación es reciente (10 min).
  const enVivo = ["ASIGNADO", "EN_CAMINO", "CARGANDO", "EN_RUTA"].includes(v.estado);
  const verUbicacion = !!(enVivo && m && m.lat != null && m.lng != null
    && m.ubicacionEn && Date.now() - m.ubicacionEn.getTime() < 10 * 60_000);

  // Ruta por calles (como Uber/inDrive) para que el motorista se guíe por la vía.
  // Yendo a recoger: motorista → recogida → destino. En ruta: motorista → destino.
  let ruta: { lat: number; lng: number }[] | null = null;
  if (verUbicacion) {
    const moto = { lat: m!.lat!, lng: m!.lng! };
    const origen = { lat: v.origenLat, lng: v.origenLng };
    const destino = { lat: v.destinoLat, lng: v.destinoLng };
    const puntos = v.estado === "EN_RUTA" ? [moto, destino] : [moto, origen, destino];
    ruta = await rutaPorCalles(puntos);
  }

  return NextResponse.json({
    estado: v.estado,
    verUbicacion,
    lat: verUbicacion ? m!.lat : null,
    lng: verUbicacion ? m!.lng : null,
    nombre: m ? m.nombre.split(" ")[0] : null,
    ruta,
  }, { headers: { "Cache-Control": "no-store" } });
}
