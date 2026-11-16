// Capturas de la Parte 7 (tablero en vivo, reportes y filtros de viajes). Uso: node tests/capturas-reportes.mjs
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
const U = process.env.E2E_URL ?? "http://localhost:3000";
const OUT = process.env.CAPTURAS ?? "/home/ubuntu/fleteya_capturas_parte7";
const db = new PrismaClient();
const b = await chromium.launch();
const cel = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 };
const pc = { viewport: { width: 1280, height: 900 } };
const desborde = async (p, n) => { const w = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); console.log(n, "desborde:", w); };

// Motorista demo conectado y un pedido esperando motorista, para que el mapa tenga algo.
const m = await db.motorista.findUniqueOrThrow({ where: { telefono: "70000001" } });
await db.motorista.update({ where: { id: m.id }, data: { disponible: true, vistoEn: new Date(), lat: 13.7215, lng: -89.3655, ubicacionEn: new Date() } });
const v = await db.viaje.create({ data: {
  codigo: `cap7${Date.now()}`, clienteNombre: "Mario Pérez", clienteTelefono: "61112222", origenDireccion: "Ferretería El Constructor · Lourdes", origenLat: 13.7262, origenLng: -89.3721,
  destinoDireccion: "Res. Pinares, casa 4", destinoLat: 13.735, destinoLng: -89.36, distanciaKm: 1.6, pesoKg: 1000, precioBase: 10, fueraDeRango: false, rangoTon: "0-1",
  aceptoTerminosEn: new Date(), creadoEn: new Date(Date.now() - 4 * 60_000) } });
const prop = await db.propietario.findUniqueOrThrow({ where: { correo: "demo@fleteya.app" } });
const hoy = new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 10);
const gasto = await db.gasto.create({ data: { fecha: new Date(`${hoy}T00:00:00Z`), categoria: "Carteles y QR", concepto: "Impresión de 5 carteles QR", monto: 12.5, registradoPorId: prop.id } });

async function entrar(ctx) {
  const p = await (await b.newContext(ctx)).newPage();
  await p.goto(`${U}/login`); await p.getByLabel("Correo electrónico").fill("demo@fleteya.app"); await p.getByLabel("Contraseña", { exact: true }).fill("Prueba2026");
  await p.getByRole("button", { name: /Entrar al panel/ }).click(); await p.waitForURL(/\/panel$/);
  return p;
}
try {
  const p = await entrar(pc);
  await p.waitForTimeout(2500); // mosaicos del mapa
  await p.screenshot({ path: `${OUT}/p7-01-inicio-en-vivo-pc.png`, fullPage: true });
  await p.goto(`${U}/panel/reportes?periodo=mes`);
  await p.screenshot({ path: `${OUT}/p7-02-reportes-mes-pc.png`, fullPage: true });
  await p.goto(`${U}/panel/viajes?f=entregados&m=${m.id}`);
  await p.screenshot({ path: `${OUT}/p7-03-viajes-filtros-pc.png` });

  const c = await entrar(cel);
  await c.waitForTimeout(2500);
  await c.screenshot({ path: `${OUT}/p7-04-inicio-en-vivo-cel.png` }); await desborde(c, "04");
  await c.goto(`${U}/panel/reportes?periodo=mes`);
  await c.screenshot({ path: `${OUT}/p7-05-reportes-cel.png` }); await desborde(c, "05");
  await c.goto(`${U}/panel/viajes`);
  await c.screenshot({ path: `${OUT}/p7-06-viajes-filtros-cel.png` }); await desborde(c, "06");
} finally {
  await db.viaje.update({ where: { id: v.id }, data: { estado: "CANCELADO", canceladoPor: "PROPIETARIO", motivoCancelacion: "Captura de pantalla", canceladoEn: new Date() } });
  await db.gasto.delete({ where: { id: gasto.id } });
  await db.motorista.update({ where: { id: m.id }, data: { disponible: false } });
  await b.close(); await db.$disconnect();
}
