"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { kg } from "@/lib/tarifa";
import { cambiarVisible, cargarEjemplos, guardarMaterial, type EstadoMaterial } from "./acciones";

type M = { id: string; nombre: string; unidad: string; pesoKg: number; activo: boolean; usos: number };

function Campos({ e, m }: { e: EstadoMaterial; m?: M }) {
  const v = e.valores;
  const err = e.errores ?? {};
  const campo = (name: string, label: string, def: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="etiqueta" htmlFor={`${name}-${m?.id ?? "nuevo"}`}>{label}</label>
      <input id={`${name}-${m?.id ?? "nuevo"}`} name={name} defaultValue={v?.[name] ?? def} className={`campo h-10 ${err[name] ? "border-error" : ""}`} {...props} />
      {err[name] && <p className="mt-1 text-[11px] text-error">{err[name]}</p>}
    </div>
  );
  return (
    <>
      {m && <input type="hidden" name="id" value={m.id} />}
      {campo("nombre", "Material", m?.nombre ?? "", { placeholder: "Bolsa de cemento" })}
      <div className="grid grid-cols-2 gap-3">
        {campo("unidad", "Unidad", m?.unidad ?? "", { placeholder: "Bolsa, Unidad…", list: "unidades" })}
        {campo("pesoKg", "Peso por unidad (kg)", m ? String(m.pesoKg) : "", { type: "number", step: "0.1", min: "0.1", inputMode: "decimal", placeholder: "42.5" })}
      </div>
      <datalist id="unidades"><option value="Bolsa" /><option value="Unidad" /><option value="Metro cúbico" /><option value="Quintal" /><option value="Galón" /></datalist>
    </>
  );
}

export function FormMaterial() {
  const [e, accion, enviando] = useActionState<EstadoMaterial, FormData>(guardarMaterial, {});
  const [clave, setClave] = useState(0);
  useEffect(() => { if (e.ok) setClave((k) => k + 1); }, [e]);
  return (
    <section className="tarjeta p-5">
      <h2 className="font-bold"><i className="fa-solid fa-plus mr-2 text-naranja" />Agregar material</h2>
      <form key={clave} action={accion} className="mt-3 space-y-3">
        <Campos e={e.ok ? {} : e} />
        <button type="submit" disabled={enviando} className="btn-primario h-11 w-full">{enviando ? "Guardando…" : "Agregar"}</button>
      </form>
      {e.ok && <p role="status" className="mt-3 rounded-lg bg-exito/10 px-3 py-2.5 text-xs text-exito">{e.ok}</p>}
    </section>
  );
}

export function FilaMaterial({ m }: { m: M }) {
  const [editando, setEditando] = useState(false);
  const [e, accion, enviando] = useActionState<EstadoMaterial, FormData>(guardarMaterial, {});
  const [ocupado, iniciar] = useTransition();
  useEffect(() => { if (e.ok) setEditando(false); }, [e]);

  if (editando) {
    return (
      <li className="bg-tarjeta-2/40 p-4">
        <form action={accion} className="space-y-3">
          <Campos e={e} m={m} />
          <div className="flex gap-2">
            <button type="submit" disabled={enviando} className="btn-primario h-10">{enviando ? "Guardando…" : "Guardar"}</button>
            <button type="button" onClick={() => setEditando(false)} className="btn-secundario h-10">Cancelar</button>
          </div>
        </form>
      </li>
    );
  }
  return (
    <li className={`flex flex-wrap items-center gap-3 px-4 py-3 ${m.activo ? "" : "opacity-55"}`} data-testid="fila-material">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{m.nombre}</p>
        <p className="text-xs text-suave">{m.unidad} · {kg(m.pesoKg)} c/u{m.usos > 0 ? ` · en ${m.usos} pedido${m.usos === 1 ? "" : "s"}` : ""}</p>
      </div>
      <button type="button" disabled={ocupado} onClick={() => iniciar(() => cambiarVisible(m.id, !m.activo))}
        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${m.activo ? "bg-exito/15 text-exito" : "bg-tarjeta-2 text-suave"}`}
        aria-label={`${m.activo ? "Ocultar" : "Mostrar"} ${m.nombre}`}>
        <i className={`fa-solid ${m.activo ? "fa-eye" : "fa-eye-slash"} mr-1`} />{m.activo ? "Visible" : "Oculto"}
      </button>
      <button type="button" onClick={() => setEditando(true)} className="btn-secundario h-9 text-xs" aria-label={`Editar ${m.nombre}`}>
        <i className="fa-solid fa-pen text-suave" />Editar
      </button>
    </li>
  );
}

export function BotonEjemplos() {
  const [ocupado, iniciar] = useTransition();
  return (
    <button type="button" disabled={ocupado} onClick={() => iniciar(() => cargarEjemplos())} className="btn-secundario mt-4">
      <i className="fa-solid fa-wand-magic-sparkles text-naranja" />{ocupado ? "Cargando…" : "Cargar ejemplos"}
    </button>
  );
}
