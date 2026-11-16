// Servidor SMTP falso para probar el envío de recibos sin mandar correos reales.
// Uso: SMTP_BUZON=/ruta/buzon.txt node tests/smtp-falso.mjs   (escucha en el puerto 2525)
import { appendFileSync } from "node:fs";
import net from "node:net";

const BUZON = process.env.SMTP_BUZON ?? "buzon.txt";
const PUERTO = Number(process.env.SMTP_PUERTO ?? 2525);

net.createServer((s) => {
  let datos = false;
  let mensaje = "";
  let resto = "";
  s.write("220 smtp-falso listo\r\n");
  s.on("data", (b) => {
    resto += b.toString("latin1");
    let i;
    while ((i = resto.indexOf("\r\n")) >= 0) {
      const linea = resto.slice(0, i);
      resto = resto.slice(i + 2);
      if (datos) {
        if (linea === ".") {
          datos = false;
          appendFileSync(BUZON, `${mensaje}\n=====FIN=====\n`);
          mensaje = "";
          s.write("250 OK guardado\r\n");
        } else mensaje += `${linea}\n`;
        continue;
      }
      const cmd = linea.slice(0, 4).toUpperCase();
      if (cmd === "EHLO" || cmd === "HELO") s.write("250 smtp-falso\r\n");
      else if (cmd === "DATA") { datos = true; s.write("354 adelante\r\n"); }
      else if (cmd === "QUIT") { s.write("221 adios\r\n"); s.end(); }
      else s.write("250 OK\r\n");
    }
  });
  s.on("error", () => {});
}).listen(PUERTO, () => console.log(`smtp-falso en ${PUERTO} → ${BUZON}`));
