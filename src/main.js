// src/main.js
// DOM glue: reads control state, recomputes layout, repaints SVG, and (Task 9)
// wires pointer events to the audio engine.

import { pianoKeys } from "./piano.js";
import { createPianoRenderer } from "./pianoRender.js";
import { initAudio, setWaveform, setVolume, startVoice, stopVoice, stopAllVoices } from "./audio.js";

const baseInput = document.getElementById("base");
const preset220 = document.getElementById("preset220");
const preset440 = document.getElementById("preset440");
const nRange = document.getElementById("n");
const nNumber = document.getElementById("nNumber");
const waveformSelect = document.getElementById("waveform");
const volumeInput = document.getElementById("volume");
const stopAllBtn = document.getElementById("stopAll");
const svgEl = document.getElementById("keyboard");
const fBaseEl = document.getElementById("fBase");
const fNEl = document.getElementById("fN");
const fMaxEl = document.getElementById("fMax");

const renderer = createPianoRenderer(svgEl);

function clampN(value) {
  let n = Math.round(Number(value));
  if (!Number.isFinite(n)) n = 12;
  return Math.max(2, Math.min(24, n));
}

function readState() {
  let base = Number(baseInput.value);
  if (!Number.isFinite(base) || base <= 0) base = 440;
  return {
    base,
    N: clampN(nRange.value),
    waveform: waveformSelect.value,
    volume: Number(volumeInput.value),
  };
}

// Live frequency-formula readout: f(k) = base * 2^(k/N), with the current values.
function updateFormula(base, N) {
  fBaseEl.textContent = String(base); // Number -> "440" or "432.5"
  fNEl.textContent = String(N);
  fMaxEl.textContent = String(2 * N);
}

function recompute() {
  // Retuning replaces every key element, so stop anything sounding first —
  // otherwise latched/held notes from the old tuning ring on with no visible key.
  stopAll();
  const { base, N } = readState();
  updateFormula(base, N);
  const layout = pianoKeys(base, N);
  renderer.render(layout, N);
}

// Keep the N slider and number box in sync, clamped to 2..24.
function syncN(source) {
  const n = clampN(source.value);
  nRange.value = String(n);
  nNumber.value = String(n);
  recompute();
}

nRange.addEventListener("input", () => syncN(nRange));
nNumber.addEventListener("input", () => syncN(nNumber));
nNumber.addEventListener("change", () => syncN(nNumber));

baseInput.addEventListener("input", recompute);
baseInput.addEventListener("change", recompute);

preset220.addEventListener("click", () => { baseInput.value = "220"; recompute(); });
preset440.addEventListener("click", () => { baseInput.value = "440"; recompute(); });

// Waveform/volume affect audio only (no layout recompute).
waveformSelect.addEventListener("change", () => setWaveform(waveformSelect.value));
volumeInput.addEventListener("input", () => setVolume(volumeInput.value));

// Active voices keyed by pointerId so multi-touch (incl. two pointers on the same
// key) never leaks a voice. Each entry tracks the originating key element for
// per-key "drag-off releases" behavior.
const activeVoices = new Map(); // pointerId -> { handle, key }

// Double-click-latched (held) notes, keyed by the key's data-step. Independent of
// pointer voices — they sustain until double-clicked again or "Stop all".
const latched = new Map(); // step (string) -> voice handle

// A key is any rendered element carrying data-freq (rect for piano, polygon for
// the legacy hex view). Labels set pointer-events:none so they never match.
function keyFromEvent(event) {
  const t = event.target;
  return (t && t.dataset && t.dataset.freq != null) ? t : null;
}

// The key element under a set of viewport coordinates, or null. elementFromPoint
// sees through pointer capture, so it reports the key actually under the pointer
// mid-drag (not the captured originating key).
function keyUnder(clientX, clientY) {
  const under = document.elementFromPoint(clientX, clientY);
  return (under && under.dataset && under.dataset.freq != null) ? under : null;
}

