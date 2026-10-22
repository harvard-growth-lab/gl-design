/**
 * Geomaps — the spec's two choropleths (§12 sequential, §13 diverging).
 *
 * This is the only module that reaches into `@tanstack/charts/geo`. `geoShape`
 * is a **subpath export and is not on the package root**, and it is the sole
 * export there; isolating the import here means a consumer who never draws a
 * map never pulls `d3-geo` into their bundle, and the rest of the library keeps
 * building if the subpath moves in a pre-alpha patch release.
 *
 * Three things make a choropleth different from every chart that can be composed
 * out of marks, and they drive the whole shape of this file:
 *
 *   1. **There are no Cartesian axes.** Position comes from a projection, not
 *      from an x/y scale, so the spec is built with `guides: false` and no
 *      `x`/`y` at all. `geoShape` declares its scale value types as `never`,
 *      which is TanStack's way of saying those keys must be omitted.
 *
 *   2. **Color is the only encoding**, and it has to be ordered. As in the rest
 *      of the library, an ordered fill cannot be set per-datum without
 *      bypassing the chart-level scale — so the value routes through the
 *      `color` channel and the scale does all the painting (the `paint()` rule
 *      from `marks.ts`, restated for geometry).
 *
 *   3. **The legend is part of the chart, not the figure chrome.** §12 asks for
 *      a horizontal step legend under the title; TanStack renders that inside
 *      the SVG, above the plot, which is exactly where "under the title" lands
 *      once `GLFigure` puts the title above the `<Chart>`.
 *
 * One thing this file cannot fix: `colorLegend()` hard-codes `fontSize: 10` on
 * its boundary labels and `11` on its title, below the spec's 12px floor, and
 * dilutes both with `fillOpacity` 0.72/0.78. Those are literals in TanStack's
 * `legend.js` with no option to override, so — as with the gridline opacity —
 * the correction lives in `theme.css`, where a CSS declaration outranks the SVG
 * presentation attribute.
 */

import { colorLegend } from '@tanstack/charts';
import type {
  ChartColorScale,
  ChartKey,
  ChartValue,
  ConfiguredColorScaleLike,
  ResolvedColorScale,
} from '@tanstack/charts';
import { geoShape } from '@tanstack/charts/geo';
import type { GeoProjectionDescriptor, GeoShapeOptions } from '@tanstack/charts/geo';

import { glChart, type GLChart } from '../chart.js';
import { warn } from '../dev.js';
import { formatLogTick, glDivergingColor, glSequentialColor } from '../scales.js';
import {
  geometry,
  ink,
  muted,
  opacity,
  type GLDivergingKey,
  type GLSequentialKey,
} from '../tokens.js';

// ── Geo types, derived rather than imported ─────────────────────────────────
//
// `d3-geo` is a *transitive* dependency: `@tanstack/charts` depends on it
// directly (pinned 3.1.1, alongside `@types/d3-geo`), and this package declares
// neither. Under npm's flat install it happens to be reachable — it is sitting
// in `node_modules/d3-geo` right now — but that is an artifact of hoisting, not
// a contract. Under pnpm, Yarn PnP, or `npm --install-strategy=nested` the bare
// specifier `d3-geo` would not resolve from here at all.
//
// So this file never writes `from 'd3-geo'`. Every geo type it needs is pulled
// back out of the descriptor TanStack already exports, which means the types
// travel with the peer dependency that actually owns them. The projection
// *value* is likewise never constructed here — the caller supplies the factory
// (see `GLProjectionFactory`), and the caller is the one who already depends on
// `d3-geo` or `topojson-client` to have GeoJSON in the first place.

/** `GeoPermissibleObjects` — anything `d3-geo`'s path generator can draw. */
export type GLGeoObject = Exclude<GeoProjectionDescriptor['fit'], 'data' | 'sphere'>;

