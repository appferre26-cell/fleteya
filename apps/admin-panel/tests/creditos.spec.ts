import { expect, test, type Browser, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Parte 4: recargas de créditos y recibos (panel + app del motorista).
const db = new PrismaClient();
const CORREO = process.env.E2E_CORREO ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const CLAVE = "clave-segura-1";
const ALERTA = "[role=alert]:not(#__next-route-announcer__)";
const azar = (n: number) => String(Math.floor(Math.random() * 10 ** n)).padStart(n, "0");

test.describe.configure({ mode: "serial" });

async function crearMotorista(o: { saldo?: number; correo?: string } = {}) {
  const prop = await db.propietario.findUniqueOrThrow({ where: { correo: CORREO } });
  const telefono = `7${azar(7)}`;
  return db.motorista.create({
    data: {
      nombre: `Recarga ${telefono.slice(-4)} Prueba`, telefono, passwordHash: await bcrypt.hash(CLAVE, 10), debeCambiarPassword: false,
      dui: `${azar(8)}-${azar(1)}`, licenciaNumero: azar(10), licenciaVence: new Date("2030-01-01"), correo: o.correo ?? null,
      placa: `P ${azar(6)}`, marca: "Isuzu", modelo: "D-Max", tipoVehiculo: "PICKUP", capacidadTon: 1.5,
      estado: "ACTIVO", creadoPorId: prop.id, saldoCreditos: o.saldo ?? 0, terminosVersion: "0.1", terminosAceptadosEn: new Date(),
    },
  });
}

async function entrarPanel(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(CORREO);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: /Entrar al panel/ }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

async function appMotorista(browser: Browser, telefono: string) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: { latitude: 13.722, longitude: -89.368 }, permissions: ["geolocation"], locale: "es-SV", timezoneId: "America/El_Salvador" });
  const app = await ctx.newPage();
  await app.goto("/motorista/entrar");
  await app.getByLabel("Número de teléfono").fill(`${telefono.slice(0, 4)}-${telefono.slice(4)}`);
  await app.getByLabel("Contraseña", { exact: true }).fill(CLAVE);
  await app.getByRole("button", { name: /Entrar/ }).click();
  await expect(app).toHaveURL(/\/motorista$/);
  return app;
}

type Datos = { plan?: "Semanal" | "Mensual"; forma?: "Transferencia" | "Efectivo"; referencia?: string; revisado?: boolean };
async function llenarRecarga(page: Page, motoristaId: string, d: Datos) {
  await page.goto(`/panel/creditos?m=${motoristaId}`);
  const f = page.getByTestId("form-recarga");
  await expect(f.locator("#motoristaId")).toHaveValue(motoristaId);
  await f.locator("label", { hasText: d.plan ?? "Semanal" }).click();
  await f.locator("label", { hasText: d.forma ?? "Transferencia" }).click();
  if ((d.forma ?? "Transferencia") === "Transferencia") {
    if (d.referencia) await f.getByLabel("Número de referencia").fill(d.referencia);
    if (d.revisado) await f.getByLabel(/Revisé en el banco/).check();
  }
  await f.getByRole("button", { name: /Registrar y generar recibo/ }).click();
}

const numeroDe = async (page: Page) => Number((await page.getByTestId("numero-recibo").textContent())!.replace(/\D/g, ""));

test.beforeAll(async () => {
  if (!CORREO || !PASSWORD) throw new Error("Define E2E_CORREO y E2E_PASSWORD");
  await db.configuracion.update({ where: { id: 1 }, data: { planSemanal: 20, planMensual: 60, comisionPct: 10 } });
});
test.afterAll(async () => {
  await db.configuracion.update({ where: { id: 1 }, data: { planSemanal: 20, planMensual: 60, comisionPct: 10 } });
  await db.motorista.updateMany({ where: { disponible: true }, data: { disponible: false } });
  await db.$disconnect();
});

let REF = "";
let numeroDeuda = 0;
let motoristaDeuda = { id: "", telefono: "" };

