-- CreateEnum
CREATE TYPE "PlanRecarga" AS ENUM ('SEMANAL', 'MENSUAL');

-- CreateEnum
CREATE TYPE "FormaPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'EN_LINEA');

-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "bancoNombre" TEXT,
ADD COLUMN     "bancoNumero" TEXT,
ADD COLUMN     "bancoTipoCuenta" TEXT DEFAULT 'Ahorro',
ADD COLUMN     "bancoTitular" TEXT,
ADD COLUMN     "emisorDireccion" TEXT,
ADD COLUMN     "emisorNit" TEXT,
ADD COLUMN     "emisorNombre" TEXT;

-- AlterTable
ALTER TABLE "MovimientoCredito" ADD COLUMN     "recargaId" TEXT;

-- CreateTable
CREATE TABLE "Recarga" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "plan" "PlanRecarga" NOT NULL,
    "monto" DECIMAL(8,2) NOT NULL,
    "formaPago" "FormaPago" NOT NULL,
    "referencia" TEXT,
    "nota" TEXT,
    "saldoAntes" DECIMAL(8,2) NOT NULL,
    "deudaDescontada" DECIMAL(8,2) NOT NULL,
    "saldoDespues" DECIMAL(8,2) NOT NULL,
    "registradoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emisorNombre" TEXT,
    "emisorNit" TEXT,
    "emisorDireccion" TEXT,
    "correoEnviadoA" TEXT,
    "correoEnviadoEn" TIMESTAMP(3),
    "correoError" TEXT,
    "anuladaEn" TIMESTAMP(3),
    "anuladaPorId" TEXT,
    "motivoAnulacion" TEXT,

    CONSTRAINT "Recarga_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Recarga_numero_key" ON "Recarga"("numero");

-- CreateIndex
CREATE INDEX "Recarga_motoristaId_creadoEn_idx" ON "Recarga"("motoristaId", "creadoEn");

-- CreateIndex
CREATE INDEX "Recarga_creadoEn_idx" ON "Recarga"("creadoEn");

-- CreateIndex
CREATE INDEX "Recarga_referencia_idx" ON "Recarga"("referencia");

-- AddForeignKey
ALTER TABLE "MovimientoCredito" ADD CONSTRAINT "MovimientoCredito_recargaId_fkey" FOREIGN KEY ("recargaId") REFERENCES "Recarga"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recarga" ADD CONSTRAINT "Recarga_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recarga" ADD CONSTRAINT "Recarga_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Propietario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recarga" ADD CONSTRAINT "Recarga_anuladaPorId_fkey" FOREIGN KEY ("anuladaPorId") REFERENCES "Propietario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