/**
 * A bare d3 projection factory: `geoNaturalEarth1`, `geoAlbersUsa`,
 * `() => geoMercator().rotate([-10, 0])`, `geoIdentity` for pre-projected data.
 *
 * Deliberately **not** TanStack's full `GeoProjectionInput`. That type also
 * admits `(context) => projection`, and a zero-argument factory is structurally
 * assignable to it — so a union of the two is indistinguishable to both the
 * compiler and the runtime, and passing `geoNaturalEarth1` where the context
 * form was expected silently yields an unfitted projection drawn at d3's
 * default scale and translate. Taking only the factory and building the
 * descriptor here removes that failure mode: fitting is this file's job, always.
 */
export type GLProjectionFactory = GeoProjectionDescriptor['type'];

/** What the projection is fitted to. `'data'` = the features being drawn. */
export type GLGeoFit = GeoProjectionDescriptor['fit'];

// ── The join ────────────────────────────────────────────────────────────────

/**
 * The value side of the join.
 *
 * A choropleth is always two datasets: geometry that changes once a decade, and
 * numbers that change every release. They are never one table, so the preset
 * takes them separately and joins on a key rather than pretending the caller
 * has already merged them (which is where the joins silently go wrong — an
 * ISO-2 code against an ISO-3 boundary file produces a plausible, empty map).
 *
 * Pass a `Map` when the values are already keyed, or `{ rows, id, value }` for
 * the ordinary case of a table plus two accessors. `id` on this side and `id`
 * on the feature side name the *same* key from the two directions.
 */
export type GLGeoValues<R> =
  | ReadonlyMap<ChartKey, number>
  | {
      rows: readonly R[];
      /** Row → join key. Must produce the same keys as the feature accessor. */
      id: (row: R, index: number) => ChartKey | null | undefined;
      /** Row → the encoded number. */
      value: (row: R, index: number) => number | null | undefined;
    };

/**
 * Resolve every feature to a number, or to `undefined` where the join found
 * nothing. `undefined` is load-bearing downstream: it is what routes a region
 * to the no-data fill instead of to the palest bin.
 */
function joinValues<F, R>(
  features: readonly F[],
  id: (feature: F, index: number) => ChartKey | null | undefined,
  values: GLGeoValues<R>,
): (number | undefined)[] {
  const table = new Map<ChartKey, number>();
  if ('rows' in values) {
    values.rows.forEach((row, index) => {
      const key = values.id(row, index);
      const value = values.value(row, index);
      if (key != null && typeof value === 'number' && Number.isFinite(value)) {
        table.set(key, value);
      }
    });
  } else {
    for (const [key, value] of values) {
      if (Number.isFinite(value)) table.set(key, value);
    }
  }

  return features.map((feature, index) => {
    const key = id(feature, index);
    if (key == null) return undefined;
    const value = table.get(key);
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  });
}

// ── Ordered color, with a legend that tells the truth ───────────────────────

/**
 * The extra methods `glSequentialColor`/`glDivergingColor` really carry.
 *
 * Their declared return type is `ConfiguredColorScaleLike`, whose `domain` and
 * `range` are optional and which has no `thresholds` at all. The concrete
 * objects have all three — `thresholds()` is what earns TanStack's `quantize`
 * classification — so this is the shape, not a widening.
 */
type SteppedScale = ConfiguredColorScaleLike<number, string> & {
  domain: () => readonly number[];
  range: () => readonly string[];
  thresholds: () => readonly number[];
};

export interface GLChoroplethColorOptions {
  /** §12 vs. §13. Sequential unless the value has a real midpoint. */
  kind?: 'sequential' | 'diverging';
  ramp?: GLSequentialKey | GLDivergingKey | readonly string[];
  /** `[min, max]` of the encoded variable. Bins are cut across this. */
  domain: readonly [number, number];
  /** GLBin count. Defaults to the ramp's authored length — five, or six diverging. */
  steps?: number;
  /** Diverging only. The reference the two hues meet at. */
  midpoint?: number;
  /** Fill for regions the join did not reach. */
  missing?: string;
}

