"use server";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { obtenerConfig, zonaDe } from "@/lib/config";
import { dentroDeZona } from "@/lib/zona";
import { exigirPropietario } from "@/lib/sesion";
import { erroresDe, type ErroresCampos } from "@/lib/validacion";

const esquema = z.object({
  nombre: z.string().trim().min(3, "Escribe el nombre de la ferretería").max(60, "Es demasiado largo"),
  direccion: z.string().trim().min(3, "Escribe la dirección").max(120, "Es demasiado larga"),
  lat: z.coerce.number().refine((n) => n !== 0, "Marca la ferretería en el mapa"),
  lng: z.coerce.number().refine((n) => n !== 0, "Marca la ferretería en el mapa"),
});

export type EstadoPunto = { errores?: ErroresCampos; ok?: string; valores?: Record<string, string> };

async function siguienteCodigo() {
  const todos = await db.puntoQR.findMany({ select: { codigo: true } });
  const max = Math.max(0, ...todos.map((p) => Number(/^FER(\d+)$/.exec(p.codigo)?.[1] ?? 0)));
  return `FER${String(max + 1).padStart(3, "0")}`;
}

export async function guardarPunto(_: EstadoPunto, form: FormData): Promise<EstadoPunto> {
  await exigirPropietario();
  const valores = Object.fromEntries(["nombre", "direccion", "lat", "lng"].map((k) => [k, String(form.get(k) ?? "")]));
  const r = esquema.safeParse({ ...valores, lat: valores.lat || 0, lng: valores.lng || 0 });
  if (!r.success) return { errores: erroresDe(r.error), valores };
  const cfg = await obtenerConfig();
  if (!dentroDeZona(r.data, zonaDe(cfg))) {
    return { errores: { lat: `Ese punto está fuera de la zona de servicio (${cfg.zonaNombre}). Amplía la zona en Tarifas y zona.` }, valores };
  }
  const id = String(form.get("id") ?? "");
  if (id) {
    await db.puntoQR.update({ where: { id }, data: r.data });
    revalidatePath("/panel/puntos-qr");
    return { ok: "Cambios guardados" };
  }
  for (let intento = 0; intento < 3; intento++) {
    try {
      const p = await db.puntoQR.create({ data: { ...r.data, codigo: await siguienteCodigo() } });
      revalidatePath("/panel/puntos-qr");
      return { ok: `${p.nombre} agregada con el código ${p.codigo}` };
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
  return { errores: { general: "No se pudo crear el código. Intenta de nuevo." }, valores };
}

export async function cambiarActivoPunto(id: string, activo: boolean) {
  await exigirPropietario();
  await db.puntoQR.update({ where: { id }, data: { activo } });
  revalidatePath("/panel/puntos-qr");
}
