/**
 * The GL chart: the theme layer, the axis presets, and one wrapper around
 * `defineChart`.
 *
 * TanStack's `ChartTheme` carries five fields — `foreground`, `muted`, `grid`,
 * `background`, `palette` — and nothing else. It has no concept of a font, a
 * stroke width, a tick length, or a mark default. Everything the GL spec pins
 * beyond those five colors therefore has to be applied at the call site, which
 * is what this module and `marks.ts` exist to do. `tests/constraints.test.ts`
 * asserts that the theme is still five fields, so if TanStack ever grows one,
 * that test fails and points here.
 *
 * Split of responsibility:
 *   tokens.css → the custom properties (generated from `tokens.json`)
 *   patch.css  → the values TanStack bakes into presentation attributes
 *   chart.ts   → the theme object, axis geometry, margins (what CSS cannot reach)
 *   marks.ts   → per-mark defaults
 *
 * There are no whole-chart presets for the Cartesian types on purpose. TanStack
 * can express a line, a scatter, a bar and a stack natively, so the GL layer only
 * needs to supply defaults — and a `glLineChart(rows, {…})`-shaped API would be a
 * second vocabulary to learn, one that can only ever express what its option bag
 * anticipated. Compose instead: `glChart({ marks: [glLine(…)], x, y })`, with the
 * non-obvious moves (the pop-up effect, stack ordering, tone ramps, direct
 * labels) available as named helpers in `compose.ts`. The chart types TanStack
 * *cannot* express — radar, treemap, boxplot/violin, choropleth — do ship as
 * whole-chart functions, under `@growth-lab/gl-charts/shapes`, because there the
 * layer supplies geometry rather than defaults.
 */

import { defineChart } from '@tanstack/charts';
import type {
  ChartAxisOptions,
  ChartAxisTickOptions,
  ChartDefinition,
  ChartTheme,
  ChartValue,
} from '@tanstack/charts';
import { scaleBand } from '@tanstack/charts-scales/band';
import { scaleLinear } from '@tanstack/charts-scales/linear';
import { scalePoint } from '@tanstack/charts-scales/point';

import { warn } from './dev.js';
import { formatDateTick, formatLogTick, scaleLog } from './scales.js';
import { categoricalMains, geometry, ink, surface } from './tokens.js';

/**
 * The GL chart theme.
 *
 * - `foreground` / `muted` → `ink-2`. The spec puts the axis line, axis labels,
 *   tick labels and annotations all on the same ink, so both fields collapse to
 *   one value. (TanStack defaults both to `currentColor`; we pin them so a
 *   chart dropped outside `.gl-figure` still renders on-spec.)
 * - `grid` → the pale warm gridline, never the axis ink.
 * - `background` → transparent, so the figure's paper shows through.
 * - `palette` → the six categorical MAIN tones, in the order the spec requires
 *   they be spent.
 *
 * Palette entries are literal hex, not `var(--c-1, …)`. TanStack's own default
 * uses CSS-variable strings, but those resolve to nothing under the Canvas
 * renderer and in server-rendered SVG. Literal hex works in every renderer;
 * the CSS custom properties in `tokens.css` remain the no-rebuild override path
 * for charts that do *not* pass this theme.
 */
export const glTheme: ChartTheme = {
  foreground: ink[2],
  muted: ink[2],
  grid: surface.gridline,
  background: 'transparent',
  palette: [...categoricalMains],
};

/**
 * Tick geometry — 4px stub, 6px gap to the label, both outward.
 * Spec Decision Rule 4: ticks are never inward.
 */
export const glTicks: ChartAxisTickOptions = {
  size: geometry.tickLength,
  padding: geometry.tickLabelOffset,
};

