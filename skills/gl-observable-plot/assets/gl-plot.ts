// gl-plot.ts — Growth Lab design system for Observable Plot
//
// Usage (Observable notebook, Vite/ESM app, or Node SSR):
//   import * as Plot from "@observablehq/plot";
//   import { glPlot, glLine, GL } from "./gl-plot.ts";
//
//   glPlot({
//     marks: [
//       glLine(data, { x: "year", y: "value", z: "country" }),          // muted backdrop
//       glLine(focus, { x: "year", y: "value", stroke: GL.c_1, strokeWidth: 2.4 }),
//     ],
//   });
//
// Requires: @observablehq/plot >= 0.6 (peer). Load the fonts once via
// gl-fonts.css (see that file) so "Inter" / "Source Serif 4" resolve in the
// browser. For Node SSR, pass `document` through glPlot (jsdom).
//
// ---- Units: Plot is already in CSS px -----------------------------------------
//
// Unlike the ggplot theme (which converts Nil's px spec to pt/linewidth), every
// number here is CSS px at render size — exactly what Nil's grammar specifies.
// strokeWidth: 2 IS 2px; fontSize "12px" IS Nil's 12px chart text. No conversion.
// That makes Plot the most literal encoding of the grammar in the kit; keep the
// values identical to grammar.md and do not "rescale" them.

import * as Plot from "@observablehq/plot";
import type {
  PlotOptions, Markish, Data, MarkOptions,
  LineOptions, DotOptions, BarXOptions, BarYOptions, AreaYOptions, TextOptions,
  RectXOptions, RectYOptions, CellOptions, GeoOptions, BoxXOptions, BoxYOptions,
  LinearRegressionYOptions, GridXOptions, GridYOptions,
} from "@observablehq/plot";

// ---- Design tokens (grammar.md) ---------------------------------------------
//
// The single source of truth is grammar.md. This object is a DOWNSTREAM COPY —
// if a hex here disagrees with grammar.md, grammar.md wins and this file is the
// bug. Mirrors skills/gl-ggplot/assets/theme_gl.R exactly.
//
// Ink ramp — warm, four layers (browns, not neutral greys).
// Categorical palette — six hues, three tones each (light / main / dark):
//   - Main  = fills (bars, lines, treemap tiles, scatter circle bodies).
//   - Dark  = strokes on overlapping marks + EVERY label/legend/annotation tied
//             to the series (WCAG AA against paper). Never a fill (except the
//             three-tone stacked area).
//   - Light = backgrounds, faded states, sequential-ramp tail.
// c_muted (light/main/dark) — cool grey for the "everyone else" backdrop.

export const GL = {
  // Ink ramp
  ink: "#1A1714",
  ink_2: "#2C2823", // axis lines, ticks, tick labels — the standard axis color (§3.5)
  ink_3: "#4F4A42", // subtitles, captions, reference-threshold lines, map borders
  ink_4: "#9A9389", // faint markers, sparse trendlines (geom_smooth analogue)

  // Accent (= c_1_dark) — non-data UI chrome only (eyebrows, figure labels, links).
  // Do NOT use as a data-mark fill; that is the typography↔data-viz mix-up to avoid.
  accent: "#1A5A8E",
  accent_deep: "#003E6B",
  accent_soft: "#3A85B8",
  accent_tint: "#E1F0FA",

  // Paper & chrome
  paper: "#FFFFFF", // content-page paper (pure white) — chart background + label halo
  paper_warm: "#F4F1EA",
  cover_bg: "#F3F2EA",
  rule: "#DDDDDD",
  gridline: "#D8D4CC", // in-chart major gridlines (horizontal by default)

  // Categorical — three tones per hue
  c_1_light: "#B5D5EA", c_1: "#2F87C8", c_1_dark: "#1A5A8E", // Blue
  c_2_light: "#E89C9C", c_2: "#CC4948", c_2_dark: "#8A2C2B", // Red
  c_3_light: "#92D6BF", c_3: "#2AA584", c_3_dark: "#1A6B53", // Teal
  c_4_light: "#B5A0CC", c_4: "#7554A3", c_4_dark: "#4A3470", // Purple
  c_5_light: "#F4BC8A", c_5: "#EA822D", c_5_dark: "#A8580F", // Orange
  c_6_light: "#E6E2A8", c_6: "#CDC86B", c_6_dark: "#8A8638", // Yellow

  // Muted grey — "everyone else"
  c_muted_light: "#CDD2D9",
  c_muted: "#AFB5BE",
  c_muted_dark: "#5F6773",
} as const;

