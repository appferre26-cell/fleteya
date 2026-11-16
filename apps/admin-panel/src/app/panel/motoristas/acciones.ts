"use server";
import bcrypt from "bcryptjs";
import { Prisma, type TipoDocumento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirPropietario } from "@/lib/sesion";
import { avisarMotoristas, despues } from "@/lib/avisos";
import {
  MAX_DOC_BYTES, contrasenaTemporal, erroresDe, esquemaMotorista, type ErroresCampos,
} from "@/lib/validacion";

const TIPOS_DOC: TipoDocumento[] = ["DUI", "LICENCIA", "TARJETA_CIRCULACION"];

/** Revisa el contenido real del archivo (no solo su nombre). */
function detectarMime(b: Buffer): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 4).toString("hex") === "89504e47") return "image/png";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (b.subarray(0, 4).toString() === "%PDF") return "application/pdf";
  return null;
}

async function leerDocumentos(form: FormData) {
  const docs: { tipo: TipoDocumento; mime: string; datos: Uint8Array<ArrayBuffer> }[] = [];
  const errores: ErroresCampos = {};
  for (const tipo of TIPOS_DOC) {
    const f = form.get(`doc_${tipo}`);
    if (!(f instanceof File) || f.size === 0) continue;
    if (f.size > MAX_DOC_BYTES) { errores[`doc_${tipo}`] = "El archivo pesa más de 4 MB"; continue; }
    const datos = new Uint8Array(await f.arrayBuffer());
    const mime = detectarMime(Buffer.from(datos.buffer));
    if (!mime) { errores[`doc_${tipo}`] = "Sube una foto (JPG, PNG) o un PDF"; continue; }
    docs.push({ tipo, mime, datos });
  }
  return { docs, errores };
}

function errorDuplicado(e: unknown): ErroresCampos | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const campos = String((e.meta?.target as string[] | undefined)?.join(",") ?? "");
    if (campos.includes("telefono")) return { telefono: "Ya hay un motorista con este teléfono" };
    if (campos.includes("dui")) return { dui: "Ya hay un motorista con este DUI" };
    if (campos.includes("placa")) return { placa: "Ya hay un motorista con esta placa" };
    return { general: "Uno de los datos ya está registrado" };
  }
  return null;
}

function datosDe(form: FormData) {
  const keys = ["nombre", "telefono", "correo", "dui", "licenciaNumero", "licenciaVence", "placa", "marca", "modelo", "tipoVehiculo", "capacidadTon"];
  return Object.fromEntries(keys.map((k) => [k, String(form.get(k) ?? "")]));
}

export type EstadoFormMotorista = {
  errores?: ErroresCampos;
  valores?: Record<string, string>;
  creado?: { id: string; nombre: string; telefono: string; password: string; documentos: number };
  guardado?: boolean;
};

export async function crearMotorista(_: EstadoFormMotorista, form: FormData): Promise<EstadoFormMotorista> {
  const yo = await exigirPropietario();
  const valores = datosDe(form);
  const r = esquemaMotorista.safeParse(valores);
  const { docs, errores: errDocs } = await leerDocumentos(form);
  if (!r.success || Object.keys(errDocs).length) {
    return { errores: { ...(r.success ? {} : erroresDe(r.error)), ...errDocs }, valores };
  }

  const password = contrasenaTemporal();
  try {
    const m = await db.motorista.create({
      data: {
        ...r.data,
        passwordHash: await bcrypt.hash(password, 10),
        creadoPorId: yo.id,
        documentos: { create: docs },
        historial: { create: { propietarioId: yo.id, accion: "CREADO", detalle: `${docs.length}/3 documentos` } },
      },
    });
    revalidatePath("/panel", "layout");
    return { creado: { id: m.id, nombre: m.nombre, telefono: m.telefono, password, documentos: docs.length } };
  } catch (e) {
    const dup = errorDuplicado(e);
    if (dup) return { errores: dup, valores };
    throw e;
  }
}

export async function editarMotorista(id: string, _: EstadoFormMotorista, form: FormData): Promise<EstadoFormMotorista> {
  const yo = await exigirPropietario();
  const valores = datosDe(form);
  const r = esquemaMotorista.safeParse(valores);
  const { docs, errores: errDocs } = await leerDocumentos(form);
  if (!r.success || Object.keys(errDocs).length) {
    return { errores: { ...(r.success ? {} : erroresDe(r.error)), ...errDocs }, valores };
  }
  try {
    await db.$transaction(async (tx) => {
      await tx.motorista.update({ where: { id }, data: r.data });
      await tx.historialMotorista.create({ data: { motoristaId: id, propietarioId: yo.id, accion: "EDITADO" } });
      for (const d of docs) {
        await tx.documento.upsert({
          where: { motoristaId_tipo: { motoristaId: id, tipo: d.tipo } },
          create: { motoristaId: id, ...d },
          update: { mime: d.mime, datos: d.datos, subidoEn: new Date() },
        });
        await tx.historialMotorista.create({ data: { motoristaId: id, propietarioId: yo.id, accion: "DOCUMENTO_ACTUALIZADO", detalle: d.tipo } });
      }
    });
  } catch (e) {
    const dup = errorDuplicado(e);
    if (dup) return { errores: dup, valores };
    throw e;
  }
  revalidatePath("/panel", "layout");
  return { guardado: true };
}

