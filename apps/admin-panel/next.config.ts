import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite abrir el servidor de desarrollo desde la dirección de vista previa.
  allowedDevOrigins: ["*"],
  experimental: {
    // Fotos de documentos (ya se reducen en el navegador antes de subir).
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
