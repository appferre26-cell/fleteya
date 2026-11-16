import { expect, test, type Browser, type Page } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createECDH, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
// @ts-expect-error sin tipos (viene con web-push)
import ece from "http_ece";

// Parte 8: avisos con la app cerrada (Web Push) y zona de servicio dibujada en el mapa.
// Las pruebas de avisos necesitan el servicio falso: PUSH_BUZON=... node tests/push-falso.mjs
// y el panel encendido con NODE_EXTRA_CA_CERTS=<cert del servicio falso> y claves VAPID.
const db = new PrismaClient();
const CORREO = process.env.E2E_CORREO ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const BUZON = process.env.PUSH_BUZON ?? "";
const PUSH = "https://localhost:4443";
const CLAVE = "clave-segura-1";
const azar = (n: number) => String(Math.floor(Math.random() * 10 ** n)).padStart(n, "0");
const LOURDES = { lat: 13.725, lng: -89.37 };

test.describe.configure({ mode: "serial" });

const creados: string[] = [];
const qrs: string[] = [];
let cfgOriginal: Prisma.ConfiguracionGetPayload<object>;

/** Un «teléfono» de prueba: llaves para descifrar lo que le llegue. */
function telefonoFalso(ruta: string) {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = randomBytes(16).toString("base64url");
  return { ecdh, auth, endpoint: `${PUSH}${ruta}`, p256dh: ecdh.getPublicKey().toString("base64url"), ruta };
}
type Tel = ReturnType<typeof telefonoFalso>;

function avisosDe(t: Tel): { titulo: string; cuerpo: string; url: string; urgente?: boolean; urgencia: string }[] {
  if (!existsSync(BUZON)) return [];
  return readFileSync(BUZON, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l))
    .filter((x) => x.ruta === t.ruta)
    .map((x) => ({ ...JSON.parse(ece.decrypt(Buffer.from(x.cuerpo, "base64"), { version: "aes128gcm", privateKey: t.ecdh, authSecret: t.auth }).toString()), urgencia: x.urgencia }));
}

async function crearMotorista(nombre: string, extra: Partial<Prisma.MotoristaUncheckedCreateInput> = {}) {
  const prop = await db.propietario.findUniqueOrThrow({ where: { correo: CORREO } });
  const m = await db.motorista.create({
    data: {
      nombre, telefono: `7${azar(7)}`, passwordHash: await bcrypt.hash(CLAVE, 10),
      debeCambiarPassword: false, dui: `${azar(8)}-${azar(1)}`, licenciaNumero: azar(10), licenciaVence: new Date("2030-01-01"),
      placa: `C ${azar(6)}`, marca: "Isuzu", modelo: "NPR", tipoVehiculo: "CAMION_LIVIANO",
      capacidadTon: 3, estado: "ACTIVO", creadoPorId: prop.id, saldoCreditos: 20, terminosVersion: "0.1", terminosAceptadosEn: new Date(), ...extra,
    },
  });
  creados.push(m.id);
  return m;
}

async function crearQR(nombre: string, p: { lat: number; lng: number }) {
  const q = await db.puntoQR.create({ data: { codigo: `ZZ${azar(6)}`, nombre, direccion: "Prueba Parte 8", lat: p.lat, lng: p.lng } });
  qrs.push(q.id);
  return q;
}

async function limpiar() {
  await db.viaje.updateMany({ where: { estado: { in: ["BUSCANDO", "ASIGNADO", "EN_CAMINO", "CARGANDO", "EN_RUTA"] } }, data: { estado: "CANCELADO", canceladoPor: "PROPIETARIO", motivoCancelacion: "Limpieza de pruebas", canceladoEn: new Date() } });
  await db.motorista.updateMany({ where: { disponible: true }, data: { disponible: false } });
}

async function entrarPanel(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(CORREO);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: /Entrar al panel/ }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

async function appMotorista(browser: Browser, telefono: string) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: { latitude: 13.722, longitude: -89.368 }, permissions: ["geolocation"] });
  const app = await ctx.newPage();
  await app.goto("/motorista/entrar");
  await app.getByLabel("Número de teléfono").fill(telefono);
  await app.getByLabel("Contraseña", { exact: true }).fill(CLAVE);
  await app.getByRole("button", { name: /Entrar/ }).click();
  await expect(app).toHaveURL(/\/motorista$/);
  return app;
}

