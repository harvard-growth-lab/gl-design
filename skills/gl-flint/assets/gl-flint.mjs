// =============================================================================
// gl-flint — the Growth Lab style kernel for Microsoft Flint (flint-chart).
// =============================================================================
//
// Flint (https://github.com/microsoft/flint-chart) is a visualization
// intermediate language: an agent writes a compact, semantic `ChartAssemblyInput`
// and Flint's compiler derives the low-level chart (scales, zero baselines,
// number formats, sort order) and emits a NATIVE Vega-Lite spec.
//
// Flint decides *what kind* of color scale to use (categorical / sequential /
// diverging) but leaves the concrete palette + chrome to a backend layer. This
// module is that layer for GL: a WRAP around `assembleVegaLite` that
//   1. deep-merges the GL Vega-Lite config (Inter/Source Serif, 12px floor,
//      paper, warm ink, GL gridlines, 4px ticks + 1px axis line, stroke widths) — §1
//   2. rewrites the color scale to the GL palette                          — §1
//   3. applies GL emphasis semantics (mute-then-highlight, dark labels)    — §2
//   4. renders to a GL-serialized standalone SVG                           — §3
//
// This is a DOWNSTREAM COPY of grammar.md. If a hex/size here ever disagrees
// with grammar.md, grammar.md wins and this file is the bug. Change the token in
// grammar.md first, then here (and in every other downstream encoding).
//
// Peer deps (install in your project, like Observable Plot):
//   npm install flint-chart vega vega-lite
// =============================================================================

// -----------------------------------------------------------------------------
// GL tokens — downstream copy of grammar.md §1
// -----------------------------------------------------------------------------
export const GL = {
  // Ink — warm four-layer ramp
  ink: "#1A1714", ink_2: "#2C2823", ink_3: "#4F4A42", ink_4: "#9A9389",
  // Accent (non-data chrome) — c_1_dark shares this hex
  accent: "#1A5A8E",
  // Paper & chrome
  paper: "#FFFFFF", paper_warm: "#F4F1EA", rule: "#DDDDDD", gridline: "#D8D4CC",
  // Categorical — six hues, three tones each (light / main / dark)
  c_1: "#2F87C8", c_2: "#CC4948", c_3: "#2AA584", c_4: "#7554A3", c_5: "#EA822D", c_6: "#CDC86B",
  c_1_dark: "#1A5A8E", c_2_dark: "#8A2C2B", c_3_dark: "#1A6B53", c_4_dark: "#4A3470", c_5_dark: "#A8580F", c_6_dark: "#8A8638",
  c_1_light: "#B5D5EA", c_2_light: "#E89C9C", c_3_light: "#92D6BF", c_4_light: "#B5A0CC", c_5_light: "#F4BC8A", c_6_light: "#E6E2A8",
  // Muted — the "everyone-else" grey
  c_muted: "#AFB5BE", c_muted_dark: "#5F6773", c_muted_light: "#CDD2D9",
};