// Convenience aliases (mirror theme_gl.R). Focus colors are MAIN tones — fills
// and highlighted lines. Their *_dark partners are ONLY for strokes on those
// marks and any text/label tied to them (grammar §3.3, decision rule 6).
export const highlight = GL.c_1; //      main blue  — default data focus
export const highlight_dark = GL.c_1_dark; // stroke on a highlighted point + its label
export const lead_finding = GL.c_2; //      main red   — stark emphasis (sparingly)
export const lead_finding_dark = GL.c_2_dark;
export const c_muted = GL.c_muted;
export const accent = GL.accent; //          non-data UI chrome only — NOT a data fill

// Line widths (px) — grammar §3.4 / §5.
export const GL_STROKE = {
  axis: 1, //        axis line, tick, gridline, zero baseline
  line: 2, //        standard / muted line
  lineFocus: 2.4, // highlighted focus line (1.2× the muted line, not a 2× jump)
  mapBorder: 0.5, // choropleth region border
} as const;

// Font sizes (px) — grammar §3, Nil: all chart text 12px, chart title 14px.
export const GL_FONT = {
  size: 12, //      tick labels, axis titles, legend, series labels, source line
  titleSize: 14, // chart title (slide mode)
  sans: '"Inter", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
  serif: '"Source Serif 4", Georgia, "Times New Roman", serif',
} as const;

// Named figure sizes (px at 96dpi) — mirror the ggplot recipe's gl_fig table
// exactly (full = 6.5×4in, etc.) so a Plot chart drops into the same report slot
// as its ggplot twin. Pass as `glPlot({ ...GL_SIZE.full, marks })`. Locking the
// geometry keeps figures from reflowing the page (grammar: figures placed 1:1).
export const GL_SIZE = {
  full:        { width: 624, height: 384 }, // 6.5 × 4.0
  full_tall:   { width: 624, height: 576 }, // 6.5 × 6.0
  full_square: { width: 624, height: 624 }, // 6.5 × 6.5
  major:       { width: 411, height: 384 }, // 4.278 × 4.0
  half:        { width: 304, height: 288 }, // 3.167 × 3.0
  half_tall:   { width: 304, height: 480 }, // 3.167 × 5.0
  slide:       { width: 960, height: 540 }, // 10 × 5.625
} as const;
export type GLSizeName = keyof typeof GL_SIZE;

// ---- Named palettes ---------------------------------------------------------
//
// `categorical` is the default 6-color discrete palette (main tones). The dark
// and light variants keep the same order. Sequential / diverging ramps feed the
// continuous color scales. Sector palettes are external Growth Lab standards
// (name → hex) that override the categorical grammar for trade / product data.

