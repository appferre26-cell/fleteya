"use client";
import { useActionState, useState } from "react";
import { centavos, dinero } from "@/lib/tarifa";
import { registrarRecargaAccion, type EstadoForm } from "./acciones";

type M = { id: string; nombre: string; telefono: string; saldo: number; estado: string };

export function FormRecarga({ motoristas, planes, inicial, faltanDatos }: {
  motoristas: M[]; planes: { SEMANAL: number; MENSUAL: number }; inicial?: string; faltanDatos: boolean;
}) {
  const [e, accion, enviando] = useActionState<EstadoForm, FormData>(registrarRecargaAccion, {});
  const v = e.valores ?? {};
  const [mid, setMid] = useState(v.motoristaId ?? inicial ?? "");
  const [plan, setPlan] = useState<"SEMANAL" | "MENSUAL">((v.plan as "MENSUAL") || "SEMANAL");
  const [forma, setForma] = useState<"EFECTIVO" | "TRANSFERENCIA">((v.formaPago as "TRANSFERENCIA") || "TRANSFERENCIA");
  const err = e.errores ?? {};
  const m = motoristas.find((x) => x.id === mid);
  const nuevo = m ? centavos(m.saldo + planes[plan]) : null;

  const opcion = (activa: boolean) => `flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-naranja ${activa ? "border-naranja bg-naranja/10 text-naranja" : "border-borde bg-fondo text-suave"}`;

  return (
    <form action={accion} id="registrar" className="tarjeta scroll-mt-24 border-naranja/50 p-5" data-testid="form-recarga">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-bold"><i className="fa-solid fa-hand-holding-dollar mr-2 text-naranja" />Registrar recarga</h2>
        <p className="text-xs text-suave">El motorista te pagó en efectivo o por transferencia → regístralo aquí y el recibo se genera solo.</p>
      </div>
      {faltanDatos && (
        <p className="mt-3 rounded-lg bg-naranja/10 px-3 py-2 text-xs text-naranja">
          <i className="fa-solid fa-triangle-exclamation mr-1.5" />Faltan los datos de FleteYa para el recibo (socio, NIT, dirección). Puedes registrar igual: el recibo dirá «pendiente». <a href="/panel/creditos/datos" className="font-semibold underline">Completarlos</a>
        </p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr_1.2fr]">
        <div>
          <label className="etiqueta" htmlFor="motoristaId">Motorista</label>
          <select id="motoristaId" name="motoristaId" value={mid} onChange={(x) => setMid(x.target.value)} className={`campo h-11 ${err.motoristaId ? "border-error" : ""}`}>
            <option value="">Elige al motorista…</option>
            {motoristas.map((x) => (
              <option key={x.id} value={x.id}>{x.nombre} · {x.telefono.slice(0, 4)}-{x.telefono.slice(4)} · saldo {dinero(x.saldo)}{x.estado !== "ACTIVO" ? ` (${x.estado.toLowerCase()})` : ""}</option>
            ))}
          </select>
          {err.motoristaId && <p className="mt-1 text-[11px] text-error">{err.motoristaId}</p>}
        </div>
        <fieldset>
          <legend className="etiqueta">Plan</legend>
          <div className="flex gap-2">
            {(["SEMANAL", "MENSUAL"] as const).map((p) => (
              <label key={p} className={opcion(plan === p)}>
                <input type="radio" name="plan" value={p} checked={plan === p} onChange={() => setPlan(p)} className="sr-only" />
                <span className="whitespace-nowrap">{p === "SEMANAL" ? "Semanal" : "Mensual"} <span className="font-normal">{dinero(planes[p])}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="etiqueta">Forma de pago</legend>
          <div className="flex gap-2">
            {(["TRANSFERENCIA", "EFECTIVO"] as const).map((f) => (
              <label key={f} className={opcion(forma === f)}>
                <input type="radio" name="formaPago" value={f} checked={forma === f} onChange={() => setForma(f)} className="sr-only" />
                <i className={`fa-solid ${f === "EFECTIVO" ? "fa-money-bill-wave" : "fa-building-columns"}`} />{f === "EFECTIVO" ? "Efectivo" : "Transferencia"}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {forma === "TRANSFERENCIA" ? (
          <div>
            <label className="etiqueta" htmlFor="referencia">Número de referencia</label>
            <input id="referencia" name="referencia" defaultValue={v.referencia} placeholder="Del comprobante que mandó por WhatsApp" autoComplete="off"
              className={`campo h-11 font-mono ${err.referencia ? "border-error" : ""}`} />
            {err.referencia && <p className="mt-1 text-[11px] text-error">{err.referencia}</p>}
            <label className="mt-2.5 flex cursor-pointer items-start gap-2.5 text-sm">
              <input type="checkbox" name="revisado" defaultChecked={v.revisado === "on"} className="mt-0.5 h-4 w-4 shrink-0 accent-naranja" />
              Revisé en el banco que el dinero ya está en la cuenta de FleteYa
            </label>
            {err.revisado && <p className="mt-1 text-[11px] text-error">{err.revisado}</p>}
          </div>
        ) : (
          <p className="self-center rounded-lg bg-fondo px-3 py-2.5 text-xs text-suave"><i className="fa-solid fa-circle-info mr-1.5" />Recibiste el efectivo en mano. Deposítalo en la cuenta de FleteYa para que todo cuadre.</p>
        )}
        <div>
          <label className="etiqueta" htmlFor="nota">Nota (opcional)</label>
          <input id="nota" name="nota" defaultValue={v.nota} maxLength={200} className={`campo h-11 ${err.nota ? "border-error" : ""}`} />
          {err.nota && <p className="mt-1 text-[11px] text-error">{err.nota}</p>}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-borde pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm" data-testid="vista-saldo">
          {m ? (
            <>
              <span className="text-suave">Saldo nuevo: </span>
              <span className={m.saldo < 0 ? "text-error" : "text-suave"}>{dinero(m.saldo)}</span>
              <span className="text-suave"> + {dinero(planes[plan])} = </span>
              <b className="text-exito">{dinero(nuevo!)}</b>
              {m.saldo < 0 && <p className="mt-0.5 text-xs text-suave">Se descuentan primero los {dinero(-m.saldo)} que debía.</p>}
            </>
          ) : <span className="text-suave">Elige al motorista para ver su saldo nuevo.</span>}
        </div>
        <button type="submit" disabled={enviando} className="btn-primario h-12 sm:px-8"><i className="fa-solid fa-receipt" />{enviando ? "Registrando…" : "Registrar y generar recibo"}</button>
      </div>
      {e.error && <p role="alert" className="mt-3 rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error">{e.error}</p>}
    </form>
  );
}
