-- Parte 10: sin planes semanales/mensuales, acceso a la plataforma ($10, pago único),
-- autoregistro del motorista con 10 fotos y datos para la factura.
-- Las fotos que ya existían (DUI, licencia, tarjeta) pasan a ser el «frente».

-- CreateEnum
CREATE TYPE "ConceptoPago" AS ENUM ('RECARGA', 'ACCESO');

-- AlterEnum
BEGIN;
CREATE TYPE "TipoDocumento_new" AS ENUM ('DUI_FRENTE', 'DUI_REVERSO', 'LICENCIA_FRENTE', 'LICENCIA_REVERSO', 'TARJETA_FRENTE', 'TARJETA_REVERSO', 'VEHICULO_FRENTE', 'VEHICULO_ATRAS', 'VEHICULO_IZQUIERDA', 'VEHICULO_DERECHA');
ALTER TABLE "Documento" ALTER COLUMN "tipo" TYPE "TipoDocumento_new" USING (CASE "tipo"::text
  WHEN 'DUI' THEN 'DUI_FRENTE'
  WHEN 'LICENCIA' THEN 'LICENCIA_FRENTE'
  WHEN 'TARJETA_CIRCULACION' THEN 'TARJETA_FRENTE'
  ELSE "tipo"::text END)::"TipoDocumento_new";
ALTER TYPE "TipoDocumento" RENAME TO "TipoDocumento_old";
ALTER TYPE "TipoDocumento_new" RENAME TO "TipoDocumento";
DROP TYPE "public"."TipoDocumento_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "HistorialMotorista" DROP CONSTRAINT "HistorialMotorista_propietarioId_fkey";

-- DropForeignKey
ALTER TABLE "Motorista" DROP CONSTRAINT "Motorista_creadoPorId_fkey";

-- AlterTable
ALTER TABLE "Configuracion" DROP COLUMN "planMensual",
DROP COLUMN "planSemanal",
ADD COLUMN     "precioAcceso" DECIMAL(8,2) NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "HistorialMotorista" ALTER COLUMN "propietarioId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Motorista" ADD COLUMN     "accesoAvisadoEn" TIMESTAMP(3),
ADD COLUMN     "accesoPagadoEn" TIMESTAMP(3),
ADD COLUMN     "accesoReferencia" TEXT,
ADD COLUMN     "autoRegistro" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "direccionFiscal" TEXT,
ADD COLUMN     "giro" TEXT,
ADD COLUMN     "nit" TEXT,
ADD COLUMN     "nrc" TEXT,
ADD COLUMN     "razonSocial" TEXT,
ADD COLUMN     "requiereCreditoFiscal" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "creadoPorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Recarga" DROP COLUMN "plan",
ADD COLUMN     "concepto" "ConceptoPago" NOT NULL DEFAULT 'RECARGA';

-- DropEnum
DROP TYPE "PlanRecarga";

-- AddForeignKey
ALTER TABLE "Motorista" ADD CONSTRAINT "Motorista_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Propietario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialMotorista" ADD CONSTRAINT "HistorialMotorista_propietarioId_fkey" FOREIGN KEY ("propietarioId") REFERENCES "Propietario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Historial: los nombres viejos de documentos pasan a los nuevos
UPDATE "HistorialMotorista" SET "detalle" = 'DUI_FRENTE' WHERE "accion" = 'DOCUMENTO_ACTUALIZADO' AND "detalle" = 'DUI';
UPDATE "HistorialMotorista" SET "detalle" = 'LICENCIA_FRENTE' WHERE "accion" = 'DOCUMENTO_ACTUALIZADO' AND "detalle" = 'LICENCIA';
UPDATE "HistorialMotorista" SET "detalle" = 'TARJETA_FRENTE' WHERE "accion" = 'DOCUMENTO_ACTUALIZADO' AND "detalle" = 'TARJETA_CIRCULACION';

-- Los motoristas que ya estaban aprobados antes de este cambio no pagan el acceso
UPDATE "Motorista" SET "accesoPagadoEn" = "aprobadoEn" WHERE "aprobadoEn" IS NOT NULL;
