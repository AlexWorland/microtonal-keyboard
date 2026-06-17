// src/layout.js
// Pure, DOM-free lattice layout. Enumerates the Wicki-Hayden hex grid for N-TET,
// clips to the pitch window [0, 2N], maps (u,v) -> screen (x,y) + hex polygon.
// The lattice band is infinite along its kernel; we enumerate a finite display
// window bounded by a fixed column count (the horizontal axis c = u - v).

import { bestFifth, fourth, tone, gcd, pitchFor, pitchClass } from "./tuning.js";

const SQRT3 = Math.sqrt(3);
const DEFAULT_COLS = 12; // display budget along the horizontal axis (u - v)

// Flat-top hex polygon points centered on (cx, cy), radius R (center-to-vertex).
function hexPoints(cx, cy, R) {
  let s = "";
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i);
    const px = (cx + R * Math.cos(a)).toFixed(2);
    const py = (cy + R * Math.sin(a)).toFixed(2);
    s += (i ? " " : "") + px + "," + py;
  }
  return s;
}

function makeCell(base, N, u, v, step, R, kx, ky) {
  const x = (u - v) * kx;
  const y = -(u + v) * ky + 0; // `+ 0` normalizes the origin's -0 to +0 (Object.is-safe)
  return {
    u, v, step,
    pitch: pitchFor(base, N, step),
    pitchClass: pitchClass(step, N),
    x, y,
    points: hexPoints(x, y, R),
  };
}

export function buildCells(base, N, opts = {}) {
  const R = opts.hexRadius ?? 28;
  const COLS = opts.cols ?? DEFAULT_COLS;
  const g = bestFifth(N);
  const f = fourth(N);
  const t = tone(N);
  const kx = 1.5 * R;            // horizontal spacing for flat-top hexes
  const ky = (SQRT3 / 2) * R;
  const cells = [];

  // Fallback: the lattice only spans pitch classes that are multiples of gcd(g,N),
  // and at t<=0 the whole-tone axis collapses. For these N (2,4,6,10,14,15,20,21,24)
  // emit a single uniform row so every pitch class 0..N-1 is reachable.
  if (t <= 0 || gcd(g, N) > 1) {
    const dx = 1.5 * R;
    for (let s = 0; s <= 2 * N; s++) {
      const x = s * dx, y = 0;
      cells.push({
        u: s, v: 0, step: s,
        pitch: pitchFor(base, N, s),
        pitchClass: pitchClass(s, N),
        x, y,
        points: hexPoints(x, y, R),
      });
    }
    return cells;
  }

  // Lattice path. Enumerate columns c = u - v over [-COLS, COLS]; for each column the
  // in-window cells are a contiguous v-range. step = c*g + v*N (== u*g + v*f, u = v+c).
  for (let c = -COLS; c <= COLS; c++) {
    const vLo = Math.ceil((0 - c * g) / N);
    const vHi = Math.floor((2 * N - c * g) / N);
    for (let v = vLo; v <= vHi; v++) {
      const u = v + c;
      const step = u * g + v * f; // identical to c*g + v*N; kept in (u,v,f) form
      if (step < 0 || step > 2 * N) continue; // defensive; range is already exact
      cells.push(makeCell(base, N, u, v, step, R, kx, ky));
    }
  }
  return cells;
}
