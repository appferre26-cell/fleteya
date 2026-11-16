-- CreateEnum
CREATE TYPE "EstadoViaje" AS ENUM ('BUSCANDO', 'ASIGNADO', 'EN_CAMINO', 'CARGANDO', 'EN_RUTA', 'ENTREGADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "pesoKg" DECIMAL(10,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PuntoQR" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PuntoQR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "precioTonelada" DECIMAL(8,2) NOT NULL DEFAULT 10,
    "tarifaMinima" DECIMAL(8,2) NOT NULL DEFAULT 10,
    "kmIncluidos" DECIMAL(5,1) NOT NULL DEFAULT 5,
    "zonaNombre" TEXT NOT NULL DEFAULT 'Lourdes, Colón',
    "zonaLat" DOUBLE PRECISION NOT NULL DEFAULT 13.725,
    "zonaLng" DOUBLE PRECISION NOT NULL DEFAULT -89.37,
    "zonaRadioKm" DECIMAL(5,1) NOT NULL DEFAULT 8,
    "whatsappAyuda" TEXT,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Viaje" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "clienteNombre" TEXT NOT NULL,
    "clienteTelefono" TEXT NOT NULL,
    "origenDireccion" TEXT NOT NULL,
    "origenLat" DOUBLE PRECISION NOT NULL,
    "origenLng" DOUBLE PRECISION NOT NULL,
    "destinoDireccion" TEXT NOT NULL,
    "destinoLat" DOUBLE PRECISION NOT NULL,
    "destinoLng" DOUBLE PRECISION NOT NULL,
    "distanciaKm" DECIMAL(6,2) NOT NULL,
    "pesoKg" DECIMAL(10,2) NOT NULL,
    "precioBase" DECIMAL(8,2) NOT NULL,
    "fueraDeRango" BOOLEAN NOT NULL,
    "nota" TEXT,
    "estado" "EstadoViaje" NOT NULL DEFAULT 'BUSCANDO',
    "canceladoPor" TEXT,
    "motivoCancelacion" TEXT,
    "canceladoEn" TIMESTAMP(3),
    "puntoQrId" TEXT,
    "aceptoTerminosEn" TIMESTAMP(3) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Viaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViajeItem" (
    "id" TEXT NOT NULL,
    "viajeId" TEXT NOT NULL,
    "materialId" TEXT,
    "nombre" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL,
    "pesoUnitKg" DECIMAL(10,2) NOT NULL,
    "pesoTotalKg" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ViajeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Material_nombre_key" ON "Material"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "PuntoQR_codigo_key" ON "PuntoQR"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Viaje_numero_key" ON "Viaje"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Viaje_codigo_key" ON "Viaje"("codigo");

-- CreateIndex
CREATE INDEX "Viaje_estado_creadoEn_idx" ON "Viaje"("estado", "creadoEn");

-- CreateIndex
CREATE INDEX "Viaje_clienteTelefono_idx" ON "Viaje"("clienteTelefono");

-- AddForeignKey
ALTER TABLE "Viaje" ADD CONSTRAINT "Viaje_puntoQrId_fkey" FOREIGN KEY ("puntoQrId") REFERENCES "PuntoQR"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViajeItem" ADD CONSTRAINT "ViajeItem_viajeId_fkey" FOREIGN KEY ("viajeId") REFERENCES "Viaje"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViajeItem" ADD CONSTRAINT "ViajeItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;
