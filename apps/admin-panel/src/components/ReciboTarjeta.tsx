import type { Recibo } from "@/lib/recargas";
import { CONCEPTOS, FORMAS_PAGO, fechaRecibo, numeroRecibo } from "@/lib/recibo";
import { dinero } from "@/lib/tarifa";

/** El recibo de una recarga o del pago de acceso, igual en el panel y en la app del motorista (tarjeta blanca, como el papel). */
export function ReciboTarjeta({ r }: { r: Recibo }) {
  const fila = (k: string, v: React.ReactNode, testid?: string) => (
    <div className="flex items-baseline justify-between gap-4 border-b border-[#e8e8e8] py-2.5 last:border-0">
      <dt className="text-[#6b6b6b]">{k}</dt><dd className="text-right font-semibold break-all" data-testid={testid}>{v}</dd>
    </div>
  );
  const acceso = r.concepto === "ACCESO";
  const m = r.motorista;
  return (
    <article className="overflow-hidden rounded-2xl bg-white text-[#1a1a1a]" data-testid="recibo">
      <header className="border-b border-dashed border-[#d0d0d0] p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-lg font-extrabold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-naranja text-sm text-white"><i className="fa-solid fa-truck-fast" /></span>
            Flete<span className="text-naranja">Ya</span>
          </p>
          {r.anulada
            ? <span className="rounded-full bg-[#fde2e2] px-2.5 py-1 text-[11px] font-bold tracking-wider text-[#c62828]" data-testid="sello">ANULADO</span>
            : <span className="rounded-full bg-[#dcf2e3] px-2.5 py-1 text-[11px] font-bold tracking-wider text-[#1e8c4d]" data-testid="sello">PAGADO</span>}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[#6b6b6b]">
          {r.emisor.nombre || "[Nombre del socio inscrito pendiente]"} · NIT {r.emisor.nit || "[pendiente]"}<br />
          {r.emisor.direccion || `[Dirección pendiente] · ${r.zona}`}
        </p>
      </header>
      <div className="p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-wider text-[#6b6b6b] uppercase">Recibo N.º</p>
            <p className="mt-1 font-mono text-lg font-bold" data-testid="numero-recibo">{numeroRecibo(r.numero)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold tracking-wider text-[#6b6b6b] uppercase">Fecha</p>
            <p className="mt-1 text-sm font-semibold">{fechaRecibo(r.fecha)}</p>
          </div>
        </div>
        <dl className="mt-3 text-sm">
          {fila("Motorista", r.motorista.nombre)}
          {fila("Concepto", CONCEPTOS[r.concepto] + (acceso ? " (pago único)" : ""), "concepto-recibo")}
          {m.requiereCreditoFiscal && fila("Crédito fiscal", `${m.razonSocial ?? m.nombre} · NIT ${m.nit ?? "—"} · NRC ${m.nrc ?? "—"}`, "fiscal-recibo")}
          {fila("Forma de pago", FORMAS_PAGO[r.formaPago])}
          {r.referencia && fila("Referencia", <span className="font-mono">{r.referencia}</span>)}
          {fila("Registrado por", r.registradoPor)}
        </dl>
        {acceso ? (
          <dl className="mt-3 rounded-xl bg-[#f2f2f2] px-4 py-1 text-sm">
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="font-bold">Total pagado</dt>
              <dd className="text-2xl font-extrabold text-naranja tabular-nums" data-testid="monto-recibo">{dinero(r.monto)}</dd>
            </div>
          </dl>
        ) : (
        <dl className="mt-3 rounded-xl bg-[#f2f2f2] px-4 py-1 text-sm">
          {fila("Monto recargado", dinero(r.monto), "monto-recibo")}
          {fila("Saldo anterior", <span className={r.saldoAntes < 0 ? "text-[#c62828]" : ""}>{dinero(r.saldoAntes)}</span>, "saldo-anterior")}
          {r.deuda > 0 && fila("Deuda descontada", <span className="text-[#c62828]">-{dinero(r.deuda)}</span>, "deuda-recibo")}
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="font-bold">Saldo nuevo</dt>
            <dd className="text-2xl font-extrabold text-naranja tabular-nums" data-testid="saldo-nuevo">{dinero(r.saldoDespues)}</dd>
          </div>
        </dl>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-[#6b6b6b]">
          {acceso ? "Pago único por el acceso a la plataforma FleteYa. Para recibir viajes, además, necesitas créditos (recargas)."
            : `Los créditos se usan para recibir viajes en FleteYa. Por cada viaje completado se descuenta el ${r.comisionPct}% del valor del viaje.`}
          {" "}Comprobante interno de pago: no sustituye la factura electrónica.
        </p>
        {r.nota && <p className="mt-2 text-[11px] text-[#6b6b6b]">Nota: {r.nota}</p>}
        {r.anulada && (
          <p className="mt-3 rounded-lg bg-[#fde2e2] px-3 py-2 text-xs font-semibold text-[#c62828]" data-testid="anulacion">
            Anulado el {fechaRecibo(r.anulada.en)} por {r.anulada.por}. Motivo: {r.anulada.motivo}. {acceso ? "El acceso vuelve a quedar sin pagar." : "El monto se restó del saldo."}
          </p>
        )}
      </div>
    </article>
  );
}
