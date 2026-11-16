import { db } from "@/lib/db";
import { exigirPropietario } from "@/lib/sesion";
import { fechaHora } from "@/lib/validacion";
import { AgregarPropietario, BotonesPropietario, CambiarContrasena } from "./Formularios";

export const metadata = { title: "Administradores — FleteYa" };

export default async function Administradores() {
  const yo = await exigirPropietario();
  const lista = await db.propietario.findMany({ orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    select: { id: true, nombre: true, correo: true, activo: true, ultimoAcceso: true } });

  return (
    <>
      <h1 className="text-[26px] leading-tight font-extrabold lg:text-[28px]">Administradores</h1>
      <p className="mt-1 text-sm text-suave">Cuentas de propietarios. Son distintas a las de los motoristas y no hay registro público.</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="tarjeta overflow-hidden lg:col-span-2">
          <ul className="divide-y divide-borde">
            {lista.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.nombre}{p.id === yo.id && <span className="ml-2 rounded bg-naranja/15 px-1.5 py-0.5 text-[10px] font-bold text-naranja uppercase">Tú</span>}
                    {!p.activo && <span className="ml-2 rounded bg-error/15 px-1.5 py-0.5 text-[10px] font-bold text-error uppercase">Desactivada</span>}</p>
                  <p className="truncate text-xs text-suave">{p.correo} · {p.ultimoAcceso ? `último acceso ${fechaHora(p.ultimoAcceso)}` : "aún no ha entrado"}</p>
                </div>
                {p.id !== yo.id && <BotonesPropietario id={p.id} nombre={p.nombre} activo={p.activo} />}
              </li>
            ))}
          </ul>
        </section>
        <div className="space-y-4">
          <AgregarPropietario />
          <CambiarContrasena />
        </div>
      </div>
    </>
  );
}
