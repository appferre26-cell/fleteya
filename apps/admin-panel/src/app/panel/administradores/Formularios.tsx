"use client";
import { useActionState, useState, useTransition } from "react";
import {
  agregarPropietario, cambiarActivo, cambiarMiContrasena, restablecerPropietario, type EstadoAdmin,
} from "./acciones";

function Mensaje({ e }: { e: EstadoAdmin }) {
  if (e.error) return <p role="alert" className="mt-3 rounded-lg bg-error/10 px-3 py-2.5 text-xs text-error">{e.error}</p>;
  if (!e.ok) return null;
  return (
    <div role="status" className="mt-3 rounded-lg bg-exito/10 px-3 py-2.5 text-xs text-exito">
      {e.ok}
      {e.password && (
        <p className="mt-2 text-texto">Usuario: <b>{e.correo}</b><br />Contraseña temporal: <b data-testid="password-propietario" className="font-mono text-sm text-naranja">{e.password}</b><br />
          <span className="text-suave">Entrégala en persona o por mensaje privado. No se vuelve a mostrar; luego la puede cambiar en «Cambiar mi contraseña».</span></p>
      )}
    </div>
  );
}

export function AgregarPropietario() {
  const [e, accion, enviando] = useActionState<EstadoAdmin, FormData>(agregarPropietario, {});
  return (
    <section className="tarjeta p-5">
      <h2 className="font-bold"><i className="fa-solid fa-user-plus mr-2 text-naranja" />Agregar propietario</h2>
      <form action={accion} className="mt-3 space-y-3">
        <input name="nombre" required placeholder="Nombre completo" aria-label="Nombre completo" className="campo" />
        <input name="correo" type="email" required placeholder="correo@gmail.com" aria-label="Correo" className="campo" />
        <button type="submit" disabled={enviando} className="btn-secundario w-full">{enviando ? "Creando…" : "Crear cuenta"}</button>
      </form>
      <Mensaje e={e} />
    </section>
  );
}

export function CambiarContrasena() {
  const [e, accion, enviando] = useActionState<EstadoAdmin, FormData>(cambiarMiContrasena, {});
  return (
    <section className="tarjeta p-5">
      <h2 className="font-bold"><i className="fa-solid fa-key mr-2 text-naranja" />Cambiar mi contraseña</h2>
      <form action={accion} className="mt-3 space-y-3">
        <input name="actual" type="password" autoComplete="current-password" required placeholder="Contraseña actual" aria-label="Contraseña actual" className="campo" />
        <input name="nueva" type="password" autoComplete="new-password" required minLength={8} placeholder="Nueva (mínimo 8 caracteres)" aria-label="Contraseña nueva" className="campo" />
        <input name="repetir" type="password" autoComplete="new-password" required placeholder="Repite la nueva" aria-label="Repetir contraseña nueva" className="campo" />
        <button type="submit" disabled={enviando} className="btn-secundario w-full">{enviando ? "Guardando…" : "Cambiar contraseña"}</button>
      </form>
      <Mensaje e={e} />
    </section>
  );
}

export function BotonesPropietario({ id, nombre, activo }: { id: string; nombre: string; activo: boolean }) {
  const [e, setE] = useState<EstadoAdmin>({});
  const [ocupado, iniciar] = useTransition();
  const correr = (pregunta: string, fn: () => Promise<EstadoAdmin>) => {
    if (window.confirm(pregunta)) iniciar(async () => setE(await fn()));
  };
  return (
    <div className="w-full sm:w-auto">
      <div className="flex gap-2">
        <button type="button" disabled={ocupado} className="btn-secundario h-9 text-xs"
          onClick={() => correr(`¿Crear una contraseña nueva para ${nombre}?`, () => restablecerPropietario(id))}>
          <i className="fa-solid fa-key text-suave" />Contraseña nueva
        </button>
        <button type="button" disabled={ocupado} className={`btn-secundario h-9 text-xs ${activo ? "text-error" : "text-exito"}`}
          onClick={() => correr(activo ? `¿Desactivar la cuenta de ${nombre}? Ya no podrá entrar.` : `¿Activar la cuenta de ${nombre}?`, () => cambiarActivo(id, !activo))}>
          {activo ? "Desactivar" : "Activar"}
        </button>
      </div>
      <Mensaje e={e} />
    </div>
  );
}
