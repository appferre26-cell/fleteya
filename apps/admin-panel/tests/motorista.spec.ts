import { expect, test, type Browser, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Parte 3: app del motorista (/motorista) y lo que ve el cliente y el panel.
// Los motoristas y los viajes se preparan directo en la base (las recargas son de la Parte 4).
const db = new PrismaClient();
const CORREO = process.env.E2E_CORREO ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const CLAVE = "clave-segura-1";
const ALERTA = "[role=alert]:not(#__next-route-announcer__)";
const azar = (n: number) => String(Math.floor(Math.random() * 10 ** n)).padStart(n, "0");
// Lourdes, Colón (dentro de la zona)
const LOURDES = { lat: 13.725, lng: -89.37 };

test.describe.configure({ mode: "serial" });

type OpcMotorista = { saldo?: number; estado?: "PENDIENTE" | "ACTIVO" | "SUSPENDIDO"; listo?: boolean; capacidadTon?: number; nombre?: string };
async function crearMotorista(o: OpcMotorista = {}) {
  const prop = await db.propietario.findUniqueOrThrow({ where: { correo: CORREO } });
  const telefono = `7${azar(7)}`;
  const m = await db.motorista.create({
    data: {
      nombre: o.nombre ?? `Motorista ${telefono.slice(-4)} Prueba`, telefono, passwordHash: await bcrypt.hash(o.listo ? CLAVE : "TMP-1234", 10),
      debeCambiarPassword: !o.listo, dui: `${azar(8)}-${azar(1)}`, licenciaNumero: azar(10), licenciaVence: new Date("2030-01-01"),
      placa: `P ${azar(6)}`, marca: "Toyota", modelo: "Hilux", tipoVehiculo: "PICKUP", capacidadTon: o.capacidadTon ?? 1.5,
      estado: o.estado ?? "ACTIVO", creadoPorId: prop.id, saldoCreditos: o.saldo ?? 20,
      terminosVersion: o.listo ? "0.1" : null, terminosAceptadosEn: o.listo ? new Date() : null,
    },
  });
  return { ...m, clave: o.listo ? CLAVE : "TMP-1234" };
}

let n = 0;
async function crearViaje(o: { pesoKg?: number; precio?: number; lejos?: boolean } = {}) {
  n++;
  const codigo = `e2e${Date.now()}${n}`;
  return db.viaje.create({
    data: {
      codigo, clienteNombre: `Cliente ${n} Prueba`, clienteTelefono: `6${azar(7)}`,
      origenDireccion: `Ferretería Prueba ${n}-${azar(5)}`, origenLat: LOURDES.lat, origenLng: LOURDES.lng,
      destinoDireccion: o.lejos ? "Santa Tecla centro" : "Colonia Las Moras", destinoLat: o.lejos ? 13.676 : 13.73, destinoLng: o.lejos ? -89.28 : -89.36,
      distanciaKm: o.lejos ? 11.2 : 1.2, pesoKg: o.pesoKg ?? 500, precioBase: o.precio ?? 10, fueraDeRango: !!o.lejos, aceptoTerminosEn: new Date(),
      items: { create: [{ nombre: "Cemento gris", unidad: "Bolsa", cantidad: (o.pesoKg ?? 500) / 42.5, pesoUnitKg: 42.5, pesoTotalKg: o.pesoKg ?? 500 }] },
    },
  });
}

/** Deja la base sin solicitudes abiertas de otras corridas para que no aparezcan avisos ajenos. */
async function limpiar() {
  await db.viaje.updateMany({ where: { estado: { in: ["BUSCANDO", "ASIGNADO", "EN_CAMINO", "CARGANDO", "EN_RUTA"] } }, data: { estado: "CANCELADO", canceladoPor: "PROPIETARIO", motivoCancelacion: "Limpieza de pruebas", canceladoEn: new Date() } });
  await db.motorista.updateMany({ where: { disponible: true }, data: { disponible: false } });
}

async function appMotorista(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: { latitude: 13.722, longitude: -89.368 }, permissions: ["geolocation"], locale: "es-SV", timezoneId: "America/El_Salvador" });
  return ctx.newPage();
}

