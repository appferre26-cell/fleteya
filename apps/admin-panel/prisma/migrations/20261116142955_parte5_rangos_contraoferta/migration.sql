-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "contraofertaEnRango" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Viaje" ADD COLUMN     "rangoTon" TEXT;
