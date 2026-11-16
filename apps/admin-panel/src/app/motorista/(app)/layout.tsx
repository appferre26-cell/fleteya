import { exigirMotorista } from "@/lib/sesion-motorista";
import { BarraMotorista } from "./BarraMotorista";

export default async function LayoutAppMotorista({ children }: { children: React.ReactNode }) {
  await exigirMotorista();
  return (
    <>
      <div className="pb-[calc(84px+env(safe-area-inset-bottom))]">{children}</div>
      <BarraMotorista />
    </>
  );
}
