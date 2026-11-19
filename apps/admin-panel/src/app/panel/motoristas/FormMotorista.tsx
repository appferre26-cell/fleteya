"use client";
import Link from "next/link";
import { useActionState, useMemo } from "react";
import { Credenciales } from "@/components/Credenciales";
import { DocumentoInput } from "@/components/DocumentoInput";
import { FotoPerfilInput } from "@/components/FotoPerfilInput";
import { DOCUMENTOS, GRUPOS_DOC, TIPOS_VEHICULO, TOTAL_DOCS, type TipoDoc } from "@/lib/validacion";
import { CamposFiscales } from "@/components/CamposFiscales";
import type { EstadoFormMotorista } from "./acciones";

type Accion = (s: EstadoFormMotorista, f: FormData) => Promise<EstadoFormMotorista>;

export function FormMotorista({ accion, inicial = {}, documentos = {}, fotoPerfil, cancelar }: {
  accion: Accion;
  inicial?: Record<string, string>;
  documentos?: Partial<Record<TipoDoc, string>>; // tipo → url de la foto actual
  fotoPerfil?: string; // url de la foto de perfil actual (opcional)
  cancelar: string;
}) {
  const [estado, enviar, enviando] = useActionState<EstadoFormMotorista, FormData>(accion, {});
  const v = estado.valores ?? inicial;
  const err = estado.errores ?? {};
  const editando = Object.keys(inicial).length > 0;
  // Tras cada envío el navegador vacía los archivos: se reinician las vistas previas para no engañar.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const intento = useMemo(() => Math.random(), [estado]);

  if (estado.creado) {
    const c = estado.creado;
    return (
      <div className="tarjeta max-w-2xl p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-exito/15"><i className="fa-solid fa-check text-xl text-exito" /></div>
        <h2 className="mt-4 text-xl font-extrabold">{c.nombre} quedó registrado</h2>
        <p className="mt-1 text-sm text-suave">
          Está <span className="font-semibold text-naranja">pendiente de aprobación</span>.
          {c.documentos < TOTAL_DOCS ? ` Faltan ${TOTAL_DOCS - c.documentos} foto(s); súbelas antes de aprobarlo.` : " Registra su pago de acceso, revisa sus fotos y apruébalo."}
        </p>
        <div className="mt-5"><Credenciales nombre={c.nombre} telefono={c.telefono} password={c.password} /></div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={`/panel/motoristas/${c.id}`} className="btn-primario">Revisar y aprobar</Link>
          {/* Recarga completa a propósito: deja el formulario limpio. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/panel/motoristas/nuevo" className="btn-secundario h-12">Agregar otro motorista</a>
        </div>
      </div>
    );
  }

  const campo = (nombre: string, etiqueta: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, ayuda?: string) => (
    <div>
      <label htmlFor={nombre} className="etiqueta">{etiqueta}</label>
      <input id={nombre} name={nombre} defaultValue={v[nombre] ?? ""} aria-invalid={!!err[nombre]}
        className={`campo ${err[nombre] ? "border-error" : ""}`} {...props} />
      {(err[nombre] || ayuda) && <p className={`mt-1 text-[11px] ${err[nombre] ? "text-error" : "text-suave"}`}>{err[nombre] ?? ayuda}</p>}
    </div>
  );

  return (
    <form action={enviar} className="space-y-5" noValidate>
      {estado.guardado && (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-exito/10 px-4 py-3 text-sm text-exito">
          <i className="fa-solid fa-circle-check" />Cambios guardados. <Link href={cancelar} className="ml-auto font-semibold underline">Volver al detalle</Link>
        </p>
      )}
      {Object.keys(err).length > 0 && (
        <p role="alert" className="flex items-center gap-2 rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
          <i className="fa-solid fa-circle-exclamation" />{err.general ?? "Revisa los campos marcados en rojo."} Si habías elegido fotos nuevas, vuelve a elegirlas.
        </p>
      )}

      <section className="tarjeta p-5">
        <h2 className="seccion-titulo">Datos personales</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {campo("nombre", "Nombre completo", { autoComplete: "off", placeholder: "Como aparece en el DUI" })}
          {campo("telefono", "Celular (será su usuario)", { inputMode: "tel", placeholder: "7123-4567" }, "8 dígitos. Con este número entrará a la app.")}
          {campo("dui", "Número de DUI", { inputMode: "numeric", placeholder: "00000000-0" })}
          {campo("correo", "Correo (opcional)", { type: "email", inputMode: "email", placeholder: "para enviarle sus recibos" })}
        </div>
      </section>

      <section className="tarjeta p-5">
        <h2 className="seccion-titulo">Licencia de conducir</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {campo("licenciaNumero", "Número de licencia", { placeholder: "Normalmente es el mismo del DUI" })}
          {campo("licenciaVence", "Fecha de vencimiento", { type: "date" })}
        </div>
      </section>

      <section className="tarjeta p-5">
        <h2 className="seccion-titulo">Vehículo (de la tarjeta de circulación)</h2>
        <p className="mt-1 text-xs text-suave">Puede ser propio, prestado o alquilado.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {campo("placa", "Placa", { placeholder: "P 123-456", className: "campo uppercase" })}
          <div>
            <label htmlFor="tipoVehiculo" className="etiqueta">Tipo de vehículo</label>
            {/* key: React 19 no restaura el <select> tras el reinicio del formulario */}
            <select key={`tv-${intento}`} id="tipoVehiculo" name="tipoVehiculo" defaultValue={v.tipoVehiculo ?? ""} className={`campo ${err.tipoVehiculo ? "border-error" : ""}`}>
              <option value="" disabled>Elige uno…</option>
              {Object.entries(TIPOS_VEHICULO).map(([k, t]) => <option key={k} value={k}>{t.nombre} ({t.ayuda})</option>)}
            </select>
            {err.tipoVehiculo && <p className="mt-1 text-[11px] text-error">{err.tipoVehiculo}</p>}
          </div>
          {campo("marca", "Marca", { placeholder: "Toyota, Isuzu, Hino…" })}
          {campo("modelo", "Modelo", { placeholder: "Hilux, NPR…" })}
          {campo("capacidadTon", "Capacidad máxima (toneladas)", { type: "number", step: "0.1", min: "0.5", max: "40", inputMode: "decimal", placeholder: "1.0" },
            "Solo le llegarán viajes que quepan en su vehículo.")}
        </div>
      </section>

      <section className="tarjeta p-5">
        <h2 className="seccion-titulo">Foto de perfil</h2>
        <p className="mt-1 mb-3 text-xs text-suave">Opcional: la ve el cliente para saber quién le atenderá. Puedes subirla o reemplazarla cuando quieras.</p>
        <FotoPerfilInput key={`fp-${intento}`} existente={fotoPerfil} error={err.foto_perfil} />
      </section>

      <section className="tarjeta p-5">
        <h2 className="seccion-titulo">Fotos ({TOTAL_DOCS})</h2>
        <p className="mt-1 text-xs text-suave">DUI, licencia y tarjeta de circulación por los dos lados, y el vehículo de frente, de atrás y de ambos costados. Puedes subirlas ahora o después; sin todas no se puede aprobar.</p>
        {GRUPOS_DOC.map((g) => (
          <div key={g.titulo} className="mt-4">
            <p className="text-xs font-semibold text-suave uppercase">{g.titulo}</p>
            <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {g.tipos.map((t) => (
                <DocumentoInput key={`${t}-${intento}`} nombre={`doc_${t}`} etiqueta={DOCUMENTOS[t]} existente={documentos[t]} error={err[`doc_${t}`]} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="tarjeta p-5">
        <h2 className="seccion-titulo">Facturación</h2>
        <p className="mt-1 text-xs text-suave">Solo si el motorista pide crédito fiscal por el acceso y las recargas.</p>
        <div className="mt-4"><CamposFiscales valores={v} errores={err} /></div>
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={enviando} className="btn-primario">
          {enviando ? "Guardando…" : editando ? <><i className="fa-solid fa-floppy-disk" />Guardar cambios</> : <><i className="fa-solid fa-user-plus" />Registrar motorista</>}
        </button>
        <Link href={cancelar} className="btn-secundario h-12">Cancelar</Link>
      </div>
    </form>
  );
}
