// src/pianoRender.js
// DOM module. Renders a pianoKeys() layout as SVG <rect> keys: white keys first,
// raised black keys on top, each with a frequency + pitch-class label and a
// data-freq attribute the audio layer reads. Origin (base) and octave tonics
// (pitch class 0) get highlight classes.

const SVG_NS = "http://www.w3.org/2000/svg";

const PAD = 6;            // viewBox padding (layout units)
const WHITE_TEXT = "#222";
const BLACK_TEXT = "#f0f0f0";

function el(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  return node;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function keyClasses(k) {
  const cls = ["pkey", k.isWhite ? "pkey--white" : "pkey--black"];
  if (k.isOrigin) cls.push("pkey--origin");
  else if (k.pitchClass === 0) cls.push("pkey--tonic"); // octave repeat of the base
  return cls.join(" ");
}

function makeKey(k) {
  return el("rect", {
    x: k.x, y: k.y, width: k.w, height: k.h,
    rx: 1.5, ry: 1.5,
    "data-freq": String(k.pitch),    // full precision for audio
    "data-step": String(k.step),
    "data-pc": String(k.pitchClass),
    class: keyClasses(k),
  });
}

// Font size that fits a `freq.toFixed(1)` string inside a key `keyW` wide.
// Monospace chars are ~0.6em, so width ~= len*0.6*font; solve for font and clamp.
function fitFont(freq, keyW) {
  const len = Math.max(freq.toFixed(1).length, 3);
  return clamp((keyW * 1.55) / len, 2.0, 7.5);
}

// Two-line label (frequency over pitch class) anchored at (cx, topY), growing down.
function makeLabel(cx, topY, freq, pc, fontSize, color) {
  const text = el("text", {
    x: cx, y: topY,
    "text-anchor": "middle",
    "font-size": fontSize,
    fill: color,
    "pointer-events": "none",
    class: "pkey-label",
  });
  const f = el("tspan", { x: cx, dy: "0" });
  f.textContent = freq.toFixed(1);
  const p = el("tspan", { x: cx, dy: "1.15em" });
  p.textContent = String(pc);
  text.appendChild(f);
  text.appendChild(p);
  return text;
}

export function createPianoRenderer(svgEl) {
  function clear() {
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
  }

  function render(layout, N) {
    clear();
    const { whiteKeys, blackKeys, width, height } = layout;

    svgEl.setAttribute("viewBox", `${-PAD} ${-PAD} ${width + PAD * 2} ${height + PAD * 2}`);
    svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");

    const whiteLayer = el("g", { class: "pkey-layer pkey-layer--white" });
    const blackLayer = el("g", { class: "pkey-layer pkey-layer--black" });

    // White keys + labels in the lower (un-occluded) portion of the key.
    for (const k of whiteKeys) {
      whiteLayer.appendChild(makeKey(k));
      const cx = k.x + k.w / 2;
      whiteLayer.appendChild(makeLabel(cx, k.h * 0.72, k.pitch, k.pitchClass, fitFont(k.pitch, k.w), WHITE_TEXT));
    }

    // Black keys on top + labels sized to fit the narrow key, near its top half.
    for (const k of blackKeys) {
      blackLayer.appendChild(makeKey(k));
      const cx = k.x + k.w / 2;
      blackLayer.appendChild(makeLabel(cx, k.h * 0.42, k.pitch, k.pitchClass, fitFont(k.pitch, k.w), BLACK_TEXT));
    }

    svgEl.appendChild(whiteLayer);
    svgEl.appendChild(blackLayer);
  }

  return { clear, render };
}
