/**
 * GL-defaulted marks.
 *
 * TanStack ships marks with generic defaults — a dot is r 3.5, a line is
 * strokeWidth 2.25, an area fills at 0.2 opacity, a rect insets 0.75px. The GL
 * spec pins all of that: 0.8 on scatter fill AND stroke, 2px lines rising to
 * 2.4px for the focus series, areas and bars at full opacity, dark tones for
 * strokes and text and never for fills. The defaults are applied so a caller has
 * to opt *out* of the spec rather than remember to opt in.
 *
 * The shape of this module is the point. There is ONE defaults table
 * (`DEFAULTS`) and ONE applier (`glDefaults`); the exported `gl*` wrappers are
 * two lines each and exist only to name the vocabulary. So:
 *
 *   - a mark this package never wrapped can still be built on-spec, because the
 *     table is reachable directly: `dot(data, glDefaults('point', { x, y }))`
 *   - each value appears once, so it cannot drift between two wrappers
 *
 * Caller options are spread first, so any TanStack option stays reachable —
 * except the handful the spec pins outright (the opacities, the label type),
 * which the table writes last and deliberately wins on. Those are also `Omit`-ed
 * from the option types, so a conflict is a compile error rather than a
 * silently ignored argument.
 */

import {
  areaX,
  areaY,
  arrow,
  bandX,
  bandY,
  barX,
  barY,
  cell,
  dot,
  lineY,
  link,
  rect,
  ruleX,
  ruleY,
  text,
  tickX,
  tickY,
  vector,
} from '@tanstack/charts';
import type {
  Channel,
  ChartValue,
  AreaXOptions,
  AreaYOptions,
  ArrowOptions,
  BandXOptions,
  BandYOptions,
  BarXOptions,
  BarYOptions,
  CellOptions,
  DotOptions,
  LineYOptions,
  LinkOptions,
  RectOptions,
  RuleXOptions,
  RuleYOptions,
  TextOptions,
  TickXOptions,
  TickYOptions,
  VectorOptions,
} from '@tanstack/charts';

import { geometry, ink, opacity, typeRoles, type GLTone } from './tokens.js';
import { resolveTone, type GLToneRef, type GLToneStep } from './tone.js';

// Re-exported because every consumer of a mark also needs to name a tone, and
// `tone.ts` is an implementation detail of the palette rather than a second
// import every caller has to remember.
export { resolveTone };
export type { GLToneRef, GLToneStep };

/**
 * The mark vocabulary the spec pins defaults for.
 *
 * This list IS the coverage boundary. A TanStack mark whose spec question is
 * answered by one of these kinds can be built on-spec through `glDefaults`
 * whether or not this package wraps it; a mark whose question is *different in
 * kind* needs a new entry here, not the nearest-looking existing one. Reaching
 * for `'line'` to paint a reference rule was the standing bug that
 * `'rule'` exists to close — see the chrome/data split in `SPEC.md` §3.4.2.
 */
export type GLMarkKind =
  | 'line'
  | 'point'
  | 'area'
  | 'bar'
  // §3.4.3 — a bar whose category is a bin. Bar paint plus the paper channel.
  | 'binBar'
  | 'tile'
  | 'region'
  | 'label'
  | 'annotation'
  // §3.4.2 — chrome. Never carries a series hue.
  | 'rule'
  // §3.4.2 — data. Same geometry as chrome, opposite job.
  | 'stem'
  | 'connector'
  | 'tick'
  | 'arrow'
  | 'vector'
  // §3.12 — an annotation's tether. Chrome geometry, the series' own tone.
  | 'leader'
  // §3.9 — a value's qualification, drawn behind it.
  | 'band';

/** The GL-only options the wrappers understand, on top of TanStack's own. */
export interface GLToneOptions {
  /** Which palette hue. Defaults to c-1, the single-series default. */
  tone?: GLToneRef;
  /**
   * Which step of the triple paints the mark. A stacked chart built from one hue
   * runs light → main → dark bottom-to-top; that three-tone stack is the only
   * place in the spec where the dark tone is used as a fill.
   */
  step?: GLToneStep;
  /** The series carrying the finding — renders at 2.4px instead of 2px. */
  focus?: boolean;
}

type AnyOptions = Record<string, any>;

interface PaintContext {
  tone: GLTone;
  step: GLToneStep;
  /** A `color` channel is present, so the chart-level scale owns the paint. */
  hasColor: boolean;
  focus: boolean;
}

