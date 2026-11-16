import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION } from "@/lib/token";

export function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.delete(COOKIE_SESION);
  return res;
}
