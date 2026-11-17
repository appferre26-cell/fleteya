import "server-only";
import { Prisma, type FormaPago } from "@prisma/client";
import { obtenerConfig } from "./config";
import { db } from "./db";
import { RECARGA_MAX, RECARGA_MIN, numeroRecibo } from "./recibo";
import { centavos } from "./tarifa";

export class ErrorRecarga extends Error {}

/** Referencias de transferencia: sin espacios y en mayúsculas, para detectar la misma escrita distinto. */
export const normalizarReferencia = (r: string) => r.replace(/\s+/g, "").toUpperCase();

type NuevaRecarga = {
  motoristaId: string; monto: number; formaPago: FormaPago;
  referencia: string | null; nota: string | null; propietarioId: string;
};

/** Dos personas registrando la misma transferencia a la vez: solo pasa una. */
async function revisarReferencia(tx: Prisma.TransactionClient, referencia: string | null) {
  if (!referencia) return;
  await tx.$queryRaw`SELECT 1 AS ok FROM (SELECT pg_advisory_xact_lock(hashtext(${"ref:" + referencia}))) AS x`;
  const repetida = await tx.recarga.findFirst({
    where: { referencia, formaPago: "TRANSFERENCIA", anuladaEn: null },
    select: { numero: true, motorista: { select: { nombre: true } } },
  });
  if (repetida) throw new ErrorRecarga(`Esa referencia ya se registró en ${numeroRecibo(repetida.numero)} (${repetida.motorista.nombre}). Revisa que no sea la misma transferencia.`);
}

/**
 * Suma el monto que pagó el motorista a su saldo (ya no hay planes: recarga lo que quiera).
 * Si estaba en negativo, la deuda se descuenta sola (ej. -$0.20 + $20 = $19.80).
 * Bloquea la fila del motorista para no pisarse con una comisión.
 */
export async function registrarRecarga(d: NuevaRecarga) {
  const cfg = await obtenerConfig();
  const monto = centavos(d.monto);
  if (!(monto >= RECARGA_MIN && monto <= RECARGA_MAX)) throw new ErrorRecarga(`El monto debe estar entre $${RECARGA_MIN} y $${RECARGA_MAX}.`);
  const referencia = d.referencia ? normalizarReferencia(d.referencia) : null;

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Motorista" WHERE id = ${d.motoristaId} FOR UPDATE`;
    const m = await tx.motorista.findUnique({ where: { id: d.motoristaId }, select: { saldoCreditos: true } });
    if (!m) throw new ErrorRecarga("No se encontró ese motorista.");
    await revisarReferencia(tx, referencia);

    const antes = Number(m.saldoCreditos);
    const deuda = antes < 0 ? centavos(-antes) : 0;
    const despues = centavos(antes + monto);
    const r = await tx.recarga.create({
      data: {
        motoristaId: d.motoristaId, concepto: "RECARGA", monto, formaPago: d.formaPago, referencia, nota: d.nota,
        saldoAntes: antes, deudaDescontada: deuda, saldoDespues: despues, registradoPorId: d.propietarioId,
        emisorNombre: cfg.emisorNombre, emisorNit: cfg.emisorNit, emisorDireccion: cfg.emisorDireccion,
      },
    });
    await tx.motorista.update({ where: { id: d.motoristaId }, data: { saldoCreditos: despues } });
    await tx.movimientoCredito.create({
      data: {
        motoristaId: d.motoristaId, tipo: "RECARGA", monto, saldoAntes: antes, saldoDespues: despues,
        detalle: numeroRecibo(r.numero), creadoPorId: d.propietarioId, recargaId: r.id,
      },
    });
    return r;
  });
}

/**
 * Pago único de acceso a la plataforma: genera su recibo (no suma créditos) y deja al motorista
 * listo para que un propietario lo apruebe. Hoy lo registra un propietario (efectivo o transferencia);
 * con Wompi lo registrará el aviso de pago en línea.
 */
export async function registrarPagoAcceso(d: Omit<NuevaRecarga, "monto">) {
  const cfg = await obtenerConfig();
  const referencia = d.referencia ? normalizarReferencia(d.referencia) : null;
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Motorista" WHERE id = ${d.motoristaId} FOR UPDATE`;
    const m = await tx.motorista.findUnique({ where: { id: d.motoristaId }, select: { saldoCreditos: true, accesoPagadoEn: true } });
    if (!m) throw new ErrorRecarga("No se encontró ese motorista.");
    if (m.accesoPagadoEn) throw new ErrorRecarga("Este motorista ya pagó su acceso.");
    await revisarReferencia(tx, referencia);
    const saldo = Number(m.saldoCreditos);
    const r = await tx.recarga.create({
      data: {
        motoristaId: d.motoristaId, concepto: "ACCESO", monto: cfg.precioAcceso, formaPago: d.formaPago, referencia, nota: d.nota,
        saldoAntes: saldo, deudaDescontada: 0, saldoDespues: saldo, registradoPorId: d.propietarioId,
        emisorNombre: cfg.emisorNombre, emisorNit: cfg.emisorNit, emisorDireccion: cfg.emisorDireccion,
      },
    });
    await tx.motorista.update({
      where: { id: d.motoristaId },
      data: {
        accesoPagadoEn: new Date(),
        historial: { create: { propietarioId: d.propietarioId, accion: "PAGO_ACCESO", detalle: numeroRecibo(r.numero) } },
      },
    });
    return r;
  });
}

