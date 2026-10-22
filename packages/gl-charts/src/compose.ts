/**
 * The moves the spec names, as composable helpers.
 *
 * These are the parts of a GL chart that are neither a token nor a mark default:
 * the pop-up effect, the order a stack builds in, the tone ramp for two or three
 * categories of one hue, direct end-labels, year ticks pinned to the data. Each
 * one used to be buried inside a whole-chart preset, which meant it was only
 * available on the chart types that had a preset. Here they compose with any
 * chart shape, including the ones this package doesn't name.
 *
 * Nothing here draws. `popUp`, `toSeries` and `stackOrder` transform data;
 * `toneRamp` and `yearAxisFor` build scale/axis options; only `endLabels` returns
 * marks, and it builds them out of `glLabel`.
 */

import type { ChartAxisOptions } from '@tanstack/charts';

import { glAxisTime, glAxisYear, type GLAxisPreset } from './chart.js';
import { warn } from './dev.js';
import { glLabel } from './marks.js';
import { dateTicks, formatDateTick, yearTicks } from './scales.js';
import {
  geometry,
  minTextSize,
  sequential,
  type GLCategoricalKey,
  type GLSequentialKey,
} from './tokens.js';
import { resolveTone, seriesKeyAt, type GLToneRef, type GLToneStep } from './tone.js';

type Field<T> = Extract<keyof T, string>;

/**
 * A channel accessor, in TanStack's calling convention: **positional**
 * `(datum, index, data)`, matching `ChannelAccessor` in its own types.
 *
 * It has to be positional, because these helpers hand accessors straight to
 * TanStack marks and TanStack invokes them positionally — `dist/mark.js`:
 * `data.map((datum, index) => channel(datum, index, data))`. An earlier version
 * declared a `(datum, { index, data })` context object, which meant one user
 * accessor was called two different ways depending on which code touched it:
 * correctly by the preset's own read path, and with a bare number where the
 * context object belonged by the mark itself. Field-name channels — the common
 * case — were unaffected, which is why nothing caught it.
 */
type Accessor<T> = (datum: T, index: number, data: readonly T[]) => any;

/** A field name or an accessor. Anywhere a channel is taken, both work. */
export type GLChannel<T> = Field<T> | Accessor<T>;

function reader<T>(channel: GLChannel<T>): (d: T, i: number, arr: readonly T[]) => unknown {
  if (typeof channel === 'function') return channel;
  return (d) => (d as Record<string, unknown>)[channel as string];
}

/**
 * A series, its rows, and the tone that paints it.
 *
 * The tone travels with the series on purpose: Decision Rule 2 says every text
 * element tied to a colored mark takes that mark's DARK tone, so a label can only
 * be correct if it knows which series it names. Passing `GLLabeledSeries` around
 * instead of bare rows is what makes `endLabels` unable to get it wrong.
 */
export interface GLLabeledSeries<T> {
  key: string;
  rows: readonly T[];
  tone: GLToneRef;
}

/**
 * The pop-up effect reserves a saturated hue for "the one or two series the
 * reader actually needs to track" — c-1 for the finding, c-2 when a second
 * series genuinely earns it. Highlighting more than two defeats the pattern.
 */
export const FOCUS_TONES: readonly GLCategoricalKey[] = ['c-1', 'c-2'];
export const MAX_FOCUS = FOCUS_TONES.length;

/**
 * Gap between a mark's EDGE and its direct label (§3.12) — `annotationClearance`
 * under its call-site name. Measured from the edge, never from the anchor: see
 * `clearOf`.
 */
export const LABEL_GAP = geometry.annotationClearance;

export interface GLPopUp<T> {
  /** Everything not highlighted, to be drawn in `c-muted` as one mark. */
  backdrop: T[];
  /** The highlighted series, in the order given, toned c-1 then c-2. */
  focus: GLLabeledSeries<T>[];
  /** True when more series were highlighted than the pattern supports. */
  overflowed: boolean;
}

/**
 * Partition rows into the muted backdrop and up to two focus series.
 *
 * This is the spec's central move and the question to ask before reaching for a
 * categorical palette at all:
 *
 *   "Color should only be used when it is necessary. When you have categorical
 *   data, you do not have to color every category differently."
 *
 * The muted layer carries the trend; the highlight carries the finding.
 */
