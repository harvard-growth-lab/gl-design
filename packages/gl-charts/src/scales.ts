/**
 * Scales the GL spec needs that TanStack does not ship.
 *
 * `@tanstack/charts-scales` provides band, linear, ordinal and point. Two gaps
 * follow from that:
 *
 *   - **Position.** The spec's two scatter plots both put income on a log axis,
 *     so a log scale has to come from somewhere; this is that somewhere.
 *   - **Color.** Sequential and diverging ramps (§12, §13) encode an ordered
 *     value as fill. They cannot be applied per-datum, because `RectOptions.fill`
 *     and `DotOptions.fill` are plain strings in TanStack rather than channels —
 *     an ordered encoding *must* route through the chart-level color scale.
 *
 * The position contract is TanStack's `InferableScaleLike`: a callable that maps
 * a domain value into range pixels, plus `domain`/`range`/`copy` and the optional
 * `ticks`/`tickFormat` hooks the axis renderer uses. `domain()` with no argument
 * reads; `domain(values)` infers from materialized mark channels and returns the
 * scale. The color contract is `ConfiguredColorScaleLike` — callable plus
 * `copy()`, with optional `domain()`/`range()`.
 */

import type { ConfiguredColorScaleLike } from '@tanstack/charts';

import { warn } from './dev.js';
import {
  defaultDiverging,
  defaultSequential,
  diverging,
  sequential,
  type GLDivergingKey,
  type GLSequentialKey,
} from './tokens.js';

/** Mantissas of a 1–2–5 log axis. The conventional set; d3 uses the same. */
const MANTISSAS = [1, 2, 5] as const;

/** Round `value` down to the nearest 1–2–5 step at or below it. */
function floorNice(value: number): number {
  const exponent = Math.floor(Math.log10(value));
  const decade = 10 ** exponent;
  const mantissa = value / decade;
  const step = [...MANTISSAS].reverse().find((m) => m <= mantissa + 1e-9) ?? 1;
  return step * decade;
}

/** Round `value` up to the nearest 1–2–5 step at or above it. */
function ceilNice(value: number): number {
  const exponent = Math.floor(Math.log10(value));
  const decade = 10 ** exponent;
  const mantissa = value / decade;
  const step = MANTISSAS.find((m) => m >= mantissa - 1e-9);
  return step ? step * decade : 10 * decade;
}

/**
 * 1–2–5 ticks inside a log domain, thinned to decades when that would be too
 * dense to read. A log axis with fifteen labels is worse than one with five.
 */
function logTicks([lo, hi]: readonly [number, number], count: number): number[] {
  const ticks: number[] = [];
  for (let exponent = Math.floor(Math.log10(lo)); exponent <= Math.ceil(Math.log10(hi)); exponent += 1) {
    for (const mantissa of MANTISSAS) {
      const value = mantissa * 10 ** exponent;
      if (value >= lo * (1 - 1e-9) && value <= hi * (1 + 1e-9)) ticks.push(value);
    }
  }
  // Thin only when the 1–2–5 set is genuinely crowded. Falling back to decades
  // too eagerly is its own failure: a two-decade axis labelled 1k / 10k / 100k
  // leaves the reader nothing to place 30k against.
  if (ticks.length <= Math.max(count, 8)) return ticks;
  const decades = ticks.filter((v) => Math.abs(Math.log10(v) - Math.round(Math.log10(v))) < 1e-9);
  return decades.length >= 2 ? decades : ticks;
}

/**
 * Compact tick label — `1k`, `20k`, `1.5M`. Log axes span orders of magnitude,
 * so full digits would be the widest thing on the axis and force the plot in.
 */
export function formatLogTick(value: number): string {
  const abs = Math.abs(value);
  const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  if (abs >= 1e9) return `${trim(value / 1e9)}B`;
  if (abs >= 1e6) return `${trim(value / 1e6)}M`;
  if (abs >= 1000) return `${trim(value / 1000)}k`;
  return trim(value);
}

export interface GLLogScale {
  (value: number): number | undefined;
  domain: {
    (): readonly number[];
    (values: Iterable<number>): GLLogScale;
  };
  range: (values: Iterable<number>) => GLLogScale;
  copy: () => GLLogScale;
  ticks: (count: number) => readonly number[];
  tickFormat: (count: number) => (value: number) => string;
}

