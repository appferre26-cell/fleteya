"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { diaSV, fechaValida } from "@/lib/periodos";
import { CATEGORIAS_GASTO, fechaGasto } from "@/lib/reportes";
import { exigirPropietario } from "@/lib/sesion";

export type ValoresGasto = { fecha: string; categoria: string; concepto: string; monto: string };
export type EstadoGasto = { error?: string; aviso?: string; n?: number; valores?: ValoresGasto };

export async function registrarGasto(prev: EstadoGasto, form: FormData): Promise<EstadoGasto> {
  const valores: ValoresGasto = {
    fecha: String(form.get("fecha") ?? ""), categoria: String(form.get("categoria") ?? ""),
    concepto: String(form.get("concepto") ?? ""), monto: String(form.get("monto") ?? ""),
  };
  const r = await guardarGasto(form);
  // n cambia en cada respuesta para que el formulario se vuelva a dibujar: vacío si se guardó, con lo escrito si hubo error.
  return { ...r, n: (prev.n ?? 0) + 1, valores: r.error ? valores : undefined };
}

async function guardarGasto(form: FormData): Promise<EstadoGasto> {
  const p = await exigirPropietario();
  const fecha = String(form.get("fecha") ?? "");
  const categoria = String(form.get("categoria") ?? "");
  const concepto = String(form.get("concepto") ?? "").trim();
  const monto = Number(String(form.get("monto") ?? "").replace(",", "."));
  if (!fechaValida(fecha)) return { error: "Elige la fecha del gasto." };
  if (fecha > diaSV()) return { error: "La fecha no puede ser en el futuro." };
  if (!(CATEGORIAS_GASTO as readonly string[]).includes(categoria)) return { error: "Elige una categoría." };
  if (concepto.length < 3) return { error: "Escribe en qué se gastó (ej.: «Volantes para ferreterías»)." };
  if (concepto.length > 120) return { error: "El detalle es muy largo (máximo 120 letras)." };
  if (!Number.isFinite(monto) || monto <= 0) return { error: "Escribe un monto mayor a $0." };
  if (monto > 100_000) return { error: "El monto es demasiado alto. Revísalo." };
  await db.gasto.create({ data: { fecha: fechaGasto(fecha), categoria, concepto, monto: Math.round(monto * 100) / 100, registradoPorId: p.id } });
  revalidatePath("/panel/reportes");
  revalidatePath("/panel");
  return { aviso: `Gasto de $${monto.toFixed(2)} guardado.` };
}

export async function borrarGasto(form: FormData) {
  await exigirPropietario();
  const id = String(form.get("id") ?? "");
  if (id) await db.gasto.deleteMany({ where: { id } });
  revalidatePath("/panel/reportes");
  revalidatePath("/panel");
}
