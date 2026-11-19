"use client";
import { useActionState } from "react";
import { FotoPerfilInput } from "@/components/FotoPerfilInput";
import { subirFotoPerfil, type EstadoFotoPerfil } from "./acciones";

/** Pequeño formulario para que el motorista suba o cambie su foto de perfil. */
export function FormFotoPerfil({ tieneFoto, src }: { tieneFoto: boolean; src: string }) {
  const [estado, enviar, enviando] = useActionState<EstadoFotoPerfil, FormData>(subirFotoPerfil, {});
  return (
    <form action={enviar} className="tarjeta mt-4 space-y-3 p-4">
      <FotoPerfilInput existente={tieneFoto ? src : undefined} error={estado.error} />
      {estado.ok && <p className="text-[11px] text-exito"><i className="fa-solid fa-circle-check mr-1" />Foto guardada.</p>}
      <button type="submit" disabled={enviando} className="btn-secundario h-10 w-full sm:w-auto sm:px-5">
        {enviando ? "Guardando…" : <><i className="fa-solid fa-camera mr-1.5" />{tieneFoto ? "Cambiar mi foto" : "Subir mi foto"}</>}
      </button>
    </form>
  );
}