// -----------------------------------------------------------------------------
// Palettes — downstream copy of grammar.md §1
// -----------------------------------------------------------------------------
export const glPalettes = {
  categorical:       [GL.c_1, GL.c_2, GL.c_3, GL.c_4, GL.c_5, GL.c_6],
  categorical_dark:  [GL.c_1_dark, GL.c_2_dark, GL.c_3_dark, GL.c_4_dark, GL.c_5_dark, GL.c_6_dark],
  categorical_light: [GL.c_1_light, GL.c_2_light, GL.c_3_light, GL.c_4_light, GL.c_5_light, GL.c_6_light],
  sequential_1: ["#E5F0F9", "#B5D5EA", "#6FA5CE", "#2F87C8", "#1A5A8E"],
  sequential_2: ["#F4D5D5", "#E89C9C", "#DC6F6E", "#CC4948", "#8A2C2B"],
  sequential_3: ["#D5EFE7", "#92D6BF", "#5BC0A0", "#2AA584", "#1A6B53"],
  sequential_4: ["#E5DDF0", "#B5A0CC", "#9276BA", "#7554A3", "#4A3470"],
  sequential_5: ["#FBE5D5", "#F4BC8A", "#EE9A52", "#EA822D", "#A8580F"],
  sequential_6: ["#FBF8DC", "#E6E2A8", "#DCD68E", "#CDC86B", "#8A8638"],
  diverging_2_1: ["#8A2C2B", "#DC6F6E", "#EFC7C0", "#C5DCEC", "#6FA5CE", "#1A5A8E"], // red↔blue (default)
  diverging_3_1: ["#1A6B53", "#5BC0A0", "#BDE5D8", "#C5DCEC", "#6FA5CE", "#1A5A8E"], // teal↔blue
  diverging_5_1: ["#A8580F", "#EE9A52", "#F4BC8A", "#C5DCEC", "#6FA5CE", "#1A5A8E"], // orange↔blue
  diverging_6_1: ["#8A8638", "#DCD68E", "#E6E2A8", "#C5DCEC", "#6FA5CE", "#1A5A8E"], // yellow↔blue
};

export const highlight = GL.c_1;           // institutional blue — the default focus
export const highlight_dark = GL.c_1_dark; // strokes + labels tied to the focus
export const lead_finding = GL.c_2;        // red — negative/alarming findings only (valence, not emphasis)
export const lead_finding_dark = GL.c_2_dark;

const MAIN = [GL.c_1, GL.c_2, GL.c_3, GL.c_4, GL.c_5, GL.c_6];
const DARK = [GL.c_1_dark, GL.c_2_dark, GL.c_3_dark, GL.c_4_dark, GL.c_5_dark, GL.c_6_dark];

/** Map any main / light / muted tone to its dark partner (for strokes + labels). */
export function glDark(hex) {
  const h = String(hex).toUpperCase();
  const i = MAIN.indexOf(h);
  if (i >= 0) return DARK[i];
  const li = glPalettes.categorical_light.indexOf(h);
  if (li >= 0) return DARK[li];
  if (h === GL.c_muted.toUpperCase()) return GL.c_muted_dark;
  return hex;
}

// -----------------------------------------------------------------------------
// §1. The GL Vega-Lite config — chrome Flint leaves to the backend
// -----------------------------------------------------------------------------
// Flint emits e.g. `config.axisX.labelFontSize: 10` — BELOW the GL 12px floor.
// This config is deep-merged OVER Flint's, so every GL value wins per key while
// Flint's own view sizing (continuousWidth/Height, facet.spacing) is preserved.
// Canonical font stacks — the family name FOLLOWED BY generic fallbacks, so an
// environment missing the Inter/Source Serif face degrades to a SANS/SERIF
// system face, never to a mismatched default (Vega emits a bare family verbatim
// into every <text>, so a lone "Inter" falls to Times when Inter is absent).
// This exact stack is the canonical token in grammar.md §2 — keep it verbatim.
export const SANS = "Inter, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
export const SERIF = "'Source Serif 4', Georgia, 'Times New Roman', serif";

