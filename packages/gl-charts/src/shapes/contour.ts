/**
 * `@growth-lab/gl-charts/shapes` — iso-lines.
 *
 * Density contours over a point cloud, and filled contours over a value grid.
 * Both are `d3-contour`'s marching squares, declared and pinned like every other
 * layout this package takes.
 *
 * ## Why these return GeoJSON
 *
 * Because a contour is a set of nested rings, and the only polygon-capable mark
 * in the whole stack is `geoShape`. TanStack's marks are rectangles, circles,
 * hexagons, segments and paths-through-points; none of them takes an arbitrary
 * ring, let alone one with holes. So a contour reaches a chart the way a
 * coastline does — as a `MultiPolygon` feature through `glGeoShape` with
 * `geoIdentity` — and that is not a workaround so much as a recognition that
 * iso-lines and coastlines are the same kind of object.
 *
 * ```ts
 * import { geoIdentity } from 'd3-geo';
 * import { glContourDensity, glGeoShape, glSequentialColor } from '@growth-lab/gl-charts/shapes';
 *
 * const { features, domain } = glContourDensity(points, { x: 'lon', y: 'lat', … });
 * glChart({
 *   marks: [glGeoShape(features, { projection: { type: geoIdentity, fit: 'data' }, color: 'value' })],
 *   color: { scale: glSequentialColor({ domain, steps: 5 }) },
 * });
 * ```
 *
 * The caller supplies `geoIdentity` for exactly the reason they supply a map
 * projection: this package does not depend on `d3-geo` and should not start —
 * see the header of `geo.ts`, which explains why at length.
 *
 * ## The paint decision, and why it is the caller's
 *
 * A contour level is an ORDERED variable with no meaningful midpoint, so §12
 * sends it to a sequential ramp: five equal-width steps of one hue, darker is
 * higher, always. That is the whole ruling, and it is already implemented by
 * `glSequentialColor` — so these functions return the levels and their extent
 * and stop there. A `glContourChart` preset would only be re-stating §12 with
 * fewer options.
 *
 * ## Coordinates
 *
 * `d3-contour` works on a grid and emits coordinates in **grid-cell units**.
 * Both functions below rescale them back into the caller's own data space before
 * returning, because a chart whose axis reads "cell 41" is a chart labelling the
 * algorithm rather than the data. That rescale is the reason to wrap these at
 * all rather than call `d3-contour` from a plate.
 */

import { contourDensity, contours as d3Contours } from 'd3-contour';

import { warn } from '../dev.js';

/** A contour band as a GeoJSON feature, carrying the level it encloses. */
export interface GLContourFeature {
  type: 'Feature';
  id: number;
  properties: {
    /** The threshold this ring encloses — the channel a colour scale reads. */
    value: number;
    index: number;
  };
  geometry: { type: 'MultiPolygon'; coordinates: number[][][][] };
}

export interface GLContourResult {
  features: GLContourFeature[];
  /** `[min, max]` of the levels, ready for `glSequentialColor`. */
  domain: [number, number];
  /** The thresholds actually used, low to high. */
  thresholds: number[];
}

type Accessor<T> = (datum: T, index: number) => number;

function reader<T>(channel: keyof T | Accessor<T>): Accessor<T> {
  if (typeof channel === 'function') return channel as Accessor<T>;
  return (d) => Number((d as Record<string, unknown>)[channel as string]);
}

/**
 * Rescale a contour's grid-cell coordinates back into data space.
 *
 * `d3-contour` is handed a grid and hands back rings measured in cells, so every
 * vertex has to be mapped through the same transform the binning used. Doing it
 * here rather than at the call site is the point of the wrapper: get it wrong by
 * half a cell and the contours sit visibly off the points they describe, which
 * looks like a smoothing artifact rather than a bug.
 */
function toDataSpace(
  coordinates: number[][][][],
  origin: readonly [number, number],
  cell: readonly [number, number],
): number[][][][] {
  return coordinates.map((polygon) =>
    polygon.map((ring) =>
      ring.map(([cx, cy]) => [origin[0] + cx * cell[0], origin[1] + cy * cell[1]]),
    ),
  );
}

export interface GLContourDensityOptions<T> {
  x: keyof T | Accessor<T>;
  y: keyof T | Accessor<T>;
  /**
   * Grid resolution. Higher is smoother and slower; 64 is smooth at figure
   * scale, matching `glDensity`'s default for the same reason.
   */
  resolution?: number;
  /**
   * Kernel bandwidth in GRID CELLS, not data units — `d3-contour`'s own
   * convention, kept rather than converted so a caller reading d3's docs is not
   * surprised. Defaults to 12.
   */
  bandwidth?: number;
  /** Number of levels. Defaults to five, the authored length of a GL ramp. */
  levels?: number;
  /**
   * Pin the box the kernel is evaluated over, instead of inferring it from the
   * data.
   *
   * **It is not a clip rectangle**, and the obvious reading is the wrong one.
   * A wider domain makes each grid cell cover more data units, so a `bandwidth`
   * measured in cells covers more data units too — the estimate spreads further
   * and can reach past the domain's own edges. Reach for this to make two
   * density plots comparable, not to bound one; to bound the drawing, fit the
   * projection to the features (`fit: 'data'`) or clip the plot.
   */
  domain?: { x: readonly [number, number]; y: readonly [number, number] };
}

