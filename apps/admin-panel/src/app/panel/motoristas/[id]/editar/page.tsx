import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { exigirPropietario } from "@/lib/sesion";
import { editarMotorista } from "../../acciones";
import { FormMotorista } from "../../FormMotorista";

export const metadata = { title: "Editar motorista — FleteYa" };

export default async function EditarMotorista({ params }: { params: Promise<{ id: string }> }) {
  await exigirPropietario();
  const { id } = await params;
  const m = await db.motorista.findUnique({ where: { id }, include: { documentos: { select: { id: true, tipo: true, mime: true } } } });
  if (!m) notFound();

  const inicial = {
    nombre: m.nombre, telefono: m.telefono, correo: m.correo ?? "", dui: m.dui, licenciaNumero: m.licenciaNumero,
    licenciaVence: m.licenciaVence.toISOString().slice(0, 10), placa: m.placa, marca: m.marca, modelo: m.modelo,
    tipoVehiculo: m.tipoVehiculo, capacidadTon: m.capacidadTon.toString(),
    requiereCreditoFiscal: m.requiereCreditoFiscal ? "on" : "", nit: m.nit ?? "", nrc: m.nrc ?? "",
    razonSocial: m.razonSocial ?? "", giro: m.giro ?? "", direccionFiscal: m.direccionFiscal ?? "",
  };
  // Solo se muestran como vista previa las imágenes (los PDF se abren desde el detalle).
  const documentos = Object.fromEntries(m.documentos.filter((d) => d.mime.startsWith("image/")).map((d) => [d.tipo, `/api/documentos/${d.id}`]));

  return (
    <div className="max-w-4xl">
      <Link href={`/panel/motoristas/${id}`} className="text-xs text-suave hover:text-texto"><i className="fa-solid fa-arrow-left mr-1.5" />{m.nombre}</Link>
      <h1 className="mt-2 mb-6 text-[26px] leading-tight font-extrabold">Editar datos</h1>
      <FormMotorista accion={editarMotorista.bind(null, id)} inicial={inicial} documentos={documentos} cancelar={`/panel/motoristas/${id}`} />
    </div>
  );
}
