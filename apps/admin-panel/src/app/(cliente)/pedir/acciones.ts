"use server";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { capacidadMaximaKg, obtenerConfig } from "@/lib/config";
import { centavos, distanciaKm, kg, precioPorPeso } from "@/lib/tarifa";
import { normalizarTelefono, type ErroresCampos } from "@/lib/validacion";

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
  })).min(1, "Agrega al menos un material").max(30, "Máximo 30 materiales"),
  nota: z.string().trim().max(300, "La nota es muy larga").optional(),
  acepto: z.literal(true, { message: "Debes aceptar los Términos y el Aviso de Privacidad" }),
});

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
    return { errores };
  }
  const d = r.data;
  const cfg = await obtenerConfig();

  // Punto QR: la recogida es la ferretería
  let origen = d.origen!;
  let puntoQrId: string | undefined;
  if (d.qr) {
    const p = await db.puntoQR.findFirst({ where: { codigo: d.qr.toUpperCase(), activo: true } });
    if (p) { origen = { lat: p.lat, lng: p.lng, direccion: `${p.nombre} · ${p.direccion}` }; puntoQrId = p.id; }
  }
  const destino = d.destino!;

  if (distanciaKm(origen, { lat: cfg.zonaLat, lng: cfg.zonaLng }) > cfg.zonaRadioKm) {
    return { errores: { origen: `Todavía no damos servicio en esa zona. Por ahora solo recogemos en ${cfg.zonaNombre} y alrededores.` } };
  }

  // Peso: los del catálogo se toman de la base (no del navegador)
  const ids = d.items.map((i) => i.materialId).filter((x): x is string => !!x);
  const mats = new Map((await db.material.findMany({ where: { id: { in: ids }, activo: true } })).map((m) => [m.id, m]));
  const items = [];
  for (const i of d.items) {
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
  const pesoKg = centavos(items.reduce((s, i) => s + i.cantidad * i.pesoUnitKg, 0));
  const maxKg = await capacidadMaximaKg();
  if (maxKg !== null && pesoKg > maxKg) {
    return { errores: { items: `Son ${kg(pesoKg)} y el vehículo más grande disponible lleva ${kg(maxKg)}. Divide la carga en dos pedidos.` } };
  }

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const abiertos = await db.viaje.count({ where: { clienteTelefono: d.telefono, estado: "BUSCANDO" } });
  if (abiertos >= 2 || demasiados(ip)) {
    return { errores: { general: "Ya tienes pedidos esperando motorista. Espera o cancela uno antes de pedir otro." } };
  }

  const km = distanciaKm(origen, destino);
  const viaje = await db.viaje.create({
    data: {
      codigo: codigoSecreto(),
      clienteNombre: d.nombre,
      clienteTelefono: d.telefono,
      origenDireccion: origen.direccion, origenLat: origen.lat, origenLng: origen.lng,
      destinoDireccion: destino.direccion, destinoLat: destino.lat, destinoLng: destino.lng,
      distanciaKm: centavos(km),
      pesoKg,
      precioBase: precioPorPeso(pesoKg, cfg),
      fueraDeRango: km > cfg.kmIncluidos,
      nota: d.nota || null,
      puntoQrId,
      aceptoTerminosEn: new Date(),
      items: { create: items.map((i) => ({ ...i, pesoTotalKg: centavos(i.cantidad * i.pesoUnitKg) })) },
    },
  });
  return { codigo: viaje.codigo };
}

export async function cancelarViajeCliente(codigo: string, motivo: string) {
  const v = await db.viaje.findUnique({ where: { codigo } });
  if (!v || v.estado === "ENTREGADO" || v.estado === "CANCELADO") return { error: "Este viaje ya no se puede cancelar." };
  await db.viaje.update({
    where: { id: v.id },
    data: { estado: "CANCELADO", canceladoPor: "CLIENTE", motivoCancelacion: motivo.trim().slice(0, 200) || null, canceladoEn: new Date() },
  });
  return { ok: true };
}
