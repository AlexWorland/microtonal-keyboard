# Microtonal Isomorphic Keyboard Implementation Plan

> For agentic workers: execute this plan using the superpowers:subagent-driven-development workflow. Each task is a self-contained TDD unit. Do not skip the "run it & see it fail" steps — observing the red state before writing implementation is mandatory. Commit after every task.

**Goal:** Build a single-page web app that renders a generalized Wicki-Hayden isomorphic hex keyboard for any N-tone equal temperament (N-TET), N in 2..24. Each hex is a playable pitch; the lattice repeats octave-equivalent pitches by design. Controls (base frequency, N, waveform, volume) recompute and re-render the keyboard live and drive Web Audio polyphonic playback.

**Architecture:** Strict module boundaries.
- `src/tuning.js` — pure math (DOM-free): fifth/fourth/tone, gcd, step→pitch, pitch-class.
- `src/layout.js` — pure geometry (DOM-free): lattice enumeration, pitch-window clip, (u,v)→(x,y), hex polygon points, uniform-row fallback. Imports `tuning.js`.
- `src/render.js` — DOM: paints SVG polygons + labels + pitch-class coloring + origin highlight.
- `src/audio.js` — Web Audio: shared `AudioContext`, polyphonic voices. No DOM.
- `src/main.js` — DOM glue: reads control state, calls tuning/layout, calls render, wires pointer events to audio.
- `index.html` + `styles.css` — shell, control bar, SVG container, styling.

Only `render.js` and `main.js` touch the DOM. Only `audio.js` touches `AudioContext`. `tuning.js`/`layout.js` import cleanly into Node for unit tests.

**Tech Stack:** Vanilla JavaScript (ES modules), SVG, Web Audio API. Node v26 built-in test runner (`node --test`) for unit tests. No build step. No npm runtime dependencies. No devDependencies (`node:test`/`node:assert` are built in).

## Global Constraints

Copy these verbatim from the spec; they govern every task.

- **No build step.** App opens by serving `index.html` (ES module imports require http for some browsers). No bundler, no transpiler.
- **No runtime dependencies, no devDependencies.** `package.json` has no `dependencies` and no `devDependencies` block. Tests use only Node built-ins (`node:test`, `node:assert/strict`).
- **ES modules everywhere.** `package.json` sets `"type": "module"`; all `src/*.js` use `import`/`export`; all imports carry the explicit `.js` extension (Node ESM has no extensionless resolution).
- **N range: 2..24 inclusive. Default N = 12.**
- **Base frequency default = 440 Hz.** Presets: 220 / 440.
- **Waveforms:** sine / triangle / square / saw. (`'saw'` normalizes to `OscillatorNode.type = 'sawtooth'` inside `audio.js`.)
- **Pitch window:** render every cell with `step` in `[0, 2N]` inclusive (two octaves). Duplicate-pitch hexes are kept intentionally — repetition is the defining visual feature.
- **Finite render window (NOT an infinite-completeness claim).** The lattice map `(u,v) → step = u*g + v*fourth` has an infinite kernel along `(fourth, -g)`: infinitely many `(u,v)` keep `step` in `[0, 2N]`, so the band is mathematically unbounded. The renderer therefore enumerates a **deliberate finite display window** bounded by a fixed column count `COLS` (the horizontal screen axis `u - v`). For each column the full `v`-range satisfying the step window is enumerated, so the window is *complete per column* — no in-window cell inside the column band is dropped. Widening `COLS` only adds more columns of the (infinite) band; it is a display budget, not a completeness bound.
- **Pitch-class coverage / fallback:** the isomorphic lattice only spans pitch classes that are multiples of `gcd(g, N)`. When `gcd(g, N) > 1` **or** `tone <= 0` the lattice cannot reach all N pitch classes (and at `tone <= 0` the whole-tone axis collapses). In range 2..24 this is exactly **N ∈ {2, 4, 6, 10, 14, 15, 20, 21, 24}**. For these N, layout emits a single uniform row (right neighbor = +1 EDO step, steps `0..2N`) so every pitch class 0..N-1 is reachable. This is the only conditional branch in layout logic.
- **Origin/tonic** is the cell with `u===0 && v===0` (NOT `step===0`; step 0 recurs at duplicates).
- **Out of scope (do NOT build):** QWERTY key mapping, MOS natural/accidental coloring, configurable axes, linear-vs-isomorphic toggle, recording/MIDI, scale presets.

---

### Task 0: Project scaffolding

**Files:**
- Create: `package.json`, `.gitignore`, `README.md`
- Create (empty dir markers): `src/`, `test/`
- Modify: none
- Test: none (scaffolding only)

**Interfaces:**
- Consumes: nothing
- Produces: ESM-enabled project with a `test` script, no deps. Directory layout `src/` (modules), `test/` (unit tests), `index.html` + `styles.css` at root.

Steps:

- [ ] **Step 1: Create the directory layout.**
```bash
mkdir -p /Users/aworland/projects/microtonal-keyboard/src
mkdir -p /Users/aworland/projects/microtonal-keyboard/test
```

