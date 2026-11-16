"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Mapa, type PuntoMapa } from "@/components/Mapa";
import { dinero, distanciaKm, kg, precioPorPeso, type Tarifa } from "@/lib/tarifa";
import type { ErroresCampos } from "@/lib/validacion";
import { solicitarViaje } from "./acciones";

type Material = { id: string; nombre: string; unidad: string; pesoKg: number };
type Punto = { lat: number; lng: number; direccion: string };
type Item = { clave: string; materialId?: string; nombre: string; unidad: string; pesoKg: number | ""; cantidad: number | "" };
type Props = {
  tarifa: Tarifa;
  zona: { nombre: string; lat: number; lng: number; radioKm: number };
  materiales: Material[];
  maxKg: number | null;
  qr: { codigo: string; nombre: string; direccion: string; lat: number; lng: number } | null;
};

const GUARDADO = "fy_cliente";

function Aviso({ m }: { m?: string }) {
  return m ? <p className="mt-2 text-xs text-error"><i className="fa-solid fa-circle-exclamation mr-1" />{m}</p> : null;
}

export function FormPedido({ tarifa, zona, materiales, maxKg, qr }: Props) {
  const router = useRouter();
  const [origen, setOrigen] = useState<Punto | null>(qr ? { lat: qr.lat, lng: qr.lng, direccion: `${qr.nombre} · ${qr.direccion}` } : null);
  const [destino, setDestino] = useState<Punto | null>(null);
  const [modo, setModo] = useState<"origen" | "destino">(qr ? "destino" : "origen");
  const [items, setItems] = useState<Item[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [nota, setNota] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [acepto, setAcepto] = useState(false);
  const [errores, setErrores] = useState<ErroresCampos>({});
  const [enviando, iniciar] = useTransition();
  const [ubicando, setUbicando] = useState(false);
  const [ultimo, setUltimo] = useState<string | null>(null);

  // Recordar nombre y teléfono en este celular (no se crea cuenta)
  useEffect(() => {
    try {
      const g = JSON.parse(localStorage.getItem(GUARDADO) ?? "{}");
      if (g.nombre) setNombre(g.nombre);
      if (g.telefono) setTelefono(g.telefono);
      if (g.ultimo) setUltimo(g.ultimo);
    } catch { /* sin datos guardados */ }
  }, []);

  const marcar = (p: { lat: number; lng: number }) => {
    if (modo === "origen") {
      if (qr) return;
      setOrigen((o) => ({ ...p, direccion: o?.direccion ?? "" }));
      if (!destino) setModo("destino");
    } else {
      setDestino((d) => ({ ...p, direccion: d?.direccion ?? "" }));
    }
  };

  const miUbicacion = () => {
    if (!navigator.geolocation) return;
    setUbicando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUbicando(false); marcar({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      () => { setUbicando(false); setErrores((e) => ({ ...e, [modo]: "No pudimos ver tu ubicación. Toca el mapa para marcarla." })); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const km = origen && destino ? distanciaKm(origen, destino) : null;
  const fueraZona = origen ? distanciaKm(origen, zona) > zona.radioKm : false;
  const pesoKg = items.reduce((s, i) => s + (Number(i.cantidad) || 0) * (Number(i.pesoKg) || 0), 0);
  const precio = pesoKg > 0 ? precioPorPeso(pesoKg, tarifa) : null;
  const lejos = km !== null && km > tarifa.kmIncluidos;
  const muyPesado = maxKg !== null && pesoKg > maxKg;

  const puntos = useMemo(() => {
    const p: PuntoMapa[] = [];
    if (origen) p.push({ id: "o", lat: origen.lat, lng: origen.lng, color: "#FF6B00", icono: qr ? "fa-store" : "fa-box", etiqueta: "Recogida" });
    if (destino) p.push({ id: "d", lat: destino.lat, lng: destino.lng, color: "#F5F5F5", icono: "fa-flag-checkered", etiqueta: "Destino" });
    return p;
  }, [origen, destino, qr]);

  const agregar = (m: Material) => {
    setItems((l) => l.some((i) => i.materialId === m.id)
      ? l.map((i) => (i.materialId === m.id ? { ...i, cantidad: (Number(i.cantidad) || 0) + 1 } : i))
      : [...l, { clave: m.id, materialId: m.id, nombre: m.nombre, unidad: m.unidad, pesoKg: m.pesoKg, cantidad: 1 }]);
    setBuscando(false);
    setFiltro("");
  };
  const otro = () => setItems((l) => [...l, { clave: `otro-${Date.now()}`, nombre: "", unidad: "Otro", pesoKg: "", cantidad: 1 }]);
  const cambiar = (clave: string, c: Partial<Item>) => setItems((l) => l.map((i) => (i.clave === clave ? { ...i, ...c } : i)));
  const quitar = (clave: string) => setItems((l) => l.filter((i) => i.clave !== clave));

  const enviar = () => {
    setErrores({});
    const datos = {
      nombre, telefono, nota, acepto, qr: qr?.codigo,
      origen: origen ? { ...origen, direccion: origen.direccion.trim() } : null,
      destino: destino ? { ...destino, direccion: destino.direccion.trim() } : null,
      items: items.map((i) => ({
        materialId: i.materialId, nombre: i.materialId ? undefined : i.nombre,
        pesoKg: i.materialId ? undefined : Number(i.pesoKg) || 0, cantidad: Number(i.cantidad) || 0,
      })),
    };
    iniciar(async () => {
      const r = await solicitarViaje(JSON.stringify(datos));
      if (r.codigo) {
        localStorage.setItem(GUARDADO, JSON.stringify({ nombre, telefono, ultimo: r.codigo }));
        router.push(`/viaje/${r.codigo}`);
      } else {
        setErrores(r.errores ?? { general: "No se pudo enviar. Intenta de nuevo." });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  };

  const filtrados = materiales.filter((m) => m.nombre.toLowerCase().includes(filtro.toLowerCase()));
  const hayErrores = Object.keys(errores).length > 0;

  return (
    <div className="mt-5 space-y-6">
      {ultimo && (
        <Link href={`/viaje/${ultimo}`} className="flex items-center gap-3 rounded-xl border border-borde bg-tarjeta px-4 py-3 text-sm">
          <i className="fa-solid fa-clock-rotate-left text-naranja" /><span className="flex-1">Ver mi último pedido</span><i className="fa-solid fa-chevron-right text-xs text-suave" />
        </Link>
      )}
      {hayErrores && (
        <p role="alert" className="rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error">
          {errores.general ?? "Revisa lo que está marcado en rojo."}
        </p>
      )}

      {/* 1. Ubicaciones */}
      <section className="tarjeta p-4">
        <div className="mb-3 grid grid-cols-2 gap-2" role="tablist" aria-label="Qué punto marcar en el mapa">
          {(["origen", "destino"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={modo === k} onClick={() => setModo(k)}
              disabled={k === "origen" && !!qr}
              className={`flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-semibold ${modo === k ? "border-naranja bg-naranja/10 text-naranja" : "border-borde text-suave"}`}>
              <i className={`fa-solid ${k === "origen" ? (qr ? "fa-store" : "fa-box") : "fa-flag-checkered"}`} />
              {k === "origen" ? "Recogida" : "Destino"}
              {(k === "origen" ? origen : destino) && <i className="fa-solid fa-circle-check text-exito" />}
            </button>
          ))}
        </div>
        <p className="mb-2 text-xs text-suave">
          {modo === "origen" ? "Toca el mapa donde recogemos la carga." : "Toca el mapa a dónde la llevamos."}
        </p>
        <Mapa centro={qr ?? zona} zoom={qr ? 15 : 14} puntos={puntos} circulo={{ lat: zona.lat, lng: zona.lng, radioKm: zona.radioKm }}
          onClick={marcar} className="h-64" etiqueta="Mapa para marcar recogida y destino" />
        <button type="button" onClick={miUbicacion} disabled={ubicando || (modo === "origen" && !!qr)}
          className="mt-2 text-xs font-semibold text-naranja disabled:text-suave">
          <i className={`fa-solid ${ubicando ? "fa-spinner fa-spin" : "fa-location-crosshairs"} mr-1.5`} />
          {ubicando ? "Buscando tu ubicación…" : `Usar mi ubicación como ${modo === "origen" ? "recogida" : "destino"}`}
        </button>

        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="origen-dir" className="etiqueta flex items-center justify-between">
              Recogida
              {qr && <span className="rounded-full bg-exito/15 px-2 py-0.5 text-[10px] font-semibold text-exito"><i className="fa-solid fa-qrcode mr-1" />Desde QR</span>}
            </label>
            <input id="origen-dir" className="campo" value={origen?.direccion ?? ""} readOnly={!!qr} disabled={!origen}
              placeholder={origen ? "Dirección o referencia" : "Primero márcala en el mapa"}
              onChange={(e) => setOrigen((o) => (o ? { ...o, direccion: e.target.value } : o))} />
            {fueraZona && <Aviso m={`Ese punto está fuera de la zona de servicio (${zona.nombre}).`} />}
            <Aviso m={errores.origen} />
          </div>
          <div>
            <label htmlFor="destino-dir" className="etiqueta flex items-center justify-between">
              Destino {km !== null && <span className="font-normal">{km.toFixed(1)} km en línea recta</span>}
            </label>
            <input id="destino-dir" className="campo" value={destino?.direccion ?? ""} disabled={!destino}
              placeholder={destino ? "Colonia, pasaje, casa y referencia" : "Primero márcalo en el mapa"}
              onChange={(e) => setDestino((d) => (d ? { ...d, direccion: e.target.value } : d))} />
            <Aviso m={errores.destino} />
          </div>
          <p className="text-xs text-suave"><i className="fa-regular fa-lightbulb mr-1 text-naranja" />Agrega un punto de referencia: “frente a la iglesia”, “portón negro”.</p>
        </div>
      </section>

      {/* 2. Materiales */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="seccion-titulo">¿Qué vas a llevar?</h2>
          <span className="text-[11px] text-suave">{items.length} {items.length === 1 ? "material" : "materiales"}</span>
        </div>
        <div className="tarjeta divide-y divide-borde">
          {items.map((i) => (
            <div key={i.clave} className="flex flex-wrap items-center gap-3 p-3" data-testid="item">
              <div className="min-w-0 flex-1">
                {i.materialId ? (
                  <>
                    <p className="text-sm font-semibold">{i.nombre}</p>
                    <p className="text-[11px] text-suave">{kg(Number(i.pesoKg))} c/u · {kg((Number(i.cantidad) || 0) * Number(i.pesoKg))}</p>
                  </>
                ) : (
                  <div className="grid grid-cols-[1fr_6.5rem] gap-2">
                    <input className="campo h-10" placeholder="¿Qué es?" aria-label="Qué es (otro material)" value={i.nombre}
                      onChange={(e) => cambiar(i.clave, { nombre: e.target.value })} />
                    <input className="campo h-10" type="number" inputMode="decimal" min={0} placeholder="kg c/u" aria-label="Peso por unidad en kg"
                      value={i.pesoKg} onChange={(e) => cambiar(i.clave, { pesoKg: e.target.value === "" ? "" : Number(e.target.value) })} />
                  </div>
                )}
              </div>
              <div className="flex items-center rounded-full border border-borde bg-tarjeta-2">
                <button type="button" aria-label={`Menos ${i.nombre}`} className="flex h-9 w-9 items-center justify-center text-suave"
                  onClick={() => ((Number(i.cantidad) || 0) <= 1 ? quitar(i.clave) : cambiar(i.clave, { cantidad: Number(i.cantidad) - 1 }))}>
                  <i className={`fa-solid ${(Number(i.cantidad) || 0) <= 1 ? "fa-trash-can" : "fa-minus"} text-xs`} />
                </button>
                <input aria-label={`Cantidad de ${i.nombre || "otro material"}`} type="number" inputMode="decimal" min={0}
                  className="w-12 bg-transparent text-center text-sm font-bold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  value={i.cantidad} onChange={(e) => cambiar(i.clave, { cantidad: e.target.value === "" ? "" : Number(e.target.value) })} />
                <button type="button" aria-label={`Más ${i.nombre}`} className="flex h-9 w-9 items-center justify-center text-naranja"
                  onClick={() => cambiar(i.clave, { cantidad: (Number(i.cantidad) || 0) + 1 })}>
                  <i className="fa-solid fa-plus text-xs" />
                </button>
              </div>
            </div>
          ))}

          {buscando && (
            <div className="p-3">
              <input autoFocus className="campo h-10" placeholder="Buscar material…" aria-label="Buscar material" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
              <ul className="mt-2 max-h-64 overflow-y-auto">
                {filtrados.map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => agregar(m)} className="flex w-full items-center justify-between rounded-lg px-2 py-2.5 text-left text-sm hover:bg-tarjeta-2">
                      <span>{m.nombre}</span><span className="text-xs text-suave">{m.unidad} · {kg(m.pesoKg)}</span>
                    </button>
                  </li>
                ))}
                {filtrados.length === 0 && <li className="px-2 py-2.5 text-sm text-suave">No está en la lista. Usa «Otro (escribir)».</li>}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 divide-x divide-borde">
            <button type="button" onClick={() => setBuscando((b) => !b)} disabled={materiales.length === 0}
              className="flex h-12 items-center justify-center gap-2 text-sm font-semibold text-naranja disabled:text-suave">
              <i className="fa-solid fa-magnifying-glass text-xs" />Agregar material
            </button>
            <button type="button" onClick={otro} className="flex h-12 items-center justify-center gap-2 text-sm font-medium text-suave">
              <i className="fa-solid fa-pen text-xs" />Otro (escribir)
            </button>
          </div>
        </div>
        <Aviso m={errores.items} />
        <textarea value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} rows={2} aria-label="Nota para el motorista"
          placeholder="Nota para el motorista (opcional). Ej.: son varillas largas" className="campo mt-2.5 h-auto py-3" />
      </section>

      {/* 3. Peso y precio */}
      <section className="rounded-xl border border-naranja/40 bg-naranja/10 p-4" aria-live="polite">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="seccion-titulo">Peso estimado</p>
            <p className="mt-0.5 text-xl font-extrabold tabular-nums" data-testid="peso">
              {kg(pesoKg)} <span className="text-sm font-semibold text-suave">≈ {(pesoKg / 1000).toFixed(2)} ton</span>
            </p>
          </div>
          <div className="text-right">
            <p className="seccion-titulo">Precio</p>
            <p className="mt-0.5 text-[32px] leading-none font-extrabold text-naranja tabular-nums" data-testid="precio">{precio !== null ? dinero(precio) : "—"}</p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-suave">
          {dinero(tarifa.precioTonelada)} por tonelada · mínimo {dinero(tarifa.tarifaMinima)} · incluye hasta {tarifa.kmIncluidos} km a la redonda desde {qr ? "la ferretería" : "donde se carga"}. Solo te llegan motoristas cuyo vehículo aguanta este peso.
        </p>
        {lejos && (
          <p className="mt-2 rounded-lg bg-fondo/50 px-3 py-2 text-xs text-texto" data-testid="aviso-lejos">
            <i className="fa-solid fa-route mr-1.5 text-naranja" />Tu destino está a más de {tarifa.kmIncluidos} km {qr ? "de la ferretería" : "de donde se carga"}. El motorista te puede ofrecer otro precio y tú decides si lo aceptas.
          </p>
        )}
        {muyPesado && <Aviso m={`Es más de lo que lleva el vehículo más grande disponible (${kg(maxKg!)}). Divide la carga en dos pedidos.`} />}
      </section>

      {/* 4. Pago */}
      <section>
        <h2 className="seccion-titulo mb-3">Pago</h2>
        <div className="flex items-center gap-3 rounded-lg border border-naranja/60 bg-naranja/10 p-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-naranja/15"><i className="fa-solid fa-money-bill-wave text-naranja" /></span>
          <div><p className="text-sm font-semibold">Pagas en efectivo al motorista</p><p className="mt-0.5 text-xs text-suave">Al terminar el viaje. Ten el monto listo, de preferencia exacto.</p></div>
        </div>
      </section>

      {/* 5. Contacto */}
      <section>
        <h2 className="seccion-titulo mb-3">Tus datos de contacto</h2>
        <div className="space-y-2.5">
          <div>
            <input className="campo" autoComplete="name" placeholder="Tu nombre" aria-label="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <Aviso m={errores.nombre} />
          </div>
          <div>
            <div className="flex">
              <span className="flex h-12 items-center rounded-l-lg border border-r-0 border-borde bg-tarjeta-2 px-3 text-sm text-suave">+503</span>
              <input className="campo rounded-l-none" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="7123-4567" aria-label="Tu celular"
                value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
            <Aviso m={errores.telefono} />
          </div>
          <p className="text-xs text-suave">No necesitas crear cuenta. El motorista te llamará a este número al llegar.</p>
        </div>
      </section>

      {/* 6. Términos y enviar */}
      <div>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-naranja" />
          <span className="text-xs leading-relaxed text-suave">
            Acepto los <Link href="/terminos" target="_blank" className="text-texto underline">Términos del Servicio</Link> y el <Link href="/privacidad" target="_blank" className="text-texto underline">Aviso de Privacidad</Link>.
          </span>
        </label>
        <Aviso m={errores.acepto} />
      </div>

      <div>
        <button type="button" onClick={enviar} disabled={enviando || muyPesado || fueraZona} className="btn-primario h-14 w-full text-base">
          {enviando ? <><i className="fa-solid fa-spinner fa-spin" />Enviando…</> : <>Solicitar FleteYa{precio !== null ? ` · ${dinero(precio)}` : ""} <i className="fa-solid fa-arrow-right" /></>}
        </button>
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-suave">
          <span><i className="fa-solid fa-shield-halved mr-1 text-exito" />Motoristas verificados</span>
          <span className="h-3 w-px bg-borde" />
          <span><i className="fa-solid fa-scale-balanced mr-1 text-exito" />Precio por peso</span>
        </div>
      </div>
    </div>
  );
}
