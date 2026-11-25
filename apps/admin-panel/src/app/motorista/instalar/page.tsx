"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

// Página pública para que el motorista instale la PWA fácil y la comparta por WhatsApp.
// No requiere sesión: se puede abrir desde un link compartido.

type Prompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

declare global {
  interface Window {
    __fyInstallPrompt?: Prompt | null;
  }
}

export default function InstalarMotorista() {
  const [so, setSo] = useState<"android" | "ios" | "otro">("otro");
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [instalada, setInstalada] = useState(false);
  const [ayuda, setAyuda] = useState(false); // muestra los pasos manuales si no hay instalador automático

  useEffect(() => {
    const ua = navigator.userAgent || "";
    if (/android/i.test(ua)) setSo("android");
    else if (/iphone|ipad|ipod/i.test(ua)) setSo("ios");
    else setSo("otro");

    // ¿Ya está abierta como app instalada?
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    setInstalada(standalone);

    // 1) El script del layout pudo capturar el evento ANTES de que React montara
    //    (al escanear el QR, Chrome lo dispara muy temprano). Lo tomamos de window.
    if (window.__fyInstallPrompt) setPrompt(window.__fyInstallPrompt);

    // 2) Avisos de ese script cuando el evento llega después de montar.
    const onReady = () => {
      if (window.__fyInstallPrompt) setPrompt(window.__fyInstallPrompt);
    };
    // 3) Por si el evento del navegador llega directo a esta página.
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as Prompt);
    };
    const onInstalled = () => {
      setPrompt(null);
      setInstalada(true);
    };
    window.addEventListener("fy-install-ready", onReady);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("fy-install-ready", onReady);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function instalar() {
    // Si el navegador ya nos dio el instalador automático, lo lanzamos.
    if (prompt) {
      await prompt.prompt();
      await prompt.userChoice.catch(() => {});
      setPrompt(null);
      window.__fyInstallPrompt = null;
      return;
    }
    // Si no (iPhone, o Chrome aún no lo habilita), mostramos los pasos manuales.
    setAyuda(true);
    document.getElementById("pasos-instalar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="flex min-h-dvh flex-col px-5 pt-8 pb-10">
      <Logo sub="Motoristas" />

      <div className="mt-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-naranja/15 px-3 py-1.5 text-[11px] font-bold tracking-wider text-naranja uppercase">
          <i className="fa-solid fa-mobile-screen-button" />Instalar en tu teléfono
        </span>
        <h1 className="mt-4 text-[28px] leading-tight font-extrabold">
          Ten <span className="text-naranja">FleteYa</span> en tu pantalla
        </h1>
        <p className="mt-2 text-sm text-suave">
          Instálala como una app normal: te queda el ícono en tu teléfono y abres más rápido. No ocupa descargar nada de ninguna tienda.
        </p>
      </div>

      {instalada ? (
        <div className="tarjeta mt-8 flex items-center gap-3 border-exito/40 bg-exito/10 p-4">
          <i className="fa-solid fa-circle-check text-xl text-exito" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">¡Ya tienes FleteYa instalada!</p>
            <p className="mt-0.5 text-suave">Puedes entrar a tu cuenta cuando quieras.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Botón de instalación SIEMPRE visible.
              - Android con instalador listo: lanza el instalador automático.
              - iPhone o Chrome sin instalador aún: abre los pasos manuales de abajo. */}
          <button onClick={instalar} className="btn-primario mt-8 h-14 text-base" data-testid="btn-instalar">
            <i className="fa-solid fa-download" /> {prompt ? "Instalar FleteYa ahora" : "Instalar FleteYa"}
          </button>
          {!prompt && (
            <p className="mt-2 text-center text-xs text-suave">
              Toca el botón y te muestro los pasos para tu teléfono.
            </p>
          )}

          {/* Pasos según el teléfono */}
          <div
            id="pasos-instalar"
            className={`mt-8 scroll-mt-4 rounded-2xl transition-shadow ${ayuda ? "ring-2 ring-naranja/60 p-3 -mx-3" : ""}`}
          >
            <p className="seccion-titulo mb-3">
              {so === "ios" ? "En iPhone (Safari)" : so === "android" ? "En Android (Chrome)" : "Cómo instalarla"}
            </p>

            {so === "ios" ? (
              <ol className="space-y-3">
                <PasoLi n={1} icon="fa-share-from-square">
                  Abre este enlace en <b>Safari</b> y toca el botón <b>Compartir</b> (el cuadro con la flecha ↑) abajo.
                </PasoLi>
                <PasoLi n={2} icon="fa-square-plus">
                  Baja y toca <b>“Agregar a inicio”</b> (Add to Home Screen).
                </PasoLi>
                <PasoLi n={3} icon="fa-circle-check">
                  Toca <b>Agregar</b>. ¡Listo! El ícono de FleteYa queda en tu pantalla.
                </PasoLi>
              </ol>
            ) : (
              <ol className="space-y-3">
                <PasoLi n={1} icon="fa-download">
                  {prompt ? (
                    <>Toca el botón <b>“Instalar FleteYa ahora”</b> de arriba.</>
                  ) : (
                    <>Toca el menú <b>⋮</b> (arriba a la derecha) en Chrome.</>
                  )}
                </PasoLi>
                <PasoLi n={2} icon="fa-square-plus">
                  Elige <b>“Instalar aplicación”</b> o <b>“Agregar a pantalla de inicio”</b>.
                </PasoLi>
                <PasoLi n={3} icon="fa-circle-check">
                  Confirma <b>Instalar</b>. El ícono de FleteYa queda en tu teléfono.
                </PasoLi>
              </ol>
            )}
          </div>
        </>
      )}

      {/* Ir a entrar / registro */}
      <div className="mt-auto pt-8">
        <Link href="/motorista/entrar" className="btn-secundario w-full" data-testid="ir-entrar">
          <i className="fa-solid fa-right-to-bracket text-naranja" /> Ya la instalé, entrar a mi cuenta
        </Link>
        <Link href="/motorista/registro" className="mt-3 block text-center text-xs text-suave hover:text-texto">
          ¿Eres motorista nuevo? <span className="font-semibold text-naranja">Regístrate aquí</span>
        </Link>
      </div>
    </main>
  );
}

function PasoLi({ n, icon, children }: { n: number; icon: string; children: React.ReactNode }) {
  return (
    <li className="tarjeta flex items-start gap-3 p-3.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-naranja text-sm font-extrabold text-fondo">{n}</span>
      <div className="flex-1 text-sm leading-relaxed text-[#d6d6d6]">{children}</div>
      <i className={`fa-solid ${icon} mt-0.5 text-naranja`} />
    </li>
  );
}