/**
 * Decide a mark's paint.
 *
 * A `color` channel routes paint through the chart-level color scale, which is
 * what assigns the palette in order across series. Setting `fill` or `stroke`
 * **bypasses that scale entirely** — so when a color channel is present we must
 * leave the paint undefined and let the scale do its job. Pinning it would
 * silently collapse every series onto one hue.
 */
function paint(
  explicit: string | undefined,
  hasColorChannel: boolean,
  fallback: string,
): string | undefined {
  if (explicit != null) return explicit;
  return hasColorChannel ? undefined : fallback;
}

/**
 * Wrap a bare number as a channel accessor.
 *
 * TanStack channels are a field name or a function; a raw number is neither,
 * and a mark given one emits **no nodes at all** — no error, no warning, just a
 * missing mark. That is how a lollipop whose stems silently vanished got this
 * far, so anywhere a GL wrapper accepts a constant where TanStack wants a
 * channel, it goes through here.
 */
function constantChannel(value: unknown): unknown {
  return typeof value === 'number' ? () => value : value;
}

/**
 * Bar paint, shared by `bar` and `binBar` — the tone step at FULL opacity, no
 * stroke. Extracted only so the binned entry can add the §3.4.3 channel without
 * restating the fill; the two must never drift apart on colour.
 */
const barPaint = (o: AnyOptions, c: PaintContext): AnyOptions => ({
  fill: paint(o.fill, c.hasColor, c.tone[c.step]),
  fillOpacity: opacity.full,
});

/**
 * The spec's mark defaults — one entry per mark kind, and the only place these
 * values appear.
 *
 * Each entry returns just the properties the spec decides. A property written
 * `o.x ?? default` is caller-overridable; a property written flat is pinned and
 * wins over the caller.
 */
