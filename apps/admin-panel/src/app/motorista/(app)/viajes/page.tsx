import { db } from "@/lib/db";
import { inicioDelDia } from "@/lib/inicio-motorista";
import { exigirMotorista } from "@/lib/sesion-motorista";
import { ESTADOS_VIAJE, dinero, numeroViaje } from "@/lib/tarifa";
import { fechaHora } from "@/lib/validacion";

export const metadata = { title: "Mis viajes — FleteYa Motorista" };

const PERIODOS = { hoy: "Hoy", semana: "7 días", mes: "30 días" } as const;

export default async function ViajesMotorista({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const m = await exigirMotorista();
  const p = ((await searchParams).p ?? "semana") as keyof typeof PERIODOS;
  const periodo = p in PERIODOS ? p : "semana";
  const hoy = inicioDelDia();
  const desde = periodo === "hoy" ? hoy : new Date(hoy.getTime() - (periodo === "semana" ? 6 : 29) * 86400000);

  const [resumen, viajes] = await Promise.all([
    db.viaje.aggregate({ where: { motoristaId: m.id, estado: "ENTREGADO", entregadoEn: { gte: desde } }, _count: true, _sum: { precioFinal: true, comision: true } }),
    db.viaje.findMany({
      where: { motoristaId: m.id, estado: { in: ["ENTREGADO", "CANCELADO"] }, OR: [{ entregadoEn: { gte: desde } }, { canceladoEn: { gte: desde } }] },
      orderBy: { creadoEn: "desc" }, take: 100,
      select: { id: true, numero: true, estado: true, origenDireccion: true, destinoDireccion: true, precioFinal: true, comision: true, entregadoEn: true, canceladoEn: true, distanciaKm: true, pesoKg: true },
    }),
  ]);
  const cobrado = Number(resumen._sum.precioFinal ?? 0);
  const comision = Number(resumen._sum.comision ?? 0);

  return (
    <main className="px-5 pt-6">
      <h1 className="text-2xl font-extrabold">Viajes y ganancias</h1>
      <nav className="mt-4 grid grid-cols-3 gap-1 rounded-full bg-tarjeta p-1" aria-label="Periodo">
        {Object.entries(PERIODOS).map(([k, t]) => (
          <a key={k} href={`?p=${k}`} aria-current={k === periodo ? "page" : undefined}
            className={`rounded-full py-2 text-center text-sm font-semibold ${k === periodo ? "bg-naranja text-fondo" : "text-suave"}`}>{t}</a>
        ))}
      </nav>

      <section className="mt-4 grid grid-cols-3 gap-2.5" data-testid="resumen-viajes">
        <div className="tarjeta p-3"><p className="text-[11px] text-suave">Viajes</p><p className="mt-1 text-xl font-extrabold tabular-nums">{resumen._count}</p></div>
        <div className="tarjeta p-3"><p className="text-[11px] text-suave">Cobrado</p><p className="mt-1 text-xl font-extrabold tabular-nums">{dinero(cobrado)}</p></div>
        <div className="tarjeta p-3"><p className="text-[11px] text-suave">Comisión</p><p className="mt-1 text-xl font-extrabold text-error tabular-nums">-{dinero(comision)}</p></div>
      </section>
      <p className="mt-2 text-xs text-suave">Lo cobrado es efectivo que recibiste de los clientes. La comisión se descontó de tus créditos, no de ese efectivo.</p>

      <section className="mt-5 pb-6">
        <h2 className="seccion-titulo mb-3">Detalle</h2>
        {viajes.length === 0 ? <p className="tarjeta p-5 text-center text-sm text-suave">No hay viajes en este periodo.</p> : (
          <ul className="tarjeta divide-y divide-borde">
            {viajes.map((v) => {
              const e = ESTADOS_VIAJE[v.estado];
              const f = v.entregadoEn ?? v.canceladoEn;
              return (
                <li key={v.id} className="p-3.5" data-testid="viaje-historial">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-suave">{numeroViaje(v.numero)} · {f ? fechaHora(f) : ""}</p>
                      <p className="mt-0.5 truncate text-sm font-semibold">{v.origenDireccion} → {v.destinoDireccion}</p>
                      <p className="text-xs text-suave">{Number(v.distanciaKm).toFixed(1)} km · {(Number(v.pesoKg) / 1000).toFixed(2)} ton</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {v.estado === "ENTREGADO" ? (
                        <><p className="font-bold tabular-nums">{dinero(Number(v.precioFinal ?? 0))}</p><p className="text-[11px] text-error tabular-nums">-{dinero(Number(v.comision ?? 0))}</p></>
                      ) : <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${e.clase}`}>{e.nombre}</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
