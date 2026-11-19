"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dinero } from "@/lib/tarifa";
import { aceptarOferta, contraofertarCliente, rechazarOferta } from "../../pedir/acciones";

export type OfertaCliente = {
  id: string; precio: number; nombre: string; vehiculo: string; kmDeRecogida: number | null;
  estado: string; contraPrecio: number | null;
};

/** Una oferta: aceptar, decir «No, gracias» o proponerle al motorista tu propio precio. */
function FilaOferta({ codigo, o, onError, onHecho }: { codigo: string; o: OfertaCliente; onError: (s: string) => void; onHecho: () => void }) {
  const [ocupado, iniciar] = useTransition();
  const [proponiendo, setProponiendo] = useState(false);
  const [precio, setPrecio] = useState(String(Math.max(1, Math.floor(o.precio - 1))));
  const esperando = o.estado === "CONTRAOFERTA";

  const correr = (fn: () => Promise<{ error?: string; ok?: boolean }>) => iniciar(async () => {
    onError("");
    const r = await fn();
    if (r.error) onError(r.error);
    else onHecho();
  });

  return (
    <li className="tarjeta p-4" data-testid="oferta">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{o.nombre}</p>
          <p className="text-xs text-suave">{o.vehiculo}{o.kmDeRecogida !== null ? ` · a ${o.kmDeRecogida.toFixed(1)} km de la recogida` : ""}</p>
        </div>
        <p className="text-2xl font-extrabold text-naranja tabular-nums">{dinero(o.precio)}</p>
      </div>

      {esperando ? (
        <div className="mt-3 rounded-lg border border-naranja/40 px-3 py-2.5 text-sm" data-testid="contraoferta-enviada">
          <i className="fa-solid fa-hourglass-half mr-2 text-naranja" />Le propusiste <b>{dinero(o.contraPrecio ?? 0)}</b>. Esperando que el motorista responda…
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" disabled={ocupado} onClick={() => correr(() => rechazarOferta(codigo, o.id))} className="btn-secundario">No, gracias</button>
            <button type="button" disabled={ocupado} onClick={() => correr(() => aceptarOferta(codigo, o.id))} className="btn-primario h-11">Aceptar {dinero(o.precio)}</button>
          </div>
          {proponiendo ? (
            <div className="mt-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-suave">$</span>
                  <input value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="decimal" aria-label="Tu precio en dólares" className="campo pl-7 text-base" />
                </div>
                <button type="button" disabled={ocupado} onClick={() => correr(() => contraofertarCliente(codigo, o.id, precio))} className="btn-primario h-12 rounded-xl">Enviar propuesta</button>
              </div>
              <button type="button" onClick={() => setProponiendo(false)} className="mt-2 w-full py-1 text-xs text-suave">Cancelar</button>
            </div>
          ) : (
            <button type="button" onClick={() => setProponiendo(true)} className="mt-3 w-full py-1.5 text-sm font-semibold text-naranja">
              <i className="fa-solid fa-tag mr-1.5" />Proponer mi precio
            </button>
          )}
        </>
      )}
    </li>
  );
}

/** Ofertas de precio de los motoristas (regateo de ida y vuelta, como en inDrive: el cliente decide). */
export function Ofertas({ codigo, ofertas, precioBase, lejos }: { codigo: string; ofertas: OfertaCliente[]; precioBase: number; lejos: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");

  return (
    <section className="mt-6" data-testid="ofertas">
      <h2 className="seccion-titulo mb-3">Te ofrecieron otro precio</h2>
      <p className="mb-3 text-xs text-suave">{lejos ? "Tu destino está lejos. " : ""}Estos motoristas pueden llevarlo por el precio que proponen. Puedes aceptar, decir «No, gracias» o proponerles tu propio precio. Si no aceptas ninguno, seguimos buscando con {dinero(precioBase)}.</p>
      <ul className="space-y-3">
        {ofertas.map((o) => (
          <FilaOferta key={o.id + o.estado} codigo={codigo} o={o} onError={setError} onHecho={() => router.refresh()} />
        ))}
      </ul>
      {error && <p role="alert" className="mt-3 rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error">{error}</p>}
    </section>
  );
}
