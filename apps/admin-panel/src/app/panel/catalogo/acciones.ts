"use server";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { exigirPropietario } from "@/lib/sesion";
import { erroresDe, type ErroresCampos } from "@/lib/validacion";

const esquema = z.object({
  nombre: z.string().trim().min(2, "Escribe el nombre").max(60, "Es demasiado largo"),
  unidad: z.string().trim().min(2, "Escribe la unidad (Bolsa, Unidad…)").max(30, "Es demasiado larga"),
  pesoKg: z.coerce.number({ message: "Escribe el peso" }).min(0.1, "Mínimo 0.1 kg").max(20000, "Máximo 20,000 kg"),
});

export type EstadoMaterial = { errores?: ErroresCampos; ok?: string; valores?: Record<string, string> };

export async function guardarMaterial(_: EstadoMaterial, form: FormData): Promise<EstadoMaterial> {
  await exigirPropietario();
  const valores = { nombre: String(form.get("nombre") ?? ""), unidad: String(form.get("unidad") ?? ""), pesoKg: String(form.get("pesoKg") ?? "") };
  const r = esquema.safeParse(valores);
  if (!r.success) return { errores: erroresDe(r.error), valores };
  const id = String(form.get("id") ?? "");
  try {
    if (id) await db.material.update({ where: { id }, data: r.data });
    else {
      const ultimo = await db.material.aggregate({ _max: { orden: true } });
      await db.material.create({ data: { ...r.data, orden: (ultimo._max.orden ?? 0) + 1 } });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { errores: { nombre: "Ya hay un material con ese nombre" }, valores };
    throw e;
  }
  revalidatePath("/panel/catalogo");
  return { ok: id ? "Cambios guardados" : `«${r.data.nombre}» agregado` };
}

export async function cambiarVisible(id: string, activo: boolean) {
  await exigirPropietario();
  await db.material.update({ where: { id }, data: { activo } });
  revalidatePath("/panel/catalogo");
}

// Ejemplos de la sección 3 del documento del proyecto. Pesos aproximados: revisarlos con una ferretería.
const EJEMPLOS = [
  { nombre: "Bolsa de cemento", unidad: "Bolsa", pesoKg: 42.5 },
  { nombre: "Bloque de concreto 15 cm", unidad: "Unidad", pesoKg: 13 },
  { nombre: 'Varilla de hierro 3/8" (6 m)', unidad: "Unidad", pesoKg: 3.4 },
  { nombre: 'Varilla de hierro 1/2" (6 m)', unidad: "Unidad", pesoKg: 6 },
  { nombre: "Arena", unidad: "Metro cúbico", pesoKg: 1500 },
  { nombre: "Grava", unidad: "Metro cúbico", pesoKg: 1600 },
  { nombre: "Lámina de zinc", unidad: "Unidad", pesoKg: 6 },
];

export async function cargarEjemplos() {
  await exigirPropietario();
  await db.material.createMany({ data: EJEMPLOS.map((m, i) => ({ ...m, orden: i + 1 })), skipDuplicates: true });
  revalidatePath("/panel/catalogo");
}