test("transferencia: valida referencia y revisión, descuenta la deuda y genera el recibo", async ({ page }) => {
  const m = await crearMotorista({ saldo: -0.7 });
  motoristaDeuda = { id: m.id, telefono: m.telefono };
  await entrarPanel(page);

  // La navegación ya no tiene «Próximas partes»
  await expect(page.getByRole("link", { name: "Créditos y recargas" }).first()).toBeVisible();
  await expect(page.getByText("Próximas partes")).toHaveCount(0);

  await llenarRecarga(page, m.id, {});
  await expect(page.getByText("Escribe el número de referencia de la transferencia")).toBeVisible();
  await expect(page.getByText("Confirma que viste el dinero en la cuenta")).toBeVisible();

  REF = `E2E${azar(8)}`;
  await llenarRecarga(page, m.id, { referencia: REF });
  await expect(page.getByText("Confirma que viste el dinero en la cuenta")).toBeVisible();
  await expect(page.getByTestId("vista-saldo")).toContainText("$19.30");
  await expect(page.getByTestId("vista-saldo")).toContainText("Se descuentan primero los $0.70");

  await llenarRecarga(page, m.id, { referencia: REF.toLowerCase(), revisado: true });
  await expect(page).toHaveURL(/\/panel\/creditos\/recibo\/\d+\?nuevo=1$/);
  await expect(page.getByTestId("aviso-nuevo")).toContainText("$19.30");
  await expect(page.getByTestId("sello")).toHaveText("PAGADO");
  await expect(page.getByTestId("plan-recibo")).toHaveText("Semanal");
  await expect(page.getByTestId("monto-recibo")).toHaveText("$20.00");
  await expect(page.getByTestId("saldo-anterior")).toHaveText("-$0.70");
  await expect(page.getByTestId("deuda-recibo")).toHaveText("-$0.70");
  await expect(page.getByTestId("saldo-nuevo")).toHaveText("$19.30");
  await expect(page.getByTestId("recibo")).toContainText(REF); // se guarda en mayúsculas
  await expect(page.getByTestId("whatsapp")).toHaveAttribute("href", new RegExp(`wa\\.me/503${m.telefono}`));
  numeroDeuda = await numeroDe(page);

  // PDF desde el panel
  const pdf = await page.request.get(`/api/recibos/${numeroDeuda}?descargar=1`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect(pdf.headers()["content-disposition"]).toContain("attachment");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // Base: saldo, recarga y movimiento
  const bd = await db.motorista.findUniqueOrThrow({ where: { id: m.id }, select: { saldoCreditos: true } });
  expect(Number(bd.saldoCreditos)).toBe(19.3);
  const mov = await db.movimientoCredito.findFirstOrThrow({ where: { motoristaId: m.id, tipo: "RECARGA" } });
  expect(mov.detalle).toContain(`REC-${String(numeroDeuda).padStart(6, "0")}`);

  // La misma referencia (con espacios) no se puede registrar otra vez, ni a otro motorista
  const otro = await crearMotorista();
  await llenarRecarga(page, otro.id, { referencia: `${REF.slice(0, 4)} ${REF.slice(4)}`, revisado: true });
  await expect(page.locator(ALERTA)).toContainText("Esa referencia ya se registró en REC-");

  // El detalle del motorista enlaza al recibo y tiene el botón de recarga
  await page.goto(`/panel/motoristas/${m.id}`);
  await expect(page.getByTestId("saldo-motorista")).toHaveText("$19.30");
  await expect(page.getByTestId("registrar-recarga")).toHaveAttribute("href", `/panel/creditos?m=${m.id}#registrar`);
  await page.getByRole("link", { name: /REC-\d{6} · Semanal/ }).click();
  await expect(page).toHaveURL(new RegExp(`/panel/creditos/recibo/${numeroDeuda}$`));
});

test("efectivo mensual, lista de recargas, búsqueda y exportar CSV", async ({ page }) => {
  const m = await crearMotorista({ saldo: 3 });
  await entrarPanel(page);
  await llenarRecarga(page, m.id, { plan: "Mensual", forma: "Efectivo" });
  await expect(page.getByTestId("plan-recibo")).toHaveText("Mensual");
  await expect(page.getByTestId("saldo-nuevo")).toHaveText("$63.00");
  await expect(page.getByTestId("deuda-recibo")).toHaveCount(0);
  await expect(page.getByTestId("recibo")).toContainText("Efectivo");
  const n = await numeroDe(page);
  const rec = `REC-${String(n).padStart(6, "0")}`;

  await page.goto("/panel/creditos");
  await expect(page.getByTestId("fila-recarga").first()).toContainText(rec);
  await page.getByLabel("Buscar recarga").fill(rec);
  await page.getByLabel("Buscar recarga").press("Enter");
  await expect(page.getByTestId("fila-recarga")).toHaveCount(1);
  await expect(page.getByTestId("fila-recarga")).toContainText(m.nombre);
  await page.getByLabel("Buscar recarga").fill(REF);
  await page.getByLabel("Buscar recarga").press("Enter");
  await expect(page.getByTestId("fila-recarga")).toHaveCount(1);

  const csv = await page.request.get("/api/recargas");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const texto = await csv.text();
  expect(texto).toContain(rec);
  expect(texto).toContain(REF);
});

test("el motorista ve su saldo, el historial, el recibo y el PDF; solo los suyos", async ({ browser, request }) => {
  const app = await appMotorista(browser, motoristaDeuda.telefono);
  await app.getByRole("link", { name: "Créditos", exact: true }).click();
  await expect(app.getByTestId("saldo")).toHaveText("$19.30");
  await expect(app.getByTestId("plan-semanal")).toContainText("Tu plan actual");
  const fila = app.getByTestId("recarga").first();
  const rec = `REC-${String(numeroDeuda).padStart(6, "0")}`;
  await expect(fila).toContainText("Semanal · $20.00");
  await expect(fila).toContainText(rec);
  await fila.getByRole("link", { name: `Ver recibo ${rec}` }).click();
  await expect(app).toHaveURL(new RegExp(`/motorista/creditos/recibo/${numeroDeuda}$`));
  await expect(app.getByTestId("saldo-nuevo")).toHaveText("$19.30");
  await expect(app.getByTestId("deuda-recibo")).toHaveText("-$0.70");
  await expect(app.getByTestId("compartir")).toBeVisible();

  const pdf = await app.request.get(`/motorista/api/recibos/${numeroDeuda}?descargar=1`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");

  // El recibo de otro motorista no se puede abrir
  const ajeno = await db.recarga.findFirstOrThrow({ where: { motoristaId: { not: motoristaDeuda.id } }, select: { numero: true } });
  expect((await app.request.get(`/motorista/api/recibos/${ajeno.numero}`)).status()).toBe(404);
  const r = await app.goto(`/motorista/creditos/recibo/${ajeno.numero}`);
  expect(r?.status()).toBe(404);

  // Sin sesión no hay recibos
  expect((await request.get(`/api/recibos/${numeroDeuda}`)).status()).toBe(401);
  expect((await request.get(`/motorista/api/recibos/${numeroDeuda}`)).status()).toBe(401);
  expect((await request.get("/api/recargas")).status()).toBe(401);
  await app.context().close();
});

test("anular una recarga resta el monto y marca el recibo", async ({ page }) => {
  const m = await crearMotorista({ saldo: 1 });
  await entrarPanel(page);
  await llenarRecarga(page, m.id, { forma: "Efectivo" });
  await expect(page.getByTestId("saldo-nuevo")).toHaveText("$21.00");
  await page.getByRole("button", { name: /Anular recarga/ }).click();
  const f = page.getByTestId("form-anular");
  await f.getByLabel("Motivo").fill("mal");
  await f.getByRole("button", { name: "Sí, anular" }).click();
  await expect(f.getByText("Escribe el motivo (mínimo 5 letras)")).toBeVisible();
  await f.getByLabel("Motivo").fill("Se registró dos veces");
  await f.getByRole("button", { name: "Sí, anular" }).click();
  await expect(page.getByRole("status").filter({ hasText: "anulado" })).toContainText("$1.00");
  await expect(page.getByTestId("sello")).toHaveText("ANULADO");
  await expect(page.getByTestId("anulacion")).toContainText("Se registró dos veces");
  await expect(page.getByRole("button", { name: /Anular recarga/ })).toHaveCount(0);
  const bd = await db.motorista.findUniqueOrThrow({ where: { id: m.id }, select: { saldoCreditos: true } });
  expect(Number(bd.saldoCreditos)).toBe(1);
  const ajuste = await db.movimientoCredito.findFirstOrThrow({ where: { motoristaId: m.id, tipo: "AJUSTE" } });
  expect(Number(ajuste.monto)).toBe(-20);
});

test("datos y planes: validación, recibo nuevo y «¿Cómo recargo?»", async ({ page, browser }) => {
  await entrarPanel(page);
  await page.goto("/panel/creditos");
  await page.getByRole("link", { name: /Datos y planes/ }).click();
  await expect(page).toHaveURL(/\/panel\/creditos\/datos$/);
  await page.getByLabel("NIT").fill("abc");
  await page.getByLabel("Plan semanal ($)").fill("0");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Solo números y guiones")).toBeVisible();
  await expect(page.getByText("Mínimo $1")).toBeVisible();

  await page.getByLabel("Nombre del socio inscrito").fill("Socio Prueba FleteYa");
  await page.getByLabel("NIT").fill("0614-010190-101-1");
  await page.getByLabel("Dirección").fill("Lourdes, Colón, La Libertad");
  await page.getByLabel("Banco").fill("Banco Prueba");
  await page.getByLabel("Tipo de cuenta").fill("Ahorro");
  await page.getByLabel("Número de cuenta").fill("0000-1234-5678");
  await page.getByLabel("Titular").fill("Socio Prueba FleteYa");
  await page.getByLabel("Plan semanal ($)").fill("20");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("status")).toContainText("Datos guardados");

  // Un motorista con saldo 0 no puede ponerse disponible; ve la cuenta para transferir
  const m = await crearMotorista({ saldo: 0, correo: `rec${azar(6)}@prueba.local` });
  const app = await appMotorista(browser, m.telefono);
  await expect(app.getByTestId("no-puede")).toContainText("No tienes créditos");
  await app.goto("/motorista/creditos");
  await expect(app.getByTestId("cuenta-banco")).toContainText("Banco Prueba · Ahorro");
  await expect(app.getByTestId("numero-cuenta")).toHaveText("0000-1234-5678");
  await expect(app.getByTestId("historial-recargas")).toContainText("Aún no tienes recargas");

  // Recarga con los datos nuevos en el recibo; sin SMTP no se envía correo y se avisa
  await llenarRecarga(page, m.id, { forma: "Efectivo" });
  await expect(page.getByTestId("recibo")).toContainText("Socio Prueba FleteYa · NIT 0614-010190-101-1");
  await expect(page.getByTestId("recibo")).toContainText("Lourdes, Colón, La Libertad");
  await expect(page.getByTestId("correo-estado")).toContainText("Aún no se envió");
  await expect(page.getByTestId("sin-smtp")).toBeVisible();

  // Ya puede ponerse disponible
  await expect(async () => {
    await app.goto("/motorista");
    await expect(app.getByTestId("disponible")).toBeVisible({ timeout: 2000 });
  }).toPass();
  await app.goto("/motorista/creditos");
  await expect(app.getByTestId("saldo")).toHaveText("$20.00");
  await expect(app.getByTestId("recarga")).toHaveCount(1);
  await app.context().close();
});


// Solo corre con el servidor iniciado con SMTP_URL=smtp://localhost:2525 y tests/smtp-falso.mjs escribiendo en SMTP_BUZON.
test("con correo configurado, el recibo llega al correo del motorista y se puede reenviar", async ({ page, browser }) => {
  const buzon = process.env.SMTP_BUZON;
  test.skip(!buzon, "Sin SMTP_BUZON: el envío de correo no se prueba en esta corrida");
  const { readFileSync, existsSync } = await import("node:fs");
  const leer = () => (existsSync(buzon!) ? readFileSync(buzon!, "latin1") : "");
  const correo = `rec${azar(6)}@prueba.local`;
  const m = await crearMotorista({ saldo: 0, correo });
  await entrarPanel(page);
  await llenarRecarga(page, m.id, { forma: "Efectivo" });
  const n = await numeroDe(page);
  const rec = `REC-${String(n).padStart(6, "0")}`;
  await expect(page.getByTestId("correo-estado")).toContainText(`Enviado a ${correo}`);
  const correos = () => leer().split("=====FIN=====").filter((c) => c.includes(`To: ${correo}`));
  expect(correos()).toHaveLength(1);
  expect(correos()[0]).toContain(rec);
  expect(correos()[0]).toContain("application/pdf");

  await page.getByTestId("reenviar").click();
  await expect(page.getByRole("status").filter({ hasText: "Recibo enviado" })).toContainText(correo);
  expect(correos()).toHaveLength(2);

  const app = await appMotorista(browser, m.telefono);
  await app.goto(`/motorista/creditos/recibo/${n}`);
  await expect(app.getByTestId("enviado-correo")).toContainText("@prueba.local");
  await app.context().close();
});
