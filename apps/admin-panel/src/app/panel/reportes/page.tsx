import Link from "next/link";
import { db } from "@/lib/db";
import { exigirPropietario } from "@/lib/sesion";
import { PERIODOS, diaSV, periodo, textoPeriodo, fechaLarga } from "@/lib/periodos";
import { CATEGORIAS_GASTO, creditosActuales, fechaGasto, porMotorista, porPuntoQr, resumenPeriodo, seriePeriodo } from "@/lib/reportes";
import { dinero } from "@/lib/tarifa";
import { BorrarGasto, FormGasto } from "./Gastos";

export const metadata = { title: "Reportes y finanzas — FleteYa" };

type Params = { periodo?: string; desde?: string; hasta?: string; todos?: string };
const TOPE_MOTORISTAS = 15;

export default async function Reportes({ searchParams }: { searchParams: Promise<Params> }) {
  await exigirPropietario();
  const sp = await searchParams;
  const p = periodo(sp.periodo, sp.desde, sp.hasta);
  const hoy = diaSV();
  const [r, serie, motoristas, puntos, creditos, gastos] = await Promise.all([
    resumenPeriodo(p), seriePeriodo(p), porMotorista(p), porPuntoQr(p), creditosActuales(),
    db.gasto.findMany({ where: { fecha: { gte: fechaGasto(p.desde), lte: fechaGasto(p.hasta) } }, orderBy: [{ fecha: "desc" }, { creadoEn: "desc" }], take: 200,
      include: { registradoPor: { select: { nombre: true } } } }),
  ]);
  const fechas = `desde=${p.desde}&hasta=${p.hasta}`;
  const verTodos = sp.todos === "1";
  const filasMotoristas = verTodos ? motoristas : motoristas.slice(0, TOPE_MOTORISTAS);
  const maxViajes = Math.max(1, ...serie.map((s) => s.viajes));
  const maxDinero = Math.max(1, ...serie.map((s) => Math.max(s.comision, s.recargas)));
  const pctCancel = r.pedidos ? Math.round((r.cancelados / r.pedidos) * 100) : 0;

  const tarjeta = (titulo: string, valor: string, pie: string, icono: string, color: string, testid: string) => (
    <div className="tarjeta p-4 lg:p-5" data-testid={testid}>
      <p className="seccion-titulo flex items-center gap-2"><i className={`fa-solid ${icono} ${color}`} />{titulo}</p>
      <p className={`mt-2 text-2xl font-extrabold tabular-nums lg:text-3xl ${color === "text-suave" ? "" : color}`} data-testid={`${testid}-valor`}>{valor}</p>
      <p className="mt-1 text-xs text-suave">{pie}</p>
    </div>
  );

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[24px] font-extrabold lg:text-[28px]">Reportes y finanzas</h1>
          <p className="mt-1 text-sm text-suave">{p.nombre}: <span data-testid="periodo-texto">{textoPeriodo(p)}</span>. Hora de El Salvador.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/viajes?f=entregados&${fechas}`} className="btn-secundario h-10"><i className="fa-solid fa-file-excel text-exito" />Viajes</a>
          <a href={`/api/recargas?${fechas}`} className="btn-secundario h-10"><i className="fa-solid fa-file-excel text-exito" />Recargas</a>
          <a href={`/api/gastos?${fechas}`} className="btn-secundario h-10"><i className="fa-solid fa-file-excel text-exito" />Gastos</a>
        </div>
      </div>

      <div className="tarjeta mt-5 flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-borde bg-fondo p-1 text-sm">
          {PERIODOS.filter((x) => x.clave !== "rango").map((x) => (
            <Link key={x.clave} href={`/panel/reportes?periodo=${x.clave}`}
              className={`flex h-8 shrink-0 items-center rounded-md px-3 ${x.clave === p.clave ? "bg-tarjeta-2 font-semibold" : "text-suave"}`}>{x.nombre}</Link>
          ))}
        </div>
        <form action="/panel/reportes" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="periodo" value="rango" />
          <label className="text-xs"><span className="sr-only">Desde</span>
            <input type="date" name="desde" defaultValue={p.desde} max={hoy} aria-label="Desde" className="campo h-9 w-[150px]" /></label>
          <span className="pb-2 text-xs text-suave">a</span>
          <label className="text-xs"><span className="sr-only">Hasta</span>
            <input type="date" name="hasta" defaultValue={p.hasta} max={hoy} aria-label="Hasta" className="campo h-9 w-[150px]" /></label>
          <button type="submit" className={`btn-secundario h-9 ${p.clave === "rango" ? "border-naranja text-naranja" : ""}`}>Ver</button>
        </form>
      </div>

      <h2 className="mt-6 mb-3 flex items-center gap-2 font-bold"><i className="fa-solid fa-sack-dollar text-naranja" />Dinero de FleteYa</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tarjeta("Recargas cobradas", dinero(r.recargado), `${r.recargas} recarga(s) · efectivo ${dinero(r.efectivo)} · transferencia ${dinero(r.transferencia)}`, "fa-coins", "text-exito", "rep-recargas")}
        {tarjeta("Gastos", dinero(r.gastado), `${r.gastos} gasto(s) anotado(s) abajo`, "fa-receipt", "text-error", "rep-gastos")}
        {tarjeta("Ganancia neta", dinero(r.ganancia), "Recargas cobradas menos gastos", "fa-scale-balanced", r.ganancia < 0 ? "text-error" : "text-naranja", "rep-ganancia")}
        {tarjeta("Comisión de viajes", dinero(r.comision), "Descontada de los créditos de los motoristas", "fa-percent", "text-suave", "rep-comision")}
      </div>
      <p className="mt-2 text-xs text-suave">
        El dinero entra a FleteYa con las <b>recargas</b> (planes de los motoristas). La <b>comisión</b> se descuenta de esos créditos al entregar cada viaje, por eso no se suma otra vez.
        Hoy los motoristas tienen <b data-testid="creditos-favor">{dinero(creditos.aFavor)}</b> en créditos sin usar ({creditos.conSaldo})
        {creditos.deuda > 0 && <> y deben <b className="text-error">{dinero(creditos.deuda)}</b> ({creditos.conDeuda} con saldo negativo)</>}.
      </p>

      <h2 className="mt-6 mb-3 flex items-center gap-2 font-bold"><i className="fa-solid fa-route text-naranja" />Viajes</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tarjeta("Entregados", String(r.entregados), "Por fecha de entrega", "fa-flag-checkered", "text-exito", "rep-entregados")}
        {tarjeta("Cobrado por motoristas", dinero(r.cobrado), "Lo pagó el cliente al motorista en efectivo", "fa-money-bill-wave", "text-suave", "rep-cobrado")}
        {tarjeta("Precio promedio", dinero(r.promedioViaje), "Por viaje entregado", "fa-tag", "text-suave", "rep-promedio")}
        {tarjeta("Pedidos", String(r.pedidos), `${r.cancelados} cancelado(s) · ${pctCancel} %`, "fa-clipboard-list", "text-suave", "rep-pedidos")}
      </div>

      <section className="tarjeta mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">{p.dias > 62 ? "Por mes" : "Por día"}</h2>
          <div className="flex gap-4 text-xs text-suave">
            <span><i className="fa-solid fa-square mr-1 text-naranja" />Viajes</span>
            <span><i className="fa-solid fa-square mr-1 text-exito" />Recargas</span>
            <span><i className="fa-solid fa-square mr-1 text-amarillo" />Comisión</span>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto pb-1">
          <div className="flex h-44 min-w-full items-end gap-1" style={{ width: serie.length > 16 ? `${serie.length * 28}px` : undefined }} data-testid="grafica">
            {serie.map((s) => (
              <div key={s.clave} className="flex h-full min-w-[22px] flex-1 flex-col items-center justify-end gap-1"
                title={`${s.etiqueta}: ${s.viajes} viaje(s), recargas ${dinero(s.recargas)}, comisión ${dinero(s.comision)}`}>
                <span className="text-[10px] tabular-nums text-suave">{s.viajes || ""}</span>
                <div className="flex w-full flex-1 items-end justify-center gap-[2px]">
                  <div className="w-1/3 rounded-t bg-naranja" style={{ height: `${(s.viajes / maxViajes) * 100}%` }} />
                  <div className="w-1/3 rounded-t bg-exito" style={{ height: `${(s.recargas / maxDinero) * 100}%` }} />
                  <div className="w-1/3 rounded-t bg-amarillo" style={{ height: `${(s.comision / maxDinero) * 100}%` }} />
                </div>
                <span className="w-full truncate text-center text-[9px] text-suave">{s.etiqueta}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="tarjeta overflow-hidden">
          <h2 className="border-b border-borde px-5 py-4 font-bold">Por motorista</h2>
          {motoristas.length === 0 ? <p className="px-5 py-6 text-sm text-suave">Sin viajes ni recargas en este periodo.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-suave">
                  <tr><th className="px-5 py-2.5 font-semibold">Motorista</th><th className="px-2 text-right font-semibold">Viajes</th><th className="px-2 text-right font-semibold">Cobrado</th>
                    <th className="px-2 text-right font-semibold">Comisión</th><th className="px-2 text-right font-semibold">Recargó</th><th className="px-5 text-right font-semibold">Estrellas</th></tr>
                </thead>
                <tbody className="divide-y divide-borde">
                  {filasMotoristas.map((m) => (
                    <tr key={m.id} data-testid={`rep-motorista-${m.id}`}>
                      <td className="px-5 py-3"><Link href={`/panel/viajes?f=entregados&m=${m.id}&${fechas}`} className="font-semibold hover:text-naranja">{m.nombre}</Link>
                        <span className={`block text-[11px] ${m.saldo < 0 ? "text-error" : "text-suave"}`}>Saldo hoy {dinero(m.saldo)}</span></td>
                      <td className="px-2 text-right tabular-nums">{m.viajes}</td>
                      <td className="px-2 text-right tabular-nums">{dinero(m.cobrado)}</td>
                      <td className="px-2 text-right tabular-nums">{dinero(m.comision)}</td>
                      <td className="px-2 text-right tabular-nums">{m.recargado ? dinero(m.recargado) : "—"}</td>
                      <td className="px-5 text-right tabular-nums">{m.estrellas ? <><i className="fa-solid fa-star mr-1 text-[10px] text-amarillo" />{m.estrellas.toFixed(1)} <span className="text-[11px] text-suave">({m.calificaciones})</span></> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {motoristas.length > TOPE_MOTORISTAS && (
                <Link href={`/panel/reportes?periodo=${p.clave}&${fechas}${verTodos ? "" : "&todos=1"}`} className="block border-t border-borde px-5 py-3 text-center text-sm font-semibold text-naranja">
                  {verTodos ? `Ver solo los ${TOPE_MOTORISTAS} primeros` : `Ver los ${motoristas.length} motoristas`}
                </Link>
              )}
            </div>
          )}
        </section>

        <section className="tarjeta overflow-hidden">
          <h2 className="border-b border-borde px-5 py-4 font-bold">Por punto QR</h2>
          {puntos.length === 0 ? <p className="px-5 py-6 text-sm text-suave">Sin pedidos en este periodo.</p> : (
            <ul className="divide-y divide-borde text-sm">
              {puntos.map((x) => (
                <li key={x.id ?? "sin"} className="flex items-center gap-3 px-5 py-3" data-testid="rep-punto">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{x.codigo && <span className="mr-1.5 rounded bg-naranja/15 px-1 font-mono text-[10px] font-bold text-naranja">{x.codigo}</span>}{x.nombre}</p>
                    <p className="text-xs text-suave">{x.entregados} entregado(s) · {dinero(x.cobrado)}</p>
                  </div>
                  <p className="text-right text-sm font-bold tabular-nums">{x.pedidos}<span className="block text-[11px] font-normal text-suave">pedidos</span></p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="tarjeta mt-4 overflow-hidden" id="gastos">
        <div className="border-b border-borde px-5 py-4">
          <h2 className="font-bold">Gastos de FleteYa</h2>
          <p className="mt-1 text-xs text-suave">Anota lo que gasta el negocio (publicidad, carteles, teléfono...) para que la ganancia neta sea real.</p>
          <div className="mt-4"><FormGasto hoy={hoy} categorias={CATEGORIAS_GASTO} /></div>
        </div>
        {gastos.length === 0 ? <p className="px-5 py-6 text-sm text-suave">No hay gastos anotados en este periodo.</p> : (
          <ul className="divide-y divide-borde text-sm">
            {gastos.map((g) => (
              <li key={g.id} className="flex items-center gap-3 px-5 py-3" data-testid="fila-gasto">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{g.concepto}</p>
                  <p className="text-xs text-suave">{fechaLarga(g.fecha.toISOString().slice(0, 10))} · {g.categoria} · anotó {g.registradoPor.nombre}</p>
                </div>
                <p className="font-bold tabular-nums text-error">-{dinero(Number(g.monto))}</p>
                <BorrarGasto id={g.id} texto={g.concepto} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
