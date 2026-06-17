// src/main.js
// DOM glue: reads control state, recomputes layout, repaints SVG, and (Task 9)
// wires pointer events to the audio engine.

import { buildCells } from "./layout.js";
import { createRenderer } from "./render.js";

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

// Waveform/volume affect audio only (Task 9). They do not change layout, so no
// recompute() here — listeners are added in Task 9.

// Initial paint.
recompute();