export function popUp<T>(
  rows: readonly T[],
  o: { by: GLChannel<T>; highlight: string | readonly string[] },
): GLPopUp<T> {
  const read = reader(o.by);
  const requested = (Array.isArray(o.highlight) ? o.highlight : [o.highlight]) as string[];
  const keys = requested.slice(0, MAX_FOCUS).map(String);
  const wanted = new Set(keys);

  const backdrop: T[] = [];
  const buckets = new Map<string, T[]>(keys.map((k) => [k, []]));
  rows.forEach((d, i) => {
    const k = String(read(d, i, rows));
    if (wanted.has(k)) buckets.get(k)!.push(d);
    else backdrop.push(d);
  });

  if (requested.length > MAX_FOCUS) {
    warn(
      `The pop-up effect reserves a saturated hue for one or two series; ` +
        `${requested.length} were highlighted. Using the first ${MAX_FOCUS}: ` +
        `${keys.join(', ')}. If more truly need tracking, the chart type is probably wrong.`,
    );
  }

  return {
    backdrop,
    focus: keys.map((key, i) => ({
      key,
      rows: buckets.get(key) ?? [],
      tone: FOCUS_TONES[i],
    })),
    overflowed: requested.length > MAX_FOCUS,
  };
}

/** Distinct values of a channel, in the order the reader first meets them. */
export function seriesKeys<T>(rows: readonly T[], by: GLChannel<T>): string[] {
  const read = reader(by);
  const seen = new Set<string>();
  rows.forEach((d, i) => seen.add(String(read(d, i, rows))));
  return [...seen];
}

/**
 * Split rows into one `GLLabeledSeries` per distinct value, toned in palette order.
 *
 * The order is load-bearing: TanStack's color scale spends the palette in order
 * of first appearance, and so does this, so series *i*'s label lands on the same
 * hue as series *i*'s mark without either side coordinating.
 *
 * `tones` overrides the assignment (for example to mute all but one). **Prefer
 * the callback form.** An array is matched *positionally against first-appearance
 * order*, which is a property of the row order, not of any list the caller holds
 * — so building the array from a roster constant silently mispaints every series
 * whose rank in that roster differs from the order it happens to appear in the
 * data. That is not hypothetical: it shipped on two Lines demos, where the muted
 * backdrop got the highlight hue and the highlighted series got grey, on a page
 * whose §3.1 rule line says colour is spent only where it carries a finding.
 * The callback is keyed, so the failure is not expressible.
 *
 * ```ts
 * toSeries(rows, 'country', (key) => (key === lead ? 'c-1' : 'muted'))   // keyed
 * toSeries(rows, 'country', ['c-1', 'muted', 'muted'])                   // positional
 * ```
 */
export function toSeries<T>(
  rows: readonly T[],
  by: GLChannel<T>,
  tones?: readonly GLToneRef[] | ((key: string, index: number) => GLToneRef),
): GLLabeledSeries<T>[] {
  const read = reader(by);
  return seriesKeys(rows, by).map((key, i) => ({
    key,
    rows: rows.filter((d, index) => String(read(d, index, rows)) === key),
    tone: (typeof tones === 'function' ? tones(key, i) : tones?.[i]) ?? seriesKeyAt(i),
  }));
}

/** The row with the largest x — where a direct end-label belongs. */
export function lastByX<T>(rows: readonly T[], x: GLChannel<T>): T | undefined {
  if (!rows.length) return undefined;
  const read = reader(x);
  return rows.reduce((best, d, i) =>
    Number(read(d, i, rows) as number) > Number(read(best, i, rows) as number) ? d : best,
  );
}

/**
 * Pixel radius of a point, for offsetting a label clear of it.
 *
 * `r` may be a constant, a field name or an accessor; all three have to resolve
 * to the same number the dot mark will use, or the label lands on the mark.
 */
export function pointRadiusOf<T>(
  r: GLChannel<T> | number | undefined,
  d: T,
  index: number,
  all: readonly T[],
): number {
  if (r == null) return geometry.pointRadius;
  if (typeof r === 'number') return r;
  const value = Number(reader(r)(d, index, all));
  return Number.isFinite(value) ? value : geometry.pointRadius;
}

/**
 * Which side of a mark its label sits on (§3.12).
 *
 * Not cosmetic. §3.12 asks for the side with open plot space, preferring
 * above-right, and for a label on anything that *points* to continue in the
 * direction it points. Both are per-mark decisions, so the side has to be a
 * parameter — a helper that can only offset one way puts half the labels of any
 * bidirectional chart back on top of their own marks.
 */
export type GLLabelSide = 'left' | 'right' | 'above' | 'below';

/** The text anchor that keeps a label reading away from its mark. */
export function anchorFor(side: GLLabelSide): 'start' | 'middle' | 'end' {
  if (side === 'right') return 'start';
  if (side === 'left') return 'end';
  return 'middle';
}

/**
 * An offset accessor that clears a point of radius `r`, for labelling a bubble.
 *
 * A fixed offset is fine for a 6px dot and lands *inside* the circle the moment
 * `r` is a size channel — which is exactly what a pop-up bubble chart is. That
 * is why §3.12 measures clearance from the mark's rendered EDGE: the radius has
 * to be added back in before the gap means anything.
 *
 * Feeds `dx` for a `left`/`right` side and `dy` for `above`/`below`. The
 * vertical pair adds half a line, because `dy` moves a BASELINE and the thing
 * that has to clear the mark is the text's box.
 *
 * Pair it with `anchorFor(side)`, or use `clearance()` to get both at once.
 */
