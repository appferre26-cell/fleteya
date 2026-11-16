// Reglas de datos de El Salvador y textos que se muestran en el panel.
import { z } from "zod";

/** Deja solo los dígitos de un teléfono y quita el +503 si viene. */
export function normalizarTelefono(v: string) {
  let d = v.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("503")) d = d.slice(3);
  return d;
}

export function formatoTelefono(t: string) {
  return t.length === 8 ? `${t.slice(0, 4)}-${t.slice(4)}` : t;
}

/** DUI: 8 dígitos + dígito verificador (00000000-0). */
export function normalizarDui(v: string) {
  const d = v.replace(/\D/g, "");
  return d.length === 9 ? `${d.slice(0, 8)}-${d[8]}` : v.trim();
}

export function duiValido(dui: string) {
  const m = /^(\d{8})-(\d)$/.exec(dui);
  if (!m) return false;
  const suma = m[1].split("").reduce((s, c, i) => s + Number(c) * (9 - i), 0);
  return (10 - (suma % 10)) % 10 === Number(m[2]);
}

export function normalizarPlaca(v: string) {
  return v.toUpperCase().replace(/\s+/g, " ").trim();
}

export const TIPOS_VEHICULO = {
  PICKUP: { nombre: "Pick-up", ayuda: "hasta ~1 ton" },
  CAMION_LIVIANO: { nombre: "Camión liviano", ayuda: "1 – 3 ton" },
  CAMION_MEDIANO_GRANDE: { nombre: "Camión mediano o grande", ayuda: "más de 3 ton" },
} as const;

export const ESTADOS = {
  PENDIENTE: { nombre: "Pendiente", clase: "bg-naranja/10 text-[#FFA366] border border-naranja/30" },
  ACTIVO: { nombre: "Activo", clase: "bg-exito/15 text-exito" },
  SUSPENDIDO: { nombre: "Suspendido", clase: "bg-error/15 text-error" },
} as const;

export const DOCUMENTOS = {
  DUI: "DUI",
  LICENCIA: "Licencia de conducir",
  TARJETA_CIRCULACION: "Tarjeta de circulación",
} as const;

export const MIME_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const MAX_DOC_BYTES = 4 * 1024 * 1024;

const texto = (min: number, max: number, msg: string) => z.string().trim().min(min, msg).max(max, "Es demasiado largo");

export const esquemaMotorista = z.object({
  nombre: texto(3, 80, "Escribe el nombre completo"),
  telefono: z
    .string()
    .transform(normalizarTelefono)
    .refine((t) => /^[67]\d{7}$/.test(t), "Celular de 8 dígitos que empiece con 6 o 7"),
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .refine((c) => c === "" || z.string().email().safeParse(c).success, "Correo no válido")
    .transform((c) => (c === "" ? null : c)),
  dui: z.string().transform(normalizarDui).refine(duiValido, "DUI no válido. Revisa los números (00000000-0)"),
  licenciaNumero: texto(4, 30, "Escribe el número de licencia"),
  licenciaVence: z
    .string()
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), "Elige la fecha de vencimiento")
    .transform((v) => new Date(`${v}T00:00:00Z`)),
  placa: z.string().transform(normalizarPlaca).refine((p) => /^[A-Z]{1,3}[ -]?[0-9][0-9 -]{2,8}$/.test(p), "Placa no válida (ej. P 123-456)"),
  marca: texto(2, 40, "Escribe la marca"),
  modelo: texto(1, 40, "Escribe el modelo"),
  tipoVehiculo: z.enum(["PICKUP", "CAMION_LIVIANO", "CAMION_MEDIANO_GRANDE"], { message: "Elige el tipo de vehículo" }),
  capacidadTon: z.coerce
    .number({ message: "Escribe la capacidad" })
    .min(0.5, "Mínimo 0.5 ton")
    .max(40, "Máximo 40 ton")
    .transform((n) => Math.round(n * 10) / 10),
});

export type ErroresCampos = Partial<Record<string, string>>;

export function erroresDe(e: z.ZodError): ErroresCampos {
  const out: ErroresCampos = {};
  for (const i of e.issues) {
    const k = String(i.path[0] ?? "general");
    out[k] ??= i.message;
  }
  return out;
}

/** Contraseña temporal fácil de dictar por teléfono (sin 0/O, 1/l/I). */
export function contrasenaTemporal() {
  const letras = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const nums = "23456789";
  const r = (s: string) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length];
  return `${r(letras)}${r(letras)}${r(letras)}-${r(nums)}${r(nums)}${r(nums)}${r(nums)}`;
}

export function fechaCorta(d: Date) {
  return new Intl.DateTimeFormat("es-SV", { day: "numeric", month: "short", year: "numeric", timeZone: "America/El_Salvador" }).format(d);
}

export function fechaHora(d: Date) {
  return new Intl.DateTimeFormat("es-SV", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/El_Salvador" }).format(d);
}

/** Días hasta que vence la licencia (negativo si ya venció). */
export function diasParaVencer(fecha: Date) {
  const hoy = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "America/El_Salvador" }) + "T00:00:00Z");
  return Math.round((fecha.getTime() - hoy.getTime()) / 86400000);
}
