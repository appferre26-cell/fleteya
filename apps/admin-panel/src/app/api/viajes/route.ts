import { db } from "@/lib/db";
import { fechaHoraCsv, respuestaCsv } from "@/lib/csv";
import { leerFiltros } from "@/lib/filtro-viajes";
import { textoRango } from "@/lib/rangos";
import { propietarioActual } from "@/lib/sesion";
import { ESTADOS_VIAJE, numeroViaje } from "@/lib/tarifa";
import { diaSV } from "@/lib/periodos";

// Exportar el historial de viajes a Excel (CSV) con los mismos filtros de la lista: ?f, q, desde, hasta, m, p.
export async function GET(req: Request) {
  if (!(await propietarioActual())) return new Response("No autorizado", { status: 401 });
  const { where } = leerFiltros(Object.fromEntries(new URL(req.url).searchParams));
  const viajes = await db.viaje.findMany({
    where, orderBy: { numero: "asc" }, take: 20_000,
    include: { motorista: { select: { nombre: true, placa: true } }, puntoQr: { select: { codigo: true } }, items: { select: { nombre: true, cantidad: true, unidad: true } } },
  });
  const n = (v: unknown) => (v == null ? "" : Number(v).toFixed(2));
  const filas = [
    ["Viaje", "Fecha del pedido", "Estado", "Cliente", "Celular", "Punto QR", "Recogida", "Destino", "Km", "Peso (kg)", "Carga",
      "Precio por peso", "Precio acordado", "Comisión FleteYa", "Motorista", "Placa", "Aceptado", "Entregado", "Cancelado por", "Motivo cancelación",
      "Estrellas al motorista", "Estrellas al cliente"],
    ...viajes.map((v) => [
      numeroViaje(v.numero), fechaHoraCsv(v.creadoEn), ESTADOS_VIAJE[v.estado].nombre, v.clienteNombre, v.clienteTelefono, v.puntoQr?.codigo,
      v.origenDireccion, v.destinoDireccion, Number(v.distanciaKm).toFixed(1), Number(v.pesoKg).toFixed(0),
      textoRango(v.rangoTon, Number(v.pesoKg)) ?? v.items.map((i) => `${Number(i.cantidad)} ${i.unidad} ${i.nombre}`).join("; "),
      n(v.precioBase), n(v.precioFinal), n(v.comision), v.motorista?.nombre, v.motorista?.placa, fechaHoraCsv(v.asignadoEn), fechaHoraCsv(v.entregadoEn),
      v.canceladoPor === "CLIENTE" ? "Cliente" : v.canceladoPor === "PROPIETARIO" ? "FleteYa" : "", v.motivoCancelacion,
      v.estrellasMotorista, v.estrellasCliente,
    ]),
  ];
  return respuestaCsv(filas, `viajes-fleteya-${diaSV()}.csv`);
}
