/**
 * GENERATED FILE — do not edit.
 *
 *   source:    packages/gl-charts/tokens.json
 *   generator: packages/gl-charts/scripts/emit-tokens.mjs
 *   verify:    node scripts/check-tokens.mjs   (fails if this file was hand-edited)
 *
 * Values AND doc comments are authored in `tokens.json`; edit them there and
 * re-run the generator. `series(index)` lives in `src/tone.ts`, not here — it is
 * logic, not a value.
 *
 * GL chart design tokens — web / SVG medium.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DOWNSTREAM COPY. `grammar.md` at the repo root is the source of truth for
 * every value in this file. If a value here disagrees with `grammar.md`, this
 * file is the bug. Change the token in `grammar.md` first, then in
 * `tokens.json`, then re-emit and update every other downstream encoding
 * listed in README.md ("Where each value lives downstream").
 *
 * Chart-specific rules are condensed in `docs/data-vis-spec-core.md`.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Units: the spec is written in CSS px, and this is the web medium, so every
 * size converts 1:1 — no scaling table is needed here (contrast `theme_gl.R`,
 * which has to convert px → pt → ggplot linewidth).
 */

// ── Ink — a four-layer warm ramp ────────────────────────────────────────────
// Warm browns, not neutral greys: the ramp sits on paper, not on a screen.

export const ink = {
  /** Chart title, axis line context, strong emphasis. PDF alias: --chart-title */
  DEFAULT: '#1A1714',
  /** Axis line, axis labels, tick labels, annotations. PDF alias: --chart-axis-label / --axis */
  2: '#2C2823',
  /** Subtitles, secondary captions. PDF alias: --chart-subtitle */
  3: '#4F4A42',
  /** Trendlines, deep-background markers. Rarely used outside charts. */
  4: '#9A9389',
} as const;

// ── Accent ──────────────────────────────────────────────────────────────────
// `accent` and `c-1-dark` are intentionally the same hex: when the c-1 series
// needs a direct label or legend mark it uses the dark tone, which clears
// WCAG AA against paper.

export const accent = {
  /** Figure label, eyebrow, accent text. PDF alias: --chart-accent */
  DEFAULT: '#1A5A8E',
  deep: '#003E6B',
  soft: '#3A85B8',
  tint: '#E1F0FA',
} as const;

// ── Paper & chrome ──────────────────────────────────────────────────────────

export const surface = {
  /** Content paper — pure white, so figures land neutral and color reads true. */
  paper: '#FFFFFF',
  /** Warm surface — accent panels, quote tint. */
  paperWarm: '#F4F1EA',
  /** Hairline borders between content blocks (not for in-chart use). */
  rule: '#DDDDDD',
  /** In-chart gridlines. PDF alias: --chart-gridline */
  gridline: '#D8D4CC',
} as const;

// ── Categorical palette — six hues, three tones each ────────────────────────
//
// Three tones, three jobs — the most-violated rule in the spec:
//   main  → every fill and every line
//   dark  → strokes on OVERLAPPING marks, and every text element tied to the
//           color (direct labels, legend entries, callouts, annotations)
//   light → backgrounds, faded states, sequential ramp tail
//
// The only place `dark` is used as a *fill* is the three-tone stacked area.

export interface GLTone {
  light: string;
  main: string;
  dark: string;
}

export const categorical: Record<GLCategoricalKey, GLTone> = {
  /** Primary — single-series default; institutional voice. dark === accent. */
  'c-1': { light: '#B5D5EA', main: '#2F87C8', dark: '#1A5A8E' },
  /** Contrast / lead-finding red. */
  'c-2': { light: '#E89C9C', main: '#CC4948', dark: '#8A2C2B' },
  'c-3': { light: '#92D6BF', main: '#2AA584', dark: '#1A6B53' },
  'c-4': { light: '#B5A0CC', main: '#7554A3', dark: '#4A3470' },
  'c-5': { light: '#F4BC8A', main: '#EA822D', dark: '#A8580F' },
  'c-6': { light: '#E6E2A8', main: '#CDC86B', dark: '#8A8638' },
} as const;

export type GLCategoricalKey = 'c-1' | 'c-2' | 'c-3' | 'c-4' | 'c-5' | 'c-6';

/**
 * De-emphasis — the "everyone else" layer in the pop-up effect (§14).
 * A cool grey that recedes behind the warm ink and the categorical hues.
 *
 * The three-tone rule applies here too, without exception: a `muted.main`
 * line must have its end-label in `muted.dark`, never in `muted.main`.
 */
export const muted: GLTone = {
  light: '#CDD2D9',
  main: '#AFB5BE',
  dark: '#5F6773',
} as const;

/**
 * Categorical hues in the order the spec requires they be spent: c-1 first,
 * then c-2, and so on. Using all six requires absolute necessity; needing more
 * than six means the representation mode should be re-thought (Decision Rule 1).
 */