export const glPalettes = {
  categorical: [GL.c_1, GL.c_2, GL.c_3, GL.c_4, GL.c_5, GL.c_6],
  categorical_dark: [GL.c_1_dark, GL.c_2_dark, GL.c_3_dark, GL.c_4_dark, GL.c_5_dark, GL.c_6_dark],
  categorical_light: [GL.c_1_light, GL.c_2_light, GL.c_3_light, GL.c_4_light, GL.c_5_light, GL.c_6_light],

  // Sequential 5-step ramps (low → high). Darker = higher.
  sequential_1: ["#E5F0F9", "#B5D5EA", "#6FA5CE", "#2F87C8", "#1A5A8E"], // Blue (default)
  sequential_2: ["#F4D5D5", "#E89C9C", "#DC6F6E", "#CC4948", "#8A2C2B"], // Red
  sequential_3: ["#D5EFE7", "#92D6BF", "#5BC0A0", "#2AA584", "#1A6B53"], // Teal
  sequential_4: ["#E5DDF0", "#B5A0CC", "#9276BA", "#7554A3", "#4A3470"], // Purple
  sequential_5: ["#FBE5D5", "#F4BC8A", "#EE9A52", "#EA822D", "#A8580F"], // Orange
  sequential_6: ["#FBF8DC", "#E6E2A8", "#DCD68E", "#CDC86B", "#8A8638"], // Yellow

  // Diverging 6-step palettes (negative tail → midpoint → positive tail).
  diverging_2_1: ["#8A2C2B", "#DC6F6E", "#EFC7C0", "#C5DCEC", "#6FA5CE", "#1A5A8E"], // Red ↔ Blue (default)
  diverging_3_1: ["#1A6B53", "#5BC0A0", "#BDE5D8", "#C5DCEC", "#6FA5CE", "#1A5A8E"], // Teal ↔ Blue
  diverging_5_1: ["#A8580F", "#EE9A52", "#F4BC8A", "#C5DCEC", "#6FA5CE", "#1A5A8E"], // Orange ↔ Blue
  diverging_6_1: ["#8A8638", "#DCD68E", "#E6E2A8", "#C5DCEC", "#6FA5CE", "#1A5A8E"], // Yellow ↔ Blue

  // Atlas HS product sectors — external standard (name → hex).
  hs_sectors: {
    "Services": "#b23c6f", "Textiles": "#7bc8a4", "Agriculture": "#e5c21a",
    "Stone": "#caa46b", "Minerals": "#a88b7d", "Metals": "#c9656b",
    "Chemicals": "#b07ac9", "Vehicles": "#7a6cc3", "Machinery": "#6e8fc3",
    "Electronics": "#74c5c6", "Other": "#2f5d74",
  },
  // Atlas SITC product sectors — external standard (name → hex).
  sitc_sectors: {
    "Services": "#b23c6f", "Food": "#e5c21a", "Beverages": "#e76f8f",
    "Crude Materials": "#cf6f6f", "Fuels": "#b39183", "Vegetable Oils": "#f39c12",
    "Chemicals": "#b07ac9", "Material Manufacturers": "#d73027",
    "Machinery & Vehicles": "#6e8fc3", "Other Manufacturers": "#1f9d9a",
    "Unspecified": "#355f73",
  },
  // Product space clusters — external standard (name → hex).
  product_space: {
    "Agricultural Goods": "#e0b614", "Construction Goods": "#c77c2b",
    "Electronics": "#5cc7c6", "Chemicals & Basic Metals": "#9c3bd6",
    "Metalworking Machinery": "#c43d3d", "Minerals": "#7a6a63",
    "Textile & Home Goods": "#8a8a8a", "Apparel": "#2fa84f",
  },
} as const;

export type GLToken = keyof typeof GL;
export type GLSequentialName = "sequential_1" | "sequential_2" | "sequential_3" | "sequential_4" | "sequential_5" | "sequential_6";
export type GLDivergingName = "diverging_2_1" | "diverging_3_1" | "diverging_5_1" | "diverging_6_1";
export type GLSectorName = "hs_sectors" | "sitc_sectors" | "product_space";

// ---- Dark-tone rule (grammar §3.3, decision rule 6) -------------------------
//
// Every text/label tied to a colored mark uses the DARK tone of that hue — no
// label ever shares its mark's fill hex. glDark() maps any main or light tone
// (incl. the muted grey) to its dark partner; dark tones pass through unchanged
// (idempotent). Unknown colors pass through with a console warning.

const DARK_MAP: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (let i = 1; i <= 6; i++) {
    const dark = GL[`c_${i}_dark` as GLToken] as string;
    m[(GL[`c_${i}` as GLToken] as string).toUpperCase()] = dark;
    m[(GL[`c_${i}_light` as GLToken] as string).toUpperCase()] = dark;
    m[dark.toUpperCase()] = dark;
  }
  m[GL.c_muted.toUpperCase()] = GL.c_muted_dark;
  m[GL.c_muted_light.toUpperCase()] = GL.c_muted_dark;
  m[GL.c_muted_dark.toUpperCase()] = GL.c_muted_dark;
  return m;
})();

export function glDark(color: string): string {
  const hit = DARK_MAP[color.toUpperCase()];
  if (hit) return hit;
  console.warn(`glDark(): no dark partner for ${color} — returning unchanged.`);
  return color;
}

// ---- Root style + font styling ----------------------------------------------
//
// Plot marks default to `currentColor`, so setting `color` on the root style
// paints all tick labels + axis text in one place. fontSize "12px" is Nil's
// chart-text spec verbatim (no conversion — Plot is px at render size). The
// className hook lets gl-fonts.css enable tabular figures on every numeral.

