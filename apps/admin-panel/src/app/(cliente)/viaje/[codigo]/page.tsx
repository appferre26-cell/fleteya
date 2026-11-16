import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ESTADOS_VIAJE, dinero, kg, numeroViaje } from "@/lib/tarifa";
import { fechaHora } from "@/lib/validacion";
import { AccionesViaje } from "./AccionesViaje";

export const metadata: Metadata = { title: "Tu flete — FleteYa", robots: { index: false, follow: false } };

export default async function ViajeCliente({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const v = await db.viaje.findUnique({ where: { codigo }, include: { items: true } });
  if (!v) notFound();
  const e = ESTADOS_VIAJE[v.estado];
  const activo = v.estado !== "CANCELADO" && v.estado !== "ENTREGADO";

  return (
    <main className="px-5 pt-5 pb-8">
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${e.clase}`} data-testid="estado-viaje">
          <i className={`fa-solid ${e.icono} text-xs`} /> {e.nombre}
        </span>
        <span className="text-xs text-suave">Pedido #{numeroViaje(v.numero)}</span>
      </div>

      {v.estado === "BUSCANDO" && (
        <section className="mt-6 flex flex-col items-center text-center">
          <div className="relative flex h-28 w-28 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-naranja/25" />
            <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-naranja"><i className="fa-solid fa-truck-fast text-2xl text-fondo" /></span>
          </div>
          <h1 className="mt-5 text-xl font-extrabold">Estamos buscando tu motorista</h1>
          <p className="mt-1 max-w-sm text-sm text-suave">Avisamos a los motoristas cercanos cuyo vehículo aguanta tu carga. Cuando uno acepte, aquí verás su nombre, placa y un botón para llamarle.</p>
          <p className="mt-2 text-xs text-suave">Puedes cerrar esta página: guarda el enlace para volver.</p>
        </section>
      )}
      {v.estado === "CANCELADO" && (
        <section className="mt-6 rounded-xl border border-error/30 bg-error/10 p-4 text-sm">
          <p className="font-semibold text-error">Este pedido fue cancelado{v.canceladoPor === "PROPIETARIO" ? " por FleteYa" : ""}.</p>
          {v.motivoCancelacion && <p className="mt-1 text-suave">Motivo: {v.motivoCancelacion}</p>}
        </section>
      )}

      <section className="mt-6">
        <h2 className="seccion-titulo mb-3">Detalle del viaje</h2>
        <div className="tarjeta divide-y divide-borde">
          <div className="flex gap-3 p-3.5">
            <div className="flex flex-col items-center pt-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-naranja" /><span className="my-1 w-px flex-1 bg-[#3a3a3a]" /><span className="h-2.5 w-2.5 rounded-sm bg-texto" />
            </div>
            <div className="flex-1 space-y-3 text-sm">
              <div><p className="text-[11px] text-suave">Recogida</p><p className="font-medium">{v.origenDireccion}</p></div>
              <div><p className="text-[11px] text-suave">Destino · {Number(v.distanciaKm).toFixed(1)} km</p><p className="font-medium">{v.destinoDireccion}</p></div>
            </div>
          </div>
          <ul className="p-3.5 text-sm">
            {v.items.map((i) => (
              <li key={i.id} className="flex justify-between py-1">
                <span>{Number(i.cantidad)} × {i.nombre}</span><span className="text-suave tabular-nums">{kg(Number(i.pesoTotalKg))}</span>
              </li>
            ))}
            <li className="mt-1 flex justify-between border-t border-borde pt-2 font-semibold"><span>Peso estimado</span><span className="tabular-nums">{kg(Number(v.pesoKg))}</span></li>
          </ul>
          {v.nota && <p className="p-3.5 text-sm"><span className="text-suave">Nota: </span>{v.nota}</p>}
          <div className="flex items-center justify-between p-3.5">
            <span className="text-sm"><i className="fa-solid fa-money-bill-wave mr-2 text-exito" />Efectivo al terminar</span>
            <span className="text-lg font-extrabold text-naranja" data-testid="precio-viaje">{dinero(Number(v.precioBase))}</span>
          </div>
          {v.fueraDeRango && (
            <p className="p-3.5 text-xs text-suave"><i className="fa-solid fa-route mr-1.5 text-naranja" />Como el destino está lejos, el motorista te puede ofrecer otro precio. Tú decides si lo aceptas.</p>
          )}
        </div>
        <p className="mt-2 text-[11px] text-suave">Pedido el {fechaHora(v.creadoEn)} a nombre de {v.clienteNombre}.</p>
      </section>

      <AccionesViaje codigo={v.codigo} activo={activo} buscando={v.estado === "BUSCANDO"} />
    </main>
  );
}