export const paletteOrder: readonly GLCategoricalKey[] = [
  'c-1',
  'c-2',
  'c-3',
  'c-4',
  'c-5',
  'c-6',
] as const;

/** Main tones only, in spec order — the default discrete fill scale. */
export const categoricalMains: readonly string[] = paletteOrder.map((k) => categorical[k].main);

// ── Sequential ramps — ordered encodings, no midpoint ───────────────────────
// Darker = higher, always. Five steps by default; three for a coarse
// classification, seven or more for a fine gradient.

export const sequential = {
  'sequential-1': ['#E5F0F9', '#B5D5EA', '#6FA5CE', '#2F87C8', '#1A5A8E'],
  'sequential-2': ['#F4D5D5', '#E89C9C', '#DC6F6E', '#CC4948', '#8A2C2B'],
  'sequential-3': ['#D5EFE7', '#92D6BF', '#5BC0A0', '#2AA584', '#1A6B53'],
  'sequential-4': ['#E5DDF0', '#B5A0CC', '#9276BA', '#7554A3', '#4A3470'],
  'sequential-5': ['#FBE5D5', '#F4BC8A', '#EE9A52', '#EA822D', '#A8580F'],
  'sequential-6': ['#FBF8DC', '#E6E2A8', '#DCD68E', '#CDC86B', '#8A8638'],
} as const satisfies Record<string, readonly string[]>;

export type GLSequentialKey = keyof typeof sequential;

/** Default ramp unless the variable carries a hue convention (heat, vegetation). */
export const defaultSequential: GLSequentialKey = 'sequential-1';

// ── Diverging ramps — meaningful midpoints only ─────────────────────────────
// The boundary between the two hues IS the midpoint. Six steps by default.
// Never use a diverging ramp on a purely positive scale — readers will read
// midpoint meaning into the boundary that isn't there.

export const diverging = {
  /** red ↔ blue — the default. */
  'div-2-1': ['#8A2C2B', '#DC6F6E', '#EFC7C0', '#C5DCEC', '#6FA5CE', '#1A5A8E'],
  /** teal ↔ blue — loss vs. gain within one family. */
  'div-3-1': ['#1A6B53', '#5BC0A0', '#BDE5D8', '#C5DCEC', '#6FA5CE', '#1A5A8E'],
  /** orange ↔ blue */
  'div-5-1': ['#A8580F', '#EE9A52', '#F4BC8A', '#C5DCEC', '#6FA5CE', '#1A5A8E'],
  /** yellow ↔ blue */
  'div-6-1': ['#8A8638', '#DCD68E', '#E6E2A8', '#C5DCEC', '#6FA5CE', '#1A5A8E'],
} as const satisfies Record<string, readonly string[]>;

export type GLDivergingKey = keyof typeof diverging;

export const defaultDiverging: GLDivergingKey = 'div-2-1';

// ── Typography ──────────────────────────────────────────────────────────────
// Two families, two jobs. Serif for the title and the source line; sans for
// everything else in the figure. No third family. No monospace, ever —
// numerals are Inter with tabular figures.

export const family = {
  /** Chart title and chart source (italic). Nothing else in the figure block. */
  serif: "'Source Serif 4', Georgia, 'Times New Roman', serif",
  /** Subtitles, axis labels, ticks, series labels, annotations, legends. */
  sans: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
} as const;

/**
 * 12px is the FLOOR for all in-chart text. Labels that do not fit at 12px are
 * dropped, never shrunk below it.
 */
export const minTextSize = 12;

export interface GLTypeRole {
  family: string;
  size: number;
  weight: number;
  color: string;
  lineHeight?: number;
  letterSpacing?: string;
  fontStyle?: 'italic';
  textTransform?: 'uppercase';
  fontVariantNumeric?: 'tabular-nums';
}

export const typeRoles = {
  /** "FIGURE 4" — top of every figure block, numbered sequentially. */
  figureLabel: {
    family: family.sans,
    size: 12,
    weight: 600,
    color: accent.DEFAULT,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
  },
  /** The headline. ALWAYS ends in a period — it reads as a finding, not a label. */
  title: {
    family: family.serif,
    size: 14,
    weight: 500,
    color: ink.DEFAULT,
    lineHeight: 1.25,
    letterSpacing: '-0.005em',
  },
  /** Units, period, unit of analysis. Omit when redundant with the title. No period. */
  subtitle: {
    family: family.sans,
    size: 12,
    weight: 400,
    color: ink[3],
    lineHeight: 1.4,
  },
  /** Always required. One line below the chart. Italic serif marks provenance. */
  source: {
    family: family.serif,
    size: 12,
    weight: 400,
    color: ink[2],
    lineHeight: 1.45,
    fontStyle: 'italic',
  },
  /** Names the dimension and its units. Sentence case — never all caps. */
  axisLabel: {
    family: family.sans,
    size: 12,
    weight: 500,
    color: ink[2],
  },
  /** Numeric values along each axis. Tabular figures so digits align. */
  axisTick: {
    family: family.sans,
    size: 12,
    weight: 400,
    color: ink[2],
    fontVariantNumeric: 'tabular-nums',
  },
  /**
   * Direct label at a line end, or a legend entry. Color is NOT set here —
   * it is always the DARK tone of the series it names (Decision Rule 2).
   */
  seriesLabel: {
    family: family.sans,
    size: 12,
    weight: 600,
    color: ink[2], // placeholder — override per series with its dark tone
  },
  annotation: {
    family: family.sans,
    size: 12,
    weight: 400,
    color: ink[2],
  },
} as const satisfies Record<string, GLTypeRole>;