- [ ] **Step 2: Write `package.json` with `"type":"module"` and NO deps.**
Write `/Users/aworland/projects/microtonal-keyboard/package.json`:
```json
{
  "name": "microtonal-keyboard",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "description": "Microtonal isomorphic (Wicki-Hayden) hex keyboard for N-TET.",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 3: Write `.gitignore`.**
Write `/Users/aworland/projects/microtonal-keyboard/.gitignore`:
```gitignore
node_modules/
.DS_Store
*.log
.idea/
.vscode/
```

- [ ] **Step 4: Write `README.md` with the http.server run note.**
Write `/Users/aworland/projects/microtonal-keyboard/README.md`:
```markdown
# Microtonal Isomorphic Keyboard

A generalized Wicki-Hayden hexagonal keyboard for N-tone equal temperament (N-TET),
N in 2..24. Pure vanilla JS (ES modules) + SVG + Web Audio. No build step, no
runtime dependencies.

## Run

ES module imports do not load from a `file://` URL in some browsers, so serve the
directory over HTTP:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/index.html

(Double-clicking `index.html` may work in some browsers but is not guaranteed
because of ES module CORS restrictions on `file://`.)

## Controls

- **Base frequency (Hz)** — number input, default 440, presets 220 / 440.
- **N divisions** — slider + number, range 2..24, default 12.
- **Waveform** — sine / triangle / square / saw.
- **Volume** — master gain slider.

Any change recomputes the tuning and re-renders the keyboard live.

## Layout notes

The keyboard is the Wicki-Hayden isomorphic lattice. The rendered band is a finite
display window (bounded by a fixed column count); the underlying lattice repeats
infinitely along its diagonal, so duplicate pitches recur by design. For N where the
best fifth is not coprime with N (and the two degenerate N where the whole tone
collapses) the lattice cannot reach every pitch class, so those N fall back to a
single uniform row so all N pitch classes remain playable. The per-hex label shows
frequency (Hz, 1 decimal) over the pitch class (step mod N, 0..N-1).

## Test

Pure logic modules (`src/tuning.js`, `src/layout.js`) have unit tests using the
built-in Node test runner (Node 20+; developed on Node 26). No dependencies.

```bash
node --test
# or
npm test
```
```

- [ ] **Step 5: Initialize git (if not already a repo) and verify the test runner runs against an empty suite.**
```bash
git -C /Users/aworland/projects/microtonal-keyboard init 2>/dev/null; cd /Users/aworland/projects/microtonal-keyboard && node --test ; echo "exit=$?"
```
Expected: with no test files yet, `node --test` run from the project root reports an empty suite — output contains `tests 0`, `pass 0`, `fail 0`, and `exit=0`. (Do NOT pass a directory path argument: on Node 26, `node --test test/` against an empty dir throws `MODULE_NOT_FOUND` and exits 1. Running with no path from the root is the correct empty-suite invocation.)

- [ ] **Step 6: Commit the scaffold.**
```bash
git -C /Users/aworland/projects/microtonal-keyboard add -A && git -C /Users/aworland/projects/microtonal-keyboard commit -m "chore: scaffold project (ESM package.json, gitignore, README, dirs)"
```

---

### Task 1: `tuning.js` — best fifth / fourth / tone / gcd (TDD)

**Files:**
- Create: `src/tuning.js`
- Test: `test/tuning.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `bestFifth(N: number): number` → `Math.round(N * Math.log2(3/2))`
  - `fourth(N: number): number` → `N - bestFifth(N)`
  - `tone(N: number): number` → `2 * bestFifth(N) - N`
  - `gcd(a: number, b: number): number` → Euclidean gcd of absolute values (used by layout to detect non-coprime N)

Steps:

- [ ] **Step 1: Write the failing test for the worked-example table + identities + gcd.**
Write `/Users/aworland/projects/microtonal-keyboard/test/tuning.test.js`:
```js
// test/tuning.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { bestFifth, fourth, tone, gcd } from "../src/tuning.js";

// Worked-example table from the spec (verified by enumeration).
const TABLE = [
  { N: 5,  g: 3,  fourth: 2,  tone: 1 },
  { N: 7,  g: 4,  fourth: 3,  tone: 1 },
  { N: 12, g: 7,  fourth: 5,  tone: 2 },
  { N: 17, g: 10, fourth: 7,  tone: 3 },
  { N: 19, g: 11, fourth: 8,  tone: 3 },
  { N: 24, g: 14, fourth: 10, tone: 4 },
];

test("bestFifth/fourth/tone match the worked-example table", () => {
  for (const row of TABLE) {
    assert.equal(bestFifth(row.N), row.g, `g for N=${row.N}`);
    assert.equal(fourth(row.N), row.fourth, `fourth for N=${row.N}`);
    assert.equal(tone(row.N), row.tone, `tone for N=${row.N}`);
  }
});

test("identity g + fourth === N for all N in 2..24", () => {
  for (let N = 2; N <= 24; N++) {
    assert.equal(bestFifth(N) + fourth(N), N, `octave identity at N=${N}`);
  }
});

test("identity tone === 2g - N === g - fourth", () => {
  for (let N = 2; N <= 24; N++) {
    assert.equal(tone(N), 2 * bestFifth(N) - N);
    assert.equal(tone(N), bestFifth(N) - fourth(N));
  }
});

test("degeneracy (tone<=0) occurs only at N=2 and N=4 across 2..24", () => {
  const degenerate = [];
  for (let N = 2; N <= 24; N++) if (tone(N) <= 0) degenerate.push(N);
  assert.deepEqual(degenerate, [2, 4]);
});

test("no N in 2..24 produces a fractional part of exactly 0.5 (round stable)", () => {
  for (let N = 2; N <= 24; N++) {
    const frac = (N * Math.log2(3 / 2)) % 1;
    assert.notEqual(frac, 0.5, `N=${N} hit a rounding tie`);
  }
});

test("gcd: Euclidean gcd of absolute values", () => {
  assert.equal(gcd(12, 8), 4);
  assert.equal(gcd(7, 12), 1);
  assert.equal(gcd(14, 24), 2);
  assert.equal(gcd(9, 15), 3);
  assert.equal(gcd(12, 20), 4);
  assert.equal(gcd(-9, 6), 3);   // absolute-value safe
  assert.equal(gcd(5, 0), 5);
});

test("non-coprime-or-degenerate N (gcd(bestFifth,N)>1 OR tone<=0) is exactly the fallback set", () => {
  const fallback = [];
  for (let N = 2; N <= 24; N++) {
    if (gcd(bestFifth(N), N) > 1 || tone(N) <= 0) fallback.push(N);
  }
  assert.deepEqual(fallback, [2, 4, 6, 10, 14, 15, 20, 21, 24]);
});
```

