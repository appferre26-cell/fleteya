"use client";
import { useActionState, useState } from "react";
import { cancelarViajePropietario, type EstadoCancelar } from "../acciones";

export function CancelarViaje({ id }: { id: string }) {
  const [abierto, setAbierto] = useState(false);
  const [e, accion, enviando] = useActionState<EstadoCancelar, FormData>(cancelarViajePropietario, {});
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="btn-secundario h-11 w-full border-error/40 text-error">
        <i className="fa-solid fa-ban" />Cancelar viaje
      </button>
    );
  }
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <label className="etiqueta" htmlFor="motivo">Motivo de la cancelación</label>
      <textarea id="motivo" name="motivo" rows={3} maxLength={200} required placeholder="Ej.: no hay motorista disponible con camión para ese peso"
        className={`campo py-2 ${e.error ? "border-error" : ""}`} />
      <p className="text-[11px] text-suave">El cliente verá «cancelado por FleteYa» y este motivo en su enlace.</p>
      {e.error && <p role="alert" className="text-xs text-error">{e.error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={enviando} className="btn-primario h-10 flex-1 bg-error">{enviando ? "Cancelando…" : "Confirmar cancelación"}</button>
        <button type="button" onClick={() => setAbierto(false)} className="btn-secundario h-10">Volver</button>
      </div>
    </form>
  );
}
