// gl-plot.d.ts — TypeScript reference for the Growth Lab Observable Plot theme.
//
// This is the at-a-glance type surface of gl-plot.ts: the token shape, the
// palette names, and every exported helper's signature. It is authored by hand
// as a REFERENCE (the .ts already carries its own inferred types) — keep the two
// in sync when either changes. Every value traces to grammar.md; a hex that
// disagrees with grammar.md is a bug here, not there.

import type {
  PlotOptions, Markish, Data, MarkOptions,
  LineOptions, DotOptions, BarXOptions, BarYOptions, AreaYOptions, TextOptions,
  RectXOptions, RectYOptions, CellOptions, GeoOptions, BoxXOptions, BoxYOptions,
  LinearRegressionYOptions, GridXOptions, GridYOptions,
} from "@observablehq/plot";

// ---- Tokens -----------------------------------------------------------------

/** The full GL token table — warm ink ramp, accent, paper/chrome, the six
 *  categorical hues in light/main/dark, and the muted grey. Mirrors the `gl`
 *  list in theme_gl.R and the color tables in grammar.md §1. */
export interface GLTokens {
  // Ink ramp (warm, four layers)
  readonly ink: "#1A1714";
  readonly ink_2: "#2C2823";
  readonly ink_3: "#4F4A42";
  readonly ink_4: "#9A9389";
  // Accent (= c_1_dark) — non-data UI chrome only
  readonly accent: "#1A5A8E";
  readonly accent_deep: "#003E6B";
  readonly accent_soft: "#3A85B8";
  readonly accent_tint: "#E1F0FA";
  // Paper & chrome
  readonly paper: "#FFFFFF";
  readonly paper_warm: "#F4F1EA";
  readonly cover_bg: "#F3F2EA";
  readonly rule: "#DDDDDD";
  readonly gridline: "#D8D4CC";
  // Categorical — three tones per hue
  readonly c_1_light: "#B5D5EA"; readonly c_1: "#2F87C8"; readonly c_1_dark: "#1A5A8E";
  readonly c_2_light: "#E89C9C"; readonly c_2: "#CC4948"; readonly c_2_dark: "#8A2C2B";
  readonly c_3_light: "#92D6BF"; readonly c_3: "#2AA584"; readonly c_3_dark: "#1A6B53";
  readonly c_4_light: "#B5A0CC"; readonly c_4: "#7554A3"; readonly c_4_dark: "#4A3470";
  readonly c_5_light: "#F4BC8A"; readonly c_5: "#EA822D"; readonly c_5_dark: "#A8580F";
  readonly c_6_light: "#E6E2A8"; readonly c_6: "#CDC86B"; readonly c_6_dark: "#8A8638";
  // Muted grey — "everyone else"
  readonly c_muted_light: "#CDD2D9";
  readonly c_muted: "#AFB5BE";
  readonly c_muted_dark: "#5F6773";
}

export declare const GL: GLTokens;
export type GLToken = keyof GLTokens;

/** Line widths in CSS px (grammar §3.4/§5). Plot is px-native — no conversion. */
export interface GLStrokeScale {
  readonly axis: 1;
  readonly line: 2;
  readonly lineFocus: 2.4;
  readonly mapBorder: 0.5;
}
export declare const GL_STROKE: GLStrokeScale;

/** Font sizes (px) + the two-family stack (grammar §2/§3). */
export interface GLFontScale {
  readonly size: 12;
  readonly titleSize: 14;
  readonly sans: string; // Inter stack
  readonly serif: string; // Source Serif 4 stack
}
export declare const GL_FONT: GLFontScale;

// Convenience aliases
export declare const highlight: "#2F87C8";
export declare const highlight_dark: "#1A5A8E";
export declare const lead_finding: "#CC4948";
export declare const lead_finding_dark: "#8A2C2B";
export declare const c_muted: "#AFB5BE";
export declare const accent: "#1A5A8E";

// ---- Palettes ---------------------------------------------------------------

export type GLArrayPaletteName =
  | "categorical" | "categorical_dark" | "categorical_light"
  | "sequential_1" | "sequential_2" | "sequential_3"
  | "sequential_4" | "sequential_5" | "sequential_6"
  | "diverging_2_1" | "diverging_3_1" | "diverging_5_1" | "diverging_6_1";
export type GLSequentialName = "sequential_1" | "sequential_2" | "sequential_3" | "sequential_4" | "sequential_5" | "sequential_6";
export type GLDivergingName = "diverging_2_1" | "diverging_3_1" | "diverging_5_1" | "diverging_6_1";
export type GLSectorName = "hs_sectors" | "sitc_sectors" | "product_space";
export type GLPaletteName = GLArrayPaletteName | GLSectorName;

/** Array palettes are ordered hex; sector palettes are name → hex maps. */
export declare const glPalettes:
  & { readonly [K in GLArrayPaletteName]: readonly string[] }
  & { readonly [K in GLSectorName]: Readonly<Record<string, string>> };

