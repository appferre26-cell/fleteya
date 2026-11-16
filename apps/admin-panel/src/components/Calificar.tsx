"use client";
import { useState, useTransition } from "react";

const TEXTOS = ["", "Muy mal", "Mal", "Regular", "Bien", "¡Excelente!"];

/** Formulario de 1 a 5 estrellas + comentario opcional. Lo usan el cliente y el motorista. */
export function Calificar({ titulo, ayuda, placeholder, enviar, omitir, testid }: {
  titulo: string; ayuda?: string; placeholder: string; testid: string;
  enviar: (estrellas: number, comentario: string) => Promise<{ error?: string }>;
  omitir?: () => Promise<{ error?: string }>;
}) {
  const [n, setN] = useState(0);
  const [sobre, setSobre] = useState(0);
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState("");
  const [ocupado, iniciar] = useTransition();
  const ver = sobre || n;

  const mandar = () => iniciar(async () => {
    if (!n) { setError("Toca las estrellas para calificar."); return; }
    const r = await enviar(n, comentario);
    setError(r.error ?? "");
  });
  const saltar = () => omitir && iniciar(async () => { const r = await omitir(); setError(r.error ?? ""); });

  return (
    <section className="tarjeta p-4" data-testid={testid}>
      <p className="font-bold">{titulo}</p>
      {ayuda && <p className="mt-0.5 text-xs text-suave">{ayuda}</p>}
      <div className="mt-3 flex items-center gap-1" role="radiogroup" aria-label="Estrellas" onMouseLeave={() => setSobre(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" role="radio" aria-checked={n === i} aria-label={`${i} ${i === 1 ? "estrella" : "estrellas"}`}
            onClick={() => { setN(i); setError(""); }} onMouseEnter={() => setSobre(i)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-[28px] transition active:scale-90">
            <i className={`fa-star ${i <= ver ? "fa-solid text-amarillo" : "fa-regular text-suave"}`} />
          </button>
        ))}
        <span className="ml-2 text-sm font-semibold text-suave">{TEXTOS[ver]}</span>
      </div>
      <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={300} rows={2}
        aria-label="Comentario (opcional)" placeholder={placeholder} className="campo mt-3 py-2" />
      {error && <p role="alert" className="mt-2 text-xs text-error">{error}</p>}
      <div className={`mt-3 grid gap-2 ${omitir ? "grid-cols-[1fr_2fr]" : ""}`}>
        {omitir && <button type="button" onClick={saltar} disabled={ocupado} className="btn-secundario">Omitir</button>}
        <button type="button" onClick={mandar} disabled={ocupado} className="btn-primario">{ocupado ? "Enviando…" : "Enviar calificación"}</button>
      </div>
    </section>
  );
}
