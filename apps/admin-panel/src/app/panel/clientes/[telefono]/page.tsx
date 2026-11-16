import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { exigirPropietario } from "@/lib/sesion";
import { promedioCliente } from "@/lib/calificaciones";
import { EstrellasFijas, Promedio } from "@/components/Estrellas";
import { ESTADOS_VIAJE, dinero, numeroViaje } from "@/lib/tarifa";
import { fechaCorta, fechaHora, formatoTelefono } from "@/lib/validacion";
import { BloqueoCliente } from "./BloqueoCliente";

export const metadata = { title: "Cliente — FleteYa" };

export default async function DetalleCliente({ params }: { params: Promise<{ telefono: string }> }) {
  await exigirPropietario();
  const { telefono } = await params;
  if (!/^\d{8}$/.test(telefono)) notFound();

  const [viajes, bloqueo, calif] = await Promise.all([
    db.viaje.findMany({
      where: { clienteTelefono: telefono }, orderBy: { creadoEn: "desc" }, take: 200,
      select: {
        id: true, numero: true, clienteNombre: true, estado: true, creadoEn: true, origenDireccion: true, destinoDireccion: true,
        precioBase: true, precioFinal: true, estrellasCliente: true, comentarioCliente: true, clienteCalificadoEn: true,
        motorista: { select: { nombre: true } },
      },
    }),
    db.clienteBloqueado.findUnique({ where: { telefono }, include: { bloqueadoPor: { select: { nombre: true } } } }),
    promedioCliente(telefono),
  ]);
  if (viajes.length === 0 && !bloqueo) notFound();

  const entregados = viajes.filter((v) => v.estado === "ENTREGADO");
  const cancelados = viajes.filter((v) => v.estado === "CANCELADO").length;
  const gastado = entregados.reduce((s, v) => s + Number(v.precioFinal ?? 0), 0);
  const nombre = viajes[0]?.clienteNombre ?? "Cliente sin pedidos";
  const opiniones = viajes.filter((v) => v.estrellasCliente).slice(0, 6);
  const dato = (t: string, v: React.ReactNode, testid?: string) => (
    <div data-testid={testid}><dt className="text-xs text-suave">{t}</dt><dd className="mt-0.5 font-semibold tabular-nums">{v}</dd></div>
  );

  return (
    <>
      <Link href="/panel/clientes" className="text-xs text-suave hover:text-texto"><i className="fa-solid fa-arrow-left mr-1.5" />Clientes</Link>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div className="min-w-[12rem] flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[24px] leading-tight font-extrabold lg:text-[28px]">{nombre}</h1>
            <span data-testid="estado-bloqueo" className={`rounded-full px-2.5 py-1 text-xs font-bold ${bloqueo ? "bg-error/15 text-error" : "bg-exito/15 text-exito"}`}>
              {bloqueo ? "Bloqueado" : "Puede pedir"}
            </span>
          </div>
          <p className="mt-1 text-sm text-suave tabular-nums">{formatoTelefono(telefono)}{viajes.length > 0 && ` · cliente desde ${fechaCorta(viajes[viajes.length - 1].creadoEn)}`}</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto [&>a]:flex-1 sm:[&>a]:flex-none">
          <a href={`tel:+503${telefono}`} className="btn-secundario h-10"><i className="fa-solid fa-phone text-suave" />Llamar</a>
          <a href={`https://wa.me/503${telefono}`} target="_blank" rel="noopener noreferrer" className="btn-secundario h-10"><i className="fa-brands fa-whatsapp text-exito" />WhatsApp</a>
        </div>
      </div>

      {bloqueo && (
        <p className="mt-4 rounded-lg bg-error/10 px-4 py-3 text-sm text-error" data-testid="motivo-bloqueo">
          <i className="fa-solid fa-ban mr-2" />Bloqueado el {fechaHora(bloqueo.creadoEn)} por {bloqueo.bloqueadoPor.nombre}: <span className="text-texto">{bloqueo.motivo}</span>
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <section className="tarjeta p-5">
            <h2 className="seccion-titulo">Resumen</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              {dato("Pedidos", viajes.length, "total-pedidos")}
              {dato("Entregados", entregados.length, "total-entregados")}
              {dato("Cancelados", cancelados)}
              {dato("Total gastado", dinero(gastado), "total-gastado")}
              {viajes.length > 0 && dato("Último pedido", fechaCorta(viajes[0].creadoEn))}
              {dato("Calificación (de motoristas)", <Promedio {...calif} testid="calificacion-cliente" />)}
            </dl>
          </section>

          <section className="tarjeta overflow-hidden">
            <h2 className="seccion-titulo px-5 pt-5">Pedidos</h2>
            {viajes.length === 0 ? <p className="px-5 py-6 text-sm text-suave">No tiene pedidos.</p> : (
              <ul className="mt-3 divide-y divide-borde">
                {viajes.map((v) => {
                  const e = ESTADOS_VIAJE[v.estado];
                  return (
                    <li key={v.id} data-testid="viaje-cliente">
                      <Link href={`/panel/viajes/${v.id}`} className="flex items-center gap-x-4 px-5 py-3 hover:bg-[#232323]">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{numeroViaje(v.numero)} <span className={`ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${e.clase}`}>{e.nombre}</span></p>
                          <p className="truncate text-xs text-suave">{v.origenDireccion} → {v.destinoDireccion}</p>
                          {v.motorista && <p className="truncate text-xs text-suave"><i className="fa-solid fa-truck mr-1" />{v.motorista.nombre}</p>}
                        </div>
                        <div className="shrink-0 text-right text-xs text-suave">
                          <p className="text-sm font-bold text-texto tabular-nums">{dinero(Number(v.precioFinal ?? v.precioBase))}</p>
                          <p>{fechaCorta(v.creadoEn)}</p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-4">
          <BloqueoCliente telefono={telefono} bloqueado={!!bloqueo} />
          <section className="tarjeta p-5 text-sm" data-testid="opiniones-cliente">
            <h2 className="font-bold">Lo que dicen los motoristas</h2>
            {opiniones.length === 0 ? <p className="mt-2 text-suave">Todavía no hay calificaciones.</p> : (
              <ul className="mt-3 space-y-3">
                {opiniones.map((o) => (
                  <li key={o.id}>
                    <EstrellasFijas n={o.estrellasCliente!} />
                    {o.comentarioCliente && <p className="mt-0.5 text-suave">«{o.comentarioCliente}»</p>}
                    <p className="text-[11px] text-suave">{numeroViaje(o.numero)}{o.motorista ? ` · ${o.motorista.nombre}` : ""}{o.clienteCalificadoEn ? ` · ${fechaCorta(o.clienteCalificadoEn)}` : ""}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