- [ ] **Step 2: Run it and see it fail.**
```bash
node --test /Users/aworland/projects/microtonal-keyboard/test/tuning.test.js
```
Expected: failure. Output contains `Cannot find module` / `Error: Cannot find package` referencing `../src/tuning.js` (file does not exist yet), and `tests` count with failures `> 0`.

- [ ] **Step 3: Write the minimal implementation.**
Write `/Users/aworland/projects/microtonal-keyboard/src/tuning.js`:
```js
// src/tuning.js
// Pure, DOM-free tuning kernel for N-TET (N equal divisions of the octave).

const LOG2_3_2 = Math.log2(3 / 2); // 0.5849625007211562 — JI perfect fifth in octaves

// Steps in the best (nearest) fifth, "g".
export function bestFifth(N) {
  return Math.round(N * LOG2_3_2);
}

// Octave complement of the fifth.
export function fourth(N) {
  return N - bestFifth(N);
}

// Whole tone = the Wicki horizontal axis = g - fourth = 2g - N.
export function tone(N) {
  return 2 * bestFifth(N) - N;
}

// Euclidean gcd of |a|,|b|. Layout uses gcd(bestFifth(N), N) to detect the
// non-coprime N where the lattice cannot reach all N pitch classes.
export function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}
```

- [ ] **Step 4: Run it and see it pass.**
```bash
node --test /Users/aworland/projects/microtonal-keyboard/test/tuning.test.js
```
Expected: all tests pass. Output contains `fail 0` (and `pass 7`).

- [ ] **Step 5: Commit.**
```bash
git -C /Users/aworland/projects/microtonal-keyboard add -A && git -C /Users/aworland/projects/microtonal-keyboard commit -m "feat(tuning): bestFifth/fourth/tone/gcd with worked-example + identity tests"
```

---

### Task 2: `tuning.js` — step→pitch and pitch-class (TDD)

**Files:**
- Modify: `src/tuning.js`
- Test: `test/tuning.test.js` (append)

**Interfaces:**
- Consumes: nothing
- Produces:
  - `pitchFor(base: number, N: number, step: number): number` → `base * Math.pow(2, step/N)`
  - `pitchClass(step: number, N: number): number` → `((step % N) + N) % N` (floor-mod; correct for negative step)

Steps:

- [ ] **Step 1: Append failing tests for pitch and pitch-class.**
Add to `/Users/aworland/projects/microtonal-keyboard/test/tuning.test.js`. First extend the import line:
```js
import { bestFifth, fourth, tone, gcd, pitchFor, pitchClass } from "../src/tuning.js";
```
Then append at the end of the file:
```js
function closeTo(actual, expected, eps = 1e-9) {
  return Math.abs(actual - expected) <= eps;
}

test("pitchFor: base, octave, two-octave, and irrational steps", () => {
  assert.equal(pitchFor(440, 12, 0), 440);         // step 0 = base, exact
  assert.equal(pitchFor(440, 12, 12), 880);        // octave, exact in IEEE-754
  assert.equal(pitchFor(440, 12, 24), 1760);       // two octaves, exact
  assert.ok(closeTo(pitchFor(440, 12, 7), 659.2551138257398));
  assert.ok(closeTo(pitchFor(440, 12, 5), 587.3295358348151));
  assert.ok(closeTo(pitchFor(220, 19, 11), 328.6269715640397));
  assert.equal(pitchFor(220, 19, 19), 440);        // octave at base 220, exact
});

test("step === N gives pitch exactly 2*base at every worked N", () => {
  const base = 440;
  for (const N of [2, 5, 7, 12, 17, 19, 24]) {
    assert.equal(pitchFor(base, N, N), 2 * base, `2x base at N=${N}`);
  }
});

test("pitchClass wraps mod N and is safe for negative steps", () => {
  assert.equal(pitchClass(0, 12), 0);
  assert.equal(pitchClass(7, 12), 7);
  assert.equal(pitchClass(12, 12), 0);
  assert.equal(pitchClass(13, 12), 1);
  assert.equal(pitchClass(19, 12), 7);
  assert.equal(pitchClass(24, 12), 0);
  assert.equal(pitchClass(25, 12), 1);
  // negatives (layout enumerates a band that includes negative step before clipping)
  assert.equal(pitchClass(-1, 12), 11);
  assert.equal(pitchClass(-5, 12), 7);
  assert.equal(pitchClass(-12, 12), 0);
  assert.equal(pitchClass(-13, 12), 11);
  assert.equal(pitchClass(17, 17), 0);
  assert.equal(pitchClass(18, 17), 1);
  assert.equal(pitchClass(-18, 17), 16);
});
```

