"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Mapa, type PuntoMapa } from "@/components/Mapa";
import type { DatosEnVivo } from "@/lib/en-vivo";

const ESTADO: Record<string, string> = { BUSCANDO: "Buscando motorista", ASIGNADO: "Aceptado", EN_CAMINO: "Va a recoger", CARGANDO: "Cargando", EN_RUTA: "Va a entregar" };

export function EnVivo({ inicial, zona }: { inicial: DatosEnVivo; zona: { lat: number; lng: number; radioKm: number } }) {
  const [d, setD] = useState(inicial);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/panel/en-vivo", { cache: "no-store" });
        if (!r.ok) throw new Error();
        const datos = (await r.json()) as DatosEnVivo;
        if (vivo) { setD(datos); setError(false); }
      } catch { if (vivo) setError(true); }
    };
    const t = setInterval(cargar, 15_000);
    document.addEventListener("visibilitychange", cargar);
    return () => { vivo = false; clearInterval(t); document.removeEventListener("visibilitychange", cargar); };
  }, []);

  const buscando = d.viajes.filter((v) => v.estado === "BUSCANDO");
  const enCurso = d.viajes.filter((v) => v.estado !== "BUSCANDO");
  const conectados = d.motoristas.filter((m) => m.conectado && !m.enViaje);
  const puntos: PuntoMapa[] = [
    ...d.motoristas.filter((m) => m.lat != null && m.lng != null).map((m) => ({
      id: `m${m.id}`, lat: m.lat!, lng: m.lng!, color: m.enViaje ? "#ffc107" : "#4caf50", icono: "fa-truck",
      etiqueta: `${m.nombre} · ${m.placa}${m.enViaje ? ` · ${m.enViaje}` : " · disponible"}`,
    })),
    ...buscando.map((v) => ({ id: `v${v.id}`, lat: v.lat, lng: v.lng, color: "#ff6b00", icono: "fa-box-open", etiqueta: `${v.numero} · busca motorista` })),
  ];
  const hora = new Date(d.hora).toLocaleTimeString("es-SV", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: "America/El_Salvador" });

  return (
    <section className="tarjeta mt-6 overflow-hidden" data-testid="en-vivo">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde px-5 py-4">
        <h2 className="flex items-center gap-2 font-bold"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-exito opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-exito" /></span>Ahora mismo</h2>
        <p className="text-xs text-suave">{error ? <span className="text-error">Sin conexión, reintentando…</span> : <>Se actualiza cada 15 s · {hora}</>}</p>
      </div>
      <div className="grid grid-cols-3 divide-x divide-borde border-b border-borde text-center">
        {[
          ["Disponibles", conectados.length, "text-exito", "vivo-disponibles"],
          ["En viaje", enCurso.length, "text-amarillo", "vivo-en-curso"],
          ["Buscan motorista", buscando.length, "text-naranja", "vivo-buscando"],
        ].map(([t, n, c, id]) => (
          <div key={t as string} className="px-2 py-3">
            <p className={`text-2xl font-extrabold tabular-nums ${c}`} data-testid={id as string}>{n}</p>
            <p className="text-[11px] text-suave">{t}</p>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-[1.7fr_1fr]">
        <div className="p-3">
          <Mapa centro={zona} zoom={13} puntos={puntos} circulo={zona} className="h-72 lg:h-80" etiqueta="Mapa en vivo de motoristas y pedidos" />
          <div className="mt-2 flex flex-wrap gap-4 px-1 text-[11px] text-suave">
            <span><i className="fa-solid fa-circle mr-1 text-exito" />Motorista disponible</span>
            <span><i className="fa-solid fa-circle mr-1 text-amarillo" />Motorista en viaje</span>
            <span><i className="fa-solid fa-circle mr-1 text-naranja" />Pedido sin motorista</span>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto border-t border-borde lg:border-t-0 lg:border-l">
          {d.viajes.length === 0 && conectados.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-suave">No hay viajes activos ni motoristas conectados.</p>
          ) : (
            <ul className="divide-y divide-borde text-sm">
              {[...buscando, ...enCurso].map((v) => (
                <li key={v.id} data-testid="vivo-viaje">
                  <Link href={`/panel/viajes/${v.id}`} className="block px-4 py-3 hover:bg-[#232323]">
                    <p className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold">{v.numero}</span>
                      <span className={`text-[11px] font-semibold ${v.estado === "BUSCANDO" ? (v.esperaMin >= 10 ? "text-error" : "text-naranja") : "text-amarillo"}`}>
                        {ESTADO[v.estado]}{v.estado === "BUSCANDO" && ` · ${v.esperaMin} min`}
                      </span>
                    </p>
                    <p className="truncate text-xs text-suave">{v.origen} → {v.destino}</p>
                    {v.motorista && <p className="truncate text-xs"><i className="fa-solid fa-truck mr-1 text-[10px] text-suave" />{v.motorista}</p>}
                  </Link>
                </li>
              ))}
              {conectados.map((m) => (
                <li key={m.id} className="flex items-center gap-2 px-4 py-2.5 text-xs" data-testid="vivo-motorista">
                  <i className="fa-solid fa-truck text-exito" />
                  <Link href={`/panel/motoristas/${m.id}`} className="flex-1 truncate font-semibold hover:text-naranja">{m.nombre}</Link>
                  <span className="text-suave">{m.lat == null ? "sin ubicación" : "disponible"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