const DEFAULTS: Record<GLMarkKind, (o: AnyOptions, c: PaintContext) => AnyOptions> = {
  /**
   * Line — main tone at full opacity, 2px, solid. The spec allows dashed lines
   * only for projections, so reach for `strokeDasharray` deliberately and only
   * for that.
   */
  line: (o, c) => ({
    stroke: paint(o.stroke, c.hasColor, c.tone.main),
    strokeWidth: o.strokeWidth ?? (c.focus ? geometry.lineWidthFocus : geometry.lineWidth),
  }),

  /**
   * Scatter circle — the only mark that reduces fill opacity.
   *
   * Fill is the main tone at 0.8 and the stroke is the DARK tone at the *same*
   * 0.8. Matching the two is the whole point: overlapping points then darken
   * together into a density signal instead of one layer punching through the
   * other. Overlap here is desirable — it shows clustering.
   */
  point: (o, c) => ({
    r: o.r ?? geometry.pointRadius,
    fill: paint(o.fill, c.hasColor, c.tone.main),
    fillOpacity: opacity.overlap,
    // With a color channel the stroke can't be per-series (DotOptions.stroke is
    // a plain string, not a channel), so it falls back to the dark ink rather
    // than silently painting every series' stroke one series' dark tone.
    stroke: paint(o.stroke, c.hasColor, c.tone.dark) ?? ink[2],
    strokeOpacity: opacity.overlap,
    strokeWidth: geometry.pointStrokeWidth,
  }),

  /**
   * Area band — the tone step at FULL opacity, no stroke.
   *
   * TanStack defaults areas to `fill-opacity: 0.2`, which the spec does not want
   * anywhere: areas are single-layer marks in a stack, so reducing opacity only
   * dilutes the color. Stacked bands sit edge-to-edge with no gap — the tone
   * step is what separates them.
   */
  area: (o, c) => ({
    fill: paint(o.fill, c.hasColor, c.tone[c.step]),
    fillOpacity: opacity.full,
  }),

  /**
   * Bar — the tone step at FULL opacity, no stroke. Bars are single-layer marks,
   * so the 0.8 overlap rule does not apply.
   *
   * A *stacked* bar wants a 1px gap between segments. `barY` exposes no stroke
   * option and its `inset` trims width rather than height, so the gap is cut in
   * CSS: pass `variant: { stacked: true }` to `glChart`.
   *
   * A BINNED bar wants a 1px gap too, for a different reason and by a different
   * device — see `binBar` below.
   */
  bar: barPaint,

  /**
   * Binned bar — bar paint plus the `binGap` paper channel of §3.4.3. One hue
   * abutting itself reads as a single mass, the same failure §3.4.1 names for a
   * one-hue treemap, so a histogram's bins take a separator.
   *
   * `inset`, never a stroke, and never band padding:
   *
   * - A centred `paper` stroke — what the stacked bar uses, because `barY`
   *   exposes no stroke option and CSS is the only way in — also runs along the
   *   TOP of the rect. That erases the 1–2px bars in the tail of a skewed
   *   distribution, which in economic data is usually the finding.
   * - Band padding would take width from the bin itself. `binPadding` stays
   *   zero so the band still spans the full bin, and a proportional gap would
   *   widen as the bin count fell while the data said nothing.
   *
   * Half the channel per side; the neighbouring bin contributes the other half.
   */
  binBar: (o, c) => ({
    ...barPaint(o, c),
    inset: o.inset ?? geometry.binGap / 2,
  }),

  /**
   * Treemap tile / heatmap cell — the tone step at FULL opacity, no stroke at
   * any depth. Tiles are separated by a paper gutter the layout computes, never
   * by a stroke (`SPEC.md` §3.4.1).
   *
   * The spec PDF's treemap page asks for 0.8 opacity and a dark stroke; that
   * page contradicts both its own marks page and Decision Rule 3, and
   * `grammar.md` resolves it to full opacity with no stroke. See
   * `docs/data-vis-spec-core.md` §0.
   */
  tile: (o, c) => ({
    fill: paint(o.fill, c.hasColor, c.tone[c.step]),
    fillOpacity: opacity.full,
    // TanStack insets rects by 0.75px by default. Tile separation is the
    // layout's gutter, which is measured in data space and already exact — an
    // additional render-time inset would make it uneven.
    inset: o.inset ?? 0,
  }),

  /** Choropleth-style fill for a pre-projected region. Thin ink-3 border. */
  region: (o, c) => ({
    fill: paint(o.fill, c.hasColor, c.tone[c.step]),
    fillOpacity: opacity.full,
    stroke: o.stroke ?? ink[3],
    strokeWidth: o.strokeWidth ?? geometry.mapStrokeWidth,
    inset: o.inset ?? 0,
  }),

  /**
   * Direct series label — Inter 12/600 in the series' DARK tone, never its main
   * tone, which fails WCAG AA against paper (Decision Rule 2).
   *
   * Prefer these over a legend wherever the chart allows it: a label at the end
   * of the line costs the reader nothing, a legend costs them a lookup.
   *
   * A label that sits *over* data rather than beside it also needs a paper halo.
   * TanStack's text mark has no halo option, so either place labels in the
   * margin (what the composed recipes do) or pass `variant: { labelHalo: true }`
   * to `glChart`.
   */
  label: (o, c) => ({
    fill: paint(o.fill, c.hasColor, c.tone.dark),
    fontSize: typeRoles.seriesLabel.size,
    fontWeight: typeRoles.seriesLabel.weight,
  }),

  /** Annotation text — Inter 12/400/ink-2. Use sparingly. */
  annotation: (o) => ({
    fill: o.fill ?? ink[2],
    fontSize: typeRoles.annotation.size,
    fontWeight: typeRoles.annotation.weight,
  }),

  // ── §3.4.2: chrome ────────────────────────────────────────────────────────

  /**
   * Reference rule — a threshold, target, identity or 45° line. CHROME, so it
   * takes `ink-3` at gridline weight and a dash, and it **ignores `tone`
   * entirely**: §3.4.2 forbids a categorical hue here.
   *
   * The reason is not fussiness. Painting a threshold in `c-1` spends the
   * institutional blue on something that is not a finding, and the reader then
   * has to work out that this blue line means something different from the
   * other blue line. The dash is what says "not a measurement" — which only
   * works because §3.4 keeps every data line solid.
   *
   * A ZERO baseline is the exception the spec already carved out (§3.5: "render
   * with axis weight"): use `variant: { zeroBaseline: true }` on `glChart`
   * rather than this mark.
   */
  rule: (o) => ({
    stroke: o.stroke ?? ink[3],
    strokeWidth: o.strokeWidth ?? geometry.gridlineWidth,
    strokeDasharray: o.strokeDasharray ?? geometry.ruleDash,
  }),

  // ── §3.4.2: data marks that share chrome's geometry ───────────────────────

  /**
   * Lollipop stem, drop line, dumbbell spine drawn as a rule. It IS the series,
   * so it takes the main tone at the line's own 2px — identical to `line`, and
   * separate from it only so the call site says which job it is doing.
   */
  stem: (o, c) => ({
    stroke: paint(o.stroke, c.hasColor, c.tone.main),
    strokeWidth: o.strokeWidth ?? (c.focus ? geometry.lineWidthFocus : geometry.lineWidth),
  }),

  /**
   * Connector — a dumbbell bar, a candlestick wick, a boxplot whisker, a Sankey
   * link. It joins two marks of one series, which makes it a stroke on an
   * assembled glyph rather than a series line of its own, so §3.3 gives it the
   * DARK tone.
   *
   * `lineCap: 'butt'` so the connector stops exactly at the endpoint it names —
   * a round cap overshoots by half the stroke width, which reads as extra
   * magnitude on a dumbbell and as a fatter wick on a candlestick.
   */
  connector: (o, c) => ({
    stroke: paint(o.stroke, c.hasColor, c.tone.dark),
    strokeWidth: o.strokeWidth ?? geometry.lineWidth,
    lineCap: o.lineCap ?? 'butt',
  }),

  /**
   * Data tick — an error-bar cap or a rug tick. Dark tone (it caps a
   * connector, so it matches it), 1px, and 8px long: TWICE the axis tick, so a
   * tick that carries a value cannot be mistaken for axis chrome.
   */
  tick: (o, c) => ({
    stroke: paint(o.stroke, c.hasColor, c.tone.dark),
    strokeWidth: o.strokeWidth ?? geometry.tickWidth,
    length: o.length ?? geometry.dataTickLength,
  }),

  /**
   * Leader — the hairline that tethers an annotation to the mark it names when
   * no side of that mark has 8px of open plot to put the text in (§3.12).
   *
   * A leader is NOT an arrow, and the difference is the whole reason it is its
   * own kind. An arrow encodes direction — it is a measurement, and §3.4.2
   * gives it line weight and a head for that reason. A leader encodes nothing;
   * it only says "this text belongs to that mark". So it takes the thinnest
   * weight in the system and no head, and it stays in the mark's own DARK tone
   * rather than `ink-3`, because unlike a threshold rule it *is* tied to one
   * series and has to say which.
   */
  leader: (o, c) => ({
    stroke: paint(o.stroke, c.hasColor, c.tone.dark),
    strokeWidth: o.strokeWidth ?? geometry.leaderWidth,
    lineCap: o.lineCap ?? 'butt',
  }),

  /**
   * Directed-change arrow. Line weight and the main tone — it is a series line
   * that happens to know which end it started at.
   *
   * The head is fixed pixels and pinned: a head that grew with the magnitude
   * would encode the value a second time, and the reader would have no way to
   * know which encoding to trust.
   */
  arrow: (o, c) => ({
    stroke: paint(o.stroke, c.hasColor, c.tone.main),
    strokeWidth: o.strokeWidth ?? (c.focus ? geometry.lineWidthFocus : geometry.lineWidth),
    headLength: geometry.arrowHeadLength,
  }),

  /**
   * Field vector — wind, flow, gradient. Chrome WEIGHT (1px) with a data TONE,
   * which looks like a contradiction and isn't: a field is hundreds of marks,
   * and at 2px with an 8px head they merge into a solid mass. The tone still
   * says whose field it is.
   */
  vector: (o, c) => ({
    stroke: paint(o.stroke, c.hasColor, c.tone.main),
    strokeWidth: o.strokeWidth ?? geometry.tickWidth,
    headLength: geometry.vectorHeadLength,
  }),

  // ── §3.9: uncertainty ─────────────────────────────────────────────────────

  /**
   * Band — a confidence interval, a percentile fan, a Bollinger envelope, a
   * focus region. The LIGHT tone at full opacity, no stroke.
   *
   * The light tone rather than a translucent main is the whole rule (§3.3
   * already assigns light to backgrounds; an interval is the background of its
   * own series). A translucent fill produces a different colour over every mark
   * it crosses, so two bands at the same confidence level stop looking alike —
   * and it vanishes in greyscale, where a lightness step survives.
   *
   * Draw it BEFORE the line it qualifies. Marks paint in array order, and a
   * band listed after its line covers it.
   */
  band: (o, c) => ({
    fill: paint(o.fill, c.hasColor, c.tone[c.step]),
    fillOpacity: opacity.full,
  }),
};

