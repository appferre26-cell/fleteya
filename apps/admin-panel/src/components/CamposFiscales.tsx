"use client";
import { useState } from "react";

/** Datos para emitir crédito fiscal (CCF). Se muestran solo si se marca la casilla. */
export function CamposFiscales({ valores, errores }: { valores: Record<string, string | undefined>; errores: Record<string, string | undefined> }) {
  const marcado = valores.requiereCreditoFiscal === "on" || valores.requiereCreditoFiscal === "true";
  const [ccf, setCcf] = useState(marcado);

  const campo = (nombre: string, etiqueta: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={nombre} className="etiqueta">{etiqueta}</label>
      <input id={nombre} name={nombre} defaultValue={valores[nombre] ?? ""} aria-invalid={!!errores[nombre]}
        className={`campo ${errores[nombre] ? "border-error" : ""}`} {...props} />
      {errores[nombre] && <p className="mt-1 text-[11px] text-error">{errores[nombre]}</p>}
    </div>
  );

  return (
    <div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="requiereCreditoFiscal" defaultChecked={marcado} onChange={(e) => setCcf(e.target.checked)}
          className="mt-0.5 h-5 w-5 accent-naranja" data-testid="requiere-ccf" />
        <span>
          <span className="font-semibold">Necesito crédito fiscal (CCF)</span>
          <span className="block text-xs text-suave">Si no la activas, el comprobante sale como consumidor final con tu nombre y DUI.</span>
        </span>
      </label>
      {/* Se ocultan con CSS (no se quitan) para no perder lo escrito si se desmarca por error. */}
      <div className={`mt-4 grid gap-4 sm:grid-cols-2 ${ccf ? "" : "hidden"}`}>
        {campo("nit", "NIT", { inputMode: "numeric", placeholder: "0000-000000-000-0" })}
        {campo("nrc", "NRC (registro de IVA)", { inputMode: "numeric", placeholder: "123456-7" })}
        {campo("razonSocial", "Nombre o razón social", { placeholder: "Como aparece en la tarjeta de IVA" })}
        {campo("giro", "Giro o actividad económica", { placeholder: "Transporte de carga" })}
        <div className="sm:col-span-2">{campo("direccionFiscal", "Dirección", { placeholder: "Colonia, calle, municipio" })}</div>
      </div>
    </div>
  );
}
