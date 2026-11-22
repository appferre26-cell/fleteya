"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Mapa, type PuntoMapa } from "@/components/Mapa";
import { centavos, dinero, distanciaKm, kg, pisoOferta, precioPorPeso, precioViaje, type Tarifa } from "@/lib/tarifa";
import { RANGOS, TON_EXTRA, toneladasDeRango, type IdRango } from "@/lib/rangos";
import type { ErroresCampos } from "@/lib/validacion";
import { dentroDeZona, type Zona } from "@/lib/zona";
import { buscarDireccion, direccionDe, type ResultadoDireccion } from "@/lib/buscar-direccion";
import { solicitarViaje } from "./acciones";

type Material = { id: string; nombre: string; unidad: string; pesoKg: number };
type Punto = { lat: number; lng: number; direccion: string };
type Item = { clave: string; materialId?: string; nombre: string; unidad: string; pesoKg: number | ""; cantidad: number | "" };
type Props = {
  tarifa: Tarifa;
  zona: Zona;
  materiales: Material[];
  maxKg: number | null;
  qr: { codigo: string; nombre: string; direccion: string; lat: number; lng: number } | null;
  contraoferta: boolean;
};

const GUARDADO = "fy_cliente";

function Aviso({ m }: { m?: string }) {
  return m ? <p className="mt-2 text-xs text-error"><i className="fa-solid fa-circle-exclamation mr-1" />{m}</p> : null;
}

