import { Logo } from "@/components/Logo";
import { BarraInferior, MenuLateral } from "@/components/Navegacion";
import { db } from "@/lib/db";
import { exigirPropietario } from "@/lib/sesion";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const yo = await exigirPropietario();
  const pendientes = await db.motorista.count({ where: { estado: "PENDIENTE" } });
  const iniciales = yo.nombre.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-borde bg-lateral lg:flex">
        <div className="flex h-[72px] items-center border-b border-borde px-6"><Logo sub="Panel de propietarios" /></div>
        <MenuLateral pendientes={pendientes} />
        <div className="flex items-center gap-3 border-t border-borde px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3a3330] text-xs font-bold">{iniciales}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm leading-tight font-semibold">{yo.nombre}</p>
            <p className="text-[11px] text-suave">Propietario</p>
          </div>
          <a href="/salir" title="Cerrar sesión" aria-label="Cerrar sesión" className="text-sm text-suave hover:text-texto">
            <i className="fa-solid fa-right-from-bracket" />
          </a>
        </div>
      </aside>

      <div className="min-w-0 flex-1 pb-20 lg:pb-0">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-borde bg-fondo/95 px-5 backdrop-blur lg:hidden">
          <Logo />
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3a3330] text-[11px] font-bold">{iniciales}</div>
        </header>
        <main className="mx-auto max-w-[1200px] px-5 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>

      <BarraInferior pendientes={pendientes} />
    </div>
  );
}