/**
 * Kinds whose default tone step is not `main`.
 *
 * A band defaults to LIGHT because §3.9 says an interval is the background of
 * its own series. Passing `step` explicitly still wins — nested fans sometimes
 * want the same light tone twice and let the overlap do the darkening.
 */
const DEFAULT_STEP: Partial<Record<GLMarkKind, GLToneStep>> = {
  band: 'light',
};

/**
 * Merge the GL defaults for `kind` into an options bag.
 *
 * This is the escape hatch, and the reason the wrappers below are thin: any
 * TanStack mark — including ones this package never wrapped — can be built
 * on-spec by routing its options through here.
 *
 *   import { dot } from '@tanstack/charts';
 *   dot(data, glDefaults('point', { x: 'gdp', y: 'eci', tone: 'c-3' }));
 *
 * The GL-only keys (`tone`, `step`, `focus`) are consumed here and never reach
 * TanStack.
 */
export function glDefaults<O extends AnyOptions>(kind: GLMarkKind, options?: O): O {
  const {
    tone,
    step = DEFAULT_STEP[kind] ?? 'main',
    focus = false,
    ...rest
  } = (options ?? {}) as AnyOptions & GLToneOptions;

  const context: PaintContext = {
    tone: resolveTone(tone),
    step,
    hasColor: rest.color != null,
    focus,
  };

  return { ...rest, ...DEFAULTS[kind](rest, context) } as O;
}

