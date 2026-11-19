import Link from "next/link";
import { db } from "@/lib/db";
import { exigirPropietario } from "@/lib/sesion";
import { TOTAL_REQUISITOS, diasParaVencer, fechaCorta, fechaHora } from "@/lib/validacion";
import { textoAccion } from "@/lib/historial";
import { obtenerConfig, zonaDe } from "@/lib/config";
import { datosEnVivo } from "@/lib/en-vivo";
import { periodo } from "@/lib/periodos";
import { resumenPeriodo } from "@/lib/reportes";
import { dinero } from "@/lib/tarifa";
import { EnVivo } from "./EnVivo";

export const metadata = { title: "Inicio — FleteYa" };

export default async function InicioPanel() {
  const yo = await exigirPropietario();
  const periodos = [periodo("hoy"), periodo("semana"), periodo("mes")];
  const [cfg, vivo, resumenes] = await Promise.all([obtenerConfig(), datosEnVivo(), Promise.all(periodos.map(resumenPeriodo))]);
  const [grupos, pendientes, licencias, recientes, buscando] = await Promise.all([
    db.motorista.groupBy({ by: ["estado"], _count: true }),
    db.motorista.findMany({ where: { estado: "PENDIENTE" }, orderBy: { creadoEn: "asc" }, take: 5,
      select: { id: true, nombre: true, creadoEn: true, _count: { select: { documentos: true } } } }),
    db.motorista.findMany({
      where: { estado: { not: "SUSPENDIDO" }, licenciaVence: { lte: new Date(Date.now() + 30 * 86400000) } },
      orderBy: { licenciaVence: "asc" }, select: { id: true, nombre: true, licenciaVence: true },
    }),
    db.historialMotorista.findMany({ orderBy: { fecha: "desc" }, take: 6,
      include: { motorista: { select: { id: true, nombre: true } }, propietario: { select: { nombre: true } } } }),
    db.viaje.count({ where: { estado: "BUSCANDO" } }),
  ]);
  const n = (e: string) => grupos.find((g) => g.estado === e)?._count ?? 0;
  const total = grupos.reduce((s, g) => s + g._count, 0);

  return (
    <>
      <h1 className="text-[26px] leading-tight font-extrabold lg:text-[28px]">Hola, {yo.nombre.split(" ")[0]}</h1>
      <p className="mt-1 text-sm text-suave">Así va FleteYa en {cfg.zonaNombre || "tu zona"}.</p>

      <EnVivo inicial={vivo} zona={zonaDe(cfg)} />

      <section className="tarjeta mt-4 overflow-hidden" data-testid="ingresos">
        <div className="flex items-center justify-between gap-2 border-b border-borde px-5 py-4">
          <h2 className="flex items-center gap-2 font-bold"><i className="fa-solid fa-chart-column text-naranja" />Viajes e ingresos</h2>
          <Link href="/panel/reportes" className="text-sm font-semibold text-naranja">Ver reportes <i className="fa-solid fa-arrow-right ml-1 text-xs" /></Link>
        </div>
        <div className="grid grid-cols-3 divide-x divide-borde">
          {periodos.map((p, i) => {
            const r = resumenes[i];
            return (
              <Link key={p.clave} href={`/panel/reportes?periodo=${p.clave}`} className="px-3 py-4 hover:bg-[#232323] sm:px-5" data-testid={`ingresos-${p.clave}`}>
                <p className="seccion-titulo">{p.nombre}</p>
                <p className="mt-1.5 text-2xl font-extrabold tabular-nums">{r.entregados} <span className="text-xs font-semibold text-suave">{r.entregados === 1 ? "viaje" : "viajes"}</span></p>
                <dl className="mt-2 space-y-0.5 text-xs text-suave">
                  <div className="flex flex-wrap justify-between gap-x-2"><dt>Cobrado</dt><dd className="font-semibold text-texto tabular-nums">{dinero(r.cobrado)}</dd></div>
                  <div className="flex flex-wrap justify-between gap-x-2"><dt>Comisión</dt><dd className="font-semibold text-amarillo tabular-nums">{dinero(r.comision)}</dd></div>
                  <div className="flex flex-wrap justify-between gap-x-2"><dt>Recargas</dt><dd className="font-semibold text-exito tabular-nums">{dinero(r.recargado)}</dd></div>
                </dl>
              </Link>
            );
          })}
        </div>
      </section>

      <h2 className="mt-6 mb-3 flex items-center gap-2 font-bold"><i className="fa-solid fa-id-card text-naranja" />Motoristas</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Motoristas", total, "fa-id-card", "text-texto"],
          ["Activos", n("ACTIVO"), "fa-circle-check", "text-exito"],
          ["Pendientes", n("PENDIENTE"), "fa-clock", "text-naranja"],
          ["Suspendidos", n("SUSPENDIDO"), "fa-ban", "text-error"],
        ].map(([t, v, i, c]) => (
          <div key={t as string} className="tarjeta p-4">
            <p className="seccion-titulo flex items-center gap-2"><i className={`fa-solid ${i} ${c}`} />{t}</p>
            <p className={`mt-2 text-3xl font-extrabold tabular-nums ${c}`}>{v}</p>
          </div>
        ))}
      </div>

      {buscando > 0 && (
        <Link href="/panel/viajes?f=buscando" className="mt-6 flex items-center gap-4 rounded-xl border border-naranja/30 bg-naranja/[0.07] px-5 py-4">
          <i className="fa-solid fa-route text-naranja" />
          <p className="flex-1 text-sm font-semibold">{buscando === 1 ? "1 viaje busca motorista" : `${buscando} viajes buscan motorista`}</p>
          <span className="text-sm font-semibold text-naranja">Ver viajes <i className="fa-solid fa-arrow-right ml-1 text-xs" /></span>
        </Link>
      )}

      {total === 0 && (
        <div className="tarjeta mt-6 flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-naranja/15"><i className="fa-solid fa-user-plus text-naranja" /></div>
          <div className="flex-1">
            <p className="font-semibold">Todavía no hay motoristas</p>
            <p className="text-sm text-suave">Empieza registrando a tu primer motorista con su DUI, licencia y tarjeta de circulación.</p>
          </div>
          <Link href="/panel/motoristas/nuevo" className="btn-primario">Agregar motorista</Link>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="tarjeta p-5">
          <h2 className="flex items-center gap-2 font-bold"><i className="fa-solid fa-file-circle-check text-naranja" />Esperan aprobación</h2>
          {pendientes.length === 0 ? <p className="mt-3 text-sm text-suave">No hay motoristas pendientes.</p> : (
            <ul className="mt-3 divide-y divide-borde">
              {pendientes.map((m) => (
                <li key={m.id}>
                  <Link href={`/panel/motoristas/${m.id}`} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span><span className="font-semibold">{m.nombre}</span><span className="block text-xs text-suave">Registrado el {fechaCorta(m.creadoEn)} · {m._count.documentos}/{TOTAL_REQUISITOS} documentos</span></span>
                    <span className="text-xs font-semibold text-naranja">Revisar <i className="fa-solid fa-arrow-right ml-1" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="tarjeta p-5">
          <h2 className="flex items-center gap-2 font-bold"><i className="fa-solid fa-id-badge text-naranja" />Licencias por vencer (30 días)</h2>
          {licencias.length === 0 ? <p className="mt-3 text-sm text-suave">Ninguna licencia vence pronto.</p> : (
            <ul className="mt-3 divide-y divide-borde">
              {licencias.map((m) => {
                const d = diasParaVencer(m.licenciaVence);
                return (
                  <li key={m.id}>
                    <Link href={`/panel/motoristas/${m.id}`} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <span className="font-semibold">{m.nombre}</span>
                      <span className={`text-xs font-semibold ${d < 0 ? "text-error" : "text-naranja"}`}>
                        {d < 0 ? `Vencida hace ${-d} días` : d === 0 ? "Vence hoy" : `Vence en ${d} días`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="tarjeta mt-4 p-5">
        <h2 className="flex items-center gap-2 font-bold"><i className="fa-solid fa-clock-rotate-left text-naranja" />Últimos movimientos</h2>
        {recientes.length === 0 ? <p className="mt-3 text-sm text-suave">Aún no hay movimientos.</p> : (
          <ul className="mt-3 divide-y divide-borde text-sm">
            {recientes.map((h) => (
              <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-3">
                <span><Link href={`/panel/motoristas/${h.motorista.id}`} className="font-semibold hover:text-naranja">{h.motorista.nombre}</Link>{" "}
                  <span className="text-suave">— {textoAccion(h.accion)} por {h.propietario ? h.propietario.nombre : "el motorista"}</span></span>
                <span className="text-xs text-suave">{fechaHora(h.fecha)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
