"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirPropietario } from "@/lib/sesion";

export type EstadoBloqueo = { error?: string; ok?: boolean; aviso?: string };

const telValido = (t: string) => /^\d{8}$/.test(t);

/** Bloquear un celular: ya no puede pedir fletes. Sus pedidos que aún esperan motorista se cancelan. */
export async function bloquearCliente(_: EstadoBloqueo, form: FormData): Promise<EstadoBloqueo> {
  const p = await exigirPropietario();
  const telefono = String(form.get("telefono") ?? "");
  const motivo = String(form.get("motivo") ?? "").trim();
  if (!telValido(telefono)) return { error: "Número no válido." };
  if (motivo.length < 3) return { error: "Escribe el motivo (solo lo ven los propietarios)." };
  if (motivo.length > 200) return { error: "El motivo es muy largo (máximo 200 letras)." };
  const ahora = new Date();
  const [, cancelados] = await db.$transaction([
    db.clienteBloqueado.upsert({ where: { telefono }, create: { telefono, motivo, bloqueadoPorId: p.id }, update: { motivo, bloqueadoPorId: p.id, creadoEn: ahora } }),
    db.viaje.updateMany({
      where: { clienteTelefono: telefono, estado: "BUSCANDO" },
      data: { estado: "CANCELADO", canceladoPor: "PROPIETARIO", motivoCancelacion: "Este número no puede pedir fletes por ahora.", canceladoEn: ahora },
    }),
  ]);
  revalidatePath("/panel/clientes");
  revalidatePath(`/panel/clientes/${telefono}`);
  return { ok: true, aviso: cancelados.count ? `Bloqueado. Se cancelaron ${cancelados.count} pedido(s) que esperaban motorista.` : "Bloqueado." };
}

export async function desbloquearCliente(_: EstadoBloqueo, form: FormData): Promise<EstadoBloqueo> {
  await exigirPropietario();
  const telefono = String(form.get("telefono") ?? "");
  if (!telValido(telefono)) return { error: "Número no válido." };
  await db.clienteBloqueado.deleteMany({ where: { telefono } });
  revalidatePath("/panel/clientes");
  revalidatePath(`/panel/clientes/${telefono}`);
  return { ok: true, aviso: "Desbloqueado: ya puede volver a pedir." };
}