- [ ] **Step 2: Run it and see it fail.**
```bash
node --test /Users/aworland/projects/microtonal-keyboard/test/tuning.test.js
```
Expected: failure. Output contains `SyntaxError` or `is not a function` for `pitchFor` / `pitchClass` (named exports do not exist yet); `fail` count `> 0`.

- [ ] **Step 3: Add the implementation.**
Append to `/Users/aworland/projects/microtonal-keyboard/src/tuning.js`:
```js
// Pitch in Hz for an integer step in N-TET. step may be any integer (incl. negative).
export function pitchFor(base, N, step) {
  return base * Math.pow(2, step / N);
}

// Pitch class = step mod N. Double-mod is mandatory: plain `%` is sign-preserving
// in JS (-1 % 12 === -1), and layout enumerates negative steps before clipping.
export function pitchClass(step, N) {
  return ((step % N) + N) % N;
}
```

- [ ] **Step 4: Run it and see it pass.**
```bash
node --test /Users/aworland/projects/microtonal-keyboard/test/tuning.test.js
```
Expected: all tests pass. Output contains `fail 0` (and `pass 10`).

- [ ] **Step 5: Commit.**
```bash
git -C /Users/aworland/projects/microtonal-keyboard add -A && git -C /Users/aworland/projects/microtonal-keyboard commit -m "feat(tuning): pitchFor + pitchClass with float-tolerance and negative-step tests"
```

---

### Task 3: `layout.js` — column-bounded lattice enumeration + pitch-window clip + geometry + uniform-row fallback (TDD)

**Files:**
- Create: `src/layout.js`
- Test: `test/layout.test.js`

**Interfaces:**
- Consumes (from `./tuning.js`): `bestFifth`, `fourth`, `tone`, `gcd`, `pitchFor`, `pitchClass`
- Produces:
  - `buildCells(base: number, N: number, opts?: { hexRadius?: number, cols?: number }): Cell[]`
  - `Cell = { u:number, v:number, step:number, pitch:number, pitchClass:number, x:number, y:number, points:string }`
  - Field set `{u,v,step,pitch,pitchClass,x,y,points}` is consumed verbatim by `render.js`; do not rename.

Enumeration (the core correctness contract):
- **Lattice (coprime, non-degenerate N):** enumerate the column index `c = u - v` over `[-COLS, COLS]` (default `COLS = 12`, the horizontal display budget). For each column, `step = c*g + v*N`, so the cells with `0 <= step <= 2N` are exactly `v` in `[ceil(-c*g / N), floor((2N - c*g) / N)]` — a small contiguous range. Recover `u = v + c`. This is **complete per column** (no in-window cell in the band is missed) and finite. It is NOT a global completeness bound — the band is infinite along the lattice kernel; `COLS` is a deliberate display window.
- **Uniform-row fallback (`gcd(g, N) > 1` OR `tone(N) <= 0`; N ∈ {2,4,6,10,14,15,20,21,24}):** emit a single row, `step = 0..2N`, right neighbor `= +1` EDO step, all on one `y`, so every pitch class 0..N-1 is reachable.

Geometry (flat-top hexes, R = center-to-vertex, default 28): `kx = 1.5*R`, `ky = (√3/2)*R`, `x = (u-v)*kx`, `y = -(u+v)*ky`. Vertices at angles `60°·i` for `i=0..5`, each `(cx + R*cos a, cy + R*sin a)` formatted `.toFixed(2)`.

Steps:

- [ ] **Step 1: Write the failing test for window membership, origin, duplicates, polygons, pitch-class coverage, and enumeration completeness.**
Write `/Users/aworland/projects/microtonal-keyboard/test/layout.test.js`:
```js
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
```

- [ ] **Step 2: Run it and see it fail.**
```bash
node --test /Users/aworland/projects/microtonal-keyboard/test/layout.test.js
```
Expected: failure. Output contains `Cannot find module` referencing `../src/layout.js`; `fail` count `> 0`.

- [ ] **Step 3: Write the full implementation (lattice path + uniform-row fallback + geometry). No placeholders — layout.js is correct at every N when first committed.**
Write `/Users/aworland/projects/microtonal-keyboard/src/layout.js`:
```js
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
  const y = -(u + v) * ky;
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
```

- [ ] **Step 4: Run it and see it pass.**
```bash
node --test /Users/aworland/projects/microtonal-keyboard/test/layout.test.js
```
Expected: all tests pass. Output contains `fail 0` (and `pass 8`). In particular the per-column-completeness, all-pitch-classes-reachable, and N=12-count-53 tests pass.

