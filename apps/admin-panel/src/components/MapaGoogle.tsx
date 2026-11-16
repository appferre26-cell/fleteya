"use client";
// Google Maps (JavaScript API). Los pines son HTML propio (mismo estilo que el resto de la app).
import { useEffect, useRef } from "react";
import type { PropsMapa, PuntoMapa } from "./Mapa";

type Win = Window & { google?: typeof google; gm_authFailure?: () => void; __fyMapas?: Promise<void>; __fyFallos?: Set<() => void> };

/** Carga el script de Google una sola vez para toda la página. */
function cargarGoogle(clave: string, onFallo: () => void): Promise<void> {
  const w = window as Win;
  (w.__fyFallos ??= new Set()).add(onFallo);
  // Google llama a esta función si la clave es inválida o no tiene permiso para este dominio.
  w.gm_authFailure = () => w.__fyFallos?.forEach((f) => f());
  if (w.google?.maps?.Map) return Promise.resolve();
  w.__fyMapas ??= new Promise<void>((ok, mal) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(clave)}&v=weekly&language=es&region=SV&loading=async&callback=__fyListo`;
    s.async = true;
    (w as unknown as Record<string, () => void>).__fyListo = () => ok();
    s.onerror = () => { w.__fyMapas = undefined; s.remove(); mal(new Error("No cargó Google Maps")); };
    document.head.appendChild(s);
  });
  return w.__fyMapas;
}

function htmlPin(p: PuntoMapa) {
  const chip = p.etiqueta
    ? `<div class="mb-1 whitespace-nowrap rounded-md bg-[#121212] px-1.5 py-0.5 text-[11px] font-semibold text-[#F5F5F5] shadow">${p.etiqueta}</div>`
    : "";
  return `<div class="flex flex-col items-center">${chip}<div style="background:${p.color}" class="flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-[#121212] shadow-lg"><i class="fa-solid ${p.icono} text-[12px] text-[#121212]"></i></div></div>`;
}

export function MapaGoogle({ centro, zoom = 14, puntos, circulo, onClick, className = "h-64", etiqueta = "Mapa", clave, onFallo }:
  PropsMapa & { clave: string; onFallo: () => void }) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<google.maps.Map | null>(null);
  const capas = useRef<{ setMap(m: google.maps.Map | null): void }[]>([]);
  const clic = useRef(onClick);
  clic.current = onClick;
  const fallo = useRef(onFallo);
  fallo.current = onFallo;

  useEffect(() => {
    let vivo = true;
    const avisar = () => vivo && fallo.current();
    cargarGoogle(clave, avisar).then(() => {
      if (!vivo || !caja.current || mapa.current) return;
      const m = new google.maps.Map(caja.current, {
        center: centro, zoom,
        clickableIcons: false, streetViewControl: false, fullscreenControl: true,
        mapTypeControl: true,
        mapTypeControlOptions: { style: google.maps.MapTypeControlStyle.DROPDOWN_MENU, mapTypeIds: ["roadmap", "hybrid"] },
      });
      m.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (e.latLng) clic.current?.({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      });
      mapa.current = m;
      dibujar();
    }).catch(avisar);
    return () => {
      vivo = false;
      (window as Win).__fyFallos?.delete(avisar);
      capas.current.forEach((c) => c.setMap(null));
      capas.current = [];
      mapa.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dibujar() {
    const m = mapa.current;
    if (!m) return;
    capas.current.forEach((c) => c.setMap(null));
    capas.current = [];
    if (circulo) {
      capas.current.push(new google.maps.Circle({
        map: m, center: { lat: circulo.lat, lng: circulo.lng }, radius: circulo.radioKm * 1000,
        strokeColor: "#FF6B00", strokeWeight: 1.5, fillColor: "#FF6B00", fillOpacity: 0.06, clickable: false,
      }));
    }
    // Pin HTML: va en la capa sin eventos para que el toque llegue al mapa.
    class Pin extends google.maps.OverlayView {
      div?: HTMLDivElement;
      constructor(private p: PuntoMapa) { super(); }
      onAdd() {
        this.div = document.createElement("div");
        this.div.style.position = "absolute";
        this.div.innerHTML = htmlPin(this.p);
        this.getPanes()?.overlayLayer.appendChild(this.div);
      }
      draw() {
        const pos = this.getProjection()?.fromLatLngToDivPixel(new google.maps.LatLng(this.p.lat, this.p.lng));
        if (pos && this.div) {
          this.div.style.left = `${pos.x}px`;
          this.div.style.top = `${pos.y}px`;
          this.div.style.transform = "translate(-50%, -100%)";
        }
      }
      onRemove() { this.div?.remove(); }
    }
    for (const p of puntos) {
      const pin = new Pin(p);
      pin.setMap(m);
      capas.current.push(pin);
    }
    if (puntos.length >= 2) {
      const b = new google.maps.LatLngBounds();
      puntos.forEach((p) => b.extend(p));
      m.fitBounds(b, 50);
      google.maps.event.addListenerOnce(m, "idle", () => { if ((m.getZoom() ?? 0) > 16) m.setZoom(16); });
    } else if (puntos.length === 1) {
      m.panTo(puntos[0]);
      if ((m.getZoom() ?? 0) < 15) m.setZoom(15);
    }
  }

  const firma = JSON.stringify([puntos, circulo]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(dibujar, [firma]);

  return <div ref={caja} role="application" aria-label={etiqueta} className={`z-0 overflow-hidden rounded-xl border border-borde bg-[#e5e3df] ${className}`} />;
}
