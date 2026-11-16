import { db } from "@/lib/db";
import { respuestaCsv } from "@/lib/csv";
import { fechaValida } from "@/lib/periodos";
import { fechaGasto } from "@/lib/reportes";
import { propietarioActual } from "@/lib/sesion";

// Exportar gastos a CSV. ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD opcionales.
export async function GET(req: Request) {
  if (!(await propietarioActual())) return new Response("No autorizado", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const desde = sp.get("desde"), hasta = sp.get("hasta");
  const gastos = await db.gasto.findMany({
    where: { fecha: { ...(fechaValida(desde) && { gte: fechaGasto(desde) }), ...(fechaValida(hasta) && { lte: fechaGasto(hasta) }) } },
    orderBy: [{ fecha: "asc" }, { creadoEn: "asc" }],
    include: { registradoPor: { select: { nombre: true } } },
  });
  return respuestaCsv([
    ["Fecha", "Categoría", "Detalle", "Monto", "Anotado por"],
    ...gastos.map((g) => [g.fecha.toISOString().slice(0, 10), g.categoria, g.concepto, Number(g.monto).toFixed(2), g.registradoPor.nombre]),
  ], "gastos-fleteya.csv");
}
