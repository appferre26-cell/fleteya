// Aviso de solicitud nueva: sonido, vibración y notificación del sistema.
// En el celular el navegador solo deja sonar DESPUÉS de que el motorista toca algo
// en la pantalla. Por eso "desbloqueamos" el audio con CUALQUIER toque y, una vez
// desbloqueado, reproducimos un sonido ya decodificado en memoria (Web Audio),
// que es lo más confiable para que suene aunque el aviso llegue solo (desde un timer).

let audio: AudioContext | null = null;
let buffer: AudioBuffer | null = null; // /alerta.wav ya decodificado en memoria
let cargando = false;
let alarma: HTMLAudioElement | null = null; // respaldo con <audio>
let desbloqueado = false;

function crearContexto(): AudioContext | null {
  try {
    audio ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    return audio;
  } catch {
    return null;
  }
}

/** Descarga y decodifica /alerta.wav una sola vez para poder reproducirlo al instante. */
async function cargarBuffer() {
  if (buffer || cargando || !audio) return;
  cargando = true;
  try {
    const resp = await fetch("/alerta.wav", { cache: "force-cache" });
    const datos = await resp.arrayBuffer();
    buffer = await audio.decodeAudioData(datos);
  } catch { /* usaremos pitidos de respaldo */ }
  cargando = false;
}

/** Prepara/"despierta" el audio. Hay que llamarlo tras un toque del usuario. */
export function prepararSonido() {
  const ctx = crearContexto();
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    void cargarBuffer();
    // Un "tic" inaudible dentro del gesto termina de habilitar el audio en móvil.
    if (!desbloqueado) {
      try {
        const g = ctx.createGain();
        g.gain.value = 0.0001;
        const o = ctx.createOscillator();
        o.connect(g).connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.03);
        desbloqueado = true;
      } catch { /* */ }
    }
  }
  try {
    if (!alarma) {
      alarma = new Audio("/alerta.wav");
      alarma.preload = "auto";
      alarma.load();
    }
    const v = alarma.volume;
    alarma.muted = true;
    alarma.play().then(() => {
      alarma!.pause();
      alarma!.currentTime = 0;
      alarma!.muted = false;
      alarma!.volume = v;
    }).catch(() => { alarma!.muted = false; });
  } catch { /* sin sonido */ }
  if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
}

/** Engancha un desbloqueo del audio al PRIMER toque/tecla en cualquier parte de la pantalla. */
export function desbloquearConToque() {
  if (typeof window === "undefined") return () => {};
  const unlock = () => prepararSonido();
  const opts = { passive: true } as AddEventListenerOptions;
  window.addEventListener("pointerdown", unlock, opts);
  window.addEventListener("touchstart", unlock, opts);
  window.addEventListener("keydown", unlock, opts);
  // Al volver a la app, reactiva el audio (se suspende al bloquear la pantalla).
  const alVolver = () => { if (!document.hidden && audio?.state === "suspended") void audio.resume(); };
  document.addEventListener("visibilitychange", alVolver);
  return () => {
    window.removeEventListener("pointerdown", unlock, opts);
    window.removeEventListener("touchstart", unlock, opts);
    window.removeEventListener("keydown", unlock, opts);
    document.removeEventListener("visibilitychange", alVolver);
  };
}

/** Reproduce el sonido real ya decodificado. Devuelve true si logró sonar. */
function sonarBuffer(): boolean {
  if (!audio || !buffer) return false;
  try {
    if (audio.state === "suspended") void audio.resume();
    const fuente = audio.createBufferSource();
    fuente.buffer = buffer;
    const g = audio.createGain();
    g.gain.value = 1;
    fuente.connect(g).connect(audio.destination);
    fuente.start();
    return true;
  } catch {
    return false;
  }
}

function pitidos(): boolean {
  if (!audio || audio.state !== "running") return false;
  const t0 = audio.currentTime;
  [0, 0.25, 0.5, 1.1, 1.35, 1.6].forEach((d, i) => {
    const o = audio!.createOscillator();
    const g = audio!.createGain();
    o.type = "square";
    o.frequency.value = i % 3 === 2 ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, t0 + d);
    g.gain.exponentialRampToValueAtTime(0.3, t0 + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.2);
    o.connect(g).connect(audio!.destination);
    o.start(t0 + d);
    o.stop(t0 + d + 0.22);
  });
  return true;
}

export function sonarAlerta() {
  try { if (audio?.state === "suspended") void audio.resume(); } catch { /* */ }
  // 1) Vía principal: sonido real decodificado en memoria (lo más confiable en móvil).
  let sono = sonarBuffer();
  // 2) Respaldo: <audio> HTML.
  if (!sono) {
    try {
      if (alarma) {
        alarma.currentTime = 0;
        const p = alarma.play();
        if (p) p.catch(() => { pitidos(); });
        sono = true;
      }
    } catch { /* */ }
  }
  // 3) Respaldo final: pitidos sintetizados.
  if (!sono) pitidos();
  // 4) Vibración siempre (funciona aunque el sonido esté apagado).
  navigator.vibrate?.([400, 150, 400, 150, 600]);
}

export function notificar(titulo: string, cuerpo: string) {
  if (!("Notification" in window) || Notification.permission !== "granted" || !document.hidden) return;
  try {
    new Notification(titulo, { body: cuerpo, icon: "/icono.png", tag: "fleteya-solicitud" });
  } catch { /* Android exige service worker: el sonido y la vibración siguen funcionando */ }
}