export const glVegaConfig = {
  background: GL.paper,
  font: SANS,
  view: { stroke: null }, // no panel border (Flint's continuousWidth/Height survive the merge)
  axis: {
    labelFont: SANS, labelFontSize: 12, labelFontWeight: 400, labelColor: GL.ink_2,
    titleFont: SANS, titleFontSize: 12, titleFontWeight: 500, titleColor: GL.ink_2,
    // 4px OUTWARD ink_2 ticks + a 1px ink_2 domain line (grammar §3.5), matching
    // the ggplot twin. labelPadding 2 puts the tick label ~6px off the axis
    // (4px tick + 2px gap). Set tickSize:0 / domain:false per chart to suppress.
    tickSize: 4, tickWidth: 1, tickColor: GL.ink_2, domain: true, domainColor: GL.ink_2, domainWidth: 1,
    gridColor: GL.gridline, gridWidth: 1, labelPadding: 2, labelLimit: 0, // 0 = never truncate a tick label
  },
  axisX: { grid: false, labelFontSize: 12 },       // grid set orientation-aware in applyGlTheme (value axis only)
  axisY: { grid: true, gridColor: GL.gridline, gridWidth: 1, labelFontSize: 12 },
  legend: {
    labelFont: SANS, labelFontSize: 12, labelColor: GL.ink_2, labelFontWeight: 600, // series labels are 600 (grammar §2)
    titleFont: SANS, titleFontSize: 12, titleColor: GL.ink_3, titleFontWeight: 500,
    symbolStrokeWidth: 0, symbolType: "square", symbolSize: 90,
  },
  title: {
    font: SERIF, fontSize: 14, fontWeight: 500, color: GL.ink, anchor: "start", // grammar.md §2: title = Source Serif 4 / 14px / 500
    subtitleFont: SANS, subtitleFontSize: 12, subtitleColor: GL.ink_3, subtitlePadding: 6,
  },
  // Per-mark DEFAULT color = institutional blue: a single-series chart (no color
  // encoding) IS the focus, so it reads in c_1 (grammar §3). When a color scale
  // is present (multi-series / focus) the scale range wins over these defaults.
  bar: { fill: GL.c_1, stroke: GL.paper, strokeWidth: 1 }, // 1px paper stroke = the stacked-segment gap (grammar §6; invisible on a single bar)
  line: { stroke: GL.c_1, strokeWidth: 2, strokeJoin: "round", strokeCap: "round" },
  area: { fill: GL.c_1, line: false },
  arc: { fill: GL.c_1, stroke: GL.paper, strokeWidth: 1 },
  point: { size: 80, fill: GL.c_1, stroke: GL.c_1_dark, fillOpacity: 0.8, strokeOpacity: 0.8, strokeWidth: 1 }, // size 80 ≈ r 5px (grammar §5)
  rule: { color: GL.ink_2 },
  text: { font: SANS, fontSize: 12, fill: GL.ink_2 },
  range: { category: glPalettes.categorical }, // default categorical range for any un-rewritten color scale
};

// -----------------------------------------------------------------------------
// small deep-merge — `src` (GL) wins per leaf key; objects merge, arrays replace
// -----------------------------------------------------------------------------
function isObj(v) { return v && typeof v === "object" && !Array.isArray(v); }
function deepMerge(base, src) {
  const out = { ...(base || {}) };
  for (const k of Object.keys(src || {})) {
    out[k] = isObj(src[k]) && isObj(out[k]) ? deepMerge(out[k], src[k]) : src[k];
  }
  return out;
}

/** Split Flint's emitted object into the pure VL spec and the `_`-prefixed metadata. */
export function stripFlintMeta(raw) {
  const spec = {}, meta = {};
  for (const k of Object.keys(raw)) (k.startsWith("_") ? meta : spec)[k] = raw[k];
  return { spec, meta };
}

/** Distinct values of a field, in first-seen order, from the spec's inline data. */
export function distinctValues(spec, field) {
  const rows = spec?.data?.values || [];
  const seen = [];
  const set = new Set();
  for (const r of rows) { const v = r?.[field]; if (!set.has(v)) { set.add(v); seen.push(v); } }
  return seen;
}

// -----------------------------------------------------------------------------
// spec helpers
// -----------------------------------------------------------------------------
/** The mark type as a string ('line'|'bar'|'point'|'circle'|'area'|…). */
export function markType(spec) {
  return typeof spec.mark === "string" ? spec.mark : (spec.mark && spec.mark.type);
}
/** True when the field is predominantly (>=90%) numeric — tolerant of a stray
 *  bad value so one malformed row can't force a scatter axis to ordinal. */
