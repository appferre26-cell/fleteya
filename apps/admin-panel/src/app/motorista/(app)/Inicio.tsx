"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Mapa, type PuntoMapa } from "@/components/Mapa";
import type { DatosInicio } from "@/lib/inicio-motorista";
import { dinero, kg, numeroViaje } from "@/lib/tarifa";
import { avanzarViaje, calificarCliente, cambiarDisponible, soltarViaje, suscribirAvisos, type Resultado } from "../acciones";
import { Calificar } from "@/components/Calificar";
import { BotonAvisos } from "@/components/BotonAvisos";
import { activarAvisos } from "@/lib/avisos-navegador";
import { notificar, pantallaEncendida, prepararSonido, sonarAlerta } from "./alerta";
import { ListaCarga, Ruta, TarjetaSolicitud, type Sol } from "./Solicitud";

const SEGUNDOS_ALERTA = 30;
const CADA_MS = 5000;

const saludo = () => {
  const h = Number(new Intl.DateTimeFormat("es-SV", { hour: "numeric", hour12: false, timeZone: "America/El_Salvador" }).format(new Date()));
  return h < 5 ? "Buenas noches" : h < 12 ? "Buenos días" : h < 18 ? "Buenas tardes" : "Buenas noches";
};
const iniciales = (n: string) => n.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
const hora = (t: number) => new Intl.DateTimeFormat("es-SV", { hour: "numeric", minute: "2-digit", timeZone: "America/El_Salvador" }).format(t);