/** Deshace una recarga registrada por error: resta el monto (el saldo puede quedar negativo) y marca el recibo como anulado. */
export async function anularRecarga(id: string, propietarioId: string, motivo: string) {
  return db.$transaction(async (tx) => {
    const r = await tx.recarga.findUnique({ where: { id }, select: { motoristaId: true, numero: true, monto: true, concepto: true, motorista: { select: { estado: true, aprobadoEn: true } } } });
    if (!r) throw new ErrorRecarga("No se encontró esa recarga.");
    if (r.concepto === "ACCESO" && r.motorista.aprobadoEn) throw new ErrorRecarga("Ese motorista ya fue aprobado con este pago. Si no corresponde, suspéndelo.");
    await tx.$queryRaw`SELECT id FROM "Motorista" WHERE id = ${r.motoristaId} FOR UPDATE`;
    const marcada = await tx.recarga.updateMany({
      where: { id, anuladaEn: null },
      data: { anuladaEn: new Date(), anuladaPorId: propietarioId, motivoAnulacion: motivo },
    });
    if (marcada.count === 0) throw new ErrorRecarga("Esa recarga ya estaba anulada.");
    const m = await tx.motorista.findUniqueOrThrow({ where: { id: r.motoristaId }, select: { saldoCreditos: true } });
    if (r.concepto === "ACCESO") {
      // El acceso no sumó créditos: solo vuelve a quedar sin pagar.
      await tx.motorista.update({
        where: { id: r.motoristaId },
        data: { accesoPagadoEn: null, historial: { create: { propietarioId, accion: "PAGO_ACCESO_ANULADO", detalle: `${numeroRecibo(r.numero)} — ${motivo}` } } },
      });
      return { numero: r.numero, saldoDespues: Number(m.saldoCreditos) };
    }
    const antes = Number(m.saldoCreditos);
    const despues = centavos(antes - Number(r.monto));
    await tx.motorista.update({ where: { id: r.motoristaId }, data: { saldoCreditos: despues } });
    await tx.movimientoCredito.create({
      data: {
        motoristaId: r.motoristaId, tipo: "AJUSTE", monto: -Number(r.monto), saldoAntes: antes, saldoDespues: despues,
        detalle: `Anulación ${numeroRecibo(r.numero)}`, creadoPorId: propietarioId, recargaId: id,
      },
    });
    return { numero: r.numero, saldoDespues: despues };
  });
}

/** Todo lo que sale en el recibo (pantalla, PDF y correo). */
export async function obtenerRecibo(where: { numero: number; motoristaId?: string }) {
  const r = await db.recarga.findFirst({
    where,
    include: {
      motorista: { select: { id: true, nombre: true, telefono: true, correo: true, dui: true, requiereCreditoFiscal: true, nit: true, nrc: true, razonSocial: true } },
      registradoPor: { select: { nombre: true } },
      anuladaPor: { select: { nombre: true } },
    },
  });
  if (!r) return null;
  const cfg = await obtenerConfig();
  return {
    id: r.id, numero: r.numero, fecha: r.creadoEn, concepto: r.concepto, formaPago: r.formaPago, referencia: r.referencia, nota: r.nota,
    monto: Number(r.monto), saldoAntes: Number(r.saldoAntes), deuda: Number(r.deudaDescontada), saldoDespues: Number(r.saldoDespues),
    motorista: r.motorista, registradoPor: r.registradoPor.nombre,
    emisor: { nombre: r.emisorNombre, nit: r.emisorNit, direccion: r.emisorDireccion },
    comisionPct: cfg.comisionPct, zona: cfg.zonaNombre,
    correoEnviadoA: r.correoEnviadoA, correoEnviadoEn: r.correoEnviadoEn, correoError: r.correoError,
    anulada: r.anuladaEn ? { en: r.anuladaEn, por: r.anuladaPor?.nombre ?? "", motivo: r.motivoAnulacion ?? "" } : null,
  };
}

export type Recibo = NonNullable<Awaited<ReturnType<typeof obtenerRecibo>>>;
