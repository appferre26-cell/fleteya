// Servicio de avisos (push) falso para probar la Parte 8 sin Google/Apple.
// Guarda cada aviso recibido (cifrado, en base64) en PUSH_BUZON, una línea JSON por aviso.
// Las direcciones que empiezan con /ya-no responden 410 (teléfono que quitó el permiso).
// Uso: PUSH_BUZON=/ruta/buzon.jsonl PUSH_CERT=cert.pem PUSH_LLAVE=llave.pem node tests/push-falso.mjs  (puerto 4443)
// El panel debe arrancar con NODE_EXTRA_CA_CERTS=cert.pem para confiar en este certificado.
import { appendFileSync, readFileSync } from "node:fs";
import https from "node:https";

const BUZON = process.env.PUSH_BUZON ?? "push.jsonl";
const PUERTO = Number(process.env.PUSH_PUERTO ?? 4443);

https.createServer({ cert: readFileSync(process.env.PUSH_CERT ?? "cert.pem"), key: readFileSync(process.env.PUSH_LLAVE ?? "llave.pem") }, (req, res) => {
  const partes = [];
  req.on("data", (b) => partes.push(b));
  req.on("end", () => {
    const ruta = req.url ?? "/";
    appendFileSync(BUZON, JSON.stringify({ ruta, ttl: req.headers.ttl, urgencia: req.headers.urgency, cuerpo: Buffer.concat(partes).toString("base64"), en: Date.now() }) + "\n");
    res.writeHead(ruta.startsWith("/ya-no") ? 410 : 201).end();
  });
}).listen(PUERTO, () => console.log(`push-falso escuchando en https://localhost:${PUERTO}`));
