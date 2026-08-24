/**
 * Polar marks, and the two whole-chart forms §3.8 sanctions.
 *
 * `radar.ts` reached for six of TanStack's polar marks and kept every one of
 * them private, so the only radial chart this package could draw was the one it
 * had a preset for. A polar line over hour-of-day, a wind rose, a donut, a
 * gauge and a sunburst were all unreachable — not because TanStack cannot draw
 * them (it ships `radialArc`, `radialRule` and `radialText` for exactly that)
 * but because there was no on-spec way to *reach* them.
 *
 * The split follows the package's rule. The marks below are thin wrappers over
 * the defaults table, because TanStack expresses the geometry and the GL layer
 * only supplies paint. `glDonutChart` is a whole-chart function because a donut
 * needs angles computed from values before anything can be drawn, and
 * `SPEC.md` §3.8 caps the slice count — a rule a bare mark cannot enforce.
 *
 *   import { glRadialLine, glPolarChart } from '@growth-lab/gl-charts/shapes';
 */

import type { ChartValue } from '@tanstack/charts';
import {
  angleGrid,
  polar,
  radialArc,
  radialArea,
  radialDot,
  radialGrid,
  radialLine,
  radialRule,
  radialText,
} from '@tanstack/charts/polar';
import type {
  AngleGridOptions,
  PolarGuide,
  PolarMark,
  PolarOptions,
  RadialArcOptions,
  RadialAreaOptions,
  RadialDotOptions,
  RadialGridOptions,
  RadialLineOptions,
  RadialRuleOptions,
  RadialTextOptions,
} from '@tanstack/charts/polar';
import { scaleLinear } from '@tanstack/charts-scales/linear';

import { glChart, type GLChart } from '../chart.js';
import { warn } from '../dev.js';
import { glDefaults } from '../marks.js';
import { resolveTone, seriesKeyAt, type GLToneRef, type GLToneStep } from '../tone.js';
import { geometry, ink, opacity, surface, typeRoles } from '../tokens.js';

/**
 * A polar chart is square and axis-free, so it takes none of `glMargin` — the
 * same reasoning as `glRadarMargin`, which this deliberately mirrors rather
 * than imports, because the two can diverge (a radar reserves a label gutter
 * through `inset`; a donut reserves it through `radiusRatio`).
 */
export const glPolarMargin = { top: 8, right: 8, bottom: 8, left: 8 } as const;

/** Maximum slices before §3.8 says the form is wrong. */
export const MAX_SLICES = 4;

// ── Marks ───────────────────────────────────────────────────────────────────
// Two lines each, like the Cartesian wrappers, and routed through the SAME
// defaults table. A radial arc is a bar bent round a centre — it should not
// acquire a different fill opacity for having done so.

export interface GLRadialArcOptions<T> extends Omit<RadialArcOptions<T>, 'fillOpacity'> {
  tone?: GLToneRef;
  step?: GLToneStep;
}

/**
 * A radial arc — a donut slice, a rose petal, a radial bar, a sunburst ring, a
 * gauge track. Main tone at full opacity, like every other single-layer mark.
 *
 * `padAngle` is left to the caller here and set by `glDonutChart`, because the
 * 1px paper gap of §3.8 is an *angular* quantity: it depends on the radius the
 * arc is drawn at, which a bare mark does not know.
 */
export function glRadialArc<T>(data: Iterable<T>, options: GLRadialArcOptions<T> = {}) {
  return radialArc(data, glDefaults('tile', options) as RadialArcOptions<T>);
}

export interface GLRadialLineOptions<T> extends RadialLineOptions<T> {
  tone?: GLToneRef;
  focus?: boolean;
}

/** A polar line — a cyclic series over hour, day-of-year or bearing. */
export function glRadialLine<T>(data: Iterable<T>, options: GLRadialLineOptions<T> = {}) {
  return radialLine(data, glDefaults('line', options) as RadialLineOptions<T>);
}

