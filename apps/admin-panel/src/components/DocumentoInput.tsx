"use client";
import { useRef, useState } from "react";

const LADO_MAX = 1800; // px; suficiente para leer un DUI o una licencia

/** Reduce la foto en el celular antes de subirla (las fotos de cámara pesan 4–8 MB). */
async function reducirImagen(f: File): Promise<File> {
  if (!f.type.startsWith("image/") || f.size < 600 * 1024) return f;
  try {
    const img = await createImageBitmap(f);
    const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * escala);
    c.height = Math.round(img.height * escala);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.82));
    return blob && blob.size < f.size ? new File([blob], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : f;
  } catch {
    return f; // formato que el navegador no puede leer (p. ej. HEIC): se sube tal cual y el servidor avisa
  }
}

export function DocumentoInput({ nombre, etiqueta, existente, error: errorServidor }: {
  nombre: string; etiqueta: string; existente?: string; error?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
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
    setVista(listo.type.startsWith("image/") ? URL.createObjectURL(listo) : null);
    setInfo(`${listo.type === "application/pdf" ? "PDF" : "Foto"} · ${(listo.size / 1024 / 1024).toFixed(1)} MB`);
    setProcesando(false);
  }

  const imagen = vista ?? existente;
  const error = info ? undefined : errorServidor; // al elegir otro archivo se quita el aviso anterior
  return (
    <div>
      <p className="etiqueta">{etiqueta}</p>
      <label className={`flex h-36 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed text-center ${error ? "border-error" : imagen || info ? "border-borde" : "border-naranja/50"} bg-fondo hover:bg-tarjeta-2`}>
        {imagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagen} alt={etiqueta} className="h-full w-full object-cover" />
        ) : info ? (
          <><i className="fa-solid fa-file-pdf text-2xl text-naranja" /><span className="text-xs text-suave">{info}</span></>
        ) : (
          <><i className="fa-solid fa-camera text-xl text-naranja" /><span className="px-3 text-xs text-suave">Tomar foto o elegir archivo</span></>
        )}
        <input ref={ref} type="file" name={nombre} accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={alCambiar} className="sr-only" />
      </label>
      <p className={`mt-1 text-[11px] ${error ? "text-error" : "text-suave"}`}>
        {error ?? (procesando ? "Preparando foto…" : info ?? (existente ? "Toca la foto para reemplazarla" : "JPG, PNG o PDF · máx. 4 MB"))}
      </p>
    </div>
  );
}
