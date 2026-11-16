import { db } from "@/lib/db";
import { FORMAS_PAGO, PLANES, numeroRecibo } from "@/lib/recibo";
import { propietarioActual } from "@/lib/sesion";
import { fechaHoraCsv, respuestaCsv } from "@/lib/csv";

// Exportar recargas a CSV (se abre en Excel). ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD opcionales.
export async function GET(req: Request) {
  if (!(await propietarioActual())) return new Response("No autorizado", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const fecha = (v: string | null, fin = false) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T${fin ? "23:59:59.999" : "00:00:00"}-06:00`) : undefined);
  const desde = fecha(sp.get("desde")), hasta = fecha(sp.get("hasta"), true);
  const recargas = await db.recarga.findMany({
    where: { creadoEn: { gte: desde, lte: hasta } },
    orderBy: { numero: "asc" },
    include: { motorista: { select: { nombre: true, telefono: true, dui: true } }, registradoPor: { select: { nombre: true } } },
  });
  const fh = fechaHoraCsv;
  const filas = [
    ["Recibo", "Fecha", "Motorista", "Teléfono", "DUI", "Plan", "Monto", "Forma de pago", "Referencia", "Saldo anterior", "Deuda descontada", "Saldo nuevo", "Registrado por", "Estado", "Motivo anulación"],
    ...recargas.map((r) => [
      numeroRecibo(r.numero), fh(r.creadoEn), r.motorista.nombre, r.motorista.telefono, r.motorista.dui, PLANES[r.plan], Number(r.monto).toFixed(2),
      FORMAS_PAGO[r.formaPago], r.referencia, Number(r.saldoAntes).toFixed(2), Number(r.deudaDescontada).toFixed(2), Number(r.saldoDespues).toFixed(2),
      r.registradoPor.nombre, r.anuladaEn ? "Anulada" : "Pagada", r.motivoAnulacion,
    ]),
  ];
  return respuestaCsv(filas, "recargas-fleteya.csv");
}
