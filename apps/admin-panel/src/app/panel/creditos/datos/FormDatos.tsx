"use client";
import { useActionState } from "react";
import { guardarDatosCreditos, type EstadoForm } from "../acciones";

type Datos = {
  emisorNombre: string | null; emisorNit: string | null; emisorDireccion: string | null;
  bancoNombre: string | null; bancoTipoCuenta: string | null; bancoNumero: string | null; bancoTitular: string | null;
  planSemanal: number; planMensual: number; comisionPct: number;
};

export function FormDatos({ d }: { d: Datos }) {
  const [e, accion, enviando] = useActionState<EstadoForm, FormData>(guardarDatosCreditos, {});
  const err = e.errores ?? {};
  const v = (k: keyof Datos) => e.valores?.[k] ?? String(d[k] ?? "");
  const campo = (name: keyof Datos, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, ayuda?: string) => (
    <div>
      <label className="etiqueta" htmlFor={name}>{label}</label>
      <input id={name} name={name} defaultValue={v(name)} className={`campo h-11 ${err[name] ? "border-error" : ""}`} {...props} />
      {err[name] ? <p className="mt-1 text-[11px] text-error">{err[name]}</p> : ayuda && <p className="mt-1 text-[11px] text-suave">{ayuda}</p>}
    </div>
  );
  const nro = { type: "number", inputMode: "decimal" as const, step: "0.01" };

  return (
    <form action={accion} className="mt-6 grid gap-6 lg:grid-cols-2">
      <section className="tarjeta space-y-4 p-5">
        <h2 className="font-bold"><i className="fa-solid fa-receipt mr-2 text-naranja" />Datos que salen en el recibo</h2>
        {campo("emisorNombre", "Nombre del socio inscrito", { placeholder: "Nombre como aparece en Hacienda" })}
        {campo("emisorNit", "NIT", { inputMode: "numeric", placeholder: "0000-000000-000-0" })}
        {campo("emisorDireccion", "Dirección", { placeholder: "Lourdes, Colón, La Libertad" })}
        <p className="rounded-lg bg-fondo p-3 text-xs text-suave">Los recibos ya emitidos guardan los datos con los que se hicieron. Pendiente de confirmar con el contador si además hace falta factura electrónica (DTE).</p>
      </section>

      <section className="tarjeta space-y-4 p-5">
        <h2 className="font-bold"><i className="fa-solid fa-building-columns mr-2 text-naranja" />Cuenta para transferencias</h2>
        <p className="text-xs text-suave">El motorista la ve en su app, en Créditos → «¿Cómo recargo?».</p>
        <div className="grid grid-cols-2 gap-3">
          {campo("bancoNombre", "Banco", { placeholder: "Banco Agrícola" })}
          {campo("bancoTipoCuenta", "Tipo de cuenta", { placeholder: "Ahorro" })}
        </div>
        {campo("bancoNumero", "Número de cuenta", { inputMode: "numeric" })}
        {campo("bancoTitular", "Titular")}
      </section>

      <section className="tarjeta space-y-4 p-5 lg:col-span-2">
        <h2 className="font-bold"><i className="fa-solid fa-coins mr-2 text-naranja" />Planes y comisión</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {campo("planSemanal", "Plan semanal ($)", nro)}
          {campo("planMensual", "Plan mensual ($)", nro)}
          {campo("comisionPct", "Comisión por viaje (%)", { ...nro, step: "0.5" }, "Se descuenta del saldo al entregar cada viaje.")}
        </div>
        <p className="text-xs text-suave">Los precios nuevos aplican a las recargas que registres desde ahora; los recibos anteriores no cambian.</p>
      </section>

      <div className="lg:col-span-2">
        {e.ok && <p role="status" className="mb-3 rounded-lg bg-exito/10 px-3 py-2.5 text-sm text-exito">{e.ok}</p>}
        {e.errores && <p role="alert" className="mb-3 rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error">Revisa los campos marcados.</p>}
        <button type="submit" disabled={enviando} className="btn-primario h-12 w-full sm:w-auto sm:px-8">{enviando ? "Guardando…" : "Guardar cambios"}</button>
      </div>
    </form>
  );
}
