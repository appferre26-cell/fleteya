"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { correoConfigurado, enviarReciboPorCorreo } from "@/lib/correo";
import { db } from "@/lib/db";
import { ErrorRecarga, anularRecarga, registrarPagoAcceso, registrarRecarga } from "@/lib/recargas";
import { RECARGA_MAX, RECARGA_MIN, numeroRecibo } from "@/lib/recibo";
import { dinero } from "@/lib/tarifa";
import { exigirPropietario } from "@/lib/sesion";
import { avisarMotoristas, despues } from "@/lib/avisos";
import { erroresDe, type ErroresCampos } from "@/lib/validacion";

export type EstadoForm = { errores?: ErroresCampos; error?: string; ok?: string; valores?: Record<string, string> };

const esquemaPago = {
  formaPago: z.enum(["EFECTIVO", "TRANSFERENCIA"], { message: "Elige la forma de pago" }),
  referencia: z.string().trim().max(40, "Máximo 40 caracteres"),
  revisado: z.string(),
  nota: z.string().trim().max(200, "Máximo 200 caracteres"),
};
const revisarTransferencia = (d: { formaPago: string; referencia: string; revisado: string }, ctx: z.RefinementCtx) => {
  if (d.formaPago !== "TRANSFERENCIA") return;
  if (!/^[A-Za-z0-9-]{3,40}$/.test(d.referencia.replace(/\s+/g, ""))) ctx.addIssue({ code: "custom", path: ["referencia"], message: "Escribe el número de referencia de la transferencia" });
  if (d.revisado !== "on") ctx.addIssue({ code: "custom", path: ["revisado"], message: "Confirma que viste el dinero en la cuenta" });
};

// Ya no hay planes: el propietario escribe cuánto pagó el motorista.
const esquemaRecarga = z.object({
  motoristaId: z.string().min(1, "Elige al motorista"),
  monto: z.string().trim().refine((t) => /^\d{1,4}(\.\d{1,2})?$/.test(t), "Escribe el monto (ej. 15 o 12.50)").transform(Number)
    .refine((n) => n >= RECARGA_MIN && n <= RECARGA_MAX, `Entre $${RECARGA_MIN} y $${RECARGA_MAX}`),
  ...esquemaPago,
}).superRefine(revisarTransferencia);

export async function registrarRecargaAccion(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await exigirPropietario();
  const valores = Object.fromEntries(["motoristaId", "monto", "formaPago", "referencia", "revisado", "nota"].map((k) => [k, String(form.get(k) ?? "")]));
  const r = esquemaRecarga.safeParse(valores);
  if (!r.success) return { errores: erroresDe(r.error), valores };
  const d = r.data;

  let numero: number;
  let conCorreo = false;
  try {
    const rec = await registrarRecarga({
      motoristaId: d.motoristaId, monto: d.monto, formaPago: d.formaPago, propietarioId: p.id,
      referencia: d.formaPago === "TRANSFERENCIA" ? d.referencia : null, nota: d.nota || null,
    });
    numero = rec.numero;
    const recibo = rec.numero;
    despues(async () => {
      const x = await db.recarga.findUnique({ where: { numero: recibo }, select: { monto: true, saldoDespues: true } });
      if (x) await avisarMotoristas([d.motoristaId], { titulo: `Recarga de ${dinero(Number(x.monto))} acreditada`, cuerpo: `Tus créditos quedaron en ${dinero(Number(x.saldoDespues))}. Ya puedes recibir viajes.`, url: `/motorista/creditos/recibo/${recibo}`, tag: "fleteya-creditos" });
    });
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

const esquemaAcceso = z.object(esquemaPago).superRefine(revisarTransferencia);

/** El motorista pagó su acceso a la plataforma en efectivo o por transferencia (mientras no hay pago en línea). */
export async function registrarPagoAccesoAccion(motoristaId: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await exigirPropietario();
  const valores = Object.fromEntries(["formaPago", "referencia", "revisado", "nota"].map((k) => [k, String(form.get(k) ?? "")]));
  const r = esquemaAcceso.safeParse(valores);
  if (!r.success) return { errores: erroresDe(r.error), valores };
  const d = r.data;
  let numero: number;
  try {
    const rec = await registrarPagoAcceso({
      motoristaId, formaPago: d.formaPago, propietarioId: p.id,
      referencia: d.formaPago === "TRANSFERENCIA" ? d.referencia : null, nota: d.nota || null,
    });
    numero = rec.numero;
  } catch (e) {
    if (e instanceof ErrorRecarga) return { error: e.message, valores };
    throw e;
  }
  const m = await db.motorista.findUnique({ where: { id: motoristaId }, select: { correo: true } });
  if (m?.correo && correoConfigurado()) await enviarReciboPorCorreo(numero);
  despues(() => avisarMotoristas([motoristaId], { titulo: "Recibimos tu pago de acceso", cuerpo: "Estamos revisando tus documentos. Te avisamos cuando tu perfil quede activo.", url: "/motorista/alta", tag: "fleteya-cuenta" }));
  revalidatePath("/panel", "layout");
  return { ok: `Pago de acceso registrado (${numeroRecibo(numero)}). Ya puedes aprobarlo cuando revises sus documentos.` };
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
  precioAcceso: num("Escribe el precio").min(1, "Mínimo $1").max(500, "Máximo $500"),
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
