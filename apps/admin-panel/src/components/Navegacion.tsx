"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LISTOS = [
  { href: "/panel", icono: "fa-gauge-high", nombre: "Inicio", corto: "Inicio" },
  { href: "/panel/viajes", icono: "fa-route", nombre: "Viajes", corto: "Viajes" },
  { href: "/panel/motoristas", icono: "fa-id-card", nombre: "Motoristas", corto: "Motoristas" },
  { href: "/panel/puntos-qr", icono: "fa-qrcode", nombre: "Puntos QR", corto: "Puntos QR" },
  { href: "/panel/catalogo", icono: "fa-cubes", nombre: "Catálogo de materiales", corto: "Catálogo" },
  { href: "/panel/tarifas", icono: "fa-tags", nombre: "Tarifas y zona", corto: "Tarifas" },
  { href: "/panel/administradores", icono: "fa-user-shield", nombre: "Administradores", corto: "Admins" },
];
// En el celular, la barra de abajo muestra estos; el resto va en «Más».
const EN_BARRA = ["/panel", "/panel/viajes", "/panel/motoristas"];

// Secciones de las siguientes partes del plan: se ven, pero aún no se pueden abrir.
const PRONTO = [
  { icono: "fa-coins", nombre: "Créditos y recargas" },
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
  const [mas, setMas] = useState(false);
  useEffect(() => setMas(false), [path]);
  const barra = LISTOS.filter((l) => EN_BARRA.includes(l.href));
  const resto = LISTOS.filter((l) => !EN_BARRA.includes(l.href));
  const masActivo = resto.some((l) => activo(path, l.href));
  return (
    <>
      {mas && (
        <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMas(false)}>
          <div role="dialog" aria-label="Más secciones" onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-borde bg-lateral p-3 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
            {resto.map((l) => (
              <Link key={l.href} href={l.href}
                className={`flex h-12 items-center gap-3 rounded-lg px-3 text-sm ${activo(path, l.href) ? "bg-naranja/10 font-semibold text-naranja" : "font-medium"}`}>
                <i className={`fa-solid ${l.icono} w-5 text-suave`} />{l.nombre}
              </Link>
            ))}
            <a href="/salir" className="flex h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium text-error">
              <i className="fa-solid fa-right-from-bracket w-5" />Cerrar sesión
            </a>
          </div>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-borde bg-lateral pb-[env(safe-area-inset-bottom)] lg:hidden">
        {barra.map((l) => (
          <Link key={l.href} href={l.href}
            className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${activo(path, l.href) && !mas ? "text-naranja" : "text-suave"}`}>
            <i className={`fa-solid ${l.icono} text-base`} />{l.corto}
            {l.href === "/panel/motoristas" && pendientes > 0 && (
              <span className="absolute top-2 left-1/2 ml-2 rounded-full bg-naranja px-1.5 text-[10px] font-bold text-fondo">{pendientes}</span>
            )}
          </Link>
        ))}
        <button type="button" onClick={() => setMas((x) => !x)} aria-expanded={mas}
          className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${mas || masActivo ? "text-naranja" : "text-suave"}`}>
          <i className={`fa-solid ${mas ? "fa-xmark" : "fa-bars"} text-base`} />Más
        </button>
      </nav>
    </>
  );
}