export interface GLRadialAreaOptions<T> extends Omit<RadialAreaOptions<T>, 'fillOpacity'> {
  tone?: GLToneRef;
  step?: GLToneStep;
}

/**
 * A filled radial band — the radar polygon, a cyclic envelope.
 *
 * Note the one place the polar defaults genuinely differ from the Cartesian
 * ones: §3.4 puts the radar polygon at `fill-opacity: 0.25` rather than full,
 * because grid rings and spoke labels have to read *through* it. Pass
 * `radarFill: true` for that; a non-overlapping radial band takes the ordinary
 * area treatment.
 */
export function glRadialArea<T>(
  data: Iterable<T>,
  options: GLRadialAreaOptions<T> & { radarFill?: boolean } = {},
) {
  const { radarFill, ...rest } = options;
  const resolved = glDefaults('area', rest) as RadialAreaOptions<T>;
  return radialArea(
    data,
    radarFill ? { ...resolved, fillOpacity: opacity.radarFill } : resolved,
  );
}

export interface GLRadialDotOptions<T>
  extends Omit<RadialDotOptions<T>, 'fillOpacity' | 'strokeOpacity' | 'strokeWidth'> {
  tone?: GLToneRef;
}

/** A polar scatter point — wind observations by bearing, events by hour. */
export function glRadialDot<T>(data: Iterable<T>, options: GLRadialDotOptions<T> = {}) {
  return radialDot(data, glDefaults('point', options) as RadialDotOptions<T>);
}

export interface GLRadialTextOptions<T>
  extends Omit<RadialTextOptions<T>, 'fontSize' | 'fontWeight'> {
  /** The slice this label names — it renders in that slice's DARK tone (§3.3). */
  tone?: GLToneRef;
}

/**
 * A direct label at an angle — a slice name, a gauge value.
 *
 * §3.8 asks for direct labels on radial charts and not a legend, which matters
 * more here than anywhere else: matching a legend swatch to a slice means
 * tracking a colour around a circle, which is the exact task the form is worst
 * at.
 */
export function glRadialLabel<T>(data: Iterable<T>, options: GLRadialTextOptions<T> = {}) {
  return radialText(data, glDefaults('label', options) as RadialTextOptions<T>);
}

/** Annotation text at an angle — Inter 12/400/ink-2. */
export function glRadialAnnotation<T>(
  data: Iterable<T>,
  options: Omit<RadialTextOptions<T>, 'fontSize' | 'fontWeight'> = {},
) {
  return radialText(data, glDefaults('annotation', options) as RadialTextOptions<T>);
}

export interface GLRadialRuleOptions<T> extends RadialRuleOptions<T> {
  tone?: GLToneRef;
  /**
   * This spoke carries a value (a gauge needle, a rose stem) rather than
   * marking a reference. Data rules take the series tone and line weight;
   * reference rules stay dashed `ink-3` (§3.4.2).
   */
  data?: boolean;
}

/** A radial spoke — a leader line to a slice label, a gauge needle, a threshold. */
export function glRadialRule<T>(data: Iterable<T>, options: GLRadialRuleOptions<T> = {}) {
  const { data: isData, ...rest } = options;
  return radialRule(data, glDefaults(isData ? 'stem' : 'rule', rest) as RadialRuleOptions<T>);
}

// ── Guides ──────────────────────────────────────────────────────────────────

/**
 * Concentric value rings. `polygon` for a radar (the rings echo the polygon),
 * `circle` for anything genuinely round — a polar line, a rose, a donut.
 *
 * Grid ink and label type come from §3.5 and the 12px floor, so a guide built
 * here cannot be the thing that puts 10px text in a chart.
 */
export function glRadialGrid(options: RadialGridOptions = {}): PolarGuide {
  return radialGrid({
    shape: 'circle',
    stroke: surface.gridline,
    strokeWidth: geometry.gridlineWidth,
    labelFill: ink[2],
    labelFontSize: typeRoles.axisTick.size,
    ...options,
  });
}

