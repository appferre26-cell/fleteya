"use client";
// Mapa con OpenStreetMap (gratis, sin clave). Se usa para marcar recogida/destino y ubicar ferreterías.
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type * as L from "leaflet";

export type PuntoMapa = { id: string; lat: number; lng: number; color: string; icono: string; etiqueta?: string };

type Props = {
  centro: { lat: number; lng: number };
  zoom?: number;
  puntos: PuntoMapa[];
  circulo?: { lat: number; lng: number; radioKm: number };
  /** Zona de servicio: si trae área dibujada se pinta el área; si no, el círculo. */
  zona?: { lat: number; lng: number; radioKm: number; poligono: { lat: number; lng: number }[] | null };
  /** Puntos del área que se está dibujando (no mueven el mapa). */
  vertices?: { lat: number; lng: number }[];
  onClick?: (p: { lat: number; lng: number }) => void;
  className?: string;
  etiqueta?: string;
};

export function Mapa({ centro, zoom = 14, puntos, circulo, zona, vertices, onClick, className = "h-64", etiqueta = "Mapa" }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const lib = useRef<typeof L | null>(null);
  const capa = useRef<L.LayerGroup | null>(null);
  const clic = useRef(onClick);
  clic.current = onClick;

  // Crear el mapa una sola vez
  useEffect(() => {
    let vivo = true;
    import("leaflet").then((Lmod) => {
      if (!vivo || !caja.current || mapa.current) return;
      const Lx = (Lmod.default ?? Lmod) as typeof L;
      lib.current = Lx;
      const m = Lx.map(caja.current, { zoomControl: true, attributionControl: true }).setView([centro.lat, centro.lng], zoom);
      Lx.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      m.on("click", (e: L.LeafletMouseEvent) => clic.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
      capa.current = Lx.layerGroup().addTo(m);
      mapa.current = m;
      dibujar();
    });
    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dibujar() {
    const Lx = lib.current, m = mapa.current, g = capa.current;
    if (!Lx || !m || !g) return;
    g.clearLayers();
    const estilo = { color: "#FF6B00", weight: 1.5, fillOpacity: 0.05, dashArray: "6 6", interactive: false };
    if (zona?.poligono && zona.poligono.length >= 3) {
      Lx.polygon(zona.poligono.map((p) => [p.lat, p.lng] as [number, number]), estilo).addTo(g);
    }
    const circ = circulo ?? (zona && !(zona.poligono && zona.poligono.length >= 3) ? zona : undefined);
    if (vertices?.length) {
      if (vertices.length >= 2) Lx.polyline([...vertices, ...(vertices.length >= 3 ? [vertices[0]] : [])].map((p) => [p.lat, p.lng] as [number, number]), { color: "#FF6B00", weight: 2.5, interactive: false }).addTo(g);
      if (vertices.length >= 3) Lx.polygon(vertices.map((p) => [p.lat, p.lng] as [number, number]), { stroke: false, fillColor: "#FF6B00", fillOpacity: 0.12, interactive: false }).addTo(g);
      vertices.forEach((p, i) => Lx.circleMarker([p.lat, p.lng], { radius: i === vertices.length - 1 ? 7 : 5, color: "#121212", weight: 2, fillColor: "#FF6B00", fillOpacity: 1, interactive: false, className: "vertice-zona" }).addTo(g));
    }
    if (circ) {
      Lx.circle([circ.lat, circ.lng], {
        radius: circ.radioKm * 1000, color: "#FF6B00", weight: 1.5, fillOpacity: 0.05, dashArray: "6 6", interactive: false,
      }).addTo(g);
    }
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

  const firma = JSON.stringify([puntos, circulo, zona, vertices]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(dibujar, [firma]);

  return <div ref={caja} role="application" aria-label={etiqueta} className={`z-0 overflow-hidden rounded-xl border border-borde bg-[#17191c] ${className}`} />;
}
