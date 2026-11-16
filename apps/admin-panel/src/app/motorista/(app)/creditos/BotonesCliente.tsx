"use client";
import { useState } from "react";

export function Copiar({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" aria-label={`Copiar ${etiqueta}`} data-testid="copiar-cuenta"
      onClick={async () => {
        try { await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 2000); } catch { /* sin permiso: el número se ve igual */ }
      }}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-borde px-3 text-xs font-semibold text-naranja">
      <i className={`fa-solid ${ok ? "fa-check" : "fa-copy"}`} />{ok ? "Copiado" : "Copiar"}
    </button>
  );
}

/** Comparte el PDF del recibo (WhatsApp, correo…) con el menú del celular; si no se puede, abre WhatsApp con el texto. */
export function CompartirRecibo({ numero, rec, texto }: { numero: number; rec: string; texto: string }) {
  const [cargando, setCargando] = useState(false);
  async function compartir() {
    setCargando(true);
    try {
      const res = await fetch(`/motorista/api/recibos/${numero}`);
      const archivo = new File([await res.blob()], `${rec}.pdf`, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [archivo] })) {
        await navigator.share({ files: [archivo], title: `Recibo ${rec}`, text: texto });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // el motorista cerró el menú
    } finally {
      setCargando(false);
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  }
  return (
    <button type="button" onClick={compartir} disabled={cargando} className="btn-secundario h-12 w-full" data-testid="compartir">
      <i className="fa-brands fa-whatsapp text-exito" />{cargando ? "Preparando…" : "Compartir"}
    </button>
  );
}
