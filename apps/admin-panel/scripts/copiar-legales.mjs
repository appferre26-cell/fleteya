// Copia los textos legales (docs/legal es la fuente) para que el link del cliente y la app del motorista los muestren.
import { copyFileSync, existsSync } from "node:fs";
const origen = new URL("../../../docs/legal/", import.meta.url);
for (const f of ["terminos-clientes.md", "terminos-motoristas.md", "aviso-privacidad.md"]) {
  const de = new URL(f, origen);
  if (existsSync(de)) copyFileSync(de, new URL(`../legal/${f}`, import.meta.url));
}
