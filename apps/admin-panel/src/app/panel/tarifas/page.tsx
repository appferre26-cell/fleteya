import { obtenerConfig } from "@/lib/config";
import { FormTarifas } from "./FormTarifas";

export default async function Tarifas() {
  const cfg = await obtenerConfig();
  return (
    <>
      <h1 className="text-[24px] font-extrabold lg:text-[28px]">Tarifas y zona</h1>
      <p className="mt-1 text-sm text-suave">Cambia precios y zona sin tocar código. Solo afecta a los pedidos nuevos; los que ya existen guardan su precio.</p>
      <FormTarifas cfg={cfg} />
    </>
  );
}