- [ ] **Step 5: Run the whole suite to confirm no regressions.**
```bash
node --test /Users/aworland/projects/microtonal-keyboard/
```
Expected: `tuning.test.js` + `layout.test.js` both green. Output contains `fail 0`.

- [ ] **Step 6: Commit.**
```bash
git -C /Users/aworland/projects/microtonal-keyboard add -A && git -C /Users/aworland/projects/microtonal-keyboard commit -m "feat(layout): column-bounded lattice enumeration, uniform-row fallback for non-coprime/degenerate N, hex geometry"
```

---

### Task 4: `audio.js` — Web Audio polyphonic voice engine

**Files:**
- Create: `src/audio.js`
- Test: none (Web Audio is browser-only; verified in the Task 10 manual smoke test)

**Interfaces:**
- Consumes: `window.AudioContext || window.webkitAudioContext`
- Produces:
  - `initAudio(): AudioContext` — idempotent; constructs lazily, resumes on every call.
  - `setWaveform(w: 'sine'|'triangle'|'square'|'saw'): void` — normalizes `'saw'`→`'sawtooth'`, mutates live voices + future.
  - `setVolume(v: number): void` — clamps `[0,1]`, ramps master gain.
  - `startVoice(freq: number): VoiceHandle | null` — returns handle, or `null` if context not yet running.
  - `stopVoice(handle: VoiceHandle | null): void` — idempotent release.
  - `VoiceHandle = { osc, gain, freq, stopped }` (opaque to callers; `main.js` never reads its fields).

Steps:

- [ ] **Step 1: Write `audio.js` in full.**
Write `/Users/aworland/projects/microtonal-keyboard/src/audio.js`:
```js
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
```

- [ ] **Step 2: Syntax-check the module loads under Node (no DOM use at import time).**
```bash
node --input-type=module -e "import('/Users/aworland/projects/microtonal-keyboard/src/audio.js').then(m => console.log(Object.keys(m).sort().join(',')))"
```
Expected output: `initAudio,setVolume,setWaveform,startVoice,stopVoice` — confirms the module parses and exports cleanly with no top-level DOM/`AudioContext` access (construction is lazy inside `initAudio`).

- [ ] **Step 3: Commit.**
```bash
git -C /Users/aworland/projects/microtonal-keyboard add -A && git -C /Users/aworland/projects/microtonal-keyboard commit -m "feat(audio): shared AudioContext + polyphonic voice engine with envelope ramps"
```

---

### Task 5: `render.js` — SVG hex rendering (factory)

**Files:**
- Create: `src/render.js`
- Test: none (DOM-only; verified in Task 10 manual smoke test)

**Interfaces:**
- Consumes: an `SVGSVGElement` handle; `Cell[]` from `layout.js`; `N`.
- Produces: `createRenderer(svgEl): { clear(): void, render(cells: Cell[], N: number): void }`.
  - Each cell → `<polygon>` with `data-freq` (full precision), `data-step`, `data-u`, `data-v`, `data-pc`, fill `hsl((pc/N)*360, 65%, 55%)`, origin `(u===0&&v===0)` gets `stroke="#000" stroke-width="3"` + `data-origin="true"`.
  - Two-line `<text>` label: frequency `.toFixed(1)` over **pitch class** (`step mod N`, 0..N-1), `pointer-events="none"`, `text-anchor="middle"`, `dominant-baseline="central"`, both `<tspan>` re-set `x=c.x`.
  - Label font size **scales down as the hex count grows** (derived from `cells.length`, not a fixed radius), clamped `[FONT_FLOOR, FONT_CEIL]`.
  - Sets `viewBox` to the padded bounding box; `preserveAspectRatio="xMidYMid meet"`.

Steps:

