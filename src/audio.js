// src/audio.js
// Web Audio kernel. No DOM. One shared AudioContext (lazy, gesture-resumed),
// polyphonic voices: osc(type) -> gain(envelope) -> masterGain(volume) -> destination.

let ctx = null;
let masterGain = null;
let currentType = "sine";
let currentVolume = 0.3;        // headroom for polyphony; not full-scale
const voices = new Set();        // active VoiceHandle set

const ATTACK = 0.008;            // 8 ms linear up-ramp, click-free
const RELEASE = 0.12;            // 120 ms exponential tail
const PEAK = 0.9;                // per-voice peak (< 1 leaves master headroom)
const FLOOR = 0.0001;            // exp-ramp target (exp cannot reach 0)

// Idempotent: construct the context once, resume on every call (gesture handler).
export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; // Safari prefix
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = currentVolume;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === "suspended") {
    ctx.resume(); // returns a Promise; fire-and-forget is fine here
  }
  return ctx;
}

export function setWaveform(w) {
  currentType = (w === "saw") ? "sawtooth" : w; // normalize spec value
  for (const handle of voices) {
    if (!handle.stopped) handle.osc.type = currentType;
  }
}

export function setVolume(v) {
  currentVolume = Math.max(0, Math.min(1, Number(v)));
  if (masterGain && ctx) {
    const now = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(currentVolume, now + 0.02); // de-zipper
  }
}

export function startVoice(freq) {
  if (!ctx) initAudio();
  if (!ctx || ctx.state !== "running") {
    // Context still resuming; starting now risks a silent/clipped voice. Bail.
    return null;
  }
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = currentType;
  osc.frequency.setValueAtTime(freq, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);                       // attack must start at 0
  gain.gain.linearRampToValueAtTime(PEAK, now + ATTACK);  // linear up-ramp, click-free

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);

  const handle = { osc, gain, freq, stopped: false };
  voices.add(handle);
  return handle;
}

export function stopVoice(handle) {
  if (!handle || handle.stopped || !ctx) return; // idempotent
  handle.stopped = true;

  const now = ctx.currentTime;
  const g = handle.gain.gain;

  // Pin the current value so the release ramp starts where we actually are.
  // exponentialRampToValueAtTime requires a strictly-positive start value; on a
  // very fast tap the attack ramp may not have advanced and g.value can be 0,
  // so clamp the start up to FLOOR before the exp ramp.
  g.cancelScheduledValues(now);
  g.setValueAtTime(Math.max(g.value, FLOOR), now);        // mid-attack-safe (>0)
  g.exponentialRampToValueAtTime(FLOOR, now + RELEASE);   // exp cannot target 0

  handle.osc.stop(now + RELEASE + 0.02);
  handle.osc.onended = () => {
    try {
      handle.osc.disconnect();
      handle.gain.disconnect();
    } catch (_) { /* already disconnected */ }
    voices.delete(handle);
  };
}
