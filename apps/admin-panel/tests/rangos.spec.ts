import { expect, test, type Browser, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Parte 5: botones rápidos por toneladas en el link del cliente y contrapropuesta del motorista dentro de los km incluidos.
const db = new PrismaClient();
const CORREO = process.env.E2E_CORREO ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const CLAVE = "clave-segura-1";
const ALERTA = "[role=alert]:not(#__next-route-announcer__)";
const azar = (n: number) => String(Math.floor(Math.random() * 10 ** n)).padStart(n, "0");
const LOURDES = { lat: 13.725, lng: -89.37 };

test.describe.configure({ mode: "serial" });

const creados: string[] = [];
async function crearMotorista(capacidadTon: number, nombre?: string) {
  const prop = await db.propietario.findUniqueOrThrow({ where: { correo: CORREO } });
  const telefono = `7${azar(7)}`;
  const m = await db.motorista.create({
    data: {
      nombre: nombre ?? `Motorista ${telefono.slice(-4)} Rangos`, telefono, passwordHash: await bcrypt.hash(CLAVE, 10),
      debeCambiarPassword: false, dui: `${azar(8)}-${azar(1)}`, licenciaNumero: azar(10), licenciaVence: new Date("2030-01-01"),
      placa: `C ${azar(6)}`, marca: "Isuzu", modelo: "NPR", tipoVehiculo: capacidadTon > 3 ? "CAMION_MEDIANO_GRANDE" : "CAMION_LIVIANO",
      capacidadTon, estado: "ACTIVO", creadoPorId: prop.id, saldoCreditos: 20, terminosVersion: "0.1", terminosAceptadosEn: new Date(),
    },
  });
  creados.push(m.id);
  return m;
}

async function limpiar() {
  await db.viaje.updateMany({ where: { estado: { in: ["BUSCANDO", "ASIGNADO", "EN_CAMINO", "CARGANDO", "EN_RUTA"] } }, data: { estado: "CANCELADO", canceladoPor: "PROPIETARIO", motivoCancelacion: "Limpieza de pruebas", canceladoEn: new Date() } });
  await db.motorista.updateMany({ where: { disponible: true }, data: { disponible: false } });
}

async function appMotorista(browser: Browser, telefono: string) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: { latitude: 13.722, longitude: -89.368 }, permissions: ["geolocation"] });
  const app = await ctx.newPage();
  await app.goto("/motorista/entrar");
  await app.getByLabel("Número de teléfono").fill(telefono);
  await app.getByLabel("Contraseña", { exact: true }).fill(CLAVE);
  await app.getByRole("button", { name: /Entrar/ }).click();
  await expect(app).toHaveURL(/\/motorista$/);
  await app.getByTestId("disponible").click();
  await expect(app.getByTestId("disponible")).toHaveAttribute("aria-checked", "true");
  return app;
}

