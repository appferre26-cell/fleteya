import { Logo } from "@/components/Logo";
import { FormLogin } from "./FormLogin";

export const metadata = { title: "Acceso de propietarios — FleteYa" };

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-[44%] max-w-[640px] flex-col justify-between border-r border-borde bg-lateral p-14 lg:flex">
        <Logo />
        <div>
          <p className="text-xs font-semibold tracking-wider text-naranja uppercase">Panel de propietarios</p>
          <h2 className="mt-3 max-w-[460px] text-[40px] leading-[1.1] font-extrabold">Toda tu operación de fletes, en un solo lugar.</h2>
          <ul className="mt-8 space-y-3.5 text-[15px] text-[#C8C8C8]">
            {[
              ["fa-id-card-clip", "Alta y verificación de motoristas"],
              ["fa-map-location-dot", "Viajes y motoristas en tiempo real"],
              ["fa-coins", "Créditos, recargas y recibos"],
            ].map(([icono, t]) => (
              <li key={t} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-borde bg-tarjeta">
                  <i className={`fa-solid ${icono} text-sm text-naranja`} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-suave">© 2026 FleteYa · Lourdes, Colón</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 lg:hidden"><Logo sub="Panel de propietarios" /></div>
          <span className="inline-flex items-center gap-2 rounded-full bg-naranja/15 px-3 py-1.5 text-[11px] font-bold tracking-wider text-naranja uppercase">
            <i className="fa-solid fa-shield-halved" />Solo propietarios
          </span>
          <h1 className="mt-5 text-[28px] leading-tight font-extrabold sm:text-[30px]">Acceso de propietarios</h1>
          <p className="mt-2 text-sm text-suave">Ingresa con tu cuenta de propietario para administrar FleteYa.</p>

          <FormLogin />

          <div className="tarjeta mt-8 flex gap-3.5 p-4">
            <i className="fa-solid fa-circle-info mt-0.5 text-suave" />
            <div className="text-xs leading-relaxed text-suave">
              <p><span className="font-semibold text-texto">No hay registro público.</span> Las cuentas de propietario las crea otro propietario desde <span className="text-texto">Administradores</span>.</p>
              <p className="mt-2">¿Eres motorista? Entra desde la <span className="text-texto">app FleteYa Motorista</span>; tu cuenta no funciona aquí.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