/** Spokes at each angle-scale value, with the dimension labels. */
export function glAngleGrid(options: AngleGridOptions = {}): PolarGuide {
  return angleGrid({
    stroke: surface.gridline,
    strokeWidth: geometry.gridlineWidth,
    labelFill: ink[2],
    labelFontSize: typeRoles.axisLabel.size,
    ...options,
  });
}

// ── The chart wrapper ───────────────────────────────────────────────────────

export interface GLPolarChartSpec<TMarks extends readonly PolarMark<any, any, any>[]>
  extends PolarOptions<TMarks> {
  /** Merged over `glPolarMargin`. */
  margin?: Partial<Record<keyof typeof glPolarMargin, number>>;
}

/**
 * Wrap polar marks and guides in a GL chart.
 *
 * Saves every caller the three things that are easy to get wrong and invisible
 * when they are: the square margin, `guides: false` (without which TanStack
 * draws a Cartesian frame around the polar plot), and the fact that `polar()`
 * reports `never` for both Cartesian scales so `x`/`y` must be omitted rather
 * than passed as undefined.
 */
export function glPolarChart<TMarks extends readonly PolarMark<any, any, any>[]>(
  spec: GLPolarChartSpec<TMarks>,
): GLChart<unknown, ChartValue, ChartValue> {
  const { margin, ...polarOptions } = spec;
  return glChart({
    marks: [polar(polarOptions as PolarOptions<TMarks>)],
    guides: false,
    margin: { ...glPolarMargin, ...margin },
  });
}

// ── Angles ──────────────────────────────────────────────────────────────────

export interface GLSlice<T> {
  key: string;
  value: number;
  /** Fraction of the total, 0–1. */
  share: number;
  startAngle: number;
  endAngle: number;
  /** Mid-angle, for placing a direct label. */
  midAngle: number;
  tone: GLToneRef;
  row?: T;
}

export interface GLArcAngleOptions<T> {
  key: (d: T, i: number) => string;
  value: (d: T, i: number) => number;
  /** Radians. Defaults to a full turn starting at twelve o'clock. */
  startAngle?: number;
  endAngle?: number;
  /** Sort descending by value first. On by default — a part-to-whole should rank. */
  sort?: boolean;
  /**
   * Slice tones. **Prefer the callback form**, which is keyed.
   *
   * An array is matched positionally against the arcs *after* `sort` has ranked
   * them, so on any chart whose categories are shared with another chart — a
   * sector, a market, a region — a positional list ties the hue to the slice's
   * RANK rather than to its subject. Two donuts of the same nine sectors in two
   * different years then disagree about which one is blue, and §3.1's promise
   * that a colour means one thing across a document is broken without anything
   * downstream being able to notice.
   */
  tones?: readonly GLToneRef[] | ((key: string, index: number) => GLToneRef);
}

/**
 * Turn values into arc angles.
 *
 * Exists so a pie, donut, rose, gauge or sunburst can be built from
 * `glRadialArc` without pulling in `d3-shape`'s `pie()` — this package already
 * declares `d3-hierarchy` for the treemap and the geo entry takes a projection
 * from the caller rather than picking one, so adding a dependency for
 * `value → angle` would not match how the rest of it behaves.
 *
 * Angles are clockwise from twelve o'clock, which is what `radialArc` expects
 * and what a reader assumes.
 */
