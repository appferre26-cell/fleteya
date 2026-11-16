"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { iniciarSesion } from "@/lib/sesion";

// Freno simple contra intentos repetidos: 5 fallos → esperar 15 minutos.
const fallos = new Map<string, { n: number; hasta: number }>();
const MAX_FALLOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;

export type EstadoLogin = { error?: string; correo?: string };

export async function entrar(_: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const correo = String(form.get("correo") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const recordar = form.get("recordar") === "on";

  if (!correo || !password) return { error: "Escribe tu correo y tu contraseña.", correo };

  const f = fallos.get(correo);
  if (f && f.n >= MAX_FALLOS && f.hasta > Date.now()) {
    const min = Math.ceil((f.hasta - Date.now()) / 60000);
    return { error: `Demasiados intentos. Espera ${min} min e inténtalo de nuevo.`, correo };
  }

  const p = await db.propietario.findUnique({ where: { correo } });
  const ok = p?.activo && (await bcrypt.compare(password, p.passwordHash));
  if (!ok || !p) {
    const n = f && f.hasta > Date.now() ? f.n + 1 : 1;
    fallos.set(correo, { n, hasta: Date.now() + BLOQUEO_MS });
    // Mismo mensaje si el correo no existe: no revelamos qué cuentas hay.
    return { error: "Correo o contraseña incorrectos.", correo };
  }

  fallos.delete(correo);
  await db.propietario.update({ where: { id: p.id }, data: { ultimoAcceso: new Date() } });
  await iniciarSesion(p.id, recordar);
  redirect("/panel");
}
