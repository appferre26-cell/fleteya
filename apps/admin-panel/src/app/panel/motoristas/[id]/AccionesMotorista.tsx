"use client";
import type { EstadoMotorista } from "@prisma/client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Credenciales } from "@/components/Credenciales";
import { TOTAL_REQUISITOS } from "@/lib/validacion";
import {
  aprobarMotorista, reactivarMotorista, restablecerContrasena, suspenderMotorista, type EstadoAccion,
} from "../acciones";

function Aviso({ e }: { e: EstadoAccion }) {
  return e.error ? <p role="alert" className="mt-3 rounded-lg bg-error/10 px-3 py-2.5 text-xs text-error">{e.error}</p> : null;
}

export function AccionesMotorista({ id, nombre, telefono, estado, documentos, licenciaVencida, accesoPagado, children }: {
  id: string; nombre: string; telefono: string; estado: EstadoMotorista; documentos: number; licenciaVencida: boolean;
  accesoPagado: boolean; children?: React.ReactNode; // children: tarjeta del pago de acceso
}) {
  const [aprob, aprobar, aprobando] = useActionState<EstadoAccion, FormData>(aprobarMotorista.bind(null, id), {});
  const [susp, suspender, suspendiendo] = useActionState<EstadoAccion, FormData>(suspenderMotorista.bind(null, id), {});
  const [otra, setOtra] = useState<EstadoAccion>({});
  const [ocupado, iniciar] = useTransition();
  const [abrirSusp, setAbrirSusp] = useState(false);

  const [exito, setExito] = useState<string>();
  useEffect(() => { if (aprob.ok) setExito(aprob.ok); }, [aprob]);
  useEffect(() => { if (susp.ok) { setExito(susp.ok); setAbrirSusp(false); } }, [susp]);

  const correr = (fn: () => Promise<EstadoAccion>, confirmar?: string) => {
    if (confirmar && !window.confirm(confirmar)) return;
    iniciar(async () => {
      const r = await fn();
      setOtra(r);
      setExito(r.ok && !r.password ? r.ok : undefined);
    });
  };

  return (
    <aside className="space-y-4">
      {/* El mensaje de éxito va arriba: la tarjeta que lo generó puede desaparecer al cambiar el estado. */}
      {exito && <p role="status" className="rounded-lg bg-exito/10 px-4 py-3 text-sm text-exito"><i className="fa-solid fa-circle-check mr-2" />{exito}</p>}
      {estado === "PENDIENTE" && (
        <section className="tarjeta border-naranja/40 p-5">
          <h2 className="flex items-center gap-2 font-bold"><i className="fa-solid fa-file-circle-check text-naranja" />Aprobar motorista</h2>
          {documentos < TOTAL_REQUISITOS ? (
            <p className="mt-2 text-sm text-suave">Faltan {TOTAL_REQUISITOS - documentos} de {TOTAL_REQUISITOS} fotos (incluida la foto de perfil). Súbelas en <span className="text-texto">Editar datos</span> para poder aprobarlo.</p>
          ) : !accesoPagado ? (
            <p className="mt-2 text-sm text-suave" data-testid="falta-acceso">Primero registra su <span className="text-texto">pago de acceso</span> (abajo). Sin ese pago no se puede dar de alta.</p>
          ) : (
            <form action={aprobar} className="mt-3 space-y-2.5 text-sm">
              <p className="text-xs text-suave">Confirma que revisaste las fotos:</p>
              {[
                ["revisoDui", "El DUI es legible y coincide con el nombre"],
                ["revisoLicencia", "La licencia está vigente"],
                ["revisoTarjeta", "La tarjeta de circulación coincide con la placa"],
                ["revisoVehiculo", "Las 4 fotos del vehículo coinciden con la placa y el tipo"],
              ].map(([n, t]) => (
                <label key={n} className="flex cursor-pointer items-start gap-2.5">
                  <input type="checkbox" name={n} className="mt-0.5 h-4 w-4 shrink-0 accent-naranja" />{t}
                </label>
              ))}
              {licenciaVencida && <p className="rounded-lg bg-error/10 px-3 py-2 text-xs text-error">Ojo: según la fecha registrada, la licencia está vencida.</p>}
              <button type="submit" disabled={aprobando} className="btn-primario mt-2 w-full"><i className="fa-solid fa-check" />{aprobando ? "Aprobando…" : "Aprobar motorista"}</button>
            </form>
          )}
          <Aviso e={aprob} />
        </section>
      )}
      {children}

      {estado === "SUSPENDIDO" ? (
        <section className="tarjeta p-5">
          <h2 className="font-bold">Motorista suspendido</h2>
          <p className="mt-1 text-sm text-suave">No puede recibir viajes mientras esté suspendido.</p>
          <button type="button" disabled={ocupado} onClick={() => correr(() => reactivarMotorista(id), `¿Reactivar a ${nombre}?`)}
            className="btn-secundario mt-3 w-full border-exito/40 text-exito"><i className="fa-solid fa-rotate-left" />Reactivar</button>
        </section>
      ) : (
        <section className="tarjeta p-5">
          <h2 className="font-bold">{estado === "PENDIENTE" ? "¿No cumple los requisitos?" : "Suspender"}</h2>
          <p className="mt-1 text-sm text-suave">Un motorista suspendido no puede recibir viajes. Se puede reactivar después.</p>
          {!abrirSusp ? (
            <button type="button" onClick={() => setAbrirSusp(true)} className="btn-secundario mt-3 w-full border-error/40 text-error">
              <i className="fa-solid fa-ban" />Suspender
            </button>
          ) : (
            <form action={suspender} className="mt-3 space-y-2">
              <label htmlFor="motivo" className="etiqueta">Motivo (lo verán los demás propietarios)</label>
              <textarea id="motivo" name="motivo" rows={3} maxLength={300} required className="campo h-auto py-2.5" placeholder="Ej.: licencia vencida, quejas de clientes…" />
              <div className="flex gap-2">
                <button type="submit" disabled={suspendiendo} className="btn-secundario flex-1 border-error/40 text-error">{suspendiendo ? "Suspendiendo…" : "Confirmar suspensión"}</button>
                <button type="button" onClick={() => setAbrirSusp(false)} className="btn-secundario">Cancelar</button>
              </div>
            </form>
          )}
          <Aviso e={susp} />
        </section>
      )}

      <section className="tarjeta p-5">
        <h2 className="font-bold">Acceso a la app</h2>
        <p className="mt-1 text-sm text-suave">Si olvidó su contraseña, crea una nueva y envíasela. La anterior deja de funcionar.</p>
        <button type="button" disabled={ocupado}
          onClick={() => correr(() => restablecerContrasena(id), `¿Crear una contraseña nueva para ${nombre}? La anterior dejará de funcionar.`)}
          className="btn-secundario mt-3 w-full"><i className="fa-solid fa-key text-suave" />Restablecer contraseña</button>
        {otra.password && <div className="mt-3"><Credenciales nombre={nombre} telefono={telefono} password={otra.password} /></div>}
        <Aviso e={otra} />
      </section>
    </aside>
  );
}
