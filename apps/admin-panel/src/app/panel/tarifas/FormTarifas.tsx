"use client";
import { useActionState, useState } from "react";
import { Mapa } from "@/components/Mapa";
import { dinero, precioPorPeso } from "@/lib/tarifa";
import { guardarTarifas, type EstadoTarifas } from "./acciones";

type Cfg = {
  precioTonelada: number; tarifaMinima: number; kmIncluidos: number;
  zonaNombre: string; zonaLat: number; zonaLng: number; zonaRadioKm: number; whatsappAyuda: string | null;
};

export function FormTarifas({ cfg }: { cfg: Cfg }) {
  const [e, accion, enviando] = useActionState<EstadoTarifas, FormData>(guardarTarifas, {});
  const v = (k: keyof Cfg) => e.valores?.[k] ?? String(cfg[k] ?? "");
  const [t, setT] = useState({ precioTonelada: cfg.precioTonelada, tarifaMinima: cfg.tarifaMinima });
  const [centro, setCentro] = useState({ lat: Number(v("zonaLat")), lng: Number(v("zonaLng")) });
  const [radio, setRadio] = useState(Number(v("zonaRadioKm")));
  const err = e.errores ?? {};

  const campo = (name: keyof Cfg, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, ayuda?: string) => (
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
        {campo("kmIncluidos", "Km incluidos en el precio", { ...nro, step: "0.5" },
          "Más lejos de eso, el motorista puede ofrecer otro precio y el cliente acepta o no.")}
        <div className="rounded-lg bg-fondo p-3 text-xs text-suave">
          <p className="mb-1 font-semibold text-texto">Ejemplos con estos valores</p>
          <p>300 kg → {dinero(precioPorPeso(300, { ...t, kmIncluidos: 0 }))} · 1,500 kg → {dinero(precioPorPeso(1500, { ...t, kmIncluidos: 0 }))} · 3,000 kg → {dinero(precioPorPeso(3000, { ...t, kmIncluidos: 0 }))}</p>
          <p className="mt-1">Pago del viaje: solo efectivo, al motorista.</p>
        </div>
        {campo("whatsappAyuda", "WhatsApp de ayuda (opcional)", { inputMode: "tel", placeholder: "7000-0000" },
          "Si lo llenas, el cliente ve un botón «Ayuda» que abre WhatsApp.")}
      </section>

      <section className="tarjeta space-y-4 p-5">
        <h2 className="font-bold"><i className="fa-solid fa-map-location-dot mr-2 text-naranja" />Zona de servicio</h2>
        <p className="text-xs text-suave">Solo se aceptan recogidas dentro del círculo. Toca el mapa para mover el centro.</p>
        <Mapa centro={centro} zoom={12} className="h-64" etiqueta="Centro de la zona"
          puntos={[{ id: "c", ...centro, color: "#FF6B00", icono: "fa-location-crosshairs", etiqueta: "Centro" }]}
          circulo={{ ...centro, radioKm: radio || 0 }} onClick={setCentro} />
        <input type="hidden" name="zonaLat" value={centro.lat.toFixed(6)} />
        <input type="hidden" name="zonaLng" value={centro.lng.toFixed(6)} />
        {(err.zonaLat || err.zonaLng) && <p className="text-[11px] text-error">{err.zonaLat ?? err.zonaLng}</p>}
        <div className="grid grid-cols-2 gap-3">
          {campo("zonaNombre", "Nombre de la zona")}
          {campo("zonaRadioKm", "Radio (km)", { ...nro, step: "0.5", onChange: (x) => setRadio(Number(x.target.value) || 0) })}
        </div>
      </section>

      <div className="lg:col-span-2">
        {e.ok && <p role="status" className="mb-3 rounded-lg bg-exito/10 px-3 py-2.5 text-sm text-exito">{e.ok}</p>}
        {e.errores && <p role="alert" className="mb-3 rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error">Revisa los campos marcados.</p>}
        <button type="submit" disabled={enviando} className="btn-primario h-12 w-full sm:w-auto sm:px-8">{enviando ? "Guardando…" : "Guardar cambios"}</button>
      </div>
    </form>
  );
}
