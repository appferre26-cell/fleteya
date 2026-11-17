import "server-only";
import nodemailer from "nodemailer";
import { db } from "./db";
import { obtenerRecibo } from "./recargas";
import { CONCEPTOS, FORMAS_PAGO, fechaRecibo, numeroRecibo } from "./recibo";
import { reciboPdf } from "./recibo-pdf";
import { dinero } from "./tarifa";

// El correo es opcional: solo se manda si está configurado SMTP_URL (ej. smtps://usuario:clave@smtp.gmail.com:465)
// y el motorista tiene correo. Si falla, la recarga queda registrada igual y el error se ve en el panel.
export const correoConfigurado = () => !!process.env.SMTP_URL;

export async function enviarReciboPorCorreo(numero: number): Promise<{ ok: boolean; mensaje: string }> {
  const r = await obtenerRecibo({ numero });
  if (!r) return { ok: false, mensaje: "No se encontró el recibo." };
  if (!r.motorista.correo) return { ok: false, mensaje: "El motorista no tiene correo registrado." };
  if (!correoConfigurado()) return { ok: false, mensaje: "El envío de correos no está configurado en el servidor (SMTP_URL)." };

  const n = numeroRecibo(r.numero);
  try {
    const url = new URL(process.env.SMTP_URL!);
    for (const [k, v] of [["connectionTimeout", "10000"], ["greetingTimeout", "10000"], ["socketTimeout", "15000"]]) {
      if (!url.searchParams.has(k)) url.searchParams.set(k, v);
    }
    const t = nodemailer.createTransport(url.toString());
    await t.sendMail({
      from: process.env.CORREO_REMITENTE ?? "FleteYa <no-responder@fleteya.app>",
      to: r.motorista.correo,
      subject: `${r.anulada ? "Recibo anulado" : r.concepto === "ACCESO" ? "Recibo de acceso" : "Recibo de recarga"} ${n} — FleteYa`,
      text: [
        `Hola, ${r.motorista.nombre}:`,
        "",
        r.anulada ? `El recibo ${n} fue anulado. Motivo: ${r.anulada.motivo}.` : `Registramos tu pago de ${dinero(r.monto)} por «${CONCEPTOS[r.concepto]}» (${FORMAS_PAGO[r.formaPago].toLowerCase()}).`,
        `Fecha: ${fechaRecibo(r.fecha)}`,
        `Saldo anterior: ${dinero(r.saldoAntes)}${r.deuda > 0 ? ` · deuda descontada: ${dinero(r.deuda)}` : ""}`,
        `Saldo nuevo: ${dinero(r.saldoDespues)}`,
        "",
        "Adjuntamos el recibo en PDF. También lo ves en la app: Créditos → Historial de recargas.",
        "",
        "FleteYa",
      ].join("\n"),
      attachments: [{ filename: `${n}.pdf`, content: Buffer.from(await reciboPdf(r)), contentType: "application/pdf" }],
    });
    await db.recarga.update({ where: { id: r.id }, data: { correoEnviadoA: r.motorista.correo, correoEnviadoEn: new Date(), correoError: null } });
    return { ok: true, mensaje: `Recibo enviado a ${r.motorista.correo}.` };
  } catch (e) {
    const detalle = e instanceof Error ? e.message.slice(0, 200) : "error desconocido";
    console.error(`[correo] ${n}:`, detalle);
    await db.recarga.update({ where: { id: r.id }, data: { correoError: detalle } });
    return { ok: false, mensaje: `No se pudo enviar el correo: ${detalle}` };
  }
}