/**
 * Axis-label placement. **Must stay `'auto'`.**
 *
 * The spec measures the axis-label offset from the *start of the tick label*,
 * not from the axis line — precisely so a wide tick like "250" cannot collide
 * with the rotated Y label. TanStack's two modes pick different reference
 * points, and only one of them matches:
 *
 *   offset: <number>  →  x = chartX - offset          (from the AXIS LINE)
 *   offset: 'auto'    →  x = tickLabelLeft - 8 - w    (from the TICK LABEL) ✓
 *
 * So a numeric offset — even the spec's literal 20 — selects the wrong
 * reference and drives the label straight into the tick labels. `'auto'` is the
 * only setting that implements the rule.
 *
 * Known deviation: `'auto'` leaves an 8px gap where the spec asks for 20px.
 * The reference point is right and the collision is gone; the gap is 12px
 * tighter than specified. Closing it would mean replacing the whole serializer
 * through `renderSvg`, which is not worth it for 12px — but see
 * `geometry.axisLabelOffset` for the value if that ever changes.
 */
const AXIS_LABEL_OFFSET = 'auto' as const;

/**
 * Plot margins. The left margin has to clear the rotated Y axis label *plus*
 * the widest tick label — the spec measures the axis-label offset from the
 * start of the tick label, not from the axis line, precisely so wide numbers
 * like "250" don't collide with the label.
 */
export const glMargin = { top: 8, right: 16, bottom: 52, left: 74 } as const;

/** Margin variant for charts that carry direct end-labels instead of a legend. */
export const glMarginEndLabels = { ...glMargin, right: 72 } as const;

export interface GLAxisPreset<TValue extends ChartValue = number> {
  label?: string;
  format?: (value: TValue) => string;
  /** Override the default gridline decision. */
  grid?: boolean;
  nice?: boolean;
  tickCount?: number;
  /**
   * Exact tick values, bypassing the scale's own generator. Use when the ticks
   * carry meaning the generator can't know about — the first and last year of a
   * series, a policy threshold, the reference year an index is based on.
   */
  values?: readonly TValue[];
  /**
   * Exact domain, bypassing inference from the data. `[min, max]` on a
   * continuous axis; the full category list, in order, on a band or point axis.
   *
   * Two different problems need it, and both are invisible until you look:
   *
   *   - **Continuous.** Marks with a fixed PIXEL extent — a 6px scatter circle,
   *     a vector's shaft and head — are wider than their datum, and TanStack
   *     infers a domain from data values alone. A point on the data minimum then
   *     renders half outside the plot, across the axis line and into the tick
   *     labels. `nice` does not fix it: nicening rounds to a tick and the extreme
   *     datum can land exactly on it.
   *   - **Categorical.** A band scale takes its domain from the order it MEETS
   *     each category, so any chart that reorders its rows reorders its axis.
   *     `popUp` does exactly that — it emits the muted backdrop before the focus
   *     series — which silently sends the highlighted bar of a *ranked* chart to
   *     the end of the axis. Pin the order and the ranking survives the highlight.
   */
  domain?: readonly TValue[];
}

/** The tick block shared by every preset: geometry, then whatever the caller pinned. */
function ticksFor<TValue extends ChartValue>(
  opts: GLAxisPreset<TValue>,
): ChartAxisTickOptions<TValue> {
  return {
    ...glTicks,
    ...(opts.format ? { format: opts.format } : {}),
    ...(opts.tickCount ? { count: opts.tickCount } : {}),
    ...(opts.values ? { values: opts.values } : {}),
  };
}

/**
 * The scale for a continuous preset: the bare factory, or a CONFIGURED INSTANCE
 * when the caller pinned a domain.
 *
 * TanStack has no `domain` field on an axis — its own doc comment says why: "a
 * D3 scale factory infers its domain from materialized mark channels; a scale
 * instance retains its configured domain." So pinning a domain means handing it
 * an instance instead of a factory, which is the same move `shapes/radar.ts`
 * makes to keep the outer ring on the shared scale rather than on the tallest
 * observed value.
 *
 * Nicening is suppressed alongside it. `nice` runs *after* the domain resolves,
 * so it would round the pinned bounds straight back out — and a caller who
 * padded a domain by exactly one scatter radius means that number.
 */
