import type { EstadoMotorista } from "@prisma/client";
import { ESTADOS } from "@/lib/validacion";

export function Estado({ estado }: { estado: EstadoMotorista }) {
  const e = ESTADOS[estado];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold ${e.clase}`}>
      {estado === "PENDIENTE" ? <i className="fa-regular fa-clock text-[10px]" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {e.nombre}
    </span>
  );
}

export function Iniciales({ nombre, pendiente, grande }: { nombre: string; pendiente?: boolean; grande?: boolean }) {
  const ini = nombre.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full font-bold ${grande ? "h-14 w-14 text-base" : "h-10 w-10 text-xs"} ${pendiente ? "border border-dashed border-naranja/60 bg-tarjeta-2 text-suave" : "bg-gradient-to-br from-[#4a3a2e] to-[#2e2621]"}`}>
      {ini}
    </div>
  );
}
