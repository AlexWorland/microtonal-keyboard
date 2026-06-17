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

function releasePointer(pointerId) {
  const entry = activeVoices.get(pointerId);
  if (!entry) return;
  stopVoice(entry.handle);
  activeVoices.delete(pointerId);
}

function pressKey(event) {
  const key = keyFromEvent(event);
  if (!key) return;
  initAudio(); // construct + resume the context inside the user gesture
  const freq = Number(key.dataset.freq); // full precision, not the label
  const handle = startVoice(freq);
  if (!handle) return;
  // Capture so we keep receiving move/up for this pointer even off the key.
  try { key.setPointerCapture(event.pointerId); } catch (_) { /* ignore */ }
  activeVoices.set(event.pointerId, { handle, key });
}

// Per-key "leave releases": if the pointer has dragged off its originating key,
// release that voice. document.elementFromPoint sees through pointer capture.
function moveKey(event) {
  const entry = activeVoices.get(event.pointerId);
  if (!entry) return;
  const under = document.elementFromPoint(event.clientX, event.clientY);
  if (under !== entry.key) {
    releasePointer(event.pointerId);
  }
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
