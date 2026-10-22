/**
 * Hexagonal binning — the lattice, and a mark that tiles with it.
 *
 * ## Why this is not two lines in `marks.ts`
 *
 * TanStack's `hexagon` mark draws a hexagon of a **fixed pixel radius** at a
 * scaled x/y. That is the right primitive and it is not a hexbin: nothing
 * connects the radius it draws to the lattice a caller binned on, so the two
 * agree only when the caller has correctly guessed the plot's inner width and
 * height. Guess low and the hexagons leave paper between them; guess high and
 * they overlap. Both failures are silent, both change with the container width,
 * and a hexbin with gaps in it is not a lesser hexbin — it is a chart claiming
 * there is no observation somewhere the lattice never had a tile to begin with.
 *
 * So this module owns both halves and keeps them attached:
 *
 * ```ts
 * const lattice = glHexbinLattice(products, { x: 'logTrade', y: 'pci', rows: 8, aspect: 4 });
 * glChart({
 *   marks: [glHexbin(lattice, { color: 'count' })],
 *   color: { scale: glSequentialColor({ domain: [1, lattice.max], steps: 5 }) },
 * });
 * ```
 *
 * `glHexbin` handed a lattice reads the pitch off the lattice itself, so the
 * shape it draws cannot disagree with the shape it binned on.
 *
 * ## How the tiling is guaranteed
 *
 * The mark does **not** draw a pixel radius. It computes all six vertices in
 * *data* space — `x ± dx/2`, `y ± dy/3`, `y ± 2·dy/3` — and maps each through
 * the resolved scale. Two neighbouring tiles therefore share an edge because
 * they share its two data coordinates, and a shared data coordinate is the same
 * pixel under any monotone scale. The lattice tiles at every container width, at
 * every height, and on a log axis, with nothing measured and nothing guessed.
 *
 * What the plot's proportions still decide is whether the tiles come out
 * *regular*. A lattice that is regular in data space is regular on screen only
 * when the plot's pixel aspect matches the one the lattice was laid out for —
 * `aspect` on the lattice, `width ÷ height` of the plot area. Get it wrong and
 * the hexagons are stretched along one axis, which is a cosmetic error rather
 * than a structural one, and the mark warns in development with the aspect it
 * would have wanted. That is the trade this module deliberately makes: bin in
 * data space so the bin counts (and the legend that reads them) do not change
 * when the window is resized, and pay for it in regularity rather than in gaps.
 */

import { createMark, hexagon } from '@tanstack/charts';
import type {
  ChartKey,
  ChartMark,
  ChartPoint,
  ChartValue,
  HexagonOptions,
  SceneArea,
} from '@tanstack/charts';

import { warn } from './dev.js';
import { glDefaults } from './marks.js';
import type { GLToneRef, GLToneStep } from './tone.js';

/**
 * A regular pointy-topped hexagon, as two ratios:
 *
 *   - `REGULAR_PITCH` — column pitch over row pitch, `√3·r / 1.5·r`. What the
 *     lattice is built from.
 *   - `REGULAR_TILE` — across-flats over vertex-to-vertex, `√3·r / 2r`. What the
 *     drawn tile is measured against.
 */
const REGULAR_PITCH = 2 / Math.sqrt(3);
const REGULAR_TILE = Math.sqrt(3) / 2;

// ── The lattice ─────────────────────────────────────────────────────────────

/** One occupied hexagon: its lattice centre in data units, and what fell in it. */
export interface GLHexBin {
  /** Centre, in x data units. */
  x: number;
  /** Centre, in y data units. */
  y: number;
  count: number;
  /**
   * Column index. Integer on every row — an odd row is not a half column along,
   * it is offset half a column, which the mark and the centre above both add.
   */
  col: number;
  /** Row index, counting up in y. */
  row: number;
}

/**
 * A hexagonal lattice and the bins that landed on it.
 *
 * Hand the whole object to `glHexbin` rather than picking `bins` out of it —
 * the mark needs the origin and the pitch, and passing the pieces separately is
 * the mistake this type exists to make impossible.
 */
export interface GLHexbinLattice {
  bins: GLHexBin[];
  /** Column pitch — the distance between tile centres across, in x data units. */
  dx: number;
  /** Row pitch — the distance between tile centres up, in y data units. */
  dy: number;
  /** Centre of tile `0:0`, in x data units. Every other centre is `x0 + n·dx`. */
  x0: number;
  /** Centre of tile `0:0`, in y data units. */
  y0: number;
  /** The largest bin count. `[1, max]` is the domain for `glSequentialColor`. */
  max: number;
  /**
   * The plot aspect (width ÷ height) the tiles come out regular at, measured
   * over the lattice's own extent. Pass `domain` too whenever the chart pins its
   * axes: the tiles are stretched by the ratio between the two extents, so a
   * lattice laid over the data while the axis is laid over something wider is
   * regular at neither the number given here nor the plot's real proportions.
   */
  aspect: number;
}

