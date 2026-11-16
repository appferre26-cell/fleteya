import Link from "next/link";
import { TextoLegal } from "@/components/TextoLegal";

export const metadata = { title: "Términos para Motoristas — FleteYa" };

export default function TerminosMotoristas() {
  return (
    <main>
      <div className="px-5 pt-5"><Link href="/motorista/terminos" className="text-sm text-suave"><i className="fa-solid fa-arrow-left mr-1.5" />Volver</Link></div>
      <TextoLegal archivo="terminos-motoristas.md" base="/motorista/legal" />
    </main>
  );
}
