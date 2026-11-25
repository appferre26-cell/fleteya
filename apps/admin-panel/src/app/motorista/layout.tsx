import type { Metadata, Viewport } from "next";
import Script from "next/script";

// App FleteYa Motorista: se instala aparte (su propio ícono y su propia dirección /motorista).
// No tiene ningún enlace ni acceso al panel de propietarios.
export const metadata: Metadata = {
  title: "FleteYa Motorista",
  description: "App de FleteYa para motoristas",
  manifest: "/manifest-motorista.webmanifest",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "FleteYa Motorista", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#121212", width: "device-width", initialScale: 1, viewportFit: "cover" };
export const dynamic = "force-dynamic";

export default function LayoutMotorista({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Captura el evento de instalación lo más temprano posible (antes de que React monte),
          porque Chrome a veces lo dispara antes de que la página cargue. Lo guardamos en window
          para que la página de instalar pueda usarlo al abrirse desde el QR. */}
      <Script id="fy-install-capture" strategy="beforeInteractive">{`
        window.addEventListener('beforeinstallprompt', function (e) {
          e.preventDefault();
          window.__fyInstallPrompt = e;
          window.dispatchEvent(new Event('fy-install-ready'));
        });
        window.addEventListener('appinstalled', function () {
          window.__fyInstallPrompt = null;
        });
      `}</Script>
      <div className="mx-auto min-h-dvh max-w-[520px]">{children}</div>
    </>
  );
}
