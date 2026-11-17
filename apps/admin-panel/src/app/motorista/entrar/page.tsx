import Link from "next/link";
import { Logo } from "@/components/Logo";
import { obtenerConfig } from "@/lib/config";
import { dinero } from "@/lib/tarifa";
import { FormEntrar } from "./FormEntrar";

export const metadata = { title: "Entrar — FleteYa Motorista" };

export default async function EntrarMotorista() {
  const cfg = await obtenerConfig();
  return (
    <main className="flex min-h-dvh flex-col px-5 pt-8 pb-8">
      <Logo sub="Motoristas" />
      <div className="mt-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-naranja/15 px-3 py-1.5 text-[11px] font-bold tracking-wider text-naranja uppercase">
          <i className="fa-solid fa-truck" />Solo motoristas
        </span>
        <h1 className="mt-4 text-[28px] leading-tight font-extrabold">Entra a tu cuenta</h1>
        <p className="mt-2 text-sm text-suave">Usa tu número de teléfono y tu contraseña.</p>
      </div>
      <FormEntrar />
      <Link href="/motorista/registro" className="tarjeta mt-auto flex items-center gap-3 p-4 text-xs leading-relaxed text-suave hover:border-naranja" data-testid="ir-registro">
        <i className="fa-solid fa-user-plus text-base text-naranja" />
        <p className="flex-1"><span className="font-semibold text-texto">¿Eres motorista nuevo? Regístrate aquí.</span> Sube tus datos y fotos y paga {dinero(cfg.precioAcceso)} de acceso (una sola vez).</p>
        <i className="fa-solid fa-chevron-right" />
      </Link>
    </main>
  );
}
