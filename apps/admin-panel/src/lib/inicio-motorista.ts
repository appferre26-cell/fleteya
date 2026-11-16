import "server-only";
import { db } from "./db";
import { obtenerConfig } from "./config";
import type { MotoristaSesion } from "./sesion-motorista";
import { puedeRecibir, SIGUIENTE, solicitudesPara, viajeActivoDe } from "./viajes-motorista";

/** Inicio del día en El Salvador (UTC-6, sin horario de verano). */
export function inicioDelDia(d = new Date()) {
  const local = new Date(d.getTime() - 6 * 3600_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + 6 * 3600_000);
}

const items = (lista: { id: string; nombre: string; cantidad: unknown; pesoTotalKg: unknown }[]) =>
  lista.map((i) => ({ id: i.id, nombre: i.nombre, cantidad: Number(i.cantidad), pesoKg: Number(i.pesoTotalKg) }));

/** Todo lo que necesita la pantalla de Inicio. Se usa al abrir la página y cada pocos segundos. */
export async function datosInicio(m: MotoristaSesion) {
  const cfg = await obtenerConfig();
  const fila = await db.motorista.findUniqueOrThrow({ where: { id: m.id } });
  const puede = puedeRecibir(fila);
  const activo = await viajeActivoDe(m.id);

  const sol = puede.ok && fila.disponible && !activo ? await solicitudesPara(fila) : [];
  const desde = inicioDelDia();
  const [hoy, recientes] = await Promise.all([
    db.viaje.aggregate({ where: { motoristaId: m.id, estado: "ENTREGADO", entregadoEn: { gte: desde } }, _count: true, _sum: { precioFinal: true, comision: true } }),
    db.viaje.findMany({
      where: { motoristaId: m.id, estado: "ENTREGADO" }, orderBy: { entregadoEn: "desc" }, take: 3,
      select: { id: true, numero: true, origenDireccion: true, destinoDireccion: true, precioFinal: true, entregadoEn: true, distanciaKm: true, pesoKg: true },
    }),
  ]);

  return {
    ahora: Date.now(),
    motorista: { nombre: fila.nombre, disponible: fila.disponible, saldo: Number(fila.saldoCreditos), capacidadKg: Number(fila.capacidadTon) * 1000 },
    puede: puede.ok ? { ok: true as const } : { ok: false as const, motivo: puede.motivo, codigo: puede.codigo },
    comisionPct: cfg.comisionPct,
    zona: { lat: cfg.zonaLat, lng: cfg.zonaLng, nombre: cfg.zonaNombre },
    activo: activo && {
      id: activo.id, numero: activo.numero, estado: activo.estado as keyof typeof SIGUIENTE,
      boton: SIGUIENTE[activo.estado as keyof typeof SIGUIENTE].boton,
      clienteNombre: activo.clienteNombre, clienteTelefono: activo.clienteTelefono,
      origen: { direccion: activo.origenDireccion, lat: activo.origenLat, lng: activo.origenLng },
      destino: { direccion: activo.destinoDireccion, lat: activo.destinoLat, lng: activo.destinoLng },
      distanciaKm: Number(activo.distanciaKm), pesoKg: Number(activo.pesoKg), nota: activo.nota,
      precio: Number(activo.precioFinal ?? activo.precioBase), items: items(activo.items),
    },
    solicitudes: sol.map((v) => ({
      id: v.id, numero: v.numero, creadoEn: v.creadoEn.getTime(),
      clienteNombre: v.clienteNombre.split(" ")[0],
      origen: { direccion: v.origenDireccion, lat: v.origenLat, lng: v.origenLng },
      destino: { direccion: v.destinoDireccion, lat: v.destinoLat, lng: v.destinoLng },
      ferreteria: v.puntoQr?.nombre ?? null,
      distanciaKm: Number(v.distanciaKm), kmDeMi: v.kmDeMi, pesoKg: Number(v.pesoKg), nota: v.nota,
      precioBase: Number(v.precioBase), fueraDeRango: v.fueraDeRango, items: items(v.items),
      miOferta: v.miOferta && { precio: Number(v.miOferta.precio), estado: v.miOferta.estado },
    })),
    hoy: { viajes: hoy._count, ganancias: Number(hoy._sum.precioFinal ?? 0), comision: Number(hoy._sum.comision ?? 0) },
    recientes: recientes.map((r) => ({
      id: r.id, numero: r.numero, origen: r.origenDireccion, destino: r.destinoDireccion,
      precio: Number(r.precioFinal ?? 0), fecha: r.entregadoEn?.getTime() ?? 0, km: Number(r.distanciaKm), pesoKg: Number(r.pesoKg),
    })),
  };
}

export type DatosInicio = Awaited<ReturnType<typeof datosInicio>>;