/**
 * Base-10 log scale.
 *
 * Pass the factory itself to an axis (`{ scale: scaleLog }`) and TanStack infers
 * the domain from the data. Inference **rounds outward to 1–2–5 bounds** — a log
 * axis that starts at 1,950 rather than 1,000 reads as an error, and there is no
 * separate `nice` hook in the scale contract to do it later.
 *
 * Non-positive values have no log and map to `undefined`, which TanStack drops.
 * That is deliberate: silently clamping a zero to the axis minimum would invent
 * a data point.
 */
export function scaleLog(): GLLogScale {
  let domain: [number, number] = [1, 10];
  let range: [number, number] = [0, 1];

  const scale = ((value: number) => {
    if (!Number.isFinite(value) || value <= 0) return undefined;
    const lo = Math.log10(domain[0]);
    const hi = Math.log10(domain[1]);
    if (hi === lo) return range[0];
    return range[0] + ((Math.log10(value) - lo) / (hi - lo)) * (range[1] - range[0]);
  }) as GLLogScale;

  scale.domain = ((values?: Iterable<number>) => {
    if (values === undefined) return domain;
    const positive = [...values].filter((v) => Number.isFinite(v) && v > 0);
    if (positive.length) {
      domain = [floorNice(Math.min(...positive)), ceilNice(Math.max(...positive))];
    }
    return scale;
  }) as GLLogScale['domain'];

  scale.range = (values) => {
    const [start, end] = [...values];
    range = [start, end];
    return scale;
  };

  scale.copy = () => scaleLog().domain(domain).range(range);
  scale.ticks = (count) => logTicks(domain, count || 6);
  scale.tickFormat = () => formatLogTick;

  return scale;
}

// ── Year ticks ──────────────────────────────────────────────────────────────

/** Steps a reader accepts on a year axis. No 7-year or 13-year intervals. */
const YEAR_STEPS = [1, 2, 3, 4, 5, 10, 20, 25, 50] as const;

/**
 * Tick values for a year axis, pinned to both endpoints.
 *
 * D3's generic nicening rounds to 5s and 10s, which on a 2003–2024 series yields
 * 2005/2010/2015/2020 — neither of the years the subtitle names. Every worked
 * example in the spec labels its first and last year, because those are the
 * years the reader is being asked to compare.
 *
 * The step is whichever value in `YEAR_STEPS` scores best on two things: how
 * close it lands to `target` ticks, and whether it divides the span exactly. A
 * step that divides evenly is worth a couple of ticks of slack, because the
 * alternative is a final gap of a different width from every other gap — which
 * reads as a mistake even when the labels are all correct.
 */
export function yearTicks(years: Iterable<number>, target = 6): number[] {
  const all = [...years].filter(Number.isFinite);
  if (!all.length) return [];

  const first = Math.min(...all);
  const last = Math.max(...all);
  if (first === last) return [first];

  const span = last - first;
  const IRREGULAR_GAP_PENALTY = 2;
  const score = (candidate: number) =>
    Math.abs(Math.floor(span / candidate) + 1 - target) +
    (span % candidate === 0 ? 0 : IRREGULAR_GAP_PENALTY);

  const step = YEAR_STEPS.reduce(
    (best, candidate) => (score(candidate) < score(best) ? candidate : best),
    YEAR_STEPS[0],
  );

  const ticks: number[] = [];
  for (let year = first; year < last; year += step) ticks.push(year);

  // The last year is mandatory. Drop the tick before it if they would collide.
  if (ticks.length && last - ticks[ticks.length - 1] < step * 0.6) ticks.pop();
  ticks.push(last);

  return ticks;
}

// ── Dates ───────────────────────────────────────────────────────────────────

const DAY = 86_400_000;
const MONTH = DAY * 30.44;
const YEAR = DAY * 365.25;

/** Epoch ms from a `Date`, a number, or a parseable date string. */
export function toEpoch(value: Date | number | string): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return new Date(value).getTime();
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * The unit a span of dates should be labelled in (`grammar.md` §3.5).
 *
 * Above ~5 years the year alone carries it; above ~6 months the month and year
 * do; below that the reader needs the day. Repeating "2024" on every tick of a
 * six-week span is noise, and dropping it from a six-year span is ambiguous.
 *
 * The month boundary is where it is because of what the day branch can express,
 * not by taste: `dateTicks` steps days by at most 28, so a span much past six
 * months produces a tick every four weeks — twenty of them on an eighteen-month
 * series, against a target of six. Six months at a 28-day step is the last span
 * that lands on a readable number of ticks.
 */