export const GL_CLASSNAME = "gl-plot";

export const glStyle = {
  background: GL.paper,
  color: GL.ink_2, //           default ink for axis/tick text (currentColor)
  fontFamily: GL_FONT.sans,
  fontSize: `${GL_FONT.size}px`,
  fontVariantNumeric: "tabular-nums", // grammar §3.7 — all numerals tabular
} as const;

// ---- Scale helpers ----------------------------------------------------------

/** Discrete categorical color scale. For sector palettes (name → hex objects),
 *  domain + range are derived so factor levels match the named colors. */
export function glColor(palette: keyof typeof glPalettes = "categorical", opts: Record<string, unknown> = {}) {
  const pal = glPalettes[palette];
  if (!pal) throw new Error(`Unknown palette: ${palette}. Available: ${Object.keys(glPalettes).join(", ")}`);
  if (Array.isArray(pal)) return { range: [...pal], ...opts };
  // Named object palette: split into aligned domain / range arrays.
  return { domain: Object.keys(pal), range: Object.values(pal), ...opts };
}

/** Continuous sequential color scale (ordered, no midpoint). Darker = higher. */
export function glColorSequential(palette: GLSequentialName = "sequential_1", opts: Record<string, unknown> = {}) {
  return { type: "linear" as const, range: [...glPalettes[palette]], interpolate: "rgb" as const, ...opts };
}

/** Continuous diverging color scale — hue boundary sits AT `pivot` (default 0,
 *  the data's real reference point). Never use on a purely positive scale. */
export function glColorDiverging(palette: GLDivergingName = "diverging_2_1", opts: { pivot?: number } & Record<string, unknown> = {}) {
  const { pivot = 0, ...rest } = opts;
  return { type: "diverging" as const, range: [...glPalettes[palette]], pivot, ...rest };
}

// ---- Mark helpers (GL geom defaults) ----------------------------------------
//
// Mirrors the ggplot geom defaults: an UNTYPED mark is the muted backdrop of
// the pop-up pattern — you opt IN to color for the focus series, never out.
// Each helper pre-fills the GL default and shallow-merges caller options, so
// `glLine(focus, { stroke: highlight, strokeWidth: 2.4 })` overpaints the focus.

/** Line — muted backdrop by default (c_muted, 2px, round joins). Focus series:
 *  pass `{ stroke: highlight, strokeWidth: 2.4 }`. A single-series chart is a
 *  focus with no backdrop: `glLine(data, { stroke: highlight })`. */
export function glLine(data: Data, options: LineOptions = {}): Markish {
  return Plot.line(data, { stroke: GL.c_muted, strokeWidth: GL_STROKE.line, strokeLinejoin: "round", ...options });
}

/** Dot — filled circle (fill body + darker 1px stroke), 0.8 opacity so
 *  overlapping points darken together (grammar §3.4). Muted pair by default.
 *  A highlighted point is drawn ONCE at full opacity, EXCLUDED from the muted
 *  backdrop: `glDot(focus, { fill: highlight, stroke: highlight_dark, opacity: 1 })`. */
export function glDot(data: Data, options: DotOptions = {}): Markish {
  return Plot.dot(data, {
    fill: GL.c_muted, stroke: GL.c_muted_dark, strokeWidth: GL_STROKE.axis,
    fillOpacity: 0.8, strokeOpacity: 0.8, r: 5, ...options, // r 5 = grammar §5 (5–7px)
  });
}

/** Vertical bars — muted fill + 1px paper stroke (the stacked-segment gap,
 *  grammar §3.4/§10; invisible on a single bar). Focus: `{ fill: highlight }`. */
export function glBarY(data: Data, options: BarYOptions = {}): Markish {
  return Plot.barY(data, { fill: GL.c_muted, stroke: GL.paper, strokeWidth: 1, ...options });
}

/** Horizontal bars — same defaults as glBarY (for ranked / horizontal charts). */
export function glBarX(data: Data, options: BarXOptions = {}): Markish {
  return Plot.barX(data, { fill: GL.c_muted, stroke: GL.paper, strokeWidth: 1, ...options });
}

