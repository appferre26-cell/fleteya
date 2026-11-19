import "server-only";
import { Prisma, type TipoDocumento } from "@prisma/client";
import { MAX_DOC_BYTES, TIPOS_DOC, type ErroresCampos } from "./validacion";

/** Revisa el contenido real del archivo (no solo su nombre). */
function detectarMime(b: Buffer): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 4).toString("hex") === "89504e47") return "image/png";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (b.subarray(0, 4).toString() === "%PDF") return "application/pdf";
  return null;
}

/** Lee las fotos `doc_<TIPO>` del formulario. Con `exigirTodas`, falta una = error en ese campo. */
export async function leerDocumentos(form: FormData, opciones: { exigirTodas?: boolean } = {}) {
  const docs: { tipo: TipoDocumento; mime: string; datos: Uint8Array<ArrayBuffer> }[] = [];
  const errores: ErroresCampos = {};
  for (const tipo of TIPOS_DOC) {
    const f = form.get(`doc_${tipo}`);
    if (!(f instanceof File) || f.size === 0) {
      if (opciones.exigirTodas) errores[`doc_${tipo}`] = "Falta esta foto";
      continue;
    }
    if (f.size > MAX_DOC_BYTES) { errores[`doc_${tipo}`] = "El archivo pesa más de 4 MB"; continue; }
    const datos = new Uint8Array(await f.arrayBuffer());
    const mime = detectarMime(Buffer.from(datos.buffer));
    if (!mime) { errores[`doc_${tipo}`] = "Sube una foto (JPG, PNG) o un PDF"; continue; }
    docs.push({ tipo, mime, datos });
  }
  return { docs, errores };
}

/** Solo imágenes para la foto de perfil (no PDF). */
const MIME_FOTO_PERFIL = ["image/jpeg", "image/png", "image/webp"];

/**
 * Lee la foto de perfil OPCIONAL del formulario (campo `foto_perfil`).
 * Acepta solo imágenes (JPG, PNG, WEBP), máx. 4 MB, validando el contenido real.
 * Si no viene archivo no es error (devuelve {}). No entra en los documentos obligatorios.
 */
export async function leerFotoPerfil(form: FormData): Promise<{ foto?: { mime: string; datos: Uint8Array<ArrayBuffer> }; error?: string }> {
  const f = form.get("foto_perfil");
  if (!(f instanceof File) || f.size === 0) return {};
  if (f.size > MAX_DOC_BYTES) return { error: "La foto pesa más de 4 MB" };
  const datos = new Uint8Array(await f.arrayBuffer());
  const mime = detectarMime(Buffer.from(datos.buffer));
  if (!mime || !MIME_FOTO_PERFIL.includes(mime)) return { error: "Sube una imagen (JPG, PNG o WEBP)" };
  return { foto: { mime, datos } };
}

export function errorDuplicado(e: unknown): ErroresCampos | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const campos = String((e.meta?.target as string[] | undefined)?.join(",") ?? "");
    if (campos.includes("telefono")) return { telefono: "Ya hay un motorista con este teléfono" };
    if (campos.includes("dui")) return { dui: "Ya hay un motorista con este DUI" };
    if (campos.includes("placa")) return { placa: "Ya hay un motorista con esta placa" };
    return { general: "Uno de los datos ya está registrado" };
  }
  return null;
}

export const CAMPOS_MOTORISTA = ["nombre", "telefono", "correo", "dui", "licenciaNumero", "licenciaVence", "placa", "marca", "modelo", "tipoVehiculo", "capacidadTon"] as const;

export function datosDe(form: FormData) {
  return Object.fromEntries(CAMPOS_MOTORISTA.map((k) => [k, String(form.get(k) ?? "")]));
}
