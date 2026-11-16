-- CreateEnum
CREATE TYPE "EstadoMotorista" AS ENUM ('PENDIENTE', 'ACTIVO', 'SUSPENDIDO');

-- CreateEnum
CREATE TYPE "TipoVehiculo" AS ENUM ('PICKUP', 'CAMION_LIVIANO', 'CAMION_MEDIANO_GRANDE');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('DUI', 'LICENCIA', 'TARJETA_CIRCULACION');

-- CreateTable
CREATE TABLE "Propietario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoAcceso" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorId" TEXT,

    CONSTRAINT "Propietario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Motorista" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "correo" TEXT,
    "passwordHash" TEXT NOT NULL,
    "debeCambiarPassword" BOOLEAN NOT NULL DEFAULT true,
    "dui" TEXT NOT NULL,
    "licenciaNumero" TEXT NOT NULL,
    "licenciaVence" DATE NOT NULL,
    "placa" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "tipoVehiculo" "TipoVehiculo" NOT NULL,
    "capacidadTon" DECIMAL(4,1) NOT NULL,
    "estado" "EstadoMotorista" NOT NULL DEFAULT 'PENDIENTE',
    "motivoSuspension" TEXT,
    "aprobadoEn" TIMESTAMP(3),
    "aprobadoPorId" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Motorista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "tipo" "TipoDocumento" NOT NULL,
    "mime" TEXT NOT NULL,
    "datos" BYTEA NOT NULL,
    "subidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistorialMotorista" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "propietarioId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "detalle" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialMotorista_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Propietario_correo_key" ON "Propietario"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "Motorista_telefono_key" ON "Motorista"("telefono");

-- CreateIndex
CREATE UNIQUE INDEX "Motorista_dui_key" ON "Motorista"("dui");

-- CreateIndex
CREATE UNIQUE INDEX "Motorista_placa_key" ON "Motorista"("placa");

-- CreateIndex
CREATE UNIQUE INDEX "Documento_motoristaId_tipo_key" ON "Documento"("motoristaId", "tipo");

-- CreateIndex
CREATE INDEX "HistorialMotorista_motoristaId_fecha_idx" ON "HistorialMotorista"("motoristaId", "fecha");

-- AddForeignKey
ALTER TABLE "Motorista" ADD CONSTRAINT "Motorista_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "Propietario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Motorista" ADD CONSTRAINT "Motorista_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Propietario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialMotorista" ADD CONSTRAINT "HistorialMotorista_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialMotorista" ADD CONSTRAINT "HistorialMotorista_propietarioId_fkey" FOREIGN KEY ("propietarioId") REFERENCES "Propietario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
