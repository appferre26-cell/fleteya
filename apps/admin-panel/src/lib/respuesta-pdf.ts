import "server-only";
import type { Recibo } from "./recargas";
import { numeroRecibo } from "./recibo";
import { reciboPdf } from "./recibo-pdf";

/** PDF del recibo. Con ?descargar=1 se baja como archivo; si no, se abre en el navegador. */
export async function respuestaPdf(r: Recibo, req: Request) {
  const descargar = new URL(req.url).searchParams.has("descargar");
  return new Response(Buffer.from(await reciboPdf(r)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${descargar ? "attachment" : "inline"}; filename="${numeroRecibo(r.numero)}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
