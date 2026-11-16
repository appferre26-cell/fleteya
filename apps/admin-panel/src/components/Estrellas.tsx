/** Promedio de estrellas para mostrar: «★ 4.8 · 12 calificaciones» o «Sin calificaciones». */
export function Promedio({ promedio, total, corto, testid }: { promedio: number | null; total: number; corto?: boolean; testid?: string }) {
  if (promedio == null || total === 0) return <span className="text-suave" data-testid={testid}>{corto ? "Nuevo" : "Sin calificaciones aún"}</span>;
  return (
    <span className="inline-flex items-center gap-1" data-testid={testid}>
      <i className="fa-solid fa-star text-[0.85em] text-amarillo" aria-hidden />
      <b className="tabular-nums">{promedio.toFixed(1)}</b>
      <span className="text-suave">{corto ? `(${total})` : `· ${total} ${total === 1 ? "calificación" : "calificaciones"}`}</span>
    </span>
  );
}

/** Estrellas fijas de una sola calificación. */
export function EstrellasFijas({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span className={`inline-flex gap-0.5 ${className}`} aria-label={`${n} de 5 estrellas`} data-estrellas={n}>
      {[1, 2, 3, 4, 5].map((i) => <i key={i} className={`fa-star text-[0.85em] ${i <= n ? "fa-solid text-amarillo" : "fa-regular text-suave"}`} aria-hidden />)}
    </span>
  );
}
