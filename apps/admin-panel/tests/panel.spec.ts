import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const CORREO = process.env.E2E_CORREO ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const FIX = path.join(__dirname, "fixtures");

/** Foto "de cámara" grande (3000×2000, varios MB) hecha en el navegador, para probar que se reduce. */
async function fotoGrande(page: Page) {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 3000; c.height = 2000;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(3000, 2000);
    for (let i = 0; i < img.data.length; i++) img.data[i] = (i * 2654435761) >>> 24;
    ctx.putImageData(img, 0, 0);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.95));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = "";
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  });
  const buffer = Buffer.from(b64, "base64");
  expect(buffer.length).toBeGreaterThan(MAX_DOC);
  return { name: "camara.jpg", mimeType: "image/jpeg", buffer };
}
const MAX_DOC = 4 * 1024 * 1024;

/** Las otras 9 fotos (DUI reverso, licencia, tarjeta y las 4 del vehículo). */
async function subirResto(page: Page) {
  const resto: [string, string][] = [["DUI_REVERSO", "dui.jpg"], ["LICENCIA_FRENTE", "licencia.jpg"], ["LICENCIA_REVERSO", "licencia.jpg"],
    ["TARJETA_FRENTE", "tarjeta.jpg"], ["TARJETA_REVERSO", "tarjeta.jpg"], ["VEHICULO_FRENTE", "tarjeta.jpg"], ["VEHICULO_ATRAS", "licencia.jpg"],
    ["VEHICULO_IZQUIERDA", "dui.jpg"], ["VEHICULO_DERECHA", "tarjeta.jpg"]];
  for (const [t, f] of resto) await page.locator(`input[name="doc_${t}"]`).setInputFiles(path.join(FIX, f));
}

