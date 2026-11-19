import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { obtenerConfig } from "@/lib/config";
import { exigirMotorista, VERSION_TERMINOS } from "@/lib/sesion-motorista";
import { dinero } from "@/lib/tarifa";
import { FormTerminos } from "./FormTerminos";

export const metadata = { title: "Términos — FleteYa Motorista" };

export default async function TerminosPrimerIngreso() {
  const m = await exigirMotorista({ permitirPendientes: true });
  if (m.debeCambiarPassword) redirect("/motorista/contrasena");
  const cfg = await obtenerConfig();
  const cambio = !!m.terminosVersion && m.terminosVersion !== VERSION_TERMINOS;
  const puntos = [
    ["fa-user", "Trabajas de forma independiente", "Tú decides cuándo te conectas y qué viajes aceptas."],
    ["fa-coins", "Créditos y comisión", `El acceso a la plataforma cuesta ${dinero(cfg.precioAcceso)} (pago único). Después recargas el monto que quieras; sin saldo no recibes viajes. Por cada viaje se descuenta el ${cfg.comisionPct}% de tus créditos.`],
    ["fa-box", "Cuidas la carga", "Respondes por daños o pérdidas desde que recibes la carga hasta que la entregas."],
    ["fa-scale-balanced", "Precio justo", `${dinero(cfg.precioTonelada)} por tonelada, mínimo ${dinero(cfg.tarifaMinima)}, incluye hasta ${cfg.kmIncluidos} km desde la ferretería. Los km que pasen de ahí se cobran automáticamente al ${cfg.recargoKmPct}% del precio por cada km extra.`],
    ["fa-money-bill-wave", "Cobras en efectivo", "El cliente te paga directo al terminar. El dinero del viaje es tuyo; la comisión sale solo de tus créditos."],
    ["fa-shield-halved", "Tus datos", "Usamos tu DUI, licencia, tarjeta de circulación, las fotos de tu vehículo y tus datos de facturación solo para verificarte, emitir tus comprobantes y operar el servicio."],
  ];
  return (
    <main className="px-5 pt-6 pb-10">
      <Logo sub="Motoristas" />
      <span className="mt-8 inline-flex items-center gap-2 rounded-full bg-naranja/15 px-3 py-1 text-[11px] font-bold tracking-wider text-naranja uppercase">
        <i className="fa-solid fa-hand" />{cambio ? "Términos actualizados" : "Primer ingreso"}
      </span>
      <h1 className="mt-3 text-[28px] leading-tight font-extrabold">Antes de empezar, {m.nombre.split(" ")[0]}</h1>
      <p className="mt-2 text-sm text-suave">Lee y acepta los términos para poder recibir viajes. Esto es un resumen de los puntos más importantes.</p>
      <ul className="tarjeta mt-6 divide-y divide-borde">
        {puntos.map(([i, t, d]) => (
          <li key={t} className="flex gap-3.5 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-naranja/15"><i className={`fa-solid ${i} text-sm text-naranja`} /></span>
            <div><p className="font-semibold">{t}</p><p className="mt-0.5 text-[13px] leading-relaxed text-suave">{d}</p></div>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link href="/motorista/legal/terminos" className="btn-secundario h-12 rounded-xl text-xs"><i className="fa-solid fa-file-lines text-suave" />Términos completos</Link>
        <Link href="/motorista/legal/privacidad" className="btn-secundario h-12 rounded-xl text-xs"><i className="fa-solid fa-user-shield text-suave" />Aviso de privacidad</Link>
      </div>
      <FormTerminos />
      <p className="mt-3 text-center text-[11px] text-suave">Versión {VERSION_TERMINOS} · Se guarda la fecha y hora en que aceptas. Si no aceptas, no podrás recibir viajes.</p>
    </main>
  );
}
