"use client";
import { useState, useTransition } from "react";
import type { DatosInicio } from "@/lib/inicio-motorista";
import { centavos, dinero, kg, numeroViaje } from "@/lib/tarifa";
import { textoRango } from "@/lib/rangos";
import { aceptarViaje, ofertarPrecio, rechazarViaje, retirarOferta, type Resultado } from "../acciones";

export type Sol = DatosInicio["solicitudes"][number];

export function Ruta({ origen, destino, km }: { origen: string; destino: string; km?: number }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-naranja" /><span className="my-1 w-px flex-1 border-l border-dashed border-[#555]" /><span className="h-2.5 w-2.5 rounded-sm bg-texto" />
      </div>
      <div className="min-w-0 flex-1 space-y-2.5 text-sm">
        <div><p className="text-[10px] font-semibold tracking-wider text-suave uppercase">Recogida</p><p className="font-medium break-words">{origen}</p></div>
        <div><p className="text-[10px] font-semibold tracking-wider text-suave uppercase">Destino</p><p className="font-medium break-words">{destino}</p></div>
      </div>
      {km !== undefined && <div className="self-center text-right"><p className="text-lg leading-none font-extrabold tabular-nums">{km.toFixed(1)}</p><p className="text-[10px] text-suave">KM</p></div>}
    </div>
  );
}

export function ListaCarga({ items, pesoKg, nota, rangoTon }: { items: Sol["items"]; pesoKg: number; nota?: string | null; rangoTon?: string | null }) {
  const rango = textoRango(rangoTon, pesoKg);
  return (
    <div className="overflow-hidden rounded-xl border border-borde bg-tarjeta-2/50">
      <div className="flex items-center justify-between border-b border-borde px-3.5 py-2.5 text-[11px] font-semibold tracking-wider text-suave uppercase">
        <span><i className="fa-solid fa-list-check mr-1.5 text-naranja" />Lo que vas a llevar</span>
        <span className="text-texto normal-case tracking-normal" data-testid="peso-solicitud">{rango ? "Por toneladas" : `${kg(pesoKg)} · ${(pesoKg / 1000).toFixed(2)} ton`}</span>
      </div>
      {rango && (
        <p className="px-3.5 py-2.5 text-sm" data-testid="rango-solicitud">
          <i className="fa-solid fa-weight-hanging mr-2 text-naranja" /><b>{rango}</b>
          <span className="mt-0.5 block text-xs text-suave">El cliente eligió el rango. Revisa la carga al llegar.</span>
        </p>
      )}
      <ul className="divide-y divide-borde text-sm">
        {items.map((i) => (
          <li key={i.id} className="flex justify-between gap-3 px-3.5 py-2"><span><b>{i.cantidad} ×</b> {i.nombre}</span><span className="text-suave tabular-nums">{kg(i.pesoKg)}</span></li>
        ))}
      </ul>
      {nota && <p className="border-t border-borde px-3.5 py-2.5 text-xs text-suave"><i className="fa-regular fa-comment mr-1.5" />“{nota}”</p>}
    </div>
  );
}

