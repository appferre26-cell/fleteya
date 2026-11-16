import { NextResponse } from "next/server";
import { COOKIE_MOTORISTA } from "@/lib/token";

// Redirección relativa (detrás del proxy de publicación req.url puede decir "localhost").
export async function GET() {
  const res = new NextResponse(null, { status: 307, headers: { Location: "/motorista/entrar" } });
  res.cookies.delete(COOKIE_MOTORISTA);
  return res;
}