// Stop this pointer's current note (if any) and clear its visual highlight.
function stopCurrent(entry) {
  if (entry.handle) {
    stopVoice(entry.handle);
    entry.handle = null;
  }
  if (entry.key) {
    entry.key.classList.remove("pkey--playing");
    entry.key = null;
  }
}

// Sound a key for this pointer and highlight it.
function startOn(entry, key) {
  const handle = startVoice(Number(key.dataset.freq)); // full precision, not the label
  entry.handle = handle;
  entry.key = key;
  if (handle) key.classList.add("pkey--playing");
}

function releasePointer(pointerId) {
  const entry = activeVoices.get(pointerId);
  if (!entry) return;
  stopCurrent(entry);
  activeVoices.delete(pointerId);
}

function pressKey(event) {
  const key = keyFromEvent(event);
  if (!key) return;
  initAudio(); // construct + resume the context inside the user gesture
  // Defensive: if a prior gesture for this pointerId never released (e.g. the
  // button came up outside the window), clear it first so we never orphan a
  // voice that can no longer be stopped via bookkeeping.
  if (activeVoices.has(event.pointerId)) releasePointer(event.pointerId);
  // Capture so we keep receiving move/up for this pointer even off the key.
  try { key.setPointerCapture(event.pointerId); } catch (_) { /* ignore */ }
  const entry = { handle: null, key: null };
  activeVoices.set(event.pointerId, entry);
  startOn(entry, key);
}

// Glissando: while the button is held, dragging onto a new key stops the previous
// note and sounds the new one (one note at a time). Dragging into an empty gap
// silences until a key is entered again.
function moveKey(event) {
  const entry = activeVoices.get(event.pointerId);
  if (!entry) return; // button not down for this pointer
  const key = keyUnder(event.clientX, event.clientY);
  if (key === entry.key) return; // still on the same key (or still in a gap)
  stopCurrent(entry);
  if (key) startOn(entry, key);
}

function upKey(event) {
  releasePointer(event.pointerId);
}

// Double-click a key to latch it (sustain indefinitely); double-click again to
// release it. Latched notes are independent of press/drag voices.
function toggleLatch(event) {
  const key = keyFromEvent(event);
  if (!key) return;
  initAudio();
  const id = key.dataset.step;
  if (latched.has(id)) {
    stopVoice(latched.get(id));
    latched.delete(id);
    key.classList.remove("pkey--latched");
  } else {
    const handle = startVoice(Number(key.dataset.freq));
    if (handle) {
      latched.set(id, handle);
      key.classList.add("pkey--latched");
    }
  }
}

// Panic: stop every sounding note — pointer voices, latched notes, and (via the
// audio-level panic) any voice that leaked from a missed release.
function stopAll() {
  for (const id of [...activeVoices.keys()]) releasePointer(id);
  for (const handle of latched.values()) stopVoice(handle);
  latched.clear();
  document
    .querySelectorAll(".pkey--playing, .pkey--latched")
    .forEach((e) => e.classList.remove("pkey--playing", "pkey--latched"));
  stopAllVoices(); // backstop: kill anything still ringing in the audio graph
}

svgEl.addEventListener("pointerdown", pressKey);
svgEl.addEventListener("pointermove", moveKey);
svgEl.addEventListener("dblclick", toggleLatch);

// Release on the WINDOW, not just the SVG: a glissando whose button-up lands
// outside the keyboard (or outside the window, which fires lostpointercapture
// instead of pointerup) must still stop the note. This is the stuck-note fix.
window.addEventListener("pointerup", upKey);
window.addEventListener("pointercancel", upKey);
window.addEventListener("lostpointercapture", upKey);

stopAllBtn.addEventListener("click", stopAll);

// Apply the initial audio settings (read current control values) and paint.
setWaveform(waveformSelect.value);
setVolume(volumeInput.value);
recompute();
