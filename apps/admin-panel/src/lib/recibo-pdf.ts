import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Recibo } from "./recargas";
import { CONCEPTOS, FORMAS_PAGO, fechaRecibo, numeroRecibo } from "./recibo";
import { dinero } from "./tarifa";

const NARANJA = rgb(1, 0.42, 0);
const NEGRO = rgb(0.1, 0.1, 0.1);
const GRIS = rgb(0.42, 0.42, 0.42);
const ROJO = rgb(0.83, 0.18, 0.18);
const VERDE = rgb(0.12, 0.55, 0.3);

/** Recibo de recarga en PDF (tamaño A5). Helvetica cubre tildes y ñ; lo que no pueda dibujar se cambia por "?". */
export async function reciboPdf(r: Recibo) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Recibo ${numeroRecibo(r.numero)} — FleteYa`);
  pdf.setAuthor("FleteYa");
  const pag = pdf.addPage([420, 595]);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 420, M = 32;

  const seguro = (s: string, f: PDFFont) => Array.from(s.replace(/[\u00a0\u202f]/g, " ")).map((c) => {
    try { f.encodeText(c); return c; } catch { return "?"; }
  }).join("");
  const texto = (p: PDFPage, s: string, x: number, y: number, o: { f?: PDFFont; t?: number; c?: ReturnType<typeof rgb>; derecha?: boolean } = {}) => {
    const f = o.f ?? normal, t = o.t ?? 10, v = seguro(s, f);
    p.drawText(v, { x: o.derecha ? x - f.widthOfTextAtSize(v, t) : x, y, size: t, font: f, color: o.c ?? NEGRO });
  };
  const envolver = (s: string, f: PDFFont, t: number, ancho: number) => {
    const lineas: string[] = [];
    let l = "";
    for (const w of seguro(s, f).split(" ")) {
      const prueba = l ? `${l} ${w}` : w;
      if (f.widthOfTextAtSize(prueba, t) > ancho && l) { lineas.push(l); l = w; } else l = prueba;
    }
    if (l) lineas.push(l);
    return lineas;
  };

  let y = 595 - M - 18;
  // Encabezado
  pag.drawRectangle({ x: M, y: y - 6, width: 26, height: 26, color: NARANJA });
  texto(pag, "FY", M + 5, y + 2, { f: negrita, t: 11, c: rgb(1, 1, 1) });
  texto(pag, "Flete", M + 34, y + 1, { f: negrita, t: 18 });
  texto(pag, "Ya", M + 34 + negrita.widthOfTextAtSize("Flete", 18), y + 1, { f: negrita, t: 18, c: NARANJA });
  const sello = r.anulada ? "ANULADO" : "PAGADO";
  const ancho = negrita.widthOfTextAtSize(sello, 9) + 16;
  pag.drawRectangle({ x: W - M - ancho, y: y - 2, width: ancho, height: 18, color: r.anulada ? rgb(0.98, 0.88, 0.88) : rgb(0.86, 0.95, 0.89) });
  texto(pag, sello, W - M - 8, y + 4, { f: negrita, t: 9, c: r.anulada ? ROJO : VERDE, derecha: true });

  y -= 30;
  texto(pag, `${r.emisor.nombre || "[Nombre del socio inscrito pendiente]"} · NIT ${r.emisor.nit || "[pendiente]"}`, M, y, { t: 8.5, c: GRIS });
  y -= 12;
  texto(pag, r.emisor.direccion || `[Dirección pendiente] · ${r.zona}`, M, y, { t: 8.5, c: GRIS });
  y -= 16;
  for (let x = M; x < W - M; x += 6) pag.drawLine({ start: { x, y }, end: { x: x + 3, y }, thickness: 0.6, color: rgb(0.8, 0.8, 0.8) });

  // Número y fecha
  y -= 22;
  texto(pag, "RECIBO N.º", M, y, { f: negrita, t: 8, c: GRIS });
  texto(pag, "FECHA", W - M, y, { f: negrita, t: 8, c: GRIS, derecha: true });
  y -= 18;
  texto(pag, numeroRecibo(r.numero), M, y, { f: negrita, t: 15 });
  texto(pag, fechaRecibo(r.fecha), W - M, y, { f: negrita, t: 11, derecha: true });

  // Datos
  const acceso = r.concepto === "ACCESO";
  y -= 14;
  const filas: [string, string][] = [
    ["Motorista", r.motorista.nombre],
    ["Concepto", CONCEPTOS[r.concepto] + (acceso ? " (pago único)" : "")],
    ...(r.motorista.requiereCreditoFiscal ? [["Crédito fiscal", `NIT ${r.motorista.nit ?? "—"} · NRC ${r.motorista.nrc ?? "—"}`] as [string, string]] : []),
    ["Forma de pago", FORMAS_PAGO[r.formaPago]],
    ...(r.referencia ? [["Referencia", r.referencia] as [string, string]] : []),
    ["Registrado por", r.registradoPor],
  ];
  for (const [k, v] of filas) {
    y -= 22;
    texto(pag, k, M, y, { c: GRIS, t: 10.5 });
    texto(pag, v, W - M, y, { f: negrita, t: 10.5, derecha: true });
    pag.drawLine({ start: { x: M, y: y - 8 }, end: { x: W - M, y: y - 8 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
  }

  // Montos
  y -= 24;
  const alto = acceso ? 44 : r.deuda > 0 ? 116 : 92;
  pag.drawRectangle({ x: M, y: y - alto + 12, width: W - 2 * M, height: alto, color: rgb(0.95, 0.95, 0.95) });
  const montos: [string, string, ReturnType<typeof rgb>][] = acceso ? [] : [
    ["Monto recargado", dinero(r.monto), NEGRO],
    ["Saldo anterior", dinero(r.saldoAntes), r.saldoAntes < 0 ? ROJO : NEGRO],
    ...(r.deuda > 0 ? [["Deuda descontada", `-${dinero(r.deuda)}`, ROJO] as [string, string, ReturnType<typeof rgb>]] : []),
  ];
  for (const [k, v, c] of montos) {
    y -= 4;
    texto(pag, k, M + 12, y, { c: GRIS });
    texto(pag, v, W - M - 12, y, { f: negrita, c, derecha: true });
    y -= 20;
  }
  y -= 4;
  texto(pag, acceso ? "Total pagado" : "Saldo nuevo", M + 12, y, { f: negrita, t: 11 });
  texto(pag, dinero(acceso ? r.monto : r.saldoDespues), W - M - 12, y - 2, { f: negrita, t: 17, c: NARANJA, derecha: true });

  y -= 40;
  const pie = acceso ? "Pago único por el acceso a la plataforma FleteYa. Para recibir viajes, además, necesitas créditos (recargas)."
    : `Los créditos se usan para recibir viajes en FleteYa. Por cada viaje completado se descuenta el ${r.comisionPct}% del valor del viaje.`;
  for (const l of envolver(`${pie} Comprobante interno de pago: no sustituye la factura electrónica.`, normal, 8.5, W - 2 * M)) {
    texto(pag, l, M, y, { t: 8.5, c: GRIS });
    y -= 12;
  }
  if (r.nota) { y -= 4; for (const l of envolver(`Nota: ${r.nota}`, normal, 8.5, W - 2 * M)) { texto(pag, l, M, y, { t: 8.5, c: GRIS }); y -= 12; } }
  if (r.anulada) {
    y -= 6;
    for (const l of envolver(`Recibo anulado el ${fechaRecibo(r.anulada.en)} por ${r.anulada.por}. Motivo: ${r.anulada.motivo}. ${acceso ? "El acceso vuelve a quedar sin pagar." : "El monto se restó del saldo."}`, negrita, 9, W - 2 * M)) {
      texto(pag, l, M, y, { f: negrita, t: 9, c: ROJO });
      y -= 13;
    }
  }
  return pdf.save();
}
