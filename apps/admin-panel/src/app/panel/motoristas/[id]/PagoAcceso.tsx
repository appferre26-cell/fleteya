"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { dinero } from "@/lib/tarifa";
import { registrarPagoAccesoAccion, type EstadoForm } from "../../creditos/acciones";

/** Cobro único del acceso a la plataforma. Mientras no hay pago en línea (Wompi), lo registra el propietario. */
export function PagoAcceso({ id, precio, pagado, recibo, avisoReferencia, avisoFecha }: {
  id: string; precio: number; pagado: string | null; recibo: number | null; avisoReferencia: string | null; avisoFecha: string | null;
}) {
  const [e, accion, enviando] = useActionState<EstadoForm, FormData>(registrarPagoAccesoAccion.bind(null, id), {});
  const v = e.valores ?? {};
  const err = e.errores ?? {};
  const [forma, setForma] = useState<"EFECTIVO" | "TRANSFERENCIA">((v.formaPago as "EFECTIVO") || "TRANSFERENCIA");
  const opcion = (activa: boolean) => `flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-2 text-xs font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-naranja ${activa ? "border-naranja bg-naranja/10 text-naranja" : "border-borde bg-fondo text-suave"}`;

  if (pagado || e.ok) {
    return (
      <section className="tarjeta p-5" data-testid="pago-acceso">
        <h2 className="flex items-center gap-2 font-bold"><i className="fa-solid fa-circle-check text-exito" />Acceso pagado</h2>
        <p className="mt-1 text-sm text-suave">{e.ok ?? `Pagó el acceso a la plataforma el ${pagado}.`}</p>
        {recibo && <Link href={`/panel/creditos/recibo/${recibo}`} className="mt-2 inline-block text-xs font-semibold text-naranja">Ver comprobante</Link>}
      </section>
    );
  }

  return (
    <section className="tarjeta border-naranja/40 p-5" data-testid="pago-acceso">
      <h2 className="flex items-center gap-2 font-bold"><i className="fa-solid fa-id-card text-naranja" />Pago de acceso · {dinero(precio)}</h2>
      <p className="mt-1 text-xs text-suave">Pago único para dar de alta su perfil. No se suma a sus créditos.</p>
      {avisoReferencia && (
        <p className="mt-3 rounded-lg bg-naranja/10 px-3 py-2 text-xs" data-testid="aviso-pago">
          <i className="fa-solid fa-bell mr-1.5 text-naranja" />Avisó que transfirió{avisoFecha ? ` (${avisoFecha})` : ""}. Referencia: <b className="font-mono">{avisoReferencia}</b>. Búscala en el banco antes de registrar.
        </p>
      )}
      <form action={accion} className="mt-3 space-y-3 text-sm">
        <fieldset>
          <legend className="etiqueta">Forma de pago</legend>
          <div className="flex gap-2">
            {(["TRANSFERENCIA", "EFECTIVO"] as const).map((f) => (
              <label key={f} className={opcion(forma === f)}>
                <input type="radio" name="formaPago" value={f} checked={forma === f} onChange={() => setForma(f)} className="sr-only" />
                {f === "EFECTIVO" ? "Efectivo" : "Transferencia"}
              </label>
            ))}
          </div>
        </fieldset>
        {forma === "TRANSFERENCIA" && (
          <div>
            <label className="etiqueta" htmlFor="acceso-referencia">Número de referencia</label>
            <input id="acceso-referencia" name="referencia" defaultValue={v.referencia ?? avisoReferencia ?? ""} autoComplete="off"
              className={`campo h-10 font-mono ${err.referencia ? "border-error" : ""}`} />
            {err.referencia && <p className="mt-1 text-[11px] text-error">{err.referencia}</p>}
            <label className="mt-2 flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" name="revisado" className="mt-0.5 h-4 w-4 shrink-0 accent-naranja" />
              Revisé en el banco que el dinero ya está en la cuenta
            </label>
            {err.revisado && <p className="mt-1 text-[11px] text-error">{err.revisado}</p>}
          </div>
        )}
        <div>
          <label className="etiqueta" htmlFor="acceso-nota">Nota (opcional)</label>
          <input id="acceso-nota" name="nota" defaultValue={v.nota} maxLength={200} className="campo h-10" />
        </div>
        <button type="submit" disabled={enviando} className="btn-primario w-full"><i className="fa-solid fa-receipt" />{enviando ? "Registrando…" : `Registrar pago de ${dinero(precio)}`}</button>
      </form>
      {e.error && <p role="alert" className="mt-3 rounded-lg bg-error/10 px-3 py-2.5 text-xs text-error">{e.error}</p>}
    </section>
  );
}