export type EstadoAccion = { error?: string; ok?: string; password?: string };

export async function aprobarMotorista(id: string, _: EstadoAccion, form: FormData): Promise<EstadoAccion> {
  const yo = await exigirPropietario();
  const m = await db.motorista.findUnique({ where: { id }, include: { _count: { select: { documentos: true } } } });
  if (!m) return { error: "No se encontró el motorista." };
  if (m.estado !== "PENDIENTE") return { error: "Este motorista ya no está pendiente." };
  if (m._count.documentos < 3) return { error: "Faltan fotos de documentos. Súbelas en «Editar datos» antes de aprobar." };
  if (!["revisoDui", "revisoLicencia", "revisoTarjeta"].every((k) => form.get(k) === "on")) {
    return { error: "Marca las tres casillas para confirmar que revisaste los documentos." };
  }
  await db.motorista.update({
    where: { id },
    data: {
      estado: "ACTIVO", aprobadoEn: new Date(), aprobadoPorId: yo.id, motivoSuspension: null,
      historial: { create: { propietarioId: yo.id, accion: "APROBADO" } },
    },
  });
  despues(() => avisarMotoristas([id], { titulo: "¡Tu cuenta de FleteYa fue aprobada!", cuerpo: "Ya puedes conectarte y recibir viajes cuando tengas créditos.", url: "/motorista", tag: "fleteya-cuenta" }));
  revalidatePath("/panel", "layout");
  return { ok: "Motorista aprobado. Ya puede recibir viajes cuando la app del motorista esté lista." };
}

export async function suspenderMotorista(id: string, _: EstadoAccion, form: FormData): Promise<EstadoAccion> {
  const yo = await exigirPropietario();
  const motivo = String(form.get("motivo") ?? "").trim();
  if (motivo.length < 3) return { error: "Escribe el motivo de la suspensión." };
  if (motivo.length > 300) return { error: "El motivo es demasiado largo (máx. 300 caracteres)." };
  const m = await db.motorista.findUnique({ where: { id }, select: { estado: true } });
  if (!m) return { error: "No se encontró el motorista." };
  if (m.estado === "SUSPENDIDO") return { error: "Ya está suspendido." };
  await db.motorista.update({
    where: { id },
    data: { estado: "SUSPENDIDO", motivoSuspension: motivo, historial: { create: { propietarioId: yo.id, accion: "SUSPENDIDO", detalle: motivo } } },
  });
  revalidatePath("/panel", "layout");
  return { ok: "Motorista suspendido. No podrá recibir viajes." };
}

export async function reactivarMotorista(id: string): Promise<EstadoAccion> {
  const yo = await exigirPropietario();
  const m = await db.motorista.findUnique({ where: { id }, select: { estado: true, aprobadoEn: true } });
  if (!m) return { error: "No se encontró el motorista." };
  if (m.estado !== "SUSPENDIDO") return { error: "Este motorista no está suspendido." };
  // Si nunca fue aprobado, vuelve a pendiente para que se revisen sus documentos.
  const estado = m.aprobadoEn ? "ACTIVO" : "PENDIENTE";
  await db.motorista.update({
    where: { id },
    data: { estado, motivoSuspension: null, historial: { create: { propietarioId: yo.id, accion: "REACTIVADO" } } },
  });
  revalidatePath("/panel", "layout");
  return { ok: estado === "ACTIVO" ? "Motorista reactivado." : "Reactivado como pendiente: falta aprobar sus documentos." };
}

export async function restablecerContrasena(id: string): Promise<EstadoAccion> {
  const yo = await exigirPropietario();
  const password = contrasenaTemporal();
  await db.motorista.update({
    where: { id },
    data: {
      passwordHash: await bcrypt.hash(password, 10), debeCambiarPassword: true,
      historial: { create: { propietarioId: yo.id, accion: "CONTRASENA_RESTABLECIDA" } },
    },
  });
  revalidatePath(`/panel/motoristas/${id}`);
  return { ok: "Contraseña nueva creada.", password };
}
