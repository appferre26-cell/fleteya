"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { obtenerConfig } from "@/lib/config";
import { exigirMotorista, iniciarSesionMotorista, motoristaActual, VERSION_TERMINOS } from "@/lib/sesion-motorista";
import { centavos, dinero } from "@/lib/tarifa";
import { normalizarTelefono } from "@/lib/validacion";
import { leerCalificacion } from "@/lib/calificaciones";
import { avisarCliente, avisarPedidoNuevo, avisarMotoristas, clavePublicaAvisos, despues, guardarSuscripcion } from "@/lib/avisos";
import { asignar, avanzar, comisionDe, ErrorViaje, puedeRecibir, SIGUIENTE, soltar } from "@/lib/viajes-motorista";

export type Resultado = { error?: string; ok?: boolean; aviso?: string };

// ───── Entrar ─────
const fallos = new Map<string, { n: number; hasta: number }>();

export async function entrarMotorista(_: Resultado & { telefono?: string }, form: FormData): Promise<Resultado & { telefono?: string }> {
  const telefono = normalizarTelefono(String(form.get("telefono") ?? ""));
  const password = String(form.get("password") ?? "");
  if (!telefono || !password) return { error: "Escribe tu teléfono y tu contraseña.", telefono };

  const f = fallos.get(telefono);
  if (f && f.n >= 5 && f.hasta > Date.now()) {
    return { error: `Demasiados intentos. Espera ${Math.ceil((f.hasta - Date.now()) / 60000)} min e inténtalo de nuevo.`, telefono };
  }
  const m = await db.motorista.findUnique({ where: { telefono } });
  if (!m || !(await bcrypt.compare(password, m.passwordHash))) {
    const n = f && f.hasta > Date.now() ? f.n + 1 : 1;
    fallos.set(telefono, { n, hasta: Date.now() + 15 * 60 * 1000 });
    return { error: "Teléfono o contraseña incorrectos.", telefono };
  }
  fallos.delete(telefono);
  await db.motorista.update({ where: { id: m.id }, data: { ultimoAcceso: new Date() } });
  await iniciarSesionMotorista(m.id);
  redirect("/motorista");
}

// ───── Cambiar contraseña (obligatorio la primera vez) ─────
export async function cambiarContrasena(_: Resultado, form: FormData): Promise<Resultado> {
  const m = await motoristaActual();
  if (!m) redirect("/motorista/salir");
  const actual = String(form.get("actual") ?? "");
  const nueva = String(form.get("nueva") ?? "");
  const repetir = String(form.get("repetir") ?? "");
  const fila = await db.motorista.findUniqueOrThrow({ where: { id: m.id } });
  if (!(await bcrypt.compare(actual, fila.passwordHash))) return { error: "La contraseña actual no es correcta." };
  if (nueva.length < 8) return { error: "La nueva contraseña debe tener al menos 8 letras o números." };
  if (nueva !== repetir) return { error: "Las dos contraseñas nuevas no son iguales." };
  if (nueva === actual) return { error: "La nueva contraseña debe ser distinta de la temporal." };
  await db.motorista.update({ where: { id: m.id }, data: { passwordHash: await bcrypt.hash(nueva, 10), debeCambiarPassword: false } });
  redirect("/motorista");
}

// ───── Términos (primer ingreso y cuando cambian) ─────
export async function aceptarTerminos(_: Resultado, form: FormData): Promise<Resultado> {
  const m = await exigirMotorista({ permitirPendientes: true });
  if (form.get("acepto") !== "on") return { error: "Marca la casilla para aceptar y continuar." };
  await db.motorista.update({ where: { id: m.id }, data: { terminosVersion: VERSION_TERMINOS, terminosAceptadosEn: new Date() } });
  redirect("/motorista");
}

// ───── Disponible / no disponible ─────
export async function cambiarDisponible(disponible: boolean): Promise<Resultado> {
  const m = await exigirMotorista();
  if (disponible) {
    const p = puedeRecibir(m);
    if (!p.ok) return { error: p.motivo };
  }
  await db.motorista.update({ where: { id: m.id }, data: { disponible, vistoEn: new Date() } });
  // Al desconectarse, sus ofertas sin respuesta se retiran.
  if (!disponible) await db.ofertaPrecio.updateMany({ where: { motoristaId: m.id, estado: "PENDIENTE" }, data: { estado: "RETIRADA", respondidaEn: new Date() } });
  return { ok: true };
}

