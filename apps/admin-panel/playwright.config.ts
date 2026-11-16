import { defineConfig } from "@playwright/test";

// Pruebas de punta a punta contra el panel ya encendido (npm run build && npm start).
// Necesita un propietario creado: E2E_CORREO / E2E_PASSWORD.
export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  workers: 1,
  use: { baseURL: process.env.E2E_URL ?? "http://localhost:3000", locale: "es-SV", timezoneId: "America/El_Salvador" },
});
