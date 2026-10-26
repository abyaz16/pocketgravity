/**
 * PocketGravity Notification & Audio/Haptic Alert Service.
 * Bridges seamlessly across Web PWA, Mobile Browsers, and Android Native App.
 */

// Synthesize pleasant audio tones using Web Audio API (Zero external MP3s/assets needed)
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playAlertSound(type = "success") {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "warning" || type === "battery") {
      // Urgent descending alert (Warning for Battery <= 10%)
      osc.type = "sine";
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(523.25, now + 0.15); // C5
      osc.frequency.setValueAtTime(440.00, now + 0.30); // A4
      
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

      osc.start(now);
      osc.stop(now + 0.55);
    } else {
      // Pleasant ascending chime (Prompt response ready)
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880.00, now + 0.14); // A5

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.start(now);
      osc.stop(now + 0.45);
    }
  } catch (_) {}
}

export function triggerHaptic(duration = 250) {
  try {
    // Priority 1: Android Studio Native Bridge
    if (window.AndroidNative && typeof window.AndroidNative.vibrate === "function") {
      window.AndroidNative.vibrate(duration);
      return;
    }
    // Priority 2: Standard HTML5 Vibration API
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([duration, 80, duration]);
    }
  } catch (_) {}
}

export async function requestNotificationPermission() {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  } catch (_) {}
}

export function sendAppNotification(title, body, type = "success") {
  // 1. Audio tone
  playAlertSound(type);

  // 2. Physical haptic vibration
  triggerHaptic(type === "battery" ? 400 : 200);

  // 3. Android Studio Native App System Notification (if running in Android Studio APK)
  try {
    if (window.AndroidNative && typeof window.AndroidNative.postNotification === "function") {
      window.AndroidNative.postNotification(title, body);
      return;
    }
  } catch (_) {}

  // 4. Web Browser / PWA System Notification
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, {
        body: body,
        icon: "/favicon.svg",
        badge: "/favicon.svg",
        vibrate: [200, 100, 200],
        tag: type === "battery" ? "laptop-battery-critical" : "agent-response-ready",
        renotify: true
      });
    }
  } catch (_) {}
}
