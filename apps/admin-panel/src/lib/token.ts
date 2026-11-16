// Firma y verificación del token de sesión (funciona también en el middleware).
import { SignJWT, jwtVerify } from "jose";

export const COOKIE_SESION = "fy_propietario";
const ROL = "propietario"; // la app del motorista usará otro rol y otra cookie

function clave() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("Falta SESSION_SECRET (mínimo 32 caracteres)");
  return new TextEncoder().encode(s);
}

export async function firmarToken(propietarioId: string, segundos: number) {
  return new SignJWT({ rol: ROL })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(propietarioId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + segundos)
    .sign(clave());
}

export async function verificarToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clave(), { algorithms: ["HS256"] });
    return payload.rol === ROL && typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
