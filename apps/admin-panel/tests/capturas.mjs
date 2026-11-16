import { chromium } from "@playwright/test";
const B = process.env.E2E_URL ?? "http://localhost:3000", D = process.env.CAPTURAS ?? "capturas";
const br = await chromium.launch();
const errores = [];
async function sesion(ctx) {
  const p = await ctx.newPage();
  p.on("console", m => m.type() === "error" && errores.push(m.text()));
  await p.goto(B + "/login");
  return p;
}
async function entrar(p) {
  await p.fill('input[name="correo"]', process.env.E2E_CORREO);
  await p.fill('input[name="password"]', process.env.E2E_PASSWORD);
  await p.getByRole("button", { name: /Entrar/ }).click();
  await p.waitForURL(/\/panel/);
}
async function desborde(p, n) {
  const w = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (w > 0) errores.push(`${n}: desborde horizontal ${w}px`);
}
for (const [tam, suf] of [[{ width: 1366, height: 860 }, "pc"], [{ width: 390, height: 844 }, "cel"]]) {
  const ctx = await br.newContext({ viewport: tam, deviceScaleFactor: suf === "cel" ? 2 : 1 });
  const p = await sesion(ctx);
  await p.screenshot({ path: `${D}/1-login-${suf}.png` }); await desborde(p, "login " + suf);
  await entrar(p);
  await p.screenshot({ path: `${D}/2-inicio-${suf}.png`, fullPage: true }); await desborde(p, "inicio " + suf);
  await p.goto(B + "/panel/motoristas");
  await p.screenshot({ path: `${D}/3-motoristas-${suf}.png`, fullPage: true }); await desborde(p, "lista " + suf);
  const href = await p.locator('a[href^="/panel/motoristas/c"]').first().getAttribute("href");
  await p.goto(B + "/panel/motoristas/nuevo");
  await p.screenshot({ path: `${D}/4-nuevo-${suf}.png`, fullPage: true }); await desborde(p, "nuevo " + suf);
  if (href) { await p.goto(B + href); await p.waitForTimeout(500);
    await p.screenshot({ path: `${D}/5-detalle-${suf}.png`, fullPage: true }); await desborde(p, "detalle " + suf); }
  await p.goto(B + "/panel/administradores");
  await p.screenshot({ path: `${D}/6-administradores-${suf}.png`, fullPage: true }); await desborde(p, "admins " + suf);
  await ctx.close();
}
await br.close();
console.log(errores.length ? errores.join("\n") : "sin errores ni desbordes");
