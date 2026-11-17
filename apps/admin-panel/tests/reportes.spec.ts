import { expect, request, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { periodo, diaSV, sumarDias } from "../src/lib/periodos";

// Parte 7: tablero en vivo, reportes y finanzas (con gastos) e historial de viajes con filtros y Excel.
const db = new PrismaClient();
const CORREO = process.env.E2E_CORREO ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const azar = (n: number) => String(Math.floor(Math.random() * 10 ** n)).padStart(n, "0");
const LOURDES = { lat: 13.725, lng: -89.37 };
const NOMBRE = `Rafa Reportes ${azar(4)}`;
const GASTO = `Volantes prueba ${azar(5)}`;

test.describe.configure({ mode: "serial" });

let motorista: { id: string };
const viajesIds: string[] = [];
let recargaId = "";

const valor = async (page: Page, id: string) => Number((await page.getByTestId(`${id}-valor`).innerText()).replace(/[$,]/g, ""));

async function entrarPanel(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(CORREO);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: /Entrar al panel/ }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

function viaje(extra: Record<string, unknown>) {
  return db.viaje.create({
    data: {
      codigo: `e2er${Date.now()}${azar(4)}`, clienteNombre: "Rita Reportes", clienteTelefono: `6${azar(7)}`,
      origenDireccion: "Ferretería Reportes", origenLat: LOURDES.lat, origenLng: LOURDES.lng,
      destinoDireccion: "Colonia Reportes", destinoLat: 13.73, destinoLng: -89.36, distanciaKm: 1.5,
      pesoKg: 2000, precioBase: 20, fueraDeRango: false, rangoTon: "1-2", aceptoTerminosEn: new Date(), ...extra,
    },
  });
}

test.beforeAll(async () => {
  if (!CORREO || !PASSWORD) throw new Error("Define E2E_CORREO y E2E_PASSWORD");
});
test.afterAll(async () => {
  await db.viaje.updateMany({ where: { id: { in: viajesIds }, estado: { not: "ENTREGADO" } }, data: { estado: "CANCELADO", canceladoPor: "PROPIETARIO", motivoCancelacion: "Limpieza de pruebas", canceladoEn: new Date() } });
  if (motorista) await db.motorista.update({ where: { id: motorista.id }, data: { estado: "SUSPENDIDO", disponible: false } });
  await db.gasto.deleteMany({ where: { concepto: GASTO } });
  await db.$disconnect();
});

test("periodos en hora de El Salvador", () => {
  const p = periodo("mes-anterior", undefined, undefined, "2026-01-15");
  expect([p.desde, p.hasta, p.dias]).toEqual(["2025-12-01", "2025-12-31", 31]);
  const s = periodo("semana", undefined, undefined, "2026-11-18"); // miércoles
  expect([s.desde, s.hasta]).toEqual(["2026-11-16", "2026-11-18"]);
  expect(s.inicio.toISOString()).toBe("2026-11-16T06:00:00.000Z");
  expect(s.fin.toISOString()).toBe("2026-11-19T06:00:00.000Z");
  const r = periodo("rango", "2026-11-10", "2026-11-01", "2026-11-16"); // al revés: se ordenan
  expect([r.desde, r.hasta]).toEqual(["2026-11-01", "2026-11-10"]);
  expect(periodo("rango", "basura", "2026-11-01", "2026-11-16").clave).toBe("mes");
  expect(periodo("hoy", undefined, undefined, "2026-11-16").dias).toBe(1);
  // 11:30 p. m. del 16 en El Salvador = 05:30 UTC del 17
  expect(diaSV(new Date("2026-11-17T05:30:00Z"))).toBe("2026-11-16");
});

test("reportes: viajes, comisión y recargas del periodo; por motorista", async ({ page }) => {
  await entrarPanel(page);
  await page.goto("/panel/reportes?periodo=hoy&todos=1");
  const antes = { ent: await valor(page, "rep-entregados"), cob: await valor(page, "rep-cobrado"), com: await valor(page, "rep-comision"), rec: await valor(page, "rep-recargas"), gan: await valor(page, "rep-ganancia") };

  const prop = await db.propietario.findUniqueOrThrow({ where: { correo: CORREO } });
  motorista = await db.motorista.create({
    data: {
      nombre: NOMBRE, telefono: `7${azar(7)}`, passwordHash: await bcrypt.hash("clave-segura-1", 10), debeCambiarPassword: false,
      dui: `${azar(8)}-${azar(1)}`, licenciaNumero: azar(10), licenciaVence: new Date("2030-01-01"), placa: `C ${azar(6)}`,
      marca: "Isuzu", modelo: "NPR", tipoVehiculo: "CAMION_LIVIANO", capacidadTon: 3, estado: "ACTIVO", creadoPorId: prop.id, saldoCreditos: 15,
      terminosVersion: "0.2", terminosAceptadosEn: new Date(),
    },
  });
  const ahora = new Date();
  for (const [precio, estrellas] of [[20, 5], [30, 4]]) {
    const v = await viaje({ estado: "ENTREGADO", motoristaId: motorista.id, precioFinal: precio, comision: precio / 10, asignadoEn: ahora, entregadoEn: ahora, estrellasMotorista: estrellas });
    viajesIds.push(v.id);
  }
  // Uno entregado hace 40 días: no entra en «hoy».
  viajesIds.push((await viaje({ estado: "ENTREGADO", motoristaId: motorista.id, precioFinal: 99, comision: 9.9, creadoEn: new Date(Date.now() - 40 * 86400000), entregadoEn: new Date(Date.now() - 40 * 86400000) })).id);
  recargaId = (await db.recarga.create({
    data: { motoristaId: motorista.id, concepto: "RECARGA", monto: 20, formaPago: "EFECTIVO", saldoAntes: -5, deudaDescontada: 5, saldoDespues: 15, registradoPorId: prop.id },
  })).id;

  await page.reload();
  expect(await valor(page, "rep-entregados")).toBe(antes.ent + 2);
  expect(await valor(page, "rep-cobrado")).toBeCloseTo(antes.cob + 50, 2);
  expect(await valor(page, "rep-comision")).toBeCloseTo(antes.com + 5, 2);
  expect(await valor(page, "rep-recargas")).toBeCloseTo(antes.rec + 20, 2);
  expect(await valor(page, "rep-ganancia")).toBeCloseTo(antes.gan + 20, 2);

  const fila = page.getByTestId(`rep-motorista-${motorista.id}`);
  await expect(fila).toContainText(NOMBRE);
  await expect(fila).toContainText("$50.00");
  await expect(fila).toContainText("$5.00");
  await expect(fila).toContainText("$20.00");
  await expect(fila).toContainText("4.5");
  await expect(fila.locator("td").nth(1)).toHaveText("2");
  await expect(page.getByTestId("grafica")).toBeVisible();

  // Una recarga anulada ya no cuenta.
  await db.recarga.update({ where: { id: recargaId }, data: { anuladaEn: new Date(), motivoAnulacion: "prueba" } });
  await page.reload();
  expect(await valor(page, "rep-recargas")).toBeCloseTo(antes.rec, 2);

  // Mes anterior y fechas a mano
  await page.getByRole("link", { name: "Mes anterior" }).click();
  await expect(page).toHaveURL(/periodo=mes-anterior/);
  const hace40 = sumarDias(diaSV(), -40);
  await page.goto(`/panel/reportes?periodo=rango&desde=${hace40}&hasta=${hace40}&todos=1`);
  await expect(page.getByTestId(`rep-motorista-${motorista.id}`)).toContainText("$99.00");
  await expect(page.getByTestId(`rep-motorista-${motorista.id}`).locator("td").nth(1)).toHaveText("1");
});

test("gastos: errores, se restan de la ganancia neta y se pueden borrar", async ({ page }) => {
  await entrarPanel(page);
  await page.goto("/panel/reportes?periodo=hoy");
  const gan = await valor(page, "rep-ganancia");
  const gastos = await valor(page, "rep-gastos");
  const form = page.getByTestId("form-gasto");

  await form.getByRole("button", { name: /Agregar/ }).click();
  await expect(form.locator("[role=alert]")).toContainText("categoría");
  await form.getByLabel("Categoría").selectOption("Publicidad");
  await form.getByLabel("Detalle del gasto").fill(GASTO);
  await form.getByLabel("Monto del gasto").fill("-3");
  await form.getByRole("button", { name: /Agregar/ }).click();
  await expect(form.locator("[role=alert]")).toContainText("mayor a $0");
  await form.getByLabel("Monto del gasto").fill("12.50");
  await form.getByRole("button", { name: /Agregar/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Gasto de $12.50 guardado" })).toBeVisible();

  await expect(page.getByTestId("fila-gasto").filter({ hasText: GASTO })).toContainText("-$12.50");
  expect(await valor(page, "rep-gastos")).toBeCloseTo(gastos + 12.5, 2);
  expect(await valor(page, "rep-ganancia")).toBeCloseTo(gan - 12.5, 2);

  const csv = await (await page.request.get(`/api/gastos?desde=${diaSV()}&hasta=${diaSV()}`)).text();
  expect(csv).toContain(GASTO);
  expect(csv).toContain("12.50");

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: `Borrar gasto ${GASTO}` }).click();
  await expect(page.getByTestId("fila-gasto").filter({ hasText: GASTO })).toHaveCount(0);
  expect(await valor(page, "rep-ganancia")).toBeCloseTo(gan, 2);
});

test("historial de viajes: filtros por motorista y fechas, y Exportar a Excel", async ({ page }) => {
  await entrarPanel(page);
  await page.goto("/panel/viajes");
  await page.getByLabel("Motorista").selectOption(motorista.id);
  await page.getByLabel("Desde").fill(diaSV());
  await page.getByRole("button", { name: /Filtrar/ }).click();
  await expect(page).toHaveURL(new RegExp(`m=${motorista.id}`));
  await expect(page.getByTestId("fila-viaje")).toHaveCount(2); // el de hace 40 días queda fuera
  await expect(page.getByTestId("totales-viajes")).toContainText("Entregados: 2 · cobrado $50.00 · comisión $5.00");

  // Sin fechas: los 3
  await page.goto(`/panel/viajes?m=${motorista.id}`);
  await expect(page.getByTestId("fila-viaje")).toHaveCount(3);
  await page.getByRole("link", { name: "Quitar" }).click();
  await expect(page).toHaveURL(/\/panel\/viajes$/);

  // Excel con los mismos filtros
  await page.goto(`/panel/viajes?m=${motorista.id}&desde=${diaSV()}`);
  const href = await page.getByTestId("exportar-viajes").getAttribute("href");
  const resp = await page.request.get(href!);
  expect(resp.headers()["content-type"]).toContain("text/csv");
  const lineas = (await resp.text()).trim().split("\r\n");
  expect(lineas[0]).toContain("Precio acordado");
  expect(lineas).toHaveLength(3);
  expect(lineas[1]).toContain(NOMBRE);
  expect(lineas[1]).toContain("1 a 2 toneladas");

  // Sin sesión no se puede descargar
  const anonimo = await request.newContext({ baseURL: test.info().project.use.baseURL });
  expect((await anonimo.get("/api/viajes")).status()).toBe(401);
  expect((await anonimo.get("/api/panel/en-vivo")).status()).toBe(401);
  expect((await anonimo.get("/api/gastos")).status()).toBe(401);
  await anonimo.dispose();
});

test("inicio: mapa en vivo con motoristas conectados y pedidos sin motorista", async ({ page }) => {
  const buscando = await viaje({ origenDireccion: `Ferretería En Vivo ${azar(4)}` });
  viajesIds.push(buscando.id);
  await db.motorista.update({ where: { id: motorista.id }, data: { disponible: true, vistoEn: new Date(), lat: 13.722, lng: -89.368, ubicacionEn: new Date() } });

  await entrarPanel(page);
  const vivo = page.getByTestId("en-vivo");
  await expect(vivo.getByTestId("vivo-motorista").filter({ hasText: NOMBRE })).toContainText("disponible");
  const fila = vivo.getByTestId("vivo-viaje").filter({ hasText: `FY-${String(buscando.numero).padStart(4, "0")}` });
  await expect(fila).toContainText("Buscando motorista");
  await expect(vivo.locator(".leaflet-marker-icon > div").first()).toBeVisible();
  await expect(page.getByTestId("ingresos-hoy")).toContainText("viajes");

  const datos = await (await page.request.get("/api/panel/en-vivo")).json();
  const m = datos.motoristas.find((x: { id: string }) => x.id === motorista.id);
  expect(m).toMatchObject({ conectado: true, lat: 13.722, enViaje: null });

  // Se actualiza solo: el pedido toma motorista y pasa a «en viaje»
  await db.viaje.update({ where: { id: buscando.id }, data: { estado: "EN_CAMINO", motoristaId: motorista.id, precioFinal: 20, asignadoEn: new Date() } });
  await expect(fila).toContainText("Va a recoger", { timeout: 25_000 });
  await expect(vivo.getByTestId("vivo-motorista").filter({ hasText: NOMBRE })).toHaveCount(0);
});
