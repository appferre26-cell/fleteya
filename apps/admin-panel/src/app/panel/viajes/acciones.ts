"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirPropietario } from "@/lib/sesion";

export type EstadoCancelar = { error?: string; ok?: boolean };

export async function cancelarViajePropietario(_: EstadoCancelar, form: FormData): Promise<EstadoCancelar> {
  await exigirPropietario();
  const id = String(form.get("id") ?? "");
  const motivo = String(form.get("motivo") ?? "").trim();
  if (motivo.length < 3) return { error: "Escribe el motivo (el cliente lo verá)" };
  if (motivo.length > 200) return { error: "El motivo es muy largo (máximo 200 letras)" };
  const v = await db.viaje.findUnique({ where: { id } });
  if (!v || v.estado === "ENTREGADO" || v.estado === "CANCELADO") return { error: "Este viaje ya no se puede cancelar." };
  await db.viaje.update({
    where: { id },
    data: { estado: "CANCELADO", canceladoPor: "PROPIETARIO", motivoCancelacion: motivo, canceladoEn: new Date() },
  });
  revalidatePath("/panel/viajes");
  revalidatePath(`/panel/viajes/${id}`);
  return { ok: true };
}
