import "server-only";
import { db } from "./db";

export type Promedio = { promedio: number | null; total: number };

const redondear = (n: number | null | undefined) => (n == null ? null : Math.round(n * 10) / 10);

/** Estrellas válidas (1 a 5) y comentario recortado. */
export function leerCalificacion(estrellas: unknown, comentario: unknown) {
  const e = Number(estrellas);
  if (!Number.isInteger(e) || e < 1 || e > 5) return { error: "Elige de 1 a 5 estrellas." } as const;
  const c = String(comentario ?? "").trim().replace(/\s+/g, " ");
  if (c.length > 300) return { error: "El comentario es muy largo (máximo 300 letras)." } as const;
  return { estrellas: e, comentario: c || null } as const;
}

/** Lo que los clientes opinan de un motorista. */
export async function promedioMotorista(motoristaId: string): Promise<Promedio> {
  const r = await db.viaje.aggregate({ where: { motoristaId, estrellasMotorista: { not: null } }, _avg: { estrellasMotorista: true }, _count: { estrellasMotorista: true } });
  return { promedio: redondear(r._avg.estrellasMotorista), total: r._count.estrellasMotorista };
}

/** Lo que los motoristas opinan de un cliente (por su celular). */
export async function promedioCliente(telefono: string): Promise<Promedio> {
  const r = await db.viaje.aggregate({ where: { clienteTelefono: telefono, estrellasCliente: { not: null } }, _avg: { estrellasCliente: true }, _count: { estrellasCliente: true } });
  return { promedio: redondear(r._avg.estrellasCliente), total: r._count.estrellasCliente };
}

/** Promedios de varios motoristas o clientes a la vez (listas del panel). */
export async function promediosPor(campo: "motoristaId" | "clienteTelefono", ids: string[]) {
  if (ids.length === 0) return new Map<string, Promedio>();
  const estrellas = campo === "motoristaId" ? "estrellasMotorista" : "estrellasCliente";
  const filas = await db.viaje.groupBy({
    by: [campo],
    where: { [campo]: { in: ids }, [estrellas]: { not: null } },
    _avg: { [estrellas]: true },
    _count: { [estrellas]: true },
  } as never) as unknown as Array<Record<string, unknown> & { _avg: Record<string, number | null>; _count: Record<string, number> }>;
  return new Map(filas.map((f) => [String(f[campo]), { promedio: redondear(f._avg[estrellas]), total: f._count[estrellas] }]));
}

export async function clienteBloqueado(telefono: string) {
  return db.clienteBloqueado.findUnique({ where: { telefono } });
}
