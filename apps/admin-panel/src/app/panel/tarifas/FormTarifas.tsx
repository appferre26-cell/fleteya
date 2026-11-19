"use client";
import { useActionState, useState } from "react";
import { Mapa } from "@/components/Mapa";
import { dinero, precioPorPeso } from "@/lib/tarifa";
import { areaKm2, centroDe, MAX_PUNTOS_ZONA, seCruza, type LatLng } from "@/lib/zona";
import { guardarTarifas, type EstadoTarifas } from "./acciones";

type Cfg = {
  precioTonelada: number; tarifaMinima: number; kmIncluidos: number; recargoKmPct: number;
  zonaNombre: string; zonaLat: number; zonaLng: number; zonaRadioKm: number; whatsappAyuda: string | null;
  contraofertaEnRango: boolean; zonaPoligono: LatLng[] | null;
};

export function FormTarifas({ cfg }: { cfg: Cfg }) {
  const [e, accion, enviando] = useActionState<EstadoTarifas, FormData>(guardarTarifas, {});
  const v = (k: Exclude<keyof Cfg, "zonaPoligono">) => e.valores?.[k] ?? String(cfg[k] ?? "");
  const contraoferta = e.valores ? e.valores.contraofertaEnRango === "on" : cfg.contraofertaEnRango;
  const [t, setT] = useState({ precioTonelada: cfg.precioTonelada, tarifaMinima: cfg.tarifaMinima });
  const [centro, setCentro] = useState({ lat: Number(v("zonaLat")), lng: Number(v("zonaLng")) });
  const [radio, setRadio] = useState(Number(v("zonaRadioKm")));
  const [modo, setModo] = useState<"circulo" | "area">(cfg.zonaPoligono ? "area" : "circulo");
  const [area, setArea] = useState<LatLng[]>(cfg.zonaPoligono ?? []);
  const err = e.errores ?? {};
  const areaLista = area.length >= 3;
  const cruzada = areaLista && seCruza(area);
  const centroFinal = modo === "area" && areaLista ? centroDe(area) : centro;
  const tocarMapa = (p: LatLng) => {
    if (modo === "circulo") setCentro(p);
    else if (area.length < MAX_PUNTOS_ZONA) setArea([...area, { lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) }]);
  };

  const campo = (name: Exclude<keyof Cfg, "zonaPoligono">, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, ayuda?: string) => (
    <div>
      <label className="etiqueta" htmlFor={name}>{label}</label>
      <input id={name} name={name} defaultValue={v(name)} className={`campo h-11 ${err[name] ? "border-error" : ""}`} {...props} />
      {err[name] ? <p className="mt-1 text-[11px] text-error">{err[name]}</p> : ayuda && <p className="mt-1 text-[11px] text-suave">{ayuda}</p>}
    </div>
  );
  const nro = { type: "number", inputMode: "decimal" as const, step: "0.01" };

  return (
    <form action={accion} className="mt-6 grid gap-6 lg:grid-cols-2">
      <section className="tarjeta space-y-4 p-5">
        <h2 className="font-bold"><i className="fa-solid fa-tags mr-2 text-naranja" />Precio del flete</h2>
        <div className="grid grid-cols-2 gap-3">
          {campo("precioTonelada", "Precio por tonelada ($)", { ...nro, onChange: (x) => setT({ ...t, precioTonelada: Number(x.target.value) || 0 }) })}
          {campo("tarifaMinima", "Tarifa mínima ($)", { ...nro, onChange: (x) => setT({ ...t, tarifaMinima: Number(x.target.value) || 0 }) })}
        </div>
        {campo("kmIncluidos", "Km incluidos en el precio (a la redonda desde la ferretería)", { ...nro, step: "0.5" },
          "Se miden desde la ferretería donde se carga hasta el destino. Los km que pasen de aquí se cobran aparte (ver abajo).")}
        {campo("recargoKmPct", "Recargo por km extra (% del precio por cada km que pase de los incluidos)", { ...nro, step: "0.5" },
          "Se suma al precio cuando el destino pasa de los km incluidos. Ejemplo: base $10, destino a 3 km extra, 10% → +$3 → total $13.")}
        <div className="rounded-lg bg-fondo p-3 text-xs text-suave">
          <p className="mb-1 font-semibold text-texto">Ejemplos con estos valores</p>
          <p>300 kg → {dinero(precioPorPeso(300, { ...t, kmIncluidos: 0 }))} · 1,500 kg → {dinero(precioPorPeso(1500, { ...t, kmIncluidos: 0 }))} · 3,000 kg → {dinero(precioPorPeso(3000, { ...t, kmIncluidos: 0 }))}</p>
          <p className="mt-1">Pago del viaje: solo efectivo, al motorista.</p>
          <p className="mt-1">Botones rápidos del cliente: 0 a 1 ton → {dinero(precioPorPeso(1000, { ...t, kmIncluidos: 0 }))} · 1 a 2 ton → {dinero(precioPorPeso(2000, { ...t, kmIncluidos: 0 }))} · 2 a 3 ton → {dinero(precioPorPeso(3000, { ...t, kmIncluidos: 0 }))}</p>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-borde p-3">
          <input type="checkbox" name="contraofertaEnRango" defaultChecked={contraoferta} key={String(contraoferta)} className="mt-0.5 h-5 w-5 shrink-0 accent-naranja" />
          <span className="text-sm">
            Permitir contrapropuestas dentro de los km incluidos
            <span className="mt-0.5 block text-[11px] text-suave">El motorista puede proponer un precio mayor aunque el destino esté cerca (como en inDrive). El cliente acepta o sigue esperando con el precio por peso. Fuera de los km incluidos siempre se permite.</span>
          </span>
        </label>
        {campo("whatsappAyuda", "WhatsApp de ayuda (opcional)", { inputMode: "tel", placeholder: "7000-0000" },
          "Si lo llenas, el cliente ve un botón «Ayuda» que abre WhatsApp.")}
      </section>

      <section className="tarjeta space-y-4 p-5">
        <h2 className="font-bold"><i className="fa-solid fa-map-location-dot mr-2 text-naranja" />Zona de servicio</h2>
        <p className="text-xs text-suave">Dónde se puede recoger (ferreterías con QR y pedidos del link). Fuera de aquí el cliente ve «Todavía no damos servicio en esa zona». No cambia el precio: los km incluidos se cuentan desde cada ferretería.</p>
        <div role="radiogroup" aria-label="Forma de la zona" className="grid grid-cols-2 gap-2">
          {([["circulo", "fa-circle-dot", "Círculo"], ["area", "fa-draw-polygon", "Dibujar área"]] as const).map(([k, ic, txt]) => (
            <button key={k} type="button" role="radio" aria-checked={modo === k} onClick={() => setModo(k)} data-testid={`zona-${k}`}
              className={`flex h-10 items-center justify-center gap-2 rounded-lg border text-sm font-semibold ${modo === k ? "border-naranja bg-naranja/10 text-naranja" : "border-borde text-suave"}`}>
              <i className={`fa-solid ${ic}`} />{txt}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-suave">
          {modo === "circulo" ? "Toca el mapa para mover el centro y escribe el radio." : "Toca el mapa punto por punto alrededor de los municipios donde opera FleteYa (mínimo 3 puntos). El área se cierra sola."}
        </p>
        <Mapa centro={centro} zoom={12} className="h-72" etiqueta="Mapa de la zona de servicio"
          puntos={modo === "circulo" ? [{ id: "c", ...centro, color: "#FF6B00", icono: "fa-location-crosshairs", etiqueta: "Centro" }] : []}
          circulo={modo === "circulo" ? { ...centro, radioKm: radio || 0 } : undefined}
          vertices={modo === "area" ? area : undefined} onClick={tocarMapa} />
        {modo === "area" && (
          <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="info-area">
            <span className="text-suave">{area.length} {area.length === 1 ? "punto" : "puntos"}{areaLista && ` · ${areaKm2(area).toFixed(1)} km²`}</span>
            <button type="button" onClick={() => setArea(area.slice(0, -1))} disabled={!area.length} className="btn-secundario h-8 px-3 text-xs"><i className="fa-solid fa-rotate-left" />Deshacer punto</button>
            <button type="button" onClick={() => setArea([])} disabled={!area.length} className="btn-secundario h-8 px-3 text-xs text-error"><i className="fa-solid fa-trash" />Borrar área</button>
          </div>
        )}
        {modo === "area" && !areaLista && <p className="text-[11px] text-naranja">Faltan {3 - area.length} puntos para formar el área.</p>}
        {cruzada && <p className="text-[11px] text-error">Las líneas del área se cruzan. Deshaz puntos y márcalos siguiendo el borde, en orden.</p>}
        {err.zonaPoligono && <p className="text-[11px] text-error">{err.zonaPoligono}</p>}
        <input type="hidden" name="zonaPoligono" value={modo === "area" ? JSON.stringify(area) : ""} />
        <input type="hidden" name="zonaLat" value={centroFinal.lat.toFixed(6)} />
        <input type="hidden" name="zonaLng" value={centroFinal.lng.toFixed(6)} />
        {(err.zonaLat || err.zonaLng) && <p className="text-[11px] text-error">{err.zonaLat ?? err.zonaLng}</p>}
        <div className="grid grid-cols-2 gap-3">
          {campo("zonaNombre", "Nombre de la zona", {}, "Ej.: Lourdes, Colón")}
          <div className={modo === "area" ? "hidden" : ""}>
            {campo("zonaRadioKm", "Radio (km)", { ...nro, step: "0.5", onChange: (x) => setRadio(Number(x.target.value) || 0) })}
          </div>
        </div>
      </section>

      <div className="lg:col-span-2">
        {e.ok && <p role="status" className="mb-3 rounded-lg bg-exito/10 px-3 py-2.5 text-sm text-exito">{e.ok}</p>}
        {e.aviso && <p role="alert" data-testid="aviso-zona" className="mb-3 rounded-lg bg-naranja/10 px-3 py-2.5 text-sm text-naranja">{e.aviso}</p>}
        {e.errores && <p role="alert" className="mb-3 rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error">Revisa los campos marcados.</p>}
        <button type="submit" disabled={enviando || (modo === "area" && (!areaLista || cruzada))} className="btn-primario h-12 w-full sm:w-auto sm:px-8">{enviando ? "Guardando…" : "Guardar cambios"}</button>
      </div>
    </form>
  );
}
