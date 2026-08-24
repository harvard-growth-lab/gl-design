/**
 * Distribution charts — boxplot and violin (spec §11).
 *
 * Reach for these when the finding is *the spread of a value across a group* —
 * not one number, not a trend. The construction the spec asks for is a pop-up
 * (§14) applied to a distribution: the whole peer distribution recedes into
 * `c-muted`, and one entity is drawn over it as a saturated `c-1` line so the
 * reader can track that entity against the spread it sits inside. The boxes are
 * context; the line is the finding.
 *
 * A violin is the same chart with a kernel-density silhouette in place of the
 * box — same muted fill, same focus line, same labels.
 *
 * ── Why this file computes its own statistics ───────────────────────────────
 * TanStack ships a `quantile` *reducer* for its transform pipeline, but a box
 * needs five quantiles of the same group at once and a violin needs a density
 * estimate, which the pipeline has no reducer for at all. Both are cheap and
 * both have a right answer (see `glQuantile` and `glDensity`), so they live
 * here rather than being pushed onto every caller.
 *
 * ── Why the category axis is linear, not a band scale ───────────────────────
 * A violin's silhouette varies continuously *within* its category slot, and a
 * band scale can only place a mark at the slot centre — there is no channel for
 * "38% of the way across this band". So categories are laid out on a linear
 * scale at integer positions and every part of the glyph is expressed in slot
 * units. `categoryScale` sizes the domain so the result is pixel-identical to
 * `glAxisBand`'s `scaleBand().padding(1 - width)`; see the proof there. The
 * boxplot uses the same construction so both charts share one geometry.
 */

import { areaX, link, rect } from '@tanstack/charts';
import type { ChartAxisOptions } from '@tanstack/charts';
import { scaleLinear } from '@tanstack/charts-scales/linear';

import { glAxisY, glChart, glTicks, type GLChart } from '../chart.js';
import { MAX_FOCUS, popUp, type GLChannel } from '../compose.js';
import { warn } from '../dev.js';
import { glLabel, glLine, glPoint } from '../marks.js';
import { type GLToneRef } from '../tone.js';
import { geometry, muted, opacity } from '../tokens.js';

/** A category slot's identity. Numbers stay numbers so years can sort. */
export type GLCategoryValue = string | number;

/**
 * The five numbers a GL box is drawn from.
 *
 * Note which five: the whiskers are the **10th and 90th percentiles**, not
 * Tukey's 1.5×IQR fences. That is a deliberate spec choice and it changes what
 * the chart means — a Tukey whisker asks "where do outliers start", a
 * percentile whisker asks "where does the middle 80% of the group live". The
 * spec's charts answer the second question, so nothing here computes fences and
 * nothing plots outlier points.
 */
export interface GLBoxSummary {
  /** 10th percentile — the lower whisker end. */
  p10: number;
  q1: number;
  median: number;
  q3: number;
  /** 90th percentile — the upper whisker end. */
  p90: number;
  /** Observations behind the summary, when known. Used by violin `scale: 'count'`. */
  n?: number;
}

/** Field-or-accessor per summary number, for data that already carries them. */
export interface GLSummaryChannels<T> {
  p10: GLChannel<T>;
  q1: GLChannel<T>;
  median: GLChannel<T>;
  q3: GLChannel<T>;
  p90: GLChannel<T>;
}

/** One point of a focus entity's track across the category axis. */
export interface GLFocusPoint {
  /** Must match one of the box categories, or the point is dropped. */
  category: GLCategoryValue;
  value: number;
}

/**
 * An entity drawn *over* the distribution — the finding half of the pop-up.
 *
 * `label` is the direct end-label, which the spec prefers over a legend
 * wherever the chart has room; it renders in the series' dark tone.
 */