function textoError(e: unknown) {
  if (e instanceof ErrorViaje) return e.message;
  console.error(e);
  return "No se pudo completar. Revisa tu internet e inténtalo de nuevo.";
}

/** Aviso cuando la comisión será mayor que los créditos que le quedan. */
function avisoSaldo(saldo: number, comision: number) {
  if (comision <= saldo) return undefined;
  const falta = centavos(comision - saldo);
  return `Te quedan ${dinero(saldo)} en créditos. Este viaje descuenta ${dinero(comision)}. Los ${dinero(falta)} restantes se descontarán de tu siguiente recarga.`;
}

// ───── Solicitudes ─────
export async function aceptarViaje(viajeId: string): Promise<Resultado> {
  const m = await exigirMotorista();
  if (!m.disponible) return { error: "Activa «Disponible» para aceptar viajes." };
  const v = await db.viaje.findUnique({ where: { id: viajeId } });
  if (!v) return { error: "Este viaje ya no existe." };
  try {
    const precio = Number(v.precioBase);
    const { saldo } = await asignar(viajeId, m.id, precio);
    despues(() => avisarCliente(viajeId, { titulo: `¡${m.nombre.split(" ")[0]} aceptó tu flete!`, cuerpo: `Va en ${m.marca} ${m.modelo}, placa ${m.placa}. Precio: ${dinero(precio)} en efectivo.`, urgente: true }));
    return { ok: true, aviso: avisoSaldo(saldo, await comisionDe(precio)) };
  } catch (e) {
    return { error: textoError(e) };
  }
}

export async function rechazarViaje(viajeId: string): Promise<Resultado> {
  const m = await exigirMotorista();
  await db.rechazoViaje.upsert({
    where: { viajeId_motoristaId: { viajeId, motoristaId: m.id } },
    create: { viajeId, motoristaId: m.id },
    update: {},
  });
  await db.ofertaPrecio.updateMany({ where: { viajeId, motoristaId: m.id, estado: "PENDIENTE" }, data: { estado: "RETIRADA", respondidaEn: new Date() } });
  return { ok: true };
}

export async function ofertarPrecio(viajeId: string, precioTexto: string): Promise<Resultado> {
  const m = await exigirMotorista();
  if (!m.disponible) return { error: "Activa «Disponible» para ofrecer precio." };
  const p = puedeRecibir(m);
  if (!p.ok) return { error: p.motivo };
  const precio = centavos(Number(String(precioTexto).replace(/[$,\s]/g, "")));
  const v = await db.viaje.findUnique({ where: { id: viajeId } });
  if (!v || v.estado !== "BUSCANDO") return { error: "Este pedido ya no está disponible." };
  if (!v.fueraDeRango && !(await obtenerConfig()).contraofertaEnRango) return { error: "Este viaje está dentro de los km incluidos: se cobra el precio de la app." };
  if (Number(v.pesoKg) > Number(m.capacidadTon) * 1000) return { error: "Esta carga es más pesada de lo que lleva tu vehículo." };
  const base = Number(v.precioBase);
  if (!Number.isFinite(precio) || precio <= base) return { error: `Tu precio debe ser mayor que ${dinero(base)}. Si te sirve ese precio, toca «Aceptar».` };
  if (precio > 500) return { error: "El precio máximo es $500." };
  const ocupado = await db.viaje.count({ where: { motoristaId: m.id, estado: { in: ["ASIGNADO", "EN_CAMINO", "CARGANDO", "EN_RUTA"] } } });
  if (ocupado) return { error: "Ya tienes un viaje en curso." };

  // Retira cualquier oferta previa sin cerrar (incluida una contraoferta del cliente que aún no respondió) y crea la nueva.
  await db.$transaction([
    db.ofertaPrecio.updateMany({ where: { viajeId, motoristaId: m.id, estado: { in: ["PENDIENTE", "CONTRAOFERTA"] } }, data: { estado: "RETIRADA", respondidaEn: new Date() } }),
    db.ofertaPrecio.create({ data: { viajeId, motoristaId: m.id, precio } }),
  ]);
  despues(() => avisarCliente(viajeId, { titulo: `Un motorista te propone ${dinero(precio)}`, cuerpo: `${m.nombre.split(" ")[0]} · ${m.marca} ${m.modelo}. Abre tu pedido para aceptar o decir «No, gracias».`, urgente: true }));
  return { ok: true };
}

