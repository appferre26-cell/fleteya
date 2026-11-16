import "server-only";
import { db } from "@/lib/db";

/** Tarifas y zona (una sola fila). Se crea con los valores de la Fase 1 si no existe. */
export async function obtenerConfig() {
  const c = await db.configuracion.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  return {
    precioTonelada: Number(c.precioTonelada),
    tarifaMinima: Number(c.tarifaMinima),
    kmIncluidos: Number(c.kmIncluidos),
    zonaNombre: c.zonaNombre,
    zonaLat: c.zonaLat,
    zonaLng: c.zonaLng,
    zonaRadioKm: Number(c.zonaRadioKm),
    whatsappAyuda: c.whatsappAyuda,
  };
}

export type Config = Awaited<ReturnType<typeof obtenerConfig>>;

/** Mayor capacidad (kg) entre motoristas activos; null si aún no hay ninguno activo. */
export async function capacidadMaximaKg() {
  const r = await db.motorista.aggregate({ where: { estado: "ACTIVO" }, _max: { capacidadTon: true } });
  return r._max.capacidadTon ? Number(r._max.capacidadTon) * 1000 : null;
}
