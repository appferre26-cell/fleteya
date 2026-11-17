"use client";
import { useActionState } from "react";
import { avisarPagoAcceso, type EstadoAviso } from "./acciones";

export function FormAviso({ referencia }: { referencia: string | null }) {
  const [e, accion, enviando] = useActionState<EstadoAviso, FormData>(avisarPagoAcceso, {});
  return (
    <form action={accion} className="mt-3" data-testid="form-aviso">
      <label htmlFor="referencia" className="etiqueta">Número de referencia de tu transferencia</label>
      <div className="flex gap-2">
        <input id="referencia" name="referencia" defaultValue={e.referencia ?? referencia ?? ""} autoComplete="off" placeholder="Ej. 4581230" className="campo h-11 flex-1 font-mono" />
        <button type="submit" disabled={enviando} className="btn-primario h-11 px-4">{enviando ? "Enviando…" : referencia ? "Actualizar" : "Avisar"}</button>
      </div>
      {e.error && <p role="alert" className="mt-2 text-xs text-error">{e.error}</p>}
      {e.ok && <p role="status" className="mt-2 rounded-lg bg-exito/10 px-3 py-2 text-xs text-exito">{e.ok}</p>}
    </form>
  );
}
