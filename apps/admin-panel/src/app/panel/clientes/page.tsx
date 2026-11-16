import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPropietario } from "@/lib/sesion";
import { promediosPor } from "@/lib/calificaciones";
import { Promedio } from "@/components/Estrellas";
import { fechaCorta, formatoTelefono, normalizarTelefono } from "@/lib/validacion";

export const metadata = { title: "Clientes — FleteYa" };

const FILTROS = [
  { clave: "todos", nombre: "Todos" },
  { clave: "frecuentes", nombre: "Frecuentes (3+ viajes)" },
  { clave: "bloqueados", nombre: "Bloqueados" },
] as const;

export default async function Clientes({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  await exigirPropietario();
  const { f = "todos", q = "" } = await searchParams;
  const filtro = FILTROS.find((x) => x.clave === f) ?? FILTROS[0];
  const busqueda = q.trim().slice(0, 60);

  const bloqueados = await db.clienteBloqueado.findMany({ select: { telefono: true } });
  const setBloq = new Set(bloqueados.map((b) => b.telefono));

  const where: Prisma.ViajeWhereInput = {};
  if (busqueda) {
    const tel = normalizarTelefono(busqueda);
    where.OR = [{ clienteNombre: { contains: busqueda, mode: "insensitive" } }, ...(tel.length >= 3 ? [{ clienteTelefono: { contains: tel } }] : [])];
  }
  if (filtro.clave === "bloqueados") where.clienteTelefono = { in: [...setBloq] };

  const grupos = await db.viaje.groupBy({
    by: ["clienteTelefono"], where, _count: { _all: true }, _max: { creadoEn: true },
    orderBy: { _max: { creadoEn: "desc" } }, take: 300,
  });
  const tels = grupos.map((g) => g.clienteTelefono);
  const [entregados, nombres, promedios, totalClientes] = await Promise.all([
    db.viaje.groupBy({ by: ["clienteTelefono"], where: { clienteTelefono: { in: tels }, estado: "ENTREGADO" }, _count: { _all: true }, _sum: { precioFinal: true } }),
    db.viaje.findMany({ where: { clienteTelefono: { in: tels } }, distinct: ["clienteTelefono"], orderBy: { creadoEn: "desc" }, select: { clienteTelefono: true, clienteNombre: true } }),
    promediosPor("clienteTelefono", tels),
    db.viaje.groupBy({ by: ["clienteTelefono"], _count: { _all: true } }).then((g) => g.length),
  ]);
  const ent = new Map(entregados.map((e) => [e.clienteTelefono, { n: e._count._all, gastado: Number(e._sum.precioFinal ?? 0) }]));
  const nom = new Map(nombres.map((n) => [n.clienteTelefono, n.clienteNombre]));
  let filas = grupos.map((g) => ({
    telefono: g.clienteTelefono, nombre: nom.get(g.clienteTelefono) ?? "", pedidos: g._count._all, ultimo: g._max.creadoEn!,
    entregados: ent.get(g.clienteTelefono)?.n ?? 0, gastado: ent.get(g.clienteTelefono)?.gastado ?? 0,
    calif: promedios.get(g.clienteTelefono) ?? { promedio: null, total: 0 }, bloqueado: setBloq.has(g.clienteTelefono),
  }));
  if (filtro.clave === "frecuentes") filas = filas.filter((x) => x.entregados >= 3);
  filas = filas.slice(0, 100);
  const url = (clave: string) => `/panel/clientes?f=${clave}${busqueda ? `&q=${encodeURIComponent(busqueda)}` : ""}`;

  return (
    <>
      <h1 className="text-[24px] font-extrabold lg:text-[28px]">Clientes</h1>
      <p className="mt-1 text-sm text-suave">Los clientes no tienen cuenta: se agrupan por su número de celular. {totalClientes} {totalClientes === 1 ? "cliente" : "clientes"} en total · {setBloq.size} {setBloq.size === 1 ? "bloqueado" : "bloqueados"}.</p>

      <section className="tarjeta mt-5 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-borde px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto rounded-lg border border-borde bg-fondo p-1 text-sm">
            {FILTROS.map((x) => (
              <Link key={x.clave} href={url(x.clave)} className={`flex h-8 shrink-0 items-center rounded-md px-3 ${x.clave === filtro.clave ? "bg-tarjeta-2 font-semibold" : "text-suave"}`}>{x.nombre}</Link>
            ))}
          </div>
          <form className="relative lg:w-72" action="/panel/clientes">
            <input type="hidden" name="f" value={filtro.clave} />
            <i className="fa-solid fa-magnifying-glass pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-suave" />
            <input name="q" defaultValue={busqueda} placeholder="Nombre o celular" aria-label="Buscar cliente"
              className="h-10 w-full rounded-lg border border-borde bg-fondo pr-3 pl-9 text-sm outline-none focus:border-naranja" />
          </form>
        </div>

        {filas.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <i className="fa-solid fa-users text-2xl text-suave" />
            <p className="mt-3 font-semibold">{busqueda ? "No se encontró ningún cliente" : filtro.clave === "bloqueados" ? "No hay clientes bloqueados" : "Todavía no hay clientes en esta lista"}</p>
          </div>
        ) : (
          <ul className="divide-y divide-borde">
            {filas.map((c) => (
              <li key={c.telefono} data-testid="fila-cliente">
                <Link href={`/panel/clientes/${c.telefono}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 hover:bg-[#232323] sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.nombre} <span className="font-normal text-suave">· {formatoTelefono(c.telefono)}</span>
                      {c.bloqueado && <span className="ml-2 rounded-full bg-error/15 px-2 py-0.5 text-[10px] font-bold text-error">Bloqueado</span>}</p>
                    <p className="text-xs text-suave">Último pedido {fechaCorta(c.ultimo)} · <Promedio {...c.calif} corto /></p>
                  </div>
                  <div className="text-right text-xs text-suave">
                    <p className="text-sm font-bold text-texto tabular-nums">{c.entregados} {c.entregados === 1 ? "viaje" : "viajes"}</p>
                    <p>{c.pedidos} {c.pedidos === 1 ? "pedido" : "pedidos"}{c.gastado ? ` · $${c.gastado.toFixed(2)}` : ""}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-borde px-5 py-3 text-xs text-suave">Mostrando {filas.length}{filas.length === 100 ? " (los 100 más recientes)" : ""} · «viajes» = entregados; «pedidos» incluye cancelados.</p>
      </section>
    </>
  );
}