export function clearOf<T>(
  r: GLChannel<T> | number | undefined,
  options: { side?: GLLabelSide; gap?: number } | number = {},
): (d: T, index: number, all: readonly T[]) => number {
  // A bare number stays the gap, which is what the original signature meant.
  const { side = 'left', gap = LABEL_GAP } =
    typeof options === 'number' ? { gap: options } : options;
  const sign = side === 'right' || side === 'below' ? 1 : -1;
  const vertical = side === 'above' || side === 'below';
  const halfLine = vertical ? minTextSize / 2 : 0;

  return (d, index, all) => sign * (pointRadiusOf(r, d, index, all) + gap + halfLine);
}

/**
 * An `anchor` accessor that keeps a label inside the plot frame (§3.12).
 *
 * A centred label on the leftmost point of a series is half outside the plot:
 * it crosses the Y axis, sits over the tick labels, and on a narrow figure
 * runs off the block entirely. §3.12 calls that "placed on the wrong side", and
 * the side that is wrong depends on where in the domain the mark falls — so the
 * anchor has to be a function of the datum, not a constant.
 *
 * `reference` is the series the plot is scaled to, NOT the rows being labelled.
 * Passing the labelled rows would measure the extent of two extrema against
 * themselves and call one of them left-edge and the other right-edge whatever
 * the axis actually spans.
 */
export function anchorWithin<T>(
  x: GLChannel<T>,
  reference: readonly T[],
  margin = 0.15,
): (d: T, index: number, all: readonly T[]) => 'start' | 'middle' | 'end' {
  const read = reader(x);
  const values = reference.map((d, i) => Number(read(d, i, reference)));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;

  return (d, index, all) => {
    if (!(span > 0)) return 'middle';
    const t = (Number(read(d, index, all)) - min) / span;
    if (t <= margin) return 'start';
    if (t >= 1 - margin) return 'end';
    return 'middle';
  };
}

/**
 * `anchor` and `dx` together, so the two cannot disagree.
 *
 * They are one decision — an `anchor: 'start'` with a negative `dx` reads the
 * label back across the mark it was supposed to clear — and splitting them
 * across two arguments is how that goes wrong.
 */
export function clearance<T>(
  side: GLLabelSide,
  r?: GLChannel<T> | number,
  gap = LABEL_GAP,
): {
  anchor: 'start' | 'middle' | 'end';
  dx?: (d: T, index: number, all: readonly T[]) => number;
  dy?: (d: T, index: number, all: readonly T[]) => number;
} {
  const offset = clearOf(r, { side, gap });
  const axis = side === 'above' || side === 'below' ? 'dy' : 'dx';
  return { anchor: anchorFor(side), [axis]: offset };
}

export interface GLEndLabelOptions<T> {
  x: GLChannel<T>;
  y: GLChannel<T>;
  /** Offset from the mark. A number, or an accessor — see `clearOf`. */
  dx?: number | ((d: T, index: number, all: readonly T[]) => number);
  /**
   * Vertical offset, in px, positive DOWN. §3.12 prefers above-right, which on
   * a crowded scatter is the difference between a label in open paper and a
   * label in the middle of the cluster.
   */
  dy?: number | ((d: T, index: number, all: readonly T[]) => number);
  anchor?: 'start' | 'middle' | 'end';
  /**
   * Label the series' last point (the default — a line's right end) or every
   * point in it (a scatter, where each row is its own mark).
   */
  at?: 'last' | 'all';
  /**
   * Minimum vertical separation between two labels, **in data units**, pushing
   * apart any pair that ends closer together than this.
   *
   * §3.12 will not let an annotation cover another annotation, and end-labels
   * are the one place that happens without anybody doing anything wrong: two
   * series that converge put their labels on top of each other, and no amount
   * of care at the call site prevents it because it is a property of the data.
   *
   * Data units, not pixels, because a mark's `y` is in data space and that is
   * where the label has to move — a `dy` in pixels would slide the text off a
   * line whose end it is supposed to name. Read the figure's y range and its
   * height to pick one: at 1500 units over 230px, a 14px line needs about 90.
   *
   * Only applies with `at: 'last'`. Labelling every point in a scatter is a
   * different problem and wants a repel, not a one-axis nudge.
   */
  dodge?: number;
}

