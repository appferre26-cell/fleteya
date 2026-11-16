import Link from "next/link";
import type { EstadoViaje } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPropietario } from "@/lib/sesion";
import { leerFiltros, FILTROS_ESTADO, type ParamsViajes } from "@/lib/filtro-viajes";
import { ESTADOS_VIAJE, dinero, kg, numeroViaje } from "@/lib/tarifa";
import { fechaHora, formatoTelefono } from "@/lib/validacion";

export const metadata = { title: "Viajes — FleteYa" };

export default async function Viajes({ searchParams }: { searchParams: Promise<ParamsViajes> }) {
  await exigirPropietario();
  const { estado: filtro, base, where, valores, query, hayFiltros } = leerFiltros(await searchParams);
  const busqueda = valores.q;

  const [viajes, grupos, motoristas, puntos, totales] = await Promise.all([
    db.viaje.findMany({ where, orderBy: { creadoEn: "desc" }, take: 100, include: { puntoQr: { select: { codigo: true } }, motorista: { select: { nombre: true } } } }),
    db.viaje.groupBy({ by: ["estado"], where: base, _count: true }),
    db.motorista.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true, estado: true } }),
    db.puntoQR.findMany({ orderBy: { codigo: "asc" }, select: { id: true, codigo: true, nombre: true } }),
    db.viaje.aggregate({ where: { AND: [where, { estado: "ENTREGADO" }] }, _count: true, _sum: { precioFinal: true, comision: true } }),
  ]);
  const cuenta = (es?: EstadoViaje[]) => grupos.filter((g) => !es || es.includes(g.estado)).reduce((s, g) => s + g._count, 0);
  const url = (clave: string) => `/panel/viajes${query({ f: clave })}`;

  return (
    <>
      <h1 className="text-[24px] font-extrabold lg:text-[28px]">Viajes</h1>
      <p className="mt-1 text-sm text-suave">Pedidos hechos por los clientes desde el link o el QR. Los motoristas los aceptan desde su app.</p>

      <section className="tarjeta mt-5 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-borde px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto rounded-lg border border-borde bg-fondo p-1 text-sm">
            {FILTROS_ESTADO.map((x) => (
              <Link key={x.clave} href={url(x.clave)}
                className={`flex h-8 shrink-0 items-center gap-2 rounded-md px-3 ${x.clave === filtro.clave ? "bg-tarjeta-2 font-semibold" : "text-suave"}`}>
                {x.nombre} <span className="text-[11px] text-suave">{cuenta(x.estados)}</span>
              </Link>
            ))}
          </div>
          <a href={`/api/viajes${query()}`} className="btn-secundario h-10 shrink-0" data-testid="exportar-viajes">
            <i className="fa-solid fa-file-excel text-exito" />Exportar a Excel
          </a>
        </div>

        <form action="/panel/viajes" className="grid grid-cols-2 gap-3 border-b border-borde px-4 py-4 sm:px-5 lg:grid-cols-[1fr_1fr_1.3fr_1.3fr_1.5fr_auto]" data-testid="filtros-viajes">
          {filtro.clave !== "todos" && <input type="hidden" name="f" value={filtro.clave} />}
          <label className="text-xs"><span className="etiqueta">Desde</span>
            <input type="date" name="desde" defaultValue={valores.desde} className="campo h-10" aria-label="Desde" /></label>
          <label className="text-xs"><span className="etiqueta">Hasta</span>
            <input type="date" name="hasta" defaultValue={valores.hasta} className="campo h-10" aria-label="Hasta" /></label>
          <label className="text-xs"><span className="etiqueta">Motorista</span>
            <select name="m" defaultValue={valores.m} className="campo h-10" aria-label="Motorista">
              <option value="">Todos</option>
              {motoristas.map((x) => <option key={x.id} value={x.id}>{x.nombre}{x.estado !== "ACTIVO" ? ` (${x.estado === "PENDIENTE" ? "pendiente" : "suspendido"})` : ""}</option>)}
            </select></label>
          <label className="text-xs"><span className="etiqueta">Punto QR</span>
            <select name="p" defaultValue={valores.p} className="campo h-10" aria-label="Punto QR">
              <option value="">Todos (con y sin QR)</option>
              {puntos.map((x) => <option key={x.id} value={x.id}>{x.codigo} · {x.nombre}</option>)}
            </select></label>
          <label className="col-span-2 text-xs lg:col-span-1"><span className="etiqueta">Buscar</span>
            <input name="q" defaultValue={busqueda} placeholder="Cliente, teléfono o FY-0001" aria-label="Buscar viaje" className="campo h-10" /></label>
          <div className="col-span-2 flex items-end gap-2 lg:col-span-1">
            <button type="submit" className="btn-primario h-10 flex-1 lg:flex-none"><i className="fa-solid fa-filter" />Filtrar</button>
            {hayFiltros && <Link href={filtro.clave === "todos" ? "/panel/viajes" : `/panel/viajes?f=${filtro.clave}`} className="btn-secundario h-10">Quitar</Link>}
          </div>
        </form>

        {viajes.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <i className="fa-solid fa-route text-2xl text-suave" />
            <p className="mt-3 font-semibold">{hayFiltros ? "No se encontró ningún viaje con estos filtros" : "No hay viajes en esta lista"}</p>
            <p className="mt-1 text-sm text-suave">Cuando un cliente pida un flete desde /pedir, aparecerá aquí.</p>
          </div>
        ) : (
          <ul className="divide-y divide-borde">
            {viajes.map((v) => {
              const e = ESTADOS_VIAJE[v.estado];
              return (
                <li key={v.id} data-testid="fila-viaje">
                  <Link href={`/panel/viajes/${v.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 hover:bg-[#232323] sm:px-5">
                    <div className="w-24 shrink-0">
                      <p className="font-mono text-sm font-bold">{numeroViaje(v.numero)}</p>
                      <p className="text-[11px] text-suave">{fechaHora(v.creadoEn)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{v.clienteNombre} <span className="font-normal text-suave">· {formatoTelefono(v.clienteTelefono)}</span></p>
                      <p className="truncate text-xs text-suave">
                        {v.puntoQr && <span className="mr-1 rounded bg-naranja/15 px-1 font-mono text-[10px] font-bold text-naranja">{v.puntoQr.codigo}</span>}
                        {v.origenDireccion} → {v.destinoDireccion}
                      </p>
                      {v.motorista && <p className="truncate text-xs"><i className="fa-solid fa-truck mr-1 text-[10px] text-suave" />{v.motorista.nombre}</p>}
                    </div>
                    <div className="text-right text-xs text-suave">
                      <p className="text-sm font-bold text-texto">{dinero(Number(v.precioFinal ?? v.precioBase))}{v.fueraDeRango && <span className="ml-1 text-naranja" title="Fuera de los km incluidos">*</span>}</p>
                      <p>{kg(Number(v.pesoKg))} · {Number(v.distanciaKm).toFixed(1)} km</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${e.clase}`}>{e.nombre}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <p className="border-t border-borde px-5 py-3 text-xs text-suave">
          Mostrando {viajes.length} de {cuenta(filtro.estados)}{viajes.length === 100 ? " (los 100 más recientes; «Exportar a Excel» los trae todos)" : ""} ·{" "}
          <span data-testid="totales-viajes">Entregados: {totales._count} · cobrado {dinero(Number(totales._sum.precioFinal ?? 0))} · comisión {dinero(Number(totales._sum.comision ?? 0))}</span> · <span className="text-naranja">*</span> más lejos que los km incluidos: el motorista puede ofrecer otro precio.
        </p>
      </section>
    </>
  );
}
