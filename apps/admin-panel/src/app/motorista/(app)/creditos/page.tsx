import { obtenerConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { exigirMotorista } from "@/lib/sesion-motorista";
import { centavos, dinero, numeroViaje } from "@/lib/tarifa";
import { fechaHora } from "@/lib/validacion";

export const metadata = { title: "Créditos — FleteYa Motorista" };

const TIPO = {
  RECARGA: { icono: "fa-receipt", color: "text-exito", nombre: "Recarga" },
  COMISION: { icono: "fa-truck", color: "text-suave", nombre: "Comisión" },
  AJUSTE: { icono: "fa-pen", color: "text-suave", nombre: "Ajuste" },
} as const;

export default async function CreditosMotorista() {
  const m = await exigirMotorista();
  const cfg = await obtenerConfig();
  const movimientos = await db.movimientoCredito.findMany({ where: { motoristaId: m.id }, orderBy: { creadoEn: "desc" }, take: 50 });
  const viajes = await db.viaje.findMany({ where: { id: { in: movimientos.map((x) => x.viajeId).filter((x): x is string => !!x) } }, select: { id: true, numero: true } });
  const numero = new Map(viajes.map((v) => [v.id, v.numero]));
  const saldo = Number(m.saldoCreditos);
  const comisionTipica = centavos((cfg.tarifaMinima * cfg.comisionPct) / 100);
  const alcanza = saldo > 0 && comisionTipica > 0 ? Math.floor(saldo / comisionTipica) : 0;
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
          {saldo > 0 ? `Alcanza para unos ${alcanza} viajes de ${dinero(cfg.tarifaMinima)}. Por cada viaje se descuenta el ${cfg.comisionPct}%.`
            : saldo < 0 ? `Debes ${dinero(-saldo)}: se descuentan de tu próxima recarga. Mientras tanto no recibes viajes.`
            : "Sin créditos no recibes viajes. Recarga para empezar."}
        </p>
        <div className="mt-4 rounded-xl border border-borde bg-fondo/60 p-4 text-sm">
          <p className="font-semibold"><i className="fa-solid fa-circle-info mr-2 text-naranja" />¿Cómo recargo?</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-suave">Paga tu plan a FleteYa <b className="text-texto">en efectivo o por transferencia</b>. Cuando lo registren, tu saldo se actualiza solo.</p>
          {cfg.whatsappAyuda && (
            <a href={`https://wa.me/503${cfg.whatsappAyuda}?text=${mensaje}`} target="_blank" rel="noopener" className="btn-primario mt-3 h-11 w-full"><i className="fa-brands fa-whatsapp" />Avisar a FleteYa por WhatsApp</a>
          )}
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <div className="tarjeta p-4"><p className="text-[11px] font-semibold tracking-wider text-suave uppercase">Semanal</p><p className="mt-1 text-2xl font-extrabold">{dinero(cfg.planSemanal)}</p></div>
        <div className="tarjeta p-4"><p className="text-[11px] font-semibold tracking-wider text-suave uppercase">Mensual</p><p className="mt-1 text-2xl font-extrabold">{dinero(cfg.planMensual)}</p></div>
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
                    <p className="text-xs text-suave">{fechaHora(x.creadoEn)} · saldo {dinero(Number(x.saldoDespues))}</p>
                  </div>
                  <span className={`font-bold tabular-nums ${monto < 0 ? "text-error" : "text-exito"}`}>{monto < 0 ? "-" : "+"}{dinero(Math.abs(monto))}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
