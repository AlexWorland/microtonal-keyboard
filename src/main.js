// src/main.js
// DOM glue: reads control state, recomputes layout, repaints SVG, and (Task 9)
// wires pointer events to the audio engine.

import { pianoKeys } from "./piano.js";
import { createPianoRenderer } from "./pianoRender.js";
import { initAudio, setWaveform, setVolume, startVoice, stopVoice } from "./audio.js";

const baseInput = document.getElementById("base");
const preset220 = document.getElementById("preset220");
const preset440 = document.getElementById("preset440");
const nRange = document.getElementById("n");
const nNumber = document.getElementById("nNumber");
const waveformSelect = document.getElementById("waveform");
const volumeInput = document.getElementById("volume");
const svgEl = document.getElementById("keyboard");

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

function recompute() {
  const { base, N } = readState();
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

svgEl.addEventListener("pointerdown", pressKey);
svgEl.addEventListener("pointermove", moveKey);
svgEl.addEventListener("pointerup", upKey);
svgEl.addEventListener("pointercancel", upKey);

// Apply the initial audio settings (read current control values) and paint.
setWaveform(waveformSelect.value);
setVolume(volumeInput.value);
recompute();
