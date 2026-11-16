import { db } from "@/lib/db";
import { obtenerConfig } from "@/lib/config";
import { dinero } from "@/lib/tarifa";
import { BotonEjemplos, FilaMaterial, FormMaterial } from "./Piezas";

export default async function Catalogo() {
  const [materiales, cfg] = await Promise.all([
    db.material.findMany({ orderBy: [{ activo: "desc" }, { orden: "asc" }, { nombre: "asc" }], include: { _count: { select: { items: true } } } }),
    obtenerConfig(),
  ]);
  const visibles = materiales.filter((m) => m.activo).length;

  return (
    <>
      <h1 className="text-[24px] font-extrabold lg:text-[28px]">Catálogo de materiales</h1>
      <p className="mt-1 text-sm text-suave">Lo que el cliente elige en «¿Qué vas a llevar?». La app suma estos pesos para calcular el precio.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="tarjeta overflow-hidden">
          <div className="flex items-center justify-between border-b border-borde px-4 py-3">
            <h2 className="font-bold">Materiales <span className="text-sm font-normal text-suave">· {visibles} visibles</span></h2>
          </div>
          {materiales.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <i className="fa-solid fa-cubes text-3xl text-suave" />
              <p className="mt-3 font-semibold">Todavía no hay materiales</p>
              <p className="mt-1 text-sm text-suave">Agrégalos a la derecha, o carga los 7 ejemplos del documento del proyecto para revisarlos y ajustarlos.</p>
              <BotonEjemplos />
            </div>
          ) : (
            <ul className="divide-y divide-borde">
              {materiales.map((m) => (
                <FilaMaterial key={m.id} m={{ id: m.id, nombre: m.nombre, unidad: m.unidad, pesoKg: Number(m.pesoKg), activo: m.activo, usos: m._count.items }} />
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-4">
          <FormMaterial />
          <section className="tarjeta p-5 text-sm">
            <h2 className="font-bold">Así calcula la app</h2>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-fondo p-3 font-mono text-[11px] leading-relaxed text-suave">{`10 × Cemento ........ 425 kg
50 × Bloque 15 cm ... 650 kg
10 × Varilla 3/8" ..  34 kg
─────────────────────────
Total ........ 1,109 kg
1.109 ton × ${dinero(cfg.precioTonelada)} = ${dinero(1.109 * cfg.precioTonelada)}`}</pre>
            <ul className="mt-3 space-y-1.5 text-xs text-suave">
              <li>Mínimo {dinero(cfg.tarifaMinima)} · incluye {cfg.kmIncluidos} km · proporcional al peso.</li>
              <li>Los pesos son aproximados. Conviene revisarlos con una ferretería.</li>
              <li>Si un material no está, el cliente usa «Otro» y escribe su peso.</li>
              <li>Ocultar un material lo quita de la lista del cliente sin borrarlo.</li>
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
