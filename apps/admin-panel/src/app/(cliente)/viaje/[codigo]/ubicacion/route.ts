import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Ubicación en vivo del motorista para la página del cliente (se consulta cada pocos segundos).
// Es pública como la propia página del viaje: basta con el código del viaje.
export async function GET(_req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const v = await db.viaje.findUnique({
    where: { codigo },
    select: {
      estado: true,
      motorista: { select: { nombre: true, lat: true, lng: true, ubicacionEn: true } },
    },
  });
  if (!v) return NextResponse.json({ error: "no-existe" }, { status: 404 });
  const m = v.motorista;
  // El motorista se muestra mientras el viaje está activo y su ubicación es reciente (10 min).
  const enVivo = ["ASIGNADO", "EN_CAMINO", "CARGANDO", "EN_RUTA"].includes(v.estado);
  const verUbicacion = !!(enVivo && m && m.lat != null && m.lng != null
    && m.ubicacionEn && Date.now() - m.ubicacionEn.getTime() < 10 * 60_000);
  return NextResponse.json({
    estado: v.estado,
    verUbicacion,
    lat: verUbicacion ? m!.lat : null,
    lng: verUbicacion ? m!.lng : null,
    nombre: m ? m.nombre.split(" ")[0] : null,
  }, { headers: { "Cache-Control": "no-store" } });
}