export function dateTickUnit(spanMs: number): 'year' | 'month' | 'day' {
  if (spanMs > YEAR * 5) return 'year';
  if (spanMs > MONTH * 6) return 'month';
  return 'day';
}

/**
 * Format one epoch-ms tick. The unit is derived from the full set of tick
 * values, so every tick on an axis is labelled at the same granularity — a
 * per-tick decision would give one axis "2020" next to "Mar 2020".
 *
 * UTC throughout. A chart whose ticks shift by a day depending on the reader's
 * timezone is not reproducible, and these are calendar dates, not instants.
 */
export function formatDateTick(value: number, allTicks?: readonly number[]): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  const finite = (allTicks ?? []).filter(Number.isFinite);
  const span = finite.length > 1 ? Math.max(...finite) - Math.min(...finite) : YEAR * 6;

  switch (dateTickUnit(span)) {
    case 'year':
      return String(d.getUTCFullYear());
    case 'month':
      return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    default:
      return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  }
}

/**
 * Tick values for a date axis, pinned to both endpoints — the same rule
 * `yearTicks` applies, for the same reason: the reader is being asked to
 * compare the ends of the span, so the ends must be labelled.
 *
 * Steps are calendar-aware at the year and month scale (a "year" step lands on
 * 1 January, not 365.25 days after the first observation) and a plain day
 * multiple below that, where months are not a useful grid.
 */
export function dateTicks(dates: Iterable<Date | number | string>, target = 6): number[] {
  const all = [...dates].map(toEpoch).filter(Number.isFinite);
  if (!all.length) return [];

  const first = Math.min(...all);
  const last = Math.max(...all);
  if (first === last) return [first];

  const span = last - first;
  const unit = dateTickUnit(span);
  const ticks: number[] = [first];

  if (unit === 'day') {
    // Round the interval to a readable number of days rather than span/target,
    // which produces ticks 11 and 23 days apart.
    const DAY_STEPS = [1, 2, 7, 14, 28];
    const raw = span / DAY / Math.max(1, target - 1);
    const step =
      DAY_STEPS.reduce((best, c) => (Math.abs(c - raw) < Math.abs(best - raw) ? c : best), 1) * DAY;
    for (let t = first + step; t < last; t += step) ticks.push(t);
  } else {
    const startYear = new Date(first).getUTCFullYear();
    const monthsSpan = unit === 'year' ? span / YEAR : span / MONTH;
    const STEPS = unit === 'year' ? [1, 2, 5, 10, 25] : [1, 2, 3, 6, 12];
    const raw = monthsSpan / Math.max(1, target - 1);
    const step = STEPS.reduce((best, c) => (Math.abs(c - raw) < Math.abs(best - raw) ? c : best), 1);

    if (unit === 'year') {
      for (let y = Math.ceil(startYear / step) * step; ; y += step) {
        const t = Date.UTC(y, 0, 1);
        if (t >= last) break;
        if (t > first) ticks.push(t);
      }
    } else {
      const start = new Date(first);
      for (let m = step; ; m += step) {
        const t = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + m, 1);
        if (t >= last) break;
        ticks.push(t);
      }
    }
  }

  // The last date is mandatory. Drop the tick before it if they would collide —
  // same 0.6-of-a-gap rule `yearTicks` uses.
  const gap = ticks.length > 1 ? ticks[1] - ticks[0] : span;
  if (ticks.length > 1 && last - ticks[ticks.length - 1] < gap * 0.6) ticks.pop();
  ticks.push(last);

  return ticks;
}

// ── Ordered color scales ────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const channel = (n: number) => Math.round(n).toString(16).padStart(2, '0').toUpperCase();

/** Straight RGB interpolation. The authored ramps are already perceptually
 *  spaced by the designer, so interpolating *between* them stays on their
 *  intended path; switching to Lab here would bend it. */
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return `#${channel(r1 + (r2 - r1) * t)}${channel(g1 + (g2 - g1) * t)}${channel(b1 + (b2 - b1) * t)}`;
}

