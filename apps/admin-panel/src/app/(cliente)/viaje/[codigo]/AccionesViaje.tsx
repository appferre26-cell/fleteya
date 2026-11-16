"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { cancelarViajeCliente } from "../../pedir/acciones";

export function AccionesViaje({ codigo, activo, buscando }: { codigo: string; activo: boolean; buscando: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [ocupado, iniciar] = useTransition();
  const [copiado, setCopiado] = useState(false);

  // Mientras espera motorista, revisa el estado cada 10 segundos
  useEffect(() => {
    if (!activo) return;
    const t = setInterval(() => router.refresh(), 10000);
    return () => clearInterval(t);
  }, [activo, router]);

  const cancelar = () => iniciar(async () => {
    const r = await cancelarViajeCliente(codigo, motivo);
    if (r.error) setError(r.error); else { setAbierto(false); router.refresh(); }
  });

  const compartir = async () => {
    const url = window.location.href;
    if (navigator.share) { try { await navigator.share({ title: "Mi flete — FleteYa", url }); return; } catch { /* cancelado */ } }
    await navigator.clipboard?.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="mt-6 space-y-3">
      {activo && (
        <button type="button" onClick={compartir} className="btn-secundario w-full">
          <i className={`fa-solid ${copiado ? "fa-check text-exito" : "fa-share-nodes text-suave"}`} />{copiado ? "Enlace copiado" : "Guardar o compartir este enlace"}
        </button>
      )}
      {buscando && !abierto && (
        <button type="button" onClick={() => setAbierto(true)} className="w-full py-2 text-sm font-medium text-error">Cancelar pedido</button>
      )}
      {abierto && (
        <div className="tarjeta p-4">
          <p className="text-sm font-semibold">¿Cancelar este pedido?</p>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} aria-label="Motivo de cancelación"
            placeholder="Motivo (opcional)" className="campo mt-3" />
          {error && <p role="alert" className="mt-2 text-xs text-error">{error}</p>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setAbierto(false)} className="btn-secundario">No, seguir</button>
            <button type="button" onClick={cancelar} disabled={ocupado} className="btn-secundario border-error/50 text-error">{ocupado ? "Cancelando…" : "Sí, cancelar"}</button>
          </div>
        </div>
      )}
      {!activo && <Link href="/pedir" className="btn-primario w-full">Pedir otro flete</Link>}
    </div>
  );
}