/** Stacked area — muted fill, NO stroke (stacked areas stay edge-to-edge). */
export function glAreaY(data: Data, options: AreaYOptions = {}): Markish {
  return Plot.areaY(data, { fill: GL.c_muted, ...options });
}

/** Text annotation — Inter, ink_2, 12px, with a thin paper halo so it stays
 *  legible over marks (grammar §3.5). For a label tied to a colored series pass
 *  its MAIN tone as `fill`; glText then applies the dark partner AND weight 600
 *  automatically (a series/legend label is Inter 600, grammar §2). A bare
 *  annotation (no `fill`) stays ink_2 at weight 400, the annotation role. */
export function glText(data: Data, options: TextOptions & { fill?: string } = {}): Markish {
  const { fill, ...rest } = options;
  // On a data text mark the halo is `stroke` + `strokeWidth` (Plot auto-sets
  // paint-order: stroke so it sits BEHIND the glyphs). `textStroke` is
  // axis-mark-only and Plot.text ignores it — don't use it here. strokeWidth 2.4
  // gives the grammar §3.5 halo radius (~0.1em = 1.2px at the 12px text size).
  return Plot.text(data, {
    fill: fill ? glDark(fill) : GL.ink_2,
    fontSize: GL_FONT.size,
    ...(fill ? { fontWeight: 600 } : {}), // series label → 600; caller can override
    stroke: GL.paper, strokeWidth: 2.4, // the paper halo (behind the glyphs)
    ...rest,
  });
}

/** Zero baseline — solid 1px ink_2 at axis weight (grammar §3.5). NOT the
 *  dashed threshold default. `glZeroLine("y")` for y=0, `"x"` for x=0. */
export function glZeroLine(axis: "x" | "y" = "y", options: MarkOptions = {}): Markish {
  const common = { stroke: GL.ink_2, strokeWidth: GL_STROKE.axis, ...options };
  return axis === "y" ? Plot.ruleY([0], common) : Plot.ruleX([0], common);
}

/** Reference threshold — dashed 1px ink_3 (a target, a safety line). Distinct
 *  from a zero baseline (use glZeroLine for that). */
export function glThreshold(value: number, axis: "x" | "y" = "y", options: MarkOptions = {}): Markish {
  const common = { stroke: GL.ink_3, strokeWidth: GL_STROKE.axis, strokeDasharray: "4 3", ...options };
  return axis === "y" ? Plot.ruleY([value], common) : Plot.ruleX([value], common);
}

/** Trend line — ink_4 (grammar §1: trendlines). Wraps linearRegressionY. */
export function glTrend(data: Data, options: LinearRegressionYOptions = {}): Markish {
  return Plot.linearRegressionY(data, {
    stroke: GL.ink_4, strokeWidth: GL_STROKE.line,
    fill: GL.c_muted_light, fillOpacity: 0.5, ...options,
  });
}

/** Horizontal gridlines — 1px gridline (#D8D4CC), full opacity. GL default is
 *  Y-only; add glGridX() explicitly for horizontal-bar charts. */
export function glGridY(options: GridYOptions = {}): Markish {
  return Plot.gridY({ stroke: GL.gridline, strokeWidth: GL_STROKE.axis, strokeOpacity: 1, ...options });
}
export function glGridX(options: GridXOptions = {}): Markish {
  return Plot.gridX({ stroke: GL.gridline, strokeWidth: GL_STROKE.axis, strokeOpacity: 1, ...options });
}

/** Histogram bars — same fill/gap as glBarY, for use with Plot.binX:
 *  `glRectY(data, Plot.binX({ y: "count" }, { x: "value", fill: highlight }))`. */
export function glRectY(data: Data, options: RectYOptions = {}): Markish {
  return Plot.rectY(data, { fill: GL.c_muted, stroke: GL.paper, strokeWidth: 1, ...options });
}
export function glRectX(data: Data, options: RectXOptions = {}): Markish {
  return Plot.rectX(data, { fill: GL.c_muted, stroke: GL.paper, strokeWidth: 1, ...options });
}

