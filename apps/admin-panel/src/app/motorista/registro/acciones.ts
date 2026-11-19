"use server";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { datosDe, errorDuplicado, leerDocumentos, leerFotoPerfil } from "@/lib/documentos";
import { iniciarSesionMotorista, VERSION_TERMINOS } from "@/lib/sesion-motorista";
import { CAMPOS_FISCALES, erroresDe, esquemaFiscal, esquemaMotorista, type ErroresCampos } from "@/lib/validacion";

export type EstadoRegistro = { errores?: ErroresCampos; valores?: Record<string, string> };

// Freno simple contra registros en serie desde el mismo lugar (se reinicia al reiniciar el servidor).
const intentos = new Map<string, { n: number; desde: number }>();
const MAX_POR_HORA = 5;

/** El motorista se registra solo desde la app. Queda PENDIENTE hasta pagar el acceso y que FleteYa revise sus fotos. */
export async function registrarMotorista(_: EstadoRegistro, form: FormData): Promise<EstadoRegistro> {
  const valores: Record<string, string> = { ...datosDe(form), ...Object.fromEntries(CAMPOS_FISCALES.map((k) => [k, String(form.get(k) ?? "")])) };
  const password = String(form.get("password") ?? "");
  const repetir = String(form.get("repetir") ?? "");

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const i = intentos.get(ip);
  const ahora = Date.now();
  if (i && ahora - i.desde < 3600_000 && i.n >= MAX_POR_HORA) {
    return { errores: { general: "Se hicieron demasiados registros desde esta conexión. Espera una hora o escríbenos por WhatsApp." }, valores };
  }

  const r = esquemaMotorista.safeParse(valores);
  const f = esquemaFiscal.safeParse(valores);
  const { docs, errores: errDocs } = await leerDocumentos(form, { exigirTodas: true });
  const { foto, error: errFoto } = await leerFotoPerfil(form, { obligatoria: true });
  const errores: ErroresCampos = { ...(r.success ? {} : erroresDe(r.error)), ...(f.success ? {} : erroresDe(f.error)), ...errDocs };
  if (errFoto) errores.foto_perfil = errFoto;
  if (password.length < 8) errores.password = "Mínimo 8 letras o números";
  else if (password !== repetir) errores.repetir = "Las dos contraseñas no son iguales";
  if (form.get("acepto") !== "on") errores.acepto = "Debes aceptar los términos para registrarte";
  if (!r.success || !f.success || Object.keys(errores).length) return { errores, valores };

  let id: string;
  try {
    const m = await db.motorista.create({
      data: {
        ...r.data,
        ...f.data,
        passwordHash: await bcrypt.hash(password, 10),
        debeCambiarPassword: false,
        autoRegistro: true,
        terminosVersion: VERSION_TERMINOS,
        terminosAceptadosEn: new Date(),
        ultimoAcceso: new Date(),
        documentos: { create: foto ? [...docs, { tipo: "FOTO_PERFIL" as const, mime: foto.mime, datos: foto.datos }] : docs },
        historial: { create: { accion: "AUTOREGISTRO", detalle: `${docs.length} fotos${foto ? " + foto de perfil" : ""}` } },
      },
      select: { id: true },
    });
    id = m.id;
  } catch (e) {
    const dup = errorDuplicado(e);
    if (dup) return { errores: dup, valores };
    throw e;
  }
  intentos.set(ip, i && ahora - i.desde < 3600_000 ? { n: i.n + 1, desde: i.desde } : { n: 1, desde: ahora });
  await iniciarSesionMotorista(id);
  revalidatePath("/panel", "layout");
  redirect("/motorista/alta?nuevo=1");
}
