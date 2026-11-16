"use client";

export function Imprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primario h-10">
      <i className="fa-solid fa-print" />Imprimir
    </button>
  );
}
