// Filtros del historial de viajes: los usan la lista del panel y «Exportar a Excel», para que salga lo mismo.
import type { EstadoViaje, Prisma } from "@prisma/client";
import { fechaValida, inicioDia, sumarDias } from "@/lib/periodos";
import { normalizarTelefono } from "@/lib/validacion";

export const EN_CURSO: EstadoViaje[] = ["ASIGNADO", "EN_CAMINO", "CARGANDO", "EN_RUTA"];
export const FILTROS_ESTADO: { clave: string; nombre: string; estados?: EstadoViaje[] }[] = [
  { clave: "todos", nombre: "Todos" },
  { clave: "buscando", nombre: "Buscando motorista", estados: ["BUSCANDO"] },
  { clave: "curso", nombre: "En curso", estados: EN_CURSO },
  { clave: "entregados", nombre: "Entregados", estados: ["ENTREGADO"] },
  { clave: "cancelados", nombre: "Cancelados", estados: ["CANCELADO"] },
];

export type ParamsViajes = { f?: string; q?: string; desde?: string; hasta?: string; m?: string; p?: string };

export function leerFiltros(sp: ParamsViajes) {
  const estado = FILTROS_ESTADO.find((x) => x.clave === sp.f) ?? FILTROS_ESTADO[0];
  const q = (sp.q ?? "").trim().slice(0, 60);
  let desde = fechaValida(sp.desde) ? sp.desde : "";
  let hasta = fechaValida(sp.hasta) ? sp.hasta : "";
  if (desde && hasta && desde > hasta) [desde, hasta] = [hasta, desde];
  const m = /^[a-z0-9]{10,40}$/i.test(sp.m ?? "") ? sp.m! : "";
  const p = /^[a-z0-9]{10,40}$/i.test(sp.p ?? "") ? sp.p! : "";

  // Todo menos el estado (para contar cuántos hay en cada pestaña con los demás filtros puestos).
  const base: Prisma.ViajeWhereInput = {};
  if (desde || hasta) base.creadoEn = { ...(desde && { gte: inicioDia(desde) }), ...(hasta && { lt: inicioDia(sumarDias(hasta, 1)) }) };
  if (m) base.motoristaId = m;
  if (p) base.puntoQrId = p;
  if (q) {
    const tel = normalizarTelefono(q);
    const num = /^(fy-?)?(\d{1,6})$/i.exec(q)?.[2];
    base.OR = [
      { clienteNombre: { contains: q, mode: "insensitive" } },
      ...(tel.length >= 3 ? [{ clienteTelefono: { contains: tel } }] : []),
      ...(num ? [{ numero: Number(num) }] : []),
    ];
  }
  const where: Prisma.ViajeWhereInput = estado.estados ? { ...base, estado: { in: estado.estados } } : base;

  const valores = { f: estado.clave, q, desde, hasta, m, p };
  /** Query string con los filtros actuales (cambiando los que se pasen). */
  const query = (cambios: Partial<typeof valores> = {}) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...valores, ...cambios })) if (v && !(k === "f" && v === "todos")) u.set(k, v);
    const s = u.toString();
    return s ? `?${s}` : "";
  };
  const hayFiltros = !!(q || desde || hasta || m || p);
  return { estado, base, where, valores, query, hayFiltros };
}