/** El cliente pide 0 a 1 tonelada desde el QR; devuelve el código de su pedido (o el error que vio). */
async function pedirDesdeQR(page: Page, codigoQR: string) {
  await page.goto(`/pedir?f=${codigoQR}`);
  await page.getByTestId("rango-0-1").click();
  const mapa = page.locator(".leaflet-container").first();
  await mapa.scrollIntoViewIfNeeded();
  const caja = (await mapa.boundingBox())!;
  await page.mouse.click(caja.x + caja.width / 2 + 50, caja.y + caja.height / 2 + 30);
  await page.locator("#destino-dir").fill("Col. Las Brisas, casa 12");
  await page.getByLabel("Tu nombre").fill("Cliente Avisos");
  await page.getByLabel("Tu celular").fill(`6${azar(7)}`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Solicitar FleteYa/ }).click();
}

// Dirección propia por corrida: así no choca con el límite de pedidos por hora de otras pruebas.
test.use({ extraHTTPHeaders: { "x-forwarded-for": `10.8.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } });

test.beforeAll(async () => {
  if (!CORREO || !PASSWORD) throw new Error("Define E2E_CORREO y E2E_PASSWORD");
  cfgOriginal = await db.configuracion.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  await limpiar();
  if (BUZON) writeFileSync(BUZON, "");
});
test.afterAll(async () => {
  await limpiar();
  const { zonaNombre, zonaLat, zonaLng, zonaRadioKm, zonaPoligono } = cfgOriginal;
  await db.configuracion.update({ where: { id: 1 }, data: { zonaNombre, zonaLat, zonaLng, zonaRadioKm, zonaPoligono: zonaPoligono ?? Prisma.DbNull } });
  await db.suscripcionAviso.deleteMany({ where: { endpoint: { startsWith: PUSH } } });
  await db.puntoQR.updateMany({ where: { id: { in: qrs } }, data: { activo: false } });
  await db.motorista.updateMany({ where: { id: { in: creados } }, data: { estado: "SUSPENDIDO", disponible: false } });
  await db.$disconnect();
});

test("avisos: un pedido nuevo avisa a los motoristas disponibles, no a los desconectados; el teléfono que quitó el permiso se borra", async ({ page }) => {
  test.skip(!BUZON, "Necesita PUSH_BUZON y el servicio de avisos falso");
  const conectado = await crearMotorista("Ana Avisos", { disponible: true, vistoEn: new Date() });
  const apagado = await crearMotorista("Beto Apagado", { disponible: false, vistoEn: new Date() });
  const olvidado = await crearMotorista("Ciro Olvidó", { disponible: true, vistoEn: new Date(Date.now() - 24 * 3600_000) });
  const tA = telefonoFalso(`/m/${conectado.id}`), tB = telefonoFalso(`/m/${apagado.id}`), tC = telefonoFalso(`/m/${olvidado.id}`);
  const viejo = telefonoFalso(`/ya-no/${conectado.id}`);
  for (const [t, id] of [[tA, conectado.id], [tB, apagado.id], [tC, olvidado.id], [viejo, conectado.id]] as const) {
    await db.suscripcionAviso.create({ data: { endpoint: t.endpoint, p256dh: t.p256dh, auth: t.auth, motoristaId: id } });
  }
  const qr = await crearQR(`Ferretería Avisos ${azar(4)}`, LOURDES);
  await pedirDesdeQR(page, qr.codigo);
  await expect(page).toHaveURL(/\/viaje\/[a-z0-9]{16}$/);

  await expect.poll(() => avisosDe(tA).length, { timeout: 15_000 }).toBe(1);
  const [a] = avisosDe(tA);
  expect(a.titulo).toBe("Nueva solicitud de flete");
  expect(a.cuerpo).toContain("$10.00");
  expect(a.cuerpo).toContain(qr.nombre);
  expect(a.url).toBe("/motorista");
  expect(a.urgencia).toBe("high");
  expect(avisosDe(tB)).toHaveLength(0); // no está disponible
  expect(avisosDe(tC)).toHaveLength(0); // dejó «Disponible» encendido pero no abre la app hace un día
  await expect.poll(() => db.suscripcionAviso.count({ where: { endpoint: viejo.endpoint } })).toBe(0); // respondió 410
  await db.motorista.updateMany({ where: { id: { in: [conectado.id, olvidado.id] } }, data: { disponible: false } });
});

test("avisos: el cliente se entera cuando el motorista acepta y cuando va en camino; el motorista, cuando el cliente cancela", async ({ browser, page }) => {
  test.skip(!BUZON, "Necesita PUSH_BUZON y el servicio de avisos falso");
  await limpiar(); // que solo esté el pedido de esta prueba
  const m = await crearMotorista("Diego Avisos Pérez");
  const tM = telefonoFalso(`/m/${m.id}`);
  await db.suscripcionAviso.create({ data: { endpoint: tM.endpoint, p256dh: tM.p256dh, auth: tM.auth, motoristaId: m.id } });
  const app = await appMotorista(browser, m.telefono);
  await app.getByTestId("disponible").click();
  await expect(app.getByTestId("estado-conexion")).toContainText("En línea");

  const qr = await crearQR(`Ferretería Cliente ${azar(4)}`, LOURDES);
  await pedirDesdeQR(page, qr.codigo);
  await expect(page).toHaveURL(/\/viaje\/[a-z0-9]{16}$/);
  const codigo = page.url().split("/viaje/")[1];
  const v = await db.viaje.findUniqueOrThrow({ where: { codigo } });
  const tCli = telefonoFalso(`/c/${codigo}`);
  await db.suscripcionAviso.create({ data: { endpoint: tCli.endpoint, p256dh: tCli.p256dh, auth: tCli.auth, viajeId: v.id } });
  await expect.poll(() => avisosDe(tM).length, { timeout: 15_000 }).toBe(1);

  const alerta = app.getByTestId("alerta");
  await expect(alerta).toBeVisible({ timeout: 15_000 });
  await alerta.getByRole("button", { name: "ACEPTAR" }).click();
  await expect.poll(() => avisosDe(tCli).map((x) => x.titulo), { timeout: 15_000 }).toEqual(["¡Diego aceptó tu flete!"]);
  expect(avisosDe(tCli)[0].cuerpo).toContain(m.placa);
  expect(avisosDe(tCli)[0].url).toBe(`/viaje/${codigo}`);

  await app.getByTestId("avanzar").filter({ hasText: "Voy en camino a recoger" }).click();
  await expect.poll(() => avisosDe(tCli).map((x) => x.titulo), { timeout: 15_000 }).toContain("Tu motorista va en camino");

  await page.reload();
  await page.getByRole("button", { name: "Cancelar pedido" }).click();
  await page.getByRole("button", { name: "Sí, cancelar" }).click();
  await expect(page.getByTestId("estado-viaje")).toContainText("Cancelado");
  await expect.poll(() => avisosDe(tM).map((x) => x.titulo), { timeout: 15_000 }).toContain("El cliente canceló el viaje");
  await app.context().close();
});

test("avisos: el botón para activarlos aparece en el perfil del motorista y en el pedido del cliente", async ({ browser, page }) => {
  test.skip(!BUZON, "Necesita el panel con claves VAPID");
  const m = await crearMotorista("Elsa Botón");
  const app = await appMotorista(browser, m.telefono);
  await app.goto("/motorista/perfil");
  const caja = app.getByTestId("avisos");
  await expect(caja).toBeVisible();
  await expect(caja).toContainText("Avisos con la app cerrada");
  // El navegador de pruebas puede no permitir avisos: basta con que la caja explique el estado.
  await expect(caja).toHaveAttribute("data-estado", /^(inactivo|activo|bloqueado|no-soportado|iphone-instalar)$/);
  await app.context().close();

  const qr = await crearQR(`Ferretería Botón ${azar(4)}`, LOURDES);
  await pedirDesdeQR(page, qr.codigo);
  await expect(page).toHaveURL(/\/viaje\/[a-z0-9]{16}$/);
  await expect(page.getByTestId("avisos")).toContainText("Avísame en este teléfono");
  await expect(page.getByTestId("avisos")).toHaveAttribute("data-estado", /^(inactivo|activo|bloqueado|no-soportado|iphone-instalar)$/);
});

test("zonas: dibujar el área en Tarifas y zona, avisar de QR que quedan fuera y volver al círculo", async ({ page }) => {
  const fuera = await crearQR(`Ferretería Lejana ${azar(4)}`, { lat: LOURDES.lat + 0.2, lng: LOURDES.lng + 0.2 });
  await entrarPanel(page);
  await page.goto("/panel/tarifas");
  await page.getByTestId("zona-area").click();
  const mapa = page.locator(".leaflet-container").first();
  await mapa.scrollIntoViewIfNeeded();
  const c = (await mapa.boundingBox())!;
  const cx = c.x + c.width / 2, cy = c.y + c.height / 2;
  await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeDisabled(); // aún sin área
  await page.mouse.click(cx - 80, cy - 60);
  await page.mouse.click(cx + 80, cy - 60);
  await expect(page.getByText("Faltan 1 puntos")).toBeVisible();
  await page.mouse.click(cx - 80, cy + 60); // queda en «8» al cerrar con el siguiente
  await page.mouse.click(cx + 80, cy + 60);
  await expect(page.getByText("Las líneas del área se cruzan")).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
  await page.getByRole("button", { name: "Deshacer punto" }).click();
  await page.getByRole("button", { name: "Deshacer punto" }).click();
  await page.mouse.click(cx + 80, cy + 60);
  await page.mouse.click(cx - 80, cy + 60);
  await expect(page.getByTestId("info-area")).toContainText("4 puntos");
  await expect(page.getByTestId("info-area")).toContainText("km²");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("status").filter({ hasText: "guardadas" })).toBeVisible();
  await expect(page.getByTestId("aviso-zona")).toContainText(fuera.nombre);

  const cfg = await db.configuracion.findUniqueOrThrow({ where: { id: 1 } });
  const poli = cfg.zonaPoligono as { lat: number; lng: number }[];
  expect(poli).toHaveLength(4);
  // El centro guardado es el centro del área
  expect(cfg.zonaLat).toBeCloseTo(poli.reduce((s, p) => s + p.lat, 0) / 4, 5);

  // Al volver a abrir, sigue en «Dibujar área» con sus 4 puntos; se puede volver al círculo
  await page.reload();
  await expect(page.getByTestId("zona-area")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("info-area")).toContainText("4 puntos");
  await page.getByTestId("zona-circulo").click();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("status").filter({ hasText: "guardadas" })).toBeVisible();
  expect((await db.configuracion.findUniqueOrThrow({ where: { id: 1 } })).zonaPoligono).toBeNull();
});

test("zonas: con área dibujada, el cliente no puede pedir desde fuera y el panel no deja crear QR fuera", async ({ page, browser }) => {
  const d = 0.01; // ~1 km alrededor de Lourdes
  await db.configuracion.update({ where: { id: 1 }, data: { zonaPoligono: [
    { lat: LOURDES.lat - d, lng: LOURDES.lng - d }, { lat: LOURDES.lat - d, lng: LOURDES.lng + d },
    { lat: LOURDES.lat + d, lng: LOURDES.lng + d }, { lat: LOURDES.lat + d, lng: LOURDES.lng - d },
  ], zonaLat: LOURDES.lat, zonaLng: LOURDES.lng, zonaRadioKm: 30 } });
  // Dentro del círculo de 30 km pero fuera del área: manda el área
  const lejos = await crearQR(`Ferretería Fuera ${azar(4)}`, { lat: LOURDES.lat + 0.03, lng: LOURDES.lng });
  await page.goto(`/pedir?f=${lejos.codigo}`);
  await expect(page.getByText("Ese punto está fuera de la zona de servicio")).toBeVisible();
  await expect(page.getByRole("button", { name: /Solicitar FleteYa/ })).toBeDisabled();

  const cerca = await crearQR(`Ferretería Dentro ${azar(4)}`, { lat: LOURDES.lat + 0.002, lng: LOURDES.lng });
  await pedirDesdeQR(page, cerca.codigo);
  await expect(page).toHaveURL(/\/viaje\/[a-z0-9]{16}$/);

  // Panel: el mapa de Puntos QR no deja crear uno fuera del área
  const ctx = await browser.newContext();
  const panel = await ctx.newPage();
  await entrarPanel(panel);
  await panel.goto("/panel/puntos-qr");
  await panel.locator("#qr-nombre").fill("Ferretería Afuera Prueba");
  await panel.locator("#qr-direccion").fill("Fuera del área, prueba");
  const mapa = panel.locator(".leaflet-container").first();
  await mapa.scrollIntoViewIfNeeded();
  const c = (await mapa.boundingBox())!;
  await panel.mouse.click(c.x + c.width - 10, c.y + 10); // esquina: ~1.5 km del centro a zoom 14 (fuera del cuadro de 1 km)
  await panel.getByRole("button", { name: "Crear QR" }).click();
  await expect(panel.getByText("fuera de la zona de servicio")).toBeVisible();
  await ctx.close();
});