/**
 * Push converging label anchors apart until each clears its neighbour.
 *
 * Exported for `endLabels`'s `dodge`, and because it is the one piece of that
 * option worth testing on its own — everything else is plumbing.
 *
 * Two properties the arithmetic has to hold, and the second is the one that is
 * easy to get wrong:
 *
 *   1. A label that never collided does not move. Nudging a label off the line
 *      it names is the cost of a dodge; paying it for a label that had no
 *      collision is pure loss.
 *   2. A cluster that *did* collide stays on its own midpoint. Pushing only
 *      downstream slides the whole group away from the lines it names, by the
 *      total push, in one direction.
 *
 * Those pull against each other, which is why the re-centring is per-cluster
 * rather than global — a global re-centre satisfies (2) by breaking (1).
 *
 * It is not a general repel. One pass down the sorted list is enough for the
 * case this exists for: two or three series converging at a line's end. With
 * many labels in one cluster, re-centring can bring the cluster nearer the
 * label below it, and a chart with that many converging series wanted a pop-up
 * (§3.1) rather than more labels.
 */
export function dodgeAnchors(anchors: readonly number[], gap: number): number[] {
  if (anchors.length < 2 || !(gap > 0)) return anchors.slice();

  const order = anchors.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const out = anchors.slice();
  // `pushed[k]` — the pair (k-1, k) in sorted order had to be separated, which
  // is what makes them one cluster.
  const pushed: boolean[] = new Array(order.length).fill(false);

  for (let k = 1; k < order.length; k++) {
    const previous = out[order[k - 1].i];
    if (out[order[k].i] - previous < gap) {
      out[order[k].i] = previous + gap;
      pushed[k] = true;
    }
  }

  for (let start = 0; start < order.length; ) {
    let end = start;
    while (end + 1 < order.length && pushed[end + 1]) end++;

    if (end > start) {
      const cluster = order.slice(start, end + 1).map((o) => o.i);
      const before = cluster.map((i) => anchors[i]);
      const after = cluster.map((i) => out[i]);
      const shift =
        (Math.min(...before) + Math.max(...before)) / 2 -
        (Math.min(...after) + Math.max(...after)) / 2;
      for (const i of cluster) out[i] += shift;
    }

    start = end + 1;
  }

  return out;
}

/**
 * Direct labels for a set of series, each in that series' DARK tone.
 *
 * The spec prefers a direct label to a legend wherever the chart allows it — a
 * label at the end of the line costs the reader nothing, a legend costs them a
 * lookup. Pass `endLabels: true` to `glChart` alongside these so the right margin
 * widens to hold them.
 */
export function endLabels<T>(
  series: readonly GLLabeledSeries<T>[],
  o: GLEndLabelOptions<T>,
): unknown[] {
  const anchor = o.anchor ?? 'start';
  const dx = o.dx ?? LABEL_GAP;
  const readY = reader(o.y);

  const picked = series.map(({ key, rows, tone }) => ({
    key,
    tone,
    targets:
      o.at === 'all'
        ? rows
        : [lastByX(rows, o.x)].filter(Boolean as any as (v: T | undefined) => v is T),
  }));

  // Where each label's y ends up. Untouched unless `dodge` says two of them
  // would land on top of each other.
  let anchors: (number | undefined)[] = picked.map(() => undefined);
  if (o.dodge && o.at !== 'all') {
    const ends = picked.map((s) =>
      s.targets.length ? Number(readY(s.targets[0], 0, s.targets)) : NaN,
    );
    if (ends.every(Number.isFinite)) {
      const spreadTo = dodgeAnchors(ends, o.dodge);
      // Only override the ones that actually moved, so a chart with no
      // collision keeps its labels on their real anchors to the last decimal.
      anchors = spreadTo.map((y, i) => (y === ends[i] ? undefined : y));
    }
  }

  return picked.flatMap(({ key, targets, tone }, i) => {
    if (!targets.length) return [];
    const y = anchors[i];
    return [
      glLabel(targets, {
        x: o.x as any,
        y: (y != null ? () => y : o.y) as any,
        text: () => key,
        tone,
        anchor,
        dx: dx as any,
        ...(o.dy != null ? { dy: o.dy as any } : {}),
      }),
    ];
  });
}

/**
 * Sort rows so a stack builds bottom-to-top in `order`.
 *
 * TanStack stacks in the order it meets each series key, so the ordering the
 * spec asks for (largest mean share at the bottom) has to be imposed on the
 * data. Without this, `order` silently does nothing and the stack comes out in
 * whatever order the caller's rows happened to be in.
 */
export function stackOrder<T>(
  rows: readonly T[],
  by: GLChannel<T>,
  order?: readonly string[],
): readonly T[] {
  if (!order?.length) return rows;
  const read = reader(by);
  const rank = new Map(order.map((key, i) => [key, i]));
  const fallback = order.length;
  return [...rows].sort(
    (a, b) =>
      (rank.get(String(read(a, 0, rows))) ?? fallback) -
      (rank.get(String(read(b, 0, rows))) ?? fallback),
  );
}

