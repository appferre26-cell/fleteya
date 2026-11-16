-- AlterTable
ALTER TABLE "Viaje" ADD COLUMN     "clienteCalificadoEn" TIMESTAMP(3),
ADD COLUMN     "comentarioCliente" TEXT,
ADD COLUMN     "comentarioMotorista" TEXT,
ADD COLUMN     "estrellasCliente" INTEGER,
ADD COLUMN     "estrellasMotorista" INTEGER,
ADD COLUMN     "motoristaCalificadoEn" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ClienteBloqueado" (
    "telefono" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "bloqueadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClienteBloqueado_pkey" PRIMARY KEY ("telefono")
);

-- AddForeignKey
ALTER TABLE "ClienteBloqueado" ADD CONSTRAINT "ClienteBloqueado_bloqueadoPorId_fkey" FOREIGN KEY ("bloqueadoPorId") REFERENCES "Propietario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

