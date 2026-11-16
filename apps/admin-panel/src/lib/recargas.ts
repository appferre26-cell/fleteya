import "server-only";
import type { FormaPago, PlanRecarga } from "@prisma/client";
import { obtenerConfig } from "./config";
import { db } from "./db";
import { PLANES, numeroRecibo } from "./recibo";
import { centavos } from "./tarifa";

export class ErrorRecarga extends Error {}

/** Referencias de transferencia: sin espacios y en mayúsculas, para detectar la misma escrita distinto. */
export const normalizarReferencia = (r: string) => r.replace(/\s+/g, "").toUpperCase();

type NuevaRecarga = {
  motoristaId: string; plan: PlanRecarga; formaPago: FormaPago;
  referencia: string | null; nota: string | null; propietarioId: string;
};

/**
 * Suma el plan al saldo del motorista. Si estaba en negativo, la deuda se descuenta sola
 * (ej. -$0.20 + $20 = $19.80). Bloquea la fila del motorista para no pisarse con una comisión.
 */
export async function registrarRecarga(d: NuevaRecarga) {
  const cfg = await obtenerConfig();
  const monto = d.plan === "SEMANAL" ? cfg.planSemanal : cfg.planMensual;
  const referencia = d.referencia ? normalizarReferencia(d.referencia) : null;

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Motorista" WHERE id = ${d.motoristaId} FOR UPDATE`;
    const m = await tx.motorista.findUnique({ where: { id: d.motoristaId }, select: { saldoCreditos: true } });
    if (!m) throw new ErrorRecarga("No se encontró ese motorista.");

    if (referencia) {
      // Dos personas registrando la misma transferencia a la vez: solo pasa una.
      await tx.$queryRaw`SELECT 1 AS ok FROM (SELECT pg_advisory_xact_lock(hashtext(${"ref:" + referencia}))) AS x`;
      const repetida = await tx.recarga.findFirst({
        where: { referencia, formaPago: "TRANSFERENCIA", anuladaEn: null },
        select: { numero: true, motorista: { select: { nombre: true } } },
      });
      if (repetida) throw new ErrorRecarga(`Esa referencia ya se registró en ${numeroRecibo(repetida.numero)} (${repetida.motorista.nombre}). Revisa que no sea la misma transferencia.`);
    }

    const antes = Number(m.saldoCreditos);
    const deuda = antes < 0 ? centavos(-antes) : 0;
    const despues = centavos(antes + monto);
    const r = await tx.recarga.create({
      data: {
        motoristaId: d.motoristaId, plan: d.plan, monto, formaPago: d.formaPago, referencia, nota: d.nota,
        saldoAntes: antes, deudaDescontada: deuda, saldoDespues: despues, registradoPorId: d.propietarioId,
        emisorNombre: cfg.emisorNombre, emisorNit: cfg.emisorNit, emisorDireccion: cfg.emisorDireccion,
      },
    });
    await tx.motorista.update({ where: { id: d.motoristaId }, data: { saldoCreditos: despues } });
    await tx.movimientoCredito.create({
      data: {
        motoristaId: d.motoristaId, tipo: "RECARGA", monto, saldoAntes: antes, saldoDespues: despues,
        detalle: `${numeroRecibo(r.numero)} · ${PLANES[d.plan]}`, creadoPorId: d.propietarioId, recargaId: r.id,
      },
    });
    return r;
  });
}

/** Deshace una recarga registrada por error: resta el monto (el saldo puede quedar negativo) y marca el recibo como anulado. */
export async function anularRecarga(id: string, propietarioId: string, motivo: string) {
  return db.$transaction(async (tx) => {
    const r = await tx.recarga.findUnique({ where: { id }, select: { motoristaId: true, numero: true, monto: true } });
    if (!r) throw new ErrorRecarga("No se encontró esa recarga.");
    await tx.$queryRaw`SELECT id FROM "Motorista" WHERE id = ${r.motoristaId} FOR UPDATE`;
    const marcada = await tx.recarga.updateMany({
      where: { id, anuladaEn: null },
      data: { anuladaEn: new Date(), anuladaPorId: propietarioId, motivoAnulacion: motivo },
    });
    if (marcada.count === 0) throw new ErrorRecarga("Esa recarga ya estaba anulada.");
    const m = await tx.motorista.findUniqueOrThrow({ where: { id: r.motoristaId }, select: { saldoCreditos: true } });
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
      motorista: { select: { id: true, nombre: true, telefono: true, correo: true } },
      registradoPor: { select: { nombre: true } },
      anuladaPor: { select: { nombre: true } },
    },
  });
  if (!r) return null;
  const cfg = await obtenerConfig();
  return {
    id: r.id, numero: r.numero, fecha: r.creadoEn, plan: r.plan, formaPago: r.formaPago, referencia: r.referencia, nota: r.nota,
    monto: Number(r.monto), saldoAntes: Number(r.saldoAntes), deuda: Number(r.deudaDescontada), saldoDespues: Number(r.saldoDespues),
    motorista: r.motorista, registradoPor: r.registradoPor.nombre,
    emisor: { nombre: r.emisorNombre, nit: r.emisorNit, direccion: r.emisorDireccion },
    comisionPct: cfg.comisionPct, zona: cfg.zonaNombre,
    correoEnviadoA: r.correoEnviadoA, correoEnviadoEn: r.correoEnviadoEn, correoError: r.correoError,
    anulada: r.anuladaEn ? { en: r.anuladaEn, por: r.anuladaPor?.nombre ?? "", motivo: r.motivoAnulacion ?? "" } : null,
  };
}

export type Recibo = NonNullable<Awaited<ReturnType<typeof obtenerRecibo>>>;
