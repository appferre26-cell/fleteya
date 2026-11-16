import Link from "next/link";
import { exigirPropietario } from "@/lib/sesion";
import { crearMotorista } from "../acciones";
import { FormMotorista } from "../FormMotorista";

export const metadata = { title: "Agregar motorista — FleteYa" };

export default async function NuevoMotorista() {
  await exigirPropietario();
  return (
    <div className="max-w-4xl">
      <Link href="/panel/motoristas" className="text-xs text-suave hover:text-texto"><i className="fa-solid fa-arrow-left mr-1.5" />Motoristas</Link>
      <h1 className="mt-2 text-[26px] leading-tight font-extrabold">Agregar motorista</h1>
      <p className="mt-1 mb-6 text-sm text-suave">Se le crea una contraseña temporal. Queda pendiente hasta que apruebes sus documentos.</p>
      <FormMotorista accion={crearMotorista} cancelar="/panel/motoristas" />
    </div>
  );
}
