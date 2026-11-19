import Link from "next/link";
import { obtenerConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { exigirMotorista } from "@/lib/sesion-motorista";
import { dinero, numeroViaje } from "@/lib/tarifa";
import { CONCEPTOS, MONTOS_RAPIDOS, RECARGA_MIN, fechaRecibo, numeroRecibo } from "@/lib/recibo";
import { fechaCorta, fechaHora } from "@/lib/validacion";
import { Copiar } from "./BotonesCliente";

export const metadata = { title: "Créditos — FleteYa Motorista" };

const TIPO = {
  RECARGA: { icono: "fa-receipt", color: "text-exito", nombre: "Recarga" },
  COMISION: { icono: "fa-truck", color: "text-suave", nombre: "Comisión" },
  AJUSTE: { icono: "fa-pen", color: "text-suave", nombre: "Ajuste" },
} as const;

export default async function CreditosMotorista() {
  const m = await exigirMotorista();
  const cfg = await obtenerConfig();
  const [movimientos, recargas] = await Promise.all([
    db.movimientoCredito.findMany({ where: { motoristaId: m.id }, orderBy: { creadoEn: "desc" }, take: 50, include: { recarga: { select: { numero: true } } } }),
    db.recarga.findMany({ where: { motoristaId: m.id }, orderBy: { numero: "desc" }, take: 30 }),
  ]);
  const huboCorreo = recargas.some((r) => r.correoEnviadoEn);
  const viajes = await db.viaje.findMany({ where: { id: { in: movimientos.map((x) => x.viajeId).filter((x): x is string => !!x) } }, select: { id: true, numero: true } });
  const numero = new Map(viajes.map((v) => [v.id, v.numero]));
  const saldo = Number(m.saldoCreditos);
  const mensaje = encodeURIComponent(`Hola, soy ${m.nombre} (motorista, tel. ${m.telefono}). Quiero recargar mis créditos de FleteYa.`);

  return (
    <main className="px-5 pt-6 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Mis créditos</h1>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase ${saldo > 0 ? "bg-exito/15 text-exito" : "bg-error/15 text-error"}`}>{saldo > 0 ? "Activo" : "Sin saldo"}</span>
      </div>

      <section className="mt-4 rounded-2xl border border-naranja/50 bg-gradient-to-br from-naranja/15 to-tarjeta p-5">
        <p className="text-[11px] font-semibold tracking-wider text-suave uppercase">Saldo disponible</p>
        <p className={`mt-1 text-5xl font-extrabold tabular-nums ${saldo < 0 ? "text-error" : ""}`} data-testid="saldo">{dinero(saldo)}</p>
        <p className="mt-2 text-xs text-suave">
          {saldo > 0 ? `Por cada viaje se descuenta el ${cfg.comisionPct}% del valor. Mantén saldo para seguir recibiendo viajes.`
            : saldo < 0 ? `Debes ${dinero(-saldo)}: se descuentan de tu próxima recarga. Mientras tanto no recibes viajes.`
            : "Sin créditos no recibes viajes. Recarga para empezar."}
        </p>
        <div className="mt-4 rounded-xl border border-borde bg-fondo/60 p-4 text-sm">
          <p className="font-semibold"><i className="fa-solid fa-circle-info mr-2 text-naranja" />¿Cómo recargo?</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-suave">No hay planes: recarga <b className="text-texto">el monto que quieras</b> (desde {dinero(RECARGA_MIN)}) en efectivo o por transferencia. Al registrarlo, tu saldo se actualiza solo y te llega el comprobante aquí. Para recibir viajes necesitas saldo.</p>
          {cfg.bancoNumero && (
            <div className="mt-3 rounded-lg bg-tarjeta-2 p-3" data-testid="cuenta-banco">
              <p className="text-[11px] font-semibold tracking-wider text-suave uppercase">Transfiere a</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{cfg.bancoNombre ?? "Banco"}{cfg.bancoTipoCuenta ? ` · ${cfg.bancoTipoCuenta}` : ""}</p>
                  <p className="font-mono text-base font-bold tracking-wide break-all" data-testid="numero-cuenta">{cfg.bancoNumero}</p>
                  {cfg.bancoTitular && <p className="text-xs text-suave">A nombre de {cfg.bancoTitular}</p>}
                </div>
                <Copiar texto={cfg.bancoNumero.replace(/[\s-]/g, "")} etiqueta="número de cuenta" />
              </div>
              <p className="mt-2 text-[11px] text-suave">Guarda el número de referencia de tu transferencia y envíalo a FleteYa.</p>
            </div>
          )}
          {cfg.whatsappAyuda && (
            <a href={`https://wa.me/503${cfg.whatsappAyuda}?text=${mensaje}`} target="_blank" rel="noopener" className="btn-primario mt-3 h-11 w-full"><i className="fa-brands fa-whatsapp" />Avisar a FleteYa por WhatsApp</a>
          )}
        </div>
      </section>

      <section className="tarjeta mt-4 p-4" data-testid="montos-sugeridos">
        <p className="text-[11px] font-semibold tracking-wider text-suave uppercase">Montos más usados</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {MONTOS_RAPIDOS.map((x) => (
            <div key={x} className="rounded-lg border border-borde bg-fondo p-2 text-center">
              <p className="text-lg font-extrabold">{dinero(x)}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-suave">Puedes recargar cualquier otro monto.</p>
      </section>

      <section className="mt-6">
        <h2 className="seccion-titulo mb-3">Movimientos</h2>
        {movimientos.length === 0 ? <p className="tarjeta p-5 text-center text-sm text-suave">Aún no hay movimientos.</p> : (
          <ul className="tarjeta divide-y divide-borde">
            {movimientos.map((x) => {
              const t = TIPO[x.tipo];
              const monto = Number(x.monto);
              const n = x.viajeId ? numero.get(x.viajeId) : undefined;
              return (
                <li key={x.id} className="flex items-center gap-3 p-3.5" data-testid="movimiento">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tarjeta-2"><i className={`fa-solid ${t.icono} text-xs ${t.color}`} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{x.tipo === "COMISION" && n ? `Viaje ${numeroViaje(n)} · ${x.detalle?.split(" ")[0] ?? ""}` : t.nombre}{x.tipo !== "COMISION" && x.detalle ? ` · ${x.detalle}` : ""}</p>
                    {x.recarga && <Link href={`/motorista/creditos/recibo/${x.recarga.numero}`} className="text-xs font-semibold text-naranja">Ver recibo</Link>}
                    <p className="text-xs text-suave">{fechaHora(x.creadoEn)} · saldo {dinero(Number(x.saldoDespues))}</p>
                  </div>
                  <span className={`font-bold tabular-nums ${monto < 0 ? "text-error" : "text-exito"}`}>{monto < 0 ? "-" : "+"}{dinero(Math.abs(monto))}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6" data-testid="historial-recargas">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="seccion-titulo">Historial de recargas</h2>
          {huboCorreo && <span className="text-[11px] text-suave"><i className="fa-regular fa-envelope mr-1" />También por correo</span>}
        </div>
        {recargas.length === 0 ? <p className="tarjeta p-5 text-center text-sm text-suave">Aún no tienes recargas. Cuando FleteYa registre tu pago, el recibo aparece aquí.</p> : (
          <ul className="tarjeta divide-y divide-borde">
            {recargas.map((r) => (
              <li key={r.id} className="flex items-center gap-3 p-3.5" data-testid="recarga">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${r.anuladaEn ? "bg-error/15 text-error" : "bg-exito/15 text-exito"}`}><i className="fa-solid fa-receipt text-xs" /></span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${r.anuladaEn ? "text-suave line-through" : ""}`}>{CONCEPTOS[r.concepto]} · {dinero(Number(r.monto))}</p>
                  <p className="truncate text-xs text-suave" title={fechaRecibo(r.creadoEn)}>{numeroRecibo(r.numero)} · {fechaCorta(r.creadoEn)}{r.anuladaEn ? " · Anulado" : ""}</p>
                </div>
                <Link href={`/motorista/creditos/recibo/${r.numero}`} className="flex h-9 items-center rounded-lg border border-borde px-3 text-xs font-semibold" aria-label={`Ver recibo ${numeroRecibo(r.numero)}`}>Ver</Link>
                <a href={`/motorista/api/recibos/${r.numero}?descargar=1`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-borde text-naranja" aria-label={`Descargar PDF de ${numeroRecibo(r.numero)}`}><i className="fa-solid fa-file-arrow-down text-xs" /></a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
