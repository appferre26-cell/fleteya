import Link from "next/link";
import { obtenerConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { exigirMotorista } from "@/lib/sesion-motorista";
import { dinero } from "@/lib/tarifa";
import { TOTAL_DOCS, fechaCorta } from "@/lib/validacion";
import { Copiar } from "../creditos/BotonesCliente";
import { FormAviso } from "./FormAviso";

export const metadata = { title: "Mi alta — FleteYa Motorista" };

/**
 * Pantalla de alta del motorista: fotos, pago de acceso y revisión de FleteYa.
 * TODO Wompi: cuando FleteYa tenga su cuenta, el botón «Pagar en línea» abrirá el enlace de pago de Wompi
 * y su webhook llamará a registrarPagoAcceso() (src/lib/recargas.ts) para dejar el acceso pagado sin intervención.
 */
export default async function AltaMotorista({ searchParams }: { searchParams: Promise<{ nuevo?: string }> }) {
  const s = await exigirMotorista();
  const { nuevo } = await searchParams;
  const [m, cfg] = await Promise.all([
    db.motorista.findUniqueOrThrow({
      where: { id: s.id },
      select: { nombre: true, telefono: true, estado: true, accesoPagadoEn: true, accesoReferencia: true, accesoAvisadoEn: true, _count: { select: { documentos: { where: { tipo: { not: "FOTO_PERFIL" } } } } } },
    }),
    obtenerConfig(),
  ]);
  const precio = dinero(cfg.precioAcceso);
  const fotosOk = m._count.documentos >= TOTAL_DOCS;
  const pagado = !!m.accesoPagadoEn;
  const activo = m.estado === "ACTIVO";
  const mensaje = encodeURIComponent(`Hola, soy ${m.nombre} (motorista, tel. ${m.telefono}). Me registré en FleteYa y quiero pagar mi acceso de ${precio}.`);

  const paso = (ok: boolean, titulo: string, detalle: string, id: string) => (
    <li className="flex gap-3 p-4" data-testid={id} data-ok={ok ? "si" : "no"}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${ok ? "bg-exito/15 text-exito" : "bg-naranja/15 text-naranja"}`}>
        <i className={`fa-solid ${ok ? "fa-check" : "fa-hourglass-half"} text-sm`} />
      </span>
      <div><p className="font-semibold">{titulo}</p><p className="text-xs text-suave">{detalle}</p></div>
    </li>
  );

  return (
    <main className="px-5 pt-6 pb-6">
      {nuevo && !activo && (
        <p role="status" className="mb-4 rounded-xl bg-exito/10 px-4 py-3 text-sm text-exito"><i className="fa-solid fa-circle-check mr-2" />¡Registro recibido, {m.nombre.split(" ")[0]}! Ahora paga tu acceso.</p>
      )}
      <h1 className="text-2xl font-extrabold">Mi alta</h1>
      <p className="mt-1 text-sm text-suave">{activo ? "Tu perfil está activo." : "Tu cuenta está en revisión. Completa estos pasos para empezar a recibir viajes."}</p>

      <ul className="tarjeta mt-4 divide-y divide-borde">
        {paso(fotosOk, "Datos y fotos", fotosOk ? `Recibimos tus ${TOTAL_DOCS} fotos.` : `Faltan fotos (${m._count.documentos}/${TOTAL_DOCS}). Escríbenos para completarlas.`, "paso-fotos")}
        {paso(pagado, `Pago de acceso (${precio})`, pagado ? `Pagado el ${fechaCorta(m.accesoPagadoEn!)}.` : m.accesoAvisadoEn ? "Avisaste tu pago. FleteYa lo está confirmando." : "Pendiente. Mira abajo cómo pagar.", "paso-pago")}
        {paso(activo, "Revisión de FleteYa", activo ? "Perfil activo. ¡Bienvenido!" : "Revisamos que tus fotos se lean bien y coincidan con tus datos.", "paso-revision")}
      </ul>

      {activo ? (
        <Link href="/motorista/creditos" className="btn-primario mt-5 h-12 w-full"><i className="fa-solid fa-coins" />Recargar créditos para recibir viajes</Link>
      ) : !pagado && (
        <section className="mt-5 rounded-2xl border border-naranja/50 bg-gradient-to-br from-naranja/15 to-tarjeta p-5" data-testid="pagar-acceso">
          <p className="text-[11px] font-semibold tracking-wider text-suave uppercase">Pagar y activar mi perfil</p>
          <p className="mt-1 text-4xl font-extrabold">{precio}</p>
          <p className="mt-1 text-xs text-suave">Pago único por el acceso a la plataforma. No se suma a tus créditos.</p>

          <button type="button" disabled className="btn-secundario mt-4 h-12 w-full cursor-not-allowed opacity-60" data-testid="pago-en-linea" title="Disponible muy pronto">
            <i className="fa-solid fa-credit-card" />Pagar en línea con tarjeta · muy pronto
          </button>

          <div className="mt-4 rounded-xl border border-borde bg-fondo/60 p-4 text-sm">
            <p className="font-semibold"><i className="fa-solid fa-building-columns mr-2 text-naranja" />Por transferencia</p>
            {cfg.bancoNumero ? (
              <div className="mt-2 flex items-center justify-between gap-3" data-testid="cuenta-banco">
                <div className="min-w-0">
                  <p className="font-semibold">{cfg.bancoNombre ?? "Banco"}{cfg.bancoTipoCuenta ? ` · ${cfg.bancoTipoCuenta}` : ""}</p>
                  <p className="font-mono text-base font-bold tracking-wide break-all">{cfg.bancoNumero}</p>
                  {cfg.bancoTitular && <p className="text-xs text-suave">A nombre de {cfg.bancoTitular}</p>}
                </div>
                <Copiar texto={cfg.bancoNumero.replace(/[\s-]/g, "")} etiqueta="número de cuenta" />
              </div>
            ) : <p className="mt-1 text-xs text-suave">Pide el número de cuenta a FleteYa por WhatsApp.</p>}
            <FormAviso referencia={m.accesoReferencia} />
          </div>

          <div className="mt-3 rounded-xl border border-borde bg-fondo/60 p-4 text-sm">
            <p className="font-semibold"><i className="fa-solid fa-money-bill-wave mr-2 text-naranja" />En efectivo</p>
            <p className="mt-1 text-xs text-suave">Entrégalo a un socio de FleteYa. Te registra el pago y te llega el comprobante aquí.</p>
          </div>

          {cfg.whatsappAyuda && (
            <a href={`https://wa.me/503${cfg.whatsappAyuda}?text=${mensaje}`} target="_blank" rel="noopener" className="btn-primario mt-4 h-11 w-full"><i className="fa-brands fa-whatsapp" />Escribir a FleteYa por WhatsApp</a>
          )}
        </section>
      )}
    </main>
  );
}
