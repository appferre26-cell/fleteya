"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { exigirPropietario } from "@/lib/sesion";
import { contrasenaTemporal } from "@/lib/validacion";

export type EstadoAdmin = { error?: string; ok?: string; password?: string; correo?: string };

const esquema = z.object({
  nombre: z.string().trim().min(3, "Escribe el nombre completo").max(80),
  correo: z.string().trim().toLowerCase().email("Correo no válido"),
});

export async function agregarPropietario(_: EstadoAdmin, form: FormData): Promise<EstadoAdmin> {
  const yo = await exigirPropietario();
  const r = esquema.safeParse({ nombre: form.get("nombre"), correo: form.get("correo") });
  if (!r.success) return { error: r.error.issues[0].message };
  if (await db.propietario.findUnique({ where: { correo: r.data.correo } })) return { error: "Ya hay un propietario con ese correo." };
  const password = contrasenaTemporal();
  await db.propietario.create({ data: { ...r.data, passwordHash: await bcrypt.hash(password, 10), creadoPorId: yo.id } });
  revalidatePath("/panel/administradores");
  return { ok: `${r.data.nombre} ya puede entrar al panel.`, password, correo: r.data.correo };
}

export async function cambiarActivo(id: string, activo: boolean): Promise<EstadoAdmin> {
  const yo = await exigirPropietario();
  if (id === yo.id) return { error: "No puedes desactivar tu propia cuenta." };
  if (!activo && (await db.propietario.count({ where: { activo: true } })) <= 1) return { error: "Debe quedar al menos un propietario activo." };
  await db.propietario.update({ where: { id }, data: { activo } });
  revalidatePath("/panel/administradores");
  return { ok: activo ? "Cuenta activada." : "Cuenta desactivada. Ya no puede entrar al panel." };
}

export async function restablecerPropietario(id: string): Promise<EstadoAdmin> {
  const yo = await exigirPropietario();
  if (id === yo.id) return { error: "Para tu cuenta usa «Cambiar mi contraseña»." };
  const p = await db.propietario.findUnique({ where: { id }, select: { correo: true } });
  if (!p) return { error: "No se encontró la cuenta." };
  const password = contrasenaTemporal();
  await db.propietario.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  return { ok: "Contraseña nueva creada.", password, correo: p.correo };
}

export async function cambiarMiContrasena(_: EstadoAdmin, form: FormData): Promise<EstadoAdmin> {
  const yo = await exigirPropietario();
  const actual = String(form.get("actual") ?? "");
  const nueva = String(form.get("nueva") ?? "");
  const repetir = String(form.get("repetir") ?? "");
  if (nueva.length < 8) return { error: "La contraseña nueva debe tener al menos 8 caracteres." };
  if (nueva !== repetir) return { error: "Las contraseñas nuevas no coinciden." };
  const p = await db.propietario.findUniqueOrThrow({ where: { id: yo.id } });
  if (!(await bcrypt.compare(actual, p.passwordHash))) return { error: "La contraseña actual no es correcta." };
  await db.propietario.update({ where: { id: yo.id }, data: { passwordHash: await bcrypt.hash(nueva, 10) } });
  return { ok: "Tu contraseña se cambió." };
}
