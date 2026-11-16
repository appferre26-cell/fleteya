"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { exigirPropietario } from "@/lib/sesion";
import { erroresDe, normalizarTelefono, type ErroresCampos } from "@/lib/validacion";

const num = (msg: string) => z.coerce.number({ message: msg });

const esquema = z.object({
  precioTonelada: num("Escribe el precio").min(1, "Mínimo $1").max(500, "Máximo $500"),
  tarifaMinima: num("Escribe la tarifa mínima").min(1, "Mínimo $1").max(500, "Máximo $500"),
  kmIncluidos: num("Escribe los km").min(1, "Mínimo 1 km").max(100, "Máximo 100 km"),
  zonaNombre: z.string().trim().min(3, "Escribe el nombre de la zona").max(60, "Es demasiado largo"),
  zonaLat: num("Marca el centro en el mapa").min(13, "Fuera de El Salvador").max(14.5, "Fuera de El Salvador"),
  zonaLng: num("Marca el centro en el mapa").min(-90.2, "Fuera de El Salvador").max(-87.6, "Fuera de El Salvador"),
  zonaRadioKm: num("Escribe el radio").min(1, "Mínimo 1 km").max(60, "Máximo 60 km"),
  whatsappAyuda: z
    .string()
    .transform(normalizarTelefono)
    .refine((t) => t === "" || /^[267]\d{7}$/.test(t), "Número de 8 dígitos")
    .transform((t) => (t === "" ? null : t)),
  contraofertaEnRango: z.string().transform((v) => v === "on"),
});

export type EstadoTarifas = { errores?: ErroresCampos; ok?: string; valores?: Record<string, string> };

export async function guardarTarifas(_: EstadoTarifas, form: FormData): Promise<EstadoTarifas> {
  await exigirPropietario();
  const valores = Object.fromEntries(Object.keys(esquema.shape).map((k) => [k, String(form.get(k) ?? "")]));
  const r = esquema.safeParse(valores);
  if (!r.success) return { errores: erroresDe(r.error), valores };
  await db.configuracion.upsert({ where: { id: 1 }, update: r.data, create: { id: 1, ...r.data } });
  revalidatePath("/panel", "layout");
  return { ok: "Tarifas y zona guardadas. Los pedidos nuevos ya usan estos valores." };
}
