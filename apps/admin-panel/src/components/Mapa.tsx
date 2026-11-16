"use client";
// Mapa de la app: Google Maps si hay clave (NEXT_PUBLIC_GOOGLE_MAPS_KEY); si no hay o Google falla, OpenStreetMap.
import { useState } from "react";
import { MapaGoogle } from "./MapaGoogle";
import { MapaOSM } from "./MapaOSM";

export type PuntoMapa = { id: string; lat: number; lng: number; color: string; icono: string; etiqueta?: string };

export type PropsMapa = {
  centro: { lat: number; lng: number };
  zoom?: number;
  puntos: PuntoMapa[];
  circulo?: { lat: number; lng: number; radioKm: number };
  onClick?: (p: { lat: number; lng: number }) => void;
  className?: string;
  etiqueta?: string;
};

const CLAVE = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

export function Mapa(props: PropsMapa) {
  const [fallo, setFallo] = useState(false);
  if (!CLAVE || fallo) return <MapaOSM {...props} />;
  return <MapaGoogle {...props} clave={CLAVE} onFallo={() => setFallo(true)} />;
}
