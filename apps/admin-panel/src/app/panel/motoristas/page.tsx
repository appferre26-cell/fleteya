import Link from "next/link";
import type { EstadoMotorista, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPropietario } from "@/lib/sesion";
import { ESTADOS, TIPOS_VEHICULO, TOTAL_DOCS, diasParaVencer, fechaCorta, formatoTelefono, normalizarTelefono } from "@/lib/validacion";
import { Estado, Iniciales } from "./piezas";

export const metadata = { title: "Motoristas — FleteYa" };

const FILTROS: { clave: string; nombre: string; estado?: EstadoMotorista }[] = [
  { clave: "todos", nombre: "Todos" },
  { clave: "activos", nombre: "Activos", estado: "ACTIVO" },
  { clave: "pendientes", nombre: "Pendientes", estado: "PENDIENTE" },
  { clave: "suspendidos", nombre: "Suspendidos", estado: "SUSPENDIDO" },
];

export default async function Motoristas({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  await exigirPropietario();
  const { f = "todos", q = "" } = await searchParams;
  const filtro = FILTROS.find((x) => x.clave === f) ?? FILTROS[0];
  const busqueda = q.trim().slice(0, 60);

  const where: Prisma.MotoristaWhereInput = {};
  if (filtro.estado) where.estado = filtro.estado;
  if (busqueda) {
    const tel = normalizarTelefono(busqueda);
    where.OR = [
      { nombre: { contains: busqueda, mode: "insensitive" } },
      { placa: { contains: busqueda.toUpperCase().replace(/\s+/g, " ") } },
      { dui: { contains: busqueda } },
      ...(tel.length >= 3 ? [{ telefono: { contains: tel } }] : []),
    ];
  }

  const [motoristas, grupos] = await Promise.all([
    db.motorista.findMany({
      where, orderBy: [{ estado: "asc" }, { nombre: "asc" }],
      select: { id: true, nombre: true, telefono: true, placa: true, marca: true, modelo: true, tipoVehiculo: true,
        capacidadTon: true, estado: true, creadoEn: true, licenciaVence: true, autoRegistro: true, accesoPagadoEn: true, accesoAvisadoEn: true, _count: { select: { documentos: true } } },
    }),
    db.motorista.groupBy({ by: ["estado"], _count: true }),
  ]);
  const cuenta = (e?: EstadoMotorista) => (e ? grupos.find((g) => g.estado === e)?._count ?? 0 : grupos.reduce((s, g) => s + g._count, 0));
  const pendientes = cuenta("PENDIENTE");
  const url = (clave: string) => `/panel/motoristas?f=${clave}${busqueda ? `&q=${encodeURIComponent(busqueda)}` : ""}`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] leading-tight font-extrabold lg:text-[28px]">Gestión de motoristas</h1>
          <p className="mt-1 text-sm text-suave">Registra motoristas, revisa sus documentos y controla quién puede recibir viajes.</p>
        </div>
        <Link href="/panel/motoristas/nuevo" className="btn-primario"><i className="fa-solid fa-user-plus" />Agregar motorista</Link>
      </div>

      {pendientes > 0 && filtro.clave !== "pendientes" && (
        <section className="mt-5 flex flex-wrap items-center gap-4 rounded-xl border border-naranja/30 bg-naranja/[0.07] px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-naranja/15"><i className="fa-solid fa-file-circle-check text-naranja" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{pendientes === 1 ? "1 motorista espera aprobación" : `${pendientes} motoristas esperan aprobación`}</p>
            <p className="mt-0.5 text-xs text-suave">Revisa las fotos (DUI, licencia, tarjeta y vehículo) y registra su pago de acceso antes de activarlos.</p>
          </div>
          <Link href={url("pendientes")} className="text-sm font-semibold text-naranja">Ver pendientes <i className="fa-solid fa-arrow-right ml-1 text-xs" /></Link>
        </section>
      )}

      <section className="tarjeta mt-5 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-borde px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto rounded-lg border border-borde bg-fondo p-1 text-sm">
            {FILTROS.map((x) => (
              <Link key={x.clave} href={url(x.clave)}
                className={`flex h-8 shrink-0 items-center gap-2 rounded-md px-3 ${x.clave === filtro.clave ? "bg-tarjeta-2 font-semibold" : "text-suave"}`}>
                {x.nombre} <span className="text-[11px] text-suave">{cuenta(x.estado)}</span>
              </Link>
            ))}
          </div>
          <form className="relative lg:w-72" action="/panel/motoristas">
            <input type="hidden" name="f" value={filtro.clave} />
            <i className="fa-solid fa-magnifying-glass pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-suave" />
            <input name="q" defaultValue={busqueda} placeholder="Nombre, teléfono, placa o DUI" aria-label="Buscar motorista"
              className="h-10 w-full rounded-lg border border-borde bg-fondo pr-3 pl-9 text-sm outline-none focus:border-naranja" />
          </form>
        </div>

        {motoristas.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <i className="fa-solid fa-id-card text-2xl text-suave" />
            <p className="mt-3 font-semibold">{busqueda ? "No se encontró ningún motorista" : "No hay motoristas en esta lista"}</p>
            <p className="mt-1 text-sm text-suave">{busqueda ? "Prueba con otro nombre, teléfono o placa." : "Agrega uno con el botón «Agregar motorista»."}</p>
          </div>
        ) : (
          <>
            {/* Computadora: tabla */}
            <table className="hidden w-full text-sm lg:table">
              <thead>
                <tr className="border-b border-borde text-left text-[11px] tracking-wider text-suave uppercase">
                  <th className="py-3 pl-5 font-semibold">Motorista</th>
                  <th className="py-3 font-semibold">Teléfono</th>
                  <th className="py-3 font-semibold">Vehículo</th>
                  <th className="py-3 font-semibold">Documentos</th>
                  <th className="py-3 font-semibold">Estado</th>
                  <th className="py-3 pr-5 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {motoristas.map((m) => {
                  const venc = diasParaVencer(m.licenciaVence);
                  return (
                    <tr key={m.id} className="hover:bg-[#232323]">
                      <td className="py-3 pl-5">
                        <div className="flex items-center gap-3">
                          <Iniciales nombre={m.nombre} pendiente={m.estado === "PENDIENTE"} />
                          <div><p className="font-semibold">{m.nombre}</p><p className="text-[11px] text-suave">Desde {fechaCorta(m.creadoEn)}{m.autoRegistro ? " · se registró solo" : ""}</p></div>
                        </div>
                      </td>
                      <td className="py-3 text-[#c8c8c8] tabular-nums">{formatoTelefono(m.telefono)}</td>
                      <td className="py-3">
                        <p className="font-medium">{TIPOS_VEHICULO[m.tipoVehiculo].nombre} · {m.capacidadTon.toString()} ton</p>
                        <p className="text-[11px] text-suave">{m.marca} {m.modelo} · {m.placa}</p>
                      </td>
                      <td className="py-3">
                        <p className={m._count.documentos < TOTAL_DOCS ? "font-semibold text-naranja" : ""}>{m._count.documentos}/{TOTAL_DOCS} fotos</p>
                        {m.estado === "PENDIENTE" && (
                          <p className={`text-[11px] ${m.accesoPagadoEn ? "text-exito" : "text-naranja"}`} data-testid="estado-acceso">
                            {m.accesoPagadoEn ? "Acceso pagado" : m.accesoAvisadoEn ? "Avisó su pago" : "Acceso sin pagar"}
                          </p>
                        )}
                        {venc <= 30 && <p className={`text-[11px] ${venc < 0 ? "text-error" : "text-naranja"}`}>{venc < 0 ? "Licencia vencida" : "Licencia vence pronto"}</p>}
                      </td>
                      <td className="py-3"><Estado estado={m.estado} /></td>
                      <td className="py-3 pr-5 text-right">
                        <Link href={`/panel/motoristas/${m.id}`}
                          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold ${m.estado === "PENDIENTE" ? "border-naranja/50 text-naranja" : "border-borde"}`}>
                          <i className={m.estado === "PENDIENTE" ? "fa-solid fa-file-circle-check" : "fa-regular fa-eye text-suave"} />
                          {m.estado === "PENDIENTE" ? "Revisar documentos" : "Ver detalle"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Celular: tarjetas */}
            <ul className="divide-y divide-borde lg:hidden">
              {motoristas.map((m) => (
                <li key={m.id}>
                  <Link href={`/panel/motoristas/${m.id}`} className="flex items-center gap-3 px-4 py-3.5">
                    <Iniciales nombre={m.nombre} pendiente={m.estado === "PENDIENTE"} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{m.nombre}</p>
                      <p className="truncate text-xs text-suave">{TIPOS_VEHICULO[m.tipoVehiculo].nombre} · {m.placa} · {formatoTelefono(m.telefono)}</p>
                    </div>
                    <Estado estado={m.estado} />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="border-t border-borde px-5 py-3 text-xs text-suave">
          Mostrando {motoristas.length} de {cuenta()} motoristas{filtro.estado ? ` · filtro: ${ESTADOS[filtro.estado].nombre.toLowerCase()}` : ""}
        </p>
      </section>
    </>
  );
}
