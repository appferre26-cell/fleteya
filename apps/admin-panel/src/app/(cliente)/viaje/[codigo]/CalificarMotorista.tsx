"use client";
import { useRouter } from "next/navigation";
import { Calificar } from "@/components/Calificar";
import { calificarMotorista } from "../../pedir/acciones";

export function CalificarMotorista({ codigo, nombre }: { codigo: string; nombre: string }) {
  const router = useRouter();
  return (
    <Calificar testid="calificar-motorista" titulo={`¿Cómo te fue con ${nombre}?`}
      ayuda="Tu calificación ayuda a FleteYa a mantener a los mejores motoristas."
      placeholder="Cuéntanos algo (opcional): puntual, cuidó la carga…"
      enviar={async (n, c) => { const r = await calificarMotorista(codigo, n, c); if (!r.error) router.refresh(); return r; }} />
  );
}
