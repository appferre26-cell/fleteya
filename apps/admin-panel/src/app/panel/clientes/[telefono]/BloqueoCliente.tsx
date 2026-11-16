"use client";
import { useActionState, useState } from "react";
import { bloquearCliente, desbloquearCliente, type EstadoBloqueo } from "../acciones";

export function BloqueoCliente({ telefono, bloqueado }: { telefono: string; bloqueado: boolean }) {
  const [bloq, bloquear, bloqueando] = useActionState<EstadoBloqueo, FormData>(bloquearCliente, {});
  const [desb, desbloquear, desbloqueando] = useActionState<EstadoBloqueo, FormData>(desbloquearCliente, {});
  const [abrir, setAbrir] = useState(false);
  const ultimo = bloqueado ? bloq : desb;
  const error = (bloqueado ? desb : bloq).error;

  return (
    <section className="tarjeta p-5">
      {ultimo.aviso && <p role="status" className="mb-3 rounded-lg bg-exito/10 px-3 py-2.5 text-xs text-exito"><i className="fa-solid fa-circle-check mr-1.5" />{ultimo.aviso}</p>}
      {bloqueado ? (
        <form action={desbloquear}>
          <h2 className="font-bold">Cliente bloqueado</h2>
          <p className="mt-1 text-sm text-suave">No puede pedir fletes con este número.</p>
          <input type="hidden" name="telefono" value={telefono} />
          <button type="submit" disabled={desbloqueando} data-testid="desbloquear" className="btn-secundario mt-3 w-full border-exito/40 text-exito">
            <i className="fa-solid fa-unlock" />{desbloqueando ? "Desbloqueando..." : "Desbloquear cliente"}
          </button>
        </form>
      ) : (
        <>
          <h2 className="font-bold">Bloquear</h2>
          <p className="mt-1 text-sm text-suave">Un número bloqueado no puede pedir fletes. Sus pedidos que esperan motorista se cancelan. Se puede desbloquear después.</p>
          {!abrir ? (
            <button type="button" onClick={() => setAbrir(true)} data-testid="bloquear" className="btn-secundario mt-3 w-full border-error/40 text-error">
              <i className="fa-solid fa-ban" />Bloquear cliente
            </button>
          ) : (
            <form action={bloquear} className="mt-3 space-y-2"
              onSubmit={(e) => { if (!window.confirm("¿Bloquear este número?")) e.preventDefault(); }}>
              <input type="hidden" name="telefono" value={telefono} />
              <label htmlFor="motivo" className="etiqueta">Motivo del bloqueo (solo lo ven los propietarios)</label>
              <textarea id="motivo" name="motivo" rows={3} maxLength={200} className="campo h-auto py-2.5" placeholder="Ej.: pedidos falsos, no estaba al llegar el motorista..." />
              <div className="flex gap-2">
                <button type="submit" disabled={bloqueando} className="btn-secundario flex-1 border-error/40 text-error">{bloqueando ? "Bloqueando..." : "Confirmar bloqueo"}</button>
                <button type="button" onClick={() => setAbrir(false)} className="btn-secundario">Cancelar</button>
              </div>
            </form>
          )}
        </>
      )}
      {error && <p role="alert" className="mt-3 rounded-lg bg-error/10 px-3 py-2.5 text-xs text-error">{error}</p>}
    </section>
  );
}
