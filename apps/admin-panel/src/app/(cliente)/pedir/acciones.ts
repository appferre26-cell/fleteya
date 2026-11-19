"use server";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { capacidadMaximaKg, obtenerConfig, zonaDe } from "@/lib/config";
import { dentroDeZona } from "@/lib/zona";
import { centavos, distanciaKm, kg, precioViaje } from "@/lib/tarifa";
import { RANGOS, toneladasDeRango, type IdRango } from "@/lib/rangos";
import { normalizarTelefono, type ErroresCampos } from "@/lib/validacion";
import { asignar, ErrorViaje } from "@/lib/viajes-motorista";
import { avisarMotoristas, avisarPedidoNuevo, clavePublicaAvisos, despues, guardarSuscripcion } from "@/lib/avisos";
import { clienteBloqueado, leerCalificacion } from "@/lib/calificaciones";

const punto = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  direccion: z.string().trim().min(3, "Escribe la dirección o un punto de referencia").max(160, "Es demasiado largo"),
});

const esquema = z.object({
  nombre: z.string().trim().min(2, "Escribe tu nombre").max(60, "Es demasiado largo"),
  telefono: z.string().transform(normalizarTelefono).refine((t) => /^[67]\d{7}$/.test(t), "Celular de 8 dígitos (empieza con 6 o 7)"),
  origen: punto.nullable().refine((p) => p !== null, "Marca en el mapa dónde recogemos"),
  destino: punto.nullable().refine((p) => p !== null, "Marca en el mapa a dónde vamos"),
  qr: z.string().max(20).optional(),
  items: z.array(z.object({
    materialId: z.string().max(40).optional(),
    nombre: z.string().trim().max(60).optional(),
    pesoKg: z.number().optional(),
    cantidad: z.number().positive("Cantidad no válida").max(10000, "Cantidad muy grande"),
  })).max(30, "Máximo 30 materiales").default([]),
  // Parte 5: pedido rápido por toneladas (en vez de la lista de materiales)
  rango: z.object({
    id: z.enum(RANGOS.map((r) => r.id) as [IdRango, ...IdRango[]]),
    ton: z.number().optional(),
  }).nullable().optional(),
  nota: z.string().trim().max(300, "La nota es muy larga").optional(),
  acepto: z.literal(true, { message: "Debes aceptar los Términos y el Aviso de Privacidad" }),
});

const SIN_CARGA = "Elige cuántas toneladas llevas o agrega al menos un material";

export type EstadoPedido = { errores?: ErroresCampos; codigo?: string };

// Freno simple contra pedidos en masa (por dirección de internet).
const intentos = new Map<string, number[]>();
function demasiados(ip: string) {
  const ahora = Date.now();
  const lista = (intentos.get(ip) ?? []).filter((t) => ahora - t < 3600_000);
  lista.push(ahora);
  intentos.set(ip, lista);
  return lista.length > 8;
}

function codigoSecreto() {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => abc[b % abc.length]).join("");
}

