"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LISTOS = [
  { href: "/panel", icono: "fa-gauge-high", nombre: "Inicio", corto: "Inicio" },
  { href: "/panel/motoristas", icono: "fa-id-card", nombre: "Motoristas", corto: "Motoristas" },
  { href: "/panel/administradores", icono: "fa-user-shield", nombre: "Administradores", corto: "Admins" },
];

// Secciones de las siguientes partes del plan: se ven, pero aún no se pueden abrir.
const PRONTO = [
  { icono: "fa-route", nombre: "Viajes" },
  { icono: "fa-coins", nombre: "Créditos y recargas" },
  { icono: "fa-qrcode", nombre: "Puntos QR" },
  { icono: "fa-cubes", nombre: "Catálogo de materiales" },
  { icono: "fa-tags", nombre: "Tarifas" },
];

function activo(path: string, href: string) {
  return href === "/panel" ? path === "/panel" : path.startsWith(href);
}

export function MenuLateral({ pendientes }: { pendientes: number }) {
  const path = usePathname();
  return (
    <nav className="flex-1 px-3 py-5">
      <p className="mb-2 px-3 text-[10px] font-semibold tracking-wider text-[#6b6b6b] uppercase">Operación</p>
      {LISTOS.map((l) => (
        <Link key={l.href} href={l.href}
          className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm ${activo(path, l.href) ? "bg-naranja/10 font-semibold text-naranja" : "font-medium text-suave hover:bg-tarjeta"}`}>
          <i className={`fa-solid ${l.icono} w-4`} />{l.nombre}
          {l.href === "/panel/motoristas" && pendientes > 0 && (
            <span className="ml-auto rounded-full bg-naranja px-1.5 py-0.5 text-[10px] font-bold text-fondo">{pendientes}</span>
          )}
        </Link>
      ))}
      <p className="mt-6 mb-2 px-3 text-[10px] font-semibold tracking-wider text-[#6b6b6b] uppercase">Próximas partes</p>
      {PRONTO.map((l) => (
        <span key={l.nombre} aria-disabled className="flex h-10 cursor-not-allowed items-center gap-3 rounded-lg px-3 text-sm font-medium text-[#5a5a5a]">
          <i className={`fa-solid ${l.icono} w-4`} />{l.nombre}
          <span className="ml-auto rounded bg-tarjeta-2 px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase">Pronto</span>
        </span>
      ))}
    </nav>
  );
}

export function BarraInferior({ pendientes }: { pendientes: number }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-borde bg-lateral pb-[env(safe-area-inset-bottom)] lg:hidden">
      {LISTOS.map((l) => (
        <Link key={l.href} href={l.href}
          className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${activo(path, l.href) ? "text-naranja" : "text-suave"}`}>
          <i className={`fa-solid ${l.icono} text-base`} />{l.corto}
          {l.href === "/panel/motoristas" && pendientes > 0 && (
            <span className="absolute top-2 left-1/2 ml-2 rounded-full bg-naranja px-1.5 text-[10px] font-bold text-fondo">{pendientes}</span>
          )}
        </Link>
      ))}
      <a href="/salir" className="flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-suave">
        <i className="fa-solid fa-right-from-bracket text-base" />Salir
      </a>
    </nav>
  );
}
