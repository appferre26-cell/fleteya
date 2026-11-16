// Capturas de la Parte 3 (app del motorista, lo que ve el cliente y el panel) en celular.
// Crea un motorista y viajes de prueba directo en la base.
// Uso: CAPTURAS=carpeta E2E_CORREO=... E2E_PASSWORD=... node tests/capturas-motorista.mjs
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const B = process.env.E2E_URL ?? "http://localhost:3000", D = process.env.CAPTURAS ?? "capturas";
const db = new PrismaClient();
const br = await chromium.launch();
const errores = [];
const azar = (n) => String(Math.floor(Math.random() * 10 ** n)).padStart(n, "0");
const L = { lat: 13.725, lng: -89.37 };
const opc = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "es-SV", timezoneId: "America/El_Salvador", geolocation: { latitude: 13.722, longitude: -89.368 }, permissions: ["geolocation"] };

async function pagina() {
  const ctx = await br.newContext(opc);
  const p = await ctx.newPage();
  p.on("console", (m) => m.type() === "error" && !/tile\.openstreetmap|play\(\)|NotAllowedError/.test(m.text()) && errores.push(m.text()));
  return p;
}
async function foto(p, nombre, completa = true) {
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${D}/${nombre}.png`, fullPage: completa });
  const w = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (w > 0) errores.push(`${nombre}: desborde horizontal ${w}px`);
}
let n = 0;
const viaje = (o = {}) => db.viaje.create({
  data: {
    codigo: `cap${Date.now()}${++n}`, clienteNombre: o.cliente ?? "María Hernández", clienteTelefono: `7${azar(7)}`,
    origenDireccion: o.origen ?? "Ferretería El Constructor, Lourdes", origenLat: L.lat, origenLng: L.lng,
    destinoDireccion: o.lejos ? "Santa Tecla, Paseo El Carmen" : "Col. Las Moras, pasaje 4, casa 12",
    destinoLat: o.lejos ? 13.676 : 13.73, destinoLng: o.lejos ? -89.28 : -89.36, distanciaKm: o.lejos ? 11.2 : 1.8,
    pesoKg: o.peso ?? 850, precioBase: o.precio ?? 12, fueraDeRango: !!o.lejos, aceptoTerminosEn: new Date(),
    items: { create: [{ nombre: "Bolsa de cemento", unidad: "Bolsa", cantidad: 20, pesoUnitKg: 42.5, pesoTotalKg: o.peso ?? 850 }] },
  },
});
const limpiar = async () => {
  await db.viaje.updateMany({ where: { estado: { in: ["BUSCANDO", "ASIGNADO", "EN_CAMINO", "CARGANDO", "EN_RUTA"] } }, data: { estado: "CANCELADO", canceladoPor: "PROPIETARIO", motivoCancelacion: "Limpieza de capturas", canceladoEn: new Date() } });
  await db.motorista.updateMany({ where: { disponible: true }, data: { disponible: false } });
};

await limpiar();
const prop = await db.propietario.findUniqueOrThrow({ where: { correo: process.env.E2E_CORREO } });
const telefono = `7${azar(7)}`;
const m = await db.motorista.create({
  data: {
    nombre: "José Antonio Ramírez", telefono, passwordHash: await bcrypt.hash("TMP-1234", 10), debeCambiarPassword: true,
    dui: `${azar(8)}-${azar(1)}`, licenciaNumero: azar(10), licenciaVence: new Date("2030-01-01"), placa: `P ${azar(6)}`,
    marca: "Toyota", modelo: "Hilux", tipoVehiculo: "PICKUP", capacidadTon: 1.5, estado: "ACTIVO", creadoPorId: prop.id, saldoCreditos: 20,
  },
});

// Primer ingreso
const a = await pagina();
await a.goto(B + "/motorista/entrar");
await a.getByLabel("Número de teléfono").fill(`${telefono.slice(0, 4)}-${telefono.slice(4)}`);
await a.getByLabel("Contraseña", { exact: true }).fill("TMP-1234");
await foto(a, "p3-01-entrar");
await a.getByRole("button", { name: /Entrar/ }).click();
await a.waitForURL(/contrasena$/);
await foto(a, "p3-02-cambiar-contrasena");
await a.getByLabel("Contraseña temporal").fill("TMP-1234");
await a.getByLabel("Nueva contraseña (mínimo 8)").fill("clave-segura-1");
await a.getByLabel("Repite la nueva contraseña").fill("clave-segura-1");
await a.getByRole("button", { name: "Guardar contraseña" }).click();
await a.waitForURL(/terminos$/);
await foto(a, "p3-03-terminos", false);
await a.getByLabel(/He leído y acepto/).check();
await a.getByRole("button", { name: /Aceptar y continuar/ }).click();
await a.waitForURL(/\/motorista$/);
await foto(a, "p3-04-inicio-desconectado");

// Disponible + solicitud
await a.getByTestId("disponible").click();
await a.waitForSelector('[data-testid=disponible][aria-checked=true]');
await foto(a, "p3-05-inicio-en-linea");
const v = await viaje();
await a.getByTestId("alerta").waitFor({ timeout: 15000 });
await foto(a, "p3-06-alerta-solicitud", false);
await a.getByTestId("alerta").getByRole("button", { name: "Ver después" }).click();
const lejos = await viaje({ lejos: true, precio: 10, origen: "Ferretería La Económica, Lourdes", cliente: "Pedro Martínez" });
await a.getByTestId("alerta").waitFor({ timeout: 15000 });
await a.getByTestId("alerta").getByRole("button", { name: "Ver después" }).click();
const tl = a.getByTestId("solicitud").filter({ hasText: lejos.origenDireccion });
await tl.getByRole("button", { name: /Ofrecer otro precio/ }).click();
await tl.getByLabel("Tu precio en dólares").fill("18");
await tl.getByRole("button", { name: "Enviar" }).click();
await a.getByTestId("oferta-pendiente").waitFor();
await foto(a, "p3-07-lista-solicitudes-y-oferta");

// Lo que ve el cliente del viaje lejano
const c = await pagina();
await c.goto(`${B}/viaje/${lejos.codigo}`);
await c.getByTestId("oferta").waitFor();
await foto(c, "p3-08-cliente-oferta");
await c.getByTestId("oferta").getByRole("button", { name: "No, gracias" }).click();
await c.getByTestId("ofertas").waitFor({ state: "detached" });

// Acepta el primero
await a.getByTestId("solicitud").filter({ hasText: v.origenDireccion }).getByRole("button", { name: "ACEPTAR" }).click();
await a.getByTestId("viaje-activo").waitFor();
await a.getByTestId("avanzar").filter({ hasText: "Voy en camino" }).click();
await a.getByTestId("avanzar").filter({ hasText: "Ya llegué" }).waitFor();
await db.motorista.update({ where: { id: m.id }, data: { lat: 13.722, lng: -89.368, ubicacionEn: new Date() } });
await foto(a, "p3-09-viaje-activo");
await c.goto(`${B}/viaje/${v.codigo}`);
await c.getByTestId("nombre-motorista").waitFor();
await foto(c, "p3-10-cliente-motorista-en-camino");
await a.getByTestId("avanzar").filter({ hasText: "Ya llegué" }).click();
await a.getByTestId("avanzar").filter({ hasText: "Carga lista" }).click();
await a.getByTestId("avanzar").filter({ hasText: "Entrega completada" }).click();
await a.getByTestId("aviso").waitFor();
await foto(a, "p3-11-entregado");

await a.goto(B + "/motorista/viajes?p=hoy");
await foto(a, "p3-12-mis-viajes");
await a.goto(B + "/motorista/creditos");
await foto(a, "p3-13-creditos");
await a.goto(B + "/motorista/perfil");
await foto(a, "p3-14-perfil");

// Panel
const p = await pagina();
await p.goto(B + "/login");
await p.fill('input[name="correo"]', process.env.E2E_CORREO);
await p.fill('input[name="password"]', process.env.E2E_PASSWORD);
await p.getByRole("button", { name: /Entrar/ }).click();
await p.waitForURL(/\/panel$/);
await p.goto(`${B}/panel/viajes/${v.id}`);
await foto(p, "p3-15-panel-viaje");
await p.goto(`${B}/panel/motoristas/${m.id}`);
await foto(p, "p3-16-panel-motorista");

await limpiar();
await br.close();
await db.$disconnect();
console.log(errores.length ? errores.join("\n") : "sin errores ni desbordes");
