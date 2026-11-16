-- CreateEnum
CREATE TYPE "EstadoOferta" AS ENUM ('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'RETIRADA');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('RECARGA', 'COMISION', 'AJUSTE');

-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "comisionPct" DECIMAL(5,2) NOT NULL DEFAULT 10,
ADD COLUMN     "planMensual" DECIMAL(8,2) NOT NULL DEFAULT 60,
ADD COLUMN     "planSemanal" DECIMAL(8,2) NOT NULL DEFAULT 20;

-- AlterTable
ALTER TABLE "Motorista" ADD COLUMN     "disponible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "saldoCreditos" DECIMAL(8,2) NOT NULL DEFAULT 0,
ADD COLUMN     "terminosAceptadosEn" TIMESTAMP(3),
ADD COLUMN     "terminosVersion" TEXT,
ADD COLUMN     "ubicacionEn" TIMESTAMP(3),
ADD COLUMN     "ultimoAcceso" TIMESTAMP(3),
ADD COLUMN     "vistoEn" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Viaje" ADD COLUMN     "asignadoEn" TIMESTAMP(3),
ADD COLUMN     "cargandoEn" TIMESTAMP(3),
ADD COLUMN     "comision" DECIMAL(8,2),
ADD COLUMN     "enCaminoEn" TIMESTAMP(3),
ADD COLUMN     "enRutaEn" TIMESTAMP(3),
ADD COLUMN     "entregadoEn" TIMESTAMP(3),
ADD COLUMN     "motoristaId" TEXT,
ADD COLUMN     "precioFinal" DECIMAL(8,2);

-- CreateTable
CREATE TABLE "OfertaPrecio" (
    "id" TEXT NOT NULL,
    "viajeId" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "precio" DECIMAL(8,2) NOT NULL,
    "estado" "EstadoOferta" NOT NULL DEFAULT 'PENDIENTE',
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidaEn" TIMESTAMP(3),

    CONSTRAINT "OfertaPrecio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RechazoViaje" (
    "viajeId" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL DEFAULT 'RECHAZO',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RechazoViaje_pkey" PRIMARY KEY ("viajeId","motoristaId")
);

-- CreateTable
CREATE TABLE "MovimientoCredito" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "monto" DECIMAL(8,2) NOT NULL,
    "saldoAntes" DECIMAL(8,2) NOT NULL,
    "saldoDespues" DECIMAL(8,2) NOT NULL,
    "viajeId" TEXT,
    "detalle" TEXT,
    "creadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoCredito_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfertaPrecio_viajeId_estado_idx" ON "OfertaPrecio"("viajeId", "estado");

-- CreateIndex
CREATE INDEX "OfertaPrecio_motoristaId_estado_idx" ON "OfertaPrecio"("motoristaId", "estado");

-- CreateIndex
CREATE INDEX "MovimientoCredito_motoristaId_creadoEn_idx" ON "MovimientoCredito"("motoristaId", "creadoEn");

-- CreateIndex
CREATE INDEX "Viaje_motoristaId_estado_idx" ON "Viaje"("motoristaId", "estado");

-- AddForeignKey
ALTER TABLE "Viaje" ADD CONSTRAINT "Viaje_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfertaPrecio" ADD CONSTRAINT "OfertaPrecio_viajeId_fkey" FOREIGN KEY ("viajeId") REFERENCES "Viaje"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfertaPrecio" ADD CONSTRAINT "OfertaPrecio_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RechazoViaje" ADD CONSTRAINT "RechazoViaje_viajeId_fkey" FOREIGN KEY ("viajeId") REFERENCES "Viaje"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RechazoViaje" ADD CONSTRAINT "RechazoViaje_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCredito" ADD CONSTRAINT "MovimientoCredito_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE CASCADE ON UPDATE CASCADE;