function continuousScale(
  opts: GLAxisPreset,
  { niceByDefault }: { niceByDefault: boolean },
  factory: () => any = scaleLinear,
): { scale: any; nice: boolean | number } {
  // A pinned domain turns nicening off unless the caller asked for it back.
  const nice = opts.nice ?? (opts.domain ? false : niceByDefault);
  if (!opts.domain) return { scale: factory, nice };
  return { scale: factory().domain([...opts.domain]), nice };
}

/**
 * Continuous Y axis — the common case. Gridlines ON: a vertical scale is where
 * the reader estimates values off the axis, which is the spec's stated test for
 * when a gridline earns its place.
 */
export function glAxisY(opts: GLAxisPreset = {}): ChartAxisOptions<number> {
  const { scale, nice } = continuousScale(opts, { niceByDefault: true });
  return {
    scale,
    nice,
    grid: opts.grid ?? true,
    axis: {
      line: true,
      ...(opts.label ? { label: { text: opts.label, offset: AXIS_LABEL_OFFSET } } : {}),
      ticks: ticksFor(opts),
    },
  };
}

/**
 * Continuous X axis. Gridlines OFF by default — the spec forbids both X and Y
 * gridlines unless the chart is genuinely dense. Pass `grid: true` only then.
 */
export function glAxisX(opts: GLAxisPreset = {}): ChartAxisOptions<number> {
  const { scale, nice } = continuousScale(opts, { niceByDefault: true });
  return {
    scale,
    nice,
    grid: opts.grid ?? false,
    axis: {
      line: true,
      ...(opts.label ? { label: { text: opts.label, offset: AXIS_LABEL_OFFSET } } : {}),
      ticks: ticksFor(opts),
    },
  };
}

/**
 * X axis for a pure year scale.
 *
 * Deliberately takes no `label`: "when the X axis is just years, omit the axis
 * label — the tick labels already say what the dimension is." Making the
 * parameter unavailable is cheaper than auditing for it later.
 *
 * For ticks pinned to the first and last year actually present in the data, use
 * `yearAxisFor(rows, x)` from `compose.ts`, which is the common case.
 *
 * `domain` routes through `continuousScale` like every other continuous preset.
 * It used to be accepted and silently dropped — this preset built its scale
 * field by hand — which is the same class of defect the dead `domain` key on
 * `glAxisPercent` was. It matters most exactly here: a year axis is the one
 * place a chart routinely puts a 6px dot on the first and last datum, so the
 * endpoints need half a circle of room and there is no other way to ask for it.
 */
export function glAxisYear(
  opts: Omit<GLAxisPreset, 'label'> = {},
): ChartAxisOptions<number> {
  const { scale, nice } = continuousScale(opts, { niceByDefault: false });
  return {
    scale,
    nice,
    grid: false,
    axis: {
      line: true,
      ticks: {
        ...ticksFor(opts),
        format: opts.format ?? ((v: number) => String(Math.round(v))),
      },
    },
  };
}

/**
 * X axis for years on a CATEGORICAL scale — one slot per year.
 *
 * A stacked bar chart is categorical on x by construction: each bar owns a slot,
 * it is not a sample of a continuum. Putting years on `glAxisYear` (linear)
 * centres each bar on a point position instead, so half the first bar falls left
 * of the axis line and half the last falls past the right edge of the plot.
 *
 * Takes no label, for the same reason `glAxisYear` doesn't: the ticks say it.
 */
export function glAxisYearBand(
  opts: Omit<GLAxisPreset<string>, 'label' | 'nice'> = {},
): ChartAxisOptions<string> {
  return glAxisBand(opts);
}

/**
 * Logarithmic X or Y axis.
 *
 * The spec's scatter plots put income on a log scale and TanStack ships no log
 * scale, so this wires up the one in `scales.ts`. The domain rounds outward to
 * 1–2–5 bounds and ticks land on 1–2–5 steps, thinning to decades when a
 * multi-decade span would otherwise crowd.
 *
 * Gridlines follow the same rule as the linear presets — on for Y, off for X —
 * so pass `grid` explicitly if this is the X axis of a dense chart.
 */
