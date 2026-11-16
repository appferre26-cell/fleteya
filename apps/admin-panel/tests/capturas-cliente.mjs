// Capturas de la Parte 2 (link del cliente y secciones nuevas del panel), en computadora y celular.
// Uso: CAPTURAS=carpeta E2E_CORREO=... E2E_PASSWORD=... node tests/capturas-cliente.mjs
import { chromium } from "@playwright/test";
const B = process.env.E2E_URL ?? "http://localhost:3000", D = process.env.CAPTURAS ?? "capturas";
const br = await chromium.launch();
const errores = [];
const nuevaPagina = async (ctx) => {
  const p = await ctx.newPage();
  p.on("console", (m) => m.type() === "error" && !/tile\.openstreetmap/.test(m.text()) && errores.push(m.text()));
  return p;
};
async function desborde(p, n) {
  const w = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (w > 0) errores.push(`${n}: desborde horizontal ${w}px`);
}
async function foto(p, nombre, suf, completa = true) {
  await p.waitForTimeout(1200); // mosaicos del mapa
  await p.screenshot({ path: `${D}/${nombre}-${suf}.png`, fullPage: completa });
  await desborde(p, `${nombre} ${suf}`);
}
async function tocarMapa(p, dx = 0, dy = 0) {
  const m = p.locator(".leaflet-container").first();
  await m.scrollIntoViewIfNeeded();
  const c = await m.boundingBox();
  await p.mouse.click(c.x + c.width / 2 + dx, c.y + c.height / 2 + dy);
}

for (const [tam, suf] of [[{ width: 390, height: 844 }, "cel"], [{ width: 1366, height: 860 }, "pc"]]) {
  const ctx = await br.newContext({ viewport: tam, deviceScaleFactor: suf === "cel" ? 2 : 1, locale: "es-SV" });
  const p = await nuevaPagina(ctx);

  // Panel
  await p.goto(B + "/login");
  await p.fill('input[name="correo"]', process.env.E2E_CORREO);
  await p.fill('input[name="password"]', process.env.E2E_PASSWORD);
  await p.getByRole("button", { name: /Entrar/ }).click();
  await p.waitForURL(/\/panel$/);

  await p.goto(B + "/panel/catalogo");
  const ejemplos = p.getByRole("button", { name: /Cargar ejemplos/ });
  if (await ejemplos.isVisible()) { await foto(p, "p2-1-catalogo-vacio", suf); await ejemplos.click(); await p.getByTestId("fila-material").first().waitFor(); }
  await foto(p, "p2-2-catalogo", suf);

  await p.goto(B + "/panel/puntos-qr");
  if ((await p.getByTestId("punto-qr").count()) === 0) {
    await p.getByLabel("Ferretería", { exact: true }).fill("Ferretería de prueba");
    await p.getByLabel("Dirección", { exact: true }).fill("Lourdes, Colón · dirección de prueba");
    await tocarMapa(p);
    await p.getByRole("button", { name: "Crear QR" }).click();
    await p.getByTestId("punto-qr").first().waitFor();
  }
  await foto(p, "p2-3-puntos-qr", suf);
  const imprimir = await p.getByTestId("punto-qr").first().getByRole("link", { name: /Imprimir/ }).getAttribute("href");
  const codigo = (await p.getByTestId("punto-qr").first().locator("span.font-mono").first().innerText()).trim();
  await p.goto(B + imprimir);
  await foto(p, "p2-4-cartel-qr", suf);

  await p.goto(B + "/panel/tarifas");
  await foto(p, "p2-5-tarifas", suf);

  if (suf === "cel") {
    await p.goto(B + "/panel");
    await p.getByRole("button", { name: "Más" }).click();
    await foto(p, "p2-6-menu-mas", suf, false);
  }

  // Cliente (sin sesión: otra ventana)
  const ctxC = await br.newContext({ viewport: tam, deviceScaleFactor: suf === "cel" ? 2 : 1, locale: "es-SV" });
  const c = await nuevaPagina(ctxC);
  await c.goto(B + "/pedir");
  await foto(c, "p2-7-pedir-vacio", suf);
  await c.goto(`${B}/pedir?f=${codigo}`);
  await tocarMapa(c, 70, 50);
  await c.locator("#destino-dir").fill("Col. Las Brisas, pasaje 3, casa 12");
  await c.getByRole("button", { name: "Agregar material" }).click();
  await c.getByRole("button", { name: /Bolsa de cemento/ }).click();
  await c.getByLabel("Cantidad de Bolsa de cemento").fill("10");
  await c.getByRole("button", { name: "Agregar material" }).click();
  await c.getByRole("button", { name: /Bloque de concreto/ }).click();
  await c.getByLabel(/Cantidad de Bloque de concreto/).fill("30");
  await c.getByLabel("Tu nombre").fill("Cliente de prueba");
  await c.getByLabel("Tu celular").fill("7000-0001");
  await c.getByRole("checkbox").check();
  await foto(c, "p2-8-pedir-lleno", suf);
  await c.getByRole("button", { name: /Solicitar FleteYa/ }).click();
  await c.waitForURL(/\/viaje\//);
  await foto(c, "p2-9-viaje-cliente", suf);
  await c.goto(B + "/terminos");
  await foto(c, "p2-10-terminos", suf, false);
  await ctxC.close();

  // El pedido en el panel
  await p.goto(B + "/panel/viajes");
  await foto(p, "p2-11-viajes", suf);
  await p.getByTestId("fila-viaje").first().click();
  await p.waitForURL(/\/panel\/viajes\/c/);
  await foto(p, "p2-12-viaje-detalle", suf);
  await ctx.close();
}
await br.close();
console.log(errores.length ? errores.join("\n") : "sin errores ni desbordes");
