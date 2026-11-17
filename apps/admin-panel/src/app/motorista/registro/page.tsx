import Link from "next/link";
import { Logo } from "@/components/Logo";
import { obtenerConfig } from "@/lib/config";
import { dinero } from "@/lib/tarifa";
import { FormRegistro } from "./FormRegistro";

export const metadata = { title: "Regístrate — FleteYa Motorista" };

export default async function RegistroMotorista() {
  const cfg = await obtenerConfig();
  return (
    <main className="px-5 pt-8 pb-10">
      <Logo sub="Motoristas" />
      <h1 className="mt-8 text-[28px] leading-tight font-extrabold">Maneja con FleteYa</h1>
      <p className="mt-2 text-sm text-suave">
        Llena tus datos y sube las fotos. El acceso cuesta <b className="text-texto">{dinero(cfg.precioAcceso)}</b> una sola vez; después solo recargas para recibir viajes.
      </p>
      <FormRegistro precio={dinero(cfg.precioAcceso)} />
      <p className="mt-6 text-center text-sm text-suave">¿Ya tienes cuenta? <Link href="/motorista/entrar" className="font-semibold text-naranja">Entra aquí</Link></p>
    </main>
  );
}
