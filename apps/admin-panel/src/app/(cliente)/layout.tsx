import type { Metadata } from "next";
import Link from "next/link";
import { obtenerConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "FleteYa — Pide tu flete",
  description: "Pide un flete para tus materiales en 1 minuto. Sin descargar ninguna app.",
  manifest: "/manifest-cliente.webmanifest",
  robots: { index: true, follow: true },
};

export const dynamic = "force-dynamic";

export default async function LayoutCliente({ children }: { children: React.ReactNode }) {
  const cfg = await obtenerConfig();
  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col">
      <header className="flex items-center justify-between border-b border-borde px-5 pt-5 pb-4">
        <Link href="/pedir" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-naranja"><i className="fa-solid fa-truck-fast text-texto" /></span>
          <span className="text-xl font-extrabold tracking-tight">Flete<span className="text-naranja">Ya</span></span>
        </Link>
        {cfg.whatsappAyuda && (
          <a href={`https://wa.me/503${cfg.whatsappAyuda}?text=${encodeURIComponent("Hola FleteYa, necesito ayuda con un flete.")}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full border border-borde px-3 py-1.5 text-xs font-medium text-suave">
            <i className="fa-brands fa-whatsapp text-sm text-exito" /> Ayuda
          </a>
        )}
      </header>
      <div className="flex-1">{children}</div>
      <footer className="border-t border-borde px-5 py-5 text-center text-[11px] text-suave">
        FleteYa · {cfg.zonaNombre} · <Link href="/terminos" className="underline">Términos</Link> · <Link href="/privacidad" className="underline">Privacidad</Link>
      </footer>
    </div>
  );
}