export function FormPedido({ tarifa, zona, materiales, maxKg, qr, contraoferta }: Props) {
  const router = useRouter();
  const [origen, setOrigen] = useState<Punto | null>(qr ? { lat: qr.lat, lng: qr.lng, direccion: `${qr.nombre} · ${qr.direccion}` } : null);
  const [destino, setDestino] = useState<Punto | null>(null);
  const [modo, setModo] = useState<"origen" | "destino">(qr ? "destino" : "origen");
  const [items, setItems] = useState<Item[]>([]);
  const [modoCarga, setModoCarga] = useState<"toneladas" | "materiales">("toneladas");
  const [rango, setRango] = useState<IdRango | null>(null);
  const [tonExtra, setTonExtra] = useState(TON_EXTRA.inicial);
  const [buscando, setBuscando] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [nota, setNota] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [acepto, setAcepto] = useState(false);
  // Oferta del cliente (estilo inDrive): empieza igual al precio sugerido y él la ajusta.
  const [oferta, setOferta] = useState("");
  const [ofertaTocada, setOfertaTocada] = useState(false);
  const [errores, setErrores] = useState<ErroresCampos>({});
  const [enviando, iniciar] = useTransition();
  const [ubicando, setUbicando] = useState(false);
  const [ultimo, setUltimo] = useState<string | null>(null);
  // Texto escrito en cada campo mientras aún no se ha elegido un punto.
  const [qOrigen, setQOrigen] = useState("");
  const [qDestino, setQDestino] = useState("");
  // Resultados de búsqueda por campo y cuál se está buscando.
  const [resultados, setResultados] = useState<{ cual: "origen" | "destino"; lista: ResultadoDireccion[] } | null>(null);
  const [buscandoCual, setBuscandoCual] = useState<"origen" | "destino" | null>(null);

  // Recordar nombre y teléfono en este celular (no se crea cuenta)
  useEffect(() => {
    try {
      const g = JSON.parse(localStorage.getItem(GUARDADO) ?? "{}");
      if (g.nombre) setNombre(g.nombre);
      if (g.telefono) setTelefono(g.telefono);
      if (g.ultimo) setUltimo(g.ultimo);
    } catch { /* sin datos guardados */ }
  }, []);

  // Autocompletado en vivo: mientras se escribe la dirección (origen o destino) y aún no se ha
  // elegido un punto, buscar coincidencias con un pequeño retardo (debounce) para no saturar.
  useEffect(() => {
    const q = qOrigen.trim();
    if (q.length < 3) { setResultados((r) => (r?.cual === "origen" ? null : r)); return; }
    setBuscandoCual("origen");
    const t = setTimeout(() => {
      buscarDireccion(q)
        .then((lista) => setResultados({ cual: "origen", lista }))
        .finally(() => setBuscandoCual((c) => (c === "origen" ? null : c)));
    }, 320);
    return () => clearTimeout(t);
  }, [qOrigen]);

  useEffect(() => {
    const q = qDestino.trim();
    if (q.length < 3) { setResultados((r) => (r?.cual === "destino" ? null : r)); return; }
    setBuscandoCual("destino");
    const t = setTimeout(() => {
      buscarDireccion(q)
        .then((lista) => setResultados({ cual: "destino", lista }))
        .finally(() => setBuscandoCual((c) => (c === "destino" ? null : c)));
    }, 320);
    return () => clearTimeout(t);
  }, [qDestino]);

  // Cierra el dropdown al perder el foco del campo, con un pequeño retardo para que el toque
  // sobre una coincidencia alcance a registrarse antes de ocultar la lista.
  const cerrarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cerrarResultados = (cual: "origen" | "destino") => {
    if (cerrarTimer.current) clearTimeout(cerrarTimer.current);
    cerrarTimer.current = setTimeout(() => {
      setResultados((r) => (r?.cual === cual ? null : r));
    }, 160);
  };

  // Al tocar el mapa se coloca el punto de inmediato y se busca sola la dirección de ese lugar.
  const marcar = async (p: { lat: number; lng: number }) => {
    if (modo === "origen" && qr) return;
    const cual = modo; // fijamos el punto que se está marcando en el momento del toque
    const poner = (direccion: string) => {
      if (cual === "origen") setOrigen({ ...p, direccion });
      else setDestino({ ...p, direccion });
    };
    // El pin aparece al instante; mientras tanto avisamos que estamos buscando la dirección.
    poner("Buscando dirección…");
    if (cual === "origen" && !destino) setModo("destino");
    setResultados(null);
    setErrores((e) => ({ ...e, [cual]: undefined }));
    // Geocodificación inversa: llena el campo con la dirección del punto marcado.
    let direccion = "";
    try { direccion = await direccionDe(p.lat, p.lng); } catch { /* usamos el respaldo de abajo */ }
    poner(direccion || `Punto en el mapa (${p.lat.toFixed(5)}, ${p.lng.toFixed(5)})`);
  };

  // Buscar la dirección escrita en un campo y mostrar coincidencias debajo de ese campo.
  const buscarDir = (cual: "origen" | "destino") => {
    // Si el punto ya está puesto, el texto editado vive en su dirección; si no, en el campo de búsqueda.
    const texto = cual === "origen" ? (origen ? origen.direccion : qOrigen) : (destino ? destino.direccion : qDestino);
    const q = texto.trim();
    if (q.length < 3) { setResultados({ cual, lista: [] }); return; }
    setBuscandoCual(cual);
    buscarDireccion(q)
      .then((lista) => {
        // Una sola coincidencia: la fijamos sola en el mapa, sin pedir otro toque.
        if (lista.length === 1) { elegirDireccion(cual, lista[0]); return; }
        setResultados({ cual, lista });
      })
      .finally(() => setBuscandoCual(null));
  };

  // Al elegir una coincidencia, se coloca el punto, se guarda la dirección y se limpia la búsqueda.
  const elegirDireccion = (cual: "origen" | "destino", r: ResultadoDireccion) => {
    const punto = { lat: r.lat, lng: r.lng, direccion: r.direccion };
    if (cual === "origen") {
      if (qr) return;
      setOrigen(punto);
      setQOrigen("");
      if (!destino) setModo("destino");
    } else {
      setDestino(punto);
      setQDestino("");
    }
    setResultados(null);
    setErrores((e) => ({ ...e, [cual]: undefined }));
  };

  const miUbicacion = () => {
    // Si el origen viene de un QR no se puede cambiar la recogida.
    if (modo === "origen" && qr) return;
    if (!navigator.geolocation) {
      setErrores((e) => ({ ...e, [modo]: "Tu celular no permite ubicarte. Toca el mapa para marcar el punto." }));
      return;
    }
    setUbicando(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let direccion = "";
        try { direccion = await direccionDe(lat, lng); } catch { /* seguimos con el respaldo de abajo */ }
        if (!direccion) direccion = `Mi ubicación (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
        const punto = { lat, lng, direccion };
        if (modo === "origen") { setOrigen(punto); setQOrigen(""); if (!destino) setModo("destino"); }
        else { setDestino(punto); setQDestino(""); }
        setResultados(null);
        setErrores((e) => ({ ...e, [modo]: undefined }));
        setUbicando(false);
      },
      () => {
        setUbicando(false);
        setErrores((e) => ({ ...e, [modo]: "No pudimos ver tu ubicación. Revisa el permiso de ubicación del navegador o toca el mapa para marcarla." }));
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const km = origen && destino ? distanciaKm(origen, destino) : null;
  const fueraZona = origen ? !dentroDeZona(origen, zona) : false;
  const porToneladas = modoCarga === "toneladas";
  const pesoKg = porToneladas
    ? (rango ? toneladasDeRango(rango, tonExtra) * 1000 : 0)
    : items.reduce((s, i) => s + (Number(i.cantidad) || 0) * (Number(i.pesoKg) || 0), 0);
  // El precio del rango ya incluye el recargo por km extra cuando el cliente marcó el destino.
  const precioRango = (id: IdRango) => {
    const peso = toneladasDeRango(id, tonExtra) * 1000;
    return km !== null ? precioViaje(peso, km, tarifa).total : precioPorPeso(peso, tarifa);
  };
  const maxTonExtra = maxKg !== null ? Math.min(TON_EXTRA.max, Math.floor(maxKg / 500) / 2) : TON_EXTRA.max;
  // Desglose completo (base por peso + recargo por km extra + total) cuando hay carga y destino.
  const desglose = pesoKg > 0 && km !== null ? precioViaje(pesoKg, km, tarifa) : null;
  const precio = pesoKg > 0 ? (desglose ? desglose.total : precioPorPeso(pesoKg, tarifa)) : null;
  const recargoKmPct = tarifa.recargoKmPct ?? 0;
  const muyPesado = maxKg !== null && pesoKg > maxKg;

  // El campo "Tu oferta" se prellena con el precio sugerido mientras el cliente no lo haya cambiado.
  useEffect(() => {
    if (!ofertaTocada && precio !== null) setOferta(String(precio));
  }, [precio, ofertaTocada]);

  const ofertaNum = oferta.trim() === "" ? null : centavos(Number(oferta.replace(/[$,\s]/g, "")));
  const piso = precio !== null ? pisoOferta(precio) : null; // 70% del sugerido (ver PISO_OFERTA_PCT en lib/tarifa)
  const ofertaBaja = ofertaNum !== null && piso !== null && ofertaNum < piso;
  const ofertaInvalida = precio !== null && (ofertaNum === null || !Number.isFinite(ofertaNum) || ofertaNum <= 0 || ofertaBaja);
  const ajustarOferta = (delta: number) => {
    const actual = ofertaNum ?? precio ?? 0;
    setOfertaTocada(true);
    setOferta(String(Math.max(0, centavos(actual + delta))));
  };
  const usarSugerido = () => { setOfertaTocada(false); if (precio !== null) setOferta(String(precio)); };

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
      nombre, telefono, nota, acepto, qr: qr?.codigo, oferta: ofertaNum,
      origen: origen ? { ...origen, direccion: origen.direccion.trim() } : null,
      destino: destino ? { ...destino, direccion: destino.direccion.trim() } : null,
      rango: porToneladas && rango ? { id: rango, ton: tonExtra } : null,
      items: porToneladas ? [] : items.map((i) => ({
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
          {modo === "origen" ? "Escribe la dirección abajo o toca el mapa donde recogemos la carga." : "Escribe la dirección abajo o toca el mapa a dónde la llevamos."}
        </p>
        <Mapa centro={qr ?? zona} zoom={qr ? 15 : 14} puntos={puntos} zona={zona}
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
            <div className="flex gap-2">
              <input id="origen-dir" className="campo flex-1" readOnly={!!qr}
                value={origen ? origen.direccion : qOrigen}
                placeholder="Escribe la dirección de recogida"
                onFocus={() => setModo("origen")}
                onBlur={() => cerrarResultados("origen")}
                onChange={(e) => { const v = e.target.value; if (origen) setOrigen({ ...origen, direccion: v }); else setQOrigen(v); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscarDir("origen"); } }} />
              {!qr && (
                <button type="button" onClick={() => buscarDir("origen")}
                  disabled={buscandoCual === "origen" || (origen ? origen.direccion : qOrigen).trim().length < 3}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-naranja bg-naranja/10 text-naranja disabled:border-borde disabled:text-suave"
                  aria-label="Buscar dirección de recogida">
                  <i className={`fa-solid ${buscandoCual === "origen" ? "fa-spinner fa-spin" : "fa-magnifying-glass"}`} />
                </button>
              )}
            </div>
            {buscandoCual === "origen" && (
              <p className="mt-2 text-xs text-suave"><i className="fa-solid fa-spinner fa-spin mr-1.5 text-naranja" />Buscando…</p>
            )}
            {buscandoCual !== "origen" && resultados?.cual === "origen" && (
              resultados.lista.length > 0 ? (
                <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-borde bg-tarjeta">
                  {resultados.lista.map((r, i) => (
                    <li key={`o-${r.lat},${r.lng},${i}`} className="border-b border-borde last:border-0">
                      <button type="button" onClick={() => elegirDireccion("origen", r)}
                        className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-tarjeta-2">
                        <i className="fa-solid fa-location-dot mt-0.5 text-naranja" /><span className="min-w-0 flex-1">{r.direccion}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-suave">No encontramos esa dirección. Prueba con otra referencia o tócala en el mapa.</p>
              )
            )}
            {fueraZona && <Aviso m={`Ese punto está fuera de la zona de servicio (${zona.nombre}).`} />}
            <Aviso m={errores.origen} />
          </div>
          <div>
            <label htmlFor="destino-dir" className="etiqueta flex items-center justify-between">
              Destino {km !== null && <span className="font-normal">{km.toFixed(1)} km en línea recta</span>}
            </label>
            <div className="flex gap-2">
              <input id="destino-dir" className="campo flex-1"
                value={destino ? destino.direccion : qDestino}
                placeholder="Escribe la dirección de destino"
                onFocus={() => setModo("destino")}
                onBlur={() => cerrarResultados("destino")}
                onChange={(e) => { const v = e.target.value; if (destino) setDestino({ ...destino, direccion: v }); else setQDestino(v); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscarDir("destino"); } }} />
              <button type="button" onClick={() => buscarDir("destino")}
                disabled={buscandoCual === "destino" || (destino ? destino.direccion : qDestino).trim().length < 3}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-naranja bg-naranja/10 text-naranja disabled:border-borde disabled:text-suave"
                aria-label="Buscar dirección de destino">
                <i className={`fa-solid ${buscandoCual === "destino" ? "fa-spinner fa-spin" : "fa-magnifying-glass"}`} />
              </button>
            </div>
            {buscandoCual === "destino" && (
              <p className="mt-2 text-xs text-suave"><i className="fa-solid fa-spinner fa-spin mr-1.5 text-naranja" />Buscando…</p>
            )}
            {buscandoCual !== "destino" && resultados?.cual === "destino" && (
              resultados.lista.length > 0 ? (
                <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-borde bg-tarjeta">
                  {resultados.lista.map((r, i) => (
                    <li key={`d-${r.lat},${r.lng},${i}`} className="border-b border-borde last:border-0">
                      <button type="button" onClick={() => elegirDireccion("destino", r)}
                        className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-tarjeta-2">
                        <i className="fa-solid fa-location-dot mt-0.5 text-naranja" /><span className="min-w-0 flex-1">{r.direccion}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-suave">No encontramos esa dirección. Prueba con otra referencia o tócala en el mapa.</p>
              )
            )}
            <Aviso m={errores.destino} />
          </div>
          <p className="text-xs text-suave"><i className="fa-regular fa-lightbulb mr-1 text-naranja" />Agrega un punto de referencia: “frente a la iglesia”, “portón negro”.</p>
        </div>
      </section>

      {/* 2. Materiales */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="seccion-titulo">¿Qué vas a llevar?</h2>
          {!porToneladas && <span className="text-[11px] text-suave">{items.length} {items.length === 1 ? "material" : "materiales"}</span>}
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-borde bg-tarjeta p-1" role="tablist" aria-label="Cómo indicar la carga">
          {([["toneladas", "fa-weight-hanging", "Por toneladas"], ["materiales", "fa-list-check", "Por materiales"]] as const).map(([k, icono, t]) => (
            <button key={k} type="button" role="tab" aria-selected={modoCarga === k} onClick={() => setModoCarga(k)}
              className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold ${modoCarga === k ? "bg-naranja text-fondo" : "text-suave"}`}>
              <i className={`fa-solid ${icono} text-xs`} />{t}
            </button>
          ))}
        </div>

        {porToneladas && (
          <div data-testid="rangos">
            <p className="mb-2.5 text-xs text-suave">Toca cuánto pesa más o menos tu carga y te decimos el precio al instante.</p>
            <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Peso aproximado de la carga">
              {RANGOS.map((r) => {
                const sel = rango === r.id;
                const noCabe = maxKg !== null && (r.maxTon ?? TON_EXTRA.min) * 1000 > maxKg;
                return (
                  <button key={r.id} type="button" role="radio" aria-checked={sel} disabled={noCabe} onClick={() => setRango(r.id)}
                    data-testid={`rango-${r.id}`}
                    className={`flex min-h-[92px] flex-col items-start justify-between rounded-xl border-2 p-3 text-left transition disabled:opacity-40 ${sel ? "border-naranja bg-naranja/10" : "border-borde bg-tarjeta"}`}>
                    <span className="flex w-full items-center justify-between gap-2 text-sm font-semibold">
                      {r.nombre}
                      {sel && <i className="fa-solid fa-circle-check text-naranja" />}
                    </span>
                    <span className={`text-2xl font-extrabold tabular-nums ${sel ? "text-naranja" : ""}`}>
                      {r.maxTon === null && !sel ? <span className="text-sm font-semibold text-suave">desde </span> : null}
                      {dinero(r.maxTon === null && !sel ? precioPorPeso(TON_EXTRA.min * 1000, tarifa) : precioRango(r.id))}
                    </span>
                    {noCabe && <span className="text-[10px] text-suave">Sin vehículo disponible</span>}
                  </button>
                );
              })}
            </div>
            {rango === "3+" && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-borde bg-tarjeta p-3">
                <span className="text-sm">¿Cuántas toneladas, más o menos?</span>
                <div className="flex items-center rounded-full border border-borde bg-tarjeta-2">
                  <button type="button" aria-label="Menos toneladas" className="flex h-9 w-9 items-center justify-center text-suave disabled:opacity-40"
                    disabled={tonExtra <= TON_EXTRA.min} onClick={() => setTonExtra((t) => Math.max(TON_EXTRA.min, t - TON_EXTRA.paso))}>
                    <i className="fa-solid fa-minus text-xs" />
                  </button>
                  <span className="w-14 text-center text-sm font-bold tabular-nums" data-testid="ton-extra">{tonExtra} ton</span>
                  <button type="button" aria-label="Más toneladas" className="flex h-9 w-9 items-center justify-center text-naranja disabled:opacity-40"
                    disabled={tonExtra + TON_EXTRA.paso > maxTonExtra} onClick={() => setTonExtra((t) => Math.min(maxTonExtra, t + TON_EXTRA.paso))}>
                    <i className="fa-solid fa-plus text-xs" />
                  </button>
                </div>
              </div>
            )}
            <p className="mt-2.5 text-xs text-suave"><i className="fa-regular fa-lightbulb mr-1 text-naranja" />Se cobra el tope del rango: {dinero(tarifa.precioTonelada)} por tonelada. Cuenta en la nota qué es (ej.: 20 bolsas de cemento).</p>
          </div>
        )}

        <div className={`tarjeta divide-y divide-borde ${porToneladas ? "hidden" : ""}`}>
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
          placeholder={porToneladas ? "¿Qué es? (opcional). Ej.: 20 bolsas de cemento y 10 varillas" : "Nota para el motorista (opcional). Ej.: son varillas largas"} className="campo mt-2.5 h-auto py-3" />
      </section>

      {/* 3. Peso y precio */}
      <section className="rounded-xl border border-naranja/40 bg-naranja/10 p-4" aria-live="polite">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="seccion-titulo">Peso estimado</p>
            <p className="mt-0.5 text-xl font-extrabold tabular-nums" data-testid="peso">
              {porToneladas && rango ? <>{RANGOS.find((r) => r.id === rango)!.corto}{rango === "3+" && <span className="text-sm font-semibold text-suave"> · {tonExtra} ton</span>}</>
                : <>{kg(pesoKg)} <span className="text-sm font-semibold text-suave">≈ {(pesoKg / 1000).toFixed(2)} ton</span></>}
            </p>
          </div>
          <div className="text-right">
            <p className="seccion-titulo">Precio sugerido</p>
            <p className="mt-0.5 text-2xl leading-none font-bold text-texto tabular-nums" data-testid="precio">{precio !== null ? dinero(precio) : "—"}</p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-suave">
          {dinero(tarifa.precioTonelada)} por tonelada · mínimo {dinero(tarifa.tarifaMinima)} · incluye hasta {tarifa.kmIncluidos} km a la redonda desde {qr ? "la ferretería" : "donde se carga"}. Solo te llegan motoristas cuyo vehículo aguanta este peso.
        </p>
        {desglose && desglose.recargoKm > 0 && (
          <div className="mt-3 rounded-lg bg-fondo/50 px-3 py-2.5 text-xs text-texto" data-testid="aviso-lejos">
            <p className="font-semibold"><i className="fa-solid fa-route mr-1.5 text-naranja" />Tu destino está a {km!.toFixed(1)} km. Los primeros {tarifa.kmIncluidos} km van incluidos; los {desglose.kmExtra.toFixed(1)} km extra se cobran al {recargoKmPct}% del precio por cada km.</p>
            <div className="mt-2 space-y-0.5 text-suave">
              <p className="flex justify-between"><span>Base por peso</span><span className="tabular-nums text-texto">{dinero(desglose.base)}</span></p>
              <p className="flex justify-between"><span>Recargo por {desglose.kmExtra.toFixed(1)} km extra ({recargoKmPct}% c/u)</span><span className="tabular-nums text-texto">+{dinero(desglose.recargoKm)}</span></p>
              <p className="flex justify-between border-t border-borde pt-1 font-bold text-texto"><span>Total</span><span className="tabular-nums text-naranja">{dinero(desglose.total)}</span></p>
            </div>
          </div>
        )}
        {/* Oferta del cliente estilo inDrive: él decide cuánto pagar (mínimo el piso de seguridad). */}
        {precio !== null && (
          <div className="mt-4 rounded-xl border border-naranja/40 bg-fondo/50 p-3.5" data-testid="oferta">
            <label htmlFor="oferta-precio" className="seccion-titulo flex items-center gap-1.5">
              <i className="fa-solid fa-hand-holding-dollar text-naranja" />Tu oferta
            </label>
            <p className="mt-0.5 text-xs text-suave">Tú decides cuánto ofrecer. Una buena oferta la toma un motorista más rápido.</p>
            <div className="mt-2.5 flex items-center gap-2">
              <button type="button" aria-label="Bajar un dólar" onClick={() => ajustarOferta(-1)}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-borde text-texto">
                <i className="fa-solid fa-minus" />
              </button>
              <div className="flex h-12 flex-1 items-center rounded-lg border border-borde bg-tarjeta px-3">
                <span className="mr-1 text-lg font-bold text-suave">$</span>
                <input id="oferta-precio" type="number" inputMode="decimal" min={0} step={1}
                  value={oferta} onChange={(e) => { setOfertaTocada(true); setOferta(e.target.value); }}
                  className="w-full bg-transparent text-2xl font-extrabold tabular-nums text-naranja outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  aria-label="Cuánto ofreces pagar en dólares" data-testid="oferta-input" />
              </div>
              <button type="button" aria-label="Subir un dólar" onClick={() => ajustarOferta(1)}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-borde text-naranja">
                <i className="fa-solid fa-plus" />
              </button>
            </div>
            <button type="button" onClick={usarSugerido} className="mt-2 text-xs font-semibold text-naranja">
              <i className="fa-solid fa-wand-magic-sparkles mr-1" />Usar el precio sugerido ({dinero(precio)})
            </button>
            {ofertaBaja ? (
              <p className="mt-2 rounded-lg bg-error/10 px-3 py-2 text-xs text-error" data-testid="oferta-baja">
                <i className="fa-solid fa-circle-exclamation mr-1.5" />Tu oferta es muy baja, puede que ningún motorista la tome. Mínimo sugerido: {dinero(piso!)}.
              </p>
            ) : ofertaNum !== null && ofertaNum > 0 ? (
              <p className="mt-2 text-xs text-suave"><i className="fa-solid fa-circle-check mr-1.5 text-exito" />Ofreces {dinero(ofertaNum)}. El motorista cobra este monto en efectivo.</p>
            ) : (
              <p className="mt-2 text-xs text-error"><i className="fa-solid fa-circle-exclamation mr-1.5" />Escribe cuánto quieres ofrecer.</p>
            )}
          </div>
        )}
        {contraoferta && ofertaNum !== null && ofertaNum > 0 && (
          <p className="mt-2 text-xs text-suave" data-testid="aviso-contraoferta">
            <i className="fa-solid fa-handshake mr-1.5 text-naranja" />Un motorista puede proponerte otro precio. Tú decides: si no aceptas, seguimos buscando con tu oferta de {dinero(ofertaNum)}.
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
              <input className="campo rounded-l-none" type="tel" inputMode="numeric" autoComplete="off" name="fy-cel" placeholder="7123-4567" aria-label="Tu celular"
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
        <button type="button" onClick={enviar} disabled={enviando || muyPesado || fueraZona || ofertaInvalida} className="btn-primario h-14 w-full text-base">
          {enviando ? <><i className="fa-solid fa-spinner fa-spin" />Enviando…</> : <>Solicitar FleteYa{ofertaNum !== null && ofertaNum > 0 ? ` · ${dinero(ofertaNum)}` : ""} <i className="fa-solid fa-arrow-right" /></>}
        </button>
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-suave">
          <span><i className="fa-solid fa-shield-halved mr-1 text-exito" />Motoristas verificados</span>
          <span className="h-3 w-px bg-borde" />
          <span><i className="fa-solid fa-hand-holding-dollar mr-1 text-exito" />Tú pones el precio</span>
        </div>
      </div>
    </div>
  );
}
