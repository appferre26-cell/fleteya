import Link from "next/link";
import { notFound } from "next/navigation";
import { ReciboTarjeta } from "@/components/ReciboTarjeta";
import { obtenerRecibo } from "@/lib/recargas";
import { PLANES, leerNumeroRecibo, numeroRecibo, ocultarCorreo } from "@/lib/recibo";
import { exigirMotorista } from "@/lib/sesion-motorista";
import { dinero } from "@/lib/tarifa";
import { CompartirRecibo } from "../../BotonesCliente";

export const metadata = { title: "Recibo — FleteYa Motorista" };

export default async function ReciboMotorista({ params }: { params: Promise<{ numero: string }> }) {
  const m = await exigirMotorista();
  const n = leerNumeroRecibo((await params).numero);
  // Solo sus propios recibos: el de otro motorista da 404.
  const r = n ? await obtenerRecibo({ numero: n, motoristaId: m.id }) : null;
  if (!r) notFound();
  const rec = numeroRecibo(r.numero);
  const texto = `Recibo ${rec} de FleteYa · Recarga ${PLANES[r.plan].toLowerCase()} de ${dinero(r.monto)} · Saldo nuevo ${dinero(r.saldoDespues)}${r.anulada ? " (ANULADO)" : ""}`;

  return (
    <main className="px-5 pt-6 pb-6">
      <div className="flex items-center gap-3">
        <Link href="/motorista/creditos" aria-label="Volver a Mis créditos" className="flex h-10 w-10 items-center justify-center rounded-full bg-tarjeta"><i className="fa-solid fa-arrow-left" /></Link>
        <div>
          <h1 className="text-xl font-extrabold">Recibo de recarga</h1>
          <p className="text-xs text-suave">{rec}</p>
        </div>
      </div>

      <div className="mt-5"><ReciboTarjeta r={r} /></div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <a href={`/motorista/api/recibos/${r.numero}?descargar=1`} className="btn-primario h-12 w-full" data-testid="descargar-pdf"><i className="fa-solid fa-file-arrow-down" />Descargar PDF</a>
        <CompartirRecibo numero={r.numero} rec={rec} texto={texto} />
      </div>
      {r.correoEnviadoA && (
        <p className="mt-3 text-center text-xs text-suave" data-testid="enviado-correo"><i className="fa-regular fa-envelope mr-1.5" />Enviado también a {ocultarCorreo(r.correoEnviadoA)}</p>
      )}
    </main>
  );
}