/**
 * GLTone ramps, in `order` sequence — which is bottom-to-top in a stack.
 *
 * They differ on purpose, and the spec states both:
 *   two   → "one hue at **main + light**" (§8b). The primary category anchors
 *           the bottom in the full hue; the secondary sits above it as a tint.
 *   three → "**light / main / dark** … lightest tier at the bottom, darkest at
 *           the top, so the lightness ramp itself carries the ordering" (§8c).
 *
 * A three-tone stack encodes an ordered variable (low/medium/high), so its ramp
 * has to run monotonically. Two categories sharing a parent are not ordered, so
 * the ramp is about emphasis instead.
 */
const TONE_STEPS = {
  two: ['main', 'light'],
  three: ['light', 'main', 'dark'],
} as const;

/**
 * The colour scale for a stack painted in tones of ONE hue.
 *
 * Returns a chart-level colour scale, not a set of marks. This is load-bearing:
 * TanStack stacks *within* a mark, through its `z`/`color` channel — it has no
 * concept of stacking across marks. Building one mark per tone step produced
 * bands drawn from the baseline on top of each other: no stack, no warning, and a
 * y axis that topped out at the largest single series instead of the total.
 *
 * Use when two or three categories share a parent concept — goods vs. services,
 * low/medium/high complexity. The shared hue keeps the bar reading as one total
 * while lightness carries the split.
 */
export function toneRamp(o: {
  order?: readonly string[];
  tones: 'two' | 'three';
  tone?: GLToneRef;
}): { domain: string[]; range: string[] } | undefined {
  if (!o.order?.length) {
    warn(
      '`tones` needs `order` — the tone ramp runs lightest-at-the-bottom, and ' +
        'without an explicit order there is nothing to map the steps onto. ' +
        'Falling back to the categorical palette.',
    );
    return undefined;
  }
  const steps = TONE_STEPS[o.tones];
  const tone = resolveTone(o.tone);
  if (o.order.length > steps.length) {
    warn(
      `A ${o.tones}-tone stack holds ${steps.length} categories; ${o.order.length} were ` +
        `ordered. Extra categories would have no tone. Use separate hues instead.`,
    );
  }
  return {
    domain: o.order.slice(0, steps.length).map(String),
    range: steps.map((step) => tone[step]),
  };
}

/**
 * A year axis whose ticks are pinned to the first and last year in the data.
 *
 * The spec's time-series plates always label both endpoints — a reader checking
 * the span should not have to infer it from where the line stops. A tick
 * generator picks round numbers instead, so the endpoints have to be imposed.
 */
export function yearAxisFor<T>(
  rows: readonly T[],
  x: GLChannel<T>,
  /**
   * `domain` is the one worth knowing about: pass `[first - 0.3, last + 0.3]`
   * when the chart marks its endpoint years with dots, or half of each circle
   * renders outside the plot. The ticks stay pinned to the real years either
   * way — `values` is computed from the data, not from the domain.
   */
  o: Omit<GLAxisPreset, 'label' | 'values'> = {},
): ChartAxisOptions<number> {
  const read = reader(x);
  return glAxisYear({
    ...o,
    values: yearTicks(rows.map((d, i) => Number(read(d, i, rows)))),
  });
}

/**
 * A date axis whose ticks are pinned to the first and last date in the data,
 * labelled at whatever unit the span calls for.
 *
 * The same move as `yearAxisFor`, for the case the package could not express at
 * all: TanStack ships no time scale, so a date reaches a chart as epoch ms
 * either way. Read the x channel through `toEpoch` when you build the marks and
 * the two agree.
 */
export function timeAxisFor<T>(
  rows: readonly T[],
  x: GLChannel<T>,
  o: Omit<GLAxisPreset, 'values'> = {},
): ChartAxisOptions<number> {
  const read = reader(x);
  const values = dateTicks(rows.map((d, i) => read(d, i, rows) as Date | number | string));
  return glAxisTime({
    ...o,
    values,
    format: o.format ?? ((v: number) => formatDateTick(v, values)),
  });
}

// ── §3.10 — derived series ──────────────────────────────────────────────────

export interface GLMovingAverageOptions<T> {
  x: GLChannel<T>;
  y: GLChannel<T>;
  /** Number of observations in the window, including the current one. */
  window: number;
  /** Field name for the averaged value on the returned rows. Defaults to `y`. */
  as?: string;
  /**
   * Emit rows before the window is full, averaging what there is. Off by
   * default: a "3-year moving average" whose first point averages one year is
   * not a 3-year moving average, and the reader cannot see which points are
   * which.
   */
  partial?: boolean;
}

