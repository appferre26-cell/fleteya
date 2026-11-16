import { db } from "@/lib/db";
import { propietarioActual } from "@/lib/sesion";

// Las fotos de documentos solo las ve un propietario con sesión activa.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await propietarioActual())) return new Response("No autorizado", { status: 401 });
  const { id } = await params;
  const d = await db.documento.findUnique({ where: { id }, select: { mime: true, datos: true } });
  if (!d) return new Response("No encontrado", { status: 404 });
  return new Response(Buffer.from(d.datos), {
    headers: {
      "Content-Type": d.mime,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