export async function retirarOferta(viajeId: string): Promise<Resultado> {
  const m = await exigirMotorista();
  await db.ofertaPrecio.updateMany({ where: { viajeId, motoristaId: m.id, estado: "PENDIENTE" }, data: { estado: "RETIRADA", respondidaEn: new Date() } });
  return { ok: true };
}

/** El motorista acepta la contraoferta del cliente: el viaje queda asignado a ESE precio. */
export async function aceptarContraoferta(viajeId: string): Promise<Resultado> {
  const m = await exigirMotorista();
  if (!m.disponible) return { error: "Activa «Disponible» para aceptar." };
  const p = puedeRecibir(m);
  if (!p.ok) return { error: p.motivo };
  const o = await db.ofertaPrecio.findFirst({ where: { viajeId, motoristaId: m.id, estado: "CONTRAOFERTA" } });
  if (!o || o.contraPrecio == null) return { error: "Esta propuesta ya cambió. Actualiza la pantalla." };
  const precio = Number(o.contraPrecio);
  // Deja la oferta como PENDIENTE para que asignar() la marque ACEPTADA dentro de su transacción.
  const listo = await db.ofertaPrecio.updateMany({ where: { id: o.id, estado: "CONTRAOFERTA" }, data: { estado: "PENDIENTE", precio } });
  if (listo.count === 0) return { error: "Esta propuesta ya cambió. Actualiza la pantalla." };
  try {
    const { saldo } = await asignar(viajeId, m.id, precio, o.id);
    despues(() => avisarCliente(viajeId, { titulo: `¡${m.nombre.split(" ")[0]} aceptó tu precio!`, cuerpo: `Va en ${m.marca} ${m.modelo}, placa ${m.placa}. Precio: ${dinero(precio)} en efectivo.`, urgente: true }));
    return { ok: true, aviso: avisoSaldo(saldo, await comisionDe(precio)) };
  } catch (e) {
    // No se pudo asignar: deja la contraoferta como estaba para que el motorista pueda reintentar.
    await db.ofertaPrecio.updateMany({ where: { id: o.id, estado: "PENDIENTE" }, data: { estado: "CONTRAOFERTA" } });
    return { error: textoError(e) };
  }
}

/** El motorista no acepta el precio del cliente: la contraoferta se cierra y queda libre para ofrecer otro. */
export async function rechazarContraoferta(viajeId: string): Promise<Resultado> {
  const m = await exigirMotorista();
  const o = await db.ofertaPrecio.findFirst({ where: { viajeId, motoristaId: m.id, estado: "CONTRAOFERTA" } });
  const r = await db.ofertaPrecio.updateMany({ where: { viajeId, motoristaId: m.id, estado: "CONTRAOFERTA" }, data: { estado: "RETIRADA", respondidaEn: new Date() } });
  if (r.count === 0) return { error: "Esta propuesta ya cambió. Actualiza la pantalla." };
  if (o) despues(() => avisarCliente(viajeId, { titulo: "El motorista no aceptó tu precio", cuerpo: `Tu propuesta de ${dinero(Number(o.contraPrecio ?? 0))} no fue aceptada. Puedes aceptar el precio de la app o esperar otra oferta.` }));
  return { ok: true };
}