export function isNumericField(spec, field) {
  const rows = spec?.data?.values || [];
  let n = 0, num = 0;
  for (const r of rows) { const v = r?.[field]; if (v == null) continue; n++; if (typeof v === "number") num++; }
  return n > 0 && num / n >= 0.9;
}
// Field-name → human label: acronyms upper-cased, snake/camel split, title-cased.
const ACRONYMS = { eci: "ECI", coi: "COI", rca: "RCA", gdp: "GDP", gni: "GNI", hs: "HS", sitc: "SITC", pdo: "PDO", usd: "USD", id: "ID", cif: "CIF", fob: "FOB" };
export function humanLabel(field) {
  if (field == null) return field;
  const words = String(field).replace(/([a-z])([A-Z])/g, "$1 $2").split(/[_\s]+/).filter(Boolean);
  return words.map((w) => ACRONYMS[w.toLowerCase()] || (w[0].toUpperCase() + w.slice(1))).join(" ");
}
/** Numeric [min,max] of a field from the data (or null). */
function fieldExtent(spec, field) {
  const rows = spec?.data?.values || [];
  let lo = Infinity, hi = -Infinity;
  for (const r of rows) { const v = r?.[field]; if (typeof v === "number") { if (v < lo) lo = v; if (v > hi) hi = v; } }
  return lo <= hi ? [lo, hi] : null;
}
/** The positional channel ('x'|'y') that carries the quantitative measure, if any. */
export function valueAxis(spec) {
  const e = spec.encoding || {};
  for (const ax of ["x", "y"]) if (e[ax] && e[ax].type === "quantitative") return ax;
  return null;
}