export interface GLFocusSeries {
  label: string;
  points: readonly GLFocusPoint[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Order statistics
// ═══════════════════════════════════════════════════════════════════════════

/** Ascending, finite-only. Every quantile below assumes this shape. */
function sortedFinite(values: Iterable<number>): number[] {
  return [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
}

/**
 * Quantile by linear interpolation between order statistics — R's `type = 7`.
 *
 * That is also `d3.quantile`, numpy's default `percentile`, pandas'
 * `.quantile()` and Excel's `PERCENTILE`. The estimator matters less than the
 * agreement: whoever hands over this data got their Q1 from one of those tools,
 * and a box edge that sits a pixel off the number in their own table costs more
 * trust than a marginally better estimator buys. Type 7 is the one they have.
 *
 * h = (n − 1)·p, then interpolate between the two order statistics straddling h.
 */
function quantileSorted(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return Number.NaN;
  if (n === 1) return sorted[0];
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, n - 1);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

/** `quantileSorted` for callers holding unsorted data. p is a fraction, 0–1. */
export function glQuantile(values: Iterable<number>, p: number): number {
  return quantileSorted(sortedFinite(values), p);
}

/**
 * Summarize raw observations into the five numbers a GL box needs.
 *
 * Returns `undefined` for an empty group rather than a summary of `NaN`s, so a
 * category with no data is dropped from the chart instead of drawing a box at
 * the origin.
 */
export function glSummarize(values: Iterable<number>): GLBoxSummary | undefined {
  const sorted = sortedFinite(values);
  if (!sorted.length) return undefined;
  return {
    p10: quantileSorted(sorted, 0.1),
    q1: quantileSorted(sorted, 0.25),
    median: quantileSorted(sorted, 0.5),
    q3: quantileSorted(sorted, 0.75),
    p90: quantileSorted(sorted, 0.9),
    n: sorted.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Kernel density — the violin's silhouette
// ═══════════════════════════════════════════════════════════════════════════

/** Standard normal density. The kernel; nothing here is tuneable. */
function gaussian(u: number): number {
  return Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
}

/**
 * Bandwidth by Silverman's rule of thumb: h = 0.9 · min(σ, IQR/1.349) · n^(−1/5).
 *
 * This is R's `bw.nrd0`, the default behind `density()` and therefore behind
 * `geom_violin` — so a violin drawn here matches the one the same analyst gets
 * from the sibling `gl-ggplot` theme, which is the whole point of a design
 * system. The `min(σ, IQR/1.349)` term is what makes it survive a skewed or
 * mildly bimodal sample: a long tail inflates σ and would over-smooth the
 * shape away, and the IQR term caps that.
 *
 * Returns 0 when the sample cannot support an estimate (n < 2, or every value
 * identical); callers must treat 0 as "no silhouette".
 */
export function glBandwidth(values: Iterable<number>): number {
  const sorted = sortedFinite(values);
  const n = sorted.length;
  if (n < 2) return 0;
  const mean = sorted.reduce((sum, v) => sum + v, 0) / n;
  const variance = sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(variance);
  const iqr = quantileSorted(sorted, 0.75) - quantileSorted(sorted, 0.25);
  const spread = iqr > 0 ? Math.min(sd, iqr / 1.349) : sd;
  return spread > 0 ? 0.9 * spread * n ** (-1 / 5) : 0;
}

/** One rung of the silhouette: an estimated density at a value. */
export interface GLDensityPoint {
  value: number;
  density: number;
}

export interface GLDensityOptions {
  /** Rungs across the observed range. 64 is smooth at figure scale. */
  samples?: number;
  /** Override Silverman. Only worth it when the shape is known a priori. */
  bandwidth?: number;
}

/**
 * Gaussian kernel density estimate, sampled on a grid across the observed range.
 *
 * **The grid is trimmed to [min, max] of the data** — it does not run the
 * conventional three bandwidths past the ends. An untrimmed silhouette tapers
 * into territory where nothing was ever observed, which on a chart reads as
 * evidence rather than as smoothing; the same reasoning that makes `scaleLog`
 * drop non-positive values instead of clamping them applies here. `geom_violin`
 * calls this `trim = TRUE` and defaults to it for the same reason.
 *
 * The consequence to know: a trimmed estimate integrates to slightly less than
 * 1, so the `'area'` violin scaling below is equal-area up to that trimming.
 */
export function glDensity(
  values: Iterable<number>,
  options: GLDensityOptions = {},
): readonly GLDensityPoint[] {
  const sorted = sortedFinite(values);
  if (sorted.length < 2) return [];
  const h = options.bandwidth ?? glBandwidth(sorted);
  if (!(h > 0)) return [];

  const samples = Math.max(2, Math.round(options.samples ?? 64));
  const lo = sorted[0];
  const hi = sorted[sorted.length - 1];
  const step = (hi - lo) / (samples - 1);

  const points: GLDensityPoint[] = [];
  for (let i = 0; i < samples; i += 1) {
    const value = i === samples - 1 ? hi : lo + step * i;
    points.push({ value, density: densityAt(sorted, value, h) });
  }
  return points;
}

/** The estimate at one value. Split out so the median rule can reuse it. */
function densityAt(sorted: readonly number[], value: number, h: number): number {
  let total = 0;
  for (const observation of sorted) total += gaussian((value - observation) / h);
  return total / (sorted.length * h);
}

// ═══════════════════════════════════════════════════════════════════════════
// Channels
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Read a `GLChannel<T>`.
 *
 * A near-copy of the private `reader` in `compose.ts`. Duplicated rather than
 * exported from there because the accessor's positional signature is part of the
 * public `GLChannel<T>` contract and this file has to honour it exactly; if `compose.ts`
 * ever exports its own, delete this.
 */
function reader<T>(channel: GLChannel<T>): (d: T, i: number, arr: readonly T[]) => unknown {
  if (typeof channel === 'function') return channel;
  return (d) => (d as Record<string, unknown>)[channel as string];
}

/** Read a channel that must yield a finite number, or `undefined`. */
function numberAt<T>(read: ReturnType<typeof reader<T>>, d: T, i: number, all: readonly T[]) {
  const value = Number(read(d, i, all));
  return Number.isFinite(value) ? value : undefined;
}

/** Read a channel that must yield a category identity. Numbers stay numbers. */
function categoryAt<T>(read: ReturnType<typeof reader<T>>, d: T, i: number, all: readonly T[]) {
  const value = read(d, i, all);
  return typeof value === 'number' ? value : String(value);
}

// ═══════════════════════════════════════════════════════════════════════════
// Slot geometry
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Glyph width as a fraction of its category slot.
 *
 * 0.72 is not arbitrary: it is `1 − 0.28`, and 0.28 is the padding `glAxisBand`
 * (in `chart.ts`) gives every bar chart in the library. A boxplot and a bar chart
 * of the same categories therefore land on the same column widths and the same
 * column centres, which matters the moment the two sit on facing pages.
 *
 * The coupling is currently held together by this comment alone — `chart.ts`
 * writes `0.28` and this writes `0.72`. It wants one token
 * (`geometry.bandPadding`) so the two cannot drift; see the refactor report.
 */
const DEFAULT_WIDTH = 0.72;

/**
 * End-cap width as a fraction of the box width. The spec asks for "short"
 * end-caps; half the box is short enough to read as a terminator rather than
 * as a second box edge.
 */
const CAP_FRACTION = 0.5;

/**
 * Gap between a focus mark and its direct end-label. The same 8px `compose.ts`
 * puts between a line end and its label, so a boxplot's focus label and a line
 * chart's sit at the same distance from the mark they name. No token yet — see
 * the refactor report (`geometry.labelGap`).
 */
const LABEL_GAP = 8;

/**
 * The category scale: integer slot positions on a **configured** linear scale.
 *
 * Passing a scale *instance* rather than a factory is load-bearing — TanStack
 * infers a domain from materialized channels only for factories and "retains
 * the configured domain" for instances. Inference would clamp the domain to the
 * outermost glyph edge, putting the first box's left edge flat against the axis
 * line.
 *
 * The domain reproduces `scaleBand().padding(p)` exactly, with p = 1 − width.
 * Span is n + p, so one slot maps to W/(n + p) — d3's `step`. A glyph of
 * `width` slots is then `step·(1 − p)` — d3's `bandwidth`. And slot 0 sits
 * (0.5 + p/2) slots from the domain start, so its left edge lands p·step from
 * the plot edge — d3's outer padding. Same numbers, but reachable at
 * sub-slot resolution, which is what the violin needs.
 */
function categoryScale(count: number, width: number) {
  if (count < 1) return scaleLinear().domain([0, 1]);
  const outer = (1 - width) / 2;
  return scaleLinear().domain([-(0.5 + outer), count - 1 + 0.5 + outer]);
}

/**
 * Category axis. Ticks are pinned to the slot indices and formatted back into
 * the category's own label, so a linear scale reads as a categorical one.
 *
 * No gridlines: the reader estimates values off the Y axis here, and the spec
 * forbids both axes carrying gridlines unless the chart is genuinely dense.
 * `offset: 'auto'` for the same reason `chart.ts` pins it — it is the only
 * setting that measures the axis-label gap from the tick label rather than from
 * the axis line, and a numeric offset (even the spec's literal 20) selects the
 * wrong reference point and drives the label into the tick labels. The value is
 * restated here because `chart.ts` keeps `AXIS_LABEL_OFFSET` private; exporting
 * it would remove this copy (see the refactor report).
 */
function categoryAxis(
  categories: readonly GLCategoryValue[],
  width: number,
  label?: string,
  format?: (value: GLCategoryValue) => string,
): ChartAxisOptions<number> {
  const render = format ?? ((value: GLCategoryValue) => String(value));
  return {
    scale: categoryScale(categories.length, width),
    grid: false,
    axis: {
      line: true,
      ...(label ? { label: { text: label, offset: 'auto' as const } } : {}),
      ticks: {
        ...glTicks,
        values: categories.map((_, index) => index),
        format: (index: number) => {
          const value = categories[index];
          return value === undefined ? '' : render(value);
        },
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Options
// ═══════════════════════════════════════════════════════════════════════════

export interface GLDistributionOptions<T> {
  /** The slot each row belongs to — the categorical axis. */
  category: GLChannel<T>;
  /**
   * Raw observations, one row per observation. The library computes the
   * summary (and, for a violin, the density).
   *
   * Supply this **or** `summary`, never both. Real callers have both shapes:
   * an analyst hands over a long table of observations, a data team hands over
   * a table that has already been reduced.
   */
  value?: GLChannel<T>;
  /**
   * Pre-computed summaries, one row per category. Either a channel yielding a
   * whole `GLBoxSummary` (`summary: (d) => d.stats`) or a map of one channel
   * per number (`summary: { p10: 'p10', q1: 'q1', … }`).
   */
  summary?: GLChannel<T> | GLSummaryChannels<T>;
  /** The entity dimension. Required to use `highlight`. */
  series?: GLChannel<T>;
  /**
   * Entity to lift out of the distribution and draw over it. Its own rows leave
   * the boxes — the box is "the peers", the line is the entity being compared
   * against them. Sugar over `focus` for the common case where the focus
   * entity's observations sit in the same table; needs `series` and `value`.
   */
  highlight?: string | readonly string[];
  /**
   * Focus series supplied outright, for a focus entity that lives in its own
   * table — which is always the case once `summary` is used, since a summary
   * row has no entity to lift out.
   */
  focus?: readonly GLFocusSeries[];
  /**
   * Pin the slot order, and with it which categories get a slot at all. Without
   * it, numeric categories sort ascending (years, deciles, income bands are
   * ordered by construction) and everything else keeps first-appearance order.
   */
  categories?: readonly GLCategoryValue[];
  categoryLabel?: string;
  categoryFormat?: (value: GLCategoryValue) => string;
  valueLabel?: string;
  valueFormat?: (value: number) => string;
  /** Direct end-labels on the focus lines. On whenever there is a focus series. */
  endLabels?: boolean;
  /** Markers at each focus observation. On by default — the spec's Figure 6 has them. */
  focusPoints?: boolean;
  /** Glyph width as a fraction of its slot. Defaults to 0.72; see `DEFAULT_WIDTH`. */
  width?: number;
}

/**
 * Focus tones for a distribution chart — and the one place this file departs
 * from `FOCUS_TONES` in `compose.ts`.
 *
 * Everywhere else a second highlighted series takes `c-2`. §11 names it
 * explicitly for this chart type instead: "Second series — `c-muted` at the
 * same opacity, stacked *under* the focus series", with peer end-labels in
 * `c-muted-dark`. So the second entity here is a *peer*, not a co-finding: one
 * saturated line, everything else recessive.
 *
 * Worth knowing when you use it: a `c-muted` line over `c-muted-light` boxes is
 * a low-contrast pairing by design. It is legible because the line is 2px solid
 * over a flat fill and carries a dark-tone label, but it will not survive being
 * printed small. If the second entity is genuinely part of the finding, the
 * chart wants two panels, not two lines.
 */
const DISTRIBUTION_FOCUS_TONES: readonly GLToneRef[] = ['c-1', 'muted'];

// ═══════════════════════════════════════════════════════════════════════════
// Resolving the data
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Slot order. Numeric categories sort; string categories keep the order the
 * reader first meets them, because nothing else about a string implies one.
 */
function categoryOrder(
  values: readonly GLCategoryValue[],
  pinned?: readonly GLCategoryValue[],
): GLCategoryValue[] {
  if (pinned?.length) return [...pinned];
  const seen = new Set<GLCategoryValue>();
  const order: GLCategoryValue[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    order.push(value);
  }
  return order.every((value) => typeof value === 'number')
    ? (order as number[]).sort((a, b) => a - b)
    : order;
}

/** Observations per category, for the paths that need the raw sample. */
function groupObservations<T>(
  rows: readonly T[],
  category: GLChannel<T>,
  value: GLChannel<T>,
): Map<GLCategoryValue, number[]> {
  const readCategory = reader(category);
  const readValue = reader(value);
  const groups = new Map<GLCategoryValue, number[]>();
  rows.forEach((row, index) => {
    const observation = numberAt(readValue, row, index, rows);
    if (observation === undefined) return;
    const key = categoryAt(readCategory, row, index, rows);
    const bucket = groups.get(key);
    if (bucket) bucket.push(observation);
    else groups.set(key, [observation]);
  });
  return groups;
}

/** Every number present and finite, or the summary is not a summary. */
function coerceSummary(raw: unknown): GLBoxSummary | undefined {
  if (raw == null || typeof raw !== 'object') return undefined;
  const source = raw as Record<string, unknown>;
  const numbers = (['p10', 'q1', 'median', 'q3', 'p90'] as const).map((key) => Number(source[key]));
  if (!numbers.every((value) => Number.isFinite(value))) return undefined;
  const [p10, q1, median, q3, p90] = numbers;
  const n = Number(source.n);
  return { p10, q1, median, q3, p90, ...(Number.isFinite(n) ? { n } : {}) };
}

/** Pre-computed summaries, from either accepted shape. */
function readSummaries<T>(
  rows: readonly T[],
  category: GLChannel<T>,
  summary: GLChannel<T> | GLSummaryChannels<T>,
): Map<GLCategoryValue, GLBoxSummary> {
  const readCategory = reader(category);
  const perRow: (row: T, index: number) => unknown =
    typeof summary === 'string' || typeof summary === 'function'
      ? (row, index) => reader(summary as GLChannel<T>)(row, index, rows)
      : (row, index) => {
          const channels = summary as GLSummaryChannels<T>;
          return {
            p10: reader(channels.p10)(row, index, rows),
            q1: reader(channels.q1)(row, index, rows),
            median: reader(channels.median)(row, index, rows),
            q3: reader(channels.q3)(row, index, rows),
            p90: reader(channels.p90)(row, index, rows),
          };
        };

  const summaries = new Map<GLCategoryValue, GLBoxSummary>();
  rows.forEach((row, index) => {
    const resolved = coerceSummary(perRow(row, index));
    if (!resolved) return;
    summaries.set(categoryAt(readCategory, row, index, rows), resolved);
  });
  return summaries;
}

/**
 * Split the table into the distribution and the entities drawn over it.
 *
 * `popUp` does the partition — the same one every other pop-up in the library
 * uses — and the focus rows are then flattened into category/value pairs. The
 * highlighted entity's own observations do **not** stay in the boxes: the box is
 * the peer group, and leaving the focus entity inside it would have the reader
 * compare a line against a distribution that contains it.
 *
 * Only `popUp`'s partition is used, not its tones: §11 gives this chart type its
 * own second tone (see `DISTRIBUTION_FOCUS_TONES`), so `series.tone` is
 * deliberately dropped on the way through.
 */
function resolveFocus<T>(
  rows: readonly T[],
  o: GLDistributionOptions<T>,
): { backdrop: readonly T[]; focus: GLFocusSeries[] } {
  const explicit = [...(o.focus ?? [])];

  if (o.highlight == null) return { backdrop: rows, focus: explicit };

  if (!o.series || !o.value) {
    warn(
      '`highlight` needs both `series` and `value` — it lifts one entity out of ' +
        'the observations, and a table of pre-computed summaries has no entity to lift. ' +
        'Pass the focus entity as `focus: [{ label, points }]` instead.',
    );
    return { backdrop: rows, focus: explicit };
  }

  const readCategory = reader(o.category);
  const readValue = reader(o.value);
  const split = popUp(rows, { by: o.series, highlight: o.highlight });

  const derived = split.focus
    .filter(({ rows: sub }) => sub.length > 0)
    .map(({ key, rows: sub }) => {
      const seen = new Set<GLCategoryValue>();
      let duplicated = false;
      const points: GLFocusPoint[] = [];
      sub.forEach((row, index) => {
        const value = numberAt(readValue, row, index, sub);
        if (value === undefined) return;
        const category = categoryAt(readCategory, row, index, sub);
        duplicated ||= seen.has(category);
        seen.add(category);
        points.push({ category, value });
      });
      if (duplicated) {
        warn(
          `"${key}" has more than one observation in a category slot. The focus line ` +
            'tracks one entity through one value per slot; extra points will draw as ' +
            'vertical jumps. Aggregate before charting, or give the entity its own axis.',
        );
      }
      return { label: key, points };
    });

  return { backdrop: split.backdrop, focus: [...derived, ...explicit] };
}

/** A box or violin, resolved onto its slot. */
interface Glyph {
  /** Slot index — the x position, in slot units. */
  index: number;
  category: GLCategoryValue;
  summary: GLBoxSummary;
  /** Raw observations, when the caller supplied them. Empty on the summary path. */
  observations: readonly number[];
}

/** A focus entity's track, resolved onto slots and ordered along the axis. */
interface FocusTrack {
  label: string;
  tone: GLToneRef;
  /** The `c-1` series carrying the finding. Exactly one track has it. */
  lead: boolean;
  points: { index: number; value: number; label: string }[];
}

/**
 * Everything both charts need, resolved once: the slots, the glyphs sitting in
 * them, and the focus tracks laid over them.
 */
function resolveDistribution<T>(data: readonly T[], o: GLDistributionOptions<T>) {
  const rows = [...data];
  const hasValue = o.value != null;
  const hasSummary = o.summary != null;

  if (hasValue && hasSummary) {
    warn(
      'Both `value` and `summary` were given. `value` wins — a summary computed ' +
        'from the observations in front of it cannot disagree with them.',
    );
  } else if (!hasValue && !hasSummary) {
    warn('A distribution chart needs either `value` (observations) or `summary`.');
  }

  const { backdrop, focus } = resolveFocus(rows, o);

  const observations = hasValue
    ? groupObservations(backdrop, o.category, o.value as GLChannel<T>)
    : new Map<GLCategoryValue, number[]>();
  const summaries = hasValue
    ? new Map<GLCategoryValue, GLBoxSummary>()
    : hasSummary
      ? readSummaries(backdrop, o.category, o.summary as GLChannel<T> | GLSummaryChannels<T>)
      : new Map<GLCategoryValue, GLBoxSummary>();

  const present: GLCategoryValue[] = hasValue ? [...observations.keys()] : [...summaries.keys()];
  const categories = categoryOrder(present, o.categories);
  const slots = new Map(categories.map((category, index) => [category, index]));

  const glyphs: Glyph[] = [];
  categories.forEach((category, index) => {
    const sample = observations.get(category) ?? [];
    const summary = hasValue ? glSummarize(sample) : summaries.get(category);
    if (!summary) return;
    glyphs.push({ index, category, summary, observations: sample });
  });

  const tracks: FocusTrack[] = focus.slice(0, MAX_FOCUS).map((series, order) => ({
    label: series.label,
    tone: DISTRIBUTION_FOCUS_TONES[order] ?? 'muted',
    lead: order === 0,
    points: series.points
      .flatMap(({ category, value }) => {
        const index = slots.get(category);
        if (index === undefined || !Number.isFinite(value)) return [];
        return [{ index, value, label: series.label }];
      })
      .sort((a, b) => a.index - b.index),
  }));

  if (focus.length > MAX_FOCUS) {
    warn(
      `${focus.length} focus series were given; a pop-up carries one or two. ` +
        `Drawing the first ${MAX_FOCUS}.`,
    );
  }

  return { categories, glyphs, tracks };
}

// ═══════════════════════════════════════════════════════════════════════════
// Marks
// ═══════════════════════════════════════════════════════════════════════════

/** One straight segment in slot/value space. */
interface Segment {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

/**
 * Whiskers and their end-caps, as one mark.
 *
 * `link` is the primitive here rather than `ruleX`/`ruleY`, and that is forced:
 * TanStack's rules carry only a single position channel (`RuleYOptions` has `y`,
 * no `y1`/`y2`), so a rule spans the entire plot. A whisker is an interval, and
 * `link` is the only mark that draws one.
 *
 * `lineCap: 'butt'` because link defaults to round, and a round cap on a 1px
 * stroke pushes the whisker half a pixel past the percentile it marks.
 */
function whiskerMark(glyphs: readonly Glyph[], width: number) {
  const cap = (width * CAP_FRACTION) / 2;
  const segments: Segment[] = [];
  for (const { index, summary } of glyphs) {
    // Two stems, not one p10→p90 stem behind an opaque box: the box is drawn at
    // full opacity today, but a chart whose whisker only exists because
    // something else covers it is one option away from being wrong.
    segments.push({ x1: index, x2: index, y1: summary.p10, y2: summary.q1 });
    segments.push({ x1: index, x2: index, y1: summary.q3, y2: summary.p90 });
    segments.push({ x1: index - cap, x2: index + cap, y1: summary.p10, y2: summary.p10 });
    segments.push({ x1: index - cap, x2: index + cap, y1: summary.p90, y2: summary.p90 });
  }
  return link(segments, {
    x1: 'x1',
    x2: 'x2',
    y1: 'y1',
    y2: 'y2',
    // The whisker belongs to the box's outline, so it takes the box's stroke.
    // The median is the one part of the glyph the spec singles out as darker
    // and heavier, and that only reads as emphasis if nothing else shares it.
    stroke: muted.main,
    strokeWidth: geometry.axisWidth,
    lineCap: 'butt',
  });
}

/**
 * The median rule — `c-muted-dark` at 1.5px, the heaviest ink in the glyph.
 *
 * `spans` gives each rule its own half-width so a violin can size the rule to
 * the silhouette at the median rather than to a box that isn't there.
 */
function medianMark(glyphs: readonly Glyph[], spans: readonly number[]) {
  const segments: Segment[] = glyphs.map(({ index, summary }, i) => ({
    x1: index - (spans[i] ?? 0),
    x2: index + (spans[i] ?? 0),
    y1: summary.median,
    y2: summary.median,
  }));
  return link(segments, {
    x1: 'x1',
    x2: 'x2',
    y1: 'y1',
    y2: 'y2',
    stroke: muted.dark,
    strokeWidth: geometry.medianWidth,
    lineCap: 'butt',
  });
}

/**
 * The box itself — `c-muted-light` fill, `c-muted` 1px stroke, spanning Q1–Q3.
 *
 * `inset: 0` matters: `rect` insets by 0.75px by default, which would shave the
 * box off the slot geometry the median and caps are computed from. The same
 * correction `glTile` makes for treemap tiles, for the same reason.
 *
 * `RectOptions.fill` is a plain string, not a channel, so every box in the mark
 * is one colour — which is exactly the spec's intent. A box that varies by
 * category would be colour used as decoration (Decision Rule 7).
 */
function boxMark(glyphs: readonly Glyph[], width: number) {
  const half = width / 2;
  return rect(glyphs, {
    x1: (d: Glyph) => d.index - half,
    x2: (d: Glyph) => d.index + half,
    y1: (d: Glyph) => d.summary.q1,
    y2: (d: Glyph) => d.summary.q3,
    fill: muted.light,
    fillOpacity: opacity.full,
    stroke: muted.main,
    strokeWidth: geometry.axisWidth,
    inset: 0,
  });
}

/**
 * The focus overlay: line, then markers, then the direct end-label — pushed in
 * that order so the label sits over everything and the line over the boxes.
 *
 * The 0.8 opacity on the markers is the overlap rule, and it is load-bearing
 * here: focus markers land on top of the box they are being compared against,
 * and matching fill and stroke opacity is what lets that overlap darken instead
 * of one layer punching a hole through the other.
 */
function focusMarks(track: FocusTrack, wantsLabel: boolean, wantsPoints: boolean): unknown[] {
  if (!track.points.length) return [];
  const marks: unknown[] = [
    // Only the lead series is a *focus* line. §11 gives 2.4px to "the focus
    // line"; a second, muted series is a supporting line and takes the ordinary
    // 2px, exactly as §7 mutes the supporting lines of a line chart. Drawing a
    // peer at focus weight would put two lines at the same weight and leave
    // hue as the only thing separating finding from context.
    glLine(track.points, { x: 'index', y: 'value', tone: track.tone, focus: track.lead }),
  ];
  if (wantsPoints) {
    marks.push(
      glPoint(track.points, {
        x: 'index',
        y: 'value',
        tone: track.tone,
        // §11 pins the focus marker at r 5, the bottom of the 5–7px scatter
        // range — these markers sit on a busy glyph, and the scatter default of
        // 6 starts covering the box edges it is meant to be read against.
        r: geometry.pointRadiusMin,
      }),
    );
  }
  if (wantsLabel) {
    const last = track.points[track.points.length - 1];
    marks.push(
      glLabel([last], {
        x: 'index',
        y: 'value',
        text: 'label',
        tone: track.tone,
        anchor: 'start',
        dx: LABEL_GAP,
      }),
    );
  }
  return marks;
}

/**
 * Assemble the chart once the marks are built. Shared by both shapes, which is
 * also why the variant decision below is made once.
 *
 * **`variant: { labelHalo: true }`.** A direct end-label on a focus track is
 * anchored at the entity's own last value and offset `LABEL_GAP` to the right —
 * so whether it lands on paper or on top of a box is decided by the data, not by
 * the chart. An entity in the middle of its peer distribution puts its label
 * straight across the `c-muted-light` box; an entity below the peers puts it on
 * paper. That is exactly the unpredictable background §3's paper halo exists for,
 * and it is the case the treemap explicitly does *not* have (one known flat
 * fill). The halo costs nothing when the label does land on paper — a paper
 * stroke on paper is invisible — so it is set unconditionally rather than
 * guessed at per figure.
 *
 * `endLabels` (not a margin) is what widens the right side: the label runs
 * outward from the last slot and needs the gutter `glMarginEndLabels` reserves.
 * Passing the flag rather than the margin keeps one owner for that number.
 */
function defineDistribution<T>(
  o: GLDistributionOptions<T>,
  categories: readonly GLCategoryValue[],
  width: number,
  marks: unknown[],
  wantsLabels: boolean,
): GLChart<T, number, number> {
  // `<T, number, number>`, not `<T, ChartValue, ChartValue>`: both scales here are
  // genuinely numeric — x is the slot INDEX (see `categoryScale`) and y is the
  // value axis — and stating that is what lets the axis options type-check
  // without a cast. It was a cast before only because the old return type
  // widened both to `ChartValue`.
  return glChart<T, number, number>({
    marks,
    x: categoryAxis(categories, width, o.categoryLabel, o.categoryFormat),
    // Gridlines stay on Y and only on Y. The reader's whole job on this chart
    // is reading a spread off the value axis.
    y: glAxisY({ label: o.valueLabel, format: o.valueFormat }),
    endLabels: wantsLabels,
    variant: { labelHalo: true },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Boxplot
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Boxplot — the spread of a value across a group.
 *
 * Box spans the interquartile range; whiskers reach the 10th and 90th
 * percentiles with short end-caps; the median is the one dark rule. All of it
 * in `c-muted`, because the distribution is context. Then `highlight` (or
 * `focus`) lifts one entity out and draws it over the boxes in `c-1` at 2.4px
 * with 0.8-opacity markers and a dark-tone end-label — the reader tracks that
 * one line against the spread it came from.
 *
 * ```ts
 * // Figure 6: one country against its regional peers, from a long table.
 * glBoxplotChart(rows, {
 *   category: 'year',
 *   value: 'gdpPerCapita',
 *   series: 'country',
 *   highlight: 'Pakistan',
 *   valueLabel: 'GDP per capita (constant 2015 USD)',
 * });
 *
 * // The same chart from summaries someone else computed.
 * glBoxplotChart(summaries, {
 *   category: 'year',
 *   summary: { p10: 'p10', q1: 'q1', median: 'median', q3: 'q3', p90: 'p90' },
 *   focus: [{ label: 'Pakistan', points: pakistan }],
 * });
 * ```
 *
 * Returns `{ definition, className, props }` — `defineDistribution` sets the
 * `labelHalo` variant for both distribution shapes, and its comment says why.
 */
export function glBoxplotChart<T>(
  data: readonly T[],
  o: GLDistributionOptions<T>,
): GLChart<T, number, number> {
  const width = o.width ?? DEFAULT_WIDTH;
  const { categories, glyphs, tracks } = resolveDistribution(data, o);
  const wantsLabels = tracks.length > 0 && (o.endLabels ?? true);

  const marks: unknown[] = [];
  if (glyphs.length) {
    marks.push(whiskerMark(glyphs, width));
    marks.push(boxMark(glyphs, width));
    marks.push(medianMark(glyphs, glyphs.map(() => width / 2)));
  }
  // Focus last, so it draws over the boxes. `tracks` runs c-1 first, the muted
  // peer second — but marks paint in array order, so the loop runs backwards to
  // put the peer down first. §11: "second series … stacked *under* the focus
  // series". Iterating forwards would bury the finding under its own backdrop.
  for (const track of [...tracks].reverse()) {
    marks.push(...focusMarks(track, wantsLabels, o.focusPoints ?? true));
  }

  return defineDistribution(o, categories, width, marks, wantsLabels);
}

// ═══════════════════════════════════════════════════════════════════════════
// Violin
// ═══════════════════════════════════════════════════════════════════════════

/**
 * How the silhouettes are scaled against each other. ggplot's `geom_violin`
 * vocabulary, deliberately — the same analyst uses both libraries.
 *
 *   `area`  — every violin holds the same area. The default, and the honest
 *             one: width then reads as density, so a tight distribution is
 *             genuinely fatter than a diffuse one.
 *   `width` — every violin peaks at the full slot width. Compares *shape* and
 *             throws away density magnitude. Use when group sizes are wildly
 *             uneven and the shapes are the finding.
 *   `count` — area proportional to n. Use when the reader must not forget that
 *             one group has forty observations and another has four.
 */
export type GLViolinScale = 'area' | 'width' | 'count';

export interface GLViolinChartOptions<T> extends GLDistributionOptions<T> {
  /** Defaults to `'area'`. */
  scale?: GLViolinScale;
  /** KDE grid resolution. Defaults to 64. */
  samples?: number;
  /** Override Silverman's bandwidth. Same units as the value axis. */
  bandwidth?: number;
  /** The median rule inside the silhouette. On by default. */
  median?: boolean;
  /**
   * 10th–90th whiskers inside the silhouette. **Off** by default — the
   * silhouette already reaches both tails, so a whisker over it re-encodes what
   * the shape has already said. Turn it on for a box-and-violin hybrid where
   * the percentiles have to be readable to the pixel.
   */
  whiskers?: boolean;
}

/** A rung of one silhouette, already placed in slot/value space. */
interface ViolinSample {
  category: GLCategoryValue;
  value: number;
  left: number;
  right: number;
}

/**
 * Density per glyph, plus the multiplier that turns density into slot half-width.
 *
 * The three scalings differ only in what the multiplier is normalized against,
 * which is why they are one function: `'width'` normalizes per glyph, `'area'`
 * once across every glyph (equal multiplier ⇒ equal area, since each estimate
 * integrates to 1), and `'count'` weights each estimate by n first.
 */
function violinShapes(
  glyphs: readonly Glyph[],
  width: number,
  scale: GLViolinScale,
  options: GLDensityOptions,
) {
  const half = width / 2;
  const curves = glyphs.map((glyph) => {
    const density = glDensity(glyph.observations, options);
    const weight = scale === 'count' ? (glyph.summary.n ?? glyph.observations.length) : 1;
    return { glyph, density, weight, peak: Math.max(0, ...density.map((d) => d.density)) };
  });

  const globalPeak = Math.max(0, ...curves.map((c) => c.peak * c.weight));

  return curves.map((curve) => {
    // `'width'` divides each curve by its own peak, so every silhouette fills
    // the slot. The other two divide by the widest curve in the chart, which is
    // what keeps their widths comparable across categories.
    const divisor = scale === 'width' ? curve.peak * curve.weight : globalPeak;
    const factor = divisor > 0 ? half / divisor : 0;
    return { ...curve, factor: factor * curve.weight };
  });
}

/**
 * Violin — a boxplot whose box is replaced by a density silhouette.
 *
 * Everything else is unchanged: same muted palette, same focus line over the
 * top, same labels. Needs raw observations; a density cannot be recovered from
 * five numbers, so `summary` alone falls back to drawing boxes and says so.
 *
 * ```ts
 * glViolinChart(rows, {
 *   category: 'region',
 *   value: 'complexity',
 *   series: 'country',
 *   highlight: 'Pakistan',
 *   valueLabel: 'Economic Complexity Index',
 * });
 * ```
 */
export function glViolinChart<T>(
  data: readonly T[],
  o: GLViolinChartOptions<T>,
): GLChart<T, number, number> {
  // Checked before anything is resolved, so the fallback does the work once.
  if (o.value == null) {
    warn(
      'A violin needs raw observations — a density silhouette cannot be recovered ' +
        'from a five-number summary. Falling back to boxes; pass `value`, or call ' +
        '`glBoxplotChart` and mean it.',
    );
    return glBoxplotChart(data, o);
  }

  const width = o.width ?? DEFAULT_WIDTH;
  const { categories, glyphs, tracks } = resolveDistribution(data, o);
  const wantsLabels = tracks.length > 0 && (o.endLabels ?? true);

  const densityOptions: GLDensityOptions = {
    ...(o.samples != null ? { samples: o.samples } : {}),
    ...(o.bandwidth != null ? { bandwidth: o.bandwidth } : {}),
  };
  const shapes = violinShapes(glyphs, width, o.scale ?? 'area', densityOptions);

  const samples: ViolinSample[] = [];
  const drawn: Glyph[] = [];
  const medianSpans: number[] = [];
  for (const { glyph, density, factor } of shapes) {
    if (!density.length || factor <= 0) {
      warn(
        `Category "${String(glyph.category)}" has no estimable density — fewer than two ` +
          'distinct observations. Its slot is left empty rather than drawn as a spike.',
      );
      continue;
    }
    for (const { value, density: d } of density) {
      const spread = d * factor;
      samples.push({
        category: glyph.category,
        value,
        left: glyph.index - spread,
        right: glyph.index + spread,
      });
    }
    drawn.push(glyph);
    // Size the median rule to the silhouette *at the median* rather than to the
    // full slot, so it stops at the outline instead of poking through it.
    const bandwidth = o.bandwidth ?? glBandwidth(glyph.observations);
    const sorted = [...glyph.observations].sort((a, b) => a - b);
    medianSpans.push(
      bandwidth > 0 ? densityAt(sorted, glyph.summary.median, bandwidth) * factor : 0,
    );
  }

  const marks: unknown[] = [];
  if (o.whiskers && drawn.length) marks.push(whiskerMark(drawn, width));
  if (samples.length) {
    marks.push(
      areaX(samples, {
        y: 'value',
        x1: 'left',
        x2: 'right',
        // One area per category. Without `z` every silhouette would be welded
        // into a single ribbon running across the whole plot.
        z: 'category',
        fill: muted.light,
        // areaX defaults to 0.2. The spec gives the silhouette the same flat
        // `c-muted-light` as a box, and a translucent one would read as a
        // second, paler category wherever violins nearly touch.
        fillOpacity: opacity.full,
        stroke: muted.main,
        strokeWidth: geometry.axisWidth,
      }),
    );
  }
  if ((o.median ?? true) && drawn.length) marks.push(medianMark(drawn, medianSpans));

  for (const track of [...tracks].reverse()) {
    marks.push(...focusMarks(track, wantsLabels, o.focusPoints ?? true));
  }

  return defineDistribution(o, categories, width, marks, wantsLabels);
}
