// Firma y verificación de los tokens de sesión (funciona también en el middleware).
// Propietarios y motoristas usan cookies y roles distintos: un token de uno nunca sirve para el otro.
import { SignJWT, jwtVerify } from "jose";

export const COOKIE_SESION = "fy_propietario";
export const COOKIE_MOTORISTA = "fy_motorista";
type Rol = "propietario" | "motorista";

function clave() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("Falta SESSION_SECRET (mínimo 32 caracteres)");
  return new TextEncoder().encode(s);
}

export async function firmarToken(id: string, segundos: number, rol: Rol = "propietario") {
  return new SignJWT({ rol })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(id)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + segundos)
    .sign(clave());
}

export async function verificarToken(token: string | undefined, rol: Rol = "propietario"): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clave(), { algorithms: ["HS256"] });
    return payload.rol === rol && typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