/** Heatmap cell (both axes ordinal) — tiles ABUT directly, no stroke, no inset
 *  (grammar §3.4: "Bar / area / treemap … none — tiles abut directly"). A flat
 *  single-level heatmap is not the two-level-treemap exception, so it carries no
 *  paper separators; Plot's default cell inset is overridden to 0 so cells meet
 *  edge-to-edge instead of leaving white gutters. Pair with a sequential color
 *  scale: `glPlot({ color: glColorSequential(),
 *  marks: [ glCell(data, { x, y, fill: "value" }) ] })`. Full opacity. */
export function glCell(data: Data, options: CellOptions = {}): Markish {
  return Plot.cell(data, { inset: 0, ...options });
}

/** Choropleth / geographic polygons — 0.5px ink_3 region borders (grammar §1,
 *  Nil §10). Pair with a sequential (or a real-midpoint diverging) color scale.
 *  `glPlot({ color: glColorSequential("sequential_1"),
 *    marks: [ glGeo(states, { fill: "gdpPerCap" }) ] })`. */
export function glGeo(data: Data, options: GeoOptions = {}): Markish {
  return Plot.geo(data, { stroke: GL.ink_3, strokeWidth: GL_STROKE.mapBorder, ...options });
}

/** Box plot that RECEDES — background distribution behind a highlighted series
 *  (background distribution, Nil §11b): c_muted_light fill, c_muted outline (NOT a dark outline). Draw
 *  the focus country as a glLine + glDot on top. glBoxY groups on x; glBoxX on y. */
export function glBoxY(data: Data, options: BoxYOptions = {}): Markish {
  return Plot.boxY(data, { fill: GL.c_muted_light, stroke: GL.c_muted, ...options });
}
export function glBoxX(data: Data, options: BoxXOptions = {}): Markish {
  return Plot.boxX(data, { fill: GL.c_muted_light, stroke: GL.c_muted, ...options });
}

/** Bottom + left axis lines — 1px ink_2 (grammar §3.5). Plot's idiom is
 *  gridline-forward and draws no domain line; add this when a chart wants the
 *  explicit L-frame. Returns two Plot.frame marks (Plot flattens the array). */
export function glAxisLines(): Markish[] {
  const common = { stroke: GL.ink_2, strokeWidth: GL_STROKE.axis };
  return [Plot.frame({ anchor: "left", ...common }), Plot.frame({ anchor: "bottom", ...common })];
}

// ---- glPlot() wrapper -------------------------------------------------------
//
// Thin, predictable merge over Plot.plot():
//   • root `style` = glStyle merged under any caller style (paper bg, ink_2
//     text, Inter, 12px, tabular figures) + the `gl-plot` className hook.
//   • GL gridlines prepended behind the data (Y-only by default) so they render
//     at the exact gridline color instead of Plot's faint default.
//   • everything else — INCLUDING `color` — passes straight through to
//     Plot.plot() so Plot's scale-type inference is preserved.
//
// WHY glPlot does NOT inject a default color scale (a principled choice):
// forcing `color: { range: <6 discrete colors> }` biases Plot's scale-type
// inference to ORDINAL. If a caller then maps `fill` to a continuous field
// without their own scale, they'd get 6 recycled bands instead of a ramp —
// strictly worse than raw Plot.plot (which infers a linear scale and picks a
// sensible ramp). Plot has no "discrete-only default" hook (unlike ggplot's
// discrete.colour option), so the honest move is to require an explicit scale:
// pass `color: glColor()` for GL categorical, `glColorSequential()` /
// `glColorDiverging()` for continuous. One call, and every encoding stays correct.
//
// The implicit Plot axes draw 4px outward ticks + labels; they inherit ink_2
// via currentColor and already carry tabular-nums on quantitative axes. The
// bottom+left axis LINE (grammar §3.5) is drawn by default via glAxisLines()
// so the chart carries the same L-frame its ggplot twin renders; pass
// `axisLines: false` for a deliberately frame-less chart.

export interface GLPlotOptions extends PlotOptions {
  /** Which GL gridlines to draw behind the data. Default "y" (grammar §3.5:
   *  horizontal only; never both unless the chart is dense). */
  grid?: "x" | "y" | "xy" | false;
  /** Draw the bottom+left axis lines (1px ink_2, grammar §3.5). Default true so
   *  a Plot chart carries the same L-frame its ggplot twin renders. Set false
   *  for a deliberately frame-less chart. */
  axisLines?: boolean;
}

