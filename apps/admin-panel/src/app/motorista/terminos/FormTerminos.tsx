"use client";
import { useActionState } from "react";
import { aceptarTerminos } from "../acciones";

export function FormTerminos() {
  const [estado, accion, enviando] = useActionState(aceptarTerminos, {});
  return (
    <form action={accion} className="mt-6 space-y-4">
      <label className="flex cursor-pointer gap-3 text-sm leading-relaxed select-none">
        <input type="checkbox" name="acepto" className="mt-0.5 h-5 w-5 shrink-0 accent-naranja" />
        <span>He leído y acepto los <b>Términos para Motoristas</b> y el <b>Aviso de Privacidad</b>.</span>
      </label>
      {estado.error && <p role="alert" className="rounded-lg bg-error/10 px-3.5 py-3 text-sm text-error">{estado.error}</p>}
      <button type="submit" disabled={enviando} className="btn-primario h-14 w-full text-base">{enviando ? "Guardando…" : <>Aceptar y continuar <i className="fa-solid fa-arrow-right" /></>}</button>
    </form>
  );
}
