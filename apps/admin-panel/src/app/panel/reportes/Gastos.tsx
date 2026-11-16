"use client";
import { useActionState } from "react";
import { borrarGasto, registrarGasto, type EstadoGasto } from "./acciones";

export function FormGasto({ hoy, categorias }: { hoy: string; categorias: readonly string[] }) {
  const [estado, enviar, enviando] = useActionState<EstadoGasto, FormData>(registrarGasto, {});
  const v = estado.valores;
  return (
    <form action={enviar} key={estado.n ?? 0} className="grid grid-cols-2 gap-3 sm:grid-cols-[150px_1fr_1.6fr_120px_auto]" data-testid="form-gasto">
      <label><span className="etiqueta">Fecha</span>
        <input type="date" name="fecha" defaultValue={v?.fecha ?? hoy} max={hoy} className="campo h-10" aria-label="Fecha del gasto" /></label>
      <label><span className="etiqueta">Categoría</span>
        <select name="categoria" defaultValue={v?.categoria ?? ""} className="campo h-10" aria-label="Categoría">
          <option value="" disabled>Elegir...</option>
          {categorias.map((c) => <option key={c}>{c}</option>)}
        </select></label>
      <label className="col-span-2 sm:col-span-1"><span className="etiqueta">Detalle</span>
        <input name="concepto" defaultValue={v?.concepto} maxLength={120} placeholder="Ej.: volantes para ferreterías" className="campo h-10" aria-label="Detalle del gasto" /></label>
      <label><span className="etiqueta">Monto ($)</span>
        <input name="monto" defaultValue={v?.monto} inputMode="decimal" placeholder="0.00" className="campo h-10" aria-label="Monto del gasto" /></label>
      <div className="flex items-end">
        <button type="submit" disabled={enviando} className="btn-primario h-10 w-full"><i className="fa-solid fa-plus" />{enviando ? "Guardando..." : "Agregar"}</button>
      </div>
      {estado.error && <p role="alert" className="col-span-2 rounded-lg bg-error/10 px-3 py-2.5 text-xs text-error sm:col-span-5">{estado.error}</p>}
      {estado.aviso && <p role="status" className="col-span-2 rounded-lg bg-exito/10 px-3 py-2.5 text-xs text-exito sm:col-span-5"><i className="fa-solid fa-circle-check mr-1.5" />{estado.aviso}</p>}
    </form>
  );
}

export function BorrarGasto({ id, texto }: { id: string; texto: string }) {
  return (
    <form action={borrarGasto} onSubmit={(e) => { if (!window.confirm(`¿Borrar el gasto «${texto}»?`)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" aria-label={`Borrar gasto ${texto}`} className="flex h-8 w-8 items-center justify-center rounded-full text-suave hover:bg-error/10 hover:text-error">
        <i className="fa-solid fa-trash-can text-xs" />
      </button>
    </form>
  );
}
