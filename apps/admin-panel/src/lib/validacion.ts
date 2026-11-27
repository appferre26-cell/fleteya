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
  DUI_FRENTE: "DUI (frente)",
  DUI_REVERSO: "DUI (reverso)",
  LICENCIA_FRENTE: "Licencia (frente)",
  LICENCIA_REVERSO: "Licencia (reverso)",
  TARJETA_FRENTE: "Tarjeta de circulación (frente)",
  TARJETA_REVERSO: "Tarjeta de circulación (reverso)",
  VEHICULO_FRENTE: "Vehículo de frente",
  VEHICULO_ATRAS: "Vehículo de atrás",
  VEHICULO_IZQUIERDA: "Vehículo lado izquierdo",
  VEHICULO_DERECHA: "Vehículo lado derecho",
} as const;

export type TipoDoc = keyof typeof DOCUMENTOS;
export const TIPOS_DOC = Object.keys(DOCUMENTOS) as TipoDoc[];
export const TOTAL_DOCS = TIPOS_DOC.length;
/** Requisitos de fotos del motorista: los documentos obligatorios + la foto de perfil (ahora obligatoria). */
export const TOTAL_REQUISITOS = TOTAL_DOCS + 1;

/** Cómo se agrupan las fotos en los formularios y en el detalle. */
export const GRUPOS_DOC: { titulo: string; tipos: TipoDoc[] }[] = [
  { titulo: "DUI", tipos: ["DUI_FRENTE", "DUI_REVERSO"] },
  { titulo: "Licencia de conducir", tipos: ["LICENCIA_FRENTE", "LICENCIA_REVERSO"] },
  { titulo: "Tarjeta de circulación", tipos: ["TARJETA_FRENTE", "TARJETA_REVERSO"] },
  { titulo: "Fotos del vehículo", tipos: ["VEHICULO_FRENTE", "VEHICULO_ATRAS", "VEHICULO_IZQUIERDA", "VEHICULO_DERECHA"] },
];

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
  placa: z.string().transform(normalizarPlaca).refine(
    (p) => {
      const limpia = p.replace(/[ -]/g, "");
      return /^[A-Z0-9]{3,12}$/.test(limpia) && /[0-9]/.test(limpia);
    },
    "Escribe la placa del vehículo (ej. P 123-456, C 1234-567, M 12345)",
  ),
  marca: texto(2, 40, "Escribe la marca"),
  modelo: texto(1, 40, "Escribe el modelo"),
  tipoVehiculo: z.enum(["PICKUP", "CAMION_LIVIANO", "CAMION_MEDIANO_GRANDE"], { message: "Elige el tipo de vehículo" }),
  capacidadTon: z.coerce
    .number({ message: "Escribe la capacidad" })
    .min(0.5, "Mínimo 0.5 ton")
    .max(40, "Máximo 40 ton")
    .transform((n) => Math.round(n * 10) / 10),
});

/** NIT (14 dígitos) o DUI usado como NIT; NRC de 1 a 8 dígitos con guion opcional. */
const nitValido = (t: string) => /^[\d-]+$/.test(t) && [9, 14].includes(t.replace(/-/g, "").length);
const opcional = (max: number) => z.string().trim().max(max, "Es demasiado largo").transform((t) => t || null);

/** Datos para la factura. Solo se exigen si el motorista pide crédito fiscal. */
export const esquemaFiscal = z.object({
  requiereCreditoFiscal: z.string().transform((v) => v === "on" || v === "true"),
  nit: opcional(17),
  nrc: opcional(10),
  razonSocial: opcional(120),
  giro: opcional(120),
  direccionFiscal: opcional(200),
}).superRefine((d, ctx) => {
  if (d.nit && !nitValido(d.nit)) ctx.addIssue({ code: "custom", path: ["nit"], message: "NIT de 14 dígitos (o DUI de 9)" });
  if (d.nrc && !/^\d{1,7}-?\d$/.test(d.nrc)) ctx.addIssue({ code: "custom", path: ["nrc"], message: "NRC no válido (ej. 123456-7)" });
  if (!d.requiereCreditoFiscal) return;
  if (!d.nit) ctx.addIssue({ code: "custom", path: ["nit"], message: "Escribe tu NIT" });
  if (!d.nrc) ctx.addIssue({ code: "custom", path: ["nrc"], message: "Escribe tu NRC (registro de IVA)" });
  if (!d.razonSocial || d.razonSocial.length < 3) ctx.addIssue({ code: "custom", path: ["razonSocial"], message: "Nombre o razón social como en tu tarjeta de IVA" });
  if (!d.giro || d.giro.length < 3) ctx.addIssue({ code: "custom", path: ["giro"], message: "Escribe tu giro o actividad económica" });
  if (!d.direccionFiscal || d.direccionFiscal.length < 5) ctx.addIssue({ code: "custom", path: ["direccionFiscal"], message: "Escribe tu dirección" });
});
export const CAMPOS_FISCALES = ["requiereCreditoFiscal", "nit", "nrc", "razonSocial", "giro", "direccionFiscal"] as const;

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
