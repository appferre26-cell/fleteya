import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { obtenerConfig } from "@/lib/config";
import { exigirPropietario } from "@/lib/sesion";
import { dinero } from "@/lib/tarifa";
import { urlPublica } from "@/lib/url";
import { Imprimir } from "./Imprimir";

// Cartel para pegar en la ferretería (tamaño carta). Se abre sin el menú del panel gracias a print:hidden.
export default async function CartelQR({ params }: { params: Promise<{ id: string }> }) {
  await exigirPropietario();
  const { id } = await params;
  const [p, cfg] = await Promise.all([db.puntoQR.findUnique({ where: { id } }), obtenerConfig()]);
  if (!p) notFound();
  const url = `${await urlPublica()}/pedir?f=${p.codigo}`;
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 900, errorCorrectionLevel: "M" });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <p className="text-sm text-suave">Vista del cartel. Usa «Imprimir» y elige tamaño carta.</p>
        <Imprimir />
      </div>
      <div className="cartel mx-auto flex aspect-[8.5/11] max-w-[640px] flex-col items-center justify-between rounded-xl bg-white p-10 text-center text-[#121212] print:max-w-none print:rounded-none">
        <div>
          <p className="text-4xl font-extrabold">Flete<span className="text-naranja">Ya</span></p>
          <p className="mt-3 text-2xl font-extrabold">¿Necesitas llevar tus materiales?</p>
          <p className="mt-1 text-lg">Escanea y pide tu flete en 1 minuto</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={`QR ${p.codigo}`} className="w-[70%]" />
        <div>
          <p className="text-base font-semibold">{dinero(cfg.precioTonelada)} por tonelada · mínimo {dinero(cfg.tarifaMinima)} · pago en efectivo</p>
          <p className="mt-1 text-sm text-[#555]">Sin descargar app · Motoristas verificados</p>
          <p className="mt-4 font-mono text-xs text-[#777]">{p.nombre} · {p.codigo}</p>
        </div>
      </div>
    </div>
  );
}