async function viajeCercaPorRango(rango: string, pesoKg: number, precio: number) {
  return db.viaje.create({
    data: {
      codigo: `e2er${Date.now()}${azar(3)}`, clienteNombre: "Ana Rangos", clienteTelefono: `6${azar(7)}`,
      origenDireccion: `Ferretería Rangos ${azar(5)}`, origenLat: LOURDES.lat, origenLng: LOURDES.lng,
      destinoDireccion: "Colonia Las Moras", destinoLat: 13.73, destinoLng: -89.36, distanciaKm: 1.2,
      pesoKg, precioBase: precio, fueraDeRango: false, rangoTon: rango, nota: "20 bolsas de cemento", aceptoTerminosEn: new Date(),
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

test.beforeAll(async () => {
  if (!CORREO || !PASSWORD) throw new Error("Define E2E_CORREO y E2E_PASSWORD");
  await limpiar();
  await db.configuracion.update({ where: { id: 1 }, data: { contraofertaEnRango: true } });
});
test.afterAll(async () => {
  await limpiar();
  // Los motoristas de prueba no deben cambiar la capacidad máxima que ve el cliente en otras pruebas
  await db.motorista.updateMany({ where: { id: { in: creados } }, data: { estado: "SUSPENDIDO" } });
  await db.configuracion.update({ where: { id: 1 }, data: { contraofertaEnRango: true } });
  await db.$disconnect();
});

test("cliente: elige por toneladas, ve el precio al instante y pide", async ({ page }) => {
  await crearMotorista(6); // hay un camión de 6 ton: se puede pedir «más de 3»
  const qr = await db.puntoQR.findFirstOrThrow({ where: { activo: true } });
  const tel = `7${azar(7)}`;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/pedir?f=${qr.codigo}`);

  // Por toneladas es lo primero que ve; cada botón ya muestra su precio
  await expect(page.getByRole("tab", { name: "Por toneladas" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("rango-0-1")).toContainText("$10.00");
  await expect(page.getByTestId("rango-1-2")).toContainText("$20.00");
  await expect(page.getByTestId("rango-2-3")).toContainText("$30.00");
  await expect(page.getByTestId("rango-3+")).toContainText("desde $35.00");
  await expect(page.getByTestId("precio")).toHaveText("—");

  await page.getByTestId("rango-1-2").click();
  await expect(page.getByTestId("rango-1-2")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("precio")).toHaveText("$20.00");
  await expect(page.getByTestId("peso")).toContainText("1 a 2 ton");
  await expect(page.getByTestId("aviso-contraoferta")).toContainText("Un motorista puede proponerte otro precio");

  // Más de 3: escoge cuántas toneladas
  await page.getByTestId("rango-3+").click();
  await expect(page.getByTestId("ton-extra")).toHaveText("4 ton");
  await expect(page.getByTestId("precio")).toHaveText("$40.00");
  await page.getByRole("button", { name: "Más toneladas" }).click();
  await expect(page.getByTestId("precio")).toHaveText("$45.00");
  await page.getByRole("button", { name: "Menos toneladas" }).click();
  await page.getByRole("button", { name: "Menos toneladas" }).click();
  await expect(page.getByTestId("ton-extra")).toHaveText("3.5 ton");
  await expect(page.getByRole("button", { name: "Menos toneladas" })).toBeDisabled();

  // Pide con 1 a 2 toneladas
  await page.getByTestId("rango-1-2").click();
  const mapa = page.locator(".leaflet-container").first();
  await mapa.scrollIntoViewIfNeeded();
  const caja = (await mapa.boundingBox())!;
  await page.mouse.click(caja.x + caja.width / 2 + 50, caja.y + caja.height / 2 + 30);
  await page.locator("#destino-dir").fill("Col. Las Brisas, casa 12");
  await page.getByLabel("Nota para el motorista").fill("20 bolsas de cemento");
  await page.getByLabel("Tu nombre").fill("Cliente Rangos");
  await page.getByLabel("Tu celular").fill(tel);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Solicitar FleteYa · \$20\.00/ }).click();

  await expect(page).toHaveURL(/\/viaje\/[a-z0-9]{16}$/);
  await expect(page.getByTestId("precio-viaje")).toHaveText("$20.00");
  await expect(page.getByTestId("rango-viaje")).toContainText("1 a 2 toneladas");
  const v = await db.viaje.findFirstOrThrow({ where: { clienteTelefono: tel }, include: { items: true } });
  expect(v.rangoTon).toBe("1-2");
  expect(Number(v.pesoKg)).toBe(2000);
  expect(Number(v.precioBase)).toBe(20);
  expect(v.items).toHaveLength(0);
});

test("dentro de los 5 km: el motorista propone otro precio y el cliente lo acepta", async ({ browser, page }) => {
  await limpiar();
  const m = await crearMotorista(3, "Mario Contraoferta Díaz");
  const app = await appMotorista(browser, m.telefono);
  const v = await viajeCercaPorRango("1-2", 2000, 20);

  const alerta = app.getByTestId("alerta");
  await expect(alerta).toBeVisible({ timeout: 15_000 });
  await expect(alerta.getByTestId("rango-solicitud")).toContainText("1 a 2 toneladas");
  await expect(alerta.getByRole("button", { name: "ACEPTAR $20.00" })).toBeVisible();
  await alerta.getByRole("button", { name: "Ver después" }).click();

  const tarjeta = app.getByTestId("solicitud").filter({ hasText: v.origenDireccion });
  await tarjeta.getByRole("button", { name: /Proponer otro precio/ }).click();
  await tarjeta.getByLabel("Tu precio en dólares").fill("20");
  await tarjeta.getByRole("button", { name: "Enviar" }).click();
  await expect(tarjeta.locator(ALERTA)).toContainText("debe ser mayor que $20.00");
  await tarjeta.getByLabel("Tu precio en dólares").fill("25");
  await tarjeta.getByRole("button", { name: "Enviar" }).click();
  await expect(app.getByTestId("oferta-pendiente")).toContainText("Ofreciste $25.00");

  // El cliente ve la contrapropuesta y la acepta
  const cliente = await browser.newPage();
  await cliente.goto(`/viaje/${v.codigo}`);
  await expect(cliente.getByText("Un motorista te puede proponer otro precio")).toBeVisible();
  const oferta = cliente.getByTestId("oferta");
  await expect(oferta).toContainText("Mario");
  await oferta.getByRole("button", { name: "Aceptar $25.00" }).click();
  await expect(cliente.getByTestId("estado-viaje")).toContainText("Motorista asignado");
  await expect(cliente.getByTestId("precio-viaje")).toHaveText("$25.00");
  await expect(app.getByTestId("precio-activo")).toHaveText("$25.00", { timeout: 15_000 });
  await expect(app.getByTestId("viaje-activo").getByTestId("rango-solicitud")).toContainText("1 a 2 toneladas");

  // El panel ve el rango y el precio acordado
  await entrarPanel(page);
  await page.goto(`/panel/viajes/${v.id}`);
  await expect(page.getByTestId("rango-viaje")).toContainText("1 a 2 toneladas");
  await expect(page.getByTestId("precio-final")).toHaveText("$25.00");
  await cliente.close();
  await app.context().close();
});

test("el propietario puede apagar las contrapropuestas dentro de los km incluidos", async ({ browser, page }) => {
  await limpiar();
  await entrarPanel(page);
  await page.goto("/panel/tarifas");
  const casilla = page.getByLabel(/Permitir contrapropuestas dentro de los km incluidos/);
  await expect(casilla).toBeChecked();
  await casilla.uncheck();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("status")).toContainText("guardadas");
  expect((await db.configuracion.findUniqueOrThrow({ where: { id: 1 } })).contraofertaEnRango).toBe(false);

  const m = await crearMotorista(3);
  const app = await appMotorista(browser, m.telefono);
  const v = await viajeCercaPorRango("0-1", 1000, 10);
  const alerta = app.getByTestId("alerta");
  await expect(alerta).toBeVisible({ timeout: 15_000 });
  await alerta.getByRole("button", { name: "Ver después" }).click();
  const tarjeta = app.getByTestId("solicitud").filter({ hasText: v.origenDireccion });
  await expect(tarjeta.getByRole("button", { name: "ACEPTAR", exact: true })).toBeVisible();
  await expect(tarjeta.getByRole("button", { name: /otro precio/ })).toHaveCount(0);

  // El cliente ya no ve el aviso de contrapropuesta
  const cliente = await browser.newPage();
  await cliente.goto(`/viaje/${v.codigo}`);
  await expect(cliente.getByText("Un motorista te puede proponer otro precio")).toHaveCount(0);

  // Se vuelve a encender
  await page.reload();
  await page.getByLabel(/Permitir contrapropuestas dentro de los km incluidos/).check();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("status")).toContainText("guardadas");
  expect((await db.configuracion.findUniqueOrThrow({ where: { id: 1 } })).contraofertaEnRango).toBe(true);
  await cliente.close();
  await app.context().close();
});