// ---- Dark-tone rule ---------------------------------------------------------

/** Map any main/light tone (incl. muted) to its dark partner for label/stroke
 *  color. Idempotent on dark tones; unknown colors pass through with a warning. */
export declare function glDark(color: string): string;

// ---- Root style -------------------------------------------------------------

export declare const GL_CLASSNAME: "gl-plot";

/** The root `style` object for Plot.plot(): paper background, ink_2 text
 *  (currentColor → all axis/tick text), Inter, 12px, tabular figures. */
export declare const glStyle: {
  readonly background: "#FFFFFF";
  readonly color: "#2C2823";
  readonly fontFamily: string;
  readonly fontSize: "12px";
  readonly fontVariantNumeric: "tabular-nums";
};

// ---- Scale helpers ----------------------------------------------------------

/** Discrete categorical color scale. Sector palettes yield aligned
 *  domain + range so factor levels bind to the named colors. */
export declare function glColor(palette?: GLPaletteName, opts?: Record<string, unknown>): {
  range: string[]; domain?: string[]; [k: string]: unknown;
};
/** Continuous sequential color scale (ordered, no midpoint; darker = higher). */
export declare function glColorSequential(palette?: GLSequentialName, opts?: Record<string, unknown>): {
  type: "linear"; range: string[]; interpolate: "rgb"; [k: string]: unknown;
};
/** Continuous diverging color scale, hue boundary at `pivot` (default 0). */
export declare function glColorDiverging(palette?: GLDivergingName, opts?: { pivot?: number } & Record<string, unknown>): {
  type: "diverging"; range: string[]; pivot: number; [k: string]: unknown;
};

// ---- Mark helpers (GL geom defaults) ----------------------------------------

// Each helper is typed with its specific Plot option interface (not base
// MarkOptions) so mark-specific options — dot `r`, text `text`, rect `interval`,
// line `curve` — type-check and autocomplete. Options merge over the GL default.
export declare function glLine(data: Data, options?: LineOptions): Markish;
export declare function glDot(data: Data, options?: DotOptions): Markish;
export declare function glBarY(data: Data, options?: BarYOptions): Markish;
export declare function glBarX(data: Data, options?: BarXOptions): Markish;
export declare function glAreaY(data: Data, options?: AreaYOptions): Markish;
export declare function glText(data: Data, options?: TextOptions & { fill?: string }): Markish;
export declare function glZeroLine(axis?: "x" | "y", options?: MarkOptions): Markish;
export declare function glThreshold(value: number, axis?: "x" | "y", options?: MarkOptions): Markish;
export declare function glTrend(data: Data, options?: LinearRegressionYOptions): Markish;
export declare function glGridY(options?: GridYOptions): Markish;
export declare function glGridX(options?: GridXOptions): Markish;
// Gap chart-types: histogram (with Plot.binX), heatmap, choropleth, box plots.
export declare function glRectY(data: Data, options?: RectYOptions): Markish;
export declare function glRectX(data: Data, options?: RectXOptions): Markish;
export declare function glCell(data: Data, options?: CellOptions): Markish;
export declare function glGeo(data: Data, options?: GeoOptions): Markish;
export declare function glBoxY(data: Data, options?: BoxYOptions): Markish;
export declare function glBoxX(data: Data, options?: BoxXOptions): Markish;
/** Bottom + left axis lines (1px ink_2) — returns two Plot.frame marks. */
export declare function glAxisLines(): Markish[];

// ---- glPlot() wrapper -------------------------------------------------------

export interface GLPlotOptions extends PlotOptions {
  /** GL gridlines to draw behind the data. Default "y". */
  grid?: "x" | "y" | "xy" | false;
}
/** GL-themed Plot.plot(): merges glStyle, a default categorical color range,
 *  and GL gridlines; passes marks/scales/margins/document straight through.
 *  Returns the rendered SVG/figure element (or virtual-DOM node under SSR). */
export declare function glPlot(options?: GLPlotOptions): ReturnType<typeof import("@observablehq/plot").plot>;

// ---- SSR export helpers -----------------------------------------------------

/** Serialize a glPlot() element to a valid standalone SVG string: injects the
 *  SVG namespaces (jsdom drops them) and prepends a painted paper background
 *  rect (the CSS background isn't honored by rasterizers). Returns only the
 *  `<svg>` — an out-of-SVG legend cannot travel in a single image. */
export declare function glSerialize(node: Element): string;

/** SSR-safe continuous colorbar — the `legend: true` replacement for a
 *  sequential/diverging scale (Plot's continuous legend rasterizes to a
 *  `<canvas>`, which THROWS under jsdom). Builds the ramp as an inline
 *  `<linearGradient>` and returns a self-contained `<svg>`. */
export declare function glColorbar(options?: {
  palette?: GLPaletteName;
  domain?: [number, number];
  title?: string;
  width?: number;
  height?: number;
  ticks?: number[];
  tickFormat?: (v: number) => string;
  document?: Document;
}): SVGSVGElement;