async function entrarMotorista(page: Page, telefono: string, clave: string) {
  await page.goto("/motorista/entrar");
  await page.getByLabel("Número de teléfono").fill(`${telefono.slice(0, 4)}-${telefono.slice(4)}`);
  await page.getByLabel("Contraseña", { exact: true }).fill(clave);
  await page.getByRole("button", { name: /Entrar/ }).click();
}

async function entrarPanel(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(CORREO);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: /Entrar al panel/ }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

async function ponerDisponible(page: Page) {
  const b = page.getByTestId("disponible");
  await expect(b).toHaveAttribute("aria-checked", "false");
  await b.click();
  await expect(b).toHaveAttribute("aria-checked", "true");
}

test.beforeAll(async () => {
  if (!CORREO || !PASSWORD) throw new Error("Define E2E_CORREO y E2E_PASSWORD");
  await limpiar();
});
test.afterAll(async () => { await limpiar(); await db.$disconnect(); });

test("las sesiones de motorista y propietario están separadas", async ({ page, request, browser }) => {
  // Sin sesión
  await page.goto("/motorista");
  await expect(page).toHaveURL(/\/motorista\/entrar$/);
  await expect(page.getByText("No hay registro en la app")).toBeVisible();
  expect((await request.get("/motorista/api/estado")).status()).toBe(401);
  await page.goto("/motorista/legal/terminos");
  await expect(page.locator(".legal h1, .legal h2").first()).toBeVisible();

  // Con sesión de propietario no se abre la app del motorista
  await entrarPanel(page);
  await page.goto("/motorista/creditos");
  await expect(page).toHaveURL(/\/motorista\/entrar$/);

  // Con sesión de motorista no se abre el panel
  const m = await crearMotorista({ listo: true });
  const app = await appMotorista(browser);
  await entrarMotorista(app, m.telefono, m.clave);
  await expect(app).toHaveURL(/\/motorista$/);
  await app.goto("/panel/viajes");
  await expect(app).toHaveURL(/\/login$/);
  // El correo/contraseña del propietario no sirve en la app del motorista
  await app.goto("/motorista/salir");
  await app.getByLabel("Número de teléfono").fill(CORREO);
  await app.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await app.getByRole("button", { name: /Entrar/ }).click();
  await expect(app.locator(ALERTA)).toBeVisible();
  await app.context().close();
});

test("primer ingreso: contraseña incorrecta, cambio obligatorio y términos", async ({ browser, page }) => {
  const m = await crearMotorista({ saldo: 0 });
  const app = await appMotorista(browser);
  await entrarMotorista(app, m.telefono, "otra-cosa");
  await expect(app.locator(ALERTA)).toContainText("Teléfono o contraseña incorrectos");

  await entrarMotorista(app, m.telefono, m.clave);
  await expect(app).toHaveURL(/\/motorista\/contrasena$/);
  await app.goto("/motorista/creditos"); // no deja saltarse el paso
  await expect(app).toHaveURL(/\/motorista\/contrasena$/);
  await app.getByLabel("Contraseña temporal").fill(m.clave);
  await app.getByLabel("Nueva contraseña (mínimo 8)").fill("corta");
  await app.getByLabel("Repite la nueva contraseña").fill("corta");
  await app.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(app.locator(ALERTA)).toContainText("al menos 8");
  await app.getByLabel("Contraseña temporal").fill(m.clave);
  await app.getByLabel("Nueva contraseña (mínimo 8)").fill(CLAVE);
  await app.getByLabel("Repite la nueva contraseña").fill(CLAVE);
  await app.getByRole("button", { name: "Guardar contraseña" }).click();

  await expect(app).toHaveURL(/\/motorista\/terminos$/);
  await expect(app.getByText("Primer ingreso")).toBeVisible();
  await app.getByRole("button", { name: /Aceptar y continuar/ }).click();
  await expect(app.locator(ALERTA)).toContainText("Marca la casilla");
  await app.getByLabel(/He leído y acepto/).check();
  await app.getByRole("button", { name: /Aceptar y continuar/ }).click();
  await expect(app).toHaveURL(/\/motorista$/);

  // Sin créditos no puede ponerse disponible
  await expect(app.getByTestId("no-puede")).toContainText("No tienes créditos");
  await expect(app.getByTestId("disponible")).toHaveCount(0);

  // La nueva contraseña funciona; el panel muestra los términos aceptados
  await app.goto("/motorista/salir");
  await entrarMotorista(app, m.telefono, CLAVE);
  await expect(app).toHaveURL(/\/motorista$/);
  await entrarPanel(page);
  await page.goto(`/panel/motoristas/${m.id}`);
  await expect(page.getByTestId("app-motorista")).toContainText("Aceptó los Términos para Motoristas (v0.1)");
  await expect(page.getByTestId("saldo-motorista")).toHaveText("$0.00");
  await app.context().close();
});