export type GLTypeRoleKey = keyof typeof typeRoles;

// ── Geometry — strokes, ticks, offsets, opacities ───────────────────────────

export const geometry = {
  /** Axis line: 1px solid ink-2. */
  axisWidth: 1,
  /** Ticks: 1px, 4px long, OUTWARD — never inward. */
  tickWidth: 1,
  tickLength: 4,
  /** Tick label sits 6px outside the axis. */
  tickLabelOffset: 6,
  /**
   * Axis-label offset is measured from the START of the tick label, not from
   * the axis line — 20px left of the leftmost character of the widest Y tick
   * label, and 20px below the X tick baseline. Measuring from the axis line
   * lets wide ticks like "250" collide with the rotated Y label.
   */
  axisLabelOffset: 20,
  /** Gridline: 1px solid `surface.gridline`. */
  gridlineWidth: 1,
  /** Standard line mark. */
  lineWidth: 2,
  /** The highlighted focus series — 1.2x thicker, not a 2x jump. */
  lineWidthFocus: 2.4,
  /** Scatter circle: spec allows 5–7px; 6 is the default. */
  pointRadius: 6,
  pointRadiusMin: 5,
  pointRadiusMax: 7,
  /** Scatter circle stroke. */
  pointStrokeWidth: 1,
  /** Choropleth polygon border, in ink-3. */
  mapStrokeWidth: 0.5,
  /**
   * 1px gap between stacked BAR segments — gives the category boundary a clean
   * edge and helps readers with low color discrimination separate bands.
   * Stacked *areas* sit edge-to-edge with no gap (the lightness step separates).
   */
  stackGap: 1,
  /**
   * Treemap tiles are separated by a PAPER GUTTER, never by a stroke, at every
   * depth — including a flat single-level treemap (`SPEC.md` §3.4.1).
   *
   * Measured off the spec's own plates: Figures 4 (p.17) and 11 (p.24) both run
   * a uniform 4.8px channel on both axes, rounded to 5 here. Figure 11 is why
   * the flat case needs it too — its seven supporting tiles are all `c-muted`,
   * and the gutter is the only thing that keeps them from reading as one grey
   * mass. Blocks get double, which is what "thicker" meant when the rule was
   * still written as a paper border.
   */
  treemapGutter: 5,
  treemapBlockGutter: 10,
  /** Inset from a treemap tile's top-left corner to its label block. */
  treemapLabelPad: 12,
  /**
   * Baseline of a tile's name line, below the tile's top edge, and the step
   * down to the `value · share` line.
   */
  treemapLabelBaseline: 24,
  treemapLabelLine: 16,
  /** Radar vertex dot. */
  radarVertexRadius: 3,
  radarStrokeWidth: 2,
  /** Boxplot median rule. */
  medianWidth: 1.5,
  /** Halo radius on direct labels drawn over data, so they stay legible. */
  labelHalo: '0.1em',
  /**
   * Dash pattern for a REFERENCE rule — a threshold, target or identity line
   * (§3.4.2). Chrome, not data: it also takes `ink-3` at gridline weight, so
   * nothing about it can be mistaken for a series. §3.4 keeps data lines
   * solid, which is what makes the dash readable as "not a measurement".
   */
  ruleDash: '4 3',
  /**
   * An error-bar cap or rug tick — TWICE the 4px axis tick, so a tick that
   * carries a value cannot be read as axis chrome. Width stays `tickWidth`.
   */
  dataTickLength: 8,
  /**
   * Arrowhead on a directed-change mark. Fixed pixels, never scaled: the
   * head says *direction*, and a head that grew with the magnitude would
   * encode the value twice.
   */
  arrowHeadLength: 8,
  /**
   * Arrowhead on a field vector — smaller than a change arrow's, because a
   * field is hundreds of marks and the 8px head fills the plot.
   */
  vectorHeadLength: 6,
  /** Gap between categorical bars, as a fraction of the band. */
  bandPadding: 0.28,
  /**
   * Padding on a POINT scale — lines or dots over discrete categories. Lower
   * than the bar padding because it only has to keep the end marks off the
   * axis, not separate adjacent marks.
   */
  pointPadding: 0.2,
  /**
   * Padding on a BINNED axis — histogram, matrix heatmap, calendar,
   * Marimekko. Zero, and not negotiable: bins partition a continuum, so they
   * must abut. A gap invents a discreteness the data does not have.
   * Separation between bins is `binGap`, which is chrome over the boundary
   * rather than padding in the scale (§3.4.3).
   */
  binPadding: 0,
  /**
   * Paper channel between adjacent histogram bins, in px. One hue abutting
   * itself reads as a single mass — the failure §3.4.1 names for a one-hue
   * treemap — so a bin takes a separator on the same principle as the 1px
   * the stacked bar leaves between segments.
   *
   * FIXED px, not a fraction of the band: `binPadding` stays zero so the
   * band still spans the full bin, and a proportional gap would widen as the
   * bin count fell while the data said nothing.
   *
   * Cut as `binGap / 2` of INSET per side, never as a stroke. A centred
   * paper stroke also runs along the top of the rect and would erase the
   * 1–2px bars in the tail of a skewed distribution — which is the finding.
   *
   * No CSS custom property: unlike `stackGap`, which patch.css needs as a
   * stroke-width, this one is consumed only as a mark option in TypeScript.
   */
  binGap: 1,
  /**
   * Inner radius of a donut as a fraction of the outer — big enough to hold
   * a centred total at the 12px type floor (§3.8).
   */
  donutHoleRatio: 0.6,
  /**
   * Paper gap between adjacent arcs, in px at the outer radius. The same 1px
   * the stacked bar leaves between segments — an arc IS a stacked bar bent
   * round, so the separation rule should not change with the coordinate
   * system.
   */
  arcPadAngle: 1,
  /**
   * The legend mark's box — the side of a square swatch and the diameter of
   * a dot (§3.11). One box for every mark kind so the labels beside them
   * share a baseline no matter what the series is drawn as.
   */
  legendMarkSize: 10,
  /**
   * A line series' legend mark is a RULE, not a square (§3.11), and it has
   * to be long enough to read as a line and to show a dash pattern — 16px
   * holds two cycles of `ruleDash`. Its stroke is the series' own:
   * `lineWidth`, or `lineWidthFocus` where that series is the focus.
   */
  legendRuleLength: 16,
  /**
   * Stroke on the square that stands for a RADAR POLYGON (§3.11) — the
   * polygon has a fill and a stroke, so its miniature carries both.
   * Matches `radarStrokeWidth` less the shrink to 10px. A band takes no
   * stroke at all (§3.4), so this does not apply to one.
   */
  legendBandStrokeWidth: 1.5,
  /** Gap between a legend mark and its label (§3.11). */
  legendMarkGap: 7,
  /**
   * Gap between entries in a horizontal legend. Wide enough that a mark
   * binds to the label on its RIGHT and not to the one before it.
   */
  legendItemGap: 18,
  /**
   * How far an annotation stands off the EDGE of the mark it names —
   * a bubble's radius, a bar's cap, an arrowhead's tip (§3.12).
   *
   * Measured from the rendered edge, never from the mark's anchor point.
   * A fixed offset from the anchor lands inside the mark the moment the
   * radius becomes a size channel, which is exactly what a bubble chart
   * is.
   */
  annotationClearance: 8,
  /**
   * The leader that connects an annotation to its mark when no side is
   * clear (§3.12). 1px in the mark's dark tone, no arrowhead — it is a
   * pointer, not a vector.
   */
  leaderWidth: 1,
} as const;

/**
 * The 0.8 rule is for OVERLAP. Scatter circles use the same 0.8 on fill and
 * stroke so overlapping points darken together into a density signal.
 * Single-layer marks (bars, treemap tiles, choropleths) stay at full opacity —
 * overlap isn't a risk there and lowering opacity just dilutes the color.
 */
export const opacity = {
  /** Scatter circles, overlaid polygons — fill AND stroke together. */
  overlap: 0.8,
  /** Bars, areas, treemap tiles, choropleth polygons, lines. */
  full: 1,
  /** Radar polygon fill — lower, so gridlines and axis labels read through. */
  radarFill: 0.25,
} as const;

// ── Aggregate ───────────────────────────────────────────────────────────────

export const glTokens = {
  ink,
  accent,
  surface,
  categorical,
  muted,
  paletteOrder,
  categoricalMains,
  sequential,
  diverging,
  defaultSequential,
  defaultDiverging,
  family,
  typeRoles,
  geometry,
  opacity,
  minTextSize,
} as const;

export default glTokens;