export async function solicitarViaje(datosJson: string): Promise<EstadoPedido> {
  let bruto: unknown;
  try { bruto = JSON.parse(datosJson); } catch { return { errores: { general: "Datos no válidos" } }; }
  const r = esquema.safeParse(bruto);
  if (!r.success) {
    const errores: ErroresCampos = {};
    for (const i of r.error.issues) errores[String(i.path[0])] ??= i.message;
    const b = bruto as { rango?: unknown; items?: unknown[] } | null;
    if (!b?.rango && !b?.items?.length) errores.items ??= SIN_CARGA;
    return { errores };
  }
  const d = r.data;
  if (!d.rango && d.items.length === 0) return { errores: { items: SIN_CARGA } };
  const cfg = await obtenerConfig();

  // Punto QR: la recogida es la ferretería
  let origen = d.origen!;
  let puntoQrId: string | undefined;
  if (d.qr) {
    const p = await db.puntoQR.findFirst({ where: { codigo: d.qr.toUpperCase(), activo: true } });
    if (p) { origen = { lat: p.lat, lng: p.lng, direccion: `${p.nombre} · ${p.direccion}` }; puntoQrId = p.id; }
  }
  const destino = d.destino!;

  if (!dentroDeZona(origen, zonaDe(cfg))) {
    return { errores: { origen: `Todavía no damos servicio en esa zona. Por ahora solo recogemos en ${cfg.zonaNombre} y alrededores.` } };
  }

  // Peso: los del catálogo se toman de la base (no del navegador)
  const ids = d.items.map((i) => i.materialId).filter((x): x is string => !!x);
  const mats = new Map((await db.material.findMany({ where: { id: { in: ids }, activo: true } })).map((m) => [m.id, m]));
  const items = [];
  for (const i of d.rango ? [] : d.items) {
    if (i.materialId) {
      const m = mats.get(i.materialId);
      if (!m) return { errores: { items: "Un material ya no está disponible. Recarga la página." } };
      items.push({ materialId: m.id, nombre: m.nombre, unidad: m.unidad, cantidad: i.cantidad, pesoUnitKg: Number(m.pesoKg) });
    } else {
      if (!i.nombre || i.nombre.length < 2) return { errores: { items: "Escribe qué es el material «Otro»" } };
      if (!i.pesoKg || i.pesoKg < 0.1 || i.pesoKg > 20000) return { errores: { items: `Escribe el peso aproximado de «${i.nombre}» (en kg)` } };
      items.push({ materialId: null, nombre: i.nombre, unidad: "Otro", cantidad: i.cantidad, pesoUnitKg: i.pesoKg });
    }
  }
  const pesoKg = d.rango
    ? toneladasDeRango(d.rango.id, d.rango.ton) * 1000
    : centavos(items.reduce((s, i) => s + i.cantidad * i.pesoUnitKg, 0));
  const maxKg = await capacidadMaximaKg();
  if (maxKg !== null && pesoKg > maxKg) {
    if (d.rango) return { errores: { items: `Ahora mismo el vehículo más grande disponible lleva ${kg(maxKg)}. Elige un rango menor o divide la carga en dos pedidos.` } };
    return { errores: { items: `Son ${kg(pesoKg)} y el vehículo más grande disponible lleva ${kg(maxKg)}. Divide la carga en dos pedidos.` } };
  }

  // Parte 6: celular bloqueado por el propietario (no se dice el motivo al cliente)
  if (await clienteBloqueado(d.telefono)) {
    return { errores: { telefono: `Este número no puede pedir fletes por ahora.${cfg.whatsappAyuda ? " Escríbenos por WhatsApp si crees que es un error." : ""}` } };
  }

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const abiertos = await db.viaje.count({ where: { clienteTelefono: d.telefono, estado: "BUSCANDO" } });
  if (abiertos >= 2 || demasiados(ip)) {
    return { errores: { general: "Ya tienes pedidos esperando motorista. Espera o cancela uno antes de pedir otro." } };
  }

  const km = distanciaKm(origen, destino);
  // El precio ya incluye el recargo por los km que pasen de los incluidos, para que la comisión y las ofertas se calculen sobre el precio real.
  const { total } = precioViaje(pesoKg, km, cfg);
  const viaje = await db.viaje.create({
    data: {
      codigo: codigoSecreto(),
      clienteNombre: d.nombre,
      clienteTelefono: d.telefono,
      origenDireccion: origen.direccion, origenLat: origen.lat, origenLng: origen.lng,
      destinoDireccion: destino.direccion, destinoLat: destino.lat, destinoLng: destino.lng,
      distanciaKm: centavos(km),
      pesoKg,
      precioBase: total,
      fueraDeRango: km > cfg.kmIncluidos,
      rangoTon: d.rango?.id ?? null,
      nota: d.nota || null,
      puntoQrId,
      aceptoTerminosEn: new Date(),
      items: { create: items.map((i) => ({ ...i, pesoTotalKg: centavos(i.cantidad * i.pesoUnitKg) })) },
    },
  });
  despues(() => avisarPedidoNuevo(viaje.id));
  return { codigo: viaje.codigo };
}

// El cliente puede cancelar mientras el motorista no haya empezado a cargar.
const CANCELABLE = ["BUSCANDO", "ASIGNADO", "EN_CAMINO"] as const;

export async function cancelarViajeCliente(codigo: string, motivo: string) {
  const v = await db.viaje.findUnique({ where: { codigo } });
  if (!v) return { error: "Este viaje ya no se puede cancelar." };
  const ahora = new Date();
  const r = await db.viaje.updateMany({
    where: { id: v.id, estado: { in: [...CANCELABLE] } },
    data: { estado: "CANCELADO", canceladoPor: "CLIENTE", motivoCancelacion: motivo.trim().slice(0, 200) || null, canceladoEn: ahora },
  });
  if (r.count === 0) {
    return { error: v.estado === "CARGANDO" || v.estado === "EN_RUTA" ? "El motorista ya cargó tu material. Llámale para resolverlo." : "Este viaje ya no se puede cancelar." };
  }
  await db.ofertaPrecio.updateMany({ where: { viajeId: v.id, estado: "PENDIENTE" }, data: { estado: "RECHAZADA", respondidaEn: ahora } });
  if (v.motoristaId) {
    const mid = v.motoristaId;
    despues(() => avisarMotoristas([mid], { titulo: "El cliente canceló el viaje", cuerpo: "No se descontó nada de tus créditos. Ya puedes recibir otros pedidos.", url: "/motorista", tag: "fleteya-viaje", urgente: true }));
  }
  return { ok: true };
}

