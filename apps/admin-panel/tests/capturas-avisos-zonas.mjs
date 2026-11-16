// Capturas de la Parte 8 (avisos con la app cerrada y zona dibujada). Uso: node tests/capturas-avisos-zonas.mjs
import { chromium } from "@playwright/test";
import { PrismaClient, Prisma } from "@prisma/client";
const U = process.env.E2E_URL ?? "http://localhost:3000";
const OUT = process.env.CAPTURAS ?? "/home/ubuntu/fleteya_capturas_parte8";
const db = new PrismaClient();
const b = await chromium.launch();
const cel = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 };
const pc = { viewport: { width: 1280, height: 900 } };
// El navegador de pruebas bloquea los avisos; en la captura se muestra un teléfono que aún no respondió al permiso.
const sinResponder = async (ctx) => { await ctx.addInitScript(() => Object.defineProperty(Notification, "permission", { get: () => "default" })); return ctx; };
const desborde = async (p, n) => { const w = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); console.log(n, "desborde:", w); };

const cfg = await db.configuracion.findUniqueOrThrow({ where: { id: 1 } });
const area = [
  { lat: 13.742, lng: -89.392 }, { lat: 13.745, lng: -89.36 }, { lat: 13.732, lng: -89.338 },
  { lat: 13.708, lng: -89.345 }, { lat: 13.703, lng: -89.375 }, { lat: 13.718, lng: -89.398 },
];
const centro = { lat: area.reduce((s, p) => s + p.lat, 0) / area.length, lng: area.reduce((s, p) => s + p.lng, 0) / area.length };
await db.configuracion.update({ where: { id: 1 }, data: { zonaPoligono: area, zonaLat: centro.lat, zonaLng: centro.lng } });
const fuera = await db.puntoQR.create({ data: { codigo: `CAP8${Date.now() % 100000}`, nombre: "Ferretería San Juan (fuera de zona)", direccion: "San Juan Opico", lat: 13.80, lng: -89.36 } });
const v = await db.viaje.create({ data: {
  codigo: `cap8${Date.now()}`, clienteNombre: "Mario Pérez", clienteTelefono: "61112222", origenDireccion: "Ferretería El Constructor · Lourdes", origenLat: 13.7262, origenLng: -89.3721,
  destinoDireccion: "Res. Pinares, casa 4", destinoLat: 13.735, destinoLng: -89.36, distanciaKm: 1.6, pesoKg: 1000, precioBase: 10, fueraDeRango: false, rangoTon: "0-1",
  aceptoTerminosEn: new Date() } });

try {
  const p = await (await b.newContext(pc)).newPage();
  await p.goto(`${U}/login`); await p.getByLabel("Correo electrónico").fill("demo@fleteya.app"); await p.getByLabel("Contraseña", { exact: true }).fill("Prueba2026");
  await p.getByRole("button", { name: /Entrar al panel/ }).click(); await p.waitForURL(/\/panel$/);
  await p.goto(`${U}/panel/tarifas`);
  await p.getByTestId("zona-area").scrollIntoViewIfNeeded(); await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/p8-01-tarifas-area-dibujada-pc.png`, fullPage: true });

  const m = await (await sinResponder(await b.newContext(cel))).newPage();
  await m.goto(`${U}/motorista/entrar`); await m.getByLabel("Número de teléfono").fill("70000001"); await m.getByLabel("Contraseña", { exact: true }).fill("Prueba2026");
  await m.getByRole("button", { name: /Entrar/ }).click(); await m.waitForURL(/\/motorista$/);
  await m.goto(`${U}/motorista/perfil`); await m.getByTestId("avisos").scrollIntoViewIfNeeded();
  await m.screenshot({ path: `${OUT}/p8-02-motorista-perfil-avisos.png` }); await desborde(m, "02");

  const c = await (await sinResponder(await b.newContext(cel))).newPage();
  await c.goto(`${U}/viaje/${v.codigo}`); await c.getByTestId("avisos").scrollIntoViewIfNeeded(); await c.waitForTimeout(1500);
  await c.screenshot({ path: `${OUT}/p8-03-cliente-avisame.png` }); await desborde(c, "03");
  await c.goto(`${U}/pedir?f=${fuera.codigo}`); await c.getByText("fuera de la zona de servicio").first().scrollIntoViewIfNeeded(); await c.waitForTimeout(2000);
  await c.screenshot({ path: `${OUT}/p8-04-cliente-fuera-de-zona.png` }); await desborde(c, "04");
} finally {
  await db.viaje.update({ where: { id: v.id }, data: { estado: "CANCELADO", canceladoPor: "PROPIETARIO", motivoCancelacion: "Captura de pantalla", canceladoEn: new Date() } });
  await db.puntoQR.update({ where: { id: fuera.id }, data: { activo: false } });
  await db.configuracion.update({ where: { id: 1 }, data: { zonaPoligono: cfg.zonaPoligono ?? Prisma.DbNull, zonaLat: cfg.zonaLat, zonaLng: cfg.zonaLng } });
  await b.close(); await db.$disconnect();
}
