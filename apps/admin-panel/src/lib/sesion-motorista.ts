import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { COOKIE_MOTORISTA, firmarToken, verificarToken } from "./token";

/** Versión de los Términos para Motoristas. Si cambia, se le piden de nuevo al entrar. */
export const VERSION_TERMINOS = "0.1";

const SEGUNDOS = 60 * 60 * 24 * 60; // 60 días: el motorista no debería tener que entrar a cada rato

export async function iniciarSesionMotorista(id: string) {
  const token = await firmarToken(id, SEGUNDOS, "motorista");
  (await cookies()).set(COOKIE_MOTORISTA, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SEGUNDOS,
  });
}

export async function cerrarSesionMotorista() {
  (await cookies()).delete(COOKIE_MOTORISTA);
}

/** Motorista con sesión válida (cualquier estado), o null. */
export const motoristaActual = cache(async () => {
  const id = await verificarToken((await cookies()).get(COOKIE_MOTORISTA)?.value, "motorista");
  if (!id) return null;
  return db.motorista.findUnique({
    where: { id },
    select: {
      id: true, nombre: true, telefono: true, correo: true, estado: true, motivoSuspension: true,
      debeCambiarPassword: true, terminosVersion: true, terminosAceptadosEn: true,
      placa: true, marca: true, modelo: true, tipoVehiculo: true, capacidadTon: true,
      licenciaNumero: true, licenciaVence: true, dui: true,
      disponible: true, saldoCreditos: true, lat: true, lng: true,
    },
  });
});

export type MotoristaSesion = NonNullable<Awaited<ReturnType<typeof motoristaActual>>>;

/**
 * Para páginas y acciones de la app del motorista.
 * Sin sesión → entrar. Contraseña temporal → cambiarla. Términos sin aceptar → aceptarlos.
 */
export async function exigirMotorista(opciones: { permitirPendientes?: boolean } = {}) {
  const m = await motoristaActual();
  if (!m) redirect("/motorista/salir");
  if (!opciones.permitirPendientes) {
    if (m.debeCambiarPassword) redirect("/motorista/contrasena");
    if (m.terminosVersion !== VERSION_TERMINOS) redirect("/motorista/terminos");
  }
  return m;
}
