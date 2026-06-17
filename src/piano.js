// src/piano.js
// Pure, DOM-free piano-layout kernel. Lays out a two-octave linear keyboard for
// N-TET: every step 0..2N is a key in pitch order (so no note is ever missing).
// White vs raised-black is decided by the fifth-generated diatonic (a MOS): at
// N=12 the white set is exactly C D E F G A B. When 7 distinct fifth-generated
// naturals do not exist, the keyboard falls back to a uniform all-white row.

import { bestFifth, pitchFor, pitchClass } from "./tuning.js";

export const OCTAVES = 2;

// Geometry defaults (abstract layout units; the renderer scales them via viewBox).
const STAGE_H = 100;
const WHITE_W = 24;
const BLACK_H_RATIO = 0.62;   // black key height as a fraction of white height
const BLACK_W_MAX_RATIO = 0.62; // black key width ceiling as a fraction of white width
const BLACK_W_CROWD = 0.9;    // when a gap holds m blacks, width <= 0.9*whiteW/m
const BLACK_SPACING = 1.02;   // center-to-center spacing as a multiple of black width

// White pitch classes = the 7 fifth-generated naturals centered F..B (chain
// positions j = -1..5). At N=12, g=7 this is {0,2,4,5,7,9,11} — the piano whites.
// Returns a Set, or null to signal "uniform / all white" when the 7 are not
// distinct (small N or N whose best fifth is too coprime-poor).
export function whitePitchClasses(N) {
  const g = bestFifth(N);
  const set = new Set();
  for (let j = -1; j <= 5; j++) {
    set.add(((j * g) % N + N) % N);
  }
  return set.size === 7 ? set : null;
}

// Lay out the two-octave keyboard. opts.whiteW / opts.stageH override geometry
// (used by tests for deterministic coordinates).
export function pianoKeys(base, N, opts = {}) {
  const stageH = opts.stageH ?? STAGE_H;
  const whiteW = opts.whiteW ?? WHITE_W;
  const totalSteps = OCTAVES * N; // keys are steps 0..2N inclusive

  const whites = whitePitchClasses(N); // Set or null
  const isWhite = (pc) => (whites === null ? true : whites.has(pc));

  // Pass 1: every step 0..2N becomes a key in pitch order.
  const keys = [];
  for (let step = 0; step <= totalSteps; step++) {
    const pc = pitchClass(step, N);
    keys.push({
      step,
      pitch: pitchFor(base, N, step),
      pitchClass: pc,
      isWhite: isWhite(pc),
      isOrigin: step === 0,
      x: 0, y: 0, w: 0, h: 0,
    });
  }

  // Pass 2: white keys are equal-width contiguous rects, left to right.
  const whiteKeys = keys.filter((k) => k.isWhite);
  whiteKeys.forEach((k, i) => {
    k.x = i * whiteW;
    k.y = 0;
    k.w = whiteW;
    k.h = stageH;
  });

  // Pass 3: place black keys. Each black falls between two whites; group blacks
  // by that boundary and spread a group symmetrically about the boundary,
  // shrinking width so a crowded gap (high N) never overflows into a neighbour.
  const blackKeys = keys.filter((k) => !k.isWhite);
  const whiteSteps = whiteKeys.map((k) => k.step);
  const whitesBelow = (step) => {
    let n = 0;
    for (const ws of whiteSteps) { if (ws < step) n++; else break; }
    return n;
  };

  const groups = new Map(); // boundaryIndex -> [blackKeys]
  for (const b of blackKeys) {
    const wb = whitesBelow(b.step);
    if (!groups.has(wb)) groups.set(wb, []);
    groups.get(wb).push(b);
  }

  for (const [wb, group] of groups) {
    const boundaryX = wb * whiteW; // boundary between white[wb-1] and white[wb]
    const m = group.length;
    const blackW = Math.min(whiteW * BLACK_W_MAX_RATIO, (whiteW * BLACK_W_CROWD) / m);
    const spacing = blackW * BLACK_SPACING;
    group.forEach((b, idx) => {
      const centerX = boundaryX + (idx - (m - 1) / 2) * spacing;
      b.x = centerX - blackW / 2;
      b.y = 0;
      b.w = blackW;
      b.h = stageH * BLACK_H_RATIO;
    });
  }

  return {
    keys,
    whiteKeys,
    blackKeys,
    uniform: whites === null,
    width: whiteKeys.length * whiteW,
    height: stageH,
  };
}