/**
 * The choropleth's color scale, as a TanStack `ChartColorScale`.
 *
 * **Why not `color: { scale }`** — which is what `glSequentialColor` returns and
 * how every other GL chart supplies color. Two things break on that path, both
 * verified against the installed 0.6.5 build rather than the docs:
 *
 *   - `createColorScale()` resolves a configured scale to
 *     `{ type, kind, domain, range, map }` and **never populates
 *     `ResolvedColorScale.thresholds`**, even though the field exists and the
 *     legend reads it first. So the legend falls back to *re-deriving* the bin
 *     boundaries from `domain` — and `steppedColor()` in `scales.ts` returns the
 *     thresholds *as* its domain. The bins render (the `quantize` classification
 *     does work), but a 5-step ramp over `[0, 100]` labels its boundaries
 *     20 / 32 / 44 / 56 / 68 / 80 instead of 0 / 20 / 40 / 60 / 80 / 100. A
 *     legend that misreports its own breaks is worse than no legend.
 *
 *   - `map(null)` on a resolved configured scale returns `range[0]` — the palest
 *     bin. Every region the join missed would be painted as the lowest value in
 *     the data. That is not a cosmetic default; it is a false statement.
 *
 * A `ChartColorScale` is the supported extension point for both: `resolve()`
 * returns the `ResolvedColorScale` verbatim, so the exact thresholds reach the
 * legend and `map` can route no-data to its own fill. The binning itself still
 * comes from `scales.ts` — this only carries the result across.
 *
 * `context.domain` / `context.range` / `context.values` are ignored: the preset
 * has already resolved all three from the joined data, and re-inferring here
 * would let the legend and the polygons disagree.
 */
export function glChoroplethColor(o: GLChoroplethColorOptions): ChartColorScale {
  const [lo, hi] = o.domain;
  const scale = (
    o.kind === 'diverging'
      ? glDivergingColor({
          ramp: o.ramp as GLDivergingKey | readonly string[] | undefined,
          domain: [lo, hi],
          midpoint: o.midpoint,
          steps: o.steps,
        })
      : glSequentialColor({
          ramp: o.ramp as GLSequentialKey | readonly string[] | undefined,
          domain: [lo, hi],
          steps: o.steps,
        })
  ) as SteppedScale;

  const range = scale.range();
  const thresholds = scale.thresholds();
  const missing = o.missing ?? muted.light;

  const resolved: ResolvedColorScale = {
    type: 'gl-ordered',
    // `quantize` is what makes `colorLegend()` draw discrete swatches with
    // boundary labels instead of a 32-stop gradient. It is a claim about the
    // shape of the scale, and an equal-width binning is exactly that.
    kind: 'quantize',
    // The *value extent*, not the cut points — this is what the legend prints at
    // its two ends, and what `thresholds` sits between.
    domain: [lo, hi],
    range: [...range],
    thresholds: [...thresholds],
    map: (value) =>
      typeof value === 'number' && Number.isFinite(value) ? scale(value) : missing,
  };

  return { id: 'gl-choropleth', resolve: () => resolved };
}

// ── The mark ────────────────────────────────────────────────────────────────

export interface GLGeoShapeOptions<F extends GLGeoObject>
  extends Omit<GeoShapeOptions<F>, 'fillOpacity'> {}

/**
 * Choropleth polygon — full opacity, `ink-3` hairline at `geometry.mapStrokeWidth`
 * (§5).
 *
 * The stroke is not decoration and not a border: it is what separates one
 * region from the next where two same-bin neighbours would otherwise fuse into
 * a single blob. It stays at `ink-3` rather than the fill's own dark tone
 * because a choropleth's fills are a ramp, not a palette — there is no "this
 * mark's dark tone" to reach for.
 *
 * Full opacity follows Decision Rule 3: polygons are a single layer, nothing
 * overlaps, and reducing opacity would only dilute the ramp it took five
 * carefully spaced steps to build.
 *
 * Setting `fill` here would bypass the chart color scale for *every* feature,
 * so the presets leave it unset and let the `color` channel paint — the same
 * contract `paint()` enforces in `marks.ts`.
 */
export function glGeoShape<F extends GLGeoObject>(
  features: Iterable<F>,
  options: GLGeoShapeOptions<F>,
) {
  return geoShape(features, {
    ...options,
    fillOpacity: opacity.full,
    stroke: options.stroke ?? ink[3],
    strokeWidth: options.strokeWidth ?? geometry.mapStrokeWidth,
  });
}

