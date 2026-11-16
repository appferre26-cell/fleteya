import { obtenerRecibo } from "@/lib/recargas";
import { leerNumeroRecibo } from "@/lib/recibo";
import { respuestaPdf } from "@/lib/respuesta-pdf";
import { propietarioActual } from "@/lib/sesion";

// Recibo en PDF para el panel (cualquier recarga).
export async function GET(req: Request, { params }: { params: Promise<{ numero: string }> }) {
  if (!(await propietarioActual())) return new Response("No autorizado", { status: 401 });
  const n = leerNumeroRecibo((await params).numero);
  const r = n ? await obtenerRecibo({ numero: n }) : null;
  if (!r) return new Response("No encontrado", { status: 404 });
  return respuestaPdf(r, req);
}
