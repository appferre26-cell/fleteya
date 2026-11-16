// CSV para abrir en Excel (con BOM para que respete tildes y ñ).

function celda(v: unknown) {
  const s = String(v ?? "");
  const seguro = /^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s; // evita fórmulas al abrir en Excel
  return /[",;\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

export function respuestaCsv(filas: unknown[][], nombre: string) {
  const csv = "\ufeff" + filas.map((f) => f.map(celda).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Fecha y hora de El Salvador como «2026-11-16 08:30:00». */
export const fechaHoraCsv = (d: Date | null | undefined) => (d ? d.toLocaleString("sv-SE", { timeZone: "America/El_Salvador" }) : "");
