// Capturas de la Parte 6 (calificaciones y clientes). Uso: node tests/capturas-calificaciones.mjs
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
const U = process.env.E2E_URL ?? "http://localhost:3000";
const OUT = process.env.CAPTURAS ?? "/home/ubuntu/fleteya_capturas_parte6";
const db = new PrismaClient();
const b = await chromium.launch();
const cel = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 };
const desborde = async (p, n) => { const w = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); console.log(n, "desborde:", w); };

// Un viaje entregado del motorista demo, para que el cliente y el motorista califiquen
const m = await db.motorista.findUniqueOrThrow({ where: { telefono: "70000001" } });
await db.viaje.updateMany({ where: { motoristaId: m.id, estado: { in: ["ASIGNADO", "EN_CAMINO", "CARGANDO", "EN_RUTA"] } }, data: { estado: "CANCELADO", canceladoPor: "PROPIETARIO", canceladoEn: new Date() } });
await db.motorista.update({ where: { id: m.id }, data: { terminosVersion: "0.1", terminosAceptadosEn: new Date(), disponible: false } });
const ahora = Date.now();
const v = await db.viaje.create({ data: {
  codigo: `cap6${ahora}`, clienteNombre: "Ana López", clienteTelefono: "61234567", origenDireccion: "Ferretería El Constructor · Lourdes", origenLat: 13.725, origenLng: -89.37,
  destinoDireccion: "Col. Las Brisas, pasaje 3, casa 12", destinoLat: 13.73, destinoLng: -89.36, distanciaKm: 1.2, pesoKg: 2000, precioBase: 20, fueraDeRango: false,
  rangoTon: "1-2", nota: "30 bolsas de cemento", aceptoTerminosEn: new Date(ahora - 50 * 60_000),
  estado: "ENTREGADO", motoristaId: m.id, precioFinal: 20, comision: 2, asignadoEn: new Date(ahora - 45 * 60_000), entregadoEn: new Date(ahora) } });

const c = await (await b.newContext(cel)).newPage();
await c.goto(`${U}/viaje/${v.codigo}`);
const cal = c.getByTestId("calificar-motorista");
await cal.getByRole("radio", { name: "5 estrellas" }).click();
await cal.getByLabel("Comentario (opcional)").fill("Muy amable y llegó rápido");
await c.getByTestId("resumen-viaje").scrollIntoViewIfNeeded();
await c.screenshot({ path: `${OUT}/p6-01-cliente-resumen-y-calificar.png` }); await desborde(c, "01");
await cal.getByRole("button", { name: "Enviar calificación" }).click();
await c.getByTestId("ya-calificado").waitFor();
await c.getByTestId("ya-calificado").scrollIntoViewIfNeeded();
await c.screenshot({ path: `${OUT}/p6-02-cliente-gracias.png` });

const a = await (await b.newContext(cel)).newPage();
await a.goto(`${U}/motorista/entrar`);
await a.getByLabel("Número de teléfono").fill("70000001"); await a.getByLabel("Contraseña", { exact: true }).fill("Prueba2026");
await a.getByRole("button", { name: /Entrar/ }).click(); await a.waitForURL(/\/motorista$/);
const cc = a.getByTestId("calificar-cliente");
await cc.waitFor();
await cc.getByRole("radio", { name: "5 estrellas" }).click();
await cc.getByLabel("Comentario (opcional)").fill("Pagó completo y ayudó a descargar");
await cc.scrollIntoViewIfNeeded();
await a.screenshot({ path: `${OUT}/p6-03-motorista-califica-cliente.png` }); await desborde(a, "03");
await cc.getByRole("button", { name: "Enviar calificación" }).click();
await a.getByTestId("aviso").waitFor();
await a.goto(`${U}/motorista/perfil`);
await a.getByTestId("mi-calificacion").scrollIntoViewIfNeeded();
await a.screenshot({ path: `${OUT}/p6-04-motorista-perfil-calificacion.png` }); await desborde(a, "04");

const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await p.goto(`${U}/login`); await p.getByLabel("Correo electrónico").fill("demo@fleteya.app"); await p.getByLabel("Contraseña", { exact: true }).fill("Prueba2026");
await p.getByRole("button", { name: /Entrar al panel/ }).click(); await p.waitForURL(/\/panel$/);
await p.goto(`${U}/panel/clientes`);
await p.screenshot({ path: `${OUT}/p6-05-panel-clientes.png` });
await p.goto(`${U}/panel/clientes/61234567`);
await p.getByTestId("bloquear").click();
await p.getByLabel(/Motivo del bloqueo/).fill("Pedidos falsos repetidos");
await p.screenshot({ path: `${OUT}/p6-06-panel-cliente-detalle.png`, fullPage: true });
await p.goto(`${U}/panel/viajes/${v.id}`);
await p.screenshot({ path: `${OUT}/p6-07-panel-viaje-calificaciones.png`, fullPage: true });
await p.goto(`${U}/panel/motoristas/${m.id}`);
await p.getByTestId("calificacion-motorista").scrollIntoViewIfNeeded();
await p.screenshot({ path: `${OUT}/p6-08-panel-motorista-calificacion.png` });

const pc = await (await b.newContext(cel)).newPage();
await pc.goto(`${U}/login`); await pc.getByLabel("Correo electrónico").fill("demo@fleteya.app"); await pc.getByLabel("Contraseña", { exact: true }).fill("Prueba2026");
await pc.getByRole("button", { name: /Entrar al panel/ }).click(); await pc.waitForURL(/\/panel$/);
await pc.goto(`${U}/panel/clientes/61234567`);
await pc.screenshot({ path: `${OUT}/p6-09-panel-cliente-celular.png` }); await desborde(pc, "09");
await b.close(); await db.$disconnect();
