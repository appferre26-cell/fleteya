"use client";
import { useActionState, useState, useTransition } from "react";
import { anularRecargaAccion, reenviarReciboAccion, type EstadoForm } from "../../acciones";

export function ReenviarCorreo({ numero }: { numero: number }) {
  const [r, setR] = useState<EstadoForm>({});
  const [enviando, iniciar] = useTransition();
  return (
    <div>
      <button type="button" disabled={enviando} className="btn-secundario h-11 w-full" data-testid="reenviar"
        onClick={() => iniciar(async () => setR(await reenviarReciboAccion(numero)))}>
        <i className="fa-regular fa-envelope text-suave" />{enviando ? "Enviando…" : "Reenviar por correo"}
      </button>
      {r.ok && <p role="status" className="mt-2 text-xs text-exito">{r.ok}</p>}
      {r.error && <p role="alert" className="mt-2 text-xs text-error">{r.error}</p>}
    </div>
  );
}

export function AnularRecarga({ id, anulada }: { id: string; anulada: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [e, accion, enviando] = useActionState<EstadoForm, FormData>(anularRecargaAccion.bind(null, id), {});
  if (e.ok) return <p role="status" className="rounded-lg bg-exito/10 px-3 py-2.5 text-sm text-exito">{e.ok}</p>;
  if (anulada) return null;
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-error/40 text-sm font-semibold text-error hover:bg-error/10">
        <i className="fa-solid fa-ban" />Anular recarga
      </button>
    );
  }
  return (
    <form action={accion} className="space-y-3 rounded-xl border border-error/40 p-4" data-testid="form-anular">
      <p className="text-sm font-semibold text-error">¿Anular esta recarga?</p>
      <p className="text-xs text-suave">Úsalo solo si se registró por error. El monto se resta del saldo del motorista (puede quedar negativo) y el recibo queda marcado como ANULADO.</p>
      <div>
        <label className="etiqueta" htmlFor="motivo">Motivo</label>
        <input id="motivo" name="motivo" defaultValue={e.valores?.motivo} maxLength={200} placeholder="Ej.: se registró dos veces"
          className={`campo h-11 ${e.errores?.motivo ? "border-error" : ""}`} />
        {e.errores?.motivo && <p className="mt-1 text-[11px] text-error">{e.errores.motivo}</p>}
      </div>
      {e.error && <p role="alert" className="text-xs text-error">{e.error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setAbierto(false)} className="btn-secundario h-10 flex-1">Cancelar</button>
        <button type="submit" disabled={enviando} className="flex h-10 flex-1 items-center justify-center rounded-lg bg-error text-sm font-semibold text-white disabled:opacity-60">
          {enviando ? "Anulando…" : "Sí, anular"}
        </button>
      </div>
    </form>
  );
}
