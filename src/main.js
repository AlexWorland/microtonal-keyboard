// src/main.js
// DOM glue: reads control state, recomputes layout, repaints SVG, and (Task 9)
// wires pointer events to the audio engine.

import { buildCells } from "./layout.js";
import { createRenderer } from "./render.js";
import { initAudio, setWaveform, setVolume, startVoice, stopVoice } from "./audio.js";

const baseInput = document.getElementById("base");
const preset220 = document.getElementById("preset220");
const preset440 = document.getElementById("preset440");
const nRange = document.getElementById("n");
const nNumber = document.getElementById("nNumber");
const waveformSelect = document.getElementById("waveform");
const volumeInput = document.getElementById("volume");
const svgEl = document.getElementById("keyboard");

const renderer = createRenderer(svgEl);

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
  const cells = buildCells(base, N);
  renderer.render(cells, N);
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
// hex) never leaks a voice. Each entry tracks the originating polygon for per-hex
// "drag-off releases" behavior.
const activeVoices = new Map(); // pointerId -> { handle, polygon }

function hexFromEvent(event) {
  const t = event.target;
  return (t && t.tagName === "polygon") ? t : null;
}

function releasePointer(pointerId) {
  const entry = activeVoices.get(pointerId);
  if (!entry) return;
  stopVoice(entry.handle);
  activeVoices.delete(pointerId);
}

function pressHex(event) {
  const hex = hexFromEvent(event);
  if (!hex) return;
  initAudio(); // construct + resume the context inside the user gesture
  const freq = Number(hex.dataset.freq); // full precision, not the label
  const handle = startVoice(freq);
  if (!handle) return;
  // Capture so we keep receiving move/up for this pointer even off the polygon.
  try { hex.setPointerCapture(event.pointerId); } catch (_) { /* ignore */ }
  activeVoices.set(event.pointerId, { handle, polygon: hex });
}

// Per-hex "leave releases": if the pointer has dragged off its originating polygon,
// release that voice. document.elementFromPoint sees through pointer capture.
function moveHex(event) {
  const entry = activeVoices.get(event.pointerId);
  if (!entry) return;
  const under = document.elementFromPoint(event.clientX, event.clientY);
  if (under !== entry.polygon) {
    releasePointer(event.pointerId);
  }
}

function upHex(event) {
  releasePointer(event.pointerId);
}

svgEl.addEventListener("pointerdown", pressHex);
svgEl.addEventListener("pointermove", moveHex);
svgEl.addEventListener("pointerup", upHex);
svgEl.addEventListener("pointercancel", upHex);

// Apply the initial audio settings (read current control values) and paint.
setWaveform(waveformSelect.value);
setVolume(volumeInput.value);
recompute();