export function arcAngles<T>(rows: readonly T[], o: GLArcAngleOptions<T>): GLSlice<T>[] {
  const start = o.startAngle ?? 0;
  const end = o.endAngle ?? Math.PI * 2;

  const entries = rows
    .map((row, i) => ({ row, key: o.key(row, i), value: Number(o.value(row, i)) || 0 }))
    .filter((e) => e.value > 0);

  const total = entries.reduce((s, e) => s + e.value, 0);
  if (total <= 0) return [];

  const ordered = o.sort === false ? entries : [...entries].sort((a, b) => b.value - a.value);

  let angle = start;
  return ordered.map((e, i) => {
    const share = e.value / total;
    const startAngle = angle;
    angle += share * (end - start);
    return {
      key: e.key,
      value: e.value,
      share,
      startAngle,
      endAngle: angle,
      midAngle: (startAngle + angle) / 2,
      // The palette KEY, not the resolved triple. Both satisfy `GLToneRef`, but a
      // key survives being logged, compared and round-tripped through a data
      // file, which an anonymous `{light,main,dark}` object does not.
      tone: (typeof o.tones === 'function' ? o.tones(e.key, i) : o.tones?.[i]) ?? seriesKeyAt(i),
      row: e.row,
    };
  });
}

// ── The one sanctioned whole-chart form ─────────────────────────────────────

export interface GLDonutChartOptions<T> {
  key: (d: T, i: number) => string;
  value: (d: T, i: number) => number;
  /**
   * Draw a full pie instead of a donut. §3.8 prefers the donut — the hole costs
   * nothing and gives the total somewhere to live — so this is opt-in.
   */
  pie?: boolean;
  /** Text for the middle of the donut. Ignored when `pie` is set. */
  centerLabel?: string;
  centerValue?: string;
  /** Direct slice labels. On by default; §3.8 asks for them over a legend. */
  labels?: boolean;
  /** Format a slice's label. Defaults to `key · 42%`. */
  labelFormat?: (slice: GLSlice<T>) => string;
  /** Slice tones. Prefer the keyed callback — see `GLArcAngleOptions.tones`. */
  tones?: readonly GLToneRef[] | ((key: string, index: number) => GLToneRef);
  /** Fraction of the outer radius the hole takes. Defaults to `donutHoleRatio`. */
  holeRatio?: number;
  sort?: boolean;
}

/**
 * A donut (or, opting in, a pie) for one part-to-whole split.
 *
 * A whole-chart function rather than a composed recipe for two reasons the
 * other radial forms don't have: the angles have to be computed from the values
 * before any mark exists, and §3.8's four-slice cap is a rule about the *data*
 * that only something holding all the rows can check.
 *
 * The cap warns rather than throws, and draws what it was asked for. Refusing
 * would be worse — a caller with five slices gets a chart plus the reason it is
 * the wrong chart, instead of an exception and no way to see the data.
 */
