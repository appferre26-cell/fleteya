"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirPropietario } from "@/lib/sesion";
import { avisarMotoristas, despues } from "@/lib/avisos";
import { CAMPOS_FISCALES, TOTAL_DOCS, TOTAL_REQUISITOS, contrasenaTemporal, erroresDe, esquemaFiscal, esquemaMotorista, type ErroresCampos } from "@/lib/validacion";
import { datosDe, errorDuplicado, leerDocumentos, leerFotoPerfil } from "@/lib/documentos";

const valoresDe = (form: FormData) => ({ ...datosDe(form), ...Object.fromEntries(CAMPOS_FISCALES.map((k) => [k, String(form.get(k) ?? "")])) });

export type EstadoFormMotorista = {
  errores?: ErroresCampos;
  valores?: Record<string, string>;
  creado?: { id: string; nombre: string; telefono: string; password: string; documentos: number };
  guardado?: boolean;
};

export async function crearMotorista(_: EstadoFormMotorista, form: FormData): Promise<EstadoFormMotorista> {
  const yo = await exigirPropietario();
  const valores = valoresDe(form);
  const r = esquemaMotorista.safeParse(valores);
  const f = esquemaFiscal.safeParse(valores);
  const { docs, errores: errDocs } = await leerDocumentos(form);
  const { foto, error: errFoto } = await leerFotoPerfil(form, { obligatoria: true });
  if (errFoto) errDocs.foto_perfil = errFoto;
  if (!r.success || !f.success || Object.keys(errDocs).length) {
    return { errores: { ...(r.success ? {} : erroresDe(r.error)), ...(f.success ? {} : erroresDe(f.error)), ...errDocs }, valores };
  }

  const password = contrasenaTemporal();
  try {
    const m = await db.motorista.create({
      data: {
        ...r.data,
        ...f.data,
        passwordHash: await bcrypt.hash(password, 10),
        creadoPorId: yo.id,
        documentos: { create: foto ? [...docs, { tipo: "FOTO_PERFIL" as const, mime: foto.mime, datos: foto.datos }] : docs },
        historial: { create: { propietarioId: yo.id, accion: "CREADO", detalle: `${docs.length}/${TOTAL_DOCS} fotos` } },
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
  const valores = valoresDe(form);
  const r = esquemaMotorista.safeParse(valores);
  const f = esquemaFiscal.safeParse(valores);
  const { docs, errores: errDocs } = await leerDocumentos(form);
  // Si ya tiene foto, no se obliga a re-subirla; si no la tiene, se exige.
  const fotoActual = await db.documento.findUnique({ where: { motoristaId_tipo: { motoristaId: id, tipo: "FOTO_PERFIL" } }, select: { id: true } });
  const { foto, error: errFoto } = await leerFotoPerfil(form, { obligatoria: !fotoActual });
  if (errFoto) errDocs.foto_perfil = errFoto;
  if (!r.success || !f.success || Object.keys(errDocs).length) {
    return { errores: { ...(r.success ? {} : erroresDe(r.error)), ...(f.success ? {} : erroresDe(f.error)), ...errDocs }, valores };
  }
  // La foto de perfil se trata como un documento más, con upsert.
  const todos = foto ? [...docs, { tipo: "FOTO_PERFIL" as const, mime: foto.mime, datos: foto.datos }] : docs;
  try {
    await db.$transaction(async (tx) => {
      await tx.motorista.update({ where: { id }, data: { ...r.data, ...f.data } });
      await tx.historialMotorista.create({ data: { motoristaId: id, propietarioId: yo.id, accion: "EDITADO" } });
      for (const d of todos) {
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

/** Casillas que el propietario marca al aprobar (deben coincidir con AccionesMotorista). */
const REVISIONES = [["revisoDui"], ["revisoLicencia"], ["revisoTarjeta"], ["revisoVehiculo"]] as const;

export async function aprobarMotorista(id: string, _: EstadoAccion, form: FormData): Promise<EstadoAccion> {
  const yo = await exigirPropietario();
  // Todos los requisitos de fotos cuentan: los documentos obligatorios y la foto de perfil (ahora obligatoria).
  const m = await db.motorista.findUnique({ where: { id }, include: { _count: { select: { documentos: true } } } });
  if (!m) return { error: "No se encontró el motorista." };
  if (m.estado !== "PENDIENTE") return { error: "Este motorista ya no está pendiente." };
  if (m._count.documentos < TOTAL_REQUISITOS) return { error: `Faltan fotos (${m._count.documentos}/${TOTAL_REQUISITOS}). Súbelas en «Editar datos» antes de aprobar.` };
  if (!m.accesoPagadoEn) return { error: "Falta el pago del acceso a la plataforma. Regístralo antes de aprobar." };
  if (!REVISIONES.every(([k]) => form.get(k) === "on")) {
    return { error: "Marca todas las casillas para confirmar que revisaste los documentos y el vehículo." };
  }
  await db.motorista.update({
    where: { id },
    data: {
      estado: "ACTIVO", aprobadoEn: new Date(), aprobadoPorId: yo.id, motivoSuspension: null,
      historial: { create: { propietarioId: yo.id, accion: "APROBADO" } },
    },
  });
  despues(() => avisarMotoristas([id], { titulo: "¡Tu perfil de FleteYa está activo!", cuerpo: "Recarga créditos y conéctate para recibir viajes.", url: "/motorista", tag: "fleteya-cuenta" }));
  revalidatePath("/panel", "layout");
  return { ok: "Motorista aprobado. Recibirá viajes en cuanto tenga créditos." };
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