// ── The vocabulary ──────────────────────────────────────────────────────────
// Two lines each, on purpose. The values live in DEFAULTS; these give the marks
// their GL names and their GL option types.

export interface GLLineOptions<T> extends Omit<LineYOptions<T>, 'strokeWidth'> {
  tone?: GLToneRef;
  /** The series carrying the finding — 2.4px instead of 2px. */
  focus?: boolean;
  strokeWidth?: number;
}

export function glLine<T>(data: Iterable<T>, options: GLLineOptions<T> = {}) {
  return lineY(data, glDefaults('line', options) as LineYOptions<T>);
}

/**
 * The backdrop layer of the pop-up effect: every supporting series in c-muted,
 * carrying the trend while the focus series carries the finding.
 */
export function glMutedLine<T>(
  data: Iterable<T>,
  options: Omit<GLLineOptions<T>, 'tone' | 'focus'> = {},
) {
  return glLine(data, { ...options, tone: 'muted', focus: false });
}

export interface GLPointOptions<T>
  extends Omit<DotOptions<T>, 'fillOpacity' | 'strokeOpacity' | 'strokeWidth'> {
  tone?: GLToneRef;
}

export function glPoint<T>(data: Iterable<T>, options: GLPointOptions<T> = {}) {
  return dot(data, glDefaults('point', options) as DotOptions<T>);
}

/** The muted cloud behind a highlighted scatter point. */
export function glMutedPoint<T>(
  data: Iterable<T>,
  options: Omit<GLPointOptions<T>, 'tone'> = {},
) {
  return glPoint(data, { ...options, tone: 'muted' });
}

export interface GLAreaOptions<T> extends Omit<AreaYOptions<T>, 'fillOpacity'> {
  tone?: GLToneRef;
  step?: GLToneStep;
}

export function glArea<T>(data: Iterable<T>, options: GLAreaOptions<T> = {}) {
  return areaY(data, glDefaults('area', options) as AreaYOptions<T>);
}

export interface GLBarOptions<T> extends Omit<BarYOptions<T>, 'fillOpacity'> {
  tone?: GLToneRef;
  /**
   * Two categories sharing a parent (goods vs. services) should be one hue at
   * main + light rather than two unrelated colors — the shared hue keeps the bar
   * reading as one total while lightness carries the split.
   */
  step?: GLToneStep;
}

export function glBar<T>(data: Iterable<T>, options: GLBarOptions<T> = {}) {
  return barY(data, glDefaults('bar', options) as BarYOptions<T>);
}

/** The "everyone else" bars behind a single highlighted bar in a ranked list. */
export function glMutedBar<T>(
  data: Iterable<T>,
  options: Omit<GLBarOptions<T>, 'tone' | 'step'> = {},
) {
  return glBar(data, { ...options, tone: 'muted' });
}

