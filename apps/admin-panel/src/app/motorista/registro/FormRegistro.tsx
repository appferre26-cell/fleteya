"use client";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { CamposFiscales } from "@/components/CamposFiscales";
import { DocumentoInput } from "@/components/DocumentoInput";
import { FotoPerfilInput } from "@/components/FotoPerfilInput";
import { DOCUMENTOS, GRUPOS_DOC, TIPOS_DOC, TIPOS_VEHICULO, TOTAL_DOCS } from "@/lib/validacion";
import { registrarMotorista, type EstadoRegistro } from "./acciones";

const PASOS = [
  { titulo: "Tus datos", icono: "fa-user", campos: ["nombre", "telefono", "dui", "correo", "password", "repetir"] },
  { titulo: "Licencia", icono: "fa-id-card", campos: ["licenciaNumero", "licenciaVence"] },
  { titulo: "Vehículo", icono: "fa-truck", campos: ["placa", "tipoVehiculo", "marca", "modelo", "capacidadTon"] },
  { titulo: "Fotos", icono: "fa-camera", campos: TIPOS_DOC.map((t) => `doc_${t}`) },
  { titulo: "Facturación", icono: "fa-file-invoice", campos: ["requiereCreditoFiscal", "nit", "nrc", "razonSocial", "giro", "direccionFiscal", "acepto"] },
  { titulo: "Pago y alta", icono: "fa-circle-check", campos: [] as string[] },
];
const OPCIONALES = new Set(["correo", "requiereCreditoFiscal", "nit", "nrc", "razonSocial", "giro", "direccionFiscal"]);