// -----------------------------------------------------------------------------
// §1 (cont). applyGlTheme — merge chrome + palette + orientation + clean labels
// -----------------------------------------------------------------------------
export function applyGlTheme(spec) {
  spec.config = deepMerge(spec.config || {}, glVegaConfig);
  const enc = spec.encoding || {};

  // --- Scatter axis-type guard (blocker fix): Flint sometimes compiles a numeric
  // scatter field to ordinal, collapsing a bivariate scatter into a 1-D strip and
  // capping the domain. Force x/y to quantitative when the bound field is numeric,
  // and clear any ordinal domain / bin cap Flint left behind.
  const mt = markType(spec);
  if (mt === "point" || mt === "circle") {
    for (const ax of ["x", "y"]) {
      const ch = enc[ax];
      if (ch && ch.field && isNumericField(spec, ch.field) && ch.type !== "quantitative") {
        ch.type = "quantitative";
        // Clear the ordinal apparatus Flint left behind: a baked category domain,
        // band padding, category sort, and the per-category labelColor conditional
        // (which paints an off-token #000000/#999999 tick wall).
        if (ch.scale) { delete ch.scale.domain; delete ch.scale.paddingInner; delete ch.scale.paddingOuter; }
        if (ch.axis) { delete ch.axis.labelColor; delete ch.axis.labelAngle; }
        delete ch.sort; delete ch.bin;
      }
    }
    // Overlapping points darken via the fillOpacity/strokeOpacity pair (grammar
    // §3.4), NOT a flat whole-mark opacity that also dims the stroke. Strip any
    // opacity Flint set on the mark or the encoding so the config.point default wins.
    if (spec.mark && typeof spec.mark === "object") delete spec.mark.opacity;
    if (enc.opacity && enc.opacity.value != null && !enc.opacity.field) delete enc.opacity;
  }

  // --- Ranked bars descending (grammar §9): a category axis on a bar chart must
  // run descending by magnitude (largest at top). Flint leaves nominal axes
  // unsorted (sort:null) or name-sorted, silently inverting a ranked chart — so
  // sort the category axis by the value field unless the axis is naturally
  // ordered (temporal) or a sort was already set to a field/encoding.
  if (mt === "bar") {
    const catAx = enc.x && enc.x.type && enc.x.type !== "quantitative" && enc.x.type !== "temporal" ? "x"
      : enc.y && enc.y.type && enc.y.type !== "quantitative" && enc.y.type !== "temporal" ? "y" : null;
    const valAx = valueAxis(spec);
    if (catAx && valAx && catAx !== valAx) {
      const cur = enc[catAx].sort;
      if (cur == null || cur === "ascending" || cur === "descending") {
        enc[catAx].sort = { field: enc[valAx].field, op: "sum", order: "descending" };
      }
    }
  }

  // --- Orientation-aware gridlines (grammar §3.5): horizontal (Y) gridlines by
  // default (lines, scatters, vertical bars). Only a HORIZONTAL bar — categorical
  // Y, measure on X — flips to vertical (X) gridlines so bar lengths are estimable.
  const horizontalBar = mt === "bar" && enc.x && enc.x.type === "quantitative" && enc.y && enc.y.type !== "quantitative";
  if (horizontalBar) { spec.config.axisX = { ...spec.config.axisX, grid: true, gridColor: GL.gridline, gridWidth: 1 }; spec.config.axisY = { ...spec.config.axisY, grid: false }; }
  else { spec.config.axisY = { ...spec.config.axisY, grid: true, gridColor: GL.gridline, gridWidth: 1 }; spec.config.axisX = { ...spec.config.axisX, grid: false }; }

  // --- Clean human labels: never echo a raw column name as an axis / legend
  // title. Apply humanLabel() to any title that is still the bare field name.
  for (const ax of ["x", "y"]) {
    const ch = enc[ax]; if (!ch || !ch.field) continue;
    ch.axis = ch.axis || {};
    if (ch.field === "year") { ch.axis.title = null; continue; } // year axis omits its label (grammar §9)
    if (ch.type === "quantitative") {
      // Measure axis: replace a null OR raw-field-name title with a clean human label.
      if (ch.axis.title == null || ch.axis.title === ch.field) ch.axis.title = humanLabel(ch.field);
    } else if (ch.axis.title == null || ch.axis.title === ch.field) {
      ch.axis.title = null; // category axis labels itself — no redundant field-name title
    }
  }
  const col0 = enc.color;
  if (col0 && col0.field) {
    col0.legend = col0.legend || {};
    if (col0.legend !== null && (col0.legend.title == null || col0.legend.title === col0.field)) col0.legend.title = humanLabel(col0.field);
  }

  // --- Palette: rewrite the color scale to the GL ramp.
  const col = enc.color;
  if (col && col.scale) {
    const scheme = String(col.scale.scheme || "");
    const isDiverging = col.scale.domainMid != null || /red.?blue|rdbu|diverg|spectral/i.test(scheme);
    const isContinuous = col.type === "quantitative" || col.type === "temporal";
    delete col.scale.scheme;
    if (isDiverging) col.scale.range = glPalettes.diverging_2_1;
    else if (isContinuous) col.scale.range = glPalettes.sequential_1;
    else col.scale.range = glPalettes.categorical;
    // For a continuous scale, interpolate the ramp in RGB so intermediate hues
    // stay on the GL ramp (Vega's default color-space interpolation drifts off
    // the token ramp and trips the render lint).
    if (isDiverging || isContinuous) col.scale.interpolate = "rgb";
  }
  return spec;
}

