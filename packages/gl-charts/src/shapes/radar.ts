/**
 * Radar chart — one entity profiled across four to eight dimensions.
 *
 * Spec §10 is the most prescriptive page in the document: every part of a radar
 * has a named value, down to which single ring changes color. It is a whole-chart
 * function rather than a composed snippet because none of the Cartesian
 * machinery is shared — a radar has no Cartesian axes, no `glMargin`, no
 * `glAxis*` preset, and it reaches a different TanStack surface entirely
 * (`@tanstack/charts/polar`, which is a subpath export and is NOT re-exported
 * from the package root).
 *
 * The one value that looks like a mistake and isn't: the polygon fills at 0.25,
 * not the 0.8 every other reduced-opacity mark uses. 0.8 is the OVERLAP rule —
 * it exists so overlapping scatter circles darken into a density signal. A
 * radar polygon covers the grid, so its fill is low for the opposite reason:
 * the gridlines and the scale ticks have to stay readable *through* it. Do not
 * "correct" 0.25 toward 0.8.
 */

import type { ChartValue } from '@tanstack/charts';
import {
  angleGrid,
  polar,
  radialArea,
  radialDot,
  radialGrid,
  radialLine,
} from '@tanstack/charts/polar';
import type { PolarGuide, PolarMark } from '@tanstack/charts/polar';
import { scaleLinear } from '@tanstack/charts-scales/linear';
import { scalePoint } from '@tanstack/charts-scales/point';

import { glChart, type GLChart } from '../chart.js';
import type { GLChannel } from '../compose.js';
import { warn } from '../dev.js';
import { resolveTone, type GLToneRef } from '../tone.js';
import {
  geometry,
  ink,
  muted,
  opacity,
  surface,
  typeRoles,
  type GLTone,
} from '../tokens.js';

/**
 * The spec's stated range, and it is a real constraint rather than a
 * suggestion: three dimensions is a triangle whose area says more about which
 * axis you put where than about the data, and twelve is an unreadable
 * starburst. Outside 4–8 the chart type is wrong, so this warns instead of
 * silently drawing something the spec doesn't cover.
 */
export const MIN_RADAR_DIMENSIONS = 4;
export const MAX_RADAR_DIMENSIONS = 8;

/** Rings drawn, counting the outermost. Five is the sequential-ramp default too. */
const DEFAULT_RINGS = 5;

/**
 * Pixels held back outside the outer ring for the axis labels.
 *
 * TanStack's polar layout takes `inset` as a plain number — it has no access to
 * measured text, so it cannot size this gutter from the labels the way a
 * composed Cartesian chart sizes its left margin from the widest tick. 64px
 * clears about ten characters at the 12px floor; longer dimension names need the
 * caller to raise `labelGutter`.
 *
 * This is a spec-level size with no entry in `tokens.json` yet — see the token
 * request in the refactor report (`geometry.radarLabelGutter`).
 */
const DEFAULT_LABEL_GUTTER = 64;

/**
 * A radar is square and axis-free, so it takes none of `glMargin` — that
 * margin's 74px left / 52px bottom exist to clear a rotated Y label and an X
 * tick row, and applying it here would just shove the centre up and to the
 * right. The label gutter is `inset`'s job, not the margin's.
 *
 * All four sides are stated so that `glChart`'s merge over `glMargin` resolves
 * to exactly this and nothing leaks through. Like `DEFAULT_LABEL_GUTTER` these
 * are spec-level sizes with no `tokens.json` entry yet
 * (`geometry.radarMargin`).
 */
export const glRadarMargin = { top: 8, right: 8, bottom: 8, left: 8 } as const;

// ── Channels ────────────────────────────────────────────────────────────────

/**
 * Read a GL channel.
 *
 * Doubles as the adapter between the two calling conventions in play: `GLChannel`'s
 * accessor takes `(datum, { index, data })`, TanStack's takes
 * `(datum, index, data)`. Everything this module hands to a polar mark goes
 * through here, so a caller can pass an accessor and have it called correctly.
 */
function channel<T>(ref: GLChannel<T>): (datum: T, index: number, data: readonly T[]) => any {
  if (typeof ref === 'function') return ref;
  return (d) => (d as Record<string, unknown>)[ref as string];
}

/** Distinct values of a channel, in the order the reader first meets them. */
function distinct<T>(rows: readonly T[], ref: GLChannel<T>): string[] {
  const read = channel(ref);
  const seen = new Set<string>();
  rows.forEach((d, i) => seen.add(String(read(d, i, rows))));
  return [...seen];
}