/**
 * A histogram bin. The mark that pairs with `glAxisBin`, exactly as `glBar`
 * pairs with `glAxisBand`.
 *
 * The only difference is the `binGap` paper channel (`SPEC.md` §3.4.3), and
 * the reasoning for it — inset, not stroke, not padding — is on the `binBar`
 * entry in the defaults table.
 *
 * This is a separate mark rather than a `variant` on `glChart` like `stacked`
 * because the channel is cut in the mark's own options; `stacked` has to go
 * through CSS only because `barY` exposes no stroke.
 */
export function glBinBar<T>(data: Iterable<T>, options: GLBarOptions<T> = {}) {
  return barY(data, glDefaults('binBar', options) as BarYOptions<T>);
}

export interface GLTileOptions<T> extends Omit<RectOptions<T>, 'fillOpacity'> {
  tone?: GLToneRef;
  step?: GLToneStep;
}

export function glTile<T>(data: Iterable<T>, options: GLTileOptions<T> = {}) {
  return rect(data, glDefaults('tile', options) as RectOptions<T>);
}

export function glRegion<T>(data: Iterable<T>, options: GLTileOptions<T> = {}) {
  return rect(data, glDefaults('region', options) as RectOptions<T>);
}

export interface GLLabelOptions<T> extends Omit<TextOptions<T>, 'fontSize' | 'fontWeight'> {
  /**
   * The series this label names. The label renders in that series' DARK tone —
   * never its main tone, which fails WCAG AA against paper (Decision Rule 2).
   */
  tone?: GLToneRef;
}

export function glLabel<T>(data: Iterable<T>, options: GLLabelOptions<T> = {}) {
  return text(data, glDefaults('label', options) as TextOptions<T>);
}

export function glAnnotation<T>(
  data: Iterable<T>,
  options: Omit<TextOptions<T>, 'fontSize' | 'fontWeight'> = {},
) {
  return text(data, glDefaults('annotation', options) as TextOptions<T>);
}

// ── Horizontal orientations ─────────────────────────────────────────────────
// A ranked list with long category names belongs on a horizontal axis — the
// labels read left-to-right instead of rotated. Same defaults table: the bar
// and area entries decide fill and opacity, which are orientation-agnostic.

export interface GLBarXOptions<T> extends Omit<BarXOptions<T>, 'fillOpacity'> {
  tone?: GLToneRef;
  step?: GLToneStep;
}

export function glBarX<T>(data: Iterable<T>, options: GLBarXOptions<T> = {}) {
  return barX(data, glDefaults('bar', options) as BarXOptions<T>);
}

/** The "everyone else" bars behind a single highlighted bar in a ranked list. */
export function glMutedBarX<T>(
  data: Iterable<T>,
  options: Omit<GLBarXOptions<T>, 'tone' | 'step'> = {},
) {
  return glBarX(data, { ...options, tone: 'muted' });
}

/**
 * A histogram bin drawn sideways — the marginal beside a scatter, a binned
 * ranking. See `glBinBar` for why the §3.4.3 channel is an inset and not a
 * stroke; `inset` trims the categorical edges whichever way the bar points, so
 * here it spends itself on height and leaves the encoded length alone.
 */
export function glBinBarX<T>(data: Iterable<T>, options: GLBarXOptions<T> = {}) {
  return barX(data, glDefaults('binBar', options) as BarXOptions<T>);
}

export interface GLAreaXOptions<T> extends Omit<AreaXOptions<T>, 'fillOpacity'> {
  tone?: GLToneRef;
  step?: GLToneStep;
}

export function glAreaX<T>(data: Iterable<T>, options: GLAreaXOptions<T> = {}) {
  return areaX(data, glDefaults('area', options) as AreaXOptions<T>);
}

// ── Binned marks: a cell is a tile, not a point ─────────────────────────────
// The single most load-bearing line in this section. A heatmap cell and a
// hexbin are SINGLE-LAYER marks — they tile the plane and never overlap — so
// they take the treemap tile's full opacity, not the scatter point's 0.8. The
// 0.8 exists so overlapping points darken into a density signal; applied to
// marks that cannot overlap it only dilutes them against paper.

export interface GLCellOptions<T> extends Omit<CellOptions<T>, 'fillOpacity'> {
  tone?: GLToneRef;
  step?: GLToneStep;
}

