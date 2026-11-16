"use client";
import { useActionState, useState } from "react";
import { entrar, type EstadoLogin } from "./acciones";

export function FormLogin() {
  const [estado, accion, enviando] = useActionState<EstadoLogin, FormData>(entrar, {});
  const [ver, setVer] = useState(false);
  const [ayuda, setAyuda] = useState(false);

  return (
    <form action={accion} className="mt-8 space-y-5">
      <div>
        <label htmlFor="correo" className="etiqueta">Correo electrónico</label>
        <div className="relative">
          <i className="fa-regular fa-envelope pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-suave" />
          <input id="correo" name="correo" type="email" autoComplete="username" required defaultValue={estado.correo}
            placeholder="tucorreo@gmail.com" className="campo pl-10" />
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="password" className="text-xs font-semibold text-suave">Contraseña</label>
          <button type="button" onClick={() => setAyuda((a) => !a)} className="text-xs font-semibold text-naranja">
            ¿Olvidaste tu contraseña?
          </button>
        </div>
        <div className="relative">
          <i className="fa-solid fa-lock pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-suave" />
          <input id="password" name="password" type={ver ? "text" : "password"} autoComplete="current-password" required
            placeholder="Tu contraseña" className="campo px-10" />
          <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-suave">
            <i className={ver ? "fa-regular fa-eye-slash" : "fa-regular fa-eye"} />
          </button>
        </div>
        {ayuda && (
          <p className="mt-2 rounded-lg bg-tarjeta-2 p-3 text-xs leading-relaxed text-suave">
            Pídele a otro propietario que te ponga una contraseña nueva desde <span className="text-texto">Administradores</span>.
          </p>
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-3 select-none">
        <input type="checkbox" name="recordar" className="h-5 w-5 accent-naranja" />
        <span className="text-sm">Recordar este equipo por 30 días</span>
      </label>

      {estado.error && (
        <p role="alert" className="flex items-center gap-2 rounded-lg bg-error/10 px-3.5 py-3 text-sm text-error">
          <i className="fa-solid fa-circle-exclamation" />{estado.error}
        </p>
      )}

      <button type="submit" disabled={enviando} className="btn-primario h-[52px] w-full text-[15px]">
        {enviando ? "Entrando…" : <>Entrar al panel <i className="fa-solid fa-arrow-right" /></>}
      </button>
    </form>
  );
}
