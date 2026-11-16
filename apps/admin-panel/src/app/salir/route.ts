import { NextResponse } from "next/server";
import { COOKIE_SESION } from "@/lib/token";

// Redirección relativa: detrás de un proxy (vista previa / publicación), req.url puede decir "localhost".
export function GET() {
  const res = new NextResponse(null, { status: 307, headers: { Location: "/login" } });
  res.cookies.delete(COOKIE_SESION);
  return res;
}