type Accessor<T> = (datum: T, index: number) => number;

function reader<T>(channel: keyof T | Accessor<T>): Accessor<T> {
  if (typeof channel === 'function') return channel as Accessor<T>;
  return (d) => Number((d as Record<string, unknown>)[channel as string]);
}

export interface GLHexbinLatticeOptions<T> {
  x: keyof T | Accessor<T>;
  y: keyof T | Accessor<T>;
  /**
   * How many rows of hexagons the lattice is tall. This is the resolution knob:
   * fewer rows is a coarser, more confident count per tile. Defaults to 12.
   */
  rows?: number;
  /**
   * `width ÷ height` of the **plot area** — not the figure, and not the data.
   *
   * It decides the column pitch, and therefore only whether the tiles come out
   * regular; the tiling itself holds at any value. A full-width figure 260px
   * tall is somewhere near 4, a square panel is 1. Defaults to 1.6.
   */
  aspect?: number;
  /**
   * Pin the extent the lattice is laid over, instead of taking the data's own.
   * Reach for it to make two hexbins comparable — same pitch, same tile centres,
   * so the reader can put one beside the other.
   */
  domain?: { x?: readonly [number, number]; y?: readonly [number, number] };
}

/**
 * GLBin a point cloud onto a hexagonal lattice, in data space.
 *
 * The assignment is `d3-hexbin`'s — round to the nearest row, then to the
 * nearest column in that row, then test the one diagonal neighbour that can
 * still be closer — carried out in units of the pitch rather than in pixels.
 * Rolling it here rather than taking the dependency is what makes the binning
 * *stable*: `d3-hexbin` bins in pixels, so its bin counts change when the
 * container does, and a colour ramp keyed to a count that moves on resize is a
 * legend that lies at every width but one.
 *
 * Draw the result with `glHexbin`, which reads the pitch back off this object.
 */
