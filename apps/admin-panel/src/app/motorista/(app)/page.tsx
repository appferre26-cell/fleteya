import { datosInicio } from "@/lib/inicio-motorista";
import { exigirMotorista } from "@/lib/sesion-motorista";
import { Inicio } from "./Inicio";

export const metadata = { title: "Inicio — FleteYa Motorista" };

export default async function InicioMotorista() {
  const m = await exigirMotorista();
  return <Inicio inicial={await datosInicio(m)} />;
}
