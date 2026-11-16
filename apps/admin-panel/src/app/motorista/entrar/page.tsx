import { Logo } from "@/components/Logo";
import { FormEntrar } from "./FormEntrar";

export const metadata = { title: "Entrar — FleteYa Motorista" };

export default function EntrarMotorista() {
  return (
    <main className="flex min-h-dvh flex-col px-5 pt-8 pb-8">
      <Logo sub="Motoristas" />
      <div className="mt-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-naranja/15 px-3 py-1.5 text-[11px] font-bold tracking-wider text-naranja uppercase">
          <i className="fa-solid fa-truck" />Solo motoristas
        </span>
        <h1 className="mt-4 text-[28px] leading-tight font-extrabold">Entra a tu cuenta</h1>
        <p className="mt-2 text-sm text-suave">Usa tu número de teléfono y la contraseña que te dio FleteYa.</p>
      </div>
      <FormEntrar />
      <div className="tarjeta mt-auto flex gap-3 p-4 text-xs leading-relaxed text-suave">
        <i className="fa-solid fa-circle-info mt-0.5" />
        <p><span className="font-semibold text-texto">¿Quieres manejar con FleteYa?</span> No hay registro en la app: FleteYa revisa tu DUI, licencia y tarjeta de circulación y te da tu acceso.</p>
      </div>
    </main>
  );
}