/** El cliente acepta el precio que ofreció un motorista: el viaje queda asignado a él. */
export async function aceptarOferta(codigo: string, ofertaId: string) {
  const v = await db.viaje.findUnique({ where: { codigo } });
  const o = v && await db.ofertaPrecio.findFirst({ where: { id: ofertaId, viajeId: v.id }, include: { motorista: { select: { disponible: true } } } });
  if (!v || !o) return { error: "Esta oferta ya no existe." };
  if (o.estado !== "PENDIENTE" || !o.motorista.disponible) return { error: "El motorista retiró esa oferta." };
  try {
    await asignar(v.id, o.motoristaId, Number(o.precio), o.id);
    despues(() => avisarMotoristas([o.motoristaId], { titulo: "¡El cliente aceptó tu precio!", cuerpo: `Viaje de $${Number(o.precio).toFixed(2)}. Abre la app para ir a recoger.`, url: "/motorista", tag: "fleteya-viaje", urgente: true }));
    return { ok: true };
  } catch (e) {
    if (e instanceof ErrorViaje) return { error: e.message.startsWith("Otro motorista") ? "Otro motorista ya tomó tu viaje." : "Ese motorista ya no está disponible. Espera otra oferta o el precio de la app." };
    console.error(e);
    return { error: "No se pudo completar. Inténtalo de nuevo." };
  }
}

export async function rechazarOferta(codigo: string, ofertaId: string) {
  const v = await db.viaje.findUnique({ where: { codigo } });
  if (!v) return { error: "Esta oferta ya no existe." };
  const o = await db.ofertaPrecio.findFirst({ where: { id: ofertaId, viajeId: v.id, estado: "PENDIENTE" } });
  const r = await db.ofertaPrecio.updateMany({ where: { id: ofertaId, viajeId: v.id, estado: "PENDIENTE" }, data: { estado: "RECHAZADA", respondidaEn: new Date() } });
  if (o && r.count) despues(() => avisarMotoristas([o.motoristaId], { titulo: "El cliente no aceptó tu precio", cuerpo: `Tu oferta de $${Number(o.precio).toFixed(2)} no fue aceptada. Puedes aceptar el precio de la app si te sirve.`, url: "/motorista", tag: "fleteya-oferta" }));
  return { ok: true };
}


/** Parte 6: el cliente califica al motorista una sola vez, después de la entrega. */
export async function calificarMotorista(codigo: string, estrellas: number, comentario: string) {
  const c = leerCalificacion(estrellas, comentario);
  if ("error" in c) return { error: c.error };
  const r = await db.viaje.updateMany({
    where: { codigo, estado: "ENTREGADO", motoristaId: { not: null }, motoristaCalificadoEn: null },
    data: { estrellasMotorista: c.estrellas, comentarioMotorista: c.comentario, motoristaCalificadoEn: new Date() },
  });
  if (r.count === 0) return { error: "Este viaje ya fue calificado o todavía no se ha entregado." };
  return { ok: true };
}

/** Parte 8: el cliente pide que le avisen en este teléfono cómo va su pedido (sin cuenta: queda ligado al viaje). */
export async function suscribirAvisosViaje(codigo: string, sub: unknown) {
  if (!clavePublicaAvisos()) return { error: "Los avisos no están disponibles." };
  const v = await db.viaje.findUnique({ where: { codigo: String(codigo) }, select: { id: true, estado: true, _count: { select: { avisos: true } } } });
  if (!v || v.estado === "ENTREGADO" || v.estado === "CANCELADO") return { error: "Este pedido ya terminó." };
  if (v._count.avisos >= 5) return { error: "Ya hay varios teléfonos recibiendo avisos de este pedido." };
  return (await guardarSuscripcion(sub, { viajeId: v.id })) ? { ok: true } : { error: "No se pudo activar en este teléfono." };
}
