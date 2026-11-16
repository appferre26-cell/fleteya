// Motor de Google Maps para <Mapa>. Se usa cuando el servidor tiene GOOGLE_MAPS_API_KEY.
import type { DatosMapa, MotorMapa } from "./Mapa";

declare global {
  interface Window { __fyGmaps?: Promise<void>; __fyGmapsListo?: () => void; gm_authFailure?: () => void }
}

/** Carga el script de Google Maps una sola vez por página. */
function cargar(clave: string): Promise<void> {
  if (window.google?.maps?.Map) return Promise.resolve();
  if (!window.__fyGmaps) {
    window.__fyGmaps = new Promise<void>((ok, mal) => {
      window.__fyGmapsListo = () => ok();
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(clave)}&v=weekly&language=es&region=SV&loading=async&callback=__fyGmapsListo`;
      s.async = true;
      s.onerror = () => { window.__fyGmaps = undefined; mal(new Error("No se pudo cargar Google Maps")); };
      document.head.appendChild(s);
    });
  }
  return window.__fyGmaps;
}

// Colores oscuros parecidos al resto de la app.
const ESTILO_OSCURO: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1d2024" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9aa0a6" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#16181b" }] },
  { featureType: "poi", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2c3036" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3b3f46" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1a24" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

const NARANJA = "#FF6B00";

export async function crearMapaGoogle(caja: HTMLDivElement, clave: string, centro: { lat: number; lng: number }, zoom: number,
  onClick: (p: { lat: number; lng: number }) => void): Promise<MotorMapa> {
  await cargar(clave);
  const g = google.maps;
  const m = new g.Map(caja, {
    center: centro, zoom, styles: ESTILO_OSCURO, backgroundColor: "#17191c",
    disableDefaultUI: true, zoomControl: true, fullscreenControl: true, gestureHandling: "greedy", clickableIcons: false,
  });
  m.addListener("click", (e: google.maps.MapMouseEvent) => { if (e.latLng) onClick({ lat: e.latLng.lat(), lng: e.latLng.lng() }); });

  // Marcador con HTML propio (mismo diseño que en el resto de la app, sin necesitar "Map ID").
  class Marcador extends g.OverlayView {
    div: HTMLDivElement;
    constructor(private pos: google.maps.LatLngLiteral, html: string, titulo?: string, clase = "") {
      super();
      this.div = document.createElement("div");
      this.div.className = `fy-marcador ${clase}`;
      this.div.style.position = "absolute";
      this.div.innerHTML = html;
      if (titulo) this.div.title = titulo;
    }
    onAdd() { this.getPanes()!.overlayMouseTarget.appendChild(this.div); }
    draw() {
      const p = this.getProjection().fromLatLngToDivPixel(new g.LatLng(this.pos));
      if (p) { this.div.style.left = `${p.x}px`; this.div.style.top = `${p.y}px`; }
    }
    onRemove() { this.div.remove(); }
  }

  let objetos: { setMap(m: google.maps.Map | null): void }[] = [];

  function dibujar({ puntos, circulo, zona, vertices }: DatosMapa) {
    objetos.forEach((o) => o.setMap(null));
    objetos = [];
    const pon = <T extends { setMap(m: google.maps.Map | null): void }>(o: T) => { o.setMap(m); objetos.push(o); return o; };
    const borde = { strokeColor: NARANJA, strokeWeight: 1.5, strokeOpacity: 0.9, fillColor: NARANJA, fillOpacity: 0.05, clickable: false };
    const hayArea = !!(zona?.poligono && zona.poligono.length >= 3);
    if (hayArea) pon(new g.Polygon({ ...borde, paths: zona!.poligono! }));
    const circ = circulo ?? (zona && !hayArea ? zona : undefined);
    if (circ) pon(new g.Circle({ ...borde, center: { lat: circ.lat, lng: circ.lng }, radius: circ.radioKm * 1000 }));
    if (vertices?.length) {
      if (vertices.length >= 2) pon(new g.Polyline({ path: [...vertices, ...(vertices.length >= 3 ? [vertices[0]] : [])], strokeColor: NARANJA, strokeWeight: 2.5, clickable: false }));
      if (vertices.length >= 3) pon(new g.Polygon({ paths: vertices, strokeOpacity: 0, fillColor: NARANJA, fillOpacity: 0.12, clickable: false }));
      vertices.forEach((p, i) => {
        const r = i === vertices.length - 1 ? 14 : 10;
        pon(new Marcador(p, `<div style="width:${r}px;height:${r}px;background:${NARANJA};border:2px solid #121212;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none"></div>`, undefined, "vertice-zona"));
      });
    }
    for (const p of puntos) {
      pon(new Marcador({ lat: p.lat, lng: p.lng },
        `<div style="background:${p.color}" class="flex h-8 w-8 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full border-[3px] border-[#121212] shadow-lg"><i class="fa-solid ${p.icono} text-[12px] text-[#121212]"></i></div>`,
        p.etiqueta));
    }
    if (puntos.length >= 2) {
      const b = new g.LatLngBounds();
      puntos.forEach((p) => b.extend(p));
      m.fitBounds(b, 40);
      g.event.addListenerOnce(m, "idle", () => { if ((m.getZoom() ?? 0) > 16) m.setZoom(16); });
    } else if (puntos.length === 1) {
      m.setCenter(puntos[0]);
      m.setZoom(Math.max(m.getZoom() ?? 15, 15));
    }
  }

  return { dibujar, destruir: () => { objetos.forEach((o) => o.setMap(null)); objetos = []; caja.innerHTML = ""; } };
}
