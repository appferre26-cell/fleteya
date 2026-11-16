import { Logo } from "@/components/Logo";
import { exigirMotorista } from "@/lib/sesion-motorista";
import { FormContrasena } from "./FormContrasena";

export const metadata = { title: "Tu contraseña — FleteYa Motorista" };

export default async function ContrasenaMotorista() {
  const m = await exigirMotorista({ permitirPendientes: true });
  return (
    <main className="px-5 pt-8 pb-10">
      <Logo sub="Motoristas" />
      <h1 className="mt-8 text-[26px] leading-tight font-extrabold">{m.debeCambiarPassword ? `Hola ${m.nombre.split(" ")[0]}, crea tu contraseña` : "Cambiar contraseña"}</h1>
      <p className="mt-2 text-sm text-suave">{m.debeCambiarPassword ? "La que te dio FleteYa es temporal. Escribe una nueva que solo tú sepas." : "Escribe tu contraseña actual y la nueva."}</p>
      <FormContrasena primera={m.debeCambiarPassword} />
    </main>
  );
}
