import "server-only";
import { db } from "@/lib/db";
import { leerPoligono, type Zona } from "@/lib/zona";

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
    zonaPoligono: leerPoligono(c.zonaPoligono),
    whatsappAyuda: c.whatsappAyuda,
    comisionPct: Number(c.comisionPct),
    planSemanal: Number(c.planSemanal),
    planMensual: Number(c.planMensual),
    emisorNombre: c.emisorNombre,
    emisorNit: c.emisorNit,
    emisorDireccion: c.emisorDireccion,
    bancoNombre: c.bancoNombre,
    bancoTipoCuenta: c.bancoTipoCuenta,
    bancoNumero: c.bancoNumero,
    bancoTitular: c.bancoTitular,
    contraofertaEnRango: c.contraofertaEnRango,
  };
}

export type Config = Awaited<ReturnType<typeof obtenerConfig>>;

/** Zona de servicio lista para el mapa y para revisar si un punto está dentro. */
export function zonaDe(cfg: Config): Zona {
  return { nombre: cfg.zonaNombre, lat: cfg.zonaLat, lng: cfg.zonaLng, radioKm: cfg.zonaRadioKm, poligono: cfg.zonaPoligono };
}

/** Mayor capacidad (kg) entre motoristas activos; null si aún no hay ninguno activo. */
export async function capacidadMaximaKg() {
  const r = await db.motorista.aggregate({ where: { estado: "ACTIVO" }, _max: { capacidadTon: true } });
  return r._max.capacidadTon ? Number(r._max.capacidadTon) * 1000 : null;
}
