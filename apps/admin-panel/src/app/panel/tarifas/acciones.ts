"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { centroDe, dentroDeZona, MAX_PUNTOS_ZONA, seCruza } from "@/lib/zona";
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
  // Parte 8: área dibujada (JSON). Vacío = se usa el círculo.
  zonaPoligono: z.string().transform((t, ctx) => {
    if (!t.trim()) return null;
    let ps: unknown;
    try { ps = JSON.parse(t); } catch { ctx.addIssue({ code: "custom", message: "El área no es válida. Bórrala y dibújala de nuevo." }); return z.NEVER; }
    const r = z.array(z.object({ lat: z.number().min(13).max(14.5), lng: z.number().min(-90.2).max(-87.6) })).safeParse(ps);
    if (!r.success) { ctx.addIssue({ code: "custom", message: "Todos los puntos del área deben estar en El Salvador." }); return z.NEVER; }
    if (r.data.length < 3) { ctx.addIssue({ code: "custom", message: "Marca al menos 3 puntos para formar el área." }); return z.NEVER; }
    if (r.data.length > MAX_PUNTOS_ZONA) { ctx.addIssue({ code: "custom", message: `Máximo ${MAX_PUNTOS_ZONA} puntos.` }); return z.NEVER; }
    if (seCruza(r.data)) { ctx.addIssue({ code: "custom", message: "Las líneas del área se cruzan. Márcala siguiendo el borde, en orden." }); return z.NEVER; }
    return r.data;
  }),
});

export type EstadoTarifas = { errores?: ErroresCampos; ok?: string; aviso?: string; valores?: Record<string, string> };

export async function guardarTarifas(_: EstadoTarifas, form: FormData): Promise<EstadoTarifas> {
  await exigirPropietario();
  const valores = Object.fromEntries(Object.keys(esquema.shape).map((k) => [k, String(form.get(k) ?? "")]));
  const r = esquema.safeParse(valores);
  if (!r.success) return { errores: erroresDe(r.error), valores };
  const { zonaPoligono, ...resto } = r.data;
  // Con área dibujada, el centro es el centro del área (se usa para abrir los mapas).
  const datos = { ...resto, ...(zonaPoligono ? (({ lat, lng }) => ({ zonaLat: lat, zonaLng: lng }))(centroDe(zonaPoligono)) : {}), zonaPoligono: zonaPoligono ?? Prisma.DbNull };
  await db.configuracion.upsert({ where: { id: 1 }, update: datos, create: { id: 1, ...datos } });
  revalidatePath("/panel", "layout");
  // Avisa si alguna ferretería con QR quedó fuera de la nueva zona (sus clientes no podrán pedir).
  const zona = { lat: datos.zonaLat, lng: datos.zonaLng, radioKm: datos.zonaRadioKm, poligono: zonaPoligono };
  const fuera = (await db.puntoQR.findMany({ where: { activo: true }, select: { nombre: true, lat: true, lng: true } })).filter((p) => !dentroDeZona(p, zona));
  return {
    ok: "Tarifas y zona guardadas. Los pedidos nuevos ya usan estos valores.",
    aviso: fuera.length ? `Ojo: ${fuera.length === 1 ? "este punto QR quedó" : "estos puntos QR quedaron"} fuera de la zona y no podrán recibir pedidos: ${fuera.map((p) => p.nombre).join(", ")}.` : undefined,
  };
}
