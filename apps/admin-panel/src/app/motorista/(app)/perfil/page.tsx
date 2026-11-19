import Link from "next/link";
import { obtenerConfig } from "@/lib/config";
import { clavePublicaAvisos } from "@/lib/avisos";
import { BotonAvisos } from "@/components/BotonAvisos";
import { db } from "@/lib/db";
import { promedioMotorista } from "@/lib/calificaciones";
import { EstrellasFijas, Promedio } from "@/components/Estrellas";
import { exigirMotorista, VERSION_TERMINOS } from "@/lib/sesion-motorista";
import { ESTADOS, TIPOS_VEHICULO, diasParaVencer, fechaCorta, fechaHora, formatoTelefono } from "@/lib/validacion";
import { FormFotoPerfil } from "./FormFotoPerfil";

export const metadata = { title: "Perfil — FleteYa Motorista" };

export default async function PerfilMotorista() {
  const m = await exigirMotorista();
  const cfg = await obtenerConfig();
  const [calif, comentarios, foto] = await Promise.all([
    promedioMotorista(m.id),
    db.viaje.findMany({ where: { motoristaId: m.id, comentarioMotorista: { not: null } }, orderBy: { motoristaCalificadoEn: "desc" }, take: 3, select: { id: true, estrellasMotorista: true, comentarioMotorista: true } }),
    db.documento.findUnique({ where: { motoristaId_tipo: { motoristaId: m.id, tipo: "FOTO_PERFIL" } }, select: { subidoEn: true } }),
  ]);
  // Rompe la caché pública (max-age=300) para que el motorista vea su foto recién cambiada.
  const fotoSrc = foto ? `/motorista/foto/${m.id}?v=${foto.subidoEn.getTime()}` : "";
  const dias = diasParaVencer(m.licenciaVence);
  const filas: [string, string][] = [
    ["Teléfono", formatoTelefono(m.telefono)],
    ["DUI", m.dui],
    ["Licencia", `${m.licenciaNumero} · vence ${fechaCorta(m.licenciaVence)}`],
    ["Vehículo", `${m.marca} ${m.modelo} · ${m.placa}`],
    ["Tipo", `${TIPOS_VEHICULO[m.tipoVehiculo].nombre} · ${Number(m.capacidadTon)} ton`],
  ];
  if (m.correo) filas.splice(1, 0, ["Correo", m.correo]);

  return (
    <main className="px-5 pt-6 pb-6">
      <h1 className="text-2xl font-extrabold">Mi perfil</h1>
      <div className="mt-4 flex items-center gap-3">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fotoSrc} alt={`Foto de ${m.nombre}`} className="h-14 w-14 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-tarjeta-2 text-lg font-bold"><i className="fa-solid fa-user text-suave" /></span>
        )}
        <div><p className="text-lg font-bold">{m.nombre}</p><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTADOS[m.estado].clase}`}>{ESTADOS[m.estado].nombre}</span></div>
      </div>

      {!foto && (
        <div role="alert" className="mt-4 flex items-start gap-3 rounded-xl border border-naranja/50 bg-naranja/10 px-4 py-3 text-sm text-naranja">
          <i className="fa-solid fa-triangle-exclamation mt-0.5" />
          <p><span className="font-semibold">Tu foto de perfil es obligatoria.</span> La ven los clientes para saber quién les atenderá. Súbela abajo para completar tu perfil.</p>
        </div>
      )}

      <FormFotoPerfil tieneFoto={!!foto} src={fotoSrc} />

      <section className="tarjeta mt-4 p-4 text-sm" data-testid="mi-calificacion">
        <p className="text-[11px] font-semibold tracking-wider text-suave uppercase">Mi calificación</p>
        <p className="mt-1 text-lg"><Promedio {...calif} /></p>
        {comentarios.length > 0 && (
          <ul className="mt-3 space-y-2 border-t border-borde pt-3">
            {comentarios.map((c) => (
              <li key={c.id}><EstrellasFijas n={c.estrellasMotorista!} /> <span className="text-suave">«{c.comentarioMotorista}»</span></li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-4">
        <BotonAvisos clave={clavePublicaAvisos()} modo="motorista" titulo="Avisos con la app cerrada"
          ayuda="Pedidos nuevos, respuestas de clientes, cancelaciones y recargas te llegan como notificación." />
      </div>

      {dias <= 30 && (
        <p className={`mt-4 rounded-lg px-3 py-2.5 text-sm ${dias < 0 ? "bg-error/10 text-error" : "bg-naranja/10 text-naranja"}`}>
          <i className="fa-solid fa-id-card mr-2" />{dias < 0 ? "Tu licencia está vencida: no puedes recibir viajes." : `Tu licencia vence en ${dias} días. Renuévala a tiempo.`}
        </p>
      )}

      <dl className="tarjeta mt-4 divide-y divide-borde text-sm">
        {filas.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 p-3.5"><dt className="text-suave">{k}</dt><dd className="text-right font-medium break-words">{v}</dd></div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-suave">Para cambiar estos datos o actualizar un documento, comunícate con FleteYa.</p>

      <div className="mt-5 space-y-2">
        <Link href="/motorista/contrasena" className="btn-secundario w-full justify-start rounded-xl"><i className="fa-solid fa-key w-5 text-suave" />Cambiar contraseña</Link>
        <Link href="/motorista/legal/terminos" className="btn-secundario w-full justify-start rounded-xl"><i className="fa-solid fa-file-lines w-5 text-suave" />Términos para motoristas</Link>
        <Link href="/motorista/legal/privacidad" className="btn-secundario w-full justify-start rounded-xl"><i className="fa-solid fa-user-shield w-5 text-suave" />Aviso de privacidad</Link>
        {cfg.whatsappAyuda && (
          <a href={`https://wa.me/503${cfg.whatsappAyuda}`} target="_blank" rel="noopener" className="btn-secundario w-full justify-start rounded-xl"><i className="fa-brands fa-whatsapp w-5 text-exito" />Ayuda por WhatsApp</a>
        )}
        <a href="/motorista/salir" className="btn-secundario w-full justify-start rounded-xl text-error"><i className="fa-solid fa-right-from-bracket w-5" />Cerrar sesión</a>
      </div>
      <p className="mt-4 text-center text-[11px] text-suave">Términos versión {VERSION_TERMINOS}{m.terminosAceptadosEn ? ` aceptados el ${fechaHora(m.terminosAceptadosEn)}` : ""}</p>
    </main>
  );
}
