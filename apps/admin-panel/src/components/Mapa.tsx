"use client";
// Mapa de la app. Usa Google Maps cuando el servidor tiene GOOGLE_MAPS_API_KEY (la entrega /mapa/clave);
// sin clave, o si Google rechaza la clave, usa OpenStreetMap para que la app siga funcionando.
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type * as L from "leaflet";

export type PuntoMapa = { id: string; lat: number; lng: number; color: string; icono: string; etiqueta?: string };
type LatLng = { lat: number; lng: number };

export type DatosMapa = {
  puntos: PuntoMapa[];
  circulo?: LatLng & { radioKm: number };
  /** Zona de servicio: si trae área dibujada se pinta el área; si no, el círculo. */
  zona?: LatLng & { radioKm: number; poligono: LatLng[] | null };
  /** Puntos del área que se está dibujando (no mueven el mapa). */
  vertices?: LatLng[];
};
export type MotorMapa = { dibujar: (d: DatosMapa) => void; destruir: () => void };

type Props = DatosMapa & {
  centro: LatLng;
  zoom?: number;
  onClick?: (p: LatLng) => void;
  className?: string;
  etiqueta?: string;
};

let pedirClave: Promise<string> | null = null;
const claveGoogle = () => (pedirClave ??= fetch("/mapa/clave").then((r) => r.json()).then((d) => String(d.clave || "")).catch(() => ""));

async function crearMapaOsm(caja: HTMLDivElement, centro: LatLng, zoom: number, onClick: (p: LatLng) => void): Promise<MotorMapa> {
  const Lmod = await import("leaflet");
  const Lx = (Lmod.default ?? Lmod) as typeof L;
  const m = Lx.map(caja, { zoomControl: true, attributionControl: true }).setView([centro.lat, centro.lng], zoom);
  Lx.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(m);
  m.on("click", (e: L.LeafletMouseEvent) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }));
  const g = Lx.layerGroup().addTo(m);

  function dibujar({ puntos, circulo, zona, vertices }: DatosMapa) {
    g.clearLayers();
    const estilo = { color: "#FF6B00", weight: 1.5, fillOpacity: 0.05, dashArray: "6 6", interactive: false };
    const hayArea = !!(zona?.poligono && zona.poligono.length >= 3);
    if (hayArea) Lx.polygon(zona!.poligono!.map((p) => [p.lat, p.lng] as [number, number]), estilo).addTo(g);
    const circ = circulo ?? (zona && !hayArea ? zona : undefined);
    if (vertices?.length) {
      if (vertices.length >= 2) Lx.polyline([...vertices, ...(vertices.length >= 3 ? [vertices[0]] : [])].map((p) => [p.lat, p.lng] as [number, number]), { color: "#FF6B00", weight: 2.5, interactive: false }).addTo(g);
      if (vertices.length >= 3) Lx.polygon(vertices.map((p) => [p.lat, p.lng] as [number, number]), { stroke: false, fillColor: "#FF6B00", fillOpacity: 0.12, interactive: false }).addTo(g);
      vertices.forEach((p, i) => Lx.circleMarker([p.lat, p.lng], { radius: i === vertices.length - 1 ? 7 : 5, color: "#121212", weight: 2, fillColor: "#FF6B00", fillOpacity: 1, interactive: false, className: "vertice-zona" }).addTo(g));
    }
    if (circ) Lx.circle([circ.lat, circ.lng], { ...estilo, radius: circ.radioKm * 1000 }).addTo(g);
    for (const p of puntos) {
      const icono = Lx.divIcon({
        className: "",
        html: `<div style="background:${p.color}" class="flex h-8 w-8 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full border-[3px] border-[#121212] shadow-lg"><i class="fa-solid ${p.icono} text-[12px] text-[#121212]"></i></div>`,
        iconSize: [0, 0],
      });
      const mk = Lx.marker([p.lat, p.lng], { icon: icono, keyboard: false }).addTo(g);
      if (p.etiqueta) mk.bindTooltip(p.etiqueta, { direction: "top", offset: [0, -30] });
    }
    if (puntos.length >= 2) m.fitBounds(Lx.latLngBounds(puntos.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 16 });
    else if (puntos.length === 1) m.setView([puntos[0].lat, puntos[0].lng], Math.max(m.getZoom(), 15));
  }
  return { dibujar, destruir: () => m.remove() };
}

export function Mapa({ centro, zoom = 14, puntos, circulo, zona, vertices, onClick, className = "h-64", etiqueta = "Mapa" }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const motor = useRef<MotorMapa | null>(null);
  const clic = useRef(onClick);
  clic.current = onClick;
  const datos = useRef<DatosMapa>({ puntos });
  datos.current = { puntos, circulo, zona, vertices };

  // Crear el mapa una sola vez
  useEffect(() => {
    let vivo = true;
    const alClic = (p: LatLng) => clic.current?.(p);
    const montar = (m: MotorMapa) => {
      if (!vivo) return m.destruir();
      motor.current?.destruir();
      motor.current = m;
      m.dibujar(datos.current);
    };
    const usarOsm = () => {
      if (!vivo || !caja.current) return;
      motor.current?.destruir();
      motor.current = null;
      const nueva = document.createElement("div");
      nueva.className = "h-full w-full";
      caja.current.replaceChildren(nueva);
      crearMapaOsm(nueva, centro, zoom, alClic).then(montar);
    };
    claveGoogle().then((clave) => {
      if (!vivo || !caja.current) return;
      if (!clave) return usarOsm();
      const div = document.createElement("div");
      div.className = "h-full w-full";
      caja.current.replaceChildren(div);
      // Si Google rechaza la clave (mal escrita, sin facturación o sin permiso para esta dirección), se cambia a OpenStreetMap.
      window.gm_authFailure = () => { console.error("Google Maps rechazó la clave; se usa OpenStreetMap."); window.dispatchEvent(new Event("fy-gmaps-fallo")); };
      window.addEventListener("fy-gmaps-fallo", usarOsm);
      import("./mapa-google").then(({ crearMapaGoogle }) => crearMapaGoogle(div, clave, centro, zoom, alClic)).then(montar).catch(usarOsm);
    });
    return () => {
      vivo = false;
      window.removeEventListener("fy-gmaps-fallo", usarOsm);
      motor.current?.destruir();
      motor.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const firma = JSON.stringify([puntos, circulo, zona, vertices]);
  useEffect(() => { motor.current?.dibujar(datos.current); }, [firma]);

  return <div ref={caja} role="application" aria-label={etiqueta} className={`z-0 overflow-hidden rounded-xl border border-borde bg-[#17191c] ${className}`} />;
}