export function FormRegistro({ precio }: { precio: string }) {
  const [estado, enviar, enviando] = useActionState<EstadoRegistro, FormData>(registrarMotorista, {});
  const [paso, setPaso] = useState(0);
  const [locales, setLocales] = useState<Record<string, string>>({});
  const form = useRef<HTMLFormElement>(null);
  const v = estado.valores ?? {};
  const err: Record<string, string | undefined> = { ...estado.errores, ...locales };

  // Si el servidor rechaza algo, se vuelve al primer paso con error.
  useEffect(() => {
    const e = estado.errores;
    if (!e) return;
    const i = PASOS.findIndex((p) => p.campos.some((c) => e[c]));
    if (i >= 0) setPaso(i);
    window.scrollTo({ top: 0 });
  }, [estado]);

  /** Revisión rápida en el celular antes de avanzar (el servidor vuelve a revisar todo). */
  function revisar(i: number) {
    const f = form.current!;
    const faltan: Record<string, string> = {};
    for (const c of PASOS[i].campos) {
      if (OPCIONALES.has(c)) continue;
      const el = f.elements.namedItem(c) as HTMLInputElement | null;
      if (!el) continue;
      if (el.type === "file") { if (!el.files?.length) faltan[c] = "Falta esta foto"; }
      else if (el.type === "checkbox") { if (!el.checked) faltan[c] = "Debes aceptar los términos para registrarte"; }
      else if (!el.value.trim()) faltan[c] = "Completa este dato";
    }
    if (i === 0) {
      const p = (f.elements.namedItem("password") as HTMLInputElement).value;
      const r = (f.elements.namedItem("repetir") as HTMLInputElement).value;
      if (p && p.length < 8) faltan.password = "Mínimo 8 letras o números";
      else if (p && r && p !== r) faltan.repetir = "Las dos contraseñas no son iguales";
    }
    setLocales(faltan);
    return Object.keys(faltan).length === 0;
  }

  const quitar = (c: string) => setLocales((l) => { const n = { ...l }; delete n[c]; return n; });

  function siguiente() {
    if (!revisar(paso)) return;
    setPaso((p) => Math.min(p + 1, PASOS.length - 1));
    window.scrollTo({ top: 0 });
  }

  function alEnviar(e: React.FormEvent<HTMLFormElement>) {
    // Se envía a mano para que el navegador NO vacíe el formulario (se perderían las 10 fotos si algo falla).
    e.preventDefault();
    if (paso < PASOS.length - 1) return siguiente();
    for (let i = 0; i < PASOS.length - 1; i++) if (!revisar(i)) { setPaso(i); return; }
    const fd = new FormData(e.currentTarget);
    startTransition(() => enviar(fd));
  }

  const campo = (nombre: string, etiqueta: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, ayuda?: string) => (
    <div>
      <label htmlFor={nombre} className="etiqueta">{etiqueta}</label>
      <input id={nombre} name={nombre} defaultValue={v[nombre] ?? ""} aria-invalid={!!err[nombre]}
        onChange={() => err[nombre] && quitar(nombre)}
        className={`campo ${err[nombre] ? "border-error" : ""}`} {...props} />
      {(err[nombre] || ayuda) && <p className={`mt-1 text-[11px] ${err[nombre] ? "text-error" : "text-suave"}`}>{err[nombre] ?? ayuda}</p>}
    </div>
  );
  const visible = (i: number) => (paso === i ? "" : "hidden");

  return (
    <form ref={form} onSubmit={alEnviar} noValidate
      onChange={(e) => { const n = (e.target as unknown as HTMLInputElement).name; if (n && locales[n]) quitar(n); }} className="mt-6" data-testid="form-registro">
      <ol className="flex gap-1" aria-label="Pasos del registro">
        {PASOS.map((p, i) => (
          <li key={p.titulo} className={`h-1.5 flex-1 rounded-full ${i <= paso ? "bg-naranja" : "bg-tarjeta-2"}`} aria-current={i === paso ? "step" : undefined} />
        ))}
      </ol>
      <p className="mt-3 text-[11px] font-semibold tracking-wider text-suave uppercase">Paso {paso + 1} de {PASOS.length}</p>
      <h2 className="mt-1 text-xl font-extrabold" data-testid="titulo-paso"><i className={`fa-solid ${PASOS[paso].icono} mr-2 text-naranja`} />{PASOS[paso].titulo}</h2>

      {estado.errores?.general && <p role="alert" className="mt-4 rounded-lg bg-error/10 px-4 py-3 text-sm text-error">{estado.errores.general}</p>}

      <div className={`mt-4 space-y-4 ${visible(0)}`}>
        {campo("nombre", "Nombre completo", { autoComplete: "name", placeholder: "Como aparece en tu DUI" })}
        {campo("telefono", "Celular", { inputMode: "tel", autoComplete: "tel", placeholder: "7123-4567" }, "Con este número entrarás a la app.")}
        {campo("dui", "Número de DUI", { inputMode: "numeric", placeholder: "00000000-0" })}
        {campo("correo", "Correo (opcional)", { type: "email", inputMode: "email", autoComplete: "email", placeholder: "para enviarte tus comprobantes" })}
        {campo("password", "Crea tu contraseña", { type: "password", autoComplete: "new-password" }, "Mínimo 8 letras o números.")}
        {campo("repetir", "Repite la contraseña", { type: "password", autoComplete: "new-password" })}
      </div>

      <div className={`mt-4 space-y-4 ${visible(1)}`}>
        {campo("licenciaNumero", "Número de licencia", { placeholder: "Normalmente es el mismo del DUI" })}
        {campo("licenciaVence", "Fecha de vencimiento", { type: "date" })}
      </div>

      <div className={`mt-4 space-y-4 ${visible(2)}`}>
        <p className="text-xs text-suave">Copia los datos de la tarjeta de circulación. El vehículo puede ser propio, prestado o alquilado.</p>
        {campo("placa", "Placa", { placeholder: "P 123-456", className: `campo uppercase ${err.placa ? "border-error" : ""}` })}
        <div>
          <label htmlFor="tipoVehiculo" className="etiqueta">Tipo de vehículo</label>
          <select id="tipoVehiculo" name="tipoVehiculo" defaultValue={v.tipoVehiculo ?? ""} className={`campo ${err.tipoVehiculo ? "border-error" : ""}`}>
            <option value="" disabled>Elige uno…</option>
            {Object.entries(TIPOS_VEHICULO).map(([k, t]) => <option key={k} value={k}>{t.nombre} ({t.ayuda})</option>)}
          </select>
          {err.tipoVehiculo && <p className="mt-1 text-[11px] text-error">{err.tipoVehiculo === "Completa este dato" ? "Elige el tipo de vehículo" : err.tipoVehiculo}</p>}
        </div>
        {campo("marca", "Marca", { placeholder: "Toyota, Isuzu, Hino…" })}
        {campo("modelo", "Modelo", { placeholder: "Hilux, NPR…" })}
        {campo("capacidadTon", "Capacidad máxima (toneladas)", { type: "number", step: "0.1", min: "0.5", max: "40", inputMode: "decimal", placeholder: "1.0" },
          "Solo te llegarán viajes que quepan en tu vehículo.")}
      </div>

      <div className={`mt-4 ${visible(3)}`}>
        <div className="tarjeta p-4">
          <FotoPerfilInput existente={v.foto_perfil} error={err.foto_perfil} />
        </div>
        <p className="mt-4 text-xs text-suave">Las {TOTAL_DOCS} fotos son obligatorias. Que se lean bien, sin reflejos. El vehículo debe verse completo y con la placa visible atrás.</p>
        {GRUPOS_DOC.map((g) => (
          <div key={g.titulo} className="mt-4">
            <p className="text-xs font-semibold text-suave uppercase">{g.titulo}</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {g.tipos.map((t) => <DocumentoInput key={t} nombre={`doc_${t}`} etiqueta={DOCUMENTOS[t]} error={err[`doc_${t}`]} />)}
            </div>
          </div>
        ))}
      </div>

      <div className={`mt-4 space-y-5 ${visible(4)}`}>
        <div className="tarjeta p-4">
          <p className="mb-3 text-xs text-suave">FleteYa te entrega un comprobante por el acceso y cada recarga. Si tienes NRC y quieres crédito fiscal, márcalo aquí.</p>
          <CamposFiscales valores={v} errores={err} />
        </div>
        <div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="acepto" defaultChecked={v.acepto === "on"} onChange={() => quitar("acepto")} className="mt-0.5 h-5 w-5 shrink-0 accent-naranja" />
            <span>Leí y acepto los <Link href="/motorista/legal/terminos" target="_blank" className="font-semibold text-naranja underline">Términos para Motoristas</Link> y el <Link href="/motorista/legal/privacidad" target="_blank" className="font-semibold text-naranja underline">Aviso de privacidad</Link>.</span>
          </label>
          {err.acepto && <p className="mt-1 text-[11px] text-error">{err.acepto}</p>}
        </div>
      </div>

      <div className={`mt-4 space-y-4 ${visible(5)}`}>
        <div className="rounded-2xl border border-naranja/50 bg-gradient-to-br from-naranja/15 to-tarjeta p-5">
          <p className="text-[11px] font-semibold tracking-wider text-suave uppercase">Acceso a la plataforma</p>
          <p className="mt-1 text-4xl font-extrabold">{precio}</p>
          <p className="mt-1 text-xs text-suave">Pago único. Después solo recargas el monto que quieras para recibir viajes.</p>
        </div>
        <ul className="tarjeta divide-y divide-borde text-sm">
          {["Guardamos tus datos y tus fotos.", "Pagas el acceso (transferencia o efectivo; muy pronto también con tarjeta).", "FleteYa revisa tus fotos y activa tu perfil.", "Recargas créditos y empiezas a recibir viajes."].map((t, i) => (
            <li key={t} className="flex gap-3 p-3.5"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-naranja/15 text-xs font-bold text-naranja">{i + 1}</span>{t}</li>
          ))}
        </ul>
      </div>

      <div className="mt-6 flex gap-2">
        {paso > 0 && (
          <button type="button" onClick={() => { setLocales({}); setPaso(paso - 1); }} className="btn-secundario h-12 px-4" aria-label="Paso anterior">
            <i className="fa-solid fa-arrow-left" />
          </button>
        )}
        {paso < PASOS.length - 1 ? (
          <button key="siguiente" type="button" onClick={siguiente} className="btn-primario h-12 flex-1" data-testid="siguiente">Continuar <i className="fa-solid fa-arrow-right" /></button>
        ) : (
          <button key="pagar" type="submit" disabled={enviando} className="btn-primario h-12 flex-1" data-testid="pagar-activar">
            {enviando ? "Guardando tus datos y fotos…" : <><i className="fa-solid fa-lock" />Pagar {precio} y activar mi perfil</>}
          </button>
        )}
      </div>
      {Object.keys(locales).length > 0 && <p role="alert" className="mt-3 text-center text-xs text-error">Revisa lo marcado en rojo.</p>}
    </form>
  );
}
