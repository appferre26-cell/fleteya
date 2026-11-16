"use client";
import { useActionState, useState } from "react";
import { entrarMotorista } from "../acciones";

export function FormEntrar() {
  const [estado, accion, enviando] = useActionState(entrarMotorista, {});
  const [ver, setVer] = useState(false);
  const [ayuda, setAyuda] = useState(false);
  return (
    <form action={accion} className="mt-8 space-y-5">
      <div>
        <label htmlFor="telefono" className="etiqueta">Número de teléfono</label>
        <div className="relative">
          <i className="fa-solid fa-mobile-screen pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-suave" />
          <input id="telefono" name="telefono" inputMode="tel" autoComplete="username" required defaultValue={estado.telefono}
            placeholder="7000-0000" className="campo pl-10 text-base" />
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="password" className="text-xs font-semibold text-suave">Contraseña</label>
          <button type="button" onClick={() => setAyuda((a) => !a)} className="text-xs font-semibold text-naranja">¿La olvidaste?</button>
        </div>
        <div className="relative">
          <i className="fa-solid fa-lock pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-suave" />
          <input id="password" name="password" type={ver ? "text" : "password"} autoComplete="current-password" required
            placeholder="Tu contraseña" className="campo px-10 text-base" />
          <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-suave"><i className={ver ? "fa-regular fa-eye-slash" : "fa-regular fa-eye"} /></button>
        </div>
        {ayuda && <p className="mt-2 rounded-lg bg-tarjeta-2 p-3 text-xs leading-relaxed text-suave">Llama o escribe a FleteYa: te darán una contraseña temporal nueva.</p>}
      </div>
      {estado.error && (
        <p role="alert" className="flex items-center gap-2 rounded-lg bg-error/10 px-3.5 py-3 text-sm text-error"><i className="fa-solid fa-circle-exclamation" />{estado.error}</p>
      )}
      <button type="submit" disabled={enviando} className="btn-primario h-14 w-full text-base">
        {enviando ? "Entrando…" : <>Entrar <i className="fa-solid fa-arrow-right" /></>}
      </button>
    </form>
  );
}