export function glPlot(options: GLPlotOptions = {}) {
  const { grid = "y", axisLines = true, marks = [], style, className, x, y, fx, fy, ...rest } = options;

  const gridMarks: Markish[] = [];
  if (grid === "y" || grid === "xy") gridMarks.push(glGridY());
  if (grid === "x" || grid === "xy") gridMarks.push(glGridX());

  // Bottom+left axis lines by default (grammar §3.5: 1px ink_2 axis line). Plot
  // draws no domain line in its gridline-forward idiom, so glPlot adds them to
  // match the ggplot twin, which renders the L-frame. Drawn over the gridlines,
  // under the data.
  const axisMarks: Markish[] = axisLines ? glAxisLines() : [];

  // Merge glStyle UNDER a caller's object style. If the caller passes a style
  // string they've opted into full control — respect it verbatim (the gl-plot
  // className still applies, so gl-fonts.css tabular figures survive).
  const style_ = typeof style === "string" ? style : { ...glStyle, ...(style ?? {}) };

  // GL axis defaults, merged UNDER any caller-supplied scale options so an
  // explicit `x`/`y` always wins:
  //   • labelArrow "none" — strip Observable's default ↑/→ axis-title arrows,
  //     which have no place in the grammar (the single most pervasive Plot
  //     default fighting the spec — it appeared on 9/12 report charts).
  //   • x labelAnchor "center" — center the x-title under the axis instead of
  //     Plot's right-corner anchor (which collides with the last tick label).
  //   • tickSize 4 / tickPadding 2 — 4px OUTWARD ticks (grammar §3.5, matching
  //     the ggplot twin's `axis.ticks.length = 3pt`); the 2px pad puts the tick
  //     label ~6px off the axis (grammar §3.5). Ticks inherit ink_2 via
  //     currentColor. Pass `x: { tickSize: 0 }` per chart to suppress them.
  const mergeScale = (base: Record<string, unknown>, caller: unknown) =>
    ({ ...base, ...((caller as Record<string, unknown>) ?? {}) });
  const xScale = mergeScale({ labelArrow: "none", labelAnchor: "center", tickSize: 4, tickPadding: 2 }, x);
  const yScale = mergeScale({ labelArrow: "none", tickSize: 4, tickPadding: 2 }, y);

  return Plot.plot({
    className: className ?? GL_CLASSNAME,
    style: style_,
    x: xScale,
    y: yScale,
    // Facet axes only when the caller uses faceting — strip their arrows too.
    ...(fx !== undefined ? { fx: mergeScale({ labelArrow: "none" }, fx) } : {}),
    ...(fy !== undefined ? { fy: mergeScale({ labelArrow: "none" }, fy) } : {}),
    ...rest, // includes `color` when the caller supplies one — inference intact
    marks: [...gridMarks, ...axisMarks, ...marks],
  });
}

// ---- SSR export helpers -----------------------------------------------------
//
// Two things bite when you serialize a Plot element to a STANDALONE .svg/.png
// (the md-pipeline path, rule 13). Both are invisible in a browser and only
// surface under Node SSR / a non-CSS rasterizer:
//   1. `outerHTML` from jsdom often omits the SVG `xmlns`, so the string is not
//      a valid standalone SVG (rasterizers reject it: "no root node").
//   2. glStyle sets the paper background via CSS `background:`, which SVG
//      rasterizers do NOT paint → a transparent (often black) raster.
// glSerialize() fixes both: injects the namespaces and prepends a paper <rect>.

const SVG_NS = "http://www.w3.org/2000/svg";

/** Serialize a glPlot() element to a valid standalone SVG string: injects the
 *  `xmlns`/`xmlns:xlink` namespaces and prepends a painted paper background rect
 *  (the CSS background isn't honored by rasterizers). If the element is a
 *  `<figure>` (a legend is present) only its `<svg>` is returned — an
 *  out-of-SVG legend/swatch row cannot travel in a single image (draw the
 *  legend as marks, or use glColorbar for a continuous scale). */