/**
 * Sort rows onto the spoke order.
 *
 * Load-bearing, not tidiness: `radialLine` and `radialArea` join points in DATA
 * order, not in angle order. Rows that arrive shuffled produce a polygon that
 * crosses itself — a bowtie whose filled area is meaningless — with no warning
 * from TanStack. The angle scale's domain is the authority on the order, so the
 * rows are sorted onto it before either mark sees them.
 */
function inSpokeOrder<T>(rows: readonly T[], ref: GLChannel<T>, order: readonly string[]): T[] {
  const read = channel(ref);
  const rank = new Map(order.map((key, i) => [key, i]));
  const fallback = order.length;
  return rows
    .map((datum, index) => ({ datum, rank: rank.get(String(read(datum, index, rows))) ?? fallback }))
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.datum);
}

/**
 * Repeat the first vertex at the end so the ring closes.
 *
 * TanStack's polar marks expose `curve`, but only as a raw d3-shape
 * `CurveFactory` — reaching `curveLinearClosed` would mean importing `d3-shape`
 * directly, which is a transitive dependency of TanStack and not one this
 * package declares. Repeating the row is the same geometry without the
 * undeclared import.
 *
 * It also fixes a real defect, not just a cosmetic seam. `radialArea` runs
 * `d3.areaRadial` with an inner radius of 0, and d3 closes an area by walking
 * the baseline back — so an *open* ring emits `… → last vertex → centre → Z`,
 * and the fill comes out as a pac-man missing the wedge between the last
 * dimension and the first. With the vertex repeated, that closing walk
 * collapses into a zero-area sliver and the polygon fills correctly.
 *
 * Cost: the repeated row emits a second interaction point at the first vertex.
 * Harmless for hit-testing (it is the same coordinate) and invisible unless a
 * caller wires up a tooltip that counts points.
 */
function closeRing<T>(rows: readonly T[]): readonly T[] {
  return rows.length > 2 && rows[0] !== undefined ? [...rows, rows[0]] : rows;
}

// ── Options ─────────────────────────────────────────────────────────────────

export interface GLRadarChartOptions<T> {
  /** The dimension axis — one spoke per distinct value. Four to eight of them. */
  dimension: GLChannel<T>;
  /**
   * The value on the shared normalized scale. Every dimension must be on the
   * *same* scale — 0–1, 0–100, an index — because a radar's whole read is the
   * shape of the polygon, and a shape drawn over mixed units means nothing.
   */
  value: GLChannel<T>;
  /**
   * Entity partition. Only needed for the comparison series; a single-entity
   * radar (the spec's default framing) leaves this off.
   */
  series?: GLChannel<T>;
  /** Which entity carries the finding. Defaults to the first one in the data. */
  focus?: string;
  /**
   * Top of the shared scale — 1, 100, or whatever the common index tops out at.
   * Left off, the scale runs 0 → the data maximum, rounded outward to a value
   * the tick generator likes, so the outermost ring lands on a round number.
   */
  max?: number;
  /** Rings drawn, counting the outermost. Defaults to five. */
  rings?: number;
  /**
   * Exact ring values, bypassing the tick generator. Use when the rings carry
   * meaning the generator can't know — a policy threshold, a peer-group median.
   * The outermost ring is always `max` and does not need listing.
   */
  ringValues?: readonly number[];
  /** Formats the scale ticks along the top. Tabular figures come from CSS. */
  format?: (value: number) => string;
  /** The focus hue. Defaults to c-1, the single-series default. */
  tone?: GLToneRef;
  /** Pixels held back outside the outer ring for the axis labels. Default 64. */
  labelGutter?: number;
}

// ── Chart ───────────────────────────────────────────────────────────────────

/**
 * Radar chart — the profile of one entity across four to eight dimensions on a
 * shared normalized scale.
 *
 * A second series is supported and deliberately not more than that: it is
 * painted `c-muted` and stacked UNDER the focus polygon, which is the pop-up
 * effect (§14) in its radar form — the muted profile carries the baseline, the
 * saturated one carries the finding. Two translucent polygons are already at
 * the limit of what overlaps legibly; a third makes the intersections
 * unreadable and is refused with a warning.
 *
 * The spec's table names no legend or direct label for a radar, and there is
 * nowhere on the plot to put one — every outward position is spoken for by an
 * axis label. Identify the entities in the figure's subtitle or a legend in the
 * figure chrome, outside the plot.
 *
 * **No `variant`.** A radar draws text over its own polygon — the scale ticks
 * run up the vertical spoke, through the fill — so `labelHalo` looks like it
 * applies. It does not, for two independent reasons. First, the radar's answer
 * to that collision is already chosen and is not a halo: the polygon fills at
 * `opacity.radarFill` precisely so the rings and the tick numbers read *through*
 * it (see the module header). Stroking each number with paper would punch white
 * holes in the fill the low opacity exists to preserve. Second, it would not
 * even reach them: the ticks are POLAR GUIDE labels carrying
 * `.gl-radar__scale-tick`, not `text()` marks, and `gl-chart--label-halo` only
 * selects `.ts-chart__text text`. So the class would be an inert promise.
 */
