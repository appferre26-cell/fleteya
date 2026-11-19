import { db } from "@/lib/db";

// Ruta PÚBLICA (sin sesión): el cliente no inicia sesión y debe ver la foto de quién le atiende.
// SOLO sirve la foto de perfil (tipo FOTO_PERFIL). Nunca DUI/licencia/etc.: esos siguen siendo privados.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // id = motoristaId
  const d = await db.documento.findUnique({
    where: { motoristaId_tipo: { motoristaId: id, tipo: "FOTO_PERFIL" } },
    select: { mime: true, datos: true },
  });
  if (!d) return new Response("No encontrado", { status: 404 });
  return new Response(Buffer.from(d.datos), {
    headers: {
      "Content-Type": d.mime,
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
