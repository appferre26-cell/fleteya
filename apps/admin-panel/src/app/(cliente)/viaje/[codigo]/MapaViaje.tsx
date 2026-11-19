"use client";
// Mapa del viaje del cliente que se actualiza solo: mueve el marcador del motorista en tiempo real
// y dibuja la línea hacia donde va (a recoger y luego al destino).
import { useEffect, useRef, useState } from "react";
import { Mapa, type PuntoMapa } from "@/components/Mapa";

type LatLng = { lat: number; lng: number };
type Motorista = { lat: number; lng: number; nombre: string };

type Props = {
  codigo: string;
  origen: LatLng;
  destino: LatLng;
  estadoInicial: string;
  motoristaInicial: Motorista | null;
  className?: string;
};

export function MapaViaje({ codigo, origen, destino, estadoInicial, motoristaInicial, className = "mt-3 h-52" }: Props) {
  const [estado, setEstado] = useState(estadoInicial);
  const [moto, setMoto] = useState<Motorista | null>(motoristaInicial);
  const [rutaCalles, setRutaCalles] = useState<LatLng[] | null>(null);
  const estadoRef = useRef(estadoInicial);
  estadoRef.current = estado;

  useEffect(() => {
    let vivo = true;
    async function tic() {
      try {
        const r = await fetch(`/viaje/${codigo}/ubicacion`, { cache: "no-store" });
        if (!r.ok || !vivo) return;
        const d = await r.json();
        // Si el viaje cambió de estado (lo recogió, lo entregó, se canceló…), recargamos para
        // que la página muestre los nuevos pasos, el resumen o el aviso correspondiente.
        if (d.estado && d.estado !== estadoRef.current) {
          window.location.reload();
          return;
        }
        if (d.verUbicacion && d.lat != null && d.lng != null) {
          setMoto({ lat: d.lat, lng: d.lng, nombre: d.nombre || "Motorista" });
          setRutaCalles(Array.isArray(d.ruta) && d.ruta.length >= 2 ? d.ruta : null);
        } else {
          setMoto(null);
          setRutaCalles(null);
        }
      } catch {
        /* reintenta en el siguiente tic */
      }
    }
    const id = setInterval(tic, 12_000);
    tic();
    return () => { vivo = false; clearInterval(id); };
  }, [codigo]);

  const puntos: PuntoMapa[] = [
    { id: "o", lat: origen.lat, lng: origen.lng, color: "#FF6B00", icono: "fa-box", etiqueta: "Recogida" },
    { id: "d", lat: destino.lat, lng: destino.lng, color: "#F5F5F5", icono: "fa-flag-checkered", etiqueta: "Destino" },
  ];
  let ruta: LatLng[] = [origen, destino];
  if (moto) {
    puntos.push({ id: "m", lat: moto.lat, lng: moto.lng, color: "#4CAF50", icono: "fa-truck", etiqueta: moto.nombre });
    // Ruta real por calles (del servidor). Si aún no llega, línea recta como respaldo.
    // Camino a recoger: motorista → recogida → destino. En ruta: motorista → destino.
    ruta = rutaCalles ?? (estado === "EN_RUTA" ? [moto, destino] : [moto, origen, destino]);
  }

  return <Mapa centro={moto ?? origen} puntos={puntos} ruta={ruta} vivo className={className} etiqueta="Mapa del viaje en vivo" />;
}