/**
 * A trailing moving average, as new rows.
 *
 * Returns data, not marks, because §3.10 makes the *pairing* the design
 * decision: the derived series keeps its parent's hue and separates by weight
 * and dash, so how it is drawn depends on whether the trend or the observation
 * is the finding. Both readings are two lines from here.
 *
 *   glLine(rows, { x: 'date', y: 'value', tone: 'c-1' })
 *   glLine(movingAverage(rows, { x: 'date', y: 'value', window: 12 }),
 *          { x: 'date', y: 'value', tone: 'c-1', strokeDasharray: '6 4' })
 */
export function movingAverage<T>(
  rows: readonly T[],
  o: GLMovingAverageOptions<T>,
): (T & Record<string, number>)[] {
  if (o.window < 1) {
    warn(`movingAverage needs a window of at least 1; got ${o.window}. Returning the rows.`);
    return rows as (T & Record<string, number>)[];
  }
  const readX = reader(o.x);
  const readY = reader(o.y);
  const key = o.as ?? (typeof o.y === 'string' ? o.y : 'value');

  const sorted = [...rows].sort(
    (a, b) => Number(readX(a, 0, rows)) - Number(readX(b, 0, rows)),
  );

  const out: (T & Record<string, number>)[] = [];
  const buffer: number[] = [];
  sorted.forEach((d, i) => {
    const value = Number(readY(d, i, sorted));
    if (Number.isFinite(value)) buffer.push(value);
    if (buffer.length > o.window) buffer.shift();
    if (buffer.length < o.window && !o.partial) return;
    out.push({
      ...(d as Record<string, unknown>),
      [key]: buffer.reduce((s, v) => s + v, 0) / buffer.length,
    } as T & Record<string, number>);
  });
  return out;
}

export interface GLLinearFit {
  slope: number;
  intercept: number;
  /** Coefficient of determination. */
  r2: number;
  /** The two endpoints, ready to hand to `glLine`. */
  endpoints: { x: number; y: number }[];
  predict: (x: number) => number;
}

/**
 * Ordinary least squares, with the fitted endpoints as data.
 *
 * A fit line is TWO marks' worth of data, not a mark: §3.10 makes it chrome
 * when it is a reference (an identity line) and data when it is the estimate
 * the chart is about, and only the caller knows which. Draw the second case
 * with `glLine`, the first with `glRuleY`.
 */
export function linearFit<T>(rows: readonly T[], o: { x: GLChannel<T>; y: GLChannel<T> }): GLLinearFit | undefined {
  const readX = reader(o.x);
  const readY = reader(o.y);
  const pairs = rows
    .map((d, i) => [Number(readX(d, i, rows)), Number(readY(d, i, rows))] as const)
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

  if (pairs.length < 2) return undefined;

  const n = pairs.length;
  const meanX = pairs.reduce((s, [x]) => s + x, 0) / n;
  const meanY = pairs.reduce((s, [, y]) => s + y, 0) / n;
  const sxx = pairs.reduce((s, [x]) => s + (x - meanX) ** 2, 0);
  if (sxx === 0) return undefined;

  const sxy = pairs.reduce((s, [x, y]) => s + (x - meanX) * (y - meanY), 0);
  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;
  const predict = (x: number) => slope * x + intercept;

  const ssTot = pairs.reduce((s, [, y]) => s + (y - meanY) ** 2, 0);
  const ssRes = pairs.reduce((s, [x, y]) => s + (y - predict(x)) ** 2, 0);

  const xs = pairs.map(([x]) => x);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);

  return {
    slope,
    intercept,
    r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot,
    endpoints: [
      { x: lo, y: predict(lo) },
      { x: hi, y: predict(hi) },
    ],
    predict,
  };
}

// ── §3.6 — sign encoding ────────────────────────────────────────────────────

/**
 * The tone a signed value takes: `c-2` (red) below zero, `c-1` (blue) at or
 * above it — the same two ends as the default diverging ramp `div-2-1`.
 *
 * Zero counts as positive rather than getting a third tone. §3.6 is explicit
 * that a residual or "unspecified" bucket is coloured by its sign like any
 * other mark, and a lone grey among signed marks reads as a third category.
 */
export function signTone(value: number): GLCategoricalKey {
  return value < 0 ? 'c-2' : 'c-1';
}

/**
 * A chart-level colour scale for a sign-encoded chart — a waterfall, a signed
 * bar chart, a change column.
 *
 * Returns a two-entry ordinal scale keyed by the strings `'-'` and `'+'`; pair
 * it with a `color` channel that reports the sign:
 *
 *   glChart({
 *     marks: [glBar(rows, { x: 'step', y: 'delta', color: (d) => signKey(d.delta) })],
 *     color: signColor(),
 *   })
 */
export function signKey(value: number): '-' | '+' {
  return value < 0 ? '-' : '+';
}

export function signColor(o: { step?: GLToneStep } = {}): { domain: string[]; range: string[] } {
  const step = o.step ?? 'main';
  return {
    domain: ['-', '+'],
    range: [resolveTone('c-2')[step], resolveTone('c-1')[step]],
  };
}

