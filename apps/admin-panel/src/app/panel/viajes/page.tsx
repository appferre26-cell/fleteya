import Link from "next/link";
import type { EstadoViaje, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPropietario } from "@/lib/sesion";
import { ESTADOS_VIAJE, dinero, kg, numeroViaje } from "@/lib/tarifa";
import { fechaHora, formatoTelefono, normalizarTelefono } from "@/lib/validacion";

export const metadata = { title: "Viajes — FleteYa" };

const EN_CURSO: EstadoViaje[] = ["ASIGNADO", "EN_CAMINO", "CARGANDO", "EN_RUTA"];
const FILTROS: { clave: string; nombre: string; estados?: EstadoViaje[] }[] = [
  { clave: "todos", nombre: "Todos" },
  { clave: "buscando", nombre: "Buscando motorista", estados: ["BUSCANDO"] },
  { clave: "curso", nombre: "En curso", estados: EN_CURSO },
  { clave: "entregados", nombre: "Entregados", estados: ["ENTREGADO"] },
  { clave: "cancelados", nombre: "Cancelados", estados: ["CANCELADO"] },
];

export default async function Viajes({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  await exigirPropietario();
  const { f = "todos", q = "" } = await searchParams;
  const filtro = FILTROS.find((x) => x.clave === f) ?? FILTROS[0];
  const busqueda = q.trim().slice(0, 60);

  const where: Prisma.ViajeWhereInput = {};
  if (filtro.estados) where.estado = { in: filtro.estados };
  if (busqueda) {
    const tel = normalizarTelefono(busqueda);
    const num = /^(fy-?)?(\d{1,6})$/i.exec(busqueda)?.[2];
    where.OR = [
      { clienteNombre: { contains: busqueda, mode: "insensitive" } },
      ...(tel.length >= 3 ? [{ clienteTelefono: { contains: tel } }] : []),
      ...(num ? [{ numero: Number(num) }] : []),
    ];
  }

  const [viajes, grupos] = await Promise.all([
    db.viaje.findMany({ where, orderBy: { creadoEn: "desc" }, take: 100, include: { puntoQr: { select: { codigo: true } }, motorista: { select: { nombre: true } } } }),
    db.viaje.groupBy({ by: ["estado"], _count: true }),
  ]);
  const cuenta = (es?: EstadoViaje[]) => grupos.filter((g) => !es || es.includes(g.estado)).reduce((s, g) => s + g._count, 0);
  const url = (clave: string) => `/panel/viajes?f=${clave}${busqueda ? `&q=${encodeURIComponent(busqueda)}` : ""}`;

  return (
    <>
      <h1 className="text-[24px] font-extrabold lg:text-[28px]">Viajes</h1>
      <p className="mt-1 text-sm text-suave">Pedidos hechos por los clientes desde el link o el QR. Los motoristas los aceptan desde su app.</p>

      <section className="tarjeta mt-5 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-borde px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto rounded-lg border border-borde bg-fondo p-1 text-sm">
            {FILTROS.map((x) => (
              <Link key={x.clave} href={url(x.clave)}
                className={`flex h-8 shrink-0 items-center gap-2 rounded-md px-3 ${x.clave === filtro.clave ? "bg-tarjeta-2 font-semibold" : "text-suave"}`}>
                {x.nombre} <span className="text-[11px] text-suave">{cuenta(x.estados)}</span>
              </Link>
            ))}
          </div>
          <form className="relative lg:w-72" action="/panel/viajes">
            <input type="hidden" name="f" value={filtro.clave} />
            <i className="fa-solid fa-magnifying-glass pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-suave" />
            <input name="q" defaultValue={busqueda} placeholder="Cliente, teléfono o FY-0001" aria-label="Buscar viaje"
              className="h-10 w-full rounded-lg border border-borde bg-fondo pr-3 pl-9 text-sm outline-none focus:border-naranja" />
          </form>
        </div>

        {viajes.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <i className="fa-solid fa-route text-2xl text-suave" />
            <p className="mt-3 font-semibold">{busqueda ? "No se encontró ningún viaje" : "No hay viajes en esta lista"}</p>
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
          Mostrando {viajes.length} de {cuenta(filtro.estados)}{viajes.length === 100 ? " (los 100 más recientes)" : ""} · <span className="text-naranja">*</span> más lejos que los km incluidos: el motorista puede ofrecer otro precio.
        </p>
      </section>
    </>
  );
}
