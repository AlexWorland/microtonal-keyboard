// test/piano.test.js
// Unit tests for the pure piano-layout module (DOM-free).
import { test } from "node:test";
import assert from "node:assert/strict";
import { whitePitchClasses, pianoKeys } from "../src/piano.js";

const sorted = (set) => [...set].sort((a, b) => a - b);

test("whitePitchClasses(12) is exactly the piano naturals C D E F G A B", () => {
  const w = whitePitchClasses(12);
  assert.deepEqual(sorted(w), [0, 2, 4, 5, 7, 9, 11]);
});

test("whitePitchClasses returns a 7-note set for clean diatonic N (17, 19)", () => {
  assert.equal(whitePitchClasses(17).size, 7);
  assert.equal(whitePitchClasses(19).size, 7);
});

test("whitePitchClasses returns null (uniform) when 7 fifth-degrees are not distinct", () => {
  // N<7 and gcd-poor N cannot host 7 distinct fifth-generated naturals.
  for (const N of [2, 3, 4, 5, 6, 10, 15, 20]) {
    assert.equal(whitePitchClasses(N), null, `N=${N} should be uniform`);
  }
});

test("0 is always a white pitch class when a diatonic set exists", () => {
  for (const N of [7, 8, 9, 11, 12, 13, 16, 17, 18, 19, 22, 23, 24]) {
    const w = whitePitchClasses(N);
    assert.ok(w && w.has(0), `N=${N} naturals must include 0`);
  }
});

test("pianoKeys spans steps 0..2N inclusive in pitch order", () => {
  const { keys } = pianoKeys(440, 12);
  assert.equal(keys.length, 2 * 12 + 1);
  keys.forEach((k, i) => assert.equal(k.step, i));
  // strictly ascending pitch
  for (let i = 1; i < keys.length; i++) assert.ok(keys[i].pitch > keys[i - 1].pitch);
});

test("origin is step 0 at the base frequency; octave is step N at 2x base", () => {
  const { keys } = pianoKeys(440, 12);
  assert.equal(keys[0].step, 0);
  assert.equal(keys[0].isOrigin, true);
  assert.ok(Math.abs(keys[0].pitch - 440) < 1e-9);
  assert.ok(Math.abs(keys[12].pitch - 880) < 1e-9);
  assert.equal(keys[12].pitchClass, 0);
  assert.equal(keys[24].pitchClass, 0); // top key closes the second octave
});

test("N=12 two octaves: 15 white + 10 black keys", () => {
  const { whiteKeys, blackKeys, uniform } = pianoKeys(440, 12);
  assert.equal(uniform, false);
  assert.equal(whiteKeys.length, 15);
  assert.equal(blackKeys.length, 10);
});

test("white keys carry the white pitch classes; blacks carry the rest", () => {
  const { whiteKeys, blackKeys } = pianoKeys(440, 12);
  const w = whitePitchClasses(12);
  for (const k of whiteKeys) assert.ok(w.has(k.pitchClass));
  for (const k of blackKeys) assert.ok(!w.has(k.pitchClass));
});

test("white keys are contiguous equal-width rects in ascending x", () => {
  const { whiteKeys } = pianoKeys(440, 12, { whiteW: 24, stageH: 100 });
  for (let i = 0; i < whiteKeys.length; i++) {
    assert.equal(whiteKeys[i].x, i * 24);
    assert.equal(whiteKeys[i].w, 24);
    assert.equal(whiteKeys[i].h, 100);
    assert.equal(whiteKeys[i].y, 0);
  }
});

test("black keys are raised (shorter) and straddle a white boundary at N=12", () => {
  const { blackKeys } = pianoKeys(440, 12, { whiteW: 24, stageH: 100 });
  for (const b of blackKeys) {
    assert.ok(b.h < 100, "black key shorter than white");
    assert.ok(b.w < 24, "black key narrower than white");
    assert.equal(b.y, 0, "black key drawn from the top");
    // every N=12 gap has exactly one black -> its center sits on a white boundary
    const center = b.x + b.w / 2;
    const boundary = Math.round(center / 24) * 24;
    assert.ok(Math.abs(center - boundary) < 1e-6, "black centered on a white boundary");
  }
});

test("uniform N renders every key white with no black keys", () => {
  const { keys, whiteKeys, blackKeys, uniform } = pianoKeys(440, 5);
  assert.equal(uniform, true);
  assert.equal(blackKeys.length, 0);
  assert.equal(whiteKeys.length, keys.length);
  assert.ok(keys.every((k) => k.isWhite));
});

test("black keys never overflow into a neighbouring white gap (no overlap)", () => {
  // For every N, each black group must fit within +/- half a white width of its boundary.
  for (let N = 7; N <= 24; N++) {
    const { blackKeys } = pianoKeys(440, N, { whiteW: 24, stageH: 100 });
    for (const b of blackKeys) {
      const center = b.x + b.w / 2;
      const nearestBoundary = Math.round(center / 24) * 24;
      assert.ok(
        Math.abs(center - nearestBoundary) <= 12 + 1e-6,
        `N=${N}: black center ${center} strays past half a white from boundary ${nearestBoundary}`
      );
    }
  }
});