export function glAxisLog(opts: GLAxisPreset = {}): ChartAxisOptions<number> {
  return {
    scale: opts.domain ? scaleLog().domain([...opts.domain]) : scaleLog,
    grid: opts.grid ?? false,
    axis: {
      line: true,
      ...(opts.label ? { label: { text: opts.label, offset: AXIS_LABEL_OFFSET } } : {}),
      ticks: { ...ticksFor(opts), format: opts.format ?? formatLogTick },
    },
  };
}

/**
 * Categorical X axis for bars — `geometry.bandPadding` (0.28) between bands, so
 * a ranked list reads as discrete items.
 *
 * Pass `padding` only when the data says to. The one case that genuinely
 * differs is a binned axis, and it has its own preset (`glAxisBin`) so the
 * intent is visible at the call site rather than encoded in a magic number.
 */
export function glAxisBand(
  opts: Omit<GLAxisPreset<string>, 'nice'> & { padding?: number } = {},
): ChartAxisOptions<string> {
  const padding = opts.padding ?? geometry.bandPadding;
  return {
    // An INSTANCE when the order is pinned, a factory otherwise. TanStack infers
    // a domain from a factory and leaves an instance's own domain alone, so
    // returning the configured scale from a closure would have it re-inferred.
    scale: opts.domain
      ? (scaleBand().domain([...opts.domain]).padding(padding) as never)
      : () => scaleBand().padding(padding),
    grid: opts.grid ?? false,
    axis: {
      line: true,
      ...(opts.label ? { label: { text: opts.label, offset: AXIS_LABEL_OFFSET } } : {}),
      ticks: ticksFor(opts) as ChartAxisTickOptions<string>,
    },
  };
}

/**
 * Categorical axis for BINNED data — a histogram, a matrix heatmap, a calendar,
 * a Marimekko. Zero padding, and that is the whole point of the preset.
 *
 * Bins partition a continuum, so their marks have to abut. Drawing a histogram
 * on `glAxisBand` puts a 28% gap between adjacent bins and invents a
 * discreteness the data does not have — the reader sees categories where the
 * analyst measured a distribution (`grammar.md` §3.5).
 */
export function glAxisBin(
  opts: Omit<GLAxisPreset<string>, 'nice'> = {},
): ChartAxisOptions<string> {
  return glAxisBand({ ...opts, padding: geometry.binPadding });
}

/** Categorical X axis for lines/areas over discrete categories. */
export function glAxisPoint(
  opts: Omit<GLAxisPreset<string>, 'nice'> = {},
): ChartAxisOptions<string> {
  return {
    scale: opts.domain
      ? (scalePoint<string>().domain([...opts.domain]).padding(geometry.pointPadding) as never)
      : () => scalePoint<string>().padding(geometry.pointPadding),
    grid: opts.grid ?? false,
    axis: {
      line: true,
      ...(opts.label ? { label: { text: opts.label, offset: AXIS_LABEL_OFFSET } } : {}),
      ticks: ticksFor(opts) as ChartAxisTickOptions<string>,
    },
  };
}

/**
 * Percent axis — for a normalized (100%) stack, a share, a rate.
 *
 * Takes the domain in the units the data is already in: `scale: 'fraction'`
 * for 0–1 values, `'percent'` for 0–100. Both label as `0%…100%`, which is the
 * only thing the reader should have to know.
 *
 * Pinned to a 0–1 or 0–100 domain rather than `nice`-ing the data's own extent:
 * a normalized stack that topped out at 97% would otherwise draw a y axis that
 * stops at 97, and "the parts sum to the whole" is the one thing this chart
 * exists to say.
 */
