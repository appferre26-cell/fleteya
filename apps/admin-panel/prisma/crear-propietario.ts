// Crea la PRIMERA cuenta de propietario (las demás se crean desde el panel → Administradores).
// Uso: ADMIN_NOMBRE="..." ADMIN_CORREO="..." ADMIN_PASSWORD="..." npm run crear-propietario
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const nombre = process.env.ADMIN_NOMBRE?.trim();
  const correo = process.env.ADMIN_CORREO?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!nombre || !correo || password.length < 8) {
    throw new Error("Define ADMIN_NOMBRE, ADMIN_CORREO y ADMIN_PASSWORD (mínimo 8 caracteres).");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const p = await db.propietario.upsert({
    where: { correo },
    create: { nombre, correo, passwordHash },
    update: { nombre, passwordHash, activo: true },
  });
  console.log(`Propietario listo: ${p.nombre} <${p.correo}>`);
}

main().finally(() => db.$disconnect());
