import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite abrir el servidor de desarrollo desde la dirección de vista previa.
  allowedDevOrigins: ["*"],
  // No revelar que el sitio corre con Next.js (menos pistas para un atacante).
  poweredByHeader: false,
  experimental: {
    // 10 fotos de documentos y vehículo (ya se reducen en el navegador antes de subir).
    serverActions: { bodySizeLimit: "25mb" },
  },
  // Cabeceras de seguridad para todas las páginas (defensa adicional del navegador).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Evita que el navegador "adivine" tipos de archivo (bloquea cierto XSS).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // No filtrar la dirección completa a sitios externos.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Apaga APIs sensibles del navegador que la app no necesita por defecto.
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=()" },
          // Impide que otro sitio “enmarque” la app (clickjacking), dejando pasar
          // solo la vista previa de Abacus.
          { key: "Content-Security-Policy", value: "frame-ancestors 'self' https://*.abacus.ai https://*.abacusai.app" },
        ],
      },
    ];
  },
};

export default nextConfig;
