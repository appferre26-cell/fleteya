"use client";
import Link from "next/link";
import { useActionState } from "react";
import { cambiarContrasena } from "../acciones";

export function FormContrasena({ primera }: { primera: boolean }) {
  const [estado, accion, enviando] = useActionState(cambiarContrasena, {});
  const campo = (id: string, texto: string, ac: string) => (
    <div>
      <label htmlFor={id} className="etiqueta">{texto}</label>
      <input id={id} name={id} type="password" autoComplete={ac} required className="campo text-base" />
    </div>
  );
  return (
    <form action={accion} className="mt-8 space-y-4">
      {campo("actual", primera ? "Contraseña temporal" : "Contraseña actual", "current-password")}
      {campo("nueva", "Nueva contraseña (mínimo 8)", "new-password")}
      {campo("repetir", "Repite la nueva contraseña", "new-password")}
      {estado.error && <p role="alert" className="rounded-lg bg-error/10 px-3.5 py-3 text-sm text-error"><i className="fa-solid fa-circle-exclamation mr-2" />{estado.error}</p>}
      <button type="submit" disabled={enviando} className="btn-primario h-14 w-full text-base">{enviando ? "Guardando…" : "Guardar contraseña"}</button>
      {!primera && <Link href="/motorista/perfil" className="block py-2 text-center text-sm text-suave">Cancelar</Link>}
    </form>
  );
}
