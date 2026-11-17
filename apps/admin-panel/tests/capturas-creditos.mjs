// Capturas de la Parte 4 (recargas y recibos) en PC (1366) y celular (390).
// Crea un motorista de prueba con deuda y le registra una recarga por transferencia.
// Uso: CAPTURAS=carpeta E2E_CORREO=... E2E_PASSWORD=... node tests/capturas-creditos.mjs
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const B = process.env.E2E_URL ?? "http://localhost:3000", D = process.env.CAPTURAS ?? "capturas";
const db = new PrismaClient();
const br = await chromium.launch();
const errores = [];
const azar = (n) => String(Math.floor(Math.random() * 10 ** n)).padStart(n, "0");
const base = { deviceScaleFactor: 2, locale: "es-SV", timezoneId: "America/El_Salvador" };
const PC = { ...base, viewport: { width: 1366, height: 900 } };
const CEL = { ...base, viewport: { width: 390, height: 844 } };
// La app del motorista tiene la barra fija abajo: con una ventana alta se ve la pantalla completa sin taparse.
const APP = { ...base, viewport: { width: 390, height: 1500 } };

async function pagina(opc) {
  const ctx = await br.newContext(opc);
  const p = await ctx.newPage();
  p.on("console", (m) => m.type() === "error" && !/tile\.openstreetmap/.test(m.text()) && errores.push(m.text()));
  return p;
}
async function foto(p, nombre, completa = true) {
  await p.waitForTimeout(1000);
  await p.screenshot({ path: `${D}/${nombre}.png`, fullPage: completa });
  const w = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (w > 0) errores.push(`${nombre}: desborde horizontal ${w}px`);
}
async function entrarPanel(p) {
  await p.goto(B + "/login");
  await p.fill('input[name="correo"]', process.env.E2E_CORREO);
  await p.fill('input[name="password"]', process.env.E2E_PASSWORD);
  await p.getByRole("button", { name: /Entrar/ }).click();
  await p.waitForURL(/\/panel$/);
}

const prop = await db.propietario.findUniqueOrThrow({ where: { correo: process.env.E2E_CORREO } });
const telefono = `7${azar(7)}`;
const m = await db.motorista.create({
  data: {
    nombre: "José Antonio Ramírez", telefono, passwordHash: await bcrypt.hash("clave-segura-1", 10), debeCambiarPassword: false,
    dui: `${azar(8)}-${azar(1)}`, licenciaNumero: azar(10), licenciaVence: new Date("2030-01-01"), placa: `P ${azar(6)}`,
    marca: "Toyota", modelo: "Hilux", tipoVehiculo: "PICKUP", capacidadTon: 1.5, estado: "ACTIVO", creadoPorId: prop.id,
    saldoCreditos: -0.2, terminosVersion: "0.2", terminosAceptadosEn: new Date(), correo: `jose${azar(4)}@prueba.local`,
  },
});

// Panel en PC: formulario lleno, recibo, lista y datos
const p = await pagina(PC);
await entrarPanel(p);
await p.goto(`${B}/panel/creditos?m=${m.id}`);
const f = p.getByTestId("form-recarga");
await f.getByLabel("Número de referencia").fill(`TRF${azar(7)}`);
await f.getByLabel(/Revisé en el banco/).check();
await foto(p, "p4-01-panel-creditos-pc");
await f.getByRole("button", { name: /Registrar y generar recibo/ }).click();
await p.waitForURL(/recibo\/\d+/);
const numero = Number(p.url().match(/recibo\/(\d+)/)[1]);
await foto(p, "p4-02-panel-recibo-pc");
await p.goto(`${B}/panel/creditos/datos`);
await foto(p, "p4-03-panel-datos-pc");
await p.goto(`${B}/panel/motoristas/${m.id}`);
await foto(p, "p4-04-panel-motorista-pc");

// Panel en celular
const pc = await pagina(CEL);
await entrarPanel(pc);
await pc.goto(`${B}/panel/creditos`);
await foto(pc, "p4-05-panel-creditos-cel");
await pc.goto(`${B}/panel/creditos/recibo/${numero}`);
await foto(pc, "p4-06-panel-recibo-cel");

// App del motorista
const a = await pagina(APP);
await a.goto(B + "/motorista/entrar");
await a.getByLabel("Número de teléfono").fill(`${telefono.slice(0, 4)}-${telefono.slice(4)}`);
await a.getByLabel("Contraseña", { exact: true }).fill("clave-segura-1");
await a.getByRole("button", { name: /Entrar/ }).click();
await a.waitForURL(/\/motorista$/);
await a.goto(B + "/motorista/creditos");
await foto(a, "p4-07-motorista-creditos", false);
await a.goto(`${B}/motorista/creditos/recibo/${numero}`);
await foto(a, "p4-08-motorista-recibo", false);
const pdf = await a.request.get(`${B}/motorista/api/recibos/${numero}`);
if (pdf.status() !== 200) errores.push(`PDF: ${pdf.status()}`);
else (await import("node:fs")).writeFileSync(`${D}/p4-09-recibo-ejemplo.pdf`, await pdf.body());

await br.close();
await db.$disconnect();
console.log(errores.length ? errores.join("\n") : "sin errores ni desbordes");
