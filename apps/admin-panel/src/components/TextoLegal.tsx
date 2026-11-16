import { readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

/** Muestra un texto legal de la carpeta legal/ (copiado de docs/legal). */
export async function TextoLegal({ archivo, base = "" }: { archivo: string; base?: string }) {
  const md = await readFile(path.join(process.cwd(), "legal", archivo), "utf8");
  const html = (await marked.parse(md))
    .replaceAll('href="aviso-privacidad.md"', `href="${base || ""}/privacidad"`)
    .replaceAll('href="terminos-clientes.md"', 'href="/terminos"')
    .replaceAll('href="terminos-motoristas.md"', `href="${base}/terminos"`);
  return <article className="legal px-5 py-6" dangerouslySetInnerHTML={{ __html: html }} />;
}
