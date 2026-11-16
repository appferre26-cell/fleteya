import { db } from "@/lib/db";
import { capacidadMaximaKg, obtenerConfig } from "@/lib/config";
import { FormPedido } from "./FormPedido";

export default async function Pedir({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const [cfg, materiales, maxKg, qr] = await Promise.all([
    obtenerConfig(),
    db.material.findMany({ where: { activo: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }] }),
    capacidadMaximaKg(),
    f ? db.puntoQR.findFirst({ where: { codigo: f.toUpperCase(), activo: true } }) : null,
  ]);

  return (
    <main className="px-5 pt-5 pb-8">
      <h1 className="text-[26px] leading-tight font-extrabold">¿Qué llevamos hoy?</h1>
      <p className="mt-1 text-sm text-suave">Pide tu flete en 1 minuto. Sin descargar ninguna app.</p>
      <FormPedido
        tarifa={{ precioTonelada: cfg.precioTonelada, tarifaMinima: cfg.tarifaMinima, kmIncluidos: cfg.kmIncluidos }}
        zona={{ nombre: cfg.zonaNombre, lat: cfg.zonaLat, lng: cfg.zonaLng, radioKm: cfg.zonaRadioKm }}
        materiales={materiales.map((m) => ({ id: m.id, nombre: m.nombre, unidad: m.unidad, pesoKg: Number(m.pesoKg) }))}
        maxKg={maxKg}
        contraoferta={cfg.contraofertaEnRango}
        qr={qr ? { codigo: qr.codigo, nombre: qr.nombre, direccion: qr.direccion, lat: qr.lat, lng: qr.lng } : null}
      />
    </main>
  );
}