/** Tarjeta de una solicitud (en la lista y en el aviso emergente). */
export function TarjetaSolicitud({ s, comisionPct, contraofertaEnRango, alListo, segundos }: {
  s: Sol; comisionPct: number; contraofertaEnRango: boolean; alListo: (r: Resultado, tipo: "aceptar" | "rechazar" | "oferta") => void; segundos?: number;
}) {
  const puedeOfertar = s.fueraDeRango || contraofertaEnRango;
  const [ocupado, iniciar] = useTransition();
  const [ofertando, setOfertando] = useState(false);
  const [precio, setPrecio] = useState(String(Math.ceil(s.precioBase + 5)));
  const [error, setError] = useState("");
  const pendiente = s.miOferta?.estado === "PENDIENTE";
  const rechazada = s.miOferta?.estado === "RECHAZADA";

  const correr = (tipo: "aceptar" | "rechazar" | "oferta" | "retirar") => iniciar(async () => {
    setError("");
    const r = tipo === "aceptar" ? await aceptarViaje(s.id)
      : tipo === "rechazar" ? await rechazarViaje(s.id)
      : tipo === "retirar" ? await retirarOferta(s.id)
      : await ofertarPrecio(s.id, precio);
    if (r.error) setError(r.error);
    else { if (tipo === "oferta") setOfertando(false); if (tipo !== "retirar") alListo(r, tipo); else alListo(r, "oferta"); }
  });

  return (
    <article className="tarjeta p-4" data-testid="solicitud">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-naranja/15 px-2.5 py-1 text-[11px] font-bold tracking-wider text-naranja uppercase">
            <i className="fa-solid fa-bolt" />{segundos !== undefined ? "Nueva solicitud" : `Pedido ${numeroViaje(s.numero)}`}
          </span>
          <p className="mt-1.5 text-xs text-suave">
            {s.kmDeMi !== null ? `A ${s.kmDeMi.toFixed(1)} km de ti` : "Activa tu ubicación para ver la distancia"}{s.ferreteria ? ` · ${s.ferreteria}` : ""}
          </p>
        </div>
        {segundos !== undefined && (
          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border-4 border-naranja" aria-label={`${segundos} segundos para responder`}>
            <span className="text-lg leading-none font-extrabold tabular-nums">{segundos}</span><span className="text-[8px] text-suave">SEG</span>
          </div>
        )}
      </div>

      <p className="mt-3 text-[11px] font-semibold tracking-wider text-suave uppercase">Precio del viaje</p>
      <p className="text-[38px] leading-none font-extrabold text-naranja tabular-nums" data-testid="precio-solicitud">{dinero(s.precioBase)}</p>
      <p className="mt-1.5 text-xs text-suave"><i className="fa-solid fa-money-bill-wave mr-1 text-exito" />Efectivo · se descuentan {dinero(centavos(s.precioBase * comisionPct / 100))} ({comisionPct}%) de tus créditos</p>

      <div className="mt-4 space-y-3">
        <p className="text-sm"><i className="fa-solid fa-user mr-2 text-suave" />{s.clienteNombre}</p>
        <Ruta origen={s.origen.direccion} destino={s.destino.direccion} km={s.distanciaKm} />
        <ListaCarga items={s.items} pesoKg={s.pesoKg} nota={s.nota} rangoTon={s.rangoTon} />
      </div>

      {s.fueraDeRango && (
        <div className="mt-3 rounded-lg bg-naranja/10 px-3 py-2.5 text-xs">
          <i className="fa-solid fa-route mr-1.5 text-naranja" />El destino pasa de los km incluidos: este precio <b>ya trae el cobro por los km extra</b>. Puedes aceptarlo u ofrecer otro; el cliente decide.
        </div>
      )}
      {pendiente && (
        <div className="mt-3 rounded-lg border border-naranja/40 px-3 py-2.5 text-sm" data-testid="oferta-pendiente">
          <i className="fa-solid fa-hourglass-half mr-2 text-naranja" />Ofreciste <b>{dinero(s.miOferta!.precio)}</b>. Esperando que el cliente responda…
        </div>
      )}
      {rechazada && (
        <p className="mt-3 rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error" data-testid="oferta-rechazada">
          El cliente no aceptó {dinero(s.miOferta!.precio)}. Puedes ofrecer otro precio o aceptar el de la app.
        </p>
      )}

      {ofertando && (
        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-suave">$</span>
            <input value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="decimal" aria-label="Tu precio en dólares" className="campo pl-7 text-base" />
          </div>
          <button type="button" onClick={() => correr("oferta")} disabled={ocupado} className="btn-primario h-12 rounded-xl">Enviar</button>
        </div>
      )}
      {error && <p role="alert" className="mt-3 rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error">{error}</p>}

      <div className="mt-4 grid grid-cols-2 gap-3">
        {pendiente ? (
          <button type="button" onClick={() => correr("retirar")} disabled={ocupado} className="btn-secundario h-12">Retirar oferta</button>
        ) : (
          <button type="button" onClick={() => correr("rechazar")} disabled={ocupado} className="h-12 rounded-3xl border-2 border-error/70 text-sm font-extrabold text-error disabled:opacity-60">RECHAZAR</button>
        )}
        <button type="button" onClick={() => correr("aceptar")} disabled={ocupado} className="btn-primario h-12">
          <i className="fa-solid fa-check" />{puedeOfertar ? `ACEPTAR ${dinero(s.precioBase)}` : "ACEPTAR"}
        </button>
      </div>
      {puedeOfertar && !ofertando && !pendiente && (
        <button type="button" onClick={() => setOfertando(true)} className="mt-3 w-full py-1.5 text-sm font-semibold text-naranja">
          <i className="fa-solid fa-tag mr-1.5" />{s.fueraDeRango ? "Ofrecer otro precio" : "Proponer otro precio"}
        </button>
      )}
    </article>
  );
}
