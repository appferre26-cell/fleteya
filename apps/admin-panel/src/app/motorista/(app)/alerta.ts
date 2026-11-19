// Aviso de solicitud nueva: sonido, vibración y notificación del sistema.
// El navegador solo deja sonar después de que el motorista toca algo: se "despierta" al tocar «Disponible».

let audio: AudioContext | null = null;

export function prepararSonido() {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
  } catch { /* sin sonido */ }
  if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
}

export function sonarAlerta() {
  try {
    if (audio && audio.state === "running") {
      const t0 = audio.currentTime;
      [0, 0.25, 0.5, 1.1, 1.35, 1.6].forEach((d, i) => {
        const o = audio!.createOscillator();
        const g = audio!.createGain();
        o.type = "square";
        o.frequency.value = i % 3 === 2 ? 1320 : 880;
        g.gain.setValueAtTime(0.0001, t0 + d);
        g.gain.exponentialRampToValueAtTime(0.25, t0 + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.2);
        o.connect(g).connect(audio!.destination);
        o.start(t0 + d);
        o.stop(t0 + d + 0.22);
      });
    }
  } catch { /* sin sonido */ }
  navigator.vibrate?.([400, 150, 400, 150, 600]);
}

export function notificar(titulo: string, cuerpo: string) {
  if (!("Notification" in window) || Notification.permission !== "granted" || !document.hidden) return;
  try {
    new Notification(titulo, { body: cuerpo, icon: "/icono.png", tag: "fleteya-solicitud" });
  } catch { /* Android exige service worker: el sonido y la vibración siguen funcionando */ }
}

