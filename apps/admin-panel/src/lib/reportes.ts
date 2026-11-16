import "server-only";
import { db } from "@/lib/db";
import { diaSV, fechaLarga, sumarDias, type Periodo } from "@/lib/periodos";

export const CATEGORIAS_GASTO = ["Publicidad", "Carteles y QR", "Teléfono e internet", "Sueldos y ayudantes", "Trámites y legal", "Otros"] as const;

const num = (v: unknown) => Number(v ?? 0);
const r2 = (n: number) => Math.round(n * 100) / 100;
/** Las fechas de gastos son @db.Date (medianoche UTC del día). */
export const fechaGasto = (dia: string) => new Date(`${dia}T00:00:00Z`);

/** Números de un periodo. Viajes por fecha de entrega; recargas por fecha de registro (sin las anuladas); gastos por su fecha. */
export async function resumenPeriodo(p: Periodo) {
  const entregadoEn = { gte: p.inicio, lt: p.fin };
  const [ent, pedidos, recargas, gastos] = await Promise.all([
    db.viaje.aggregate({ where: { estado: "ENTREGADO", entregadoEn }, _count: true, _sum: { precioFinal: true, comision: true } }),
    db.viaje.groupBy({ by: ["estado"], where: { creadoEn: { gte: p.inicio, lt: p.fin } }, _count: true }),
    db.recarga.groupBy({ by: ["formaPago"], where: { creadoEn: { gte: p.inicio, lt: p.fin }, anuladaEn: null }, _count: true, _sum: { monto: true } }),
    db.gasto.aggregate({ where: { fecha: { gte: fechaGasto(p.desde), lte: fechaGasto(p.hasta) } }, _count: true, _sum: { monto: true } }),
  ]);
  const totalPedidos = pedidos.reduce((s, g) => s + g._count, 0);
  const cancelados = pedidos.find((g) => g.estado === "CANCELADO")?._count ?? 0;
  const recargado = r2(recargas.reduce((s, g) => s + num(g._sum.monto), 0));
  const porForma = (f: string) => recargas.find((g) => g.formaPago === f) ?? { _count: 0, _sum: { monto: 0 } };
  const gastado = r2(num(gastos._sum.monto));
  const cobrado = r2(num(ent._sum.precioFinal));
  return {
    entregados: ent._count,
    cobrado,
    comision: r2(num(ent._sum.comision)),
    promedioViaje: ent._count ? r2(cobrado / ent._count) : 0,
    pedidos: totalPedidos,
    cancelados,
    recargado,
    recargas: recargas.reduce((s, g) => s + g._count, 0),
    efectivo: r2(num(porForma("EFECTIVO")._sum.monto)),
    transferencia: r2(num(porForma("TRANSFERENCIA")._sum.monto)),
    gastado,
    gastos: gastos._count,
    ganancia: r2(recargado - gastado),
  };
}
export type Resumen = Awaited<ReturnType<typeof resumenPeriodo>>;

/** Barras por día (hasta 62 días) o por mes: viajes entregados, comisión y recargas. */
export async function seriePeriodo(p: Periodo) {
  const [viajes, recargas] = await Promise.all([
    db.viaje.findMany({ where: { estado: "ENTREGADO", entregadoEn: { gte: p.inicio, lt: p.fin } }, select: { entregadoEn: true, comision: true } }),
    db.recarga.findMany({ where: { creadoEn: { gte: p.inicio, lt: p.fin }, anuladaEn: null }, select: { creadoEn: true, monto: true } }),
  ]);
  const porMes = p.dias > 62;
  const clave = (d: Date) => (porMes ? diaSV(d).slice(0, 7) : diaSV(d));
  const cubetas = new Map<string, { viajes: number; comision: number; recargas: number }>();
  for (let d = p.desde; d <= p.hasta; d = sumarDias(d, 1)) {
    const k = porMes ? d.slice(0, 7) : d;
    if (!cubetas.has(k)) cubetas.set(k, { viajes: 0, comision: 0, recargas: 0 });
  }
  for (const v of viajes) { const c = cubetas.get(clave(v.entregadoEn!)); if (c) { c.viajes++; c.comision += num(v.comision); } }
  for (const x of recargas) { const c = cubetas.get(clave(x.creadoEn)); if (c) c.recargas += num(x.monto); }
  const mes = new Intl.DateTimeFormat("es-SV", { month: "short", year: "2-digit", timeZone: "UTC" });
  return [...cubetas].map(([k, c]) => ({
    clave: k,
    etiqueta: porMes ? mes.format(new Date(`${k}-01T00:00:00Z`)) : fechaLarga(k).replace(/ de \d{4}$| \d{4}$/, ""),
    viajes: c.viajes, comision: r2(c.comision), recargas: r2(c.recargas),
  }));
}

