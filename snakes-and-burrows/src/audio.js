/* Synthesised SFX + haptics. No audio files, so the single-file build stays a
   single file. The context is created on the first gesture, as mobile requires. */

let ctx = null, master = null;
export const sfx = { muted: false };

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
  return ctx;
}

/** Call from a pointerdown handler so iOS unlocks the context. */
export function unlock() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}

function blip({ freq = 440, to = freq, dur = 0.09, type = 'sine', gain = 1, delay = 0 }) {
  if (sfx.muted) return;
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(master);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

function buzz(ms) {
  if (sfx.muted) return;
  try { navigator.vibrate?.(ms); } catch (_) {}
}

export const SFX = {
  /** one cell of travel — pitch rises as the snake comes further out */
  tick(level, total) {
    const k = total > 1 ? (level - 1) / (total - 1) : 0;
    blip({ freq: 320 + k * 220, to: 380 + k * 240, dur: 0.055, type: 'triangle', gain: 0.5 });
    buzz(8);
  },
  retract() { blip({ freq: 300, to: 170, dur: 0.11, type: 'triangle', gain: 0.45 }); buzz(10); },
  cross()   { blip({ freq: 180, to: 110, dur: 0.13, type: 'square', gain: 0.3 }); buzz([12, 30, 12]); },
  undo()    { blip({ freq: 260, to: 200, dur: 0.09, type: 'sine', gain: 0.4 }); },
  line()    {
    blip({ freq: 660, dur: 0.1, type: 'sine', gain: 0.5 });
    blip({ freq: 990, dur: 0.12, type: 'sine', gain: 0.4, delay: 0.07 });
    buzz(18);
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) =>
      blip({ freq: f, dur: 0.22, type: 'sine', gain: 0.5, delay: i * 0.1 }));
    buzz([20, 40, 20, 40, 60]);
  },
  blocked() { blip({ freq: 140, dur: 0.07, type: 'sawtooth', gain: 0.22 }); },
};