- [ ] **Step 1: Write `render.js` in full.**
Write `/Users/aworland/projects/microtonal-keyboard/src/render.js`:
```js
// src/render.js
// DOM module. Renders layout cells as SVG polygon hexes with two-line labels,
// pitch-class HSL coloring, and an origin/tonic highlight. Reads geometry from
// layout cells; does NOT recompute tuning or geometry.

const SVG_NS = "http://www.w3.org/2000/svg";

const PADDING = 12;        // viewBox padding in layout units
const FILL_SAT = 65;       // %
const FILL_LIGHT = 55;     // %
const TEXT_COLOR = "#111";
const ORIGIN_STROKE = "#000";
const ORIGIN_STROKE_WIDTH = 3;
const CELL_STROKE = "#ffffff";
const CELL_STROKE_WIDTH = 1;

const FONT_FLOOR = 5;      // px (layout units); never smaller
const FONT_CEIL = 16;      // px; never larger
const FONT_SCALE = 90;     // tuning constant: fontSize = FONT_SCALE / sqrt(cellCount)

function el(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  return node;
}

function pitchClassColor(pitchClass, N) {
  const hue = (pitchClass / N) * 360;
  return `hsl(${hue.toFixed(2)}, ${FILL_SAT}%, ${FILL_LIGHT}%)`;
}

function computeViewBox(cells) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of cells) {
    for (const pair of c.points.trim().split(/\s+/)) {
      const [px, py] = pair.split(",").map(Number);
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
  }
  if (!isFinite(minX)) return { x: 0, y: 0, w: 100, h: 100 }; // empty guard
  return {
    x: minX - PADDING,
    y: minY - PADDING,
    w: (maxX - minX) + PADDING * 2,
    h: (maxY - minY) + PADDING * 2,
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Font scales DOWN as the hex count grows (spec: "label font scales down as hex
// count grows at high N"). Inversely proportional to sqrt(cell count), clamped.
function labelFontSize(cells) {
  if (cells.length === 0) return FONT_CEIL;
  return clamp(FONT_SCALE / Math.sqrt(cells.length), FONT_FLOOR, FONT_CEIL);
}

export function createRenderer(svgEl) {
  function clear() {
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
  }

  function render(cells, N) {
    clear();

    const vb = computeViewBox(cells);
    svgEl.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");

    const fontSize = labelFontSize(cells);
    const layer = el("g", { class: "hex-layer" });

    for (const c of cells) {
      const isOrigin = c.u === 0 && c.v === 0; // origin = base = (0,0), NOT step 0

      const poly = el("polygon", {
        points: c.points,
        fill: pitchClassColor(c.pitchClass, N),
        stroke: isOrigin ? ORIGIN_STROKE : CELL_STROKE,
        "stroke-width": isOrigin ? ORIGIN_STROKE_WIDTH : CELL_STROKE_WIDTH,
        "data-freq": String(c.pitch),   // full precision for audio
        "data-step": String(c.step),
        "data-u": String(c.u),
        "data-v": String(c.v),
        "data-pc": String(c.pitchClass),
        class: isOrigin ? "hex hex--origin" : "hex",
      });
      if (isOrigin) poly.setAttribute("data-origin", "true");
      layer.appendChild(poly);

      const text = el("text", {
        x: c.x,
        y: c.y,
        "text-anchor": "middle",
        "dominant-baseline": "central",
        "font-size": fontSize,
        fill: TEXT_COLOR,
        "pointer-events": "none",
        class: "hex-label",
      });
      const freqLine = el("tspan", { x: c.x, dy: "-0.35em" });
      freqLine.textContent = c.pitch.toFixed(1);   // Hz, 1 decimal
      const pcLine = el("tspan", { x: c.x, dy: "1.1em" });
      pcLine.textContent = String(c.pitchClass);    // pitch class (step mod N, 0..N-1)
      text.appendChild(freqLine);
      text.appendChild(pcLine);
      layer.appendChild(text);
    }

    svgEl.appendChild(layer);
  }

  return { clear, render };
}
```

- [ ] **Step 2: Syntax-check the module parses (named export present).**
```bash
node --check /Users/aworland/projects/microtonal-keyboard/src/render.js && echo "render.js parses OK"
```
Expected output ends with `render.js parses OK`. (It references `document` only inside functions, so `--check` passes without a DOM.)

- [ ] **Step 3: Commit.**
```bash
git -C /Users/aworland/projects/microtonal-keyboard add -A && git -C /Users/aworland/projects/microtonal-keyboard commit -m "feat(render): SVG hex renderer with pitch-class coloring, count-scaled labels, origin highlight"
```

---

### Task 6: `index.html` — shell + control bar + SVG container

**Files:**
- Create: `index.html`
- Test: none

**Interfaces:**
- Consumes: `src/main.js` (module entry, loaded last).
- Produces: control elements with stable IDs that `main.js` reads:
  - `#base` (number), `#preset220` / `#preset440` (buttons), `#n` (range), `#nNumber` (number), `#waveform` (select), `#volume` (range), `#keyboard` (`<svg>`).

Steps:

