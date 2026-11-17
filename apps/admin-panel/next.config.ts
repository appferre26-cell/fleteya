import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite abrir el servidor de desarrollo desde la dirección de vista previa.
  allowedDevOrigins: ["*"],
  experimental: {
    // 10 fotos de documentos y vehículo (ya se reducen en el navegador antes de subir).
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