// -----------------------------------------------------------------------------
// Zero baseline (grammar §7): a solid ink_2 rule at 0 whenever a positional
// quantitative axis spans zero (mandatory on sign / diverging bars). Wraps the
// mark in a layer and adds the rule; safe on an already-layered spec.
// -----------------------------------------------------------------------------
export function addZeroBaseline(spec) {
  const vax = valueAxis(spec);
  if (!vax) return spec;
  const ext = fieldExtent(spec, spec.encoding[vax].field);
  if (!ext || ext[0] >= 0 || ext[1] <= 0) return spec; // 0 not strictly inside the range
  const rule = { mark: { type: "rule", color: GL.ink_2, strokeWidth: 1 }, encoding: { [vax]: { datum: 0 } } };
  if (Array.isArray(spec.layer)) { spec.layer.push(rule); return spec; }
  const base = { mark: spec.mark, encoding: spec.encoding };
  delete spec.mark; delete spec.encoding;
  spec.layer = [base, rule];
  return spec;
}

// -----------------------------------------------------------------------------
// §2. GL emphasis semantics — mute-then-highlight + dark-tone labels
// -----------------------------------------------------------------------------
// Flint colors every category equally. GL's signature move is the opposite:
// everything-but-the-message goes c_muted; the focus opts INTO color. `focus`
// names the category value(s) that carry the finding; `valence:'negative'`
// paints them in lead-finding red instead of institutional blue.
export function applyFocus(spec, { focus, valence, labelField } = {}) {
  const focusArr = Array.isArray(focus) ? focus : (focus == null ? [] : [focus]);
  const focusMain = valence === "negative" ? GL.c_2 : GL.c_1;
  const focusDark = valence === "negative" ? GL.c_2_dark : GL.c_1_dark;
  const isFocus = (v) => focusArr.some((f) => String(f) === String(v));
  const mt = markType(spec);
  const col = spec.encoding && spec.encoding.color;
  const field = col && col.field;
  const dom = field ? distinctValues(spec, field) : [];

  // No color field, OR the requested focus matches no data value → this is a
  // single series and it IS the focus: paint it institutional blue, mute nothing.
  if (!field || !dom.some(isFocus)) {
    if (field) { col.scale = { domain: dom, range: dom.map(() => focusMain) }; col.legend = null; }
    else { if (typeof spec.mark === "string") spec.mark = { type: spec.mark }; spec.mark = { ...spec.mark, color: focusMain }; }
    return spec;
  }

  // A resolved focus exists → mute-then-highlight, dispatched by mark type.
  if (mt === "line") return applyLineFocus(spec, { field, focusArr, isFocus, focusMain, focusDark, labelField });
  if (mt === "point" || mt === "circle") return applyPointFocus(spec, { field, isFocus, focusMain, focusDark, labelField });
  // Bars/default: remap the color scale (focus hue vs muted grey). No 2.4px lift
  // (a bar's strokeWidth is its border) and no colour legend — the category axis
  // already names the bars, so a 2-bucket legend is noise (grammar §3).
  col.scale = { domain: dom, range: dom.map((v) => (isFocus(v) ? focusMain : GL.c_muted)) };
  col.legend = null;
  return spec;
}

// Line focus: a CONTINUOUS muted backdrop with the focus overpainted on top,
// sharing the boundary vertex so the series never visually severs (grammar §3.1).
// A single direct end-label replaces the noisy 2-bucket colour legend.
function applyLineFocus(spec, { field, focusArr, isFocus, focusMain, focusDark, labelField }) {
  const xf = spec.encoding.x && spec.encoding.x.field;
  const rows = (spec.data && spec.data.values) || [];
  const sorted = [...rows].sort((a, b) => (a[xf] > b[xf] ? 1 : a[xf] < b[xf] ? -1 : 0));
  const firstIdx = sorted.findIndex((r) => isFocus(r[field]));
  const focusRows = sorted.filter((r, i) => isFocus(r[field]) || (firstIdx > 0 && i === firstIdx - 1)); // + bridge vertex
  const lastFocus = [...focusRows].reverse().find((r) => isFocus(r[field]));
  const baseEnc = { x: spec.encoding.x, y: spec.encoding.y };
  const lineMark = (stroke, w) => ({ type: "line", stroke, strokeWidth: w, strokeJoin: "round", strokeCap: "round" });
  const layers = [
    { mark: lineMark(GL.c_muted, 2), encoding: baseEnc },                        // continuous muted backdrop (all rows)
    { data: { values: focusRows }, mark: lineMark(focusMain, 2.4), encoding: baseEnc }, // focus, sharing the boundary vertex
  ];
  if (lastFocus) {
    const text = labelField && lastFocus[labelField] != null ? String(lastFocus[labelField]) : focusArr.map(String).join(", ");
    layers.push({ data: { values: [lastFocus] }, mark: { type: "text", align: "left", dx: 6, dy: -6, fontWeight: 600, fill: focusDark },
      encoding: { x: baseEnc.x, y: baseEnc.y, text: { value: text } } });
  }
  delete spec.mark; delete spec.encoding;
  spec.layer = layers;
  return spec;
}

