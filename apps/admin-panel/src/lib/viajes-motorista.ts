import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { obtenerConfig } from "./config";
import { centavos, distanciaKm } from "./tarifa";
import { diasParaVencer } from "./validacion";

// Reglas de la app del motorista. Todo lo que cambia un viaje pasa por aquí para que
// dos motoristas no puedan quedarse con el mismo viaje y los créditos cuadren siempre.

export const ESTADOS_ACTIVOS = ["ASIGNADO", "EN_CAMINO", "CARGANDO", "EN_RUTA"] as const;

/** Siguiente paso del viaje que marca el motorista. */
export const SIGUIENTE = {
  ASIGNADO: { a: "EN_CAMINO", campo: "enCaminoEn", boton: "Voy en camino a recoger" },
  EN_CAMINO: { a: "CARGANDO", campo: "cargandoEn", boton: "Ya llegué · Iniciar carga" },
  CARGANDO: { a: "EN_RUTA", campo: "enRutaEn", boton: "Carga lista · Salir al destino" },
  EN_RUTA: { a: "ENTREGADO", campo: "entregadoEn", boton: "Entrega completada" },
} as const;

type MotoristaBase = {
  id: string; estado: string; disponible: boolean; saldoCreditos: Prisma.Decimal | number;
  licenciaVence: Date; capacidadTon: Prisma.Decimal | number;
};

/** ¿Puede recibir viajes nuevos? Si no, el motivo en palabras simples. */
export function puedeRecibir(m: MotoristaBase): { ok: true } | { ok: false; motivo: string; codigo: string } {
  if (m.estado === "PENDIENTE") return { ok: false, codigo: "PENDIENTE", motivo: "Tu cuenta está en revisión. FleteYa te avisa cuando quede aprobada." };
  if (m.estado === "SUSPENDIDO") return { ok: false, codigo: "SUSPENDIDO", motivo: "Tu cuenta está suspendida. Comunícate con FleteYa." };
  if (diasParaVencer(m.licenciaVence) < 0) return { ok: false, codigo: "LICENCIA", motivo: "Tu licencia está vencida. Renuévala y avisa a FleteYa para actualizarla." };
  if (Number(m.saldoCreditos) <= 0) return { ok: false, codigo: "SALDO", motivo: "No tienes créditos. Recarga para recibir viajes." };
  return { ok: true };
}

export async function viajeActivoDe(motoristaId: string) {
  return db.viaje.findFirst({
    where: { motoristaId, estado: { in: [...ESTADOS_ACTIVOS] } },
    include: { items: true, puntoQr: true },
  });
}

/** Solicitudes que este motorista puede ver ahora (le cabe el peso y no las rechazó). */
export async function solicitudesPara(m: MotoristaBase & { lat: number | null; lng: number | null }) {
  const viajes = await db.viaje.findMany({
    where: {
      estado: "BUSCANDO",
      pesoKg: { lte: Number(m.capacidadTon) * 1000 },
      rechazos: { none: { motoristaId: m.id } },
    },
    include: {
      items: true,
      puntoQr: { select: { nombre: true } },
      ofertas: { where: { motoristaId: m.id }, orderBy: { creadaEn: "desc" }, take: 1 },
    },
    orderBy: { creadoEn: "asc" },
    take: 20,
  });
  return viajes.map((v) => ({
    ...v,
    kmDeMi: m.lat != null && m.lng != null ? centavos(distanciaKm({ lat: m.lat, lng: m.lng }, { lat: v.origenLat, lng: v.origenLng })) : null,
    miOferta: v.ofertas[0] ?? null,
  }));
}

export class ErrorViaje extends Error {}

/** Comisión de un precio con el % configurado (al centavo). */
export async function comisionDe(precio: number) {
  const cfg = await obtenerConfig();
  return centavos((precio * cfg.comisionPct) / 100);
}

/**
 * Asigna el viaje al motorista dentro de una transacción.
 * Solo funciona si el viaje sigue BUSCANDO y el motorista no tiene otro viaje activo.
 */
