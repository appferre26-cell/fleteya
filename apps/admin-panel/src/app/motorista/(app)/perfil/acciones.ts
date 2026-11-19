"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { leerFotoPerfil } from "@/lib/documentos";
import { exigirMotorista } from "@/lib/sesion-motorista";

export type EstadoFotoPerfil = { error?: string; ok?: boolean };

/** El motorista sube o cambia su foto de perfil (opcional). Upsert del Documento FOTO_PERFIL. */
export async function subirFotoPerfil(_: EstadoFotoPerfil, form: FormData): Promise<EstadoFotoPerfil> {
  const m = await exigirMotorista({ permitirPendientes: true });
  const { foto, error } = await leerFotoPerfil(form);
  if (error) return { error };
  if (!foto) return { error: "Elige una imagen para subir." };
  await db.documento.upsert({
    where: { motoristaId_tipo: { motoristaId: m.id, tipo: "FOTO_PERFIL" } },
    create: { motoristaId: m.id, tipo: "FOTO_PERFIL", mime: foto.mime, datos: foto.datos },
    update: { mime: foto.mime, datos: foto.datos, subidoEn: new Date() },
  });
  revalidatePath("/motorista/perfil");
  return { ok: true };
}
