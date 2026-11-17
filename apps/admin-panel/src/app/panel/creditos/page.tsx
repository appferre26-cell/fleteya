import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { obtenerConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { CONCEPTOS, FORMAS_PAGO, leerNumeroRecibo, numeroRecibo } from "@/lib/recibo";
import { exigirPropietario } from "@/lib/sesion";
import { dinero } from "@/lib/tarifa";
import { fechaHora, normalizarTelefono } from "@/lib/validacion";
import { Iniciales } from "../motoristas/piezas";
import { FormRecarga } from "./FormRecarga";

export const metadata = { title: "Créditos y recargas — FleteYa" };

const SALDO_BAJO = 5;
// El Salvador está siempre en UTC-6 (sin horario de verano).
function inicioMesYSemana() {
  const ahora = new Date(Date.now() - 6 * 3600_000);
  const mes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1, 6));
  const dia = (ahora.getUTCDay() + 6) % 7; // lunes = 0
  const semana = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() - dia, 6));
  return { mes, semana };
}

export default async function Creditos({ searchParams }: { searchParams: Promise<{ m?: string; q?: string }> }) {
  await exigirPropietario();
  const { m: inicial, q = "" } = await searchParams;
  const busqueda = q.trim().slice(0, 60);
  const cfg = await obtenerConfig();
  const { mes, semana } = inicioMesYSemana();

  const where: Prisma.RecargaWhereInput = {};
  if (busqueda) {
    const n = leerNumeroRecibo(busqueda);
    const tel = normalizarTelefono(busqueda);
    where.OR = [
      { motorista: { nombre: { contains: busqueda, mode: "insensitive" } } },
      { referencia: { contains: busqueda.replace(/\s+/g, "").toUpperCase() } },
      ...(tel.length >= 4 ? [{ motorista: { telefono: { contains: tel } } }] : []),
      ...(n ? [{ numero: n }] : []),
    ];
  }

  const [motoristas, recargas, delMes, comisionSemana, ultimas] = await Promise.all([
    db.motorista.findMany({ orderBy: [{ saldoCreditos: "asc" }, { nombre: "asc" }], select: { id: true, nombre: true, telefono: true, saldoCreditos: true, estado: true } }),
    db.recarga.findMany({ where, orderBy: { numero: "desc" }, take: 50, include: { motorista: { select: { nombre: true, correo: true } } } }),
    db.recarga.groupBy({ by: ["concepto"], where: { creadoEn: { gte: mes }, anuladaEn: null }, _sum: { monto: true }, _count: true }),
    db.movimientoCredito.aggregate({ where: { tipo: "COMISION", creadoEn: { gte: semana } }, _sum: { monto: true } }),
    db.recarga.findMany({ where: { anuladaEn: null, concepto: "RECARGA" }, orderBy: { numero: "desc" }, distinct: ["motoristaId"], select: { motoristaId: true, creadoEn: true, monto: true } }),
  ]);
  const ultimaDe = new Map(ultimas.map((x) => [x.motoristaId, x]));
  const delConcepto = (c: "RECARGA" | "ACCESO") => delMes.find((g) => g.concepto === c);
  const totalMes = Number(delConcepto("RECARGA")?._sum.monto ?? 0);
  const accesoMes = delConcepto("ACCESO");
  const activos = motoristas.filter((m) => m.estado === "ACTIVO");
  const bajos = activos.filter((m) => Number(m.saldoCreditos) > 0 && Number(m.saldoCreditos) < SALDO_BAJO).length;
  const sinSaldo = activos.filter((m) => Number(m.saldoCreditos) <= 0).length;
  const faltanDatos = !cfg.emisorNombre || !cfg.emisorNit || !cfg.emisorDireccion;

  const tarjeta = (titulo: string, valor: string, pie: string, icono: string, color: string, testid: string) => (
    <div className="tarjeta p-4 lg:p-5" data-testid={testid}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-suave">{titulo}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}><i className={`fa-solid ${icono} text-sm`} /></span>
      </div>
      <p className="mt-2 text-2xl font-extrabold tabular-nums lg:text-3xl" data-testid={`${testid}-valor`}>{valor}</p>
      <p className="mt-1 text-xs text-suave">{pie}</p>
    </div>
  );
  const estadoSaldo = (m: (typeof motoristas)[number]) => {
    const s = Number(m.saldoCreditos);
    if (m.estado !== "ACTIVO") return <span className="rounded-full bg-tarjeta-2 px-2 py-0.5 text-[11px] font-semibold text-suave">{m.estado === "PENDIENTE" ? "Pendiente" : "Suspendido"}</span>;
    if (s <= 0) return <span className="rounded-full bg-error/15 px-2 py-0.5 text-[11px] font-semibold text-error">Sin saldo</span>;
    if (s < SALDO_BAJO) return <span className="rounded-full bg-naranja/15 px-2 py-0.5 text-[11px] font-semibold text-naranja">Saldo bajo</span>;
    return <span className="rounded-full bg-exito/15 px-2 py-0.5 text-[11px] font-semibold text-exito">Activo</span>;
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold lg:text-[28px]">Créditos y recargas</h1>
          <p className="mt-1 text-sm text-suave">Saldo de cada motorista, registro de recargas (efectivo o transferencia) y recibos.</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto [&>a]:flex-1 sm:[&>a]:flex-none">
          <Link href="/panel/creditos/datos" className="btn-secundario h-10"><i className="fa-solid fa-gear text-suave" />Datos y precios</Link>
          <a href="/api/recargas" className="btn-secundario h-10" data-testid="exportar"><i className="fa-solid fa-file-csv text-suave" />Exportar</a>
        </div>
      </div>

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {tarjeta("Recargas este mes", dinero(totalMes), `${delConcepto("RECARGA")?._count ?? 0} recargas · accesos: ${accesoMes?._count ?? 0} (${dinero(Number(accesoMes?._sum.monto ?? 0))})`, "fa-coins", "bg-naranja/15 text-naranja", "recargas-mes")}
        {tarjeta("Comisión descontada (semana)", dinero(-Number(comisionSemana._sum.monto ?? 0)), `${cfg.comisionPct}% de cada viaje completado`, "fa-percent", "bg-exito/15 text-exito", "comision-semana")}
        {tarjeta("Saldo bajo", String(bajos), `Menos de ${dinero(SALDO_BAJO)} en créditos`, "fa-battery-quarter", "bg-naranja/15 text-naranja", "saldo-bajo")}
        {tarjeta("Sin saldo", String(sinSaldo), "No reciben viajes hasta recargar", "fa-lock", "bg-error/15 text-error", "sin-saldo")}
      </section>

      <div className="mt-5">
        <FormRecarga key={inicial ?? ""} inicial={inicial} faltanDatos={faltanDatos}
          motoristas={motoristas.filter((m) => m.estado !== "SUSPENDIDO" || m.id === inicial).map((m) => ({ id: m.id, nombre: m.nombre, telefono: m.telefono, saldo: Number(m.saldoCreditos), estado: m.estado }))} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <section className="tarjeta overflow-hidden">
          <h2 className="border-b border-borde px-5 py-4 font-bold">Saldo por motorista <span className="text-xs font-normal text-suave">· {motoristas.length}, los de menos saldo primero</span></h2>
          {motoristas.length === 0 ? <p className="px-5 py-10 text-center text-sm text-suave">Aún no hay motoristas.</p> : (
            <ul className="max-h-[36rem] divide-y divide-borde overflow-y-auto">
              {motoristas.map((m) => {
                const s = Number(m.saldoCreditos);
                const ult = ultimaDe.get(m.id);
                return (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-3 sm:px-5" data-testid="fila-saldo">
                    <Iniciales nombre={m.nombre} pendiente={m.estado === "PENDIENTE"} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/panel/motoristas/${m.id}`} className="block truncate text-sm font-semibold hover:text-naranja">{m.nombre}</Link>
                      <p className="text-xs text-suave">{ult ? `Última recarga ${dinero(Number(ult.monto))} · ${fechaHora(ult.creadoEn)}` : "Sin recargas"}</p>
                    </div>
                    <span className={`text-sm font-bold tabular-nums ${s <= 0 ? "text-error" : ""}`}>{dinero(s)}</span>
                    <span className="hidden sm:block">{estadoSaldo(m)}</span>
                    {m.estado !== "SUSPENDIDO" && (
                      <Link href={`/panel/creditos?m=${m.id}#registrar`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-borde text-naranja hover:border-naranja" title={`Recargar a ${m.nombre}`} aria-label={`Recargar a ${m.nombre}`}>
                        <i className="fa-solid fa-plus text-xs" />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="tarjeta overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-borde px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <h2 className="font-bold">Últimas recargas y recibos</h2>
            <form className="relative sm:w-64" action="/panel/creditos">
              <i className="fa-solid fa-magnifying-glass pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-suave" />
              <input name="q" defaultValue={busqueda} placeholder="Motorista, REC-000123 o referencia" aria-label="Buscar recarga"
                className="h-10 w-full rounded-lg border border-borde bg-fondo pr-3 pl-9 text-sm outline-none focus:border-naranja" />
            </form>
          </div>
          {recargas.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <i className="fa-solid fa-receipt text-2xl text-suave" />
              <p className="mt-3 font-semibold">{busqueda ? "No se encontró ninguna recarga" : "Aún no hay recargas"}</p>
              <p className="mt-1 text-sm text-suave">Cuando registres una, su recibo aparece aquí.</p>
            </div>
          ) : (
            <ul className="divide-y divide-borde">
              {recargas.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5" data-testid="fila-recarga">
                  <div className="w-28 shrink-0">
                    <p className={`font-mono text-sm font-bold ${r.anuladaEn ? "text-suave line-through" : ""}`}>{numeroRecibo(r.numero)}</p>
                    <p className="text-[11px] text-suave">{fechaHora(r.creadoEn)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.motorista.nombre}</p>
                    <p className="truncate text-xs text-suave">{r.concepto === "ACCESO" ? <span className="font-semibold text-naranja">{CONCEPTOS.ACCESO}</span> : CONCEPTOS.RECARGA} · {FORMAS_PAGO[r.formaPago]}{r.referencia ? ` · ${r.referencia}` : ""}</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums">{dinero(Number(r.monto))}</span>
                  {r.anuladaEn && <span className="rounded-full bg-error/15 px-2 py-0.5 text-[11px] font-semibold text-error">Anulada</span>}
                  <div className="flex gap-1.5">
                    <Link href={`/panel/creditos/recibo/${r.numero}`} className="btn-secundario h-8 px-3 text-xs"><i className="fa-solid fa-receipt text-suave" />Recibo</Link>
                    <a href={`/api/recibos/${r.numero}?descargar=1`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-borde text-naranja hover:border-naranja" title="Descargar PDF" aria-label={`Descargar PDF de ${numeroRecibo(r.numero)}`}><i className="fa-solid fa-file-pdf text-xs" /></a>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-borde px-5 py-3 text-xs text-suave"><i className="fa-regular fa-envelope mr-1.5" />Si el motorista tiene correo, el recibo también le llega por correo (cuando el envío está configurado).</p>
        </section>
      </div>
    </>
  );
}