/**
 * Density contours over a point cloud — the two-dimensional kernel estimate.
 *
 * The Cartesian twin of `glDensity`, and the same warning applies to both: a
 * kernel estimate is a *model*, and a contour drawn where nothing was observed
 * reads as evidence rather than as smoothing. Unlike `glDensity` this cannot
 * trim to the observed range — a two-dimensional hull is not an interval — so
 * the lowest level is dropped instead: it is the one that balloons furthest past
 * the data and carries the least information.
 *
 * Compare `glHexbin`, which is the honest alternative when the reader needs to
 * know *where the observations actually are*. A hexbin cannot claim density
 * anywhere it has no observations; a contour can and does.
 */
export function glContourDensity<T>(
  rows: readonly T[],
  o: GLContourDensityOptions<T>,
): GLContourResult {
  const readX = reader<T>(o.x);
  const readY = reader<T>(o.y);
  const points: [number, number][] = rows
    .map((d, i): [number, number] => [readX(d, i), readY(d, i)])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

  if (points.length < 3) {
    warn(`A density estimate needs at least three points; ${points.length} were usable.`);
    return { features: [], domain: [0, 1], thresholds: [] };
  }

  const size = Math.max(8, Math.round(o.resolution ?? 64));
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [x0, x1] = o.domain?.x ?? [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = o.domain?.y ?? [Math.min(...ys), Math.max(...ys)];
  const spanX = x1 - x0 || 1;
  const spanY = y1 - y0 || 1;

  const raw = contourDensity<[number, number]>()
    .x((p) => ((p[0] - x0) / spanX) * size)
    .y((p) => ((p[1] - y0) / spanY) * size)
    .size([size, size])
    .bandwidth(o.bandwidth ?? 12)
    .thresholds(Math.max(2, (o.levels ?? 5) + 1))(points);

  // Drop the outermost (lowest) level — see the doc comment.
  const kept = raw.length > 1 ? raw.slice(1) : raw;
  const cell = [spanX / size, spanY / size] as const;

  const features: GLContourFeature[] = kept.map((contour, index) => ({
    type: 'Feature' as const,
    id: index,
    properties: { value: contour.value, index },
    geometry: {
      type: 'MultiPolygon' as const,
      coordinates: toDataSpace(contour.coordinates as number[][][][], [x0, y0], cell),
    },
  }));

  const values = kept.map((c) => c.value);
  return {
    features,
    domain: [Math.min(...values), Math.max(...values)],
    thresholds: [...values].sort((a, b) => a - b),
  };
}

export interface GLContourGridOptions {
  /** Grid width in cells. `values.length` must be `width × height`. */
  width: number;
  height: number;
  /** Number of levels. Defaults to five. */
  levels?: number;
  /** Exact thresholds, bypassing the estimator — a policy line, a round metre. */
  thresholds?: readonly number[];
  /**
   * Data-space extent the grid covers, as `[x0, y0, x1, y1]`. Defaults to the
   * cell indices themselves, which is right for an image and wrong for anything
   * with real units.
   */
  extent?: readonly [number, number, number, number];
}

/**
 * Filled contours over a regular value grid — a topography, a field, a raster.
 *
 * The grid is row-major (`values[y * width + x]`), which is `d3-contour`'s
 * convention and also `ImageData`'s, so a caller coming from either lands right.
 *
 * `thresholds` is worth reaching for whenever the levels carry meaning the
 * estimator cannot know: a contour interval on a map is conventionally a round
 * number of metres, and letting an estimator pick 37.4 makes the chart harder to
 * read for no gain — the same argument `binValues` makes for its own option.
 */
export function glContourGrid(
  values: readonly number[],
  o: GLContourGridOptions,
): GLContourResult {
  const expected = o.width * o.height;
  if (values.length !== expected) {
    warn(
      `A ${o.width}×${o.height} grid needs ${expected} values; ${values.length} were ` +
        `given. The contours will be wrong rather than absent, because marching ` +
        `squares reads whatever is at each index.`,
    );
  }

  const generator = d3Contours().size([o.width, o.height]);
  const raw = o.thresholds?.length
    ? generator.thresholds([...o.thresholds])(values as number[])
    : generator.thresholds(Math.max(2, o.levels ?? 5))(values as number[]);

  const [x0, y0, x1, y1] = o.extent ?? [0, 0, o.width, o.height];
  const cell = [(x1 - x0) / o.width, (y1 - y0) / o.height] as const;

  const features: GLContourFeature[] = raw.map((contour, index) => ({
    type: 'Feature' as const,
    id: index,
    properties: { value: contour.value, index },
    geometry: {
      type: 'MultiPolygon' as const,
      coordinates: toDataSpace(contour.coordinates as number[][][][], [x0, y0], cell),
    },
  }));

  const levels = raw.map((c) => c.value);
  return {
    features,
    domain: [Math.min(...levels), Math.max(...levels)],
    thresholds: [...levels].sort((a, b) => a - b),
  };
}
