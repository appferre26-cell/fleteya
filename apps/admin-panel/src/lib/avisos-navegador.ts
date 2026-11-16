// Parte 8 (lado del teléfono): registrar el service worker y pedir permiso para avisos con la app cerrada.

export type EstadoAvisos = "no-soportado" | "iphone-instalar" | "bloqueado" | "activo" | "inactivo";

const soporta = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** En iPhone los avisos solo funcionan si la app se agregó a la pantalla de inicio. */
function iphoneSinInstalar() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const instalada = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
  return ios && !instalada;
}

function claveBytes(base64: string) {
  const b = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
}

async function registro() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export async function estadoAvisos(): Promise<EstadoAvisos> {
  if (!soporta()) return iphoneSinInstalar() ? "iphone-instalar" : "no-soportado";
  if (Notification.permission === "denied") return "bloqueado";
  if (Notification.permission !== "granted") return "inactivo";
  const r = await navigator.serviceWorker.getRegistration("/");
  return (await r?.pushManager.getSubscription()) ? "activo" : "inactivo";
}

/**
 * Pide permiso (si hace falta), suscribe este navegador y le pasa la suscripción al servidor.
 * `silencioso`: no pide permiso; solo renueva si ya estaba concedido.
 */
export async function activarAvisos(clave: string, guardar: (s: PushSubscriptionJSON) => Promise<{ error?: string }>, silencioso = false): Promise<EstadoAvisos> {
  if (!soporta()) return iphoneSinInstalar() ? "iphone-instalar" : "no-soportado";
  if (Notification.permission === "denied") return "bloqueado";
  if (Notification.permission !== "granted") {
    if (silencioso) return "inactivo";
    const p = await Notification.requestPermission();
    if (p !== "granted") return p === "denied" ? "bloqueado" : "inactivo";
  }
  const r = await registro();
  await navigator.serviceWorker.ready;
  let s = await r.pushManager.getSubscription();
  // Si cambiaron las claves del servidor, la suscripción vieja ya no sirve.
  const actual = s?.options.applicationServerKey;
  if (s && actual && btoa(String.fromCharCode(...new Uint8Array(actual))).replace(/=+$/, "") !== btoa(String.fromCharCode(...claveBytes(clave))).replace(/=+$/, "")) {
    await s.unsubscribe();
    s = null;
  }
  s ??= await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveBytes(clave) });
  const g = await guardar(s.toJSON());
  return g.error ? "inactivo" : "activo";
}

export async function desactivarAvisos(quitar: (endpoint: string) => Promise<unknown>) {
  if (!soporta()) return;
  const s = await (await navigator.serviceWorker.getRegistration("/"))?.pushManager.getSubscription();
  if (!s) return;
  await quitar(s.endpoint);
  await s.unsubscribe();
}

export const TEXTO_ESTADO: Record<EstadoAvisos, string> = {
  "no-soportado": "Este navegador no permite avisos con la app cerrada. Usa Chrome en Android.",
  "iphone-instalar": "En iPhone: toca Compartir → «Agregar a inicio», abre FleteYa desde ese ícono y activa los avisos ahí.",
  bloqueado: "Bloqueaste los avisos. Actívalos en los ajustes del navegador (candado junto a la dirección → Notificaciones → Permitir).",
  activo: "Avisos activados en este teléfono.",
  inactivo: "Avisos desactivados.",
};
