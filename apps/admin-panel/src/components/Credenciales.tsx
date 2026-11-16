"use client";
import { useState } from "react";
import { formatoTelefono } from "@/lib/validacion";

/** Muestra una sola vez el usuario y la contraseña temporal del motorista. */
export function Credenciales({ nombre, telefono, password }: { nombre: string; telefono: string; password: string }) {
  const [copiado, setCopiado] = useState(false);
  const mensaje =
    `Hola ${nombre.split(" ")[0]}, ya estás registrado en FleteYa.\n` +
    `Usuario: ${formatoTelefono(telefono)} (tu número de teléfono)\n` +
    `Contraseña temporal: ${password}\n` +
    `Te pediremos cambiarla la primera vez que entres a la app FleteYa Motorista. Te enviaremos el enlace de la app cuando esté lista.`;

  return (
    <div className="rounded-xl border border-naranja/40 bg-naranja/[0.06] p-4">
      <p className="text-sm font-semibold"><i className="fa-solid fa-key mr-2 text-naranja" />Datos de acceso del motorista</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-xs text-suave">Usuario (teléfono)</dt><dd className="font-bold tabular-nums">{formatoTelefono(telefono)}</dd></div>
        <div><dt className="text-xs text-suave">Contraseña temporal</dt><dd data-testid="password-temporal" className="font-mono text-lg font-bold tracking-wider text-naranja">{password}</dd></div>
      </dl>
      <p className="mt-3 text-xs text-suave">Guárdala o envíala ahora: por seguridad <span className="text-texto">no se vuelve a mostrar</span>. Si se pierde, crea una nueva con «Restablecer contraseña».</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={`https://wa.me/503${telefono}?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer" className="btn-secundario h-10">
          <i className="fa-brands fa-whatsapp text-exito" />Enviar por WhatsApp
        </a>
        <button type="button" className="btn-secundario h-10"
          onClick={async () => { await navigator.clipboard?.writeText(mensaje); setCopiado(true); }}>
          <i className="fa-regular fa-copy" />{copiado ? "¡Copiado!" : "Copiar mensaje"}
        </button>
      </div>
    </div>
  );
}