// ── Chart preset ────────────────────────────────────────────────────────────

export interface GLGeoLegendOptions {
  /** Names the encoded variable. Omit when the subtitle already says it. */
  label?: string;
  /** Boundary-label formatter. Defaults to a compact `1.2k` / `33.3` form. */
  format?: (value: number) => string;
  /** Legend width in px. TanStack clamps to `[80, plot width]`. Defaults to 240. */
  width?: number;
}

interface GLChoroplethBase<F extends GLGeoObject, R> {
  /**
   * A d3 projection factory. Not called with any arguments — this file fits it
   * to the plot itself, via `fit`/`inset` below.
   *
   * ```ts
   * import { geoNaturalEarth1 } from 'd3-geo';
   * glChoroplethChart(countries, { projection: geoNaturalEarth1, … })
   * ```
   *
   * The caller supplies it because this package does not depend on `d3-geo` and
   * should not start: the projection is an editorial choice (equal-area for a
   * quantity, Albers USA for states, identity for pre-projected tiles) that no
   * default can make correctly, and the caller already holds the dependency
   * that produced their GeoJSON.
   */
  projection: GLProjectionFactory;
  /**
   * What the projection is fitted into. `'data'` — the default — frames the
   * features being drawn; `'sphere'` keeps a whole-world frame even when the
   * data is one continent; an explicit geometry frames something else entirely
   * (a basemap that extends past the regions carrying values).
   */
  fit?: GLGeoFit;
  /** Padding in px between the fitted geometry and the plot edge. */
  inset?: number;

  /**
   * Feature → join key. Reads whatever your boundary file carries:
   * `(f) => f.id`, `(f) => f.properties.iso3`, `(f) => f.properties.GEOID`.
   *
   * Also used as the mark's reconciliation key, so an animated update moves
   * each region rather than cross-fading the whole map. Without it TanStack
   * falls back to array index and warns.
   */
  id: (feature: F, index: number) => ChartKey | null | undefined;
  /** The numbers, keyed by the same id. */
  values: GLGeoValues<R>;

  /**
   * Value extent. Inferred from the joined values when omitted.
   *
   * Pin it when several maps must be read against each other — small multiples
   * over time, or a before/after pair. Independently inferred domains make two
   * maps look comparable when they are not.
   */
  domain?: readonly [number, number];
  /** GLBin count. Defaults to the ramp's authored length. */
  steps?: number;
  /**
   * Fill for regions the join did not reach. Defaults to `c-muted-light`.
   *
   * It has to be *outside* the ramp, not the palest step of it: the ramps are
   * blue, red, teal, purple, orange and yellow, so a cool grey cannot be
   * misread as "the lowest value". No data and the lowest value are different
   * claims and must not share a swatch.
   */
  missing?: string;
  /** The step legend (§12). Pass `false` when the map is a small multiple. */
  legend?: false | GLGeoLegendOptions;
}

/**
 * §12 — the value runs low→high with no natural midpoint. Population, GDP,
 * complexity, counts, shares. Five steps on one hue; darker is higher, always.
 */
export interface GLSequentialChoroplethOptions<F extends GLGeoObject, R>
  extends GLChoroplethBase<F, R> {
  kind?: 'sequential';
  /** Defaults to `sequential-1` (blue) unless the variable has a hue convention. */
  ramp?: GLSequentialKey | readonly string[];
}

/**
 * §13 — the value has a meaningful midpoint. Change against a baseline, gain
 * vs. loss, above vs. below average. Red negative tail, blue positive tail,
 * near-white where they meet.
 */
export interface GLDivergingChoroplethOptions<F extends GLGeoObject, R>
  extends GLChoroplethBase<F, R> {
  kind: 'diverging';
  /** Defaults to `div-2-1` (red↔blue). */
  ramp?: GLDivergingKey | readonly string[];
  /** The reference the two hues meet at. Defaults to zero. */
  midpoint?: number;
  /**
   * Widen the domain to the same reach either side of the midpoint. **On by
   * default, and it should stay on.**
   *
   * A diverging ramp's promise to the reader is that equal distances from the
   * midpoint look equally intense. `glDivergingColor` scales its two halves
   * independently so the hue boundary lands exactly on the midpoint — correct,
   * but on a domain like `[-2, +8]` it also spends all three red steps inside
   * two units, so a −1.8 region reads as dark as a +7.5 one. Symmetrising to
   * `[-8, +8]` keeps the boundary on the midpoint *and* keeps the intensities
   * comparable, at the cost of leaving the deepest red unused.
   *
   * Turn it off only when the asymmetry is the finding and the subtitle says so.
   */
  symmetric?: boolean;
}

