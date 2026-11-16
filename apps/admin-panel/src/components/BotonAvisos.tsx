"use client";
import { useEffect, useState, useTransition } from "react";
import { activarAvisos, desactivarAvisos, estadoAvisos, TEXTO_ESTADO, type EstadoAvisos } from "@/lib/avisos-navegador";
import { probarAviso, quitarAvisos, suscribirAvisos } from "@/app/motorista/acciones";
import { suscribirAvisosViaje } from "@/app/(cliente)/pedir/acciones";

type Props = {
  clave: string | null;
  /** motorista: todos sus avisos · cliente: avisos de este pedido */
  modo: "motorista" | "cliente";
  codigo?: string;
  titulo: string;
  ayuda: string;
  /** Se oculta cuando ya están activos (para avisos tipo «banner»). */
  ocultarSiActivo?: boolean;
};

export function BotonAvisos({ clave, modo, codigo, titulo, ayuda, ocultarSiActivo }: Props) {
  const [estado, setEstado] = useState<EstadoAvisos | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [ocupado, iniciar] = useTransition();
  const guardar = (s: PushSubscriptionJSON) => (modo === "motorista" ? suscribirAvisos(s) : suscribirAvisosViaje(codigo!, s));

  useEffect(() => {
    if (!clave) return;
    // Si ya había permiso, renueva la suscripción en silencio (por si cambió o es otro pedido).
    void activarAvisos(clave, guardar, true).then(setEstado).catch(() => estadoAvisos().then(setEstado));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, codigo]);

  if (!clave || estado === null || (ocultarSiActivo && estado === "activo")) return null;

  const activar = () => iniciar(async () => {
    setMensaje("");
    try { setEstado(await activarAvisos(clave, guardar)); } catch { setMensaje("No se pudo activar. Inténtalo de nuevo."); }
  });
  const probar = () => iniciar(async () => {
    const r = await probarAviso();
    setMensaje(r.error ?? "Aviso enviado. Debe llegarte en unos segundos.");
  });
  const quitar = () => iniciar(async () => {
    await desactivarAvisos(quitarAvisos);
    setEstado("inactivo");
    setMensaje("");
  });

  const activo = estado === "activo";
  return (
    <section data-testid="avisos" data-estado={estado} className={`rounded-2xl border p-4 text-sm ${activo ? "border-exito/40 bg-exito/5" : "border-naranja/40 bg-naranja/5"}`}>
      <p className="font-bold"><i className={`fa-solid ${activo ? "fa-bell text-exito" : "fa-bell-slash text-naranja"} mr-2`} />{titulo}</p>
      <p className="mt-1 text-xs text-suave">{activo ? TEXTO_ESTADO.activo + " " + ayuda : estado === "inactivo" ? ayuda : TEXTO_ESTADO[estado]}</p>
      {estado === "inactivo" && (
        <button type="button" onClick={activar} disabled={ocupado} className="btn-primario mt-3 h-11 w-full">
          <i className="fa-solid fa-bell" />{ocupado ? "Activando…" : "Activar avisos"}
        </button>
      )}
      {activo && modo === "motorista" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={probar} disabled={ocupado} className="btn-secundario h-10">Probar aviso</button>
          <button type="button" onClick={quitar} disabled={ocupado} className="btn-secundario h-10 text-suave">Desactivar</button>
        </div>
      )}
      {mensaje && <p role="status" className="mt-2 text-xs">{mensaje}</p>}
    </section>
  );
}
