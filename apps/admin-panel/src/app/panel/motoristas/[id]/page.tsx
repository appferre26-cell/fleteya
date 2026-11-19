import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { dinero, numeroViaje } from "@/lib/tarifa";
import { textoAccion } from "@/lib/historial";
import { exigirPropietario } from "@/lib/sesion";
import { DOCUMENTOS, GRUPOS_DOC, TIPOS_VEHICULO, TOTAL_DOCS, diasParaVencer, fechaCorta, fechaHora, formatoTelefono } from "@/lib/validacion";
import { Estado, Iniciales } from "../piezas";
import { AccionesMotorista } from "./AccionesMotorista";
import { PagoAcceso } from "./PagoAcceso";
import { obtenerConfig } from "@/lib/config";
import { promedioMotorista } from "@/lib/calificaciones";
import { EstrellasFijas, Promedio } from "@/components/Estrellas";

export const metadata = { title: "Motorista — FleteYa" };

export default async function DetalleMotorista({ params }: { params: Promise<{ id: string }> }) {
  await exigirPropietario();
  const { id } = await params;
  const m = await db.motorista.findUnique({
    where: { id },
    include: {
      documentos: { select: { id: true, tipo: true, mime: true, subidoEn: true } },
      creadoPor: { select: { nombre: true } },
      aprobadoPor: { select: { nombre: true } },
      historial: { orderBy: { fecha: "desc" }, take: 20, include: { propietario: { select: { nombre: true } } } },
    },
  });
  if (!m) notFound();
  const [entregados, movimientos, enCurso, calif, opiniones, cfg, reciboAcceso] = await Promise.all([
    db.viaje.aggregate({ where: { motoristaId: m.id, estado: "ENTREGADO" }, _count: true, _sum: { comision: true } }),
    db.movimientoCredito.findMany({ where: { motoristaId: m.id }, orderBy: { creadoEn: "desc" }, take: 8, include: { recarga: { select: { numero: true } } } }),
    db.viaje.findFirst({ where: { motoristaId: m.id, estado: { in: ["ASIGNADO", "EN_CAMINO", "CARGANDO", "EN_RUTA"] } }, select: { id: true, numero: true } }),
    promedioMotorista(m.id),
    db.viaje.findMany({ where: { motoristaId: m.id, estrellasMotorista: { not: null } }, orderBy: { motoristaCalificadoEn: "desc" }, take: 6, select: { id: true, numero: true, clienteNombre: true, estrellasMotorista: true, comentarioMotorista: true, motoristaCalificadoEn: true } }),
    obtenerConfig(),
    db.recarga.findFirst({ where: { motoristaId: id, concepto: "ACCESO", anuladaEn: null }, orderBy: { creadoEn: "desc" }, select: { numero: true } }),
  ]);
  const saldo = Number(m.saldoCreditos);
  const enLinea = m.disponible && m.vistoEn && Date.now() - m.vistoEn.getTime() < 2 * 60_000;
  // La foto de perfil es opcional y no cuenta como documento obligatorio.
  const docsObligatorios = m.documentos.filter((d) => d.tipo !== "FOTO_PERFIL");
  const tieneFoto = m.documentos.some((d) => d.tipo === "FOTO_PERFIL");

  const venc = diasParaVencer(m.licenciaVence);
  const dato = (t: string, v: React.ReactNode) => (
    <div><dt className="text-xs text-suave">{t}</dt><dd className="mt-0.5 font-semibold">{v}</dd></div>
  );

  return (
    <>
      <Link href="/panel/motoristas" className="text-xs text-suave hover:text-texto"><i className="fa-solid fa-arrow-left mr-1.5" />Motoristas</Link>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        {tieneFoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/motorista/foto/${m.id}`} alt={`Foto de ${m.nombre}`} className="h-14 w-14 shrink-0 rounded-full object-cover" />
        ) : (
          <Iniciales nombre={m.nombre} pendiente={m.estado === "PENDIENTE"} grande />
        )}
        <div className="min-w-[12rem] flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[24px] leading-tight font-extrabold lg:text-[28px]">{m.nombre}</h1>
            <Estado estado={m.estado} />
          </div>
          <p className="mt-1 text-sm text-suave">Registrado el {fechaCorta(m.creadoEn)} {m.creadoPor ? `por ${m.creadoPor.nombre}` : "por él mismo desde la app"}
            {m.aprobadoEn && m.aprobadoPor ? ` · aprobado el ${fechaCorta(m.aprobadoEn)} por ${m.aprobadoPor.nombre}` : ""}</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto [&>a]:flex-1 sm:[&>a]:flex-none">
          <a href={`tel:+503${m.telefono}`} className="btn-secundario h-10"><i className="fa-solid fa-phone text-suave" />Llamar</a>
          <a href={`https://wa.me/503${m.telefono}`} target="_blank" rel="noopener noreferrer" className="btn-secundario h-10"><i className="fa-brands fa-whatsapp text-exito" />WhatsApp</a>
        </div>
      </div>

      {m.estado === "SUSPENDIDO" && m.motivoSuspension && (
        <p className="mt-4 rounded-lg bg-error/10 px-4 py-3 text-sm text-error"><i className="fa-solid fa-ban mr-2" />Motivo de la suspensión: <span className="text-texto">{m.motivoSuspension}</span></p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="tarjeta p-5">
            <div className="flex items-center justify-between">
              <h2 className="seccion-titulo">Datos</h2>
              <Link href={`/panel/motoristas/${m.id}/editar`} className="text-xs font-semibold text-naranja"><i className="fa-solid fa-pen mr-1" />Editar datos</Link>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              {dato("Celular / usuario", <span className="tabular-nums">{formatoTelefono(m.telefono)}</span>)}
              {dato("DUI", <span className="tabular-nums">{m.dui}</span>)}
              {dato("Correo", m.correo ?? <span className="font-normal text-suave">No dio correo</span>)}
              {dato("Licencia", m.licenciaNumero)}
              {dato("Licencia vence", (
                <span className={venc < 0 ? "text-error" : venc <= 30 ? "text-naranja" : ""}>
                  {fechaCorta(m.licenciaVence)}{venc < 0 ? " (vencida)" : venc <= 30 ? ` (en ${venc} días)` : ""}
                </span>
              ))}
              {dato("Vehículo", `${TIPOS_VEHICULO[m.tipoVehiculo].nombre} · ${m.capacidadTon.toString()} ton`)}
              {dato("Marca y modelo", `${m.marca} ${m.modelo}`)}
              {dato("Placa", m.placa)}
            </dl>
            <div className="mt-4 border-t border-borde pt-3 text-sm" data-testid="datos-fiscales">
              {m.requiereCreditoFiscal ? (
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {dato("Factura", "Crédito fiscal (CCF)")}
                  {dato("NIT", <span className="tabular-nums">{m.nit}</span>)}
                  {dato("NRC", <span className="tabular-nums">{m.nrc}</span>)}
                  {dato("Razón social", m.razonSocial)}
                  {dato("Giro", m.giro)}
                  {dato("Dirección fiscal", m.direccionFiscal)}
                </dl>
              ) : <p className="text-xs text-suave"><i className="fa-solid fa-file-invoice mr-1.5" />Factura como consumidor final (no pidió crédito fiscal).</p>}
            </div>
          </section>

          <section className="tarjeta p-5">
            <h2 className="seccion-titulo">Fotos y documentos ({docsObligatorios.length}/{TOTAL_DOCS})</h2>
            {GRUPOS_DOC.map((g) => (
            <div key={g.titulo} className="mt-4">
            <p className="text-xs font-semibold text-suave uppercase">{g.titulo}</p>
            <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {g.tipos.map((t) => {
                const d = m.documentos.find((x) => x.tipo === t);
                return (
                  <div key={t}>
                    <p className="etiqueta">{DOCUMENTOS[t]}</p>
                    {d ? (
                      <a href={`/api/documentos/${d.id}`} target="_blank" rel="noopener noreferrer"
                        className="block h-36 overflow-hidden rounded-xl border border-borde bg-fondo hover:border-naranja">
                        {d.mime.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`/api/documentos/${d.id}`} alt={DOCUMENTOS[t]} className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full flex-col items-center justify-center gap-2 text-xs text-suave"><i className="fa-solid fa-file-pdf text-2xl text-naranja" />Abrir PDF</span>
                        )}
                      </a>
                    ) : (
                      <Link href={`/panel/motoristas/${m.id}/editar`} className="flex h-36 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-naranja/50 bg-fondo text-xs text-naranja">
                        <i className="fa-solid fa-camera text-xl" />Falta · subir foto
                      </Link>
                    )}
                    {d && <p className="mt-1 text-[11px] text-suave">Subido el {fechaCorta(d.subidoEn)} · toca para ampliar</p>}
                  </div>
                );
              })}
            </div>
            </div>
            ))}
          </section>

          <section className="tarjeta p-5" data-testid="app-motorista">
            <h2 className="seccion-titulo">App y créditos</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              {dato("Saldo de créditos", <span className={`tabular-nums ${saldo <= 0 ? "text-error" : ""}`} data-testid="saldo-motorista">{dinero(saldo)}</span>)}
              {dato("Ahora", enCurso ? <Link href={`/panel/viajes/${enCurso.id}`} className="text-naranja">En viaje {numeroViaje(enCurso.numero)}</Link> : enLinea ? <span className="text-exito">Disponible</span> : <span className="font-normal text-suave">Desconectado</span>)}
              {dato("Viajes entregados", <span className="tabular-nums">{entregados._count} · comisión {dinero(Number(entregados._sum.comision ?? 0))}</span>)}
              {dato("Último ingreso a la app", m.ultimoAcceso ? fechaHora(m.ultimoAcceso) : <span className="font-normal text-suave">Nunca</span>)}
            </dl>
            <p className="mt-3 text-xs text-suave">
              {m.terminosAceptadosEn ? `Aceptó los Términos para Motoristas (v${m.terminosVersion}) el ${fechaHora(m.terminosAceptadosEn)}` : "Aún no acepta los Términos para Motoristas (se le piden al entrar por primera vez)."}
            </p>
            {m.estado !== "SUSPENDIDO" && (
              <Link href={`/panel/creditos?m=${m.id}#registrar`} className="btn-primario mt-3 h-10 w-full sm:w-auto sm:px-5" data-testid="registrar-recarga">
                <i className="fa-solid fa-plus" />Registrar recarga
              </Link>
            )}
            {movimientos.length > 0 && (
              <ul className="mt-3 divide-y divide-borde border-t border-borde text-sm">
                {movimientos.map((x) => (
                  <li key={x.id} className="flex justify-between gap-3 py-2">
                    <span>{x.tipo === "COMISION" ? "Comisión" : x.tipo === "RECARGA" ? "Recarga" : "Ajuste"} <span className="text-suave">· {x.recarga ? <Link href={`/panel/creditos/recibo/${x.recarga.numero}`} className="text-naranja hover:underline">{x.detalle}</Link> : x.detalle} · {fechaHora(x.creadoEn)}</span></span>
                    <span className={`tabular-nums ${Number(x.monto) < 0 ? "text-error" : "text-exito"}`}>{Number(x.monto) < 0 ? "-" : "+"}{dinero(Math.abs(Number(x.monto)))}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="tarjeta p-5" data-testid="calificacion-motorista">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="seccion-titulo">Calificación de los clientes</h2>
              <span className="text-sm"><Promedio {...calif} /></span>
            </div>
            {opiniones.length > 0 ? (
              <ul className="mt-3 divide-y divide-borde text-sm">
                {opiniones.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2">
                    <span><EstrellasFijas n={o.estrellasMotorista!} /> <span className="text-suave">{o.clienteNombre}{o.comentarioMotorista ? ` — «${o.comentarioMotorista}»` : ""}</span></span>
                    <Link href={`/panel/viajes/${o.id}`} className="text-xs text-naranja">{numeroViaje(o.numero)} · {fechaCorta(o.motoristaCalificadoEn!)}</Link>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-suave">Los clientes califican al motorista al terminar cada viaje.</p>}
          </section>

          <section className="tarjeta p-5">
            <h2 className="seccion-titulo">Historial</h2>
            <ul className="mt-3 divide-y divide-borde text-sm">
              {m.historial.map((h) => (
                <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5">
                  <span><span className="font-semibold">{textoAccion(h.accion).replace(/^./, (c) => c.toUpperCase())}</span> <span className="text-suave">por {h.propietario ? h.propietario.nombre : "el motorista"}{h.detalle && h.accion !== "DOCUMENTO_ACTUALIZADO" ? ` — ${h.detalle}` : ""}{h.accion === "DOCUMENTO_ACTUALIZADO" && h.detalle ? ` — ${DOCUMENTOS[h.detalle as keyof typeof DOCUMENTOS] ?? h.detalle}` : ""}</span></span>
                  <span className="text-xs text-suave">{fechaHora(h.fecha)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <AccionesMotorista id={m.id} nombre={m.nombre} telefono={m.telefono} estado={m.estado} documentos={docsObligatorios.length} licenciaVencida={venc < 0} accesoPagado={!!m.accesoPagadoEn}>
          <PagoAcceso id={m.id} precio={cfg.precioAcceso} pagado={m.accesoPagadoEn ? fechaCorta(m.accesoPagadoEn) : null} recibo={reciboAcceso?.numero ?? null}
            avisoReferencia={m.accesoReferencia} avisoFecha={m.accesoAvisadoEn ? fechaHora(m.accesoAvisadoEn) : null} />
        </AccionesMotorista>
      </div>
    </>
  );
}