export async function asignar(viajeId: string, motoristaId: string, precioFinal: number, ofertaId?: string) {
  return db.$transaction(async (tx) => {
    // Bloquea la fila del motorista para que no acepte dos viajes al mismo tiempo.
    await tx.$queryRaw`SELECT id FROM "Motorista" WHERE id = ${motoristaId} FOR UPDATE`;
    const m = await tx.motorista.findUnique({ where: { id: motoristaId } });
    if (!m) throw new ErrorViaje("Motorista no encontrado.");
    const p = puedeRecibir(m);
    if (!p.ok) throw new ErrorViaje(p.motivo);
    const ocupado = await tx.viaje.count({ where: { motoristaId, estado: { in: [...ESTADOS_ACTIVOS] } } });
    if (ocupado) throw new ErrorViaje("Ya tienes un viaje en curso. Termínalo antes de tomar otro.");
    const v = await tx.viaje.findUnique({ where: { id: viajeId } });
    if (!v) throw new ErrorViaje("Este viaje ya no existe.");
    if (Number(v.pesoKg) > Number(m.capacidadTon) * 1000) throw new ErrorViaje("Esta carga es más pesada de lo que lleva tu vehículo.");

    const r = await tx.viaje.updateMany({
      where: { id: viajeId, estado: "BUSCANDO", motoristaId: null },
      data: { estado: "ASIGNADO", motoristaId, precioFinal, asignadoEn: new Date() },
    });
    if (r.count === 0) throw new ErrorViaje(v.estado === "CANCELADO" ? "El cliente canceló este pedido." : "Otro motorista ya tomó este viaje.");

    const ahora = new Date();
    if (ofertaId) {
      const o = await tx.ofertaPrecio.updateMany({ where: { id: ofertaId, viajeId, motoristaId, estado: "PENDIENTE" }, data: { estado: "ACEPTADA", respondidaEn: ahora } });
      if (o.count === 0) throw new ErrorViaje("El motorista retiró esa oferta.");
    }
    // Las demás ofertas de este viaje quedan rechazadas; las otras ofertas de este motorista, retiradas.
    await tx.ofertaPrecio.updateMany({ where: { viajeId, estado: "PENDIENTE" }, data: { estado: "RECHAZADA", respondidaEn: ahora } });
    await tx.ofertaPrecio.updateMany({ where: { motoristaId, estado: "PENDIENTE" }, data: { estado: "RETIRADA", respondidaEn: ahora } });

    // La comisión se cobra AL ACEPTAR (no al entregar). Se descuenta de los créditos del motorista.
    // Puede dejar el saldo negativo: no se bloquea la aceptación (puedeRecibir ya exigió saldo > 0).
    const cfg = await tx.configuracion.findUniqueOrThrow({ where: { id: 1 } });
    const comision = centavos((precioFinal * Number(cfg.comisionPct)) / 100);
    const saldoAntes = Number(m.saldoCreditos);
    const saldoDespues = centavos(saldoAntes - comision);
    await tx.motorista.update({ where: { id: motoristaId }, data: { saldoCreditos: saldoDespues } });
    await tx.viaje.update({ where: { id: viajeId }, data: { comision } });
    await tx.movimientoCredito.create({
      data: {
        motoristaId, tipo: "COMISION", monto: -comision, saldoAntes, saldoDespues, viajeId,
        detalle: `${Number(cfg.comisionPct)}% del viaje de $${precioFinal.toFixed(2)} (al aceptar)`,
      },
    });
    return { saldo: saldoAntes, comision, saldoDespues };
  });
}

/**
 * Devuelve la comisión ya cobrada si el viaje se cancela/suelta antes de entregar.
 * Idempotente: solo actúa si hay comisión guardada (> 0) y la deja en 0 para no devolver dos veces.
 * Debe llamarse DENTRO de una transacción que ya esté cambiando el estado del viaje.
 */
export async function reembolsarComision(tx: Prisma.TransactionClient, viajeId: string, motoristaId: string) {
  const v = await tx.viaje.findUnique({ where: { id: viajeId } });
  const comision = Number(v?.comision ?? 0);
  if (!v || comision <= 0) return;
  await tx.$queryRaw`SELECT id FROM "Motorista" WHERE id = ${motoristaId} FOR UPDATE`;
  const m = await tx.motorista.findUniqueOrThrow({ where: { id: motoristaId } });
  const saldoAntes = Number(m.saldoCreditos);
  const saldoDespues = centavos(saldoAntes + comision);
  await tx.motorista.update({ where: { id: motoristaId }, data: { saldoCreditos: saldoDespues } });
  await tx.viaje.update({ where: { id: viajeId }, data: { comision: 0 } });
  await tx.movimientoCredito.create({
    data: {
      motoristaId, tipo: "REEMBOLSO", monto: comision, saldoAntes, saldoDespues, viajeId,
      detalle: "Devolución de comisión por viaje cancelado",
    },
  });
}

/** Marca el siguiente paso. La comisión ya se cobró al aceptar, así que al entregar NO se toca el saldo. */
export async function avanzar(viajeId: string, motoristaId: string, desde: keyof typeof SIGUIENTE) {
  const paso = SIGUIENTE[desde];
  if (!paso) throw new ErrorViaje("Paso no válido.");
  return db.$transaction(async (tx) => {
    const ahora = new Date();
    const r = await tx.viaje.updateMany({
      where: { id: viajeId, motoristaId, estado: desde },
      data: { estado: paso.a, [paso.campo]: ahora },
    });
    if (r.count === 0) {
      const v = await tx.viaje.findUnique({ where: { id: viajeId } });
      if (v?.estado === "CANCELADO") throw new ErrorViaje("Este viaje fue cancelado.");
      throw new ErrorViaje("El viaje ya cambió. Recarga la pantalla.");
    }
    if (paso.a !== "ENTREGADO") return { estado: paso.a };

    // La comisión ya se cobró al aceptar: al entregar solo informamos el precio a cobrar en efectivo.
    const v = await tx.viaje.findUniqueOrThrow({ where: { id: viajeId } });
    return { estado: paso.a, comision: Number(v.comision ?? 0), precio: Number(v.precioFinal ?? v.precioBase) };
  });
}

/** El motorista suelta un viaje antes de cargar: vuelve a buscar motorista y él ya no lo ve. */
export async function soltar(viajeId: string, motoristaId: string) {
  return db.$transaction(async (tx) => {
    const r = await tx.viaje.updateMany({
      where: { id: viajeId, motoristaId, estado: { in: ["ASIGNADO", "EN_CAMINO"] } },
      data: { estado: "BUSCANDO", motoristaId: null, precioFinal: null, asignadoEn: null, enCaminoEn: null },
    });
    if (r.count === 0) throw new ErrorViaje("Ya no se puede soltar este viaje. Si hay un problema, llama a FleteYa.");
    // Devuelve la comisión que se cobró al aceptar (idempotente).
    await reembolsarComision(tx, viajeId, motoristaId);
    await tx.ofertaPrecio.updateMany({ where: { viajeId, motoristaId, estado: "ACEPTADA" }, data: { estado: "RETIRADA" } });
    await tx.rechazoViaje.upsert({
      where: { viajeId_motoristaId: { viajeId, motoristaId } },
      create: { viajeId, motoristaId, motivo: "CANCELO" },
      update: { motivo: "CANCELO" },
    });
  });
}
