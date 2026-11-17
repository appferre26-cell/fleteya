// Capturas de la Parte 5 (botones por toneladas y contrapropuesta). Uso: node tests/capturas-rangos.mjs
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
const U = process.env.E2E_URL ?? "http://localhost:3000";
const OUT = process.env.CAPTURAS ?? "/home/ubuntu/fleteya_capturas_parte5";
const db = new PrismaClient();
const b = await chromium.launch();
const cel = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, geolocation: { latitude: 13.722, longitude: -89.368 }, permissions: ["geolocation"] };
const desborde = async (p, n) => { const w = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); console.log(n, "desborde:", w); };

const c = await (await b.newContext(cel)).newPage();
await c.goto(`${U}/pedir?f=FER001`);
const sec = c.getByTestId("rangos");
await sec.scrollIntoViewIfNeeded();
await c.getByTestId("rango-1-2").click();
await c.evaluate(() => window.scrollBy(0, -140));
await c.screenshot({ path: `${OUT}/p5-01-cliente-botones-toneladas.png` }); await desborde(c, "01");
if (await c.getByTestId("rango-3+").isEnabled()) { // solo si hay un vehículo activo de más de 3 ton
  await c.getByTestId("rango-3+").click();
  await c.getByTestId("ton-extra").scrollIntoViewIfNeeded();
  await c.screenshot({ path: `${OUT}/p5-02-cliente-mas-de-3.png` });
}

// Motorista con contrapropuesta: viaje de 1 a 2 ton dentro de 5 km
const m = await db.motorista.findUniqueOrThrow({ where: { telefono: "70000001" } });
await db.viaje.updateMany({ where: { estado: "BUSCANDO" }, data: { estado: "CANCELADO", canceladoPor: "PROPIETARIO", canceladoEn: new Date() } });
await db.motorista.update({ where: { id: m.id }, data: { saldoCreditos: 20, terminosVersion: "0.2", terminosAceptadosEn: new Date(), disponible: false } });
const v = await db.viaje.create({ data: {
  codigo: `cap${Date.now()}`, clienteNombre: "Ana López", clienteTelefono: "61234567", origenDireccion: "Ferretería El Constructor · Lourdes", origenLat: 13.725, origenLng: -89.37,
  destinoDireccion: "Col. Las Brisas, pasaje 3, casa 12", destinoLat: 13.73, destinoLng: -89.36, distanciaKm: 1.2, pesoKg: 2000, precioBase: 20, fueraDeRango: false,
  rangoTon: "1-2", nota: "30 bolsas de cemento", aceptoTerminosEn: new Date() } });
const a = await (await b.newContext(cel)).newPage();
await a.goto(`${U}/motorista/entrar`);
await a.getByLabel("Número de teléfono").fill("70000001"); await a.getByLabel("Contraseña", { exact: true }).fill("Prueba2026");
await a.getByRole("button", { name: /Entrar/ }).click(); await a.waitForURL(/\/motorista$/);
await a.getByTestId("disponible").click();
await a.getByTestId("alerta").waitFor({ timeout: 15000 });
await a.getByTestId("alerta").getByRole("button", { name: "Ver después" }).click();
const t = a.getByTestId("solicitud").first();
await t.getByRole("button", { name: /Proponer otro precio/ }).click();
await t.getByLabel("Tu precio en dólares").fill("25");
await t.getByRole("button", { name: "Enviar" }).scrollIntoViewIfNeeded();
await a.screenshot({ path: `${OUT}/p5-03-motorista-propone.png` }); await desborde(a, "03");
await t.getByRole("button", { name: "Enviar" }).click();
await a.getByTestId("oferta-pendiente").waitFor();

await c.goto(`${U}/viaje/${v.codigo}`);
await c.getByTestId("oferta").waitFor();
await c.screenshot({ path: `${OUT}/p5-04-cliente-recibe-propuesta.png` }); await desborde(c, "04");
// Deja todo limpio: el motorista de prueba se desconecta y el viaje se cancela
await db.ofertaPrecio.updateMany({ where: { viajeId: v.id }, data: { estado: "RETIRADA" } });
await db.viaje.update({ where: { id: v.id }, data: { estado: "CANCELADO", canceladoPor: "PROPIETARIO", canceladoEn: new Date() } });
await db.motorista.update({ where: { id: m.id }, data: { disponible: false } });

const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await p.goto(`${U}/login`); await p.getByLabel("Correo electrónico").fill("demo@fleteya.app"); await p.getByLabel("Contraseña", { exact: true }).fill("Prueba2026");
await p.getByRole("button", { name: /Entrar al panel/ }).click(); await p.waitForURL(/\/panel$/);
await p.goto(`${U}/panel/tarifas`);
await p.screenshot({ path: `${OUT}/p5-05-panel-tarifas.png`, fullPage: true });
await b.close(); await db.$disconnect();
