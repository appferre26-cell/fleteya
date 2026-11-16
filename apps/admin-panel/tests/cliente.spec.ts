import { expect, test, type Page } from "@playwright/test";

// Parte 2: link del cliente (/pedir), QR por ferretería, catálogo, tarifas y viajes en el panel.
const CORREO = process.env.E2E_CORREO ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const sufijo = String(Date.now()).slice(-6);
const MATERIAL = `Prueba saco ${sufijo}`; // 10 kg c/u
const FERRE = `Ferretería Prueba ${sufijo}`;
const telAleatorio = () => `7${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;

test.describe.configure({ mode: "serial" });

async function entrar(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(CORREO);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: /Entrar al panel/ }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

/** Toca el mapa (Leaflet) en un punto relativo a su centro. */
async function tocarMapa(page: Page, dx = 0, dy = 0) {
  const mapa = page.locator(".leaflet-container").first();
  await expect(mapa).toBeVisible();
  await mapa.scrollIntoViewIfNeeded();
  const caja = (await mapa.boundingBox())!;
  await page.mouse.click(caja.x + caja.width / 2 + dx, caja.y + caja.height / 2 + dy);
}

let codigoQR = "";

test.beforeAll(() => {
  if (!CORREO || !PASSWORD) throw new Error("Define E2E_CORREO y E2E_PASSWORD");
});

test("sin sesión: el link del cliente abre, el panel nuevo no", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/pedir$/);
  await expect(page.getByText("¿Qué vas a llevar?")).toBeVisible();
  for (const ruta of ["/panel/viajes", "/panel/catalogo", "/panel/puntos-qr", "/panel/tarifas"]) {
    await page.goto(ruta);
    await expect(page).toHaveURL(/\/login$/);
  }
  await page.goto("/terminos");
  await expect(page.locator(".legal h1, .legal h2").first()).toBeVisible();
  await page.goto("/privacidad");
  await expect(page.locator(".legal h1, .legal h2").first()).toBeVisible();
});

test("propietario: catálogo, tarifas y punto QR con cartel", async ({ page }) => {
  await entrar(page);

  // Catálogo
  await page.getByRole("link", { name: /Catálogo de materiales/ }).first().click();
  await expect(page).toHaveURL(/\/panel\/catalogo$/);
  await page.getByLabel("Material", { exact: true }).fill(MATERIAL);
  await page.getByLabel("Unidad", { exact: true }).fill("Saco");
  await page.getByLabel("Peso por unidad (kg)").fill("10");
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(MATERIAL);
  await expect(page.getByTestId("fila-material").filter({ hasText: MATERIAL })).toContainText("10 kg c/u");
  // Duplicado
  await page.getByLabel("Material", { exact: true }).fill(MATERIAL);
  await page.getByLabel("Unidad", { exact: true }).fill("Saco");
  await page.getByLabel("Peso por unidad (kg)").fill("10");
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(page.getByText("Ya hay un material con ese nombre")).toBeVisible();

  // Tarifas: valores de la Fase 1 y guardar
  await page.goto("/panel/tarifas");
  await expect(page.getByLabel("Precio por tonelada ($)")).toHaveValue("10");
  await expect(page.getByLabel("Tarifa mínima ($)")).toHaveValue("10");
  await expect(page.getByLabel("Km incluidos en el precio")).toHaveValue("5");
  await page.getByLabel("Precio por tonelada ($)").fill("0");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Mínimo $1")).toBeVisible();
  await page.getByLabel("Precio por tonelada ($)").fill("10");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("status")).toContainText("guardadas");

  // Punto QR: sin ubicación da error; con clic en el mapa se crea
  await page.goto("/panel/puntos-qr");
  await page.getByLabel("Ferretería", { exact: true }).fill(FERRE);
  await page.getByLabel("Dirección", { exact: true }).fill("Lourdes, Colón · frente al parque");
  await page.getByRole("button", { name: "Crear QR" }).click();
  await expect(page.locator("p.text-error").first()).toBeVisible();
  await tocarMapa(page);
  await page.getByRole("button", { name: "Crear QR" }).click();
  const tarjeta = page.getByTestId("punto-qr").filter({ hasText: FERRE });
  await expect(tarjeta).toBeVisible();
  codigoQR = (await tarjeta.locator("span.font-mono").first().innerText()).trim();
  expect(codigoQR).toMatch(/^FER\d{3,}$/);
  await expect(tarjeta.getByRole("img")).toHaveAttribute("src", /^data:image\/png/);

  // Cartel imprimible
  const href = await tarjeta.getByRole("link", { name: /Imprimir/ }).getAttribute("href");
  await page.goto(href!);
  await expect(page.getByText("¿Necesitas llevar tus materiales?")).toBeVisible();
  await expect(page.getByText("$10.00 por tonelada")).toBeVisible();
  await expect(page.getByRole("img", { name: `QR ${codigoQR}` })).toBeVisible();
});

test("cliente: campos obligatorios", async ({ page }) => {
  await page.goto("/pedir");
  await expect(page.getByTestId("precio")).toHaveText("—");
  await page.getByRole("button", { name: /Solicitar FleteYa/ }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText("Marca en el mapa dónde recogemos")).toBeVisible();
  await expect(page.getByText("Agrega al menos un material")).toBeVisible();
  await expect(page.getByText("Escribe tu nombre")).toBeVisible();
  await expect(page.getByText("Debes aceptar los Términos")).toBeVisible();
});

test("cliente: pide desde el QR, ve su viaje y lo cancela; el panel lo ve", async ({ page }) => {
  test.skip(!codigoQR, "Necesita el punto QR de la prueba anterior");
  const tel = telAleatorio();
  await page.goto(`/pedir?f=${codigoQR}`);
  await expect(page.locator("#origen-dir")).toHaveValue(new RegExp(FERRE));
  await expect(page.getByText("Desde QR")).toBeVisible();

  // Destino: un clic en el mapa (cerca de la ferretería)
  await tocarMapa(page, 60, 40);
  await page.locator("#destino-dir").fill("Col. Las Brisas, pasaje 3, casa 12, portón negro");

  // 150 sacos de 10 kg = 1,500 kg → 1.5 ton × $10 = $15.00 (proporcional al peso)
  await page.getByRole("button", { name: "Agregar material" }).click();
  await page.getByLabel("Buscar material").fill(MATERIAL);
  await page.getByRole("button", { name: new RegExp(MATERIAL) }).click();
  await page.getByLabel(`Cantidad de ${MATERIAL}`).fill("150");
  await expect(page.getByTestId("peso")).toContainText("1,500 kg");
  await expect(page.getByTestId("precio")).toHaveText("$15.00");

  // Con más peso del que lleva el vehículo más grande, no deja enviar
  const muyPesado = page.getByText("Es más de lo que lleva el vehículo más grande");
  if (await muyPesado.isVisible()) await expect(page.getByRole("button", { name: /Solicitar FleteYa/ })).toBeDisabled();

  // 90 sacos = 900 kg → menos de 1 ton → tarifa mínima $10.00
  await page.getByLabel(`Cantidad de ${MATERIAL}`).fill("90");
  await expect(page.getByTestId("precio")).toHaveText("$10.00");

  // «Otro» escrito por el cliente: 2 × 25 kg → 950 kg → $10.00
  await page.getByRole("button", { name: "Otro (escribir)" }).click();
  await page.getByLabel("Qué es (otro material)").fill("Puerta de madera");
  await page.getByLabel("Peso por unidad en kg").fill("25");
  await page.getByLabel("Cantidad de Puerta de madera").fill("2");
  await expect(page.getByTestId("peso")).toContainText("950 kg");

  await page.getByLabel("Tu nombre").fill("Cliente Prueba");
  await page.getByLabel("Tu celular").fill(`${tel.slice(0, 4)}-${tel.slice(4)}`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Solicitar FleteYa · \$10\.00/ }).click();

  await expect(page).toHaveURL(/\/viaje\/[a-z0-9]{16}$/);
  await expect(page.getByText("Estamos buscando tu motorista")).toBeVisible();
  await expect(page.getByTestId("precio-viaje")).toHaveText("$10.00");
  await expect(page.getByText(`90 × ${MATERIAL}`)).toBeVisible();
  const linkCliente = page.url();

  // Al volver a /pedir recuerda nombre y teléfono (sin cuenta)
  await page.goto("/pedir");
  await expect(page.getByLabel("Tu nombre")).toHaveValue("Cliente Prueba");
  await expect(page.getByRole("link", { name: /Ver mi último pedido/ })).toBeVisible();

  // Cancelar desde el cliente
  await page.goto(linkCliente);
  await page.getByRole("button", { name: "Cancelar pedido" }).click();
  await page.getByLabel("Motivo de cancelación").fill("Ya conseguí transporte");
  await page.getByRole("button", { name: "Sí, cancelar" }).click();
  await expect(page.getByTestId("estado-viaje")).toContainText("Cancelado");
  await expect(page.getByText("Motivo: Ya conseguí transporte")).toBeVisible();

  // El propietario lo ve en Viajes
  await entrar(page);
  await page.goto(`/panel/viajes?q=${tel}`);
  const fila = page.getByTestId("fila-viaje").first();
  await expect(fila).toContainText("Cliente Prueba");
  await expect(fila).toContainText(codigoQR);
  await expect(fila).toContainText("$10.00");
  await fila.click();
  await expect(page.getByText(/^Cancelado por el cliente/)).toBeVisible();
  await expect(page.getByText(`desde el QR ${codigoQR}`)).toBeVisible();
});

test("propietario cancela un viaje y el cliente ve el motivo", async ({ page, context }) => {
  const tel = telAleatorio();
  await page.goto("/pedir");
  await tocarMapa(page); // recogida en el centro de la zona
  await page.locator("#origen-dir").fill("Ferretería del centro, Lourdes");
  await tocarMapa(page, 40, -30);
  await page.locator("#destino-dir").fill("Residencial Prueba, casa 4");
  await page.getByRole("button", { name: "Otro (escribir)" }).click();
  await page.getByLabel("Qué es (otro material)").fill("Bolsas de arena");
  await page.getByLabel("Peso por unidad en kg").fill("40");
  await page.getByLabel("Cantidad de Bolsas de arena").fill("5");
  await expect(page.getByTestId("precio")).toHaveText("$10.00"); // 200 kg → tarifa mínima
  await page.getByLabel("Tu nombre").fill("Cliente Dos");
  await page.getByLabel("Tu celular").fill(tel);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Solicitar FleteYa/ }).click();
  await expect(page).toHaveURL(/\/viaje\//);
  const linkCliente = page.url();

  const panel = await context.newPage();
  await entrar(panel);
  await panel.goto(`/panel/viajes?f=buscando&q=${tel}`);
  await panel.getByTestId("fila-viaje").first().click();
  await panel.getByRole("button", { name: "Cancelar viaje" }).click();
  await panel.getByRole("button", { name: "Confirmar cancelación" }).click();
  await expect(panel.locator("textarea#motivo:invalid")).toHaveCount(1); // motivo obligatorio
  await panel.getByLabel("Motivo de la cancelación").fill("No hay motorista disponible");
  await panel.getByRole("button", { name: "Confirmar cancelación" }).click();
  await expect(panel.getByTestId("estado-viaje")).toHaveText("Cancelado");
  await expect(panel.getByText(/^Cancelado por FleteYa ·/)).toBeVisible();

  await page.goto(linkCliente, { waitUntil: "load" });
  await expect(page.getByTestId("estado-viaje")).toContainText("Cancelado");
  await expect(page.getByText("Este pedido fue cancelado por FleteYa.")).toBeVisible();
  await expect(page.getByText("Motivo: No hay motorista disponible")).toBeVisible();
});
