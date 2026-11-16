import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { exigirPropietario } from "@/lib/sesion";
import { ESTADOS_VIAJE, dinero, kg, numeroViaje } from "@/lib/tarifa";
import { fechaHora, formatoTelefono } from "@/lib/validacion";
import { CancelarViaje } from "./CancelarViaje";

export const metadata = { title: "Detalle del viaje — FleteYa" };

export default async function DetalleViaje({ params }: { params: Promise<{ id: string }> }) {
  await exigirPropietario();
  const { id } = await params;
  const v = await db.viaje.findUnique({ where: { id }, include: { items: true, puntoQr: true } });
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
            <li className="mt-1 flex justify-between border-t border-borde pt-2 font-semibold"><span>Peso estimado</span><span>{kg(Number(v.pesoKg))}</span></li>
          </ul>
          {v.nota && <p className="p-5 text-sm"><span className="text-suave">Nota del cliente: </span>{v.nota}</p>}
          <div className="flex items-center justify-between p-5">
            <span className="text-sm">Precio por peso · efectivo</span>
            <span className="text-xl font-extrabold text-naranja">{dinero(Number(v.precioBase))}</span>
          </div>
          {v.fueraDeRango && <p className="p-5 text-xs text-suave"><i className="fa-solid fa-route mr-1.5 text-naranja" />Más lejos que los km incluidos: el motorista podrá ofrecer otro precio (Parte 3).</p>}
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
            <p className="mt-3 text-[11px] text-suave">Aceptó términos y privacidad el {fechaHora(v.aceptoTerminosEn)}.</p>
            <a href={`/viaje/${v.codigo}`} target="_blank" className="mt-2 inline-block text-xs text-naranja">Ver lo que ve el cliente <i className="fa-solid fa-arrow-up-right-from-square ml-1" /></a>
          </section>
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