// ── Binning and cumulation ──────────────────────────────────────────────────

export interface GLBin {
  /** Inclusive lower bound. */
  x1: number;
  /** Exclusive upper bound, except on the last bin. */
  x2: number;
  count: number;
  values: number[];
}

export interface GLBinOptions {
  /** Explicit bin boundaries, low to high. Wins over `count`. */
  thresholds?: readonly number[];
  /** Number of equal-width bins. Defaults to the Freedman–Diaconis estimate. */
  count?: number;
}

/**
 * Equal-width bins over a set of values.
 *
 * The default bin count is Freedman–Diaconis (`2·IQR·n^-1/3` wide), which is
 * robust to the long right tails that most economic distributions have — Sturges
 * and the square-root rule both under-bin those badly. Pass `count` or
 * `thresholds` when the bin boundaries carry meaning the estimator cannot know
 * (a policy threshold, a decade, a published bracket).
 *
 * Draw the result with `glBar` on a `glAxisBin` x axis, so the bars abut
 * (`grammar.md` §3.5).
 */
export function binValues(values: Iterable<number>, o: GLBinOptions = {}): GLBin[] {
  const all = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (!all.length) return [];

  const lo = all[0];
  const hi = all[all.length - 1];
  if (lo === hi) return [{ x1: lo, x2: lo, count: all.length, values: all }];

  let edges: number[];
  if (o.thresholds?.length) {
    edges = [...o.thresholds].sort((a, b) => a - b);
  } else {
    const count = o.count ?? freedmanDiaconisBins(all);
    const width = (hi - lo) / count;
    edges = Array.from({ length: count + 1 }, (_, i) => lo + i * width);
  }

  const bins: GLBin[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    bins.push({ x1: edges[i], x2: edges[i + 1], count: 0, values: [] });
  }
  if (!bins.length) return [];

  for (const v of all) {
    if (v < bins[0].x1 || v > bins[bins.length - 1].x2) continue;
    // The last bin is closed on both ends, so the maximum lands somewhere.
    let index = bins.findIndex((b) => v >= b.x1 && v < b.x2);
    if (index === -1) index = bins.length - 1;
    bins[index].count++;
    bins[index].values.push(v);
  }
  return bins;
}

/** Freedman–Diaconis bin count for pre-sorted values. */
function freedmanDiaconisBins(sorted: readonly number[]): number {
  const at = (p: number) => {
    const pos = (sorted.length - 1) * p;
    const base = Math.floor(pos);
    const rest = pos - base;
    return sorted[base + 1] !== undefined
      ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
      : sorted[base];
  };
  const iqr = at(0.75) - at(0.25);
  const span = sorted[sorted.length - 1] - sorted[0];
  if (iqr <= 0 || span <= 0) return Math.min(20, Math.ceil(Math.sqrt(sorted.length)));
  const width = (2 * iqr) / Math.cbrt(sorted.length);
  return Math.max(1, Math.min(60, Math.ceil(span / width)));
}

export interface GLEcdfPoint {
  value: number;
  /** Fraction of observations at or below `value`, in 0–1. */
  p: number;
}

/**
 * The empirical cumulative distribution.
 *
 * Pass the result through `stepPoints` before drawing it — the distribution is
 * genuinely flat between observations, and a straight line between them would
 * claim data at values nobody measured.
 */
export function ecdf(values: Iterable<number>): GLEcdfPoint[] {
  const all = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  return all.map((value, i) => ({ value, p: (i + 1) / all.length }));
}

/**
 * Turn points into a staircase by doubling each vertex.
 *
 * A step chart is an ECDF, a survival curve, a policy rate, a headcount — any
 * series that genuinely holds its value until it jumps. TanStack can draw one
 * through `curve: d3Curve(curveStepAfter)`, but that needs a `d3-shape` import,
 * and this package does not import a d3 specifier it has not declared (see the
 * header of `shapes/geo.ts` for why that rule exists).
 *
 * Doing it in the data is the better answer anyway: the corner points become
 * real rows, so they can be labelled, filtered and inspected like any other
 * datum instead of being conjured by a curve function at render time.
 *
 *   glLine(stepPoints(ecdf(values), { x: 'value', y: 'p' }), { x: 'value', y: 'p' })
 *
 * Rows keep their own shape, so the same field names draw the result. Pass
 * FIELD NAMES rather than accessors: an accessor has no name to write back to,
 * so the corner rows would land on `x`/`y` and the mark would need different
 * channels from the input.
 */
