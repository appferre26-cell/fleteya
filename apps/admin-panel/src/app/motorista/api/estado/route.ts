import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { datosInicio } from "@/lib/inicio-motorista";
import { motoristaActual, VERSION_TERMINOS } from "@/lib/sesion-motorista";

export const dynamic = "force-dynamic";

// La app pregunta aquí cada pocos segundos: solicitudes nuevas, viaje en curso, saldo.
export async function GET() {
  const m = await motoristaActual();
  if (!m) return NextResponse.json({ error: "sesion" }, { status: 401 });
  if (m.debeCambiarPassword || m.terminosVersion !== VERSION_TERMINOS) return NextResponse.json({ error: "pendiente" }, { status: 403 });
  await db.motorista.update({ where: { id: m.id }, data: { vistoEn: new Date() } });
  return NextResponse.json(await datosInicio(m), { headers: { "Cache-Control": "no-store" } });
}
