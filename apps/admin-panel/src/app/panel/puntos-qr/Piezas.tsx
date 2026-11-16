"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Mapa } from "@/components/Mapa";
import { cambiarActivoPunto, guardarPunto, type EstadoPunto } from "./acciones";

export function FormPunto({ zona }: { zona: { lat: number; lng: number; radioKm: number } }) {
  const [e, accion, enviando] = useActionState<EstadoPunto, FormData>(guardarPunto, {});
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [clave, setClave] = useState(0);
  useEffect(() => { if (e.ok) { setClave((k) => k + 1); setPos(null); } }, [e]);
  const err = e.ok ? {} : e.errores ?? {};
  const v = e.ok ? undefined : e.valores;

  return (
    <section className="tarjeta p-5">
      <h2 className="font-bold"><i className="fa-solid fa-plus mr-2 text-naranja" />Agregar punto QR</h2>
      <form key={clave} action={accion} className="mt-3 space-y-3">
        <div>
          <label htmlFor="qr-nombre" className="etiqueta">Ferretería</label>
          <input id="qr-nombre" name="nombre" defaultValue={v?.nombre} placeholder="Ferretería El Constructor" className={`campo h-10 ${err.nombre ? "border-error" : ""}`} />
          {err.nombre && <p className="mt-1 text-[11px] text-error">{err.nombre}</p>}
        </div>
        <div>
          <label htmlFor="qr-direccion" className="etiqueta">Dirección</label>
          <input id="qr-direccion" name="direccion" defaultValue={v?.direccion} placeholder="Lourdes, Colón · frente al parque" className={`campo h-10 ${err.direccion ? "border-error" : ""}`} />
          {err.direccion && <p className="mt-1 text-[11px] text-error">{err.direccion}</p>}
        </div>
        <div>
          <p className="etiqueta">Ubicación (toca el mapa)</p>
          <Mapa centro={zona} zoom={14} circulo={zona} onClick={setPos} className="h-56" etiqueta="Mapa para ubicar la ferretería"
            puntos={pos ? [{ id: "p", lat: pos.lat, lng: pos.lng, color: "#FF6B00", icono: "fa-store" }] : []} />
          <input type="hidden" name="lat" value={pos?.lat ?? ""} />
          <input type="hidden" name="lng" value={pos?.lng ?? ""} />
          {(err.lat || err.lng) && <p className="mt-1 text-[11px] text-error">{err.lat ?? err.lng}</p>}
        </div>
        <button type="submit" disabled={enviando} className="btn-primario h-11 w-full">{enviando ? "Guardando…" : "Crear QR"}</button>
      </form>
      {e.ok && <p role="status" className="mt-3 rounded-lg bg-exito/10 px-3 py-2.5 text-xs text-exito">{e.ok}</p>}
      {err.general && <p role="alert" className="mt-3 text-xs text-error">{err.general}</p>}
    </section>
  );
}

export function BotonActivoPunto({ id, activo, nombre }: { id: string; activo: boolean; nombre: string }) {
  const [ocupado, iniciar] = useTransition();
  return (
    <button type="button" disabled={ocupado} className={`btn-secundario h-9 flex-1 text-xs ${activo ? "" : "text-exito"}`}
      onClick={() => { if (window.confirm(activo ? `¿Pausar el QR de ${nombre}? Quien lo escanee podrá pedir, pero sin la recogida llenada.` : `¿Activar el QR de ${nombre}?`)) iniciar(() => cambiarActivoPunto(id, !activo)); }}>
      <i className={`fa-solid ${activo ? "fa-pause" : "fa-play"}`} />{activo ? "Pausar" : "Activar"}
    </button>
  );
}

export function CopiarLink({ url }: { url: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate font-mono text-xs">{url}</span>
      <button type="button" className="btn-secundario h-8 px-3 text-xs" onClick={async () => { await navigator.clipboard?.writeText(url); setOk(true); setTimeout(() => setOk(false), 1500); }}>
        {ok ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