export type GLChoroplethOptions<F extends GLGeoObject, R = never> =
  | GLSequentialChoroplethOptions<F, R>
  | GLDivergingChoroplethOptions<F, R>;

/**
 * Legend boundary label.
 *
 * Equal-width bins land on values like `33.333333333333336`, which is both
 * unreadable and wider than the swatch above it. Three significant figures
 * separate any two adjacent bins a five- or six-step ramp can produce; past a
 * thousand the compact `1.2k` / `4.5M` form from `scales.ts` takes over,
 * because six full-digit labels do not fit under a 240px legend.
 */
function formatBound(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return '0';
  if (Math.abs(value) >= 1000) return formatLogTick(value);
  return String(Number(value.toPrecision(3)));
}

/** Extent of the joined values, ignoring the regions the join missed. */
function extentOf(values: readonly (number | undefined)[]): [number, number] | undefined {
  let lo = Infinity;
  let hi = -Infinity;
  for (const value of values) {
    if (value === undefined) continue;
    if (value < lo) lo = value;
    if (value > hi) hi = value;
  }
  return Number.isFinite(lo) ? [lo, hi] : undefined;
}

/**
 * Choropleth map — §12 sequential by default, §13 diverging on `kind`.
 *
 * ```ts
 * import { geoNaturalEarth1 } from 'd3-geo';
 *
 * glChoroplethChart(world.features, {
 *   projection: geoNaturalEarth1,
 *   id: (f) => f.properties.iso3,
 *   values: { rows, id: (r) => r.iso3, value: (r) => r.eci },
 *   legend: { label: 'Economic complexity index' },
 * })
 * ```
 *
 * **Decision Rule 9 is enforced here.** Sequential is for ordered values;
 * diverging is only legitimate where a midpoint genuinely exists, and never on
 * a purely positive scale. The library cannot know whether a midpoint is
 * *meaningful* — but it can see whether the data straddles one at all, and a
 * diverging ramp whose domain sits entirely on one side of its own midpoint is
 * unambiguously the mistake the rule is about: the reader decodes the hue
 * boundary as a real threshold that the chart never crosses. That case warns.
 * The converse — sequential over a domain that happens to include zero — does
 * not warn, because "contains zero" is not the same claim as "zero means
 * something", and only the author knows which it is.
 *
 * **One mark, always.** No-data regions are painted by the color scale's own
 * `map(null)` rather than by a second `geoShape` with an explicit fill, because
 * `fit: 'data'` fits each mark to *its own* data — two marks would silently
 * project the same map at two different scales.
 *
 * **Winding matters.** `d3-geo` reads polygons on the sphere and wants exterior
 * rings clockwise, the opposite of what RFC 7946 asks for. A counter-wound ring
 * is interpreted as the whole world minus the region, which both floods the map
 * and destroys the `fit: 'data'` bounds. Natural Earth and TopoJSON output are
 * already correct; hand-authored GeoJSON often is not.
 *
 * **No `variant`.** A choropleth draws no text of its own — there are no `text()`
 * marks at all, so `labelHalo` would select nothing (`gl-chart--label-halo`
 * targets `.ts-chart__text text`) and would be an inert promise. The only type on
 * the chart is the step legend's, and that is TanStack legend chrome sitting on
 * paper above the plot, not a label on data; its sub-12px sizes are corrected in
 * the stylesheet as the module header explains. `treemap` (crispEdges) is
 * likewise wrong here: region polygons are irregular, and snapping their edges to
 * the pixel grid would visibly deform a coastline.
 */