/** Matrix heatmap / calendar cell. Pair with `glAxisBin` on both axes. */
export function glCell<T>(data: Iterable<T>, options: GLCellOptions<T> = {}) {
  return cell(data, glDefaults('tile', options) as CellOptions<T>);
}

/**
 * Hexagonally binned density — `glHexbin` — is in `hexbin.ts`, not here.
 *
 * It is the one binned mark that cannot be two lines over a TanStack mark. A
 * cell knows its own extent because the scale gives it a bandwidth; a hexagon
 * is drawn at a fixed PIXEL radius, which has no connection to the lattice the
 * caller binned on, so the two agree only when the caller has guessed the plot's
 * inner size correctly. That module owns the lattice and the mark together so
 * they cannot disagree — it still paints through `glDefaults('tile', …)`, so the
 * note above holds for it too.
 */

// ── §3.4.2 — chrome ─────────────────────────────────────────────────────────

export interface GLRuleOptions {
  /** Override the dash. The spec's reason for having one is in the `rule` entry. */
  strokeDasharray?: string;
  strokeWidth?: number;
  stroke?: string;
}

/**
 * A vertical reference rule at each `x` — a threshold, an event date, a target.
 *
 * Takes no `tone`: §3.4.2 makes a reference line chrome, and chrome never
 * carries a series hue. If the line you are drawing *is* a value, you want
 * `glStemX`.
 */
export function glRuleX<T>(data: Iterable<T>, options: RuleXOptions<T> & GLRuleOptions = {}) {
  return ruleX(data, glDefaults('rule', options) as RuleXOptions<T>);
}

/** A horizontal reference rule at each `y`. See `glRuleX`. */
export function glRuleY<T>(data: Iterable<T>, options: RuleYOptions<T> & GLRuleOptions = {}) {
  return ruleY(data, glDefaults('rule', options) as RuleYOptions<T>);
}

// ── §3.4.2 — data marks sharing chrome's geometry ───────────────────────────

export interface GLStemOptions<T> {
  tone?: GLToneRef;
  focus?: boolean;
  strokeWidth?: number;
  /** Where the stem starts. Defaults to zero — a lollipop hangs off the axis. */
  from?: number | Channel<T, number | null | undefined>;
}

/**
 * Lollipop stem / drop line rising from a baseline to each value.
 *
 * **Built on `link`, not `ruleX`, and that is not a style choice.** TanStack's
 * rules ignore their endpoint channels and always span the whole plot — see
 * `tests/constraints.test.ts` §7, which fails the day that changes. A rule is
 * therefore the right mark for CHROME (a threshold *should* cross the plot) and
 * cannot express a stem at all, so the chrome/data split of §3.4.2 happens to
 * land on two different TanStack marks.
 *
 *   glStemX(rows, { x: 'country', y: 'exports' })   // baseline → value
 *   glPoint(rows, { x: 'country', y: 'exports' })   // the head
 */
export function glStemX<T>(
  data: Iterable<T>,
  options: { x: Channel<T, ChartValue | null | undefined>; y: Channel<T, number | null | undefined> } & GLStemOptions<T> &
    Omit<LinkOptions<T>, 'x1' | 'x2' | 'y1' | 'y2'>,
) {
  const { x, y, from = 0, ...rest } = options as AnyOptions;
  return link(
    data,
    glDefaults('stem', { ...rest, x1: x, x2: x, y1: constantChannel(from), y2: y }) as LinkOptions<T>,
  );
}

/** Lollipop stem / drop line running from a baseline out to each value. */
export function glStemY<T>(
  data: Iterable<T>,
  options: { y: Channel<T, ChartValue | null | undefined>; x: Channel<T, number | null | undefined> } & GLStemOptions<T> &
    Omit<LinkOptions<T>, 'x1' | 'x2' | 'y1' | 'y2'>,
) {
  const { x, y, from = 0, ...rest } = options as AnyOptions;
  return link(
    data,
    glDefaults('stem', { ...rest, y1: y, y2: y, x1: constantChannel(from), x2: x }) as LinkOptions<T>,
  );
}

export interface GLLinkOptions<T> extends Omit<LinkOptions<T>, 'strokeOpacity'> {
  tone?: GLToneRef;
}

/**
 * Connector between two points — a dumbbell bar, a candlestick wick, a boxplot
 * whisker, a Sankey link. Dark tone, butt cap; see the `connector` entry.
 */
