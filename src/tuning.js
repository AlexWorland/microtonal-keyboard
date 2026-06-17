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