// Scatter focus: the muted cloud recedes; the focus dot is painted ONCE, larger,
// at full opacity with a dark stroke, plus a direct dark-tone label (grammar §3.4).
function applyPointFocus(spec, { field, isFocus, focusMain, focusDark, labelField }) {
  const rows = (spec.data && spec.data.values) || [];
  const baseEnc = { x: spec.encoding.x, y: spec.encoding.y };
  const nonFocus = rows.filter((r) => !isFocus(r[field]));
  const focusRows = rows.filter((r) => isFocus(r[field]));
  const layers = [
    { data: { values: nonFocus }, mark: { type: "point", filled: true, size: 80, fill: GL.c_muted, stroke: GL.c_muted_dark, fillOpacity: 0.8, strokeOpacity: 0.8, strokeWidth: 1 }, encoding: baseEnc },
    { data: { values: focusRows }, mark: { type: "point", filled: true, size: 120, fill: focusMain, stroke: focusDark, fillOpacity: 1, strokeOpacity: 1, strokeWidth: 1.5 }, encoding: baseEnc },
  ];
  if (labelField) layers.push({ data: { values: focusRows }, mark: { type: "text", align: "left", dx: 9, dy: 0, fontWeight: 600, fill: focusDark },
    encoding: { x: baseEnc.x, y: baseEnc.y, text: { field: labelField } } });
  delete spec.mark; delete spec.encoding;
  spec.layer = layers;
  return spec;
}

/**
 * Color-count guard (grammar §3): color conveys meaning, not sequence. Returns
 * a warning object when a categorical color field has 5+ distinct values so the
 * caller can reconsider mute-then-highlight / grouping / tones-of-one-hue before
 * spending a fifth color. Six is the hard ceiling.
 */
const MEASURE_SEMANTIC = new Set([
  "Quantity", "Price", "Money", "Percentage", "Correlation", "Temperature",
  "Rate", "Ratio", "Count", "Duration", "Distance", "Age", "Rank", "Score",
]);
export function glColorCountCheck(input) {
  const enc = input?.chart_spec?.encodings || {};
  const colorField = enc.color?.field || enc.group?.field;
  if (!colorField) return null;
  // The guard is for CATEGORICAL color. A continuous field (a measure semantic
  // type, or an all-numeric column) legitimately maps to a sequential/diverging
  // ramp with many distinct values — not a color-count violation.
  const sem = input?.semantic_types?.[colorField];
  if (sem && MEASURE_SEMANTIC.has(sem)) return null;
  const rows = input?.data?.values || [];
  const vals = rows.map((r) => r?.[colorField]);
  if (vals.length && vals.every((v) => v == null || typeof v === "number")) return null;
  const n = new Set(vals).size;
  if (n >= 5) return {
    field: colorField, count: n,
    level: n > 6 ? "error" : "warn",
    message: `Color field "${colorField}" has ${n} distinct values. Color should convey meaning, not sequence. ` +
      `Prefer mute-then-highlight (paint the 1–2 message series, mute the rest with a \`focus\`), group categories, ` +
      `or use tones of one hue. Six colors is the hard ceiling.`,
  };
  return null;
}

