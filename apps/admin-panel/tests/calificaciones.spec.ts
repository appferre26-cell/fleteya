import { expect, test, type Browser, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Parte 6: calificaciones cliente ↔ motorista y sección Clientes (historial, bloquear).
const db = new PrismaClient();
const CORREO = process.env.E2E_CORREO ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const CLAVE = "clave-segura-1";
const ALERTA = "[role=alert]:not(#__next-route-announcer__)";
const azar = (n: number) => String(Math.floor(Math.random() * 10 ** n)).padStart(n, "0");
const LOURDES = { lat: 13.725, lng: -89.37 };
const TEL_CLIENTE = `6${azar(7)}`;

test.describe.configure({ mode: "serial" });

const creados: string[] = [];
let motorista: { id: string; telefono: string; nombre: string };
let viajeApp: { id: string; codigo: string; numero: number };

async function crearMotorista(nombre: string) {
  const prop = await db.propietario.findUniqueOrThrow({ where: { correo: CORREO } });
  const telefono = `7${azar(7)}`;
  const m = await db.motorista.create({
    data: {
      nombre, telefono, passwordHash: await bcrypt.hash(CLAVE, 10),
      debeCambiarPassword: false, dui: `${azar(8)}-${azar(1)}`, licenciaNumero: azar(10), licenciaVence: new Date("2030-01-01"),
      placa: `C ${azar(6)}`, marca: "Isuzu", modelo: "NPR", tipoVehiculo: "CAMION_LIVIANO",
      capacidadTon: 3, estado: "ACTIVO", creadoPorId: prop.id, saldoCreditos: 20, terminosVersion: "0.1", terminosAceptadosEn: new Date(),
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
  return app;
}

function nuevoViaje(extra: Record<string, unknown> = {}) {
  return db.viaje.create({
    data: {
      codigo: `e2ec${Date.now()}${azar(3)}`, clienteNombre: "Carla Calificaciones", clienteTelefono: TEL_CLIENTE,
      origenDireccion: `Ferretería Calif ${azar(5)}`, origenLat: LOURDES.lat, origenLng: LOURDES.lng,
      destinoDireccion: "Colonia Las Moras", destinoLat: 13.73, destinoLng: -89.36, distanciaKm: 1.2,
      pesoKg: 1000, precioBase: 10, fueraDeRango: false, rangoTon: "0-1", aceptoTerminosEn: new Date(), ...extra,
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
  await db.clienteBloqueado.deleteMany({ where: { telefono: TEL_CLIENTE } });
});
test.afterAll(async () => {
  await limpiar();
  await db.clienteBloqueado.deleteMany({ where: { telefono: TEL_CLIENTE } });
  await db.motorista.updateMany({ where: { id: { in: creados } }, data: { estado: "SUSPENDIDO" } });
  await db.$disconnect();
});

test("el motorista entrega, el cliente ve el resumen y califica; el motorista califica al cliente", async ({ browser }) => {
  motorista = await crearMotorista("Rosa Calificada Pérez");
  const app = await appMotorista(browser, motorista.telefono);
  await app.getByTestId("disponible").click();
  await expect(app.getByTestId("disponible")).toHaveAttribute("aria-checked", "true");
  viajeApp = await nuevoViaje();

  // Acepta y hace todos los pasos en la app
  const alerta = app.getByTestId("alerta");
  await expect(alerta).toBeVisible({ timeout: 15_000 });
  await alerta.getByRole("button", { name: "ACEPTAR $10.00" }).click();
  for (const [boton, sig] of [["Voy en camino a recoger", "Ya llegué"], ["Ya llegué · Iniciar carga", "Carga lista"], ["Carga lista · Salir al destino", "Entrega completada"]]) {
    await app.getByTestId("avanzar").filter({ hasText: boton }).click();
    await expect(app.getByTestId("avanzar")).toContainText(sig);
  }
  await app.getByTestId("avanzar").filter({ hasText: "Entrega completada" }).click();
  await expect(app.getByTestId("aviso")).toContainText("Se descontaron");

  // El motorista ve la tarjeta para calificar al cliente
  const calCli = app.getByTestId("calificar-cliente");
  await expect(calCli).toBeVisible();
  await expect(calCli).toContainText("¿Qué tal Carla?");

  // El cliente ve el resumen del viaje
  const cliente = await browser.newPage();
  await cliente.setViewportSize({ width: 390, height: 844 });
  await cliente.goto(`/viaje/${viajeApp.codigo}`);
  const resumen = cliente.getByTestId("resumen-viaje");
  await expect(resumen).toContainText("1.2 km");
  await expect(resumen.getByTestId("precio-final")).toHaveText("$10.00");
  await expect(resumen.getByTestId("duracion")).toBeVisible();
  await expect(cliente.getByTestId("calificacion-motorista")).toContainText("Sin calificaciones");

  // Sin estrellas no deja enviar
  const cal = cliente.getByTestId("calificar-motorista");
  await expect(cal).toContainText("¿Cómo te fue con Rosa?");
  await cal.getByRole("button", { name: "Enviar calificación" }).click();
  await expect(cal.locator(ALERTA)).toContainText("Toca las estrellas");
  await cal.getByRole("radio", { name: "5 estrellas" }).click();
  await cal.getByLabel("Comentario (opcional)").fill("Muy puntual y cuidadosa con el cemento");
  await cal.getByRole("button", { name: "Enviar calificación" }).click();
  await expect(cliente.getByTestId("ya-calificado")).toContainText("¡Gracias por calificar!");
  await expect(cliente.getByTestId("calificar-motorista")).toHaveCount(0);
  await expect(cliente.getByTestId("calificacion-motorista")).toContainText("5.0");
  const v = await db.viaje.findUniqueOrThrow({ where: { id: viajeApp.id } });
  expect(v.estrellasMotorista).toBe(5);
  expect(v.comentarioMotorista).toBe("Muy puntual y cuidadosa con el cemento");

  // El motorista califica al cliente con 4
  await calCli.getByRole("radio", { name: "4 estrellas" }).click();
  await calCli.getByLabel("Comentario (opcional)").fill("Pagó completo, ayudó a descargar");
  await calCli.getByRole("button", { name: "Enviar calificación" }).click();
  await expect(app.getByTestId("aviso")).toContainText("¡Gracias! Calificación guardada.");
  await expect(app.getByTestId("calificar-cliente")).toHaveCount(0);
  const v2 = await db.viaje.findUniqueOrThrow({ where: { id: viajeApp.id } });
  expect(v2.estrellasCliente).toBe(4);

  // Su promedio en Perfil
  await app.goto("/motorista/perfil");
  await expect(app.getByTestId("mi-calificacion")).toContainText("5.0");
  await expect(app.getByTestId("mi-calificacion")).toContainText("Muy puntual");
  await cliente.close();
  await app.context().close();
});

test("no se puede calificar dos veces y el motorista puede omitir", async ({ browser }) => {
  // Segunda entrega (por base de datos) del mismo motorista
  const ahora = new Date();
  const v = await nuevoViaje({
    estado: "ENTREGADO", motoristaId: motorista.id, precioFinal: 15, comision: 1.5,
    asignadoEn: new Date(ahora.getTime() - 40 * 60_000), entregadoEn: ahora,
  });
  const app = await appMotorista(browser, motorista.telefono);
  const calCli = app.getByTestId("calificar-cliente");
  await expect(calCli).toContainText(`FY-${String(v.numero).padStart(4, "0")}`);
  await calCli.getByRole("button", { name: "Omitir" }).click();
  await expect(app.getByTestId("calificar-cliente")).toHaveCount(0);
  const omitido = await db.viaje.findUniqueOrThrow({ where: { id: v.id } });
  expect(omitido.estrellasCliente).toBeNull();
  expect(omitido.clienteCalificadoEn).not.toBeNull();

  // El cliente abre el link en dos pestañas: la segunda calificación se rechaza
  const ctx = await browser.newContext();
  const a = await ctx.newPage();
  const b = await ctx.newPage();
  await a.goto(`/viaje/${v.codigo}`);
  await b.goto(`/viaje/${v.codigo}`);
  await expect(a.getByTestId("resumen-viaje").getByTestId("duracion")).toContainText("40 min");
  await a.getByTestId("calificar-motorista").getByRole("radio", { name: "3 estrellas" }).click();
  await a.getByTestId("calificar-motorista").getByRole("button", { name: "Enviar calificación" }).click();
  await expect(a.getByTestId("ya-calificado")).toBeVisible();
  const calB = b.getByTestId("calificar-motorista");
  await calB.getByRole("radio", { name: "1 estrella" }).click();
  await calB.getByRole("button", { name: "Enviar calificación" }).click();
  await expect(calB.locator(ALERTA)).toContainText("Este viaje ya fue calificado");
  expect((await db.viaje.findUniqueOrThrow({ where: { id: v.id } })).estrellasMotorista).toBe(3);
  await ctx.close();
  await app.context().close();
});

test("el panel muestra las calificaciones en el viaje y en el motorista", async ({ page }) => {
  await entrarPanel(page);
  await page.goto(`/panel/viajes/${viajeApp.id}`);
  const sec = page.getByTestId("calificaciones-viaje");
  await expect(sec.locator("[data-estrellas='5']")).toBeVisible();
  await expect(sec).toContainText("Muy puntual y cuidadosa con el cemento");
  await expect(sec.locator("[data-estrellas='4']")).toBeVisible();
  await expect(sec).toContainText("Pagó completo, ayudó a descargar");

  await page.goto(`/panel/motoristas/${motorista.id}`);
  const cm = page.getByTestId("calificacion-motorista");
  await expect(cm).toContainText("4.0"); // (5 + 3) / 2
  await expect(cm).toContainText("2 calificaciones");
  await expect(cm).toContainText("Muy puntual");
});

test("Clientes: lista, búsqueda, historial y bloqueo", async ({ page }) => {
  await entrarPanel(page);
  // Un pedido esperando motorista: se cancela al bloquear
  const esperando = await nuevoViaje();

  await page.getByRole("link", { name: "Clientes" }).first().click();
  await expect(page).toHaveURL(/\/panel\/clientes$/);
  await page.getByLabel("Buscar cliente").fill(TEL_CLIENTE);
  await page.getByLabel("Buscar cliente").press("Enter");
  const fila = page.getByTestId("fila-cliente");
  await expect(fila).toHaveCount(1);
  await expect(fila).toContainText("Carla Calificaciones");
  await expect(fila).toContainText("2 viajes");
  await expect(fila).toContainText("3 pedidos");
  await expect(fila).toContainText("$25.00");
  await fila.click();

  await expect(page).toHaveURL(new RegExp(`/panel/clientes/${TEL_CLIENTE}$`));
  await expect(page.getByTestId("estado-bloqueo")).toHaveText("Puede pedir");
  await expect(page.getByTestId("total-pedidos")).toContainText("3");
  await expect(page.getByTestId("total-entregados")).toContainText("2");
  await expect(page.getByTestId("total-gastado")).toContainText("$25.00");
  await expect(page.getByTestId("calificacion-cliente")).toContainText("4.0");
  await expect(page.getByTestId("opiniones-cliente")).toContainText("Pagó completo");
  await expect(page.getByTestId("viaje-cliente")).toHaveCount(3);

  // Bloquear: pide motivo
  page.on("dialog", (d) => d.accept());
  await page.getByTestId("bloquear").click();
  await page.getByRole("button", { name: "Confirmar bloqueo" }).click();
  await expect(page.locator(ALERTA)).toContainText("Escribe el motivo");
  await page.getByLabel(/Motivo del bloqueo/).fill("Pedidos falsos repetidos");
  await page.getByRole("button", { name: "Confirmar bloqueo" }).click();
  await expect(page.getByRole("status")).toContainText("Se cancelaron 1 pedido(s)");
  await expect(page.getByTestId("estado-bloqueo")).toHaveText("Bloqueado");
  await expect(page.getByTestId("motivo-bloqueo")).toContainText("Pedidos falsos repetidos");
  const cancelado = await db.viaje.findUniqueOrThrow({ where: { id: esperando.id } });
  expect(cancelado.estado).toBe("CANCELADO");

  // Aparece en el filtro de bloqueados
  await page.goto("/panel/clientes?f=bloqueados");
  await expect(page.getByTestId("fila-cliente").filter({ hasText: "Carla Calificaciones" })).toContainText("Bloqueado");

  // El cliente bloqueado no puede pedir
  const qr = await db.puntoQR.findFirstOrThrow({ where: { activo: true } });
  const cli = await page.context().browser()!.newPage();
  await cli.setViewportSize({ width: 390, height: 844 });
  await cli.goto(`/pedir?f=${qr.codigo}`);
  await cli.getByTestId("rango-0-1").click();
  const mapa = cli.locator(".leaflet-container").first();
  await mapa.scrollIntoViewIfNeeded();
  const caja = (await mapa.boundingBox())!;
  await cli.mouse.click(caja.x + caja.width / 2 + 50, caja.y + caja.height / 2 + 30);
  await cli.locator("#destino-dir").fill("Col. Las Brisas, casa 12");
  await cli.getByLabel("Tu nombre").fill("Carla Calificaciones");
  await cli.getByLabel("Tu celular").fill(TEL_CLIENTE);
  await cli.getByRole("checkbox").check();
  await cli.getByRole("button", { name: /Solicitar FleteYa/ }).click();
  await expect(cli.getByText("Este número no puede pedir fletes por ahora.")).toBeVisible();
  await expect(cli).toHaveURL(/\/pedir/);
  expect(await db.viaje.count({ where: { clienteTelefono: TEL_CLIENTE } })).toBe(3);

  // Desbloquear: ya puede pedir
  await page.goto(`/panel/clientes/${TEL_CLIENTE}`);
  await page.getByTestId("desbloquear").click();
  await expect(page.getByRole("status")).toContainText("Desbloqueado");
  await expect(page.getByTestId("estado-bloqueo")).toHaveText("Puede pedir");
  await cli.getByRole("button", { name: /Solicitar FleteYa/ }).click();
  await expect(cli).toHaveURL(/\/viaje\/[a-z0-9]{16}$/);
  await cli.close();
});
