import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Mapa, type PuntoMapa } from "@/components/Mapa";
import { ESTADOS_VIAJE, centavos, dinero, distanciaKm, kg, numeroViaje } from "@/lib/tarifa";
import { TIPOS_VEHICULO, fechaHora, formatoTelefono } from "@/lib/validacion";
import { AccionesViaje } from "./AccionesViaje";
import { Ofertas } from "./Ofertas";

const PASOS = [
  ["ASIGNADO", "Aceptado", "asignadoEn"],
  ["EN_CAMINO", "Va a recoger", "enCaminoEn"],
  ["CARGANDO", "Cargando", "cargandoEn"],
  ["EN_RUTA", "En ruta", "enRutaEn"],
  ["ENTREGADO", "Entregado", "entregadoEn"],
] as const;

export const metadata: Metadata = { title: "Tu flete — FleteYa", robots: { index: false, follow: false } };

export default async function ViajeCliente({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const v = await db.viaje.findUnique({
    where: { codigo },
    include: {
      items: true,
      motorista: { select: { nombre: true, telefono: true, placa: true, marca: true, modelo: true, tipoVehiculo: true, lat: true, lng: true, ubicacionEn: true } },
      ofertas: {
        where: { estado: "PENDIENTE", motorista: { disponible: true } }, orderBy: { precio: "asc" },
        include: { motorista: { select: { nombre: true, marca: true, modelo: true, tipoVehiculo: true, lat: true, lng: true } } },
      },
    },
  });
  if (!v) notFound();
  const e = ESTADOS_VIAJE[v.estado];
  const activo = v.estado !== "CANCELADO" && v.estado !== "ENTREGADO";
  const m = v.motorista;
  const precio = Number(v.precioFinal ?? v.precioBase);
  const paso = PASOS.findIndex(([k]) => k === v.estado);
  // La ubicación del motorista solo se muestra mientras va a recoger y si es reciente (10 min).
  const verUbicacion = m && (v.estado === "ASIGNADO" || v.estado === "EN_CAMINO") && m.lat != null && m.lng != null
    && m.ubicacionEn && Date.now() - m.ubicacionEn.getTime() < 10 * 60_000;
  const puntos: PuntoMapa[] = [
    { id: "o", lat: v.origenLat, lng: v.origenLng, color: "#FF6B00", icono: "fa-box", etiqueta: "Recogida" },
    { id: "d", lat: v.destinoLat, lng: v.destinoLng, color: "#F5F5F5", icono: "fa-flag-checkered", etiqueta: "Destino" },
  ];
  if (verUbicacion) puntos.push({ id: "m", lat: m.lat!, lng: m.lng!, color: "#4CAF50", icono: "fa-truck", etiqueta: m.nombre.split(" ")[0] });
  const ofertas = v.estado === "BUSCANDO" ? v.ofertas.map((o) => ({
    id: o.id, precio: Number(o.precio), nombre: o.motorista.nombre.split(" ")[0],
    vehiculo: `${TIPOS_VEHICULO[o.motorista.tipoVehiculo].nombre} ${o.motorista.marca}`,
    kmDeRecogida: o.motorista.lat != null && o.motorista.lng != null ? centavos(distanciaKm({ lat: o.motorista.lat, lng: o.motorista.lng }, { lat: v.origenLat, lng: v.origenLng })) : null,
  })) : [];

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
      {ofertas.length > 0 && <Ofertas codigo={v.codigo} ofertas={ofertas} precioBase={Number(v.precioBase)} />}

      {m && v.estado !== "CANCELADO" && (
        <section className="mt-6" data-testid="motorista-asignado">
          <h2 className="seccion-titulo mb-3">{v.estado === "ENTREGADO" ? "Te atendió" : "Tu motorista"}</h2>
          <div className="tarjeta p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-tarjeta-2"><i className="fa-solid fa-user text-suave" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-bold" data-testid="nombre-motorista">{m.nombre}</p>
                <p className="text-xs text-suave">{TIPOS_VEHICULO[m.tipoVehiculo].nombre} · {m.marca} {m.modelo}</p>
              </div>
              <span className="rounded-md border border-borde bg-fondo px-2 py-1 font-mono text-sm font-bold" data-testid="placa">{m.placa}</span>
            </div>
            {activo && (
              <a href={`tel:+503${m.telefono}`} className="btn-primario mt-4 w-full" data-testid="llamar-motorista">
                <i className="fa-solid fa-phone" />Llamar a {m.nombre.split(" ")[0]} · {formatoTelefono(m.telefono)}
              </a>
            )}
          </div>
          {paso >= 0 && (
            <ol className="tarjeta mt-3 space-y-0 p-4" aria-label="Avance del viaje">
              {PASOS.map(([k, t, campo], n) => {
                const f = v[campo];
                return (
                  <li key={k} className="flex items-center gap-3 py-1.5 text-sm">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${n <= paso ? "bg-naranja text-fondo" : "bg-tarjeta-2 text-suave"}`}>
                      {n < paso || v.estado === "ENTREGADO" ? <i className="fa-solid fa-check" /> : n + 1}
                    </span>
                    <span className={`flex-1 ${n === paso ? "font-bold" : n < paso ? "" : "text-suave"}`}>{t}</span>
                    {f && <span className="text-xs text-suave">{fechaHora(f)}</span>}
                  </li>
                );
              })}
            </ol>
          )}
          {activo && <Mapa centro={verUbicacion ? { lat: m.lat!, lng: m.lng! } : { lat: v.origenLat, lng: v.origenLng }} puntos={puntos} className="mt-3 h-52" etiqueta="Mapa del viaje" />}
          {activo && (v.estado === "ASIGNADO" || v.estado === "EN_CAMINO") && !verUbicacion && <p className="mt-2 text-xs text-suave">La ubicación del motorista aparece cuando su teléfono la comparte.</p>}
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
            <span className="text-lg font-extrabold text-naranja" data-testid="precio-viaje">{dinero(precio)}</span>
          </div>
          {v.fueraDeRango && !v.motoristaId && (
            <p className="p-3.5 text-xs text-suave"><i className="fa-solid fa-route mr-1.5 text-naranja" />Como el destino está lejos, el motorista te puede ofrecer otro precio. Tú decides si lo aceptas.</p>
          )}
        </div>
        <p className="mt-2 text-[11px] text-suave">Pedido el {fechaHora(v.creadoEn)} a nombre de {v.clienteNombre}.</p>
      </section>

      <AccionesViaje codigo={v.codigo} activo={activo} cancelable={["BUSCANDO", "ASIGNADO", "EN_CAMINO"].includes(v.estado)} />
    </main>
  );
}
