"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { exigirMotorista, iniciarSesionMotorista, motoristaActual, VERSION_TERMINOS } from "@/lib/sesion-motorista";
import { centavos, dinero } from "@/lib/tarifa";
import { normalizarTelefono } from "@/lib/validacion";
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
  if (!v.fueraDeRango) return { error: "Este viaje está dentro de los km incluidos: se cobra el precio de la app." };
  if (Number(v.pesoKg) > Number(m.capacidadTon) * 1000) return { error: "Esta carga es más pesada de lo que lleva tu vehículo." };
  const base = Number(v.precioBase);
  if (!Number.isFinite(precio) || precio < base) return { error: `El precio no puede ser menor que ${dinero(base)} (el precio por peso).` };
  if (precio > 500) return { error: "El precio máximo es $500." };
  const ocupado = await db.viaje.count({ where: { motoristaId: m.id, estado: { in: ["ASIGNADO", "EN_CAMINO", "CARGANDO", "EN_RUTA"] } } });
  if (ocupado) return { error: "Ya tienes un viaje en curso." };

  await db.$transaction([
    db.ofertaPrecio.updateMany({ where: { viajeId, motoristaId: m.id, estado: "PENDIENTE" }, data: { estado: "RETIRADA", respondidaEn: new Date() } }),
    db.ofertaPrecio.create({ data: { viajeId, motoristaId: m.id, precio } }),
  ]);
  return { ok: true };
}

export async function retirarOferta(viajeId: string): Promise<Resultado> {
  const m = await exigirMotorista();
  await db.ofertaPrecio.updateMany({ where: { viajeId, motoristaId: m.id, estado: "PENDIENTE" }, data: { estado: "RETIRADA", respondidaEn: new Date() } });
  return { ok: true };
}

// ───── Viaje en curso ─────
export async function avanzarViaje(viajeId: string, desde: string): Promise<Resultado & { comision?: number }> {
  const m = await exigirMotorista();
  if (!(desde in SIGUIENTE)) return { error: "Paso no válido." };
  try {
    const r = await avanzar(viajeId, m.id, desde as keyof typeof SIGUIENTE);
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
    return { ok: true };
  } catch (e) {
    return { error: textoError(e) };
  }
}
