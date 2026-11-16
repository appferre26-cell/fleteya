import { obtenerRecibo } from "@/lib/recargas";
import { leerNumeroRecibo } from "@/lib/recibo";
import { respuestaPdf } from "@/lib/respuesta-pdf";
import { motoristaActual } from "@/lib/sesion-motorista";

// Recibo en PDF para el motorista: solo los suyos.
export async function GET(req: Request, { params }: { params: Promise<{ numero: string }> }) {
  const m = await motoristaActual();
  if (!m) return new Response("No autorizado", { status: 401 });
  const n = leerNumeroRecibo((await params).numero);
  const r = n ? await obtenerRecibo({ numero: n, motoristaId: m.id }) : null;
  if (!r) return new Response("No encontrado", { status: 404 });
  return respuestaPdf(r, req);
}
