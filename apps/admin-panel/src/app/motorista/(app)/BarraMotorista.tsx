"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/motorista", icono: "fa-house", texto: "Inicio" },
  { href: "/motorista/viajes", icono: "fa-clock-rotate-left", texto: "Viajes" },
  { href: "/motorista/creditos", icono: "fa-coins", texto: "Créditos" },
  { href: "/motorista/perfil", icono: "fa-user", texto: "Perfil" },
];

export function BarraMotorista() {
  const ruta = usePathname();
  return (
    <nav aria-label="Menú del motorista" className="fixed inset-x-0 bottom-0 z-20 border-t border-borde bg-lateral/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-[520px] grid-cols-4">
        {TABS.map((t) => {
          const activo = t.href === "/motorista" ? ruta === t.href : ruta.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={activo ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${activo ? "text-naranja" : "text-suave"}`}>
                <i className={`fa-solid ${t.icono} text-lg`} />{t.texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
