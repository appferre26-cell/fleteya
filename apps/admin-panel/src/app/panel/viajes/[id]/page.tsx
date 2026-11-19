import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { exigirPropietario } from "@/lib/sesion";
import { textoRango } from "@/lib/rangos";
import { ESTADOS_VIAJE, dinero, kg, numeroViaje } from "@/lib/tarifa";
import { fechaHora, formatoTelefono } from "@/lib/validacion";
import { CancelarViaje } from "./CancelarViaje";
import { EstrellasFijas } from "@/components/Estrellas";

export const metadata = { title: "Detalle del viaje — FleteYa" };

const ESTADO_OFERTA = { PENDIENTE: "esperando al cliente", ACEPTADA: "aceptada", RECHAZADA: "no aceptada", RETIRADA: "retirada" } as const;
const TIEMPOS = [["asignadoEn", "Aceptado"], ["enCaminoEn", "En camino"], ["cargandoEn", "Cargando"], ["enRutaEn", "En ruta"], ["entregadoEn", "Entregado"]] as const;

export default async function DetalleViaje({ params }: { params: Promise<{ id: string }> }) {
  await exigirPropietario();
  const { id } = await params;
  const v = await db.viaje.findUnique({ where: { id }, include: {
    items: true, puntoQr: true,
    motorista: { select: { id: true, nombre: true, telefono: true, placa: true } },
    ofertas: { orderBy: { creadaEn: "desc" }, include: { motorista: { select: { nombre: true } } } },
  } });
  if (!v) notFound();
  const e = ESTADOS_VIAJE[v.estado];
  const activo = v.estado !== "CANCELADO" && v.estado !== "ENTREGADO";
  const mapa = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;

  return (
    <>
      <Link href="/panel/viajes" className="text-sm text-suave"><i className="fa-solid fa-arrow-left mr-1.5" />Viajes</Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-[24px] font-extrabold lg:text-[28px]">{numeroViaje(v.numero)}</h1>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${e.clase}`} data-testid="estado-viaje">{e.nombre}</span>
      </div>
      <p className="mt-1 text-sm text-suave">Pedido el {fechaHora(v.creadoEn)}{v.puntoQr ? ` desde el QR ${v.puntoQr.codigo} (${v.puntoQr.nombre})` : " desde el link general"}.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="tarjeta divide-y divide-borde">
          <div className="space-y-3 p-5 text-sm">
            <div><p className="text-[11px] text-suave">Recogida</p><p className="font-medium">{v.origenDireccion}</p>
              <a href={mapa(v.origenLat, v.origenLng)} target="_blank" rel="noreferrer" className="text-xs text-naranja">Ver en el mapa</a></div>
            <div><p className="text-[11px] text-suave">Destino · {Number(v.distanciaKm).toFixed(1)} km en línea recta</p><p className="font-medium">{v.destinoDireccion}</p>
              <a href={mapa(v.destinoLat, v.destinoLng)} target="_blank" rel="noreferrer" className="text-xs text-naranja">Ver en el mapa</a></div>
          </div>
          <ul className="p-5 text-sm">
            {v.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3 py-1">
                <span>{Number(i.cantidad)} × {i.nombre} <span className="text-xs text-suave">({i.unidad}, {kg(Number(i.pesoUnitKg))} c/u{i.materialId ? "" : ", peso escrito por el cliente"})</span></span>
                <span className="text-suave tabular-nums">{kg(Number(i.pesoTotalKg))}</span>
              </li>
            ))}
            {v.rangoTon && <li className="flex justify-between gap-3 py-1" data-testid="rango-viaje"><span>Pedido rápido por toneladas</span><span className="font-semibold">{textoRango(v.rangoTon, Number(v.pesoKg))}</span></li>}
            <li className="mt-1 flex justify-between border-t border-borde pt-2 font-semibold"><span>{v.rangoTon ? "Peso que se cobra" : "Peso estimado"}</span><span>{kg(Number(v.pesoKg))}</span></li>
          </ul>
          {v.nota && <p className="p-5 text-sm"><span className="text-suave">Nota del cliente: </span>{v.nota}</p>}
          <div className="flex items-center justify-between p-5">
            <span className="text-sm">Precio por peso · efectivo</span>
            <span className={`text-xl font-extrabold ${v.precioFinal && Number(v.precioFinal) !== Number(v.precioBase) ? "text-suave line-through" : "text-naranja"}`}>{dinero(Number(v.precioBase))}</span>
          </div>
          {v.precioFinal && Number(v.precioFinal) !== Number(v.precioBase) && (
            <div className="flex items-center justify-between p-5"><span className="text-sm">Precio acordado (contrapropuesta del motorista)</span><span className="text-xl font-extrabold text-naranja" data-testid="precio-final">{dinero(Number(v.precioFinal))}</span></div>
          )}
          {v.comision && (
            <div className="flex items-center justify-between p-5 text-sm"><span>Comisión descontada de los créditos del motorista</span><span className="font-bold" data-testid="comision">{dinero(Number(v.comision))}</span></div>
          )}
          {v.fueraDeRango && <p className="p-5 text-xs text-suave"><i className="fa-solid fa-route mr-1.5 text-naranja" />Más lejos que los km incluidos: el precio ya incluye el cobro automático por los km extra.</p>}
          {v.ofertas.length > 0 && (
            <div className="p-5 text-sm">
              <p className="seccion-titulo mb-2">Ofertas de precio</p>
              <ul className="space-y-1">
                {v.ofertas.map((o) => (
                  <li key={o.id} className="flex justify-between gap-3"><span>{o.motorista.nombre} · {fechaHora(o.creadaEn)}</span><span><b>{dinero(Number(o.precio))}</b> <span className="text-xs text-suave">{ESTADO_OFERTA[o.estado]}</span></span></li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="tarjeta p-5 text-sm">
            <h2 className="font-bold">Cliente</h2>
            <p className="mt-2 font-medium">{v.clienteNombre}</p>
            <p className="text-suave">{formatoTelefono(v.clienteTelefono)}</p>
            <div className="mt-3 flex gap-2">
              <a href={`tel:+503${v.clienteTelefono}`} className="btn-secundario h-9 flex-1 text-xs"><i className="fa-solid fa-phone text-suave" />Llamar</a>
              <a href={`https://wa.me/503${v.clienteTelefono}`} target="_blank" rel="noreferrer" className="btn-secundario h-9 flex-1 text-xs"><i className="fa-brands fa-whatsapp text-suave" />WhatsApp</a>
            </div>
            <Link href={`/panel/clientes/${v.clienteTelefono}`} className="mt-2 inline-block text-xs text-naranja" data-testid="ver-cliente">Historial del cliente <i className="fa-solid fa-arrow-right ml-1" /></Link>
            <p className="mt-3 text-[11px] text-suave">Aceptó términos y privacidad el {fechaHora(v.aceptoTerminosEn)}.</p>
            <a href={`/viaje/${v.codigo}`} target="_blank" className="mt-2 inline-block text-xs text-naranja">Ver lo que ve el cliente <i className="fa-solid fa-arrow-up-right-from-square ml-1" /></a>
          </section>
          <section className="tarjeta p-5 text-sm" data-testid="motorista-viaje">
            <h2 className="font-bold">Motorista</h2>
            {v.motorista ? (
              <>
                <Link href={`/panel/motoristas/${v.motorista.id}`} className="mt-2 block font-medium text-naranja">{v.motorista.nombre}</Link>
                <p className="text-suave">{formatoTelefono(v.motorista.telefono)} · {v.motorista.placa}</p>
                <ul className="mt-3 space-y-1 text-xs">
                  {TIEMPOS.map(([c, t]) => v[c] && <li key={c} className="flex justify-between"><span className="text-suave">{t}</span><span>{fechaHora(v[c]!)}</span></li>)}
                </ul>
              </>
            ) : <p className="mt-2 text-suave">{v.estado === "BUSCANDO" ? "Todavía nadie lo ha aceptado." : "Sin motorista."}</p>}
          </section>
          {v.estado === "ENTREGADO" && (
            <section className="tarjeta space-y-3 p-5 text-sm" data-testid="calificaciones-viaje">
              <h2 className="font-bold">Calificaciones</h2>
              <div>
                <p className="text-[11px] text-suave">El cliente al motorista</p>
                {v.estrellasMotorista ? <><EstrellasFijas n={v.estrellasMotorista} />{v.comentarioMotorista && <p className="mt-0.5 text-suave">«{v.comentarioMotorista}»</p>}</> : <p className="text-suave">Todavía no califica.</p>}
              </div>
              <div>
                <p className="text-[11px] text-suave">El motorista al cliente</p>
                {v.estrellasCliente ? <><EstrellasFijas n={v.estrellasCliente} />{v.comentarioCliente && <p className="mt-0.5 text-suave">«{v.comentarioCliente}»</p>}</> : <p className="text-suave">{v.clienteCalificadoEn ? "Prefirió no calificar." : "Todavía no califica."}</p>}
              </div>
            </section>
          )}
          {v.estado === "CANCELADO" && (
            <section className="rounded-xl border border-error/30 bg-error/10 p-4 text-sm">
              <p className="font-semibold text-error">Cancelado por {v.canceladoPor === "PROPIETARIO" ? "FleteYa" : "el cliente"}{v.canceladoEn ? ` · ${fechaHora(v.canceladoEn)}` : ""}</p>
              {v.motivoCancelacion && <p className="mt-1 text-suave">Motivo: {v.motivoCancelacion}</p>}
            </section>
          )}
          {activo && <section className="tarjeta p-5"><CancelarViaje id={v.id} /></section>}
        </aside>
      </div>
    </>
  );
}
