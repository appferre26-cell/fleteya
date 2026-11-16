import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_MOTORISTA, COOKIE_SESION, verificarToken } from "@/lib/token";

// Primera barrera: sin sesión no se entra al panel ni a la app del motorista.
// (Cada página vuelve a revisar en la base que la cuenta siga activa.)
// Las dos sesiones son independientes: la de propietario no abre la app del motorista ni al revés.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/motorista")) {
    const id = await verificarToken(req.cookies.get(COOKIE_MOTORISTA)?.value, "motorista");
    const publica = pathname === "/motorista/entrar" || pathname.startsWith("/motorista/legal");
    if (!id && pathname.startsWith("/motorista/api/")) return new NextResponse("No autorizado", { status: 401 });
    if (!id && !publica) return NextResponse.redirect(new URL("/motorista/entrar", req.url));
    if (id && pathname === "/motorista/entrar") return NextResponse.redirect(new URL("/motorista", req.url));
    return NextResponse.next();
  }

  const id = await verificarToken(req.cookies.get(COOKIE_SESION)?.value);
  if (!id && (pathname.startsWith("/panel") || pathname.startsWith("/api/"))) {
    if (pathname.startsWith("/api/")) return new NextResponse("No autorizado", { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (id && pathname === "/login") return NextResponse.redirect(new URL("/panel", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/panel/:path*", "/api/:path*", "/login", "/motorista/:path*"] };
