import type { Metadata } from "next";
import Link from "next/link";
import { landingConfig } from "@/lib/landing-config";

export const metadata: Metadata = {
  title: "FleteYa — Tus materiales a casa, rápido y barato",
  description:
    "Pide un flete para tus materiales en 1 minuto, sin crear cuenta ni descargar nada. Ves el precio antes de confirmar.",
  robots: { index: true, follow: true },
};

export const dynamic = "force-dynamic";

// Logo de la marca (mismo del encabezado del cliente).
function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-naranja shadow-[0_6px_18px_rgba(255,107,0,0.3)]">
        <i className="fa-solid fa-truck-fast text-lg text-texto" />
      </span>
      <span className="text-2xl font-extrabold tracking-tight">
        Flete<span className="text-naranja">Ya</span>
      </span>
    </div>
  );
}

// Tarjeta de paso numerada (1-2-3).
function Paso({ n, icono, titulo, children }: { n: number; icono: string; titulo: string; children: React.ReactNode }) {
  return (
    <li className="tarjeta flex gap-3.5 p-4">
      <div className="relative shrink-0">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-naranja/10 text-naranja">
          <i className={`fa-solid ${icono} text-lg`} />
        </span>
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-naranja text-[11px] font-extrabold text-fondo">
          {n}
        </span>
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-bold leading-snug">{titulo}</p>
        {children}
      </div>
    </li>
  );
}

// Fila de pregunta frecuente (acordeón sin JavaScript con <details>).
function Faq({ p, children }: { p: string; children: React.ReactNode }) {
  return (
    <details className="group tarjeta overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <span>{p}</span>
        <i className="fa-solid fa-chevron-down shrink-0 text-xs text-suave transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-borde px-4 py-3.5 text-sm leading-relaxed text-suave">{children}</div>
    </details>
  );
}

