import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, verificarToken } from "@/lib/token";

// Primera barrera: sin sesión de propietario no se entra al panel.
// (Cada página vuelve a revisar en la base que el propietario siga activo.)
export async function middleware(req: NextRequest) {
  const id = await verificarToken(req.cookies.get(COOKIE_SESION)?.value);
  const { pathname } = req.nextUrl;

  if (!id && (pathname.startsWith("/panel") || pathname.startsWith("/api/"))) {
    if (pathname.startsWith("/api/")) return new NextResponse("No autorizado", { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (id && pathname === "/login") return NextResponse.redirect(new URL("/panel", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/panel/:path*", "/api/:path*", "/login"] };