export function glHexbinLattice<T>(
  rows: readonly T[],
  o: GLHexbinLatticeOptions<T>,
): GLHexbinLattice {
  const readX = reader<T>(o.x);
  const readY = reader<T>(o.y);
  const points = rows
    .map((d, i): [number, number] => [readX(d, i), readY(d, i)])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

  const nRows = Math.max(1, Math.round(o.rows ?? 12));
  const aspect = o.aspect && o.aspect > 0 ? o.aspect : 1.6;

  if (!points.length) {
    warn('A hexbin needs at least one point with both coordinates; none were usable.');
    return { bins: [], dx: 1, dy: 1, x0: 0, y0: 0, max: 0, aspect };
  }

  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [x0, x1] = o.domain?.x ?? [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = o.domain?.y ?? [Math.min(...ys), Math.max(...ys)];
  const spanX = x1 - x0 || 1;
  const spanY = y1 - y0 || 1;

  // `nRows` rows of pointy-topped hexagons stack 1.5·r apart and overhang half a
  // tile at each end, so the extent they cover is (1.5·n + 0.5)·r tall. The
  // column pitch is then whatever makes the tile regular at `aspect`: √3·r
  // across against 1.5·r down, converted from pixels into x data units.
  const dy = (1.5 * spanY) / (1.5 * nRows + 0.5);
  const dx = (REGULAR_PITCH * dy * (spanX / spanY)) / aspect;

  const bins = new Map<string, GLHexBin>();
  let max = 0;

  for (const [x, y] of points) {
    // d3-hexbin's assignment, in units of the pitch. `pi` and `pj` are the
    // column and row; odd rows are offset half a column, which is the `pj & 1`.
    const v = (y - y0) / dy;
    let pj = Math.round(v);
    const u = (x - x0) / dx - (pj & 1) / 2;
    let pi = Math.round(u);
    const dv = v - pj;

    // Near the row boundary the nearest ROW centre is not the nearest HEXAGON:
    // the diagonal neighbour can be closer. One distance test settles it.
    if (Math.abs(dv) * 3 > 1) {
      const du = u - pi;
      const pi2 = pi + (u < pi ? -1 : 1) / 2;
      const pj2 = pj + (v < pj ? -1 : 1);
      const du2 = u - pi2;
      const dv2 = v - pj2;
      if (du * du + dv * dv > du2 * du2 + dv2 * dv2) {
        pi = pi2 + (pj & 1 ? 1 : -1) / 2;
        pj = pj2;
      }
    }

    const key = `${pi}:${pj}`;
    let bin = bins.get(key);
    if (!bin) {
      bin = {
        x: x0 + (pi + (pj & 1) / 2) * dx,
        y: y0 + pj * dy,
        count: 0,
        col: pi,
        row: pj,
      };
      bins.set(key, bin);
    }
    bin.count += 1;
    if (bin.count > max) max = bin.count;
  }

  return { bins: [...bins.values()], dx, dy, x0, y0, max, aspect };
}

// ── The mark ────────────────────────────────────────────────────────────────

/** A hexbin's paint options. The geometry comes from the lattice. */
export interface GLHexbinTileOptions {
  tone?: GLToneRef;
  step?: GLToneStep;
  /** Which field carries the value the colour scale reads. Defaults to `count`. */
  color?: keyof GLHexBin | ((bin: GLHexBin, index: number) => ChartKey | null | undefined);
  /**
   * Pin the fill, bypassing the colour scale. There is deliberately no stroke
   * option: §3.4.1 separates tiles with paper, never with ink, and a hexbin that
   * tiles exactly has no gutter for a stroke to sit in.
   */
  fill?: string;
  id?: string;
}

export interface GLHexbinOptions<T>
  extends Omit<HexagonOptions<T>, 'fillOpacity' | 'strokeOpacity'> {
  tone?: GLToneRef;
  step?: GLToneStep;
}

/**
 * Hexagonally binned density. A tile with six sides, so it takes the tile paint
 * — full opacity, never the scatter's 0.8 (`grammar.md` §3.4).
 *
 * Two ways in, and the first is the one to reach for:
 *
 * ```ts
 * // Tiles. The pitch travels with the bins, so they cannot disagree.
 * const lattice = glHexbinLattice(rows, { x: 'x', y: 'y', rows: 8, aspect: 4 });
 * glHexbin(lattice, { color: 'count' })
 *
 * // Fixed pixel radius — TanStack's own mark, for a caller who owns the pixel
 * // geometry (a fixed-width export frame) and has measured it.
 * glHexbin(bins, { x: 'x', y: 'y', r: 16, color: 'n' })
 * ```
 *
 * The second form draws a regular hexagon of exactly `r` pixels and knows
 * nothing about the lattice underneath it, so it tiles only at the one size the
 * radius was measured for. Everything else should take a lattice.
 */
export function glHexbin(
  lattice: GLHexbinLattice,
  options?: GLHexbinTileOptions,
): ChartMark<GLHexBin, number, number>;
export function glHexbin<T>(
  data: Iterable<T>,
  options?: GLHexbinOptions<T>,
): ChartMark<T, ChartValue, ChartValue>;
export function glHexbin(
  source: GLHexbinLattice | Iterable<any>,
  options: GLHexbinTileOptions | GLHexbinOptions<any> = {},
): ChartMark<any, any, any> {
  if (isLattice(source)) return hexTiles(source, options as GLHexbinTileOptions);
  return hexagon(source, glDefaults('tile', options) as HexagonOptions<unknown>);
}

function isLattice(source: unknown): source is GLHexbinLattice {
  return (
    typeof source === 'object' &&
    source !== null &&
    Array.isArray((source as GLHexbinLattice).bins) &&
    typeof (source as GLHexbinLattice).dx === 'number'
  );
}

/**
 * The tiling mark.
 *
 * Six vertices per tile, all of them expressed in data units and mapped through
 * the resolved scales at render — see the module header for why that is what
 * makes the tiling exact rather than approximate.
 */
function hexTiles(
  lattice: GLHexbinLattice,
  options: GLHexbinTileOptions,
): ChartMark<GLHexBin, number, number> {
  const { bins, dx, dy, x0, y0 } = lattice;

  // Every vertex is an INTEGER number of half-columns from the origin across and
  // of third-rows up, so two tiles that share an edge compute its coordinates
  // from the identical expression and land on the identical float. Written the
  // obvious way — `centre + dx/2` against the neighbour's `centre − dx/2` — the
  // two agree to about 1e-13 of a data unit instead of exactly, and "the seam is
  // too small to see" is a weaker claim than "there is no seam".
  const halfX = dx / 2;
  const thirdY = dy / 3;
  // An odd row is offset half a column: 2·col + 1 half-columns, not 2·col.
  const colUnits = (bin: GLHexBin) => 2 * bin.col + (bin.row & 1);
  const rowUnits = (bin: GLHexBin) => 3 * bin.row;
  const atX = (units: number) => x0 + units * halfX;
  const atY = (units: number) => y0 + units * thirdY;

  const color = options.color ?? 'count';
  const readColor = (bin: GLHexBin, index: number): ChartKey | null | undefined =>
    typeof color === 'function' ? color(bin, index) : (bin[color] as ChartKey);

  // The same defaults table every other mark goes through. A colour channel is
  // present unless the caller pinned a fill, so `paint()` leaves `fill`
  // undefined and the chart-level scale owns it.
  const painted = glDefaults('tile', {
    tone: options.tone,
    step: options.step,
    fill: options.fill,
    color: options.fill == null ? color : undefined,
  } as Record<string, unknown>) as { fill?: string; fillOpacity: number };

  return createMark<GLHexBin, number, number>(({ markIndex }) => {
    const id = options.id ?? `gl-hexbin-${markIndex}`;
    const values = bins.map(readColor);

    return {
      id,
      channels: {
        // The tile extents, not just the centres: an inferred domain that stops
        // at the outermost centre clips half a hexagon off each edge.
        x: {
          scale: 'x',
          values: bins.flatMap((b) => [atX(colUnits(b) - 1), atX(colUnits(b) + 1)]),
        },
        y: {
          scale: 'y',
          values: bins.flatMap((b) => [atY(rowUnits(b) - 2), atY(rowUnits(b) + 2)]),
        },
        color: {
          scale: 'color',
          values: values.filter((v): v is ChartKey => v != null),
        },
      },
      render: ({ scales, color: resolveColor }) => {
        const mapX = (value: number) => scales.x.map(value);
        const mapY = (value: number) => scales.y.map(value);
        const nodes: SceneArea[] = [];
        const points: ChartPoint<GLHexBin, number, number>[] = [];

        checkRegularity(lattice, mapX, mapY);

        bins.forEach((bin, index) => {
          const across = colUnits(bin);
          const up = rowUnits(bin);
          const x = mapX(atX(across));
          const y = mapY(atY(up));
          if (!Number.isFinite(x) || !Number.isFinite(y)) return;

          const left = mapX(atX(across - 1));
          const right = mapX(atX(across + 1));
          const top = mapY(atY(up + 2));
          const bottom = mapY(atY(up - 2));
          const upper = mapY(atY(up + 1));
          const lower = mapY(atY(up - 1));

          const value = values[index];
          const fill = painted.fill ?? resolveColor(value ?? null);
          const key = `${id}:${bin.col}:${bin.row}`;
          const point: ChartPoint<GLHexBin, number, number> = {
            key,
            markId: id,
            group: null,
            groupLabel: id,
            datum: bin,
            datumIndex: index,
            xValue: bin.x,
            yValue: bin.y,
            x,
            y,
            color: fill,
          };
          points.push(point);

          nodes.push({
            kind: 'area',
            key,
            points: [
              [x, top],
              [right, upper],
              [right, lower],
              [x, bottom],
              [left, lower],
              [left, upper],
            ],
            interaction: { point, affinity: 'geometry' },
            style: { fill, fillOpacity: painted.fillOpacity },
          });
        });

        return {
          nodes: [{ kind: 'group', key: id, className: 'gl-hexbin', children: nodes }],
          points,
        };
      },
    };
  });
}

/**
 * Warn when the tiles are drawn visibly stretched.
 *
 * The lattice was laid out to be regular at `lattice.aspect`; the plot resolved
 * to something else. The tiling is unaffected — this is the cosmetic half — but
 * it is the one thing about a hexbin that a caller cannot see from the code, so
 * development says it out loud and names the number that would fix it.
 *
 * The band is deliberately wide. A chart re-renders several times before its
 * layout settles — a pass before the web fonts land measures a narrower axis
 * gutter and therefore a wider plot — and every one of those passes comes
 * through here. Warning at 15% would mean warning on the way to a correct
 * chart; at 40% the tile is unmistakably not a hexagon.
 */
function checkRegularity(
  lattice: GLHexbinLattice,
  mapX: (value: number) => number,
  mapY: (value: number) => number,
): void {
  const { bins, dx, dy, aspect } = lattice;
  const first = bins[0];
  if (!first) return;

  const width = Math.abs(mapX(first.x + dx / 2) - mapX(first.x - dx / 2));
  const height = Math.abs(mapY(first.y + (2 * dy) / 3) - mapY(first.y - (2 * dy) / 3));
  if (!(width > 0) || !(height > 0)) return;

  const stretch = width / height / REGULAR_TILE;
  if (stretch > 1.4 || stretch < 0.71) {
    warn(
      `Hexbin tiles are drawing at ${stretch.toFixed(2)}× the width a regular hexagon ` +
        `would have at this height. The lattice was laid out for a plot of aspect ` +
        `${aspect} and this render measured about ${(aspect * stretch).toFixed(1)}. They ` +
        `still tile; pass that aspect to glHexbinLattice to make them regular.`,
    );
  }
}