export function glChoroplethChart<F extends GLGeoObject, R = never>(
  features: readonly F[],
  o: GLChoroplethOptions<F, R>,
): GLChart<F, ChartValue, ChartValue> {
  const values = joinValues(features, o.id, o.values);
  const matched = values.filter((value) => value !== undefined).length;

  if (features.length && matched === 0) {
    warn(
      'No feature matched a value — every region will render as no-data. The ' +
        'two `id` accessors have to produce the same keys on both sides of the ' +
        'join (an ISO-2 table against an ISO-3 boundary file is the usual cause).',
    );
  }

  const diverging = o.kind === 'diverging';
  const midpoint = diverging ? (o.midpoint ?? 0) : undefined;

  let domain = o.domain ?? extentOf(values) ?? ([0, 1] as const);
  let [lo, hi] = domain;

  if (matched > 0 && lo === hi) {
    warn(
      `Every joined region carries the same value (${lo}), so the fill encodes ` +
        'nothing and every bin boundary in the legend prints the same number. ' +
        'A single-value map wants a locator, not a choropleth.',
    );
  }

  if (diverging && midpoint !== undefined) {
    if (lo >= midpoint || hi <= midpoint) {
      warn(
        `A diverging ramp claims a midpoint at ${midpoint}, but the data runs ` +
          `[${lo}, ${hi}] and never crosses it — the reader will read a threshold ` +
          `into a hue boundary that isn't in the data (Decision Rule 9). Use the ` +
          `sequential form unless the value genuinely straddles a reference point.`,
      );
    }
    if (o.symmetric !== false) {
      const reach = Math.max(midpoint - lo, hi - midpoint, 0);
      domain = [midpoint - reach, midpoint + reach];
      [lo, hi] = domain;
    }
  }

  const color = glChoroplethColor({
    kind: diverging ? 'diverging' : 'sequential',
    ramp: o.ramp,
    domain: [lo, hi],
    steps: o.steps,
    midpoint,
    missing: o.missing,
  });

  const legend =
    o.legend === false
      ? undefined
      : colorLegend({
          ...(o.legend?.label ? { label: o.legend.label } : {}),
          format: o.legend?.format ?? formatBound,
          ...(o.legend?.width ? { width: o.legend.width } : {}),
        });

  return glChart<F, ChartValue, ChartValue>({
    marks: [
      glGeoShape(features, {
        projection: {
          type: o.projection,
          fit: o.fit ?? 'data',
          ...(o.inset ? { inset: o.inset } : {}),
        },
        // The value reaches the fill only through the color channel. A region
        // the join missed yields `undefined` here, which TanStack passes to the
        // scale as `null` — and `glChoroplethColor`'s `map` is what turns that
        // into the no-data fill rather than into the palest bin.
        color: (_feature: F, index: number) => values[index] ?? null,
        // TanStack's key channel is typed as never-nullable, but the runtime
        // handles a missing key by falling back to array index (and warning).
        // A boundary file with a hole in its id column should degrade, not
        // fail to compile — so the cast is the honest description of what
        // `inferredKeyValues` actually accepts.
        key: o.id as GeoShapeOptions<F>['key'],
      }),
    ],
    // No projection axis exists to draw, and TanStack's automatic 4px guide
    // inset is skipped along with them — the map gets the whole frame.
    guides: false,
    color: { type: color, ...(legend ? { legend } : {}) },
    // `top` is explicitly `undefined`, and that is the whole trick rather than an
    // oversight. TanStack only reserves room for the legend when the top margin is
    // *unlocked* (`resolveMarginLocks`), so pinning it — as `glMargin` does for
    // every axed chart — would draw the step legend over the top of the map. The
    // other three sides are zero because a map has no gutters to leave: nothing
    // hangs outside the projected geometry.
    //
    // The key is PRESENT-but-undefined, not omitted, so that `glChart`'s
    // `{ ...glMargin, ...spec.margin }` merge cannot resurrect `glMargin.top`.
    // A shape that must leave a side unlocked has no other way to say so; if
    // `glChart` ever starts stripping undefined values from the margin, this
    // chart silently loses its legend.
    margin: { top: undefined, right: 0, bottom: 0, left: 0 },
  });
}