// -----------------------------------------------------------------------------
// The main entry point: Flint assemble → GL theme → GL emphasis
// -----------------------------------------------------------------------------
export async function glAssembleVegaLite(input, glOpts = {}) {
  const { assembleVegaLite } = await import("flint-chart");
  const raw = assembleVegaLite(input);
  const { spec, meta } = stripFlintMeta(raw);
  const mt0 = markType(spec); // capture before focus may restructure into layers
  applyGlTheme(spec);
  if (glOpts.focus != null || glOpts.singleFocus) applyFocus(spec, glOpts);
  // Zero baseline (grammar §7) for value bars/areas whose measure axis spans 0
  // (mandatory on sign/diverging bars). Runs after focus so it layers correctly.
  if (mt0 === "bar" || mt0 === "area") addZeroBaseline(spec);
  const warning = glColorCountCheck(input);
  return { spec, meta, warning };
}

// -----------------------------------------------------------------------------
// §3. Render — compile VL → Vega → GL-serialized standalone SVG
// -----------------------------------------------------------------------------
// Vega's SVG carries no root paper background and no tabular-figures hint, and
// rasterizers reject a namespace-less root. glSerializeSvg injects the GL root
// style required by the canonical spec — Inter + tabular-nums numerals
// (docs/nil data-vis rules; grammar.md §2), the 12px chart-text floor and paper
// background (grammar.md §1, §3) — prepends a painted paper <rect>, and ensures
// the xmlns is present. Fonts are the canonical faces in /assets/fonts.
export function glSerializeSvg(svg) {
  let s = svg.trim();
  const open = (s.match(/<svg\b[^>]*>/i) || [""])[0];
  const wm = open.match(/\bwidth\s*=\s*"([^"]*)"/i);
  const hm = open.match(/\bheight\s*=\s*"([^"]*)"/i);
  const w = wm ? wm[1] : "100%";
  const h = hm ? hm[1] : "100%";
  const glStyle =
    `background-color:${GL.paper};font-family:'Inter',system-ui,sans-serif;` +
    `font-size:12px;font-variant-numeric:tabular-nums;-moz-font-feature-settings:'tnum';` +
    `font-feature-settings:'tnum'`;

  // Merge our style into the root <svg style="…"> (Vega usually sets a style attr).
  let newOpen = open;
  if (/\bstyle\s*=\s*"/i.test(open)) {
    newOpen = open.replace(/\bstyle\s*=\s*"([^"]*)"/i, (_, cur) => `style="${cur};${glStyle}"`);
  } else {
    newOpen = open.replace(/<svg\b/i, `<svg style="${glStyle}"`);
  }
  if (!/xmlns=/.test(newOpen)) newOpen = newOpen.replace(/<svg\b/i, `<svg xmlns="http://www.w3.org/2000/svg"`);
  if (!/xmlns:xlink=/.test(newOpen)) newOpen = newOpen.replace(/<svg\b/i, `<svg xmlns:xlink="http://www.w3.org/1999/xlink"`);

  s = s.replace(open, newOpen);
  // Paint the paper background as an explicit rect so rasterizers honor it.
  const rect = `<rect x="0" y="0" width="${w}" height="${h}" fill="${GL.paper}"/>`;
  s = s.replace(newOpen, newOpen + rect);
  return s;
}

/** Render a GL-themed VL spec to a standalone, GL-serialized SVG string. */
export async function glRenderSVG(spec) {
  const vega = await import("vega");
  const vl = await import("vega-lite");
  const silent = vega.logger(vega.None); // suppress advisory compile/parse warnings
  const compiled = vl.compile(spec, { logger: silent }).spec;
  const view = new vega.View(vega.parse(compiled), { renderer: "none", logger: silent });
  const svg = await view.toSVG();
  return glSerializeSvg(svg);
}