const mapsUrl = (p: { lat: number; lng: number }) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`;
const wazeUrl = (p: { lat: number; lng: number }) => `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`;

export function Inicio({ inicial, claveAvisos = null }: { inicial: DatosInicio; claveAvisos?: string | null }) {
  const [d, setD] = useState(inicial);
  const [aviso, setAviso] = useState<{ texto: string; tipo: "ok" | "error" } | null>(null);
  const [alerta, setAlerta] = useState<{ s: Sol; hasta: number } | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [sinInternet, setSinInternet] = useState(false);
  const [yo, setYo] = useState<{ lat: number; lng: number } | null>(null);
  const [ocupado, iniciar] = useTransition();
  const vistas = useRef(new Set(inicial.solicitudes.map((s) => s.id)));
  const wake = useRef<WakeLockSentinel | null>(null);
  const activoAntes = useRef(inicial.activo?.id ?? null);
  const terminePorMi = useRef(false);
  const [vAvisos, setVAvisos] = useState(0);

  const refrescar = useCallback(async () => {
    try {
      const r = await fetch("/motorista/api/estado", { cache: "no-store" });
      if (r.status === 401 || r.status === 403) { window.location.href = "/motorista"; return; }
      if (!r.ok) throw new Error();
      setD(await r.json());
      setSinInternet(false);
    } catch { setSinInternet(true); }
  }, []);

  // Pregunta al servidor cada 5 s (más rápido que esto no hace falta y gasta datos).
  useEffect(() => {
    const t = setInterval(refrescar, CADA_MS);
    const alVolver = () => { if (!document.hidden) void refrescar(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", alVolver); };
  }, [refrescar]);

  // Solicitud nueva → aviso emergente con sonido durante 30 s.
  useEffect(() => {
    const nueva = d.solicitudes.find((s) => !vistas.current.has(s.id));
    d.solicitudes.forEach((s) => vistas.current.add(s.id));
    if (alerta && !d.solicitudes.some((s) => s.id === alerta.s.id)) setAlerta(null); // otro la tomó o la cancelaron
    if (nueva && !alerta && d.motorista.disponible) {
      setAlerta({ s: nueva, hasta: Date.now() + SEGUNDOS_ALERTA * 1000 });
      sonarAlerta();
      notificar("Nueva solicitud de flete", `${dinero(nueva.precioBase)} · ${kg(nueva.pesoKg)} · ${nueva.distanciaKm.toFixed(1)} km`);
    }
  }, [d, alerta]);

  // Si el viaje en curso desaparece sin que el motorista lo haya terminado o soltado, el cliente lo canceló.
  useEffect(() => {
    const id = d.activo?.id ?? null;
    if (activoAntes.current && !id && !terminePorMi.current) {
      setAviso({ texto: "El cliente canceló el viaje. No se descontó nada de tus créditos.", tipo: "error" });
      sonarAlerta();
    }
    activoAntes.current = id;
    terminePorMi.current = false;
  }, [d]);

  // Cuenta regresiva del aviso; repite el sonido cada 10 s.
  useEffect(() => {
    if (!alerta) return;
    const t = setInterval(() => {
      const n = Date.now();
      setAhora(n);
      const quedan = Math.ceil((alerta.hasta - n) / 1000);
      if (quedan <= 0) setAlerta(null);
      else if (quedan % 10 === 0) sonarAlerta();
    }, 1000);
    return () => clearInterval(t);
  }, [alerta]);

  // Ubicación: solo mientras está disponible o lleva un viaje.
  const compartir = d.motorista.disponible || !!d.activo;
  useEffect(() => {
    if (!compartir || !("geolocation" in navigator)) return;
    let ultimo = 0;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        setYo(pos);
        if (Date.now() - ultimo < 20000) return;
        ultimo = Date.now();
        void fetch("/motorista/api/ubicacion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pos) }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [compartir]);

  // Pantalla encendida mientras está disponible.
  useEffect(() => {
    void pantallaEncendida(compartir, wake.current).then((w) => { wake.current = w; });
  }, [compartir]);

  const alternar = () => iniciar(async () => {
    const quiere = !d.motorista.disponible;
    if (quiere) {
      prepararSonido();
      // Al conectarse, también activa los avisos con la app cerrada (pide permiso una sola vez).
      if (claveAvisos) void activarAvisos(claveAvisos, suscribirAvisos).then(() => setVAvisos((n) => n + 1)).catch(() => {});
    }
    setAviso(null);
    const r = await cambiarDisponible(quiere);
    if (r.error) setAviso({ texto: r.error, tipo: "error" });
    await refrescar();
  });

  const alListo = (r: Resultado, tipo: "aceptar" | "rechazar" | "oferta") => {
    setAlerta(null);
    if (tipo === "aceptar") setAviso({ texto: r.aviso ?? "¡Viaje aceptado! Llama al cliente si necesitas confirmar algo.", tipo: "ok" });
    if (tipo === "oferta") setAviso({ texto: "Oferta enviada. Te avisamos aquí cuando el cliente responda.", tipo: "ok" });
    void refrescar();
  };

  const m = d.motorista;
  const a = d.activo;
  const puntos: PuntoMapa[] = [];
  if (yo) puntos.push({ id: "yo", ...yo, color: "#4CAF50", icono: "fa-truck", etiqueta: "Tú" });
  if (a) {
    puntos.push({ id: "o", ...a.origen, color: "#FF6B00", icono: "fa-box", etiqueta: "Recogida" });
    puntos.push({ id: "d", ...a.destino, color: "#F5F5F5", icono: "fa-flag-checkered", etiqueta: "Destino" });
  } else {
    d.solicitudes.forEach((s) => puntos.push({ id: s.id, ...s.origen, color: "#FF6B00", icono: "fa-box", etiqueta: `${dinero(s.precioBase)} · ${s.ferreteria ?? "Recogida"}` }));
  }
  const segundos = alerta ? Math.max(0, Math.ceil((alerta.hasta - ahora) / 1000)) : 0;

  return (
    <main className="px-5 pt-5">
      <header className="flex items-center gap-3">
        <span className={`flex h-12 w-12 items-center justify-center rounded-full border-2 bg-tarjeta-2 font-bold ${m.disponible ? "border-exito" : "border-borde"}`}>{iniciales(m.nombre)}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-suave">{saludo()},</p>
          <p className="truncate text-lg leading-tight font-extrabold">{m.nombre}</p>
        </div>
        <span data-testid="estado-conexion" className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase ${a ? "bg-naranja/15 text-naranja" : m.disponible ? "bg-exito/15 text-exito" : "bg-tarjeta-2 text-suave"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${a ? "bg-naranja" : m.disponible ? "bg-exito" : "bg-suave"}`} />{a ? "En viaje" : m.disponible ? "En línea" : "Desconectado"}
        </span>
      </header>

      {sinInternet && <p role="status" className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-xs text-error"><i className="fa-solid fa-wifi mr-1.5" />Sin conexión. Reintentando…</p>}
      {aviso && (
        <p role={aviso.tipo === "error" ? "alert" : "status"} data-testid="aviso" className={`mt-3 rounded-lg px-3 py-2.5 text-sm ${aviso.tipo === "error" ? "bg-error/10 text-error" : "bg-exito/10 text-exito"}`}>
          {aviso.texto}
          <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="float-right ml-2 text-suave"><i className="fa-solid fa-xmark" /></button>
        </p>
      )}

      {a ? (
        <ViajeActivo a={a} ocupado={ocupado} iniciar={iniciar} setAviso={setAviso} refrescar={refrescar} alTerminar={() => { terminePorMi.current = true; }} />
      ) : (
        <>
          {d.porCalificar && (
            <div className="mt-4" key={d.porCalificar.id}>
              <Calificar testid="calificar-cliente" titulo={`¿Qué tal ${d.porCalificar.clienteNombre}? · ${numeroViaje(d.porCalificar.numero)}`}
                ayuda="Solo FleteYa ve tu calificación. Sirve para cuidar a los motoristas de clientes problemáticos."
                placeholder="Comentario (opcional): pagó a tiempo, ayudó a cargar…"
                enviar={async (n, c) => { const r = await calificarCliente(d.porCalificar!.id, n, c); if (!r.error) { setAviso({ texto: "¡Gracias! Calificación guardada.", tipo: "ok" }); await refrescar(); } return r; }}
                omitir={async () => { const r = await calificarCliente(d.porCalificar!.id, null); if (!r.error) await refrescar(); return r; }} />
            </div>
          )}
          <div className="relative mt-4">
            <Mapa centro={yo ?? d.zona} zoom={13} puntos={puntos} className="h-48" etiqueta="Mapa de solicitudes cercanas" />
            <span className="pointer-events-none absolute top-3 left-3 z-[400] rounded-full bg-fondo/85 px-3 py-1 text-xs font-medium"><i className="fa-solid fa-location-crosshairs mr-1.5 text-naranja" />{d.zona.nombre}</span>
          </div>

          <section className="mt-5">
            <div className="flex items-center justify-between"><h2 className="seccion-titulo">Resumen de hoy</h2></div>
            <div className="mt-3 grid grid-cols-[1fr_1.5fr] gap-3">
              <div className="tarjeta p-4"><i className="fa-solid fa-route text-naranja" /><p className="mt-2 text-2xl font-extrabold tabular-nums" data-testid="viajes-hoy">{d.hoy.viajes}</p><p className="text-xs text-suave">Viajes completados</p></div>
              <div className="tarjeta p-4"><i className="fa-solid fa-sack-dollar text-naranja" /><p className="mt-2 text-2xl font-extrabold tabular-nums" data-testid="ganancias-hoy">{dinero(d.hoy.ganancias)}</p><p className="text-xs text-suave">Cobrado hoy · comisión {dinero(d.hoy.comision)}</p></div>
            </div>
          </section>

          {!d.puede.ok ? (
            <div className="mt-5 rounded-2xl border border-error/40 bg-error/10 p-4 text-sm" data-testid="no-puede">
              <p className="font-bold text-error"><i className="fa-solid fa-circle-exclamation mr-2" />No puedes recibir viajes</p>
              <p className="mt-1">{d.puede.motivo}</p>
              {d.puede.codigo === "SALDO" && <a href="/motorista/creditos" className="btn-primario mt-3 h-10 w-full">Ver cómo recargar</a>}
              {d.puede.codigo === "PENDIENTE" && <a href="/motorista/alta" className="btn-primario mt-3 h-10 w-full" data-testid="ir-alta">Ver mi alta y pago de acceso</a>}
            </div>
          ) : (
            <>
              <button type="button" onClick={alternar} disabled={ocupado} role="switch" aria-checked={m.disponible} data-testid="disponible"
                className={`mt-5 flex h-[68px] w-full items-center gap-3 rounded-2xl px-5 text-left text-lg font-extrabold transition disabled:opacity-70 ${m.disponible ? "bg-gradient-to-b from-[#ff7a1a] to-naranja text-fondo shadow-[0_8px_24px_rgba(255,107,0,0.3)]" : "border border-borde bg-tarjeta text-texto"}`}>
                <i className="fa-solid fa-power-off" /><span className="flex-1">{m.disponible ? "DISPONIBLE" : "NO DISPONIBLE"}</span>
                <span className={`flex h-8 w-14 items-center rounded-full p-1 ${m.disponible ? "justify-end bg-fondo/25" : "justify-start bg-tarjeta-2"}`}><span className="h-6 w-6 rounded-full bg-white" /></span>
              </button>
              {m.disponible && (
                <div className="mt-4">
                  <BotonAvisos key={vAvisos} clave={claveAvisos} modo="motorista" ocultarSiActivo titulo="Recibe pedidos con la app cerrada"
                    ayuda="Te llega una notificación aunque tengas el teléfono bloqueado o estés en otra app." />
                </div>
              )}
              <p className="mt-2 text-center text-xs text-suave">
                {m.disponible ? <><span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-naranja" />Buscando solicitudes · cargas de hasta {kg(m.capacidadKg)}</> : "Toca para empezar a recibir solicitudes"}
              </p>
            </>
          )}

          {m.disponible && d.puede.ok && (
            <section className="mt-5">
              <h2 className="seccion-titulo mb-3">Solicitudes ({d.solicitudes.length})</h2>
              {d.solicitudes.length === 0 ? (
                <p className="tarjeta p-5 text-center text-sm text-suave" data-testid="sin-solicitudes"><i className="fa-solid fa-mug-hot mb-2 block text-2xl" />Por ahora no hay pedidos. Te avisamos con sonido cuando llegue uno.</p>
              ) : (
                <div className="space-y-4">{d.solicitudes.map((s) => <TarjetaSolicitud key={s.id + (s.miOferta?.estado ?? "")} s={s} comisionPct={d.comisionPct} contraofertaEnRango={d.contraofertaEnRango} alListo={alListo} />)}</div>
              )}
            </section>
          )}

          <section className="mt-6 pb-6">
            <div className="mb-3 flex items-center justify-between"><h2 className="seccion-titulo">Viajes recientes</h2><a href="/motorista/viajes" className="text-xs font-semibold text-naranja">Ver todos</a></div>
            {d.recientes.length === 0 ? <p className="tarjeta p-4 text-center text-sm text-suave">Aún no has completado viajes.</p> : (
              <ul className="tarjeta divide-y divide-borde">
                {d.recientes.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 p-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tarjeta-2"><i className="fa-solid fa-truck-ramp-box text-suave" /></span>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{r.origen} → {r.destino}</p><p className="text-xs text-suave">{hora(r.fecha)} · {r.km.toFixed(1)} km · {(r.pesoKg / 1000).toFixed(2)} ton</p></div>
                    <div className="text-right"><p className="font-bold tabular-nums">{dinero(r.precio)}</p><p className="text-[11px] text-exito">Completado</p></div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {alerta && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Nueva solicitud" data-testid="alerta">
          <div className="max-h-[92dvh] w-full max-w-[500px] overflow-y-auto rounded-2xl">
            <TarjetaSolicitud s={alerta.s} comisionPct={d.comisionPct} contraofertaEnRango={d.contraofertaEnRango} alListo={alListo} segundos={segundos} />
            <button type="button" onClick={() => setAlerta(null)} className="mt-2 w-full py-2 text-sm text-suave">Ver después</button>
          </div>
        </div>
      )}
    </main>
  );
}

const PASOS = ["ASIGNADO", "EN_CAMINO", "CARGANDO", "EN_RUTA"] as const;
const NOMBRE_PASO = { ASIGNADO: "Aceptado", EN_CAMINO: "En camino", CARGANDO: "Cargando", EN_RUTA: "En ruta" };

function ViajeActivo({ a, ocupado, iniciar, setAviso, refrescar, alTerminar }: {
  a: NonNullable<DatosInicio["activo"]>; ocupado: boolean; iniciar: (f: () => Promise<void>) => void;
  setAviso: (a: { texto: string; tipo: "ok" | "error" } | null) => void; refrescar: () => Promise<void>; alTerminar: () => void;
}) {
  const [soltando, setSoltando] = useState(false);
  const haciaRecogida = a.estado === "ASIGNADO" || a.estado === "EN_CAMINO";
  const meta = haciaRecogida ? a.origen : a.destino;
  const i = PASOS.indexOf(a.estado);

  const avanzar = () => iniciar(async () => {
    const r = await avanzarViaje(a.id, a.estado);
    if (!r.error && a.estado === "EN_RUTA") alTerminar();
    if (r.error) setAviso({ texto: r.error, tipo: "error" });
    else if (r.aviso) setAviso({ texto: `¡Entrega completada! Cobra ${dinero(a.precio)} en efectivo. ${r.aviso}`, tipo: "ok" });
    await refrescar();
  });
  const soltar = () => iniciar(async () => {
    const r = await soltarViaje(a.id);
    if (!r.error) alTerminar();
    setSoltando(false);
    setAviso(r.error ? { texto: r.error, tipo: "error" } : { texto: "Soltaste el viaje. Lo verán otros motoristas.", tipo: "ok" });
    await refrescar();
  });

  return (
    <section className="mt-4 pb-6" data-testid="viaje-activo">
      <div className="flex items-center justify-between">
        <h2 className="seccion-titulo">Viaje en curso · {numeroViaje(a.numero)}</h2>
        <span className="text-2xl font-extrabold text-naranja tabular-nums" data-testid="precio-activo">{dinero(a.precio)}</span>
      </div>
      <ol className="mt-3 grid grid-cols-4 gap-1.5" aria-label="Avance del viaje">
        {PASOS.map((p, n) => (
          <li key={p} className="text-center">
            <span className={`block h-1.5 rounded-full ${n <= i ? "bg-naranja" : "bg-tarjeta-2"}`} />
            <span className={`mt-1 block text-[10px] ${n === i ? "font-bold text-naranja" : "text-suave"}`}>{NOMBRE_PASO[p]}</span>
          </li>
        ))}
      </ol>

      <div className="tarjeta mt-4 p-4">
        <p className="text-[11px] font-semibold tracking-wider text-suave uppercase">{haciaRecogida ? "Ve a recoger a" : "Lleva la carga a"}</p>
        <p className="mt-1 font-semibold break-words" data-testid="meta">{meta.direccion}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href={mapsUrl(meta)} target="_blank" rel="noopener" className="btn-secundario h-11 rounded-xl"><i className="fa-solid fa-map-location-dot text-naranja" />Google Maps</a>
          <a href={wazeUrl(meta)} target="_blank" rel="noopener" className="btn-secundario h-11 rounded-xl"><i className="fa-brands fa-waze text-[#33ccff]" />Waze</a>
        </div>
      </div>

      <div className="tarjeta mt-3 flex items-center gap-3 p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-tarjeta-2"><i className="fa-solid fa-user text-suave" /></span>
        <div className="flex-1"><p className="text-[11px] text-suave">Cliente</p><p className="font-semibold">{a.clienteNombre}</p></div>
        <a href={`tel:+503${a.clienteTelefono}`} className="btn-primario h-11 px-4" data-testid="llamar-cliente"><i className="fa-solid fa-phone" />Llamar</a>
      </div>

      <div className="relative mt-3">
        <Mapa centro={meta} puntos={[
          { id: "o", ...a.origen, color: "#FF6B00", icono: "fa-box", etiqueta: "Recogida" },
          { id: "d", ...a.destino, color: "#F5F5F5", icono: "fa-flag-checkered", etiqueta: "Destino" },
        ]} className="h-44" etiqueta="Mapa del viaje" />
      </div>

      <div className="mt-3 space-y-3">
        <Ruta origen={a.origen.direccion} destino={a.destino.direccion} km={a.distanciaKm} />
        <ListaCarga items={a.items} pesoKg={a.pesoKg} nota={a.nota} rangoTon={a.rangoTon} />
      </div>

      <p className="mt-4 text-center text-xs text-suave"><i className="fa-solid fa-money-bill-wave mr-1 text-exito" />El cliente te paga {dinero(a.precio)} en efectivo al terminar.</p>
      <button type="button" onClick={avanzar} disabled={ocupado} className="btn-primario mt-3 h-14 w-full text-base" data-testid="avanzar">
        <i className="fa-solid fa-arrow-right" />{ocupado ? "Guardando…" : a.boton}
      </button>

      {haciaRecogida && !soltando && (
        <button type="button" onClick={() => setSoltando(true)} className="mt-3 w-full py-2 text-sm text-error">No puedo hacer este viaje</button>
      )}
      {soltando && (
        <div className="tarjeta mt-3 p-4 text-sm">
          <p className="font-semibold">¿Soltar este viaje?</p>
          <p className="mt-1 text-suave">El pedido vuelve a la lista para otros motoristas. Avísale al cliente si ya hablaste con él.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setSoltando(false)} className="btn-secundario">No, seguir</button>
            <button type="button" onClick={soltar} disabled={ocupado} className="btn-secundario border-error/50 text-error">Sí, soltar</button>
          </div>
        </div>
      )}
    </section>
  );
}
