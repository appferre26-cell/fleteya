import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { motoristaActual } from "@/lib/sesion-motorista";

const esquema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

// Ubicación del motorista (solo mientras está disponible o en un viaje). La ve el cliente cuando va en camino.
export async function POST(req: Request) {
  const m = await motoristaActual();
  if (!m) return NextResponse.json({ error: "sesion" }, { status: 401 });
  const r = esquema.safeParse(await req.json().catch(() => null));
  if (!r.success) return NextResponse.json({ error: "datos" }, { status: 400 });
  await db.motorista.update({ where: { id: m.id }, data: { lat: r.data.lat, lng: r.data.lng, ubicacionEn: new Date(), vistoEn: new Date() } });
  return NextResponse.json({ ok: true });
}
