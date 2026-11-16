import Link from "next/link";
import { notFound } from "next/navigation";
import { ReciboTarjeta } from "@/components/ReciboTarjeta";
import { correoConfigurado } from "@/lib/correo";
import { obtenerRecibo } from "@/lib/recargas";
import { PLANES, fechaRecibo, leerNumeroRecibo, numeroRecibo } from "@/lib/recibo";
import { exigirPropietario } from "@/lib/sesion";
import { dinero } from "@/lib/tarifa";
import { formatoTelefono } from "@/lib/validacion";
import { AnularRecarga, ReenviarCorreo } from "./AccionesRecibo";

export const metadata = { title: "Recibo — FleteYa" };

export default async function ReciboPanel({ params, searchParams }: { params: Promise<{ numero: string }>; searchParams: Promise<{ nuevo?: string }> }) {
  await exigirPropietario();
  const n = leerNumeroRecibo((await params).numero);
  const r = n ? await obtenerRecibo({ numero: n }) : null;
  if (!r) notFound();
  const { nuevo } = await searchParams;
  const rec = numeroRecibo(r.numero);
  const texto = r.anulada
    ? `Hola ${r.motorista.nombre}, el recibo ${rec} de FleteYa fue anulado. Motivo: ${r.anulada.motivo}.`
    : `Hola ${r.motorista.nombre}, registramos tu recarga ${PLANES[r.plan].toLowerCase()} de ${dinero(r.monto)} en FleteYa. Recibo ${rec}. Saldo nuevo: ${dinero(r.saldoDespues)}. Lo ves en la app: Créditos → Historial de recargas.`;
  const wa = `https://wa.me/503${r.motorista.telefono}?text=${encodeURIComponent(texto)}`;

  return (
    <>
      <Link href="/panel/creditos" className="text-sm text-suave hover:text-naranja"><i className="fa-solid fa-arrow-left mr-2" />Créditos y recargas</Link>
      <h1 className="mt-2 text-[24px] font-extrabold lg:text-[28px]">Recibo {rec}</h1>

      {nuevo && !r.anulada && (
        <p role="status" className="mt-4 rounded-lg bg-exito/10 px-4 py-3 text-sm text-exito" data-testid="aviso-nuevo">
          <i className="fa-solid fa-circle-check mr-2" />Recarga registrada. El saldo de {r.motorista.nombre} ya es {dinero(r.saldoDespues)} y el recibo se generó solo.
        </p>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,440px)_1fr]">
        <ReciboTarjeta r={r} />

        <aside className="space-y-4">
          <section className="tarjeta space-y-3 p-5">
            <h2 className="font-bold">Compartir y descargar</h2>
            <a href={`/api/recibos/${r.numero}?descargar=1`} className="btn-primario h-11 w-full" data-testid="descargar-pdf"><i className="fa-solid fa-file-arrow-down" />Descargar PDF</a>
            <div className="grid grid-cols-2 gap-2">
              <a href={`/api/recibos/${r.numero}`} target="_blank" rel="noopener" className="btn-secundario h-11"><i className="fa-solid fa-file-pdf text-suave" />Ver PDF</a>
              <a href={wa} target="_blank" rel="noopener" className="btn-secundario h-11" data-testid="whatsapp"><i className="fa-brands fa-whatsapp text-exito" />WhatsApp</a>
            </div>
            <div className="border-t border-borde pt-3 text-xs text-suave">
              {r.motorista.correo ? (
                <>
                  {r.correoEnviadoA && r.correoEnviadoEn
                    ? <p className="mb-2 text-exito" data-testid="correo-estado"><i className="fa-solid fa-envelope-circle-check mr-1.5" />Enviado a {r.correoEnviadoA} · {fechaRecibo(r.correoEnviadoEn)}</p>
                    : r.correoError
                      ? <p className="mb-2 text-error" data-testid="correo-estado">No se pudo enviar por correo: {r.correoError}</p>
                      : <p className="mb-2" data-testid="correo-estado">Aún no se envió por correo a {r.motorista.correo}.</p>}
                  {correoConfigurado()
                    ? <ReenviarCorreo numero={r.numero} />
                    : <p data-testid="sin-smtp">El envío de correos no está configurado en el servidor (variable SMTP_URL). Mientras tanto, descarga el PDF o compártelo por WhatsApp.</p>}
                </>
              ) : <p>El motorista no tiene correo registrado: compártele el recibo por WhatsApp o en PDF.</p>}
            </div>
          </section>

          <section className="tarjeta space-y-3 p-5">
            <h2 className="font-bold">Motorista</h2>
            <p className="text-sm">{r.motorista.nombre} · <span className="text-suave">{formatoTelefono(r.motorista.telefono)}</span></p>
            <div className="grid grid-cols-2 gap-2">
              <Link href={`/panel/motoristas/${r.motorista.id}`} className="btn-secundario h-10"><i className="fa-solid fa-id-card text-suave" />Ver perfil</Link>
              <Link href={`/panel/creditos?m=${r.motorista.id}#registrar`} className="btn-secundario h-10"><i className="fa-solid fa-plus text-naranja" />Otra recarga</Link>
            </div>
          </section>

          <AnularRecarga id={r.id} anulada={!!r.anulada} />
        </aside>
      </div>
    </>
  );
}
