// Capturas de la Parte 10 (registro del motorista, acceso de $10 y recargas libres) en celular y PC.
// Uso: CAPTURAS=carpeta E2E_CORREO=... E2E_PASSWORD=... node tests/capturas-registro.mjs
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import path from "node:path";

const B = process.env.E2E_URL ?? "http://localhost:3000", D = process.env.CAPTURAS ?? "capturas";
const FIX = path.join(import.meta.dirname, "fixtures");
const db = new PrismaClient();
const br = await chromium.launch();
const errores = [];
const azar = (n) => String(Math.floor(Math.random() * 10 ** n)).padStart(n, "0");
const base = { deviceScaleFactor: 2, locale: "es-SV", timezoneId: "America/El_Salvador" };
const PC = { ...base, viewport: { width: 1366, height: 900 } };
const APP = { ...base, viewport: { width: 390, height: 1100 } };

async function pagina(opc) {
  const ctx = await br.newContext(opc);
  const p = await ctx.newPage();
  p.on("console", (m) => m.type() === "error" && !/tile\.openstreetmap|maps\.googleapis/.test(m.text()) && errores.push(m.text()));
  return p;
}
async function foto(p, nombre, completa = true) {
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${D}/${nombre}.png`, fullPage: completa });
  const w = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (w > 0) errores.push(`${nombre}: desborde horizontal ${w}px`);
}
function dui() {
  const d = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10));
  const s = d.reduce((a, n, i) => a + n * (9 - i), 0);
  return `${d.join("")}-${(10 - (s % 10)) % 10}`;
}
const FOTOS = [["DUI_FRENTE", "dui.jpg"], ["DUI_REVERSO", "dui.jpg"], ["LICENCIA_FRENTE", "licencia.jpg"], ["LICENCIA_REVERSO", "licencia.jpg"],
  ["TARJETA_FRENTE", "tarjeta.jpg"], ["TARJETA_REVERSO", "tarjeta.jpg"], ["VEHICULO_FRENTE", "tarjeta.jpg"], ["VEHICULO_ATRAS", "licencia.jpg"],
  ["VEHICULO_IZQUIERDA", "dui.jpg"], ["VEHICULO_DERECHA", "tarjeta.jpg"]];

// 1) Registro del motorista en el celular
const telefono = `6${azar(7)}`;
const a = await pagina(APP);
await a.goto(B + "/motorista/entrar");
await foto(a, "p10-01-entrar-con-enlace-registro");
await a.goto(B + "/motorista/registro");
const sig = a.getByTestId("siguiente");
await a.getByLabel("Nombre completo").fill("Mario Ernesto Flores");
await a.getByLabel("Celular").fill(telefono);
await a.getByLabel("Número de DUI").fill(dui());
await a.getByLabel("Crea tu contraseña").fill("clave-segura-1");
await a.getByLabel("Repite la contraseña").fill("clave-segura-1");
await foto(a, "p10-02-registro-paso1-datos");
await sig.click();
await a.getByLabel("Número de licencia").fill("0614-250390-102-3");
await a.getByLabel("Fecha de vencimiento").fill("2029-08-31");
await foto(a, "p10-03-registro-paso2-licencia");
await sig.click();
await a.getByLabel("Placa").fill(`P ${azar(3)}-${azar(3)}`);
await a.getByLabel("Tipo de vehículo").selectOption("PICKUP");
await a.getByLabel("Marca").fill("Toyota");
await a.getByLabel("Modelo").fill("Hilux");
await a.getByLabel(/Capacidad/).fill("1.5");
await foto(a, "p10-04-registro-paso3-vehiculo");
await sig.click();
await sig.click(); // muestra qué fotos faltan
await foto(a, "p10-05-registro-paso4-fotos-faltan");
for (const [t, f] of FOTOS) await a.locator(`input[name="doc_${t}"]`).setInputFiles(path.join(FIX, f));
await foto(a, "p10-06-registro-paso4-fotos-listas");
await sig.click();
await a.getByTestId("requiere-ccf").check();
await a.getByLabel("NIT").fill("0614-250390-102-3");
await a.getByLabel("NRC (registro de IVA)").fill("123456-7");
await a.getByLabel("Nombre o razón social").fill("Mario Ernesto Flores");
await a.getByLabel("Giro o actividad económica").fill("Transporte de carga");
await a.getByLabel("Dirección", { exact: true }).fill("Col. Santa Lucía, Lourdes, Colón");
await a.getByLabel(/Leí y acepto/).check();
await foto(a, "p10-07-registro-paso5-facturacion-ccf");
await sig.click();
await foto(a, "p10-08-registro-paso6-pagar-y-activar");
await a.getByTestId("pagar-activar").click();
await a.waitForURL(/\/motorista\/alta/, { timeout: 30_000 });
await foto(a, "p10-09-mi-alta-pagar-acceso");
await a.getByLabel(/Número de referencia/).fill(`TRF${azar(7)}`);
await a.getByRole("button", { name: "Avisar" }).click();
await a.getByTestId("form-aviso").getByRole("status").waitFor();
await foto(a, "p10-10-mi-alta-aviso-enviado");
await a.goto(B + "/motorista");
await foto(a, "p10-11-inicio-pendiente-ir-alta");

// 2) Panel en PC: lista, detalle con pago del acceso, aprobar
const nuevo = await db.motorista.findUniqueOrThrow({ where: { telefono } });
const p = await pagina(PC);
await p.goto(B + "/login");
await p.fill('input[name="correo"]', process.env.E2E_CORREO);
await p.fill('input[name="password"]', process.env.E2E_PASSWORD);
await p.getByRole("button", { name: /Entrar/ }).click();
await p.waitForURL(/\/panel$/);
await p.goto(`${B}/panel/motoristas?tab=pendientes`);
await foto(p, "p10-12-panel-motoristas-pendientes");
await p.goto(`${B}/panel/motoristas/${nuevo.id}`);
await foto(p, "p10-13-panel-detalle-registro-y-pago-acceso");
const pa = p.getByTestId("pago-acceso");
await pa.getByLabel(/Revisé en el banco/).check();
await pa.getByRole("button", { name: /Registrar pago/ }).click();
await pa.getByText("Acceso pagado").waitFor();
for (const c of await p.locator('input[type="checkbox"][name^="revis"]').all()) await c.check();
await foto(p, "p10-14-panel-acceso-pagado-listo-para-aprobar");

// 3) Recarga de monto libre y Datos y precios
await p.goto(`${B}/panel/creditos?m=${nuevo.id}`);
const f = p.getByTestId("form-recarga");
await f.locator("#monto").fill("15");
await foto(p, "p10-15-panel-recarga-monto-libre");
await p.goto(`${B}/panel/creditos/datos`);
await foto(p, "p10-16-panel-datos-y-precios");

// 4) Mis créditos del motorista (sin planes)
const prop = await db.propietario.findUniqueOrThrow({ where: { correo: process.env.E2E_CORREO } });
const tel2 = `7${azar(7)}`;
await db.motorista.create({
  data: {
    nombre: "Rosa Elena Martínez", telefono: tel2, passwordHash: await bcrypt.hash("clave-segura-1", 10), debeCambiarPassword: false,
    dui: dui(), licenciaNumero: azar(10), licenciaVence: new Date("2030-01-01"), placa: `C ${azar(6)}`, marca: "Isuzu", modelo: "NPR",
    tipoVehiculo: "CAMION_LIVIANO", capacidadTon: 3, estado: "ACTIVO", creadoPorId: prop.id, saldoCreditos: 8.5,
    terminosVersion: "0.2", terminosAceptadosEn: new Date(), accesoPagadoEn: new Date(),
  },
});
const c = await pagina(APP);
await c.goto(B + "/motorista/entrar");
await c.fill("#telefono", tel2);
await c.fill("#password", "clave-segura-1");
await c.getByRole("button", { name: /Entrar/ }).click();
await c.waitForURL(/\/motorista$/);
await c.goto(B + "/motorista/creditos");
await foto(c, "p10-17-app-mis-creditos-sin-planes");

await br.close();
await db.$disconnect();
console.log(errores.length ? "Avisos:\n" + errores.join("\n") : "Capturas listas sin errores.");