/** Por motorista: viajes entregados, cobrado, comisión, recargas y estrellas recibidas en el periodo. */
export async function porMotorista(p: Periodo) {
  const entregadoEn = { gte: p.inicio, lt: p.fin };
  const [viajes, recargas, estrellas] = await Promise.all([
    db.viaje.groupBy({ by: ["motoristaId"], where: { estado: "ENTREGADO", entregadoEn }, _count: true, _sum: { precioFinal: true, comision: true } }),
    db.recarga.groupBy({ by: ["motoristaId"], where: { creadoEn: { gte: p.inicio, lt: p.fin }, anuladaEn: null }, _count: true, _sum: { monto: true } }),
    db.viaje.groupBy({ by: ["motoristaId"], where: { estado: "ENTREGADO", entregadoEn, estrellasMotorista: { not: null } }, _avg: { estrellasMotorista: true }, _count: true }),
  ]);
  const ids = [...new Set([...viajes, ...recargas].map((x) => x.motoristaId).filter((x): x is string => !!x))];
  const nombres = await db.motorista.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true, saldoCreditos: true } });
  return nombres.map((m) => {
    const v = viajes.find((x) => x.motoristaId === m.id);
    const rc = recargas.find((x) => x.motoristaId === m.id);
    const e = estrellas.find((x) => x.motoristaId === m.id);
    return {
      id: m.id, nombre: m.nombre, saldo: num(m.saldoCreditos),
      viajes: v?._count ?? 0, cobrado: r2(num(v?._sum.precioFinal)), comision: r2(num(v?._sum.comision)),
      recargado: r2(num(rc?._sum.monto)), estrellas: e?._avg.estrellasMotorista ?? null, calificaciones: e?._count ?? 0,
    };
  }).sort((a, b) => b.viajes - a.viajes || b.cobrado - a.cobrado || b.recargado - a.recargado);
}

/** Por punto QR: pedidos hechos en el periodo (y cuántos de esos se entregaron). «Sin QR» = desde el link general. */
export async function porPuntoQr(p: Periodo) {
  const where = { creadoEn: { gte: p.inicio, lt: p.fin } };
  const [todos, entregados, puntos] = await Promise.all([
    db.viaje.groupBy({ by: ["puntoQrId"], where, _count: true }),
    db.viaje.groupBy({ by: ["puntoQrId"], where: { ...where, estado: "ENTREGADO" }, _count: true, _sum: { precioFinal: true } }),
    db.puntoQR.findMany({ select: { id: true, codigo: true, nombre: true } }),
  ]);
  return todos.map((t) => {
    const pq = puntos.find((x) => x.id === t.puntoQrId);
    const e = entregados.find((x) => x.puntoQrId === t.puntoQrId);
    return { id: t.puntoQrId, codigo: pq?.codigo ?? null, nombre: pq?.nombre ?? "Sin QR (link general)", pedidos: t._count, entregados: e?._count ?? 0, cobrado: r2(num(e?._sum.precioFinal)) };
  }).sort((a, b) => b.pedidos - a.pedidos);
}

/** Créditos hoy: lo que los motoristas tienen a favor (aún no gastado en comisión) y lo que deben. */
export async function creditosActuales() {
  const [favor, deuda] = await Promise.all([
    db.motorista.aggregate({ where: { saldoCreditos: { gt: 0 } }, _sum: { saldoCreditos: true }, _count: true }),
    db.motorista.aggregate({ where: { saldoCreditos: { lt: 0 } }, _sum: { saldoCreditos: true }, _count: true }),
  ]);
  return { aFavor: r2(num(favor._sum.saldoCreditos)), conSaldo: favor._count, deuda: r2(-num(deuda._sum.saldoCreditos)), conDeuda: deuda._count };
}
