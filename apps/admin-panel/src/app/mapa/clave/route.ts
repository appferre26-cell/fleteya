// Clave pública de Google Maps para el navegador (se protege con restricciones de dirección en Google Cloud).
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ clave: process.env.GOOGLE_MAPS_API_KEY || "" }, { headers: { "Cache-Control": "public, max-age=300" } });
}
