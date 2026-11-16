import type { Metadata, Viewport } from "next";

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
  return <div className="mx-auto min-h-dvh max-w-[520px]">{children}</div>;
}