export function stepPoints<T>(rows: readonly T[], o: { x: GLChannel<T>; y: GLChannel<T> }): T[] {
  const readX = reader(o.x);
  const readY = reader(o.y);
  const xKey = typeof o.x === 'string' ? o.x : 'x';
  const yKey = typeof o.y === 'string' ? o.y : 'y';

  const out: T[] = [];
  rows.forEach((d, i) => {
    // The riser: this row's x at the PREVIOUS row's y. Emitted before the row
    // itself, so the line goes across then up rather than diagonally.
    if (i > 0) {
      out.push({
        ...(d as Record<string, unknown>),
        [xKey]: readX(d, i, rows),
        [yKey]: readY(rows[i - 1], i - 1, rows),
      } as T);
    }
    out.push({
      ...(d as Record<string, unknown>),
      [xKey]: readX(d, i, rows),
      [yKey]: readY(d, i, rows),
    } as T);
  });
  return out;
}

export interface GLWaterfallStep<T> {
  key: string;
  /** The signed contribution. Zero for the total row. */
  delta: number;
  /** Bar extent — pass both to a ranged bar. */
  y1: number;
  y2: number;
  /** Running total after this step. */
  cumulative: number;
  /** True for the synthesised total bar, which runs from zero. */
  isTotal: boolean;
  row?: T;
}

/**
 * Cumulative bar extents for a waterfall bridge.
 *
 * Each step's bar spans from the running total to the running total plus its
 * own contribution, so the bars form a staircase; the optional total bar runs
 * from zero to the final sum. Colour with `signColor()` — §3.6 requires every
 * bar to follow the sign encoding, including the total.
 */
export function waterfall<T>(
  rows: readonly T[],
  o: { key: GLChannel<T>; value: GLChannel<T>; total?: string | false },
): GLWaterfallStep<T>[] {
  const readKey = reader(o.key);
  const readValue = reader(o.value);

  let running = 0;
  const steps: GLWaterfallStep<T>[] = rows.map((d, i) => {
    const delta = Number(readValue(d, i, rows)) || 0;
    const from = running;
    running += delta;
    return {
      key: String(readKey(d, i, rows)),
      delta,
      y1: Math.min(from, running),
      y2: Math.max(from, running),
      cumulative: running,
      isTotal: false,
      row: d,
    };
  });

  if (o.total !== false) {
    steps.push({
      key: typeof o.total === 'string' ? o.total : 'Total',
      delta: running,
      y1: Math.min(0, running),
      y2: Math.max(0, running),
      cumulative: running,
      isTotal: true,
    });
  }
  return steps;
}

/**
 * Tones for a nested interval fan, palest outermost.
 *
 * Confidence level is an ordered variable, so §3.9 sends it to the sequential
 * ramp of the series' own hue rather than to a second colour. The ramp is
 * aligned with the triple by construction — `sequential-N` step 1 IS
 * `c-N.light` and step 3 IS `c-N.main` — so a one-level fan comes back exactly
 * the light tone `glBand` would have used anyway, and the line at `main` still
 * reads over every band beneath it.
 *
 * The rule this replaces was to draw the same light tone twice and let the
 * overlap darken it. That is true of translucent fills and false of these: §3.4
 * puts bands at full opacity, where two identical fills are one fill and the
 * inner interval simply vanishes.
 *
 *   const [outer, inner] = fanTones(2);
 *   glBand(rows, { y1: 'lo90', y2: 'hi90', tone: outer }),
 *   glBand(rows, { y1: 'lo50', y2: 'hi50', tone: inner }),
 *   glLine(rows, { y: 'value' }),
 */
export function fanTones(levels: number, tone: GLCategoricalKey = 'c-1'): GLToneRef[] {
  const ramp = sequential[`sequential-${tone.slice(2)}` as GLSequentialKey];
  if (!ramp) {
    warn(`No sequential ramp for ${tone}; falling back to the light tone for every level.`);
    return Array.from({ length: levels }, () => tone);
  }
  // Step 1 is the light tone, step 3 the main. Two levels therefore land on 1
  // and 2 and leave the line's own tone clear; a third would reach 3 and
  // collide with it, which is the point at which a fan has too many levels.
  if (levels > 2) {
    warn(
      `A fan of ${levels} levels walks the sequential ramp into the series' own ` +
        `main tone, so the line stops reading over it. Two levels is what §3.9 covers.`,
    );
  }
  return Array.from({ length: levels }, (_, i) => {
    const step = ramp[Math.min(1 + i, ramp.length - 1)];
    return { light: step, main: step, dark: step };
  });
}

/**
 * Lag-`k` pairs, for a lag plot.
 *
 * Pair with a `glRuleY`-drawn identity line — §3.4.2 makes that reference
 * chrome, so it must not take a series hue.
 */
export function lagPairs(values: Iterable<number>, lag = 1): { x: number; y: number }[] {
  const all = [...values].filter(Number.isFinite);
  const out: { x: number; y: number }[] = [];
  for (let i = lag; i < all.length; i++) out.push({ x: all[i - lag], y: all[i] });
  return out;
}
