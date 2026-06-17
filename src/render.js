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
