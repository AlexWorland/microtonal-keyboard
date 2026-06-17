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