- [ ] **Step 1: Write `index.html` in full.**
Write `/Users/aworland/projects/microtonal-keyboard/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Microtonal Isomorphic Keyboard</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="controls" id="controls">
    <div class="control">
      <label for="base">Base (Hz)</label>
      <input type="number" id="base" min="20" max="4000" step="1" value="440" />
      <div class="presets">
        <button type="button" id="preset220">220</button>
        <button type="button" id="preset440">440</button>
      </div>
    </div>

    <div class="control">
      <label for="n">N divisions</label>
      <input type="range" id="n" min="2" max="24" step="1" value="12" />
      <input type="number" id="nNumber" min="2" max="24" step="1" value="12" />
    </div>

    <div class="control">
      <label for="waveform">Waveform</label>
      <select id="waveform">
        <option value="sine">sine</option>
        <option value="triangle">triangle</option>
        <option value="square">square</option>
        <option value="saw">saw</option>
      </select>
    </div>

    <div class="control">
      <label for="volume">Volume</label>
      <input type="range" id="volume" min="0" max="1" step="0.01" value="0.3" />
    </div>
  </header>

  <main class="stage">
    <svg id="keyboard" class="keyboard" xmlns="http://www.w3.org/2000/svg"></svg>
  </main>

  <script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Sanity-check the IDs main.js will rely on are all present.**
```bash
grep -oE 'id="[a-zA-Z0-9]+"' /Users/aworland/projects/microtonal-keyboard/index.html | sort -u
```
Expected: lists `id="base"`, `id="controls"`, `id="keyboard"`, `id="n"`, `id="nNumber"`, `id="preset220"`, `id="preset440"`, `id="volume"`, `id="waveform"`.

- [ ] **Step 3: Commit.**
```bash
git -C /Users/aworland/projects/microtonal-keyboard add -A && git -C /Users/aworland/projects/microtonal-keyboard commit -m "feat(html): app shell, control bar, and SVG keyboard container"
```

---

### Task 7: `styles.css` — layout + hex/control styling

**Files:**
- Create: `styles.css`
- Test: none

**Interfaces:**
- Consumes: the IDs/classes from `index.html` and the classes `render.js` emits (`.hex`, `.hex--origin`, `.hex-label`, `.hex-layer`).
- Produces: control-bar layout, full-bleed SVG stage, and critically `touch-action: none` on the SVG so touch presses don't scroll the page.

Steps:

- [ ] **Step 1: Write `styles.css` in full.**
Write `/Users/aworland/projects/microtonal-keyboard/styles.css`:
```css
:root {
  --bg: #1b1d23;
  --panel: #262932;
  --text: #e8e8ec;
  --accent: #6ad;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  height: 100%;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}

body {
  display: flex;
  flex-direction: column;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  align-items: flex-end;
  padding: 0.75rem 1rem;
  background: var(--panel);
  border-bottom: 1px solid #000;
}

.control {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
}

.control label {
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.7;
}

.control input,
.control select {
  background: #11131a;
  color: var(--text);
  border: 1px solid #3a3d47;
  border-radius: 4px;
  padding: 0.25rem 0.4rem;
  font-size: 0.85rem;
}

.control input[type="range"] {
  padding: 0;
  width: 160px;
}

.presets {
  display: flex;
  gap: 0.25rem;
  margin-top: 0.25rem;
}

.presets button {
  background: #11131a;
  color: var(--text);
  border: 1px solid #3a3d47;
  border-radius: 4px;
  padding: 0.2rem 0.5rem;
  cursor: pointer;
}

.presets button:hover {
  border-color: var(--accent);
}

.stage {
  flex: 1 1 auto;
  min-height: 0;
  padding: 0.5rem;
}

.keyboard {
  width: 100%;
  height: 100%;
  display: block;
  /* CRITICAL: prevent touch scroll/pinch hijacking hex presses on mobile. */
  touch-action: none;
}

.hex {
  cursor: pointer;
  transition: filter 0.05s linear;
}

.hex:hover {
  filter: brightness(1.15);
}

.hex--origin {
  filter: brightness(1.05);
}

.hex-label {
  user-select: none;
  font-weight: 600;
}
```

- [ ] **Step 2: Confirm `touch-action: none` is present on the keyboard layer.**
```bash
grep -n "touch-action" /Users/aworland/projects/microtonal-keyboard/styles.css
```
Expected: one match on the `touch-action: none;` line inside `.keyboard`.

- [ ] **Step 3: Commit.**
```bash
git -C /Users/aworland/projects/microtonal-keyboard add -A && git -C /Users/aworland/projects/microtonal-keyboard commit -m "feat(styles): control bar layout, SVG stage, hex styling, touch-action none"
```

---

### Task 8: `main.js` — read state, recompute, render

**Files:**
- Create: `src/main.js`
- Test: none

**Interfaces:**
- Consumes: `buildCells` (layout), `createRenderer` (render); DOM controls by ID.
- Produces: `readState(): { base, N, waveform, volume }`; a `recompute()` that calls `buildCells(base, N)` then `renderer.render(cells, N)`; control listeners that keep `#n`/`#nNumber` in sync (clamped 2..24), update base via presets, and re-render on any change. Pointer wiring is added in Task 9.

Steps:

- [ ] **Step 1: Write `main.js` (state + render wiring; audio added next task).**
Write `/Users/aworland/projects/microtonal-keyboard/src/main.js`:
```js
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
```

- [ ] **Step 2: Confirm the module parses.**
```bash
node --check /Users/aworland/projects/microtonal-keyboard/src/main.js && echo "main.js parses OK"
```
Expected output ends with `main.js parses OK`.

- [ ] **Step 3: Commit.**
```bash
git -C /Users/aworland/projects/microtonal-keyboard add -A && git -C /Users/aworland/projects/microtonal-keyboard commit -m "feat(main): read control state, recompute layout, render on change"
```

---

### Task 9: `main.js` — wire audio (pointer events, waveform, volume)

**Files:**
- Modify: `src/main.js`
- Test: none

**Interfaces:**
- Consumes: `initAudio`, `setWaveform`, `setVolume`, `startVoice`, `stopVoice` from `./audio.js`.
- Produces: pointer wiring per the audio contract. Active voices are keyed by `pointerId` in a `Map` (supports multi-touch and the same hex pressed by two pointers without leaking a voice). `pointerdown` on a `<polygon>` calls `initAudio()`, captures the pointer on that polygon (`setPointerCapture`), starts a voice, and records `pointerId -> { handle, polygon }`. `pointerup` / `pointercancel` release the voice for that `pointerId`. A `pointermove` releases when the pointer has dragged off its originating polygon (true per-hex "leave releases"). Waveform select → `setWaveform`; volume input → `setVolume`. Audio settings applied once at startup.

> Why not `pointerleave`: `pointerleave` does not bubble and fires only when the pointer leaves the *whole* SVG element — never when dragging from one hex to another inside it — so it cannot implement per-hex release. Per-pointer capture + a `pointermove` hit-test (and `pointerup`/`pointercancel`) gives correct per-hex release and clean polyphony.

Steps:

- [ ] **Step 1: Add the audio import at the top of `main.js`.**
In `/Users/aworland/projects/microtonal-keyboard/src/main.js`, after the existing import block, add:
```js
import { initAudio, setWaveform, setVolume, startVoice, stopVoice } from "./audio.js";
```

- [ ] **Step 2: Wire waveform + volume controls, pointer events (per-pointerId voices), and initial audio settings.**
Replace this block in `/Users/aworland/projects/microtonal-keyboard/src/main.js`:
```js
// Waveform/volume affect audio only (Task 9). They do not change layout, so no
// recompute() here — listeners are added in Task 9.

// Initial paint.
recompute();
```
with:
```js
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
```

- [ ] **Step 3: Confirm the module still parses.**
```bash
node --check /Users/aworland/projects/microtonal-keyboard/src/main.js && echo "main.js parses OK"
```
Expected output ends with `main.js parses OK`.

- [ ] **Step 4: Run the full unit suite once more to confirm pure modules still green.**
```bash
node --test /Users/aworland/projects/microtonal-keyboard/
```
Expected: `fail 0`.

- [ ] **Step 5: Commit.**
```bash
git -C /Users/aworland/projects/microtonal-keyboard add -A && git -C /Users/aworland/projects/microtonal-keyboard commit -m "feat(main): wire pointer events to per-pointerId audio voices, waveform + volume controls"
```

---

### Task 10: Manual smoke test (browser)

**Files:**
- Modify: none (verification only). If a defect is found, fix it in the owning module under TDD (add a failing unit test first for pure-logic bugs) and re-commit.
- Test: manual, in a browser served over HTTP.

**Interfaces:**
- Consumes: the full app.
- Produces: a confirmed-working keyboard (no code output).

Steps:

- [ ] **Step 1: Serve the app over HTTP (background) and confirm it is up.**
```bash
cd /Users/aworland/projects/microtonal-keyboard && python3 -m http.server 8000
```
Run this in the background. Then in another shell confirm the shell loads:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/index.html
```
Expected: `200`.

- [ ] **Step 2: Confirm every module is served (no 404s break the module graph).**
```bash
for f in src/main.js src/layout.js src/tuning.js src/render.js src/audio.js styles.css; do printf "%s " "$f"; curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8000/$f"; done
```
Expected: each line ends in `200`.

- [ ] **Step 3: Open in a browser and verify the default render.**
Open `http://localhost:8000/index.html`. Confirm visually:
  - A diagonal band of colored flat-top hexes appears. At the default N=12 the band is **53 cells** (this exact count is pinned by the `layout.test.js` "N=12 default (COLS=12) produces exactly 53 cells" test, so it is a verified reference, not a guess).
  - The origin hex (top label `440.0`, bottom `0`) has a thick black stroke.
  - Octave-equivalent hexes (same pitch class) share a hue; duplicate pitches are visibly repeated across the band.
  - Two-line labels: frequency (1 decimal) over pitch class (0..N-1).

- [ ] **Step 4: Verify controls drive a live recompute.**
  - Drag the **N** slider 2→24: the band morphs each step; `#nNumber` stays in sync.
  - At **N ∈ {2, 4, 6, 10, 14, 15, 20, 21, 24}** (non-coprime / degenerate): layout collapses to a single horizontal row; verify it still spans all N distinct pitch classes (every hue 0..N-1 appears once).
  - At other N: a multi-row isomorphic band.
  - As N increases, the per-hex label font visibly shrinks (count-scaled font).
  - Click preset **220**: all frequencies halve; origin shows `220.0`. Click **440**: back to `440.0`.

- [ ] **Step 5: Verify audio.**
  - Click/press a hex: a tone sounds; releasing with pointerup stops it cleanly with no click. The origin hex sounds the base frequency.
  - Drag from one hex onto another **without releasing**: the first hex's voice stops when the pointer leaves its polygon (per-hex drag-off release via `pointermove` hit-test).
  - Hold several hexes (polyphony): all sound simultaneously.
  - Change **Waveform** while holding a note: timbre changes live. Drag **Volume**: loudness changes with no zipper noise.
  - Two hexes sharing the same pitch (duplicates) each release independently with no stuck note.
  - A very fast tap (press+release in one frame) releases cleanly with no click and no stuck voice (release ramp is clamped above zero).
  - Open the browser console: no `AudioContext was not allowed to start` warning after the first press, and no errors.

- [ ] **Step 6: Stop the server.**
Stop the background `python3 -m http.server` process.

- [ ] **Step 7: Final commit (README note if any smoke-test adjustment was made; otherwise tag completion).**
```bash
git -C /Users/aworland/projects/microtonal-keyboard add -A && git -C /Users/aworland/projects/microtonal-keyboard commit --allow-empty -m "test: manual browser smoke test passed (render, controls, polyphonic audio)"
```
