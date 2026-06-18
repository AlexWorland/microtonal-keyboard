# Microtonal Piano Keyboard

[![Test](https://github.com/AlexWorland/microtonal-keyboard/actions/workflows/test.yml/badge.svg)](https://github.com/AlexWorland/microtonal-keyboard/actions/workflows/test.yml)
[![Build](https://github.com/AlexWorland/microtonal-keyboard/actions/workflows/build.yml/badge.svg)](https://github.com/AlexWorland/microtonal-keyboard/actions/workflows/build.yml)

A two-octave **piano keyboard** for N-tone equal temperament (N-TET), N in 2..24.
Pure vanilla JS (ES modules) + SVG + Web Audio. No build step, no runtime
dependencies.

The keyboard lays out every step `0..2N` left-to-right in pitch order. White vs
raised-black keys follow the **fifth-generated diatonic** (a MOS): at N=12 the
white keys are exactly C D E F G A B — a normal piano — and the pattern
generalizes to other N. When 7 distinct fifth-generated naturals don't exist
(small or coprime-poor N), the keyboard falls back to a uniform all-white row so
every note is still present. The base note is highlighted gold; octave repeats
(pitch class 0) are outlined in blue.

> An earlier **isomorphic Wicki-Hayden hex** view also lives in this repo
> (`src/layout.js` + `src/render.js`, with `test/layout.test.js`). It's set aside,
> not wired into `index.html`; the piano view (`src/piano.js` + `src/pianoRender.js`)
> is the active layout.

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

Every step `0..2N` is drawn as a key in pitch order, so no note is ever missing.
White vs raised-black keys come from the fifth-generated diatonic: the white set is
`{ (j * bestFifth(N)) mod N : j = -1..5 }`, which at N=12 is exactly `{0,2,4,5,7,9,11}`
(C D E F G A B). When those 7 naturals are not distinct (small or coprime-poor N) the
keyboard falls back to a uniform all-white row. Black keys are grouped over the white
boundary they fall between and shrink so a crowded gap (high N) never overflows. Each
key label shows frequency (Hz, 1 decimal) over the pitch class (step mod N, 0..N-1).

## Desktop app (Electron)

The app is also packaged as a desktop app. The renderer is the same unbundled web
app; `electron-main.cjs` serves it over a custom `app://` scheme (Chromium blocks ES
module imports over `file://`), so there is still no bundler for the app code.

```bash
npm install          # installs electron + electron-builder (devDependencies only)
npm start            # run the app locally in Electron
npm run dist         # build distributables into dist/
```

`npm run dist` produces (config in the `build` field of `package.json`):

| File | For |
|------|-----|
| `Microtonal Keyboard-<v>-arm64.dmg` | Apple Silicon Macs |
| `Microtonal Keyboard-<v>.dmg`       | Intel (x64) Macs |
| `Microtonal Keyboard-<v>-win.zip`   | Windows x64 (unzip, run the `.exe`) |

The builds are **unsigned**. First launch:

- **macOS** — Gatekeeper will refuse a double-click. Right-click the app → **Open** →
  **Open**, once. (Or `xattr -dr com.apple.quarantine "/Applications/Microtonal Keyboard.app"`.)
- **Windows** — SmartScreen shows a warning: **More info** → **Run anyway**.

The Windows artifact is a portable zip (no installer) because building a signed NSIS
installer needs `wine`/Windows tooling not available on this Mac; build that on a
Windows machine or CI if you need it.

## Host it (Docker)

The web app is static files served over HTTP, so it hosts behind nginx with no
runtime. Run it locally or on any server with Docker:

```bash
docker compose up -d --build
# open http://localhost:8080/   (health: http://localhost:8080/healthz)
docker compose down            # stop
```

- Prebuilt image (published by CI on every push to `main`):

  ```bash
  docker run -p 8080:80 ghcr.io/alexworland/microtonal-keyboard:latest
  ```
- Image: ~76 MB (`nginx:1.27-alpine` + the app). Config in `Dockerfile`,
  `docker/nginx.conf`, `docker-compose.yml`. Change the host port via the `ports`
  mapping (`8080:80`).
- **Deploying to an x86-64 server from an Apple Silicon Mac?** The local build is
  arm64. Build a matching image with buildx:

  ```bash
  docker buildx build --platform linux/amd64 -t microtonal-keyboard:amd64 .
  ```

  Or just `docker compose up -d --build` directly on the server.
- Put it behind a TLS reverse proxy (Caddy, Traefik, nginx, Cloudflare Tunnel) for
  a public deployment — the container speaks plain HTTP on port 80.

## Test

Pure logic modules (`src/tuning.js`, `src/piano.js`, `src/layout.js`) have unit tests
using the built-in Node test runner (Node 20+; developed on Node 26). No runtime
dependencies.

```bash
node --test
# or
npm test
```
