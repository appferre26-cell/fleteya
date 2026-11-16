import "server-only";
import { headers } from "next/headers";

/** Dirección pública de la app (para los QR y el link del cliente).
 *  Usa PUBLIC_URL si está definida; si no, la dirección con la que se abrió el panel. */
export async function urlPublica() {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
