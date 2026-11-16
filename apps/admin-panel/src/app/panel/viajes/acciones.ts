"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirPropietario } from "@/lib/sesion";
import { avisarCliente, avisarMotoristas, despues } from "@/lib/avisos";

export type EstadoCancelar = { error?: string; ok?: boolean };

export async function cancelarViajePropietario(_: EstadoCancelar, form: FormData): Promise<EstadoCancelar> {
  await exigirPropietario();
  const id = String(form.get("id") ?? "");
  const motivo = String(form.get("motivo") ?? "").trim();
  if (motivo.length < 3) return { error: "Escribe el motivo (el cliente lo verá)" };
  if (motivo.length > 200) return { error: "El motivo es muy largo (máximo 200 letras)" };
  const ahora = new Date();
  // updateMany con condición: si el motorista justo lo entregó, no se pisa.
  const r = await db.viaje.updateMany({
    where: { id, estado: { notIn: ["ENTREGADO", "CANCELADO"] } },
    data: { estado: "CANCELADO", canceladoPor: "PROPIETARIO", motivoCancelacion: motivo, canceladoEn: ahora },
  });
  if (r.count === 0) return { error: "Este viaje ya no se puede cancelar." };
  const v = await db.viaje.findUnique({ where: { id }, select: { motoristaId: true } });
  despues(async () => {
    await avisarCliente(id, { titulo: "FleteYa canceló tu pedido", cuerpo: motivo });
    if (v?.motoristaId) await avisarMotoristas([v.motoristaId], { titulo: "FleteYa canceló tu viaje", cuerpo: `${motivo}. No se descontó nada de tus créditos.`, url: "/motorista", tag: "fleteya-viaje", urgente: true });
  });
  await db.ofertaPrecio.updateMany({ where: { viajeId: id, estado: "PENDIENTE" }, data: { estado: "RECHAZADA", respondidaEn: ahora } });
  revalidatePath("/panel/viajes");
  revalidatePath(`/panel/viajes/${id}`);
  return { ok: true };
}