export function glLink<T>(data: Iterable<T>, options: GLLinkOptions<T>) {
  return link(data, glDefaults('connector', options) as LinkOptions<T>);
}

/**
 * Tether from a mark's edge to an annotation that could not sit beside it
 * (§3.12). 1px, the series' dark tone, no head — see the `leader` entry.
 *
 * List it BEFORE the label in the marks array so the label's paper halo paints
 * over the leader's end rather than the other way round.
 */
export function glLeader<T>(data: Iterable<T>, options: GLLinkOptions<T>) {
  return link(data, glDefaults('leader', options) as LinkOptions<T>);
}

export interface GLTickOptions {
  tone?: GLToneRef;
  length?: number;
  strokeWidth?: number;
}

/**
 * A tick is named for the AXIS IT BELONGS TO, not the direction it draws — and
 * the two are perpendicular. `glTickX` draws a **vertical** 8px stroke, so it is
 * a rug tick along the x axis, or the cap on a *horizontal* interval.
 *
 * For the cap on a vertical error bar or candle — `glLink` with `y1`/`y2` — you
 * want `glTickY`. A `glTickX` there is collinear with the whisker and silently
 * lengthens the interval by 4px at each end instead of terminating it.
 *
 * 8px — twice the axis tick, so §3.4.2 cannot read it as chrome.
 */
export function glTickX<T>(data: Iterable<T>, options: TickXOptions<T> & GLTickOptions) {
  return tickX(data, glDefaults('tick', options) as TickXOptions<T>);
}

/**
 * A **horizontal** 8px stroke: a rug tick along the y axis, or the cap on a
 * *vertical* error bar, candle or interval. See `glTickX` for why the names run
 * perpendicular to the strokes.
 */
export function glTickY<T>(data: Iterable<T>, options: TickYOptions<T> & GLTickOptions) {
  return tickY(data, glDefaults('tick', options) as TickYOptions<T>);
}

export interface GLArrowOptions<T> extends Omit<ArrowOptions<T>, 'headLength'> {
  tone?: GLToneRef;
  focus?: boolean;
}

/** Directed change from (x1,y1) to (x2,y2). Fixed 8px head — never scaled. */
export function glArrow<T>(data: Iterable<T>, options: GLArrowOptions<T>) {
  return arrow(data, glDefaults('arrow', options) as ArrowOptions<T>);
}

export interface GLVectorOptions<T> extends Omit<VectorOptions<T>, 'headLength'> {
  tone?: GLToneRef;
}

/** Field vector — 1px so a dense field stays readable. See the `vector` entry. */
export function glVector<T>(data: Iterable<T>, options: GLVectorOptions<T>) {
  return vector(data, glDefaults('vector', options) as VectorOptions<T>);
}

// ── §3.9 — uncertainty ──────────────────────────────────────────────────────

export interface GLBandOptions<T> extends Omit<AreaYOptions<T>, 'fillOpacity'> {
  tone?: GLToneRef;
  /** Defaults to `light`. Pass `light` again for the inner band of a nested fan. */
  step?: GLToneStep;
}

/**
 * An uncertainty ribbon between `y1` and `y2` — a confidence interval, a
 * percentile fan, a Bollinger envelope.
 *
 * This is `areaY` with the band defaults, not a distinct TanStack mark: a
 * ribbon is an area with two data-driven edges. **List it before the line it
 * qualifies** — marks paint in array order.
 */
export function glBand<T>(data: Iterable<T>, options: GLBandOptions<T> = {}) {
  return areaY(data, glDefaults('band', options) as AreaYOptions<T>);
}

export interface GLBandRegionOptions<T> extends Omit<BandXOptions<T>, 'fillOpacity'> {
  tone?: GLToneRef;
  step?: GLToneStep;
}

/** A shaded vertical region spanning `x1`–`x2` — a recession, a focus window. */
export function glBandX<T>(data: Iterable<T>, options: GLBandRegionOptions<T> = {}) {
  return bandX(data, glDefaults('band', options) as BandXOptions<T>);
}

/** A shaded horizontal region spanning `y1`–`y2` — a target range, a tolerance. */
export function glBandY<T>(
  data: Iterable<T>,
  options: Omit<BandYOptions<T>, 'fillOpacity'> & { tone?: GLToneRef; step?: GLToneStep } = {},
) {
  return bandY(data, glDefaults('band', options) as BandYOptions<T>);
}