/**
 * Resample a ramp to `steps` colors.
 *
 * The spec ships five-step sequential ramps and six-step diverging ones, but
 * says the count "should be adjusted based on the intended data representation —
 * three for a coarse classification, seven or more for a finer gradient". Asking
 * for the authored length returns the authored colors untouched; any other count
 * interpolates.
 */
export function interpolateRamp(colors: readonly string[], steps: number): string[] {
  if (steps < 1) return [];
  if (steps === colors.length) return [...colors];
  if (steps === 1) return [colors[Math.floor(colors.length / 2)]];
  return Array.from({ length: steps }, (_, i) => {
    const pos = (i / (steps - 1)) * (colors.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(colors.length - 1, lo + 1);
    return lo === hi ? colors[lo] : mix(colors[lo], colors[hi], pos - lo);
  });
}

export interface GLSteppedColorScale extends ConfiguredColorScaleLike<number, string> {
  /**
   * Interior bin boundaries — the cut points *between* colors, excluding the
   * two ends. Five bins over `[0, 100]` gives `[20, 40, 60, 80]`.
   */
  thresholds: () => readonly number[];
}

/**
 * A stepped color scale in TanStack's `ConfiguredColorScaleLike` shape.
 *
 * `thresholds()` is not decoration. TanStack's `colorScaleKind()` classifies a
 * scale by which optional methods it exposes, and the presence of `thresholds`
 * is what earns the `quantize` classification — which is in turn what makes
 * `colorLegend()` render discrete swatches instead of a continuous ramp. The
 * spec's choropleth legends are stepped, so this has to be here.
 *
 * `domain()` returns the **value extent**, not the cut points. That distinction
 * caused a real bug: when `domain()` returned the thresholds, TanStack's legend
 * — which re-derives its boundary labels from `domain` because the configured
 * scale path never populates `ResolvedColorScale.thresholds` — labelled a
 * five-step ramp over `[0, 100]` as `20 | 32 | 44 | 56 | 68 | 80`. `domain()`
 * means the input extent everywhere else in TanStack, and it means that here.
 */
function steppedColor(
  bins: readonly string[],
  thresholds: readonly number[],
  extent: readonly [number, number],
): GLSteppedColorScale {
  const map = (value: number): string => {
    if (value == null || !Number.isFinite(value)) return bins[0];
    let i = 0;
    while (i < thresholds.length && value >= thresholds[i]) i++;
    return bins[Math.min(i, bins.length - 1)];
  };
  const scale = ((value: number) => map(value)) as GLSteppedColorScale;
  scale.copy = () => steppedColor(bins, thresholds, extent);
  scale.domain = () => extent;
  scale.range = () => bins;
  scale.thresholds = () => thresholds;
  return scale;
}

function rampFor(
  ramp: string | readonly string[] | undefined,
  fallback: readonly string[],
): readonly string[] {
  if (!ramp) return fallback;
  if (Array.isArray(ramp)) return ramp as readonly string[];
  const key = ramp as string;
  if (key in sequential) return sequential[key as GLSequentialKey];
  if (key in diverging) return diverging[key as GLDivergingKey];
  return fallback;
}

export interface GLSequentialOptions {
  /** A ramp key (`'sequential-3'`) or an explicit list of colors. */
  ramp?: GLSequentialKey | readonly string[];
  /** `[min, max]` of the encoded variable. */
  domain: readonly [number, number];
  /** GLBin count. Defaults to the ramp's authored length (five). */
  steps?: number;
  /**
   * Explicit class breaks, ascending, in data units — `steps - 1` of them.
   *
   * Omit and the bins are cut equal-width across `domain`, which is right for a
   * continuous quantity and **wrong wherever the caller already owns the
   * breaks**: contour levels, quantile classes, a log-spaced choropleth. Passing
   * a value list where the breaks are not uniform silently collapses two classes
   * into one fill and leaves another fill unused — the ramp still has `steps`
   * colours, so nothing downstream can tell.
   *
   * `steps` defaults to `thresholds.length + 1` when this is given.
   */
  thresholds?: readonly number[];
}

/**
 * Sequential color scale — an ordered encoding with **no meaningful midpoint**
 * (population, GDP, complexity, counts). Darker always means higher.
 *
 * Bins are equal-width across the domain unless `thresholds` names the breaks.
 */
export function glSequentialColor(o: GLSequentialOptions): GLSteppedColorScale {
  const base = rampFor(o.ramp, sequential[defaultSequential]);
  const steps = o.steps ?? (o.thresholds ? o.thresholds.length + 1 : base.length);
  const bins = interpolateRamp(base, steps);
  const [lo, hi] = o.domain;
  if (o.thresholds) {
    if (o.thresholds.length !== steps - 1) {
      warn(
        `glSequentialColor: ${steps} steps needs ${steps - 1} thresholds, got ` +
          `${o.thresholds.length}. Every class past the shortfall shares one fill.`,
      );
    }
    return steppedColor(bins, o.thresholds, [lo, hi]);
  }
  const thresholds = Array.from({ length: steps - 1 }, (_, i) => lo + ((i + 1) * (hi - lo)) / steps);
  return steppedColor(bins, thresholds, [lo, hi]);
}

export interface GLDivergingOptions {
  ramp?: GLDivergingKey | readonly string[];
  domain: readonly [number, number];
  /** The reference point the two hues meet at. Defaults to zero. */
  midpoint?: number;
  /** Total bin count, split either side of the midpoint. Defaults to six. */
  steps?: number;
}

/**
 * Diverging color scale — **only** where the data has a real reference point:
 * gains vs. losses, above vs. below baseline. Never on a purely positive scale;
 * the reader will read midpoint meaning into a hue boundary that isn't there.
 *
 * The two halves are resampled independently, so the hue boundary lands exactly
 * on the midpoint instead of drifting when the domain is asymmetric — which is
 * the whole point of a diverging ramp. A shared interpolation across all six
 * steps would put the boundary at the domain's centre, not the data's.
 */
export function glDivergingColor(o: GLDivergingOptions): GLSteppedColorScale {
  const base = rampFor(o.ramp, diverging[defaultDiverging]);
  const mid = o.midpoint ?? 0;
  const steps = o.steps ?? base.length;
  const half = Math.max(1, Math.round(steps / 2));
  const split = Math.ceil(base.length / 2);

  const bins = [
    ...interpolateRamp(base.slice(0, split), half),
    ...interpolateRamp(base.slice(split), steps - half),
  ];

  const [lo, hi] = o.domain;
  const below = Array.from({ length: half - 1 }, (_, i) => lo + ((i + 1) * (mid - lo)) / half);
  const above = Array.from(
    { length: steps - half - 1 },
    (_, i) => mid + ((i + 1) * (hi - mid)) / (steps - half),
  );
  return steppedColor(bins, [...below, mid, ...above], [lo, hi]);
}

/**
 * Pin categorical colors to named series.
 *
 * TanStack assigns palette slots by **first appearance in the data**, so
 * filtering or reordering rows silently recolours a category. An explicit domain
 * fixes each category to a slot for good — worth doing on any chart whose data
 * can change under the reader.
 */
export function glOrdinalColor(
  domain: readonly string[],
  range: readonly string[],
): ConfiguredColorScaleLike<string, string> {
  const map = (value: string): string => {
    const i = domain.indexOf(value);
    return range[(i < 0 ? 0 : i) % range.length];
  };
  const scale = ((value: string) => map(value)) as ConfiguredColorScaleLike<string, string>;
  scale.copy = () => glOrdinalColor(domain, range);
  scale.domain = () => domain;
  scale.range = () => range;
  return scale;
}

// ── Ordered color scales ────────────────────────────────────────────────────

/**
 * How an ordered value is turned into a fill.
 *
 * `quantize` cuts the domain into equal-width bins, `quantile` into equal-count
 * bins. Equal width is the default because it keeps the legend honest: a reader
 * decoding a choropleth assumes each step covers the same range of values.
 * Reach for `quantile` only when the distribution is so skewed that equal-width
 * bins would leave four of five steps empty — and say so in the subtitle.
 */
export type GLRampBinning = 'quantize' | 'quantile';

export interface GLRampScaleOptions {
  /** Value extent. Inferred from the data when omitted. */
  domain?: readonly [number, number];
  /** How many steps to take from the ramp. Defaults to the ramp's own length. */
  steps?: number;
  binning?: GLRampBinning;
}

/** Take `count` evenly spaced entries from a ramp, always keeping both ends. */
function resample(ramp: readonly string[], count: number): string[] {
  if (count >= ramp.length) return [...ramp];
  if (count <= 1) return [ramp[ramp.length - 1]];
  return Array.from(
    { length: count },
    (_, i) => ramp[Math.round((i / (count - 1)) * (ramp.length - 1))],
  );
}

function rampScale(
  colors: readonly string[],
  values: Iterable<number>,
  options: GLRampScaleOptions,
  midpoint?: number,
): ConfiguredColorScaleLike<number, string> {
  const all = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  const steps = resample(colors, options.steps ?? colors.length);

  const [lo, hi] = options.domain ?? [all[0] ?? 0, all[all.length - 1] ?? 1];

  /**
   * A diverging ramp's hue boundary IS the midpoint, so the two halves have to be
   * scaled independently — otherwise a domain like [-2, +8] puts the boundary at
   * +3 and the chart claims a midpoint it does not have.
   */
  const half = steps.length / 2;
  const reach = midpoint === undefined ? 0 : Math.max(midpoint - lo, hi - midpoint);

  const index = (value: number): number => {
    if (!Number.isFinite(value)) return 0;
    if (midpoint !== undefined) {
      if (reach === 0) return Math.floor(half);
      const offset = ((value - midpoint) / reach) * half;
      return Math.min(steps.length - 1, Math.max(0, Math.floor(half + offset - (offset >= 0 ? 0 : 1)) + (offset >= 0 ? 0 : 1)));
    }
    if (options.binning === 'quantile' && all.length) {
      const rank = all.filter((v) => v <= value).length / all.length;
      return Math.min(steps.length - 1, Math.max(0, Math.ceil(rank * steps.length) - 1));
    }
    if (hi === lo) return 0;
    const t = (value - lo) / (hi - lo);
    return Math.min(steps.length - 1, Math.max(0, Math.floor(t * steps.length)));
  };

  const scale = ((value: number) => steps[index(value)]) as ConfiguredColorScaleLike<
    number,
    string
  >;
  scale.copy = () => rampScale(colors, all, options, midpoint);
  scale.domain = () => [lo, hi];
  scale.range = () => steps;
  return scale;
}

/**
 * Sequential fill scale — low to high, no midpoint. Darker is always higher.
 *
 * This exists because an ordered encoding cannot be applied per-datum in
 * TanStack: `RectOptions.fill` and `DotOptions.fill` are plain strings, not
 * channels. The only route from a value to a fill is the chart-level color
 * scale, so that is what this returns:
 *
 * ```ts
 * defineChart({ marks: [glRegion(rows, { color: 'value', … })],
 *               color: { scale: scaleSequential(rows.map(r => r.value)) } })
 * ```
 */
export function scaleSequential(
  values: Iterable<number>,
  ramp: GLSequentialKey = defaultSequential,
  options: GLRampScaleOptions = {},
): ConfiguredColorScaleLike<number, string> {
  return rampScale(sequential[ramp], values, options);
}

/**
 * Diverging fill scale — two hues meeting at a meaningful midpoint.
 *
 * The midpoint defaults to 0 because that is what "meaningful" almost always
 * means: gain vs. loss, above vs. below baseline. Pass `midpoint` for an
 * above/below-average encoding.
 *
 * Never reach for this on a purely positive scale. A reader decodes the hue
 * boundary as a real threshold, and inventing one where none exists is the most
 * common way a correct dataset tells a false story (grammar.md, §diverging).
 */
export function scaleDiverging(
  values: Iterable<number>,
  ramp: GLDivergingKey = defaultDiverging,
  options: GLRampScaleOptions & { midpoint?: number } = {},
): ConfiguredColorScaleLike<number, string> {
  const all = [...values].filter(Number.isFinite);
  if (all.length && Math.min(...all) >= 0) {
    warn(
      'A diverging ramp on a purely positive scale invents a midpoint the data ' +
        'does not have — the reader will read meaning into the hue boundary. ' +
        'Use scaleSequential unless the value genuinely crosses a reference point.',
    );
  }
  return rampScale(diverging[ramp], all, options, options.midpoint ?? 0);
}