export function glAxisPercent(
  opts: GLAxisPreset & { scale?: 'fraction' | 'percent' } = {},
): ChartAxisOptions<number> {
  const full = opts.scale === 'percent' ? 100 : 1;
  return {
    ...glAxisY({ ...opts, nice: false, domain: opts.domain ?? [0, full] }),
    axis: {
      line: true,
      ...(opts.label ? { label: { text: opts.label, offset: AXIS_LABEL_OFFSET } } : {}),
      ticks: {
        ...ticksFor(opts),
        values: opts.values ?? [0, full / 4, full / 2, (full * 3) / 4, full],
        format: opts.format ?? ((v: number) => `${Math.round((v / full) * 100)}%`),
      },
    },
  } as ChartAxisOptions<number>;
}

/**
 * Date axis — a linear scale over epoch milliseconds, with ticks pinned to the
 * span's endpoints and formatted at whatever unit the span calls for.
 *
 * TanStack ships no time scale (`@tanstack/charts-scales` is band, linear,
 * ordinal, point), so dates reach a chart as numbers either way. This preset
 * makes that legible instead of leaving every caller to format epoch ms by
 * hand: pass `Date` objects or numbers through `timeAxisFor(rows, x)` in
 * `compose.ts` and the ticks come back labelled `2019 … 2024`, `Mar 2020 …`,
 * or `4 Mar …` depending on how long the span is (`grammar.md` §3.5).
 */
export function glAxisTime(
  opts: Omit<GLAxisPreset, 'nice'> = {},
): ChartAxisOptions<number> {
  const { scale } = continuousScale(opts, { niceByDefault: false });
  return {
    scale,
    nice: false,
    grid: opts.grid ?? false,
    axis: {
      line: true,
      ...(opts.label ? { label: { text: opts.label, offset: AXIS_LABEL_OFFSET } } : {}),
      ticks: {
        ...ticksFor(opts),
        format: opts.format ?? ((v: number) => formatDateTick(v, opts.values)),
      },
    },
  };
}

// ── glChart ─────────────────────────────────────────────────────────────────

/**
 * The per-chart rules that are only reachable through CSS, because TanStack bakes
 * the corresponding value into a presentation attribute with no API to change it.
 * Each one maps to a rule in `patch.css` or `shapes.css`.
 */
export interface GLChartVariant {
  /**
   * Stacked BAR chart — cuts the 1px gap between segments. `barY` exposes no
   * stroke option and its `inset` trims width rather than height, so the gap has
   * to come from CSS. Stacked *areas* must not set this: they sit edge-to-edge
   * by design, separated by the tone step alone.
   */
  stacked?: boolean;
  /**
   * Labels land ON data rather than beside it — a bubble scatter's focus label,
   * an annotation inside the plot. Adds the paper halo the spec requires there.
   * The glyphs stay in the dark tone; the halo only keeps them legible against
   * whatever they cross.
   */
  labelHalo?: boolean;
  /**
   * Zero is a genuine baseline the reader measures from (gains vs. losses), so
   * the gridline at zero is promoted to axis weight. Leave it off when the axis
   * merely happens to span zero — an index, a z-score — where a heavy rule
   * through mid-plot reads as a second axis.
   */
  zeroBaseline?: boolean;
  /**
   * Treemap. Tiles abut across a computed gutter, which leaves faint antialiased
   * seams at some sizes; `shape-rendering: crispEdges` snaps the shared edges
   * onto the pixel grid so adjacent tiles meet cleanly.
   */
  treemap?: boolean;
}

/**
 * Build the `className` for a `<Chart>`.
 *
 * Prefer `glChart()`, which returns this alongside the definition so the two
 * cannot get out of step. This is for a definition built by hand.
 */
export function glChartProps(variant: GLChartVariant = {}): { className: string } {
  return {
    className: [
      'gl-chart',
      variant.stacked && 'gl-chart--stacked',
      variant.labelHalo && 'gl-chart--label-halo',
      variant.zeroBaseline && 'gl-chart--zero-baseline',
      variant.treemap && 'gl-chart--treemap',
    ]
      .filter(Boolean)
      .join(' '),
  };
}

type AnySpec = Record<string, any>;

