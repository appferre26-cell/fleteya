// Aviso de solicitud nueva: sonido, vibración y notificación del sistema.
// El navegador solo deja sonar después de que el motorista toca algo en la pantalla:
// por eso "desbloqueamos" el audio con CUALQUIER toque (ver desbloquearConToque).

let audio: AudioContext | null = null;
let alarma: HTMLAudioElement | null = null; // sonido real (/alerta.mp3), más fuerte y confiable que los pitidos
let desbloqueado = false;

/** Prepara/"despierta" el audio. Hay que llamarlo tras un toque del usuario. */
export function prepararSonido() {
  try {
    audio ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (audio.state === "suspended") void audio.resume();
  } catch { /* sin sonido */ }
  try {
    if (!alarma) {
      alarma = new Audio("/alerta.mp3");
      alarma.preload = "auto";
      alarma.load();
    }
    // Truco para "desbloquear": reproducir en silencio una vez dentro del gesto del usuario.
    if (!desbloqueado) {
      const v = alarma.volume;
      alarma.muted = true;
      alarma.play().then(() => {
        alarma!.pause();
        alarma!.currentTime = 0;
        alarma!.muted = false;
        alarma!.volume = v;
        desbloqueado = true;
      }).catch(() => { alarma!.muted = false; });
    }
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

function pitidos() {
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
  // 1) Sonido real (más confiable y fuerte). Intenta reanudar el contexto por si acaso.
  try { if (audio?.state === "suspended") void audio.resume(); } catch { /* */ }
  let sono = false;
  try {
    if (alarma) {
      alarma.currentTime = 0;
      const p = alarma.play();
      if (p) p.then(() => { sono = true; }).catch(() => { pitidos(); });
      sono = true;
    }
  } catch { /* */ }
  // 2) Pitidos como respaldo si el archivo no pudo sonar.
  if (!sono) pitidos();
  // 3) Vibración siempre (funciona aunque el sonido esté apagado).
  navigator.vibrate?.([400, 150, 400, 150, 600]);
}

export function notificar(titulo: string, cuerpo: string) {
  if (!("Notification" in window) || Notification.permission !== "granted" || !document.hidden) return;
  try {
    new Notification(titulo, { body: cuerpo, icon: "/icono.png", tag: "fleteya-solicitud" });
  } catch { /* Android exige service worker: el sonido y la vibración siguen funcionando */ }
}