// ───── Viaje en curso ─────
const AVISO_PASO = {
  EN_CAMINO: { titulo: "Tu motorista va en camino", cuerpo: "Va hacia el punto de recogida. Puedes ver su ubicación en tu pedido." },
  CARGANDO: { titulo: "Tu motorista llegó", cuerpo: "Ya está en el punto de recogida cargando tu material.", urgente: true },
  EN_RUTA: { titulo: "Tu carga va en camino", cuerpo: "El motorista salió hacia el destino." },
  ENTREGADO: { titulo: "¡Entregado!", cuerpo: "Tu material llegó. Cuéntanos qué tal te fue con el motorista." },
} as const;
export async function avanzarViaje(viajeId: string, desde: string): Promise<Resultado & { comision?: number }> {
  const m = await exigirMotorista();
  if (!(desde in SIGUIENTE)) return { error: "Paso no válido." };
  try {
    const r = await avanzar(viajeId, m.id, desde as keyof typeof SIGUIENTE);
    const aviso = AVISO_PASO[r.estado as keyof typeof AVISO_PASO];
    if (aviso) despues(() => avisarCliente(viajeId, aviso));
    if (r.estado === "ENTREGADO" && "comision" in r) {
      const negativo = (r.saldoDespues ?? 0) < 0;
      return {
        ok: true, comision: r.comision,
        aviso: negativo
          ? `Se descontaron ${dinero(r.comision!)} de tus créditos. Tu saldo quedó en ${dinero(r.saldoDespues!)}: recarga para seguir recibiendo viajes.`
          : `Se descontaron ${dinero(r.comision!)} de tus créditos. Te quedan ${dinero(r.saldoDespues!)}.`,
      };
    }
    return { ok: true };
  } catch (e) {
    return { error: textoError(e) };
  }
}

export async function soltarViaje(viajeId: string): Promise<Resultado> {
  const m = await exigirMotorista();
  try {
    await soltar(viajeId, m.id);
    despues(async () => {
      await avisarCliente(viajeId, { titulo: "Tu motorista no pudo continuar", cuerpo: "Ya estamos buscando otro motorista para tu pedido. No tienes que hacer nada." });
      await avisarPedidoNuevo(viajeId, m.id);
    });
    return { ok: true };
  } catch (e) {
    return { error: textoError(e) };
  }
}


// ───── Parte 6: calificar al cliente al terminar ─────
export async function calificarCliente(viajeId: string, estrellas: number | null, comentario = ""): Promise<Resultado> {
  const m = await exigirMotorista({ permitirPendientes: true });
  let datos: { estrellasCliente: number | null; comentarioCliente: string | null } = { estrellasCliente: null, comentarioCliente: null };
  if (estrellas !== null) {
    const c = leerCalificacion(estrellas, comentario);
    if ("error" in c) return { error: c.error };
    datos = { estrellasCliente: c.estrellas, comentarioCliente: c.comentario };
  }
  const r = await db.viaje.updateMany({
    where: { id: viajeId, motoristaId: m.id, estado: "ENTREGADO", clienteCalificadoEn: null },
    data: { ...datos, clienteCalificadoEn: new Date() },
  });
  if (r.count === 0) return { error: "Este viaje ya fue calificado." };
  return { ok: true };
}

// ───── Parte 8: avisos con la app cerrada ─────
export async function suscribirAvisos(sub: unknown): Promise<Resultado> {
  const m = await exigirMotorista({ permitirPendientes: true });
  if (!clavePublicaAvisos()) return { error: "Los avisos no están activados en el servidor." };
  return (await guardarSuscripcion(sub, { motoristaId: m.id })) ? { ok: true } : { error: "No se pudo activar en este teléfono." };
}

export async function quitarAvisos(endpoint: string): Promise<Resultado> {
  const m = await exigirMotorista({ permitirPendientes: true });
  await db.suscripcionAviso.deleteMany({ where: { endpoint: String(endpoint).slice(0, 800), motoristaId: m.id } });
  return { ok: true };
}

export async function probarAviso(): Promise<Resultado> {
  const m = await exigirMotorista({ permitirPendientes: true });
  const n = await avisarMotoristas([m.id], { titulo: "FleteYa · aviso de prueba", cuerpo: "¡Listo! Así te avisaremos de pedidos nuevos aunque la app esté cerrada.", url: "/motorista/perfil", tag: "fleteya-prueba" });
  return n > 0 ? { ok: true } : { error: "No se pudo enviar. Desactiva y vuelve a activar los avisos." };
}