export default async function Landing({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  // Si el QR de la ferretería trae un código (?f=CODIGO), lo pasamos a /pedir para no romper ese flujo.
  const pedirHref = f ? `/pedir?f=${encodeURIComponent(f)}` : "/pedir";
  const { whatsapp, facebook, instagram, tiktok, correo } = landingConfig;
  const hayRedes = !!(whatsapp || facebook || instagram || tiktok || correo);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[640px] flex-col">
      {/* Encabezado */}
      <header className="flex items-center justify-between px-5 pt-5 pb-3">
        <Logo />
        <a href="#como-funciona" className="text-xs font-semibold text-suave hover:text-texto">
          ¿Cómo funciona?
        </a>
      </header>

      <main className="flex-1 px-5">
        {/* 1. PORTADA CON GANCHO */}
        <section className="pt-6 pb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-borde bg-tarjeta px-3.5 py-1.5 text-xs font-medium text-suave">
            <i className="fa-solid fa-bolt text-naranja" /> Fletes de materiales en minutos
          </span>
          <h1 className="mt-5 text-[34px] font-extrabold leading-[1.1] tracking-tight">
            Tus materiales a casa, <span className="text-naranja">rápido</span> y al mejor precio.
          </h1>
          <p className="mx-auto mt-4 max-w-[460px] text-base leading-relaxed text-suave">
            Pide un flete directo desde tu celular. Sin crear cuenta, sin descargar nada. Ves el precio antes de confirmar.
          </p>
          <div className="mt-7 flex flex-col gap-3">
            <Link href={pedirHref} className="btn-primario h-14 w-full text-base">
              <i className="fa-solid fa-box" /> Pedir un flete ahora
            </Link>
            <Link href="/motorista/registro" className="btn-secundario h-14 w-full text-base">
              <i className="fa-solid fa-motorcycle" /> Quiero ser motorista
            </Link>
          </div>
        </section>

        {/* 2. CÓMO FUNCIONA PARA EL CLIENTE */}
        <section id="como-funciona" className="scroll-mt-5 py-8">
          <div className="mb-5 text-center">
            <p className="seccion-titulo">Para pedir un flete</p>
            <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight">Así de fácil, en 3 pasos</h2>
          </div>
          <ol className="space-y-3">
            <Paso n={1} icono="fa-qrcode" titulo="Escaneas el QR en la ferretería">
              <p className="mt-1 text-sm leading-relaxed text-suave">
                Con la cámara de tu celular. Se abre esta página, sin instalar nada.
              </p>
            </Paso>
            <Paso n={2} icono="fa-box-open" titulo="Dices qué llevas y a dónde">
              <p className="mt-1 text-sm leading-relaxed text-suave">
                Escoges el peso de tu carga y marcas tu dirección en el mapa. Te damos un precio sugerido y tú ofreces cuánto quieres pagar.
              </p>
            </Paso>
            <Paso n={3} icono="fa-house-chimney" titulo="Un motorista lo recoge y te lo lleva a casa">
              <p className="mt-1 text-sm leading-relaxed text-suave">
                Pagas en línea o en efectivo al recibir. Tú decides.
              </p>
            </Paso>
          </ol>
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-exito/40 bg-exito/10 px-4 py-3 text-sm">
            <i className="fa-solid fa-circle-check text-exito" />
            <span>No necesitas crear cuenta ni descargar ninguna app.</span>
          </div>
          {/* Nota PWA: cómo dejar FleteYa a un toque en el celular (sin tienda de apps). */}
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-borde bg-tarjeta px-4 py-3 text-sm">
            <i className="fa-solid fa-mobile-screen-button mt-0.5 text-naranja" />
            <span className="text-suave">
              <span className="font-semibold text-texto">¿Quieres tenerla a la mano?</span> Puedes dejar FleteYa en la pantalla de inicio de tu celular. En el navegador toca el menú de los tres puntos y elige <span className="font-semibold text-texto">«Agregar a pantalla de inicio»</span> (o «Instalar app»). Queda como un acceso directo, sin descargar nada.
            </span>
          </div>
        </section>

        {/* 3. CÓMO FUNCIONA PARA EL MOTORISTA */}
        <section className="py-8">
          <div className="mb-5 text-center">
            <p className="seccion-titulo">Para motoristas</p>
            <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight">Maneja y gana con FleteYa</h2>
          </div>
          <ol className="space-y-3">
            <Paso n={1} icono="fa-id-card" titulo="Te registras con tu foto y tu vehículo">
              <p className="mt-1 text-sm leading-relaxed text-suave">
                Pagas <span className="font-bold text-texto">$10 una sola vez</span> para activar tu cuenta. Es un pago único de registro.
              </p>
            </Paso>
            <Paso n={2} icono="fa-wallet" titulo="Trabajas con tu saldo de créditos">
              <p className="mt-1 text-sm leading-relaxed text-suave">
                Dentro de la app manejas un saldo de créditos. De ahí sale la comisión de cada viaje que aceptas.
              </p>
            </Paso>
            <Paso n={3} icono="fa-sack-dollar" titulo="Aceptas, entregas y ganas">
              <p className="mt-1 text-sm leading-relaxed text-suave">
                Al aceptar un viaje se descuenta de tus créditos una comisión del <span className="font-bold text-texto">13.5%</span>. Lo demás es tuyo.
              </p>
            </Paso>
          </ol>
          <Link href="/motorista/registro" className="btn-primario mt-5 h-14 w-full text-base">
            <i className="fa-solid fa-motorcycle" /> Quiero ser motorista
          </Link>
        </section>

        {/* 4. PREGUNTAS FRECUENTES */}
        <section className="py-8">
          <div className="mb-5 text-center">
            <p className="seccion-titulo">Dudas</p>
            <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight">Preguntas frecuentes</h2>
          </div>
          <div className="space-y-2.5">
            <Faq p="¿Necesito crear una cuenta?">
              Si eres cliente, <span className="font-semibold text-texto">no</span>: pides tu flete directo, sin registrarte ni
              descargar nada. Si eres motorista, <span className="font-semibold text-texto">sí</span> necesitas registrarte para
              recibir viajes.
            </Faq>
            <Faq p="¿Cómo pago?">
              Puedes pagar en línea desde el mismo enlace, o en efectivo al motorista cuando recibes tu carga.
            </Faq>
            <Faq p="¿Es seguro?">
              Sí. Cada motorista se registra con su foto y los datos de su vehículo antes de poder recibir fletes.
            </Faq>
            <Faq p="¿En qué zonas funciona?">
              Estamos creciendo en El Salvador. Escanea el QR de tu ferretería para ver si ya cubrimos tu zona.
            </Faq>
            <Faq p="¿Cómo me hago motorista?">
              Toca «Quiero ser motorista», regístrate con tu foto y tu vehículo (pago único de $10) y empieza a recibir viajes.
            </Faq>
          </div>
        </section>

        {/* Llamado final */}
        <section className="py-8">
          <div className="rounded-2xl border border-naranja/40 bg-naranja/10 p-6 text-center">
            <h2 className="text-2xl font-extrabold tracking-tight">¿Listo para tu flete?</h2>
            <p className="mx-auto mt-2 max-w-[400px] text-sm text-suave">
              En un minuto tienes tu carga en camino. Sin cuenta, sin descargas.
            </p>
            <Link href={pedirHref} className="btn-primario mt-5 h-14 w-full text-base">
              <i className="fa-solid fa-box" /> Pedir un flete ahora
            </Link>
          </div>
        </section>
      </main>

      {/* 6. PIE DE PÁGINA */}
      <footer className="mt-4 border-t border-borde px-5 py-7">
        <div className="flex flex-col items-center gap-4 text-center">
          <Logo />

          {hayRedes ? (
            <div className="flex flex-wrap items-center justify-center gap-3">
              {whatsapp && (
                <a href={`https://wa.me/503${whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-borde text-suave hover:text-texto">
                  <i className="fa-brands fa-whatsapp text-lg" />
                </a>
              )}
              {facebook && (
                <a href={facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-borde text-suave hover:text-texto">
                  <i className="fa-brands fa-facebook-f text-lg" />
                </a>
              )}
              {instagram && (
                <a href={instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-borde text-suave hover:text-texto">
                  <i className="fa-brands fa-instagram text-lg" />
                </a>
              )}
              {tiktok && (
                <a href={tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-borde text-suave hover:text-texto">
                  <i className="fa-brands fa-tiktok text-lg" />
                </a>
              )}
              {correo && (
                <a href={`mailto:${correo}`} aria-label="Correo"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-borde text-suave hover:text-texto">
                  <i className="fa-solid fa-envelope text-lg" />
                </a>
              )}
            </div>
          ) : (
            <p className="text-xs text-suave"><i className="fa-regular fa-clock mr-1.5" />Pronto en redes sociales</p>
          )}

          <p className="text-[11px] text-suave">
            <Link href="/terminos" className="underline">Términos</Link>
            {" · "}
            <Link href="/privacidad" className="underline">Privacidad</Link>
          </p>
          <p className="text-[11px] text-suave">© {new Date().getFullYear()} FleteYa · El Salvador</p>
        </div>
      </footer>
    </div>
  );
}