test("cuenta en revisión o suspendida no recibe viajes", async ({ browser }) => {
  for (const [estado, texto] of [["PENDIENTE", "en revisión"], ["SUSPENDIDO", "suspendida"]] as const) {
    const m = await crearMotorista({ listo: true, estado });
    const app = await appMotorista(browser);
    await entrarMotorista(app, m.telefono, m.clave);
    await expect(app.getByTestId("no-puede")).toContainText(texto);
    await app.context().close();
  }
});

test("viaje completo: aviso, aceptar, pasos, entrega y comisión del 10 %", async ({ browser, page }) => {
  await limpiar();
  const m = await crearMotorista({ listo: true, saldo: 1.5, nombre: "José Prueba Ramírez" });
  const pesado = await crearViaje({ pesoKg: 2000, precio: 20 }); // más de lo que lleva su pick-up (1.5 ton)
  const app = await appMotorista(browser);
  await entrarMotorista(app, m.telefono, m.clave);
  await ponerDisponible(app);
  await expect(app.getByTestId("estado-conexion")).toHaveText(/En línea/);
  await expect(app.getByTestId("sin-solicitudes")).toBeVisible();

  // Llega una solicitud: aviso emergente con cuenta regresiva de 30 s
  const v = await crearViaje({ pesoKg: 1200, precio: 12 });
  const alerta = app.getByTestId("alerta");
  await expect(alerta).toBeVisible({ timeout: 15_000 });
  await expect(alerta).toContainText("Nueva solicitud");
  await expect(alerta.getByTestId("precio-solicitud")).toHaveText("$12.00");
  await expect(alerta).toContainText("se descuentan $1.20 (10%)");
  await expect(alerta.getByLabel(/segundos para responder/)).toBeVisible();
  await expect(app.getByText(pesado.origenDireccion)).toHaveCount(0); // el pesado no le aparece

  await alerta.getByRole("button", { name: "ACEPTAR" }).click();
  await expect(alerta).toHaveCount(0);
  const activo = app.getByTestId("viaje-activo");
  await expect(activo).toBeVisible();
  await expect(activo.getByTestId("precio-activo")).toHaveText("$12.00");
  await expect(activo.getByTestId("meta")).toHaveText(v.origenDireccion);
  await expect(activo.getByRole("link", { name: /Google Maps/ })).toHaveAttribute("href", /google\.com\/maps\/dir\/\?api=1&destination=13\.725,-89\.37/);
  await expect(activo.getByRole("link", { name: /Waze/ })).toHaveAttribute("href", /waze\.com\/ul\?ll=13\.725,-89\.37&navigate=yes/);
  await expect(activo.getByTestId("llamar-cliente")).toHaveAttribute("href", `tel:+503${v.clienteTelefono}`);

  // El cliente ve a su motorista y lo puede llamar
  const cliente = await browser.newPage();
  await cliente.goto(`/viaje/${v.codigo}`);
  await expect(cliente.getByTestId("estado-viaje")).toContainText("Motorista asignado");
  await expect(cliente.getByTestId("nombre-motorista")).toHaveText("José Prueba Ramírez");
  await expect(cliente.getByTestId("placa")).toHaveText(m.placa);
  await expect(cliente.getByTestId("llamar-motorista")).toHaveAttribute("href", `tel:+503${m.telefono}`);

  // Pasos del viaje
  const pasos = [["Voy en camino a recoger", "En camino a recogida"], ["Ya llegué · Iniciar carga", "Cargando"], ["Carga lista · Salir al destino", "En ruta al destino"], ["Entrega completada", ""]];
  for (let i = 0; i < 3; i++) {
    const [boton, estado] = pasos[i];
    await app.getByTestId("avanzar").filter({ hasText: boton }).click();
    await expect(app.getByTestId("avanzar")).toContainText(pasos[i + 1][0]);
    await expect(async () => {
      await cliente.reload();
      await expect(cliente.getByTestId("estado-viaje")).toContainText(estado, { timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
  }
  await expect(activo.getByTestId("meta")).toHaveText(v.destinoDireccion); // ahora la navegación va al destino
  await expect(cliente.getByRole("button", { name: "Cancelar pedido" })).toHaveCount(0); // ya cargó: no puede cancelar

  // Entrega: comisión $1.20 de $1.50 → quedan $0.30
  await app.getByTestId("avanzar").filter({ hasText: "Entrega completada" }).click();
  await expect(app.getByTestId("aviso")).toContainText("Se descontaron $1.20 de tus créditos. Te quedan $0.30.");
  await expect(app.getByTestId("viajes-hoy")).toHaveText("1");
  await expect(app.getByTestId("ganancias-hoy")).toHaveText("$12.00");
  await cliente.reload();
  await expect(cliente.getByTestId("estado-viaje")).toContainText("Entregado");

  // Créditos y viajes
  await app.goto("/motorista/creditos");
  await expect(app.getByTestId("saldo")).toHaveText("$0.30");
  await expect(app.getByTestId("movimiento").first()).toContainText(/FY-\d{4} · 10%/);
  await expect(app.getByTestId("movimiento").first()).toContainText("-$1.20");
  await app.goto("/motorista/viajes?p=hoy");
  await expect(app.getByTestId("resumen-viajes")).toContainText("$12.00");
  await expect(app.getByTestId("viaje-historial").first()).toContainText("-$1.20");

  // Panel: motorista, comisión y saldo
  await entrarPanel(page);
  await page.goto(`/panel/viajes/${v.id}`);
  await expect(page.getByTestId("estado-viaje")).toHaveText("Entregado");
  await expect(page.getByTestId("motorista-viaje")).toContainText("José Prueba Ramírez");
  await expect(page.getByTestId("comision")).toHaveText("$1.20");
  await page.goto(`/panel/motoristas/${m.id}`);
  await expect(page.getByTestId("saldo-motorista")).toHaveText("$0.30");

  // Segundo viaje con poco saldo: avisa que la diferencia queda debiendo y el saldo pasa a negativo
  await app.goto("/motorista");
  const v2 = await crearViaje({ pesoKg: 1000, precio: 10 });
  await expect(app.getByTestId("alerta")).toBeVisible({ timeout: 15_000 });
  await app.getByTestId("alerta").getByRole("button", { name: "ACEPTAR" }).click();
  await expect(app.getByTestId("aviso")).toContainText("Te quedan $0.30 en créditos. Este viaje descuenta $1.00. Los $0.70 restantes se descontarán de tu siguiente recarga.");
  for (let i = 0; i < 4; i++) {
    await app.getByTestId("avanzar").filter({ hasText: pasos[i][0] }).click();
    if (i < 3) await expect(app.getByTestId("avanzar")).toContainText(pasos[i + 1][0]);
  }
  await expect(app.getByTestId("aviso")).toContainText("Tu saldo quedó en $-0.70");
  await expect(app.getByTestId("no-puede")).toContainText("No tienes créditos");
  expect(Number((await db.viaje.findUniqueOrThrow({ where: { id: v2.id } })).comision)).toBe(1);
  await cliente.close();
  await app.context().close();
});

test("rechazar una solicitud: ya no le vuelve a salir", async ({ browser }) => {
  await limpiar();
  const m = await crearMotorista({ listo: true });
  const app = await appMotorista(browser);
  await entrarMotorista(app, m.telefono, m.clave);
  await ponerDisponible(app);
  const v = await crearViaje();
  await expect(app.getByTestId("alerta")).toBeVisible({ timeout: 15_000 });
  await app.getByTestId("alerta").getByRole("button", { name: "RECHAZAR" }).click();
  await expect(app.getByTestId("alerta")).toHaveCount(0);
  await app.waitForTimeout(6000); // un ciclo de consulta
  await expect(app.getByText(v.origenDireccion)).toHaveCount(0);
  await expect(app.getByTestId("sin-solicitudes")).toBeVisible();
  // Desconectarse
  await app.getByTestId("disponible").click();
  await expect(app.getByTestId("disponible")).toHaveAttribute("aria-checked", "false");
  await expect(app.getByTestId("estado-conexion")).toHaveText(/Desconectado/);
  await app.context().close();
});

test("dos motoristas aceptan el mismo viaje a la vez: solo uno se lo queda", async ({ browser }) => {
  await limpiar();
  const [a, b] = await Promise.all([crearMotorista({ listo: true }), crearMotorista({ listo: true })]);
  const [pa, pb] = await Promise.all([appMotorista(browser), appMotorista(browser)]);
  await entrarMotorista(pa, a.telefono, a.clave);
  await entrarMotorista(pb, b.telefono, b.clave);
  await ponerDisponible(pa);
  await ponerDisponible(pb);
  const v = await crearViaje();
  await expect(pa.getByTestId("alerta")).toBeVisible({ timeout: 15_000 });
  await expect(pb.getByTestId("alerta")).toBeVisible({ timeout: 15_000 });
  await Promise.all([
    pa.getByTestId("alerta").getByRole("button", { name: "ACEPTAR" }).click(),
    pb.getByTestId("alerta").getByRole("button", { name: "ACEPTAR" }).click(),
  ]);
  await expect(async () => {
    const ganadores = (await pa.getByTestId("viaje-activo").count()) + (await pb.getByTestId("viaje-activo").count());
    expect(ganadores).toBe(1);
    const perdedor = (await pa.getByTestId("viaje-activo").count()) ? pb : pa;
    await expect(perdedor.locator(ALERTA)).toContainText("Otro motorista ya tomó este viaje");
  }).toPass({ timeout: 10_000 });
  const fila = await db.viaje.findUniqueOrThrow({ where: { id: v.id } });
  expect(fila.estado).toBe("ASIGNADO");
  expect([a.id, b.id]).toContain(fila.motoristaId);
  await pa.context().close();
  await pb.context().close();
});

test("viaje lejano: el motorista ofrece otro precio y el cliente decide", async ({ browser }) => {
  await limpiar();
  const m = await crearMotorista({ listo: true, nombre: "Carlos Oferta López" });
  const app = await appMotorista(browser);
  await entrarMotorista(app, m.telefono, m.clave);
  await ponerDisponible(app);
  const v = await crearViaje({ lejos: true, precio: 10 });
  const alerta = app.getByTestId("alerta");
  await expect(alerta).toBeVisible({ timeout: 15_000 });
  await expect(alerta).toContainText("más lejos que los km incluidos");
  await alerta.getByRole("button", { name: "Ver después" }).click();

  const tarjeta = app.getByTestId("solicitud").filter({ hasText: v.origenDireccion });
  await tarjeta.getByRole("button", { name: /Ofrecer otro precio/ }).click();
  await tarjeta.getByLabel("Tu precio en dólares").fill("8");
  await tarjeta.getByRole("button", { name: "Enviar" }).click();
  await expect(tarjeta.locator(ALERTA)).toContainText("no puede ser menor que $10.00");
  await tarjeta.getByLabel("Tu precio en dólares").fill("18");
  await tarjeta.getByRole("button", { name: "Enviar" }).click();
  await expect(app.getByTestId("oferta-pendiente")).toContainText("Ofreciste $18.00");

  // El cliente la ve y dice que no
  const cliente = await browser.newPage();
  await cliente.goto(`/viaje/${v.codigo}`);
  const oferta = cliente.getByTestId("oferta");
  await expect(oferta).toContainText("Carlos");
  await expect(oferta).toContainText("$18.00");
  await oferta.getByRole("button", { name: "No, gracias" }).click();
  await expect(cliente.getByTestId("ofertas")).toHaveCount(0);
  await expect(app.getByTestId("oferta-rechazada")).toContainText("no aceptó $18.00", { timeout: 15_000 });

  // Nueva oferta; esta vez la acepta → viaje asignado a $15
  const t2 = app.getByTestId("solicitud").filter({ hasText: v.origenDireccion });
  await t2.getByRole("button", { name: /Ofrecer otro precio/ }).click();
  await t2.getByLabel("Tu precio en dólares").fill("15");
  await t2.getByRole("button", { name: "Enviar" }).click();
  await expect(app.getByTestId("oferta-pendiente")).toContainText("Ofreciste $15.00");
  await cliente.reload();
  await cliente.getByTestId("oferta").getByRole("button", { name: "Aceptar $15.00" }).click();
  await expect(cliente.getByTestId("estado-viaje")).toContainText("Motorista asignado");
  await expect(cliente.getByTestId("precio-viaje")).toHaveText("$15.00");
  await expect(cliente.getByTestId("nombre-motorista")).toHaveText("Carlos Oferta López");
  await expect(app.getByTestId("viaje-activo")).toBeVisible({ timeout: 15_000 });
  await expect(app.getByTestId("precio-activo")).toHaveText("$15.00");

  // El cliente cancela mientras el motorista va en camino → la app le avisa
  await cliente.getByRole("button", { name: "Cancelar pedido" }).click();
  await cliente.getByRole("button", { name: "Sí, cancelar" }).click();
  await expect(cliente.getByTestId("estado-viaje")).toContainText("Cancelado");
  await expect(app.getByTestId("aviso")).toContainText("El cliente canceló el viaje", { timeout: 15_000 });
  await expect(app.getByTestId("viaje-activo")).toHaveCount(0);
  expect(Number((await db.motorista.findUniqueOrThrow({ where: { id: m.id } })).saldoCreditos)).toBe(20);
  await cliente.close();
  await app.context().close();
});

test("soltar un viaje: vuelve a la lista para otros y él ya no lo ve", async ({ browser }) => {
  await limpiar();
  const [a, b] = await Promise.all([crearMotorista({ listo: true }), crearMotorista({ listo: true })]);
  const pa = await appMotorista(browser);
  await entrarMotorista(pa, a.telefono, a.clave);
  await ponerDisponible(pa);
  const v = await crearViaje();
  await expect(pa.getByTestId("alerta")).toBeVisible({ timeout: 15_000 });
  await pa.getByTestId("alerta").getByRole("button", { name: "ACEPTAR" }).click();
  await pa.getByRole("button", { name: "No puedo hacer este viaje" }).click();
  await pa.getByRole("button", { name: "Sí, soltar" }).click();
  await expect(pa.getByTestId("aviso")).toContainText("Soltaste el viaje");
  await expect(pa.getByTestId("viaje-activo")).toHaveCount(0);
  await expect(pa.getByText(v.origenDireccion)).toHaveCount(0);

  const pb = await appMotorista(browser);
  await entrarMotorista(pb, b.telefono, b.clave);
  await ponerDisponible(pb);
  await expect(pb.getByTestId("solicitud").filter({ hasText: v.origenDireccion }).first()).toBeVisible({ timeout: 15_000 });
  await pa.context().close();
  await pb.context().close();
});

test("perfil del motorista y cerrar sesión", async ({ browser }) => {
  const m = await crearMotorista({ listo: true });
  const app = await appMotorista(browser);
  await entrarMotorista(app, m.telefono, m.clave);
  await app.getByRole("link", { name: "Perfil" }).click();
  await expect(app.getByText(m.placa)).toBeVisible();
  await expect(app.getByText(m.dui)).toBeVisible();
  await app.getByRole("link", { name: /Cerrar sesión/ }).click();
  await expect(app).toHaveURL(/\/motorista\/entrar$/);
  await app.goto("/motorista");
  await expect(app).toHaveURL(/\/motorista\/entrar$/);
  await app.context().close();
});