export interface GLChartSpec extends AnySpec {
  marks: readonly unknown[];
  /** Merged over `glMargin`; pass only the sides you are changing. */
  margin?: Partial<Record<keyof typeof glMargin, number>>;
  /**
   * The chart carries direct end-labels, so the right margin widens to hold
   * them. Set this whenever you pass `endLabels(...)` marks.
   */
  endLabels?: boolean;
  variant?: GLChartVariant;
}

/**
 * A built GL chart: the definition, and the class the CSS patches need.
 *
 * Returning both together is deliberate. Several spec rules can only be applied
 * through CSS, and which of them apply is a property of the chart — so making
 * the caller remember to spread the right one of several prop bags was a
 * standing invitation to render a stacked bar with no inter-segment gap. Spread
 * `props` and it cannot happen.
 */
export interface GLChart<
  T = unknown,
  X extends ChartValue = ChartValue,
  Y extends ChartValue = ChartValue,
> {
  definition: ChartDefinition<T, X, Y>;
  className: string;
  /** Spread onto `<Chart>`; add `height` and `ariaLabel` yourself. */
  props: { definition: ChartDefinition<T, X, Y>; className: string };
}

/** Options for the dynamic (`ctx => spec`) form, which has no static spec to read. */
export interface GLChartOuterOptions {
  variant?: GLChartVariant;
}

function withDefaults(spec: GLChartSpec): AnySpec {
  const { marks, margin, endLabels, variant: _variant, ...rest } = spec;
  const base = endLabels ? glMarginEndLabels : glMargin;

  // `color: toneRamp(…)` is the composed idiom for a one-hue stack, and
  // `toneRamp` returns undefined when it can't build a ramp (no `order`) so the
  // chart falls back to the categorical palette. Dropping the key here is what
  // makes that fallback work — a present-but-undefined `color` is not the same
  // as an absent one to `defineChart`.
  if ('color' in rest && rest.color === undefined) delete rest.color;

  return {
    theme: glTheme,
    ...rest,
    marks,
    margin: { ...base, ...margin },
  };
}

/**
 * Wrap a chart spec in the GL theme, margins and variant class.
 *
 * Everything not named in `GLChartSpec` is passed to `defineChart` untouched, so
 * the whole TanStack surface stays reachable — including `theme`, if a chart
 * genuinely needs to override it.
 *
 * Accepts the dynamic `(ctx) => spec` form for charts whose layout depends on the
 * pixel size (a treemap computes its tiles from it). The variant can't be read
 * out of a spec that doesn't exist yet, so the dynamic form takes it as the
 * second argument:
 *
 *   glChart((ctx) => ({ marks: tilesFor(ctx) }), { variant: { treemap: true } })
 */
export function glChart<
  T = unknown,
  X extends ChartValue = ChartValue,
  Y extends ChartValue = ChartValue,
>(
  spec: GLChartSpec | ((ctx: any) => GLChartSpec),
  outer: GLChartOuterOptions = {},
): GLChart<T, X, Y> {
  const variant = outer.variant ?? (typeof spec === 'function' ? {} : spec.variant) ?? {};
  const { className } = glChartProps(variant);

  // Cast at the boundary, once. TanStack's `defineChart` overloads resolve the
  // spec's generics from the literal passed in; a spec assembled at runtime — the
  // whole job of this function — can't satisfy that inference, and neither can a
  // `(ctx) => spec` closure whose return type is only known at call time.
  const definition = (
    typeof spec === 'function'
      ? defineChart(((ctx: any) => {
          const resolved = spec(ctx);
          if (resolved.variant && !outer.variant) {
            warn(
              'A dynamic chart spec set `variant`, which cannot reach the ' +
                'className because the spec is resolved after render. Pass it as ' +
                'the second argument: glChart(fn, { variant: … }).',
            );
          }
          return withDefaults(resolved);
        }) as any)
      : defineChart(withDefaults(spec) as any)
  ) as ChartDefinition<T, X, Y>;

  return { definition, className, props: { definition, className } };
}
