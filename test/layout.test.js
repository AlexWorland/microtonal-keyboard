// test/layout.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { buildCells } from "../src/layout.js";
import { bestFifth, tone, gcd } from "../src/tuning.js";

const BASE = 440;
// Coprime, non-degenerate N take the lattice path (multi-row isomorphic band).
const LATTICE_N = [5, 7, 12, 17, 19];

test("every cell's step is within the pitch window [0, 2N]", () => {
  for (let N = 2; N <= 24; N++) {
    const cells = buildCells(BASE, N);
    assert.ok(cells.length > 0, `non-empty band at N=${N}`);
    for (const c of cells) {
      assert.ok(c.step >= 0 && c.step <= 2 * N,
        `cell (${c.u},${c.v}) step=${c.step} out of [0,${2 * N}] at N=${N}`);
    }
  }
});

test("origin (0,0) present: step 0, base pitch, pitch class 0, at screen (0,0)", () => {
  for (const N of LATTICE_N) {
    const cells = buildCells(BASE, N);
    const origin = cells.find(c => c.u === 0 && c.v === 0);
    assert.ok(origin, `origin present at N=${N}`);
    assert.equal(origin.step, 0);
    assert.equal(origin.pitch, BASE);
    assert.equal(origin.pitchClass, 0);
    assert.equal(origin.x, 0);
    assert.equal(origin.y, 0);
  }
});

test("intentional duplicate pitches exist (isomorphic repetition kept)", () => {
  const cells = buildCells(BASE, 12);
  const byStep = new Map();
  for (const c of cells) byStep.set(c.step, (byStep.get(c.step) ?? 0) + 1);
  const duplicatedSteps = [...byStep.values()].filter(n => n > 1);
  assert.ok(duplicatedSteps.length > 0,
    "expected at least one step reachable from multiple (u,v) cells");
  const pc0 = cells.filter(c => c.pitchClass === 0);
  assert.ok(pc0.length > 1, "pitch class 0 should recur across the band");
});

test("each cell has a 6-vertex polygon points string and finite coords", () => {
  const cells = buildCells(BASE, 12);
  for (const c of cells) {
    const pairs = c.points.trim().split(/\s+/);
    assert.equal(pairs.length, 6, `6 vertices for (${c.u},${c.v})`);
    for (const p of pairs) {
      const [px, py] = p.split(",").map(Number);
      assert.ok(Number.isFinite(px) && Number.isFinite(py));
    }
    assert.ok(Number.isFinite(c.x) && Number.isFinite(c.y));
  }
});

// CRITICAL: every N in range must reach ALL N pitch classes. The lattice alone only
// spans multiples of gcd(g,N); the fallback covers the non-coprime/degenerate N.
test("every N in 2..24 reaches all N distinct pitch classes", () => {
  for (let N = 2; N <= 24; N++) {
    const cells = buildCells(BASE, N);
    const pcs = new Set(cells.map(c => c.pitchClass));
    assert.equal(pcs.size, N,
      `N=${N} reached ${pcs.size} of ${N} pitch classes`);
  }
});

// CRITICAL: enumeration completeness PER COLUMN. For the lattice path, widening the
// vertical search (via a brute-force v-scan) at the same COLS must yield NO extra
// in-window cells. This pins that the contiguous v-range derivation drops nothing.
test("lattice enumeration is complete per column (no in-window cell missed)", () => {
  for (const N of LATTICE_N) {
    const COLS = 12;
    const cells = buildCells(BASE, N, { cols: COLS });
    const got = new Set(cells.map(c => `${c.u},${c.v}`));

    // Brute-force reference: same column band, exhaustive v.
    const g = bestFifth(N);
    const ref = new Set();
    for (let cc = -COLS; cc <= COLS; cc++) {
      for (let v = -1000; v <= 1000; v++) {
        const step = cc * g + v * N; // == u*g + v*fourth with u = v + cc
        if (step >= 0 && step <= 2 * N) {
          const u = v + cc;
          ref.add(`${u},${v}`);
        }
      }
    }
    assert.deepEqual(
      [...got].sort(), [...ref].sort(),
      `N=${N}: column-bounded enumeration must match exhaustive v-scan`);
  }
});

// Pin the default N=12 cell count so the manual smoke test has a verified reference.
test("N=12 default (COLS=12) produces exactly 53 cells", () => {
  const cells = buildCells(BASE, 12);
  assert.equal(cells.length, 53);
});

// Widening COLS only adds columns; it never drops cells present at a smaller COLS.
test("widening COLS is monotonic (subset relationship) on the lattice path", () => {
  const narrow = buildCells(BASE, 12, { cols: 8 });
  const wide = buildCells(BASE, 12, { cols: 16 });
  const wideSet = new Set(wide.map(c => `${c.u},${c.v}`));
  for (const c of narrow) {
    assert.ok(wideSet.has(`${c.u},${c.v}`),
      `cell (${c.u},${c.v}) at COLS=8 must persist at COLS=16`);
  }
  assert.ok(wide.length > narrow.length, "wider window has more cells");
});