export function glSerialize(node: Element): string {
  const svg = (node.tagName?.toLowerCase() === "svg" ? node : node.querySelector("svg")) as SVGSVGElement | null;
  if (!svg) throw new Error("glSerialize: no <svg> found in the element");
  if (!svg.getAttribute("xmlns")) svg.setAttribute("xmlns", SVG_NS);
  if (!svg.getAttribute("xmlns:xlink")) svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  const doc = svg.ownerDocument;
  if (doc && !svg.querySelector("rect[data-gl-paper]")) {
    const rect = doc.createElementNS(SVG_NS, "rect");
    rect.setAttribute("data-gl-paper", "");
    rect.setAttribute("x", "0"); rect.setAttribute("y", "0");
    rect.setAttribute("width", "100%"); rect.setAttribute("height", "100%");
    rect.setAttribute("fill", GL.paper);
    svg.insertBefore(rect, svg.firstChild);
  }
  return svg.outerHTML;
}

/** SSR-safe continuous colorbar (the `legend: true` replacement for a
 *  sequential/diverging scale). Plot's continuous legend rasterizes its ramp to
 *  a `<canvas>`, which jsdom lacks — so `legend: true` THROWS under Node SSR.
 *  This builds the same ramp as an inline `<linearGradient>` (no canvas) and
 *  returns a self-contained `<svg>` you place beside the chart (or composite
 *  into its SVG). Inter 12px ink_2, tabular tick labels. Pass the SAME palette
 *  you gave glColorSequential/glColorDiverging, plus the data `domain`. */
export function glColorbar(options: {
  palette?: keyof typeof glPalettes;
  domain?: [number, number];
  title?: string;
  width?: number;
  height?: number;
  ticks?: number[];
  tickFormat?: (v: number) => string;
  document?: Document;
} = {}): SVGSVGElement {
  const {
    palette = "sequential_1", domain = [0, 1], title,
    width = 180, height, ticks, tickFormat = (v) => `${v}`,
    document: doc = (globalThis as unknown as { document?: Document }).document,
  } = options;
  if (!doc) throw new Error("glColorbar: no document — pass { document } under Node SSR");
  const pal = glPalettes[palette];
  const stops = (Array.isArray(pal) ? pal : Object.values(pal)) as string[];
  const barH = 8, padTop = title ? 20 : 4, padBottom = 18, padX = 6;
  const H = height ?? padTop + barH + padBottom;
  const barW = width - padX * 2;
  const [lo, hi] = domain, span = hi - lo || 1;
  const el = (n: string) => doc.createElementNS(SVG_NS, n);
  const set = (e: Element, a: Record<string, string>) => { for (const k in a) e.setAttribute(k, a[k]); return e; };

  const svg = set(el("svg"), {
    xmlns: SVG_NS, width: `${width}`, height: `${H}`, viewBox: `0 0 ${width} ${H}`,
    "font-family": GL_FONT.sans, "font-size": `${GL_FONT.size}px`, fill: GL.ink_2,
    "font-variant-numeric": "tabular-nums",
  });
  const gid = `gl-ramp-${palette}`;
  const grad = set(el("linearGradient"), { id: gid, x1: "0%", x2: "100%" });
  stops.forEach((c, i) => grad.appendChild(set(el("stop"), {
    offset: `${(i / (stops.length - 1)) * 100}%`, "stop-color": c,
  })));
  const defs = el("defs"); defs.appendChild(grad); svg.appendChild(defs);
  if (title) { const t = set(el("text"), { x: `${padX}`, y: "12", fill: GL.ink_3 }); t.textContent = title; svg.appendChild(t); }
  svg.appendChild(set(el("rect"), {
    x: `${padX}`, y: `${padTop}`, width: `${barW}`, height: `${barH}`,
    fill: `url(#${gid})`, stroke: GL.ink_3, "stroke-width": "0.5",
  }));
  for (const v of ticks ?? [lo, (lo + hi) / 2, hi]) {
    const x = padX + ((v - lo) / span) * barW;
    svg.appendChild(set(el("line"), {
      x1: `${x}`, x2: `${x}`, y1: `${padTop + barH}`, y2: `${padTop + barH + 3}`,
      stroke: GL.ink_2, "stroke-width": "0.5",
    }));
    const lab = set(el("text"), { x: `${x}`, y: `${padTop + barH + 14}`, "text-anchor": "middle" });
    lab.textContent = tickFormat(v); svg.appendChild(lab);
  }
  return svg as SVGSVGElement;
}