export function glRadarChart<T>(
  data: readonly T[],
  o: GLRadarChartOptions<T>,
): GLChart<T, ChartValue, ChartValue> {
  const rows = [...data];
  const readValue = channel(o.value);

  // ── Entities ──────────────────────────────────────────────────────────
  const entities = o.series ? distinct(rows, o.series) : [];
  const focusKey = o.focus ?? entities[0];
  if (o.series && o.focus != null && !entities.includes(o.focus)) {
    warn(
      `\`focus\` names "${o.focus}", which is not in the data ` +
        `(${entities.join(', ')}). Nothing will be painted in the focus tone.`,
    );
  }
  if (entities.length > 2) {
    warn(
      `A radar holds one profile plus at most one comparison; ${entities.length} entities ` +
        `were passed. Painting "${String(focusKey)}" over "${String(
          entities.find((k) => k !== focusKey),
        )}" and dropping the rest. Overlapping translucent polygons stop ` +
        `resolving past two — small multiples are the right move here.`,
    );
  }

  const readSeries = o.series ? channel(o.series) : undefined;
  const partition = (key: string | undefined) =>
    readSeries == null
      ? rows
      : rows.filter((d, i) => String(readSeries(d, i, rows)) === String(key));

  const focusRows = o.series ? partition(focusKey) : rows;
  const compareKey = entities.find((key) => key !== focusKey);
  const compareRows = compareKey != null ? partition(compareKey) : [];

  // ── Dimensions ────────────────────────────────────────────────────────
  // Taken from the focus series so the spoke order is the focus entity's row
  // order; a comparison series with a different row order is sorted onto it.
  const dimensions = distinct(focusRows.length ? focusRows : rows, o.dimension);
  if (dimensions.length < MIN_RADAR_DIMENSIONS || dimensions.length > MAX_RADAR_DIMENSIONS) {
    warn(
      `A radar profiles ${MIN_RADAR_DIMENSIONS}–${MAX_RADAR_DIMENSIONS} dimensions; ` +
        `${dimensions.length} were passed. Below ${MIN_RADAR_DIMENSIONS} the polygon is a ` +
        `triangle whose area reports axis order more than data; above ` +
        `${MAX_RADAR_DIMENSIONS} the labels collide and the shape stops resolving. ` +
        `A ranked bar chart reads better at either extreme.`,
    );
  }

  // ── Radius scale ──────────────────────────────────────────────────────
  // Passed to `polar` as a configured INSTANCE, not a factory. TanStack infers
  // a domain only from factories (`resolveScaleInput` skips anything with a
  // `.copy` method), and inference is exactly what must not happen here: the
  // outermost ring has to sit at the top of the *shared* scale, not at whatever
  // the tallest observed value happened to be.
  const observed = rows
    .map((d, i) => Number(readValue(d, i, rows)))
    .filter((v) => Number.isFinite(v));
  const dataMax = observed.length ? Math.max(...observed) : 1;
  const ringCount = o.rings ?? DEFAULT_RINGS;

  const configured = scaleLinear().domain([0, o.max ?? (dataMax > 0 ? dataMax : 1)]);
  // Only round outward when the top wasn't stated. A caller who says `max: 1`
  // means 1, and nicening would push the outer ring past their scale.
  const radiusScale = o.max == null ? configured.nice(ringCount) : configured;
  const max = radiusScale.domain()[1];

  // Rings strictly inside the outer one. Zero is dropped: a ring of radius zero
  // is a point, and a "0" glyph at the exact centre sits under the polygon fill.
  const inner = (o.ringValues ?? radiusScale.ticks(ringCount)).filter(
    (v) => Number.isFinite(v) && v > 0 && v < max,
  );

  // ── Angle scale ───────────────────────────────────────────────────────
  // Also an instance, so the spoke order is the dimension order above rather
  // than the union of every mark's values in whatever order they materialize.
  const angleScale = scalePoint<string>().domain(dimensions);

  // ── Guides ────────────────────────────────────────────────────────────
  const tickText = {
    labels: true,
    labelFill: ink[2],
    labelFontSize: typeRoles.axisTick.size,
    labelClassName: 'gl-radar__scale-tick',
    // Straight up. `labelAngle` defaults to `layout.startAngle`, which is also
    // 0, but the spec states "along the top" outright so it is stated here too.
    labelAngle: 0,
    // Anchor the run of ticks just clear of the vertical spoke rather than on
    // top of it; the offset is the same 6px a Cartesian tick label takes.
    labelDx: geometry.tickLabelOffset,
    labelAnchor: 'start' as const,
    labelBaseline: 'middle' as const,
    ...(o.format ? { format: (value: ChartValue) => o.format!(Number(value)) } : {}),
  };

  const guides: PolarGuide[] = [
    // Two grid guides, not one, and this is the only way to get the rule. A
    // single `radialGrid` paints every ring with one `stroke`; the spec wants
    // the outermost in ink-3 (it is the axis, and it carries the vertices the
    // spokes run to) and the rest in the pale gridline. So the ring set is
    // split across two guides that differ only in stroke.
    radialGrid({
      ...tickText,
      values: inner,
      // Polygon, never circle: the spec runs the axis lines "to each vertex of
      // the outer ring", and a circle has no vertices.
      shape: 'polygon',
      stroke: surface.gridline,
      strokeWidth: geometry.gridlineWidth,
    }),
    radialGrid({
      ...tickText,
      values: [max],
      shape: 'polygon',
      stroke: ink[3],
      strokeWidth: geometry.gridlineWidth,
    }),
    // The axis lines. ink-3 rather than the ink-2 every Cartesian axis takes —
    // a radar carries one spoke per dimension, and at four to eight of them
    // full axis ink would out-shout the data.
    angleGrid({
      stroke: ink[3],
      strokeWidth: geometry.axisWidth,
      labels: true,
      labelFill: ink[2],
      labelFontSize: typeRoles.axisLabel.size,
      labelOffset: geometry.tickLabelOffset,
      labelClassName: 'gl-radar__axis-label',
    }),
  ];

  // ── Marks ─────────────────────────────────────────────────────────────
  const build = (subset: readonly T[], tone: GLTone, id: string): PolarMark<any, any, any>[] => {
    const ordered = inSpokeOrder(subset, o.dimension, dimensions);
    const ring = closeRing(ordered);
    const angle = channel(o.dimension);
    const radius = channel(o.value);
    // The repeated closing vertex makes the angle values non-unique, which is
    // what TanStack's key inference keys off. Stating the key keeps it from
    // warning about a fallback it would have made anyway.
    const key = (_datum: T, index: number) => index;

    return [
      // Fill and stroke are separate marks on purpose. `radialArea` would take
      // a stroke, but it would trace the *area* path — including the walk in to
      // the centre that closes it — and paint a 2px spoke from the first vertex
      // to the middle of the chart. `radialLine` strokes the ring alone.
      radialArea(ring, {
        id: `${id}-fill`,
        angle,
        radius,
        key,
        fill: tone.main,
        fillOpacity: opacity.radarFill,
      }),
      radialLine(ring, {
        id: `${id}-stroke`,
        angle,
        radius,
        key,
        stroke: tone.main,
        strokeWidth: geometry.radarStrokeWidth,
      }),
      // Vertices take the un-closed rows: the repeated first row would stack a
      // second dot on the first. No `stroke` — the spec says the dot is filled
      // only, and TanStack omits the attribute entirely when it is undefined,
      // so the circle inherits SVG's `stroke: none`.
      radialDot(ordered, {
        id: `${id}-vertex`,
        angle,
        radius,
        r: geometry.radarVertexRadius,
        fill: tone.main,
      }),
    ] as PolarMark<any, any, any>[];
  };

  const marks: PolarMark<any, any, any>[] = [
    // Comparison first, so it renders UNDER the focus polygon.
    ...(compareRows.length ? build(compareRows, muted, 'gl-radar-compare') : []),
    ...build(focusRows, resolveTone(o.tone), 'gl-radar-focus'),
  ];

  // `glChart` supplies the theme and the `gl-chart` class. Everything else here
  // is the radar's own, because a radar shares none of the Cartesian policy.
  return glChart<T, ChartValue, ChartValue>({
    marks: [
      polar({
        className: 'gl-radar',
        marks,
        guides,
        angle: { scale: angleScale, wrap: true },
        radius: { scale: radiusScale },
        // Reserves the label gutter. `inset` comes off the radius before the
        // marks are laid out, which is why the axis labels can sit outside the
        // outer ring without being clipped by the plot rect.
        inset: o.labelGutter ?? DEFAULT_LABEL_GUTTER,
      }),
    ],
    // No x, no y: `polar` resolves its own angle and radius scales and reports
    // `never` for both Cartesian scale values, so the spec type makes them
    // optional. `guides: false` then stops the chart drawing a Cartesian frame
    // around the polar one.
    guides: false,
    margin: { ...glRadarMargin },
  });
}
