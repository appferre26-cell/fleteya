import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import path from "node:path";

// Parte 10: el motorista se registra solo, paga el acceso y FleteYa lo da de alta.
const db = new PrismaClient();
const CORREO = process.env.E2E_CORREO ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const FIX = path.join(__dirname, "fixtures");
const CLAVE = "mi-clave-segura";
const ALERTA = "[role=alert]:not(#__next-route-announcer__)";

function duiAleatorio() {
  const d = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10));
  const suma = d.reduce((s, n, i) => s + n * (9 - i), 0);
  return `${d.join("")}-${(10 - (suma % 10)) % 10}`;
}
const telefono = `6${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
const placa = `P ${100 + Math.floor(Math.random() * 900)}-${100 + Math.floor(Math.random() * 900)}`;
const nombre = `Carlos Autoregistro ${telefono.slice(-4)}`;
const REF = `AV${Date.now().toString().slice(-8)}`;
const FOTOS: [string, string][] = [["DUI_FRENTE", "dui.jpg"], ["DUI_REVERSO", "dui.jpg"], ["LICENCIA_FRENTE", "licencia.jpg"], ["LICENCIA_REVERSO", "licencia.jpg"],
  ["TARJETA_FRENTE", "tarjeta.jpg"], ["TARJETA_REVERSO", "tarjeta.jpg"], ["VEHICULO_FRENTE", "tarjeta.jpg"], ["VEHICULO_ATRAS", "licencia.jpg"],
  ["VEHICULO_IZQUIERDA", "dui.jpg"], ["VEHICULO_DERECHA", "tarjeta.jpg"]];

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  if (!CORREO || !PASSWORD) throw new Error("Define E2E_CORREO y E2E_PASSWORD");
  await db.configuracion.update({ where: { id: 1 }, data: { precioAcceso: 10 } });
});
test.afterAll(() => db.$disconnect());

async function entrarPanel(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(CORREO);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: /Entrar al panel/ }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

test("el motorista se registra solo por pasos y llega a la pantalla de pago", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "es-SV" });
  const app = await ctx.newPage();
  await app.goto("/motorista/entrar");
  await app.getByTestId("ir-registro").click();
  await expect(app).toHaveURL(/\/motorista\/registro$/);
  const titulo = app.getByTestId("titulo-paso");
  const seguir = app.getByTestId("siguiente");

  // Paso 1: no avanza vacío; contraseñas distintas
  await expect(titulo).toContainText("Tus datos");
  await seguir.click();
  await expect(app.getByText("Completa este dato").first()).toBeVisible();
  await app.getByLabel("Nombre completo").fill(nombre);
  await app.getByLabel("Celular").fill(telefono);
  await app.getByLabel("Número de DUI").fill(duiAleatorio());
  await app.getByLabel("Crea tu contraseña").fill(CLAVE);
  await app.getByLabel("Repite la contraseña").fill("otra-clave-123");
  await seguir.click();
  await expect(app.getByText("Las dos contraseñas no son iguales")).toBeVisible();
  await app.getByLabel("Repite la contraseña").fill(CLAVE);
  await seguir.click();

  // Paso 2 y 3
  await expect(titulo).toContainText("Licencia");
  await app.getByLabel("Número de licencia").fill("0614-123456");
  await app.getByLabel("Fecha de vencimiento").fill("2030-05-31");
  await seguir.click();
  await expect(titulo).toContainText("Vehículo");
  await app.getByLabel("Placa").fill(placa);
  await app.getByLabel("Tipo de vehículo").selectOption("PICKUP");
  await app.getByLabel("Marca").fill("Nissan");
  await app.getByLabel("Modelo").fill("Frontier");
  await app.getByLabel(/Capacidad/).fill("1");
  await seguir.click();

  // Paso 4: las 10 fotos son obligatorias
  await expect(titulo).toContainText("Fotos");
  await app.locator('input[name="doc_DUI_FRENTE"]').setInputFiles(path.join(FIX, "dui.jpg"));
  await seguir.click();
  await expect(app.getByText("Falta esta foto")).toHaveCount(9);
  for (const [t, f] of FOTOS) await app.locator(`input[name="doc_${t}"]`).setInputFiles(path.join(FIX, f));
  await seguir.click();

  // Paso 5: facturación opcional y términos obligatorios
  await expect(titulo).toContainText("Facturación");
  await seguir.click();
  await expect(app.getByText("Debes aceptar los términos")).toBeVisible();
  await app.getByLabel(/Leí y acepto/).check();
  await seguir.click();

  // Paso 6: botón para pagar y activar
  await expect(titulo).toContainText("Pago y alta");
  await app.getByTestId("pagar-activar").click();
  await expect(app).toHaveURL(/\/motorista\/alta\?nuevo=1$/, { timeout: 30_000 });
  await expect(app.getByRole("status").first()).toContainText("Registro recibido");
  await expect(app.getByTestId("paso-fotos")).toHaveAttribute("data-ok", "si");
  await expect(app.getByTestId("paso-pago")).toHaveAttribute("data-ok", "no");
  await expect(app.getByTestId("pagar-acceso")).toContainText("$10.00");
  await expect(app.getByTestId("pago-en-linea")).toBeDisabled();

  // Avisa su transferencia
  await app.getByLabel(/Número de referencia/).fill("x");
  await app.getByRole("button", { name: "Avisar" }).click();
  await expect(app.locator(ALERTA)).toContainText("Escribe el número de referencia");
  await app.getByLabel(/Número de referencia/).fill(REF);
  await app.getByRole("button", { name: "Avisar" }).click();
  await expect(app.getByTestId("form-aviso").getByRole("status")).toContainText("Avisamos a FleteYa");

  // En Inicio aún no recibe viajes y lo manda a su alta
  await app.goto("/motorista");
  await expect(app.getByTestId("no-puede")).toContainText("en revisión");
  await expect(app.getByTestId("ir-alta")).toHaveAttribute("href", "/motorista/alta");

  const m = await db.motorista.findUniqueOrThrow({ where: { telefono }, include: { _count: { select: { documentos: true } } } });
  expect(m.autoRegistro).toBe(true);
  expect(m.creadoPorId).toBeNull();
  expect(m.estado).toBe("PENDIENTE");
  expect(m._count.documentos).toBe(10);
  expect(m.accesoReferencia).toBe(REF);
  expect(m.debeCambiarPassword).toBe(false);
  await ctx.close();
});

test("el mismo teléfono no se puede registrar dos veces", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const app = await ctx.newPage();
  await app.goto("/motorista/registro");
  await app.getByLabel("Nombre completo").fill("Otro Motorista Repetido");
  await app.getByLabel("Celular").fill(telefono);
  await app.getByLabel("Número de DUI").fill(duiAleatorio());
  await app.getByLabel("Crea tu contraseña").fill(CLAVE);
  await app.getByLabel("Repite la contraseña").fill(CLAVE);
  await app.getByTestId("siguiente").click();
  await app.getByLabel("Número de licencia").fill("99887766");
  await app.getByLabel("Fecha de vencimiento").fill("2030-01-01");
  await app.getByTestId("siguiente").click();
  await app.getByLabel("Placa").fill(`P ${100 + Math.floor(Math.random() * 900)}-${100 + Math.floor(Math.random() * 900)}`);
  await app.getByLabel("Tipo de vehículo").selectOption("PICKUP");
  await app.getByLabel("Marca").fill("Toyota");
  await app.getByLabel("Modelo").fill("Hilux");
  await app.getByLabel(/Capacidad/).fill("1");
  await app.getByTestId("siguiente").click();
  for (const [t, f] of FOTOS) await app.locator(`input[name="doc_${t}"]`).setInputFiles(path.join(FIX, f));
  await app.getByTestId("siguiente").click();
  await app.getByLabel(/Leí y acepto/).check();
  await app.getByTestId("siguiente").click();
  await app.getByTestId("pagar-activar").click();
  // Vuelve al paso 1 con el error y sin perder las fotos
  await expect(app.getByText("Ya hay un motorista con este teléfono")).toBeVisible({ timeout: 30_000 });
  await expect(app.getByTestId("titulo-paso")).toContainText("Tus datos");
  expect(await app.locator('input[name="doc_VEHICULO_DERECHA"]').evaluate((i: HTMLInputElement) => i.files?.length)).toBe(1);
  await ctx.close();
});

test("el propietario ve el aviso, registra el acceso y lo aprueba", async ({ page, browser }) => {
  const m = await db.motorista.findUniqueOrThrow({ where: { telefono } });
  await entrarPanel(page);
  await page.goto(`/panel/motoristas?f=pendientes&q=${encodeURIComponent(placa)}`);
  await expect(page.getByText("se registró solo").first()).toBeVisible();
  await expect(page.getByTestId("estado-acceso").first()).toHaveText("Avisó su pago");

  await page.goto(`/panel/motoristas/${m.id}`);
  await expect(page.getByText("por él mismo desde la app")).toBeVisible();
  await expect(page.getByText("Se registró desde la app por el motorista")).toBeVisible();
  await expect(page.getByTestId("aviso-pago")).toContainText(REF);
  await expect(page.getByTestId("falta-acceso")).toBeVisible();

  const acceso = page.getByTestId("pago-acceso");
  await expect(acceso.getByLabel("Número de referencia")).toHaveValue(REF);
  await acceso.getByRole("button", { name: /Registrar pago/ }).click();
  await expect(acceso.getByText("Confirma que viste el dinero")).toBeVisible();
  await acceso.getByLabel(/Revisé en el banco/).check();
  await acceso.getByRole("button", { name: /Registrar pago/ }).click();
  await expect(page.getByTestId("pago-acceso")).toContainText("Acceso pagado");

  // Comprobante del acceso: no suma créditos
  await page.getByTestId("pago-acceso").getByRole("link", { name: "Ver comprobante" }).click();
  await expect(page.getByTestId("concepto-recibo")).toContainText("Acceso a la plataforma");
  await expect(page.getByTestId("recibo")).toContainText("$10.00");
  const bd = await db.motorista.findUniqueOrThrow({ where: { id: m.id }, select: { saldoCreditos: true, accesoPagadoEn: true } });
  expect(Number(bd.saldoCreditos)).toBe(0);
  expect(bd.accesoPagadoEn).not.toBeNull();

  await page.goto(`/panel/motoristas/${m.id}`);
  for (const t of ["El DUI es legible", "La licencia está vigente", "La tarjeta de circulación coincide", "Las 4 fotos del vehículo"]) await page.getByLabel(new RegExp(t)).check();
  await page.getByRole("button", { name: "Aprobar motorista" }).click();
  await expect(page.locator("[role=status]").first()).toContainText("Motorista aprobado");

  // El motorista entra con su propia contraseña y ve su alta completa
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const app = await ctx.newPage();
  await app.goto("/motorista/entrar");
  await app.getByLabel("Número de teléfono").fill(telefono);
  await app.getByLabel("Contraseña", { exact: true }).fill(CLAVE);
  await app.getByRole("button", { name: /Entrar/ }).click();
  await expect(app).toHaveURL(/\/motorista$/);
  await expect(app.getByTestId("no-puede")).toContainText("No tienes créditos");
  await app.goto("/motorista/alta");
  await expect(app.getByTestId("paso-pago")).toHaveAttribute("data-ok", "si");
  await expect(app.getByTestId("paso-revision")).toHaveAttribute("data-ok", "si");
  await ctx.close();
});
