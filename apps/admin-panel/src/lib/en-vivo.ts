import "server-only";
import { db } from "@/lib/db";
import { EN_CURSO } from "@/lib/filtro-viajes";
import { numeroViaje } from "@/lib/tarifa";

const CONECTADO_MS = 2 * 60_000; // la app manda su ubicación cada 20 s
const UBICACION_VIAJE_MS = 10 * 60_000;

/** Lo que se ve en el mapa en vivo del inicio del panel. */
export async function datosEnVivo() {
  const ahora = Date.now();
  const [motoristas, viajes] = await Promise.all([
    db.motorista.findMany({
      where: { estado: "ACTIVO", OR: [{ disponible: true, vistoEn: { gte: new Date(ahora - CONECTADO_MS) } }, { viajes: { some: { estado: { in: EN_CURSO } } } }] },
      select: { id: true, nombre: true, placa: true, lat: true, lng: true, ubicacionEn: true, disponible: true, vistoEn: true,
        viajes: { where: { estado: { in: EN_CURSO } }, select: { id: true, numero: true }, take: 1 } },
    }),
    db.viaje.findMany({
      where: { estado: { in: ["BUSCANDO", ...EN_CURSO] } }, orderBy: { creadoEn: "asc" }, take: 100,
      select: { id: true, numero: true, estado: true, origenLat: true, origenLng: true, origenDireccion: true, destinoDireccion: true, creadoEn: true, motorista: { select: { nombre: true } } },
    }),
  ]);
  return {
    motoristas: motoristas.map((m) => {
      const viaje = m.viajes[0];
      const ubicOk = m.lat != null && m.lng != null && m.ubicacionEn && ahora - m.ubicacionEn.getTime() < (viaje ? UBICACION_VIAJE_MS : CONECTADO_MS);
      return {
        id: m.id, nombre: m.nombre, placa: m.placa, enViaje: viaje ? numeroViaje(viaje.numero) : null, viajeId: viaje?.id ?? null,
        lat: ubicOk ? m.lat : null, lng: ubicOk ? m.lng : null,
        conectado: !!(m.disponible && m.vistoEn && ahora - m.vistoEn.getTime() < CONECTADO_MS),
      };
    }),
    viajes: viajes.map((v) => ({
      id: v.id, numero: numeroViaje(v.numero), estado: v.estado, lat: v.origenLat, lng: v.origenLng,
      origen: v.origenDireccion, destino: v.destinoDireccion, motorista: v.motorista?.nombre ?? null,
      esperaMin: Math.floor((ahora - v.creadoEn.getTime()) / 60_000),
    })),
    hora: new Date(ahora).toISOString(),
  };
}
export type DatosEnVivo = Awaited<ReturnType<typeof datosEnVivo>>;
