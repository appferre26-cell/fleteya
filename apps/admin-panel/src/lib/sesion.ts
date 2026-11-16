import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { COOKIE_SESION, firmarToken, verificarToken } from "./token";

const DIA = 60 * 60 * 24;

export async function iniciarSesion(propietarioId: string, recordar: boolean) {
  const segundos = recordar ? 30 * DIA : DIA / 2; // 30 días o 12 horas
  const token = await firmarToken(propietarioId, segundos);
  (await cookies()).set(COOKIE_SESION, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: segundos,
  });
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE_SESION);
}

/** Propietario con sesión activa, o null. Revisa en la base que siga activo. */
export const propietarioActual = cache(async () => {
  const id = await verificarToken((await cookies()).get(COOKIE_SESION)?.value);
  if (!id) return null;
  const p = await db.propietario.findUnique({
    where: { id },
    select: { id: true, nombre: true, correo: true, activo: true },
  });
  return p?.activo ? p : null;
});

/** Para páginas y acciones del panel: si no hay sesión válida, manda al login. */
export async function exigirPropietario() {
  const p = await propietarioActual();
  // /salir borra la cookie (por si el token es válido pero la cuenta fue desactivada).
  if (!p) redirect("/salir");
  return p;
}
