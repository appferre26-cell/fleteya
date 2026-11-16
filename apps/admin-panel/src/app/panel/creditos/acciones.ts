"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { correoConfigurado, enviarReciboPorCorreo } from "@/lib/correo";
import { db } from "@/lib/db";
import { ErrorRecarga, anularRecarga, registrarRecarga } from "@/lib/recargas";
import { numeroRecibo } from "@/lib/recibo";
import { dinero } from "@/lib/tarifa";
import { exigirPropietario } from "@/lib/sesion";
import { erroresDe, type ErroresCampos } from "@/lib/validacion";

export type EstadoForm = { errores?: ErroresCampos; error?: string; ok?: string; valores?: Record<string, string> };

const esquemaRecarga = z.object({
  motoristaId: z.string().min(1, "Elige al motorista"),
  plan: z.enum(["SEMANAL", "MENSUAL"], { message: "Elige el plan" }),
  formaPago: z.enum(["EFECTIVO", "TRANSFERENCIA"], { message: "Elige la forma de pago" }),
  referencia: z.string().trim().max(40, "Máximo 40 caracteres"),
  revisado: z.string(),
  nota: z.string().trim().max(200, "Máximo 200 caracteres"),
}).superRefine((d, ctx) => {
  if (d.formaPago !== "TRANSFERENCIA") return;
  if (!/^[A-Za-z0-9-]{3,40}$/.test(d.referencia.replace(/\s+/g, ""))) ctx.addIssue({ code: "custom", path: ["referencia"], message: "Escribe el número de referencia de la transferencia" });
  if (d.revisado !== "on") ctx.addIssue({ code: "custom", path: ["revisado"], message: "Confirma que viste el dinero en la cuenta" });
});

export async function registrarRecargaAccion(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await exigirPropietario();
  const valores = Object.fromEntries(["motoristaId", "plan", "formaPago", "referencia", "revisado", "nota"].map((k) => [k, String(form.get(k) ?? "")]));
  const r = esquemaRecarga.safeParse(valores);
  if (!r.success) return { errores: erroresDe(r.error), valores };
  const d = r.data;

  let numero: number;
  let conCorreo = false;
  try {
    const rec = await registrarRecarga({
      motoristaId: d.motoristaId, plan: d.plan, formaPago: d.formaPago, propietarioId: p.id,
      referencia: d.formaPago === "TRANSFERENCIA" ? d.referencia : null, nota: d.nota || null,
    });
    numero = rec.numero;
    const m = await db.motorista.findUnique({ where: { id: d.motoristaId }, select: { correo: true } });
    conCorreo = !!m?.correo && correoConfigurado();
  } catch (e) {
    if (e instanceof ErrorRecarga) return { error: e.message, valores };
    throw e;
  }
  if (conCorreo) await enviarReciboPorCorreo(numero); // si falla, el recibo muestra el error y se puede reenviar
  revalidatePath("/panel", "layout");
  redirect(`/panel/creditos/recibo/${numero}?nuevo=1`);
}

export async function anularRecargaAccion(id: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await exigirPropietario();
  const motivo = String(form.get("motivo") ?? "").trim();
  if (motivo.length < 5) return { errores: { motivo: "Escribe el motivo (mínimo 5 letras)" }, valores: { motivo } };
  if (motivo.length > 200) return { errores: { motivo: "Máximo 200 caracteres" }, valores: { motivo } };
  try {
    const r = await anularRecarga(id, p.id, motivo);
    revalidatePath("/panel", "layout");
    return { ok: `${numeroRecibo(r.numero)} anulado. El saldo del motorista quedó en ${dinero(r.saldoDespues)}.` };
  } catch (e) {
    if (e instanceof ErrorRecarga) return { error: e.message };
    throw e;
  }
}

export async function reenviarReciboAccion(numero: number): Promise<EstadoForm> {
  await exigirPropietario();
  const r = await enviarReciboPorCorreo(numero);
  revalidatePath(`/panel/creditos/recibo/${numero}`);
  return r.ok ? { ok: r.mensaje } : { error: r.mensaje };
}

const texto = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`).transform((t) => t || null);
const num = (msg: string) => z.coerce.number({ message: msg });
const esquemaDatos = z.object({
  emisorNombre: texto(100),
  emisorNit: z.string().trim().refine((t) => t === "" || /^[\d-]{9,17}$/.test(t) && t.replace(/-/g, "").length >= 9, "Solo números y guiones (NIT de 14 dígitos o DUI)").transform((t) => t || null),
  emisorDireccion: texto(150),
  bancoNombre: texto(60),
  bancoTipoCuenta: texto(30),
  bancoNumero: z.string().trim().refine((t) => t === "" || /^[\d -]{6,30}$/.test(t), "Solo números, espacios o guiones").transform((t) => t || null),
  bancoTitular: texto(100),
  planSemanal: num("Escribe el precio").min(1, "Mínimo $1").max(500, "Máximo $500"),
  planMensual: num("Escribe el precio").min(1, "Mínimo $1").max(1000, "Máximo $1000"),
  comisionPct: num("Escribe el porcentaje").min(0, "Mínimo 0 %").max(50, "Máximo 50 %"),
});

export async function guardarDatosCreditos(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  await exigirPropietario();
  const valores = Object.fromEntries(Object.keys(esquemaDatos.shape).map((k) => [k, String(form.get(k) ?? "")]));
  const r = esquemaDatos.safeParse(valores);
  if (!r.success) return { errores: erroresDe(r.error), valores };
  await db.configuracion.upsert({ where: { id: 1 }, update: r.data, create: { id: 1, ...r.data } });
  revalidatePath("/panel", "layout");
  revalidatePath("/motorista", "layout");
  return { ok: "Datos guardados. Los recibos nuevos y la app del motorista ya los usan." };
}
