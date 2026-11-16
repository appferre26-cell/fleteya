import QRCode from "qrcode";
import { db } from "@/lib/db";
import { obtenerConfig } from "@/lib/config";
import { urlPublica } from "@/lib/url";
import { BotonActivoPunto, CopiarLink, FormPunto } from "./Piezas";

function inicioDeMes() {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/El_Salvador" });
  return new Date(`${hoy.slice(0, 8)}01T06:00:00Z`); // 00:00 en El Salvador (UTC-6)
}

export default async function PuntosQR() {
  const [puntos, cfg, base, delMes, totalMes] = await Promise.all([
    db.puntoQR.findMany({ orderBy: [{ activo: "desc" }, { codigo: "asc" }], include: { _count: { select: { viajes: true } } } }),
    obtenerConfig(),
    urlPublica(),
    db.viaje.groupBy({ by: ["puntoQrId"], where: { creadoEn: { gte: inicioDeMes() }, puntoQrId: { not: null } }, _count: true }),
    db.viaje.count({ where: { creadoEn: { gte: inicioDeMes() } } }),
  ]);
  const mes = new Map(delMes.map((g) => [g.puntoQrId, g._count]));
  const desdeQrMes = delMes.reduce((s, g) => s + g._count, 0);
  const qrs = await Promise.all(puntos.map((p) => QRCode.toDataURL(`${base}/pedir?f=${p.codigo}`, { margin: 1, width: 320 })));
  const activos = puntos.filter((p) => p.activo).length;

  return (
    <>
      <h1 className="text-[24px] font-extrabold lg:text-[28px]">Puntos QR</h1>
      <p className="mt-1 text-sm text-suave">Ferreterías con QR de FleteYa. Al escanearlo, el cliente pide el viaje con la recogida ya llenada.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="tarjeta p-4"><p className="text-xs text-suave">Puntos activos</p><p className="mt-1 text-2xl font-extrabold">{activos}</p><p className="text-xs text-suave">{puntos.length - activos} pausados</p></div>
        <div className="tarjeta p-4"><p className="text-xs text-suave">Pedidos desde QR (este mes)</p><p className="mt-1 text-2xl font-extrabold">{desdeQrMes}</p><p className="text-xs text-suave">De {totalMes} pedidos en total</p></div>
        <div className="tarjeta min-w-0 p-4"><p className="text-xs text-suave">Link general para clientes</p><CopiarLink url={`${base}/pedir`} /></div>
      </div>

      <p className="mt-4 rounded-lg border border-borde bg-tarjeta px-4 py-3 text-xs text-suave">
        <i className="fa-solid fa-circle-info mr-1.5 text-naranja" />
        El QR solo sirve para pedir el viaje: en la Fase 1 las ferreterías no reciben porcentaje ni tienen cuenta.
        Los QR llevan la dirección con la que abriste el panel (<span className="break-all">{base}</span>). <b className="text-texto">Imprime los definitivos cuando la app esté publicada</b> (Parte 5).
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="min-w-0 space-y-3">
          {puntos.length === 0 && (
            <div className="tarjeta px-5 py-10 text-center">
              <i className="fa-solid fa-qrcode text-3xl text-suave" />
              <p className="mt-3 font-semibold">Todavía no hay puntos QR</p>
              <p className="mt-1 text-sm text-suave">Agrega la primera ferretería con el formulario.</p>
            </div>
          )}
          {puntos.map((p, i) => (
            <article key={p.id} className={`tarjeta flex flex-wrap gap-4 p-4 ${p.activo ? "" : "opacity-60"}`} data-testid="punto-qr">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrs[i]} alt={`QR de ${p.nombre}`} className="h-24 w-24 rounded-lg bg-white" />
              <div className="min-w-[12rem] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-naranja/15 px-1.5 py-0.5 font-mono text-xs font-bold text-naranja">{p.codigo}</span>
                  <h3 className="font-bold">{p.nombre}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.activo ? "bg-exito/15 text-exito" : "bg-tarjeta-2 text-suave"}`}>{p.activo ? "Activo" : "Pausado"}</span>
                </div>
                <p className="mt-1 text-xs text-suave">{p.direccion}</p>
                <p className="mt-1 truncate font-mono text-[11px] text-suave">{base}/pedir?f={p.codigo}</p>
                <p className="mt-2 text-sm"><b>{mes.get(p.id) ?? 0}</b> <span className="text-suave">pedidos este mes · {p._count.viajes} en total</span></p>
              </div>
              <div className="flex w-full gap-2 sm:w-auto sm:flex-col">
                <a href={`/panel/puntos-qr/${p.id}/imprimir`} target="_blank" className="btn-secundario h-9 flex-1 text-xs"><i className="fa-solid fa-print text-suave" />Imprimir</a>
                <a href={qrs[i]} download={`QR-${p.codigo}.png`} className="btn-secundario h-9 flex-1 text-xs"><i className="fa-solid fa-download text-suave" />Descargar</a>
                <BotonActivoPunto id={p.id} activo={p.activo} nombre={p.nombre} />
              </div>
            </article>
          ))}
        </section>
        <aside><FormPunto zona={{ lat: cfg.zonaLat, lng: cfg.zonaLng, radioKm: cfg.zonaRadioKm }} /></aside>
      </div>
    </>
  );
}
