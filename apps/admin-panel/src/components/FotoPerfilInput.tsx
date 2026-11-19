"use client";
import { useRef, useState } from "react";

const LADO_MAX = 800; // px; suficiente para un avatar nítido

/** Reduce la imagen en el celular antes de subirla. */
async function reducirImagen(f: File): Promise<File> {
  if (!f.type.startsWith("image/") || f.size < 400 * 1024) return f;
  try {
    const img = await createImageBitmap(f);
    const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * escala);
    c.height = Math.round(img.height * escala);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.85));
    return blob && blob.size < f.size ? new File([blob], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : f;
  } catch {
    return f;
  }
}

/** Sube la foto de perfil. Solo imágenes: la ve el cliente para saber quién le atenderá. */
export function FotoPerfilInput({ nombre = "foto_perfil", existente, error, obligatoria = false }: {
  nombre?: string; existente?: string; error?: string; obligatoria?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  async function alCambiar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setProcesando(true);
    const listo = await reducirImagen(f);
    if (listo !== f && ref.current) {
      const dt = new DataTransfer();
      dt.items.add(listo);
      ref.current.files = dt.files;
    }
    setVista(URL.createObjectURL(listo));
    setProcesando(false);
  }

  const imagen = vista ?? existente;
  return (
    <div>
      <label className="flex items-center gap-4">
        <span className={`flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed ${error ? "border-error" : imagen ? "border-borde" : "border-naranja/50"} bg-fondo hover:bg-tarjeta-2`}>
          {imagen ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagen} alt="Foto de perfil" className="h-full w-full object-cover" />
          ) : (
            <i className="fa-solid fa-camera text-xl text-naranja" />
          )}
          <input ref={ref} type="file" name={nombre} accept="image/jpeg,image/png,image/webp" onChange={alCambiar} className="sr-only" />
        </span>
        <span className="min-w-0 text-sm">
          <span className="font-semibold">Foto de perfil {obligatoria ? <span className="text-naranja">(obligatoria *)</span> : "(opcional)"}</span>
          <span className="mt-0.5 block text-[11px] text-suave">Para que el cliente sepa quién le atenderá. Solo imagen (JPG, PNG o WEBP), máx. 4 MB.</span>
          {error && <span className="mt-1 block text-[11px] text-error">{error}</span>}
          {procesando && <span className="mt-1 block text-[11px] text-suave">Preparando foto…</span>}
        </span>
      </label>
    </div>
  );
}
