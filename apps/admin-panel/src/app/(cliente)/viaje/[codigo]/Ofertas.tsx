"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dinero } from "@/lib/tarifa";
import { aceptarOferta, rechazarOferta } from "../../pedir/acciones";

export type OfertaCliente = { id: string; precio: number; nombre: string; vehiculo: string; kmDeRecogida: number | null };

/** Ofertas de precio de motoristas (viajes más lejos que los km incluidos). */
export function Ofertas({ codigo, ofertas, precioBase }: { codigo: string; ofertas: OfertaCliente[]; precioBase: number }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [ocupado, iniciar] = useTransition();
  const responder = (id: string, acepta: boolean) => iniciar(async () => {
    setError("");
    const r = acepta ? await aceptarOferta(codigo, id) : await rechazarOferta(codigo, id);
    if (r.error) setError(r.error);
    router.refresh();
  });

  return (
    <section className="mt-6" data-testid="ofertas">
      <h2 className="seccion-titulo mb-3">Te ofrecieron otro precio</h2>
      <p className="mb-3 text-xs text-suave">Tu destino está lejos. Estos motoristas pueden llevarlo por el precio que proponen. Si no aceptas ninguno, seguimos buscando con {dinero(precioBase)}.</p>
      <ul className="space-y-3">
        {ofertas.map((o) => (
          <li key={o.id} className="tarjeta p-4" data-testid="oferta">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{o.nombre}</p>
                <p className="text-xs text-suave">{o.vehiculo}{o.kmDeRecogida !== null ? ` · a ${o.kmDeRecogida.toFixed(1)} km de la recogida` : ""}</p>
              </div>
              <p className="text-2xl font-extrabold text-naranja tabular-nums">{dinero(o.precio)}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" disabled={ocupado} onClick={() => responder(o.id, false)} className="btn-secundario">No, gracias</button>
              <button type="button" disabled={ocupado} onClick={() => responder(o.id, true)} className="btn-primario h-11">Aceptar {dinero(o.precio)}</button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-3 rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error">{error}</p>}
    </section>
  );
}
