import Link from "next/link";
import { obtenerConfig } from "@/lib/config";
import { exigirPropietario } from "@/lib/sesion";
import { FormDatos } from "./FormDatos";

export const metadata = { title: "Datos y planes — FleteYa" };

export default async function DatosCreditos() {
  await exigirPropietario();
  const c = await obtenerConfig();
  return (
    <>
      <Link href="/panel/creditos" className="text-sm text-suave hover:text-naranja"><i className="fa-solid fa-arrow-left mr-2" />Créditos y recargas</Link>
      <h1 className="mt-2 text-[24px] font-extrabold lg:text-[28px]">Datos y planes</h1>
      <p className="mt-1 text-sm text-suave">Datos del recibo, cuenta donde los motoristas transfieren y precios de los planes.</p>
      <FormDatos d={{
        emisorNombre: c.emisorNombre, emisorNit: c.emisorNit, emisorDireccion: c.emisorDireccion,
        bancoNombre: c.bancoNombre, bancoTipoCuenta: c.bancoTipoCuenta, bancoNumero: c.bancoNumero, bancoTitular: c.bancoTitular,
        planSemanal: c.planSemanal, planMensual: c.planMensual, comisionPct: c.comisionPct,
      }} />
    </>
  );
}
