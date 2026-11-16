// Fechas en hora de El Salvador (siempre UTC-6, sin horario de verano).
// Un día "AAAA-MM-DD" va de las 06:00 UTC de ese día a las 06:00 UTC del siguiente.

const MS_DIA = 86_400_000;
const DESFASE = 6 * 3_600_000;
const FORMATO = /^\d{4}-\d{2}-\d{2}$/;

/** Día de El Salvador ("AAAA-MM-DD") de un instante. */
export function diaSV(d: Date = new Date()) {
  return new Date(d.getTime() - DESFASE).toISOString().slice(0, 10);
}

/** Inicio (en UTC) del día de El Salvador. */
export function inicioDia(dia: string) {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + DESFASE);
}

export function sumarDias(dia: string, n: number) {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + n * MS_DIA).toISOString().slice(0, 10);
}

export function diasEntre(desde: string, hasta: string) {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / MS_DIA);
}

export function fechaValida(v: string | null | undefined): v is string {
  return !!v && FORMATO.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);
}

/** Lunes de la semana del día dado. */
export function lunes(dia: string) {
  const dow = (new Date(`${dia}T00:00:00Z`).getUTCDay() + 6) % 7;
  return sumarDias(dia, -dow);
}

export const PERIODOS = [
  { clave: "hoy", nombre: "Hoy" },
  { clave: "semana", nombre: "Esta semana" },
  { clave: "mes", nombre: "Este mes" },
  { clave: "mes-anterior", nombre: "Mes anterior" },
  { clave: "rango", nombre: "Otras fechas" },
] as const;

export type Periodo = { clave: string; nombre: string; desde: string; hasta: string; inicio: Date; fin: Date; dias: number };

/** Periodo con días inclusivos [desde, hasta]; `fin` es exclusivo (inicio del día siguiente). Máximo 366 días. */
export function periodo(clave?: string, desde?: string, hasta?: string, hoy = diaSV()): Periodo {
  let d: string, h: string;
  switch (clave) {
    case "hoy": d = h = hoy; break;
    case "semana": d = lunes(hoy); h = hoy; break;
    case "mes-anterior": {
      const primero = `${hoy.slice(0, 7)}-01`;
      h = sumarDias(primero, -1); d = `${h.slice(0, 7)}-01`; break;
    }
    case "rango":
      if (fechaValida(desde) && fechaValida(hasta)) {
        [d, h] = desde <= hasta ? [desde, hasta] : [hasta, desde];
        if (diasEntre(d, h) > 365) d = sumarDias(h, -365);
        break;
      }
    // fechas incompletas: este mes
    // falls through
    default: clave = "mes"; d = `${hoy.slice(0, 7)}-01`; h = hoy;
  }
  const nombre = PERIODOS.find((p) => p.clave === clave)!.nombre;
  return { clave, nombre, desde: d, hasta: h, inicio: inicioDia(d), fin: inicioDia(sumarDias(h, 1)), dias: diasEntre(d, h) + 1 };
}

export function fechaLarga(dia: string) {
  return new Intl.DateTimeFormat("es-SV", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${dia}T00:00:00Z`));
}

export function textoPeriodo(p: Periodo) {
  return p.desde === p.hasta ? fechaLarga(p.desde) : `${fechaLarga(p.desde)} – ${fechaLarga(p.hasta)}`;
}
