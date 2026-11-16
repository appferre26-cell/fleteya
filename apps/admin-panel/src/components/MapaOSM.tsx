"use client";
// Mapa de respaldo con OpenStreetMap (gratis, sin clave). Se usa si no hay clave de Google Maps o si Google falla.
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type * as L from "leaflet";

import type { PropsMapa as Props } from "./Mapa";

export function MapaOSM({ centro, zoom = 14, puntos, circulo, onClick, className = "h-64", etiqueta = "Mapa" }: Props) {
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
    if (circulo) {
      Lx.circle([circulo.lat, circulo.lng], {
        radius: circulo.radioKm * 1000, color: "#FF6B00", weight: 1.5, fillOpacity: 0.05, dashArray: "6 6", interactive: false,
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

  const firma = JSON.stringify([puntos, circulo]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(dibujar, [firma]);

  return <div ref={caja} role="application" aria-label={etiqueta} className={`z-0 overflow-hidden rounded-xl border border-borde bg-[#17191c] ${className}`} />;
}