/** DUI válido aleatorio (8 dígitos + verificador). */
function duiAleatorio() {
  const d = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10));
  const suma = d.reduce((s, n, i) => s + n * (9 - i), 0);
  return `${d.join("")}-${(10 - (suma % 10)) % 10}`;
}
const telAleatorio = () => `7${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
const placaAleatoria = () => `P ${100 + Math.floor(Math.random() * 900)}-${100 + Math.floor(Math.random() * 900)}`;

async function entrar(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(CORREO);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: /Entrar al panel/ }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

test.beforeAll(() => {
  if (!CORREO || !PASSWORD) throw new Error("Define E2E_CORREO y E2E_PASSWORD");
});

test("sin sesión no se entra al panel ni a los documentos", async ({ page, request }) => {
  await page.goto("/panel/motoristas");
  await expect(page).toHaveURL(/\/login$/);
  expect((await request.get("/api/documentos/cualquiera")).status()).toBe(401);
});

test("contraseña incorrecta muestra error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(CORREO);
  await page.getByLabel("Contraseña", { exact: true }).fill("incorrecta-123");
  await page.getByRole("button", { name: /Entrar al panel/ }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Correo o contraseña incorrectos");
});

test("flujo completo de un motorista", async ({ page }) => {
  const tel = telAleatorio();
  const dui = duiAleatorio();
  const placa = placaAleatoria();
  const nombre = `Prueba ${tel.slice(-4)} Martínez`;

  await entrar(page);
  await page.goto("/panel/motoristas");
  await page.getByRole("link", { name: /Agregar motorista/ }).first().click();
  await expect(page).toHaveURL(/\/motoristas\/nuevo$/);

  // 1) Vacío → errores
  await page.getByRole("button", { name: /Registrar motorista/ }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Revisa los campos");
  await expect(page.getByText("Escribe el nombre completo")).toBeVisible();

  // 2) DUI con dígito verificador malo + archivo que no es imagen
  const malo = dui.slice(0, 9) + String((Number(dui[9]) + 1) % 10);
  await page.getByLabel("Nombre completo").fill(nombre);
  await page.getByLabel(/Celular/).fill(tel);
  await page.getByLabel("Número de DUI").fill(malo);
  await page.getByLabel("Número de licencia").fill(dui);
  await page.getByLabel("Fecha de vencimiento").fill("2029-06-30");
  await page.getByLabel("Placa").fill(placa.toLowerCase());
  await page.getByLabel("Tipo de vehículo").selectOption("PICKUP");
  await page.getByLabel("Marca").fill("Toyota");
  await page.getByLabel("Modelo").fill("Hilux");
  await page.getByLabel(/Capacidad/).fill("1");
  await page.locator('input[name="doc_DUI_FRENTE"]').setInputFiles(path.join(FIX, "falso.jpg"));
  await page.getByRole("button", { name: /Registrar motorista/ }).click();
  await expect(page.getByText("DUI no válido")).toBeVisible();
  await expect(page.getByText("Sube una foto (JPG, PNG) o un PDF")).toBeVisible();
  await expect(page.getByLabel("Nombre completo")).toHaveValue(nombre); // conserva lo escrito

  // 3) Datos correctos; la foto grande se reduce en el navegador
  await page.getByLabel("Número de DUI").fill(dui);
  await page.locator('input[name="doc_DUI_FRENTE"]').setInputFiles(await fotoGrande(page));
  await expect(page.getByText(/^Foto · \d/)).toBeVisible();
  await subirResto(page);
  // Facturación con crédito fiscal: sin NRC no deja guardar
  await page.getByTestId("requiere-ccf").check();
  await page.getByLabel("NIT").fill("0614-010190-101-1");
  await page.getByRole("button", { name: /Registrar motorista/ }).click();
  await expect(page.getByText("Escribe tu NRC")).toBeVisible();
  await page.locator('input[name="doc_DUI_FRENTE"]').setInputFiles(path.join(FIX, "dui.jpg"));
  await subirResto(page);
  await page.getByLabel(/^NRC/).fill("123456-7");
  await page.getByLabel("Nombre o razón social").fill(nombre);
  await page.getByLabel(/Giro/).fill("Transporte de carga");
  await page.getByLabel("Dirección").fill("Lourdes, Colón");
  await page.getByRole("button", { name: /Registrar motorista/ }).click();
  await expect(page.getByText(`${nombre} quedó registrado`)).toBeVisible();
  const pass1 = (await page.getByTestId("password-temporal").textContent())!.trim();
  expect(pass1).toMatch(/^[A-Z]{3}-\d{4}$/);
  await expect(page.getByRole("link", { name: /Enviar por WhatsApp/ })).toHaveAttribute("href", new RegExp(`wa\\.me/503${tel}`));

  // 4) Teléfono repetido → error
  await page.goto("/panel/motoristas/nuevo");
  await page.getByLabel("Nombre completo").fill("Otro Motorista");
  await page.getByLabel(/Celular/).fill(`${tel.slice(0, 4)}-${tel.slice(4)}`);
  await page.getByLabel("Número de DUI").fill(duiAleatorio());
  await page.getByLabel("Número de licencia").fill("12345");
  await page.getByLabel("Fecha de vencimiento").fill("2029-01-01");
  await page.getByLabel("Placa").fill(placaAleatoria());
  await page.getByLabel("Tipo de vehículo").selectOption("CAMION_LIVIANO");
  await page.getByLabel("Marca").fill("Isuzu");
  await page.getByLabel("Modelo").fill("NPR");
  await page.getByLabel(/Capacidad/).fill("3");
  await page.getByRole("button", { name: /Registrar motorista/ }).click();
  await expect(page.getByText("Ya hay un motorista con este teléfono")).toBeVisible();

  // 5) Aparece en la lista de pendientes y la búsqueda por placa lo encuentra
  await page.goto(`/panel/motoristas?f=pendientes&q=${encodeURIComponent(placa)}`);
  await expect(page.getByText(nombre).first()).toBeVisible();
  await page.getByRole("link", { name: /Revisar documentos/ }).first().click();

  // 6) Documentos visibles (la foto se sirve con sesión)
  const img = page.getByRole("img", { name: "DUI (frente)" });
  await expect(img).toBeVisible();
  expect(await img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeLessThanOrEqual(1800);
  expect(await img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);

  await expect(page.getByTestId("datos-fiscales")).toContainText("123456-7");

  // 7) Sin pago de acceso no se puede aprobar; se registra en efectivo
  await expect(page.getByTestId("falta-acceso")).toBeVisible();
  const acceso = page.getByTestId("pago-acceso");
  await acceso.locator("label", { hasText: "Efectivo" }).click();
  await acceso.getByRole("button", { name: /Registrar pago de \$10\.00/ }).click();
  await expect(page.getByTestId("pago-acceso")).toContainText("Acceso pagado");

  // Aprobar sin marcar casillas → error; marcando las 4 → Activo
  await page.getByRole("button", { name: "Aprobar motorista" }).click();
  await expect(page.getByText("Marca todas las casillas")).toBeVisible();
  for (const t of ["El DUI es legible", "La licencia está vigente", "La tarjeta de circulación coincide", "Las 4 fotos del vehículo"]) await page.getByLabel(new RegExp(t)).check();
  await page.getByRole("button", { name: "Aprobar motorista" }).click();
  await expect(page.locator("[role=status]").first()).toContainText("Motorista aprobado");
  await expect(page.locator("h1 + span")).toHaveText("Activo");

  // 8) Suspender con motivo y reactivar
  await page.getByRole("button", { name: "Suspender" }).click();
  await page.getByLabel(/Motivo/).fill("Prueba de suspensión");
  await page.getByRole("button", { name: "Confirmar suspensión" }).click();
  await expect(page.locator("[role=status]").first()).toContainText("suspendido");
  await expect(page.getByText("Motivo de la suspensión")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Reactivar" }).click();
  await expect(page.locator("[role=status]").first()).toContainText("Motorista reactivado");
  await expect(page.locator("h1 + span")).toHaveText("Activo");

  // 9) Restablecer contraseña → una distinta
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Restablecer contraseña" }).click();
  const pass2 = (await page.getByTestId("password-temporal").textContent())!.trim();
  expect(pass2).toMatch(/^[A-Z]{3}-\d{4}$/);
  expect(pass2).not.toBe(pass1);

  // 10) Editar datos
  await page.getByRole("link", { name: /Editar datos/ }).click();
  await page.getByLabel("Modelo").fill("Hilux 2020");
  await page.getByRole("button", { name: /Guardar cambios/ }).click();
  await expect(page.locator("[role=status]").first()).toContainText("Cambios guardados");
  await page.getByRole("link", { name: "Volver al detalle" }).click();
  await expect(page.getByText("Toyota Hilux 2020")).toBeVisible();
  await expect(page.getByText("Datos editados por")).toBeVisible();
});

test("administradores: agregar y desactivar un propietario", async ({ page, browser }) => {
  const correo = `socio${Date.now()}@prueba.com`;
  await entrar(page);
  await page.goto("/panel/administradores");
  await page.getByLabel("Nombre completo").fill("Socio De Prueba");
  await page.getByLabel("Correo").fill(correo);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  const pass = (await page.getByTestId("password-propietario").textContent())!.trim();

  // El nuevo socio puede entrar en otra sesión
  const otro = await browser.newPage();
  await otro.goto("/login");
  await otro.getByLabel("Correo electrónico").fill(correo);
  await otro.getByLabel("Contraseña", { exact: true }).fill(pass);
  await otro.getByRole("button", { name: /Entrar al panel/ }).click();
  await expect(otro).toHaveURL(/\/panel$/);

  // Al desactivarlo pierde el acceso de inmediato
  await page.reload();
  const fila = page.locator("li", { hasText: correo });
  page.once("dialog", (d) => d.accept());
  await fila.getByRole("button", { name: "Desactivar" }).click();
  await expect(fila.getByText("Cuenta desactivada")).toBeVisible();
  await otro.goto("/panel/motoristas");
  await expect(otro).toHaveURL(/\/login$/);
  await otro.close();
});
