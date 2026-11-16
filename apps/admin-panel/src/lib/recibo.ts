// Utilidades de recargas y recibos que se pueden usar en el servidor y en el navegador.

export const PLANES = { SEMANAL: "Semanal", MENSUAL: "Mensual" } as const;
export const FORMAS_PAGO = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", EN_LINEA: "En línea" } as const;

export const numeroRecibo = (n: number) => `REC-${String(n).padStart(6, "0")}`;

/** "REC-000123", "rec123", "123" → 123 */
export function leerNumeroRecibo(v: string) {
  const m = /^(rec-?)?0*(\d{1,9})$/i.exec(v.trim());
  return m ? Number(m[2]) : null;
}

/** jose.ramirez@gmail.com → jose.r••••@gmail.com */
export function ocultarCorreo(c: string) {
  const [u, d] = c.split("@");
  if (!d) return c;
  return `${u.slice(0, Math.min(6, Math.max(1, u.length - 2)))}••••@${d}`;
}

/** "9 nov 2026 · 7:12 a. m." en hora de El Salvador */
export function fechaRecibo(d: Date) {
  const f = new Intl.DateTimeFormat("es-SV", { day: "numeric", month: "short", year: "numeric", timeZone: "America/El_Salvador" }).format(d);
  const h = new Intl.DateTimeFormat("es-SV", { hour: "numeric", minute: "2-digit", timeZone: "America/El_Salvador" }).format(d);
  return `${f} · ${h}`.replace(/[\u00a0\u202f]/g, " ");
}
