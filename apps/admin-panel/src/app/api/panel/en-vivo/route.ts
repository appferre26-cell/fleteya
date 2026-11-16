import { datosEnVivo } from "@/lib/en-vivo";
import { propietarioActual } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await propietarioActual())) return new Response("No autorizado", { status: 401 });
  return Response.json(await datosEnVivo(), { headers: { "Cache-Control": "private, no-store" } });
}
