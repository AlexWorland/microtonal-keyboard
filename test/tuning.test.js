// test/tuning.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { bestFifth, fourth, tone, gcd, pitchFor, pitchClass } from "../src/tuning.js";

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