export function glDonutChart<T>(
  data: readonly T[],
  o: GLDonutChartOptions<T>,
): GLChart<unknown, ChartValue, ChartValue> {
  const slices = arcAngles(data, {
    key: o.key,
    value: o.value,
    sort: o.sort,
    tones: o.tones,
  });

  if (slices.length > MAX_SLICES) {
    warn(
      `A donut holds at most ${MAX_SLICES} slices; ${slices.length} were passed ` +
        `(SPEC.md §3.8). Past four, angle comparison stops being safe and the ` +
        `chart is a ranked bar chart drawn badly. Group the tail into ` +
        `"Everything else", or switch form.`,
    );
  }

  const hole = o.pie ? 0 : (o.holeRatio ?? geometry.donutHoleRatio);
  const labelled = o.labels !== false;
  const format =
    o.labelFormat ?? ((s: GLSlice<T>) => `${s.key} · ${Math.round(s.share * 100)}%`);

  // Fraction of the available radius the arcs themselves occupy. The rest is
  // the gutter the direct labels sit in — §3.8 asks for direct labels over a
  // legend, so the room for them is part of the chart, not an afterthought.
  const ARC_EXTENT = labelled ? 0.78 : 1;

  /**
   * The 1px paper gap of §3.8, as d3 expresses it.
   *
   * d3's arc separates adjacent slices by a linear distance of
   * `padRadius × padAngle`, so pinning `padRadius` to 1 makes `padAngle` read
   * directly in pixels. Deriving the angle from the resolved radius instead
   * would be wrong twice over: `padAngle` is a per-datum channel with no access
   * to the layout, and a gap specified as an angle grows and shrinks with the
   * chart size, which the stacked-bar gap this rule mirrors does not.
   */
  const arcs = slices.map((s) =>
    glRadialArc([s], {
      startAngle: () => s.startAngle,
      endAngle: () => s.endAngle,
      padAngle: () => geometry.arcPadAngle,
      padRadius: 1,
      tone: s.tone,
      innerRadius: (ctx) => ctx.radius * ARC_EXTENT * hole,
      outerRadius: (ctx) => ctx.radius * ARC_EXTENT,
    }),
  );

  const marks: PolarMark<any, any, any>[] = [...arcs];

  if (labelled) {
    marks.push(
      glRadialLabel(slices, {
        angle: (s: GLSlice<T>) => s.midAngle,
        // Radius 1 on the [0,1] scale below is the full available radius, so
        // the label lands in the gutter `ARC_EXTENT` left for it.
        radius: () => 1,
        text: (s: GLSlice<T>) => format(s),
        // The label takes its own slice's dark tone — the whole reason slices
        // carry a tone through `arcAngles` rather than being coloured by a
        // chart-level scale that a text mark cannot see (§3.3).
        fill: (s: GLSlice<T>) => resolveTone(s.tone).dark,
        // Angles run clockwise from twelve o'clock, so x = sin(angle): a slice
        // on the right half gets a label reading outward to the right.
        anchor: (s: GLSlice<T>) => (Math.sin(s.midAngle) < 0 ? 'end' : 'start'),
        baseline: 'middle',
      } as unknown as GLRadialTextOptions<GLSlice<T>>),
    );
  }

  // The hole exists to hold the total (§3.8). Filling it is the whole argument
  // for preferring a donut to a pie, so a donut with a `centerLabel` and no
  // value, or the reverse, still renders whichever half was given.
  if (!o.pie && (o.centerValue || o.centerLabel)) {
    const centre = [{ text: o.centerValue ?? '', label: o.centerLabel ?? '' }];
    if (o.centerValue) {
      marks.push(
        glRadialAnnotation(centre, {
          angle: () => 0,
          radius: () => 0,
          text: (d: { text: string }) => d.text,
          fill: ink.DEFAULT,
          fontSize: typeRoles.title.size,
          fontWeight: 600,
          anchor: 'middle',
          baseline: 'middle',
          dy: o.centerLabel ? -6 : 0,
        } as any),
      );
    }
    if (o.centerLabel) {
      marks.push(
        glRadialAnnotation(centre, {
          angle: () => 0,
          radius: () => 0,
          text: (d: { label: string }) => d.label,
          anchor: 'middle',
          baseline: 'middle',
          dy: o.centerValue ? 12 : 0,
        } as any),
      );
    }
  }

  return glPolarChart({
    marks: marks as unknown as readonly PolarMark<any, any, any>[],
    // Both are configured instances, not factories: TanStack infers a domain
    // from factories, and inference is what must not happen here — these two
    // scales are pure pass-throughs, not data ranges.
    //
    // `radialArc` needs neither (it is positioned by explicit start/end angles
    // and radius callbacks), but the direct labels and the centre total are
    // `radialText`, which requires both. A 0–2π angle domain over the default
    // 0–2π angular range makes the angle channel an identity in radians, which
    // is the unit `arcAngles` already returns.
    angle: { scale: scaleLinear().domain([0, Math.PI * 2]) as any, wrap: false },
    radius: { scale: scaleLinear().domain([0, 1]) as any },
  });
}

/** Re-exported so a caller assembling their own polar chart never needs two imports. */
export { polar };
export type { PolarGuide, PolarMark };
