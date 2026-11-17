"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirMotorista } from "@/lib/sesion-motorista";

export type EstadoAviso = { error?: string; ok?: string; referencia?: string };

/** El motorista avisa que ya transfirió el acceso. FleteYa lo confirma en el banco y lo registra en el panel. */
export async function avisarPagoAcceso(_: EstadoAviso, form: FormData): Promise<EstadoAviso> {
  const m = await exigirMotorista();
  const referencia = String(form.get("referencia") ?? "").replace(/\s+/g, "").slice(0, 40);
  if (!/^[A-Za-z0-9-]{3,40}$/.test(referencia)) return { error: "Escribe el número de referencia que aparece en tu comprobante.", referencia };
  const fila = await db.motorista.findUniqueOrThrow({ where: { id: m.id }, select: { accesoPagadoEn: true } });
  if (fila.accesoPagadoEn) return { ok: "Tu pago de acceso ya está registrado." };
  await db.$transaction([
    db.motorista.update({ where: { id: m.id }, data: { accesoReferencia: referencia, accesoAvisadoEn: new Date() } }),
    db.historialMotorista.create({ data: { motoristaId: m.id, accion: "AVISO_PAGO", detalle: `ref. ${referencia}` } }),
  ]);
  revalidatePath("/motorista/alta");
  revalidatePath("/panel", "layout");
  return { ok: "¡Listo! Avisamos a FleteYa. En cuanto confirmen tu pago en el banco, revisan tus fotos y activan tu perfil." };
}
