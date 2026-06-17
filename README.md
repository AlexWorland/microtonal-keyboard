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
