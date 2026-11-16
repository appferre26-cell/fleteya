import "server-only";
import webpush from "web-push";
import { after } from "next/server";
import { z } from "zod";
import { db } from "./db";
import { dinero, kg } from "./tarifa";

// Parte 8: avisos al teléfono aunque la app esté cerrada (Web Push con claves VAPID).
// Sin VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no se envía nada y los botones para activarlos no aparecen.

export type Aviso = { titulo: string; cuerpo: string; url: string; tag?: string; urgente?: boolean };

let listo: boolean | null = null;
function configurar() {
  if (listo !== null) return listo;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (listo = false);
  try {
    webpush.setVapidDetails(process.env.VAPID_CORREO || "mailto:soporte@fleteya.app", pub, priv);
    listo = true;
  } catch (e) {
    console.error("[avisos] claves VAPID no válidas", e);
    listo = false;
  }
  return listo;
}

/** Clave pública para el navegador; null si los avisos no están configurados. */
export function clavePublicaAvisos() {
  return configurar() ? process.env.VAPID_PUBLIC_KEY! : null;
}

export const esquemaSuscripcion = z.object({
  endpoint: z.string().url().max(800).startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

/** Guarda (o reasigna) la suscripción del navegador a un motorista o a un viaje. */
export async function guardarSuscripcion(datos: unknown, dueno: { motoristaId: string } | { viajeId: string }) {
  const r = esquemaSuscripcion.safeParse(datos);
  if (!r.success) return false;
  const { endpoint, keys } = r.data;
  const due = "motoristaId" in dueno ? { motoristaId: dueno.motoristaId, viajeId: null } : { viajeId: dueno.viajeId, motoristaId: null };
  await db.suscripcionAviso.upsert({
    where: { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, ...due },
    update: { p256dh: keys.p256dh, auth: keys.auth, ...due },
  });
  return true;
}

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };

async function enviar(subs: Sub[], aviso: Aviso) {
  if (!configurar() || subs.length === 0) return 0;
  const cuerpo = JSON.stringify(aviso);
  let enviados = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, cuerpo, {
        TTL: aviso.urgente ? 120 : 3600, urgency: aviso.urgente ? "high" : "normal", timeout: 8000,
      });
      enviados++;
      await db.suscripcionAviso.update({ where: { id: s.id }, data: { ultimoEnvio: new Date() } }).catch(() => {});
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      // 404/410: el teléfono ya no acepta avisos (desinstaló o quitó el permiso) → se borra.
      if (code === 404 || code === 410) await db.suscripcionAviso.delete({ where: { id: s.id } }).catch(() => {});
      else console.error("[avisos] no se pudo enviar", code ?? e);
    }
  }));
  return enviados;
}

const campos = { id: true, endpoint: true, p256dh: true, auth: true } as const;

export async function avisarMotoristas(ids: string[], aviso: Aviso) {
  if (!ids.length || !configurar()) return 0;
  return enviar(await db.suscripcionAviso.findMany({ where: { motoristaId: { in: ids } }, select: campos }), aviso);
}

export async function avisarCliente(viajeId: string, aviso: Omit<Aviso, "url"> & { url?: string }) {
  if (!configurar()) return 0;
  const v = await db.viaje.findUnique({ where: { id: viajeId }, select: { codigo: true } });
  if (!v) return 0;
  return enviar(await db.suscripcionAviso.findMany({ where: { viajeId }, select: campos }), { url: `/viaje/${v.codigo}`, tag: `viaje-${v.codigo}`, ...aviso });
}

/** Se envía después de responder, para que el motorista o el cliente no esperen al servicio de avisos. */
export function despues(tarea: () => Promise<unknown>) {
  if (!configurar()) return;
  const correr = () => tarea().catch((e) => console.error("[avisos]", e));
  try { after(correr); } catch { void correr(); }
}

// Un motorista desconectado hace rato (se le olvidó apagar «Disponible») no recibe avisos de pedidos.
const HORAS_SIN_APP = 8;

/** Pedido nuevo (o que volvió a buscar motorista): avisa a los motoristas que lo pueden tomar. */
export async function avisarPedidoNuevo(viajeId: string, excepto?: string) {
  const v = await db.viaje.findUnique({ where: { id: viajeId }, include: { puntoQr: { select: { nombre: true } } } });
  if (!v || v.estado !== "BUSCANDO") return 0;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const ms = await db.motorista.findMany({
    where: {
      estado: "ACTIVO", disponible: true, saldoCreditos: { gt: 0 },
      licenciaVence: { gte: hoy },
      capacidadTon: { gte: Number(v.pesoKg) / 1000 },
      vistoEn: { gte: new Date(Date.now() - HORAS_SIN_APP * 3600_000) },
      viajes: { none: { estado: { in: ["ASIGNADO", "EN_CAMINO", "CARGANDO", "EN_RUTA"] } } },
      rechazos: { none: { viajeId } },
      ...(excepto ? { id: { not: excepto } } : {}),
    },
    select: { id: true },
  });
  return avisarMotoristas(ms.map((m) => m.id), {
    titulo: "Nueva solicitud de flete",
    cuerpo: `${dinero(Number(v.precioBase))} · ${kg(Number(v.pesoKg))} · ${Number(v.distanciaKm).toFixed(1)} km · ${v.puntoQr?.nombre ?? "Recogida"}`,
    url: "/motorista", tag: "fleteya-solicitud", urgente: true,
  });
}
