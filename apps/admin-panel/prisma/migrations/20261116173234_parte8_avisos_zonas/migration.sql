-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "zonaPoligono" JSONB;

-- CreateTable
CREATE TABLE "SuscripcionAviso" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "motoristaId" TEXT,
    "viajeId" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoEnvio" TIMESTAMP(3),

    CONSTRAINT "SuscripcionAviso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SuscripcionAviso_endpoint_key" ON "SuscripcionAviso"("endpoint");

-- CreateIndex
CREATE INDEX "SuscripcionAviso_motoristaId_idx" ON "SuscripcionAviso"("motoristaId");

-- CreateIndex
CREATE INDEX "SuscripcionAviso_viajeId_idx" ON "SuscripcionAviso"("viajeId");

-- AddForeignKey
ALTER TABLE "SuscripcionAviso" ADD CONSTRAINT "SuscripcionAviso_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuscripcionAviso" ADD CONSTRAINT "SuscripcionAviso_viajeId_fkey" FOREIGN KEY ("viajeId") REFERENCES "Viaje"("id") ON DELETE CASCADE ON UPDATE CASCADE;
