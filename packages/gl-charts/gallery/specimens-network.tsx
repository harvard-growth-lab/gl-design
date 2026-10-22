/**
 * Catalog specimens — Networks, and the two contour forms.
 *
 * These seven were the gallery's standing refusals: Sankey ×2, force-directed,
 * Delaunay, Voronoi, and contours ×2. Every one of them was blocked on the same
 * thing — **a layout, never a paint decision.** §3.4.2 already ruled that a
 * network edge is a connector; §12 already ruled that a contour level walks a
 * sequential ramp. What was missing was the geometry.
 *
 * It now ships: `d3-sankey`, `d3-force`, `d3-delaunay` and `d3-contour` are
 * declared and pinned alongside `d3-hierarchy`, and wrapped in
 * `src/shapes/network.ts` and `src/shapes/contour.ts`. So these plates are
 * composed exactly like every other specimen — layout from the library, paint
 * from the defaults table, nothing styled by hand.
 *
 * ## The one place this departs from the spec, stated loudly
 *
 * §3.4.2 names "a Sankey link" among its CONNECTORS, which take the series DARK
 * tone at line weight. That ruling was written for a dumbbell bar and a
 * candlestick wick — marks two pixels wide. A Sankey ribbon is the same geometry
 * at forty, and the rule does not survive the scale change: overlapping dark
 * ribbons at full opacity are unreadable and bury the nodes they connect.
 *
 * `glSankeyChart` paints a ribbon in its source node's LIGHT tone instead, which
 * follows §3.3 (light already has the background job) and mirrors §3.9's
 * argument for bands. **The right fix is upstream** — §3.4.2 should distinguish a
 * hairline connector from a ribbon — and until it does, this is a downstream file
 * disagreeing with the spec, which is the thing this repo exists to prevent. It
 * is recorded in both Sankey specimens' gaps and in `SPEC.md` C8.
 *
 * ## Contours reach a chart the way a coastline does
 *
 * Marching squares emits rings with holes, and the only polygon-capable mark in
 * the stack is `geoShape`. So a contour is drawn as a GeoJSON `MultiPolygon`
 * through `glGeoShape` with `geoIdentity` — not a workaround so much as a
 * recognition that iso-lines and coastlines are the same kind of object.
 */

import type { ReactNode } from 'react';
import { Chart } from '@tanstack/react-charts';
import { geoIdentity } from 'd3-geo';

import {
  glAxisX,
  glAxisY,
  glChart,
  glLabel,
  glLink,
  glPoint,
  glSequentialColor,
  resolveTone,
} from '../src/index.js';
import {
  glContourDensity,
  glContourGrid,
  type GLContourFeature,
  glDelaunayEdges,
  glForceLayout,
  glGeoShape,
  glSankeyChart,
  glVoronoiCells,
  glVoronoiFeatures,
} from '../src/shapes.js';
import { GLFigure, GLLegend, GLRampLegend } from '../src/figure.js';

import { cloudData } from './specimen-data.js';
import {
  WIND_GRID,
  flowLinks,
  flowNodes,
  networkLinks,
  networkNodes,
  stations,
  windField,
} from './tanstack-data.js';

/** Ramp-legend bound formatter: cut points are values, not decimals. */
const round = (v: number) => String(Math.round(v));

const SYNTHETIC = 'Source: Synthetic data for illustration. Not a Growth Lab estimate.';

/** The plot box the force and triangulation plates lay out inside. */
const FIELD = { width: 560, height: 300 };

// ════════════════════════════════════════════════════════════════════════════
// Sankey
// ════════════════════════════════════════════════════════════════════════════

/**
 * `111-basic-sankey` — flows between nodes, ribbon width as quantity.
 *
 * The layout runs at the RESOLVED PIXEL SIZE, which is why `glSankeyChart` is a
 * dynamic definition like the treemap: node width and inter-node padding are
 * pixel constants, and laying out in a unit box would stretch both by the plot's
 * aspect ratio — precisely what they exist to hold fixed.
 *
 * Read the ribbon widths against the node heights. They agree by construction
 * (`tests/network.test.ts` asserts it), which is the only claim a Sankey makes
 * and the one it is easiest to break silently.
 */
function BasicSankey() {
  const chart = glSankeyChart({
    nodes: flowNodes.map((n) => ({ id: n.id })),
    links: [...flowLinks],
  });

  return (
    <GLFigure
      title="Two thirds of processed output leaves the country."
      subtitle="Mineral value chain, thousand tonnes; ribbon width is throughput"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={300} ariaLabel="Mineral value chain flows" />
    </GLFigure>
  );
}

/**
 * `111-sankey-flow` — the same graph under the §3.4.2 reading.
 *
 * One option apart from the plate above: `linkTone: 'c-1'` takes the connector
 * ruling back, so every ribbon is one dark tone instead of its source's light
 * one. The pair is the argument for amending §3.4.2 rather than a description of
 * it — put the two side by side and the reason a ribbon cannot be a hairline is
 * not a matter of taste.
 *
 * `align: 'left'` packs each node as far left as its dependencies allow, which
 * is right when the columns are stages of a process and an early terminus is
 * genuinely early.
 */
function SankeyFlow() {
  const chart = glSankeyChart({
    nodes: flowNodes.map((n) => ({ id: n.id })),
    links: [...flowLinks],
    align: 'left',
    linkTone: 'c-1',
  });

  return (
    <GLFigure
      title="Under §3.4.2 as written, every ribbon is one dark connector."
      subtitle="The same value chain with the literal connector reading — see the gap"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={300} ariaLabel="Mineral value chain, single-tone ribbons" />
    </GLFigure>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Force-directed
// ════════════════════════════════════════════════════════════════════════════

/**
 * `40-force-directed-network` — communities found by the layout, not by the data.
 *
 * The nodes carry a `group`, but the layout never reads it: the three clusters
 * on screen are produced by the edges alone. That is the whole claim a force
 * diagram makes, and it is checkable here because the groups are known — if the
 * colours did not land in clumps, the layout would not be finding anything.
 *
 * `glForceLayout` runs the simulation **synchronously and deterministically**: a
 * chart definition is data and cannot await animation frames, and a plate that
 * settled somewhere new on each render would break the gallery's premise that a
 * diff only ever shows a real change. It pins the starting positions on a circle
 * so `d3-force`'s one use of `Math.random()` — which fires only when two nodes
 * coincide — never fires. `tests/network.test.ts` asserts two runs agree.
 *
 * Edges are `glLink`: §3.4.2 CONNECTOR, dark tone, line weight, butt cap. Nodes
 * are `glPoint`, so §3.4's 0.8 fill-and-stroke applies — and it earns its place
 * here, because a dense community's nodes overlap and darken into exactly the
 * density signal the rule exists for.
 */
function ForceNetwork() {
  const { nodes, links } = glForceLayout(networkNodes, networkLinks, {
    ...FIELD,
    // Short edges and strong repulsion: within a near-complete community the link
    // force pulls every pair together, so the clusters only separate if the
    // charge between them outweighs the four bridges holding them.
    distance: 34,
    charge: -420,
  });
  const groups = [...new Set(networkNodes.map((n) => n.group))];

  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  // A node is a 6px circle and its label runs to the right of it, so the domain
  // is padded past the settled extent on both axes — the same reason every
  // scatter in this gallery pins one.
  const pad = 42;

  const chart = glChart({
    marks: [
      glLink(links, { x1: 'x1', y1: 'y1', x2: 'x2', y2: 'y2', tone: 'muted' }),
      ...groups.map((group) =>
        glPoint(
          nodes.filter((n) => n.group === group),
          // Radius carries degree, so the bridges between communities read as
          // the small nodes they are. Square-rooted: a radius set to the count
          // would encode it as area squared.
          { x: 'x', y: 'y', r: (d) => 4 + Math.sqrt(d.degree) * 1.5, tone: nodes.find((n) => n.group === group)!.tone },
        ),
      ),
      glLabel(
        // Every node, not just the hubs. Fourteen labels fit at this size, and a
        // network where only the hubs are named makes the bridges — which are the
        // finding — the one thing the reader cannot identify.
        nodes,
        {
          x: 'x',
          y: 'y',
          text: (d) => d.id,
          fill: (d) => resolveTone(d.tone).dark,
          anchor: 'start',
          dx: 9,
        },
      ),
    ],
    x: { ...glAxisX({ domain: [Math.min(...xs) - pad, Math.max(...xs) + pad], nice: false }), axis: false as const },
    y: { ...glAxisY({ grid: false, domain: [Math.min(...ys) - pad, Math.max(...ys) + pad], nice: false }), axis: false as const },
    variant: { labelHalo: true },
    margin: { left: 8, right: 8, top: 8, bottom: 8 },
  });

  return (
    <GLFigure
      title="Three communities, and the four products that bridge them."
      subtitle={`${networkNodes.length} products, ${networkLinks.length} co-export links; position is the layout, colour is the known grouping`}
      source={SYNTHETIC}
      // The colour is on the NODES, which are dots, so the legend marks are dots
      // (§3.11). The links are `ink-4` chrome and carry no grouping, so they get
      // no entry — an entry a reader cannot act on is one §3.11 drops.
      legend={
        <GLLegend
          items={groups.map((group, i) => ({
            label: group,
            tone: `c-${i + 1}` as never,
            mark: 'point' as const,
          }))}
        />
      }
    >
      <Chart {...chart.props} height={320} ariaLabel="Product co-export network" />
    </GLFigure>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Delaunay and Voronoi
// ════════════════════════════════════════════════════════════════════════════

/**
 * `37-delaunay-network` — the triangulation of a scattered point set.
 *
 * Every edge is emitted once, not once per incident triangle. Drawn from raw
 * triangle sides, each interior edge strokes twice and renders visibly heavier
 * than the hull — which looks like a deliberate emphasis on the interior and is
 * not. `glDelaunayEdges` de-duplicates; `tests/network.test.ts` counts.
 *
 * The stations are irregularly spaced on purpose: four cocircular points have no
 * unique triangulation, so a regular lattice makes the result depend on
 * floating-point tie-breaks.
 */
function DelaunayNetwork() {
  const edges = glDelaunayEdges(stations, { x: (d) => d.x, y: (d) => d.y });

  const chart = glChart({
    marks: [
      glLink(edges, { x1: 'x1', y1: 'y1', x2: 'x2', y2: 'y2', tone: 'muted' }),
      glPoint(stations, { x: 'x', y: 'y' }),
    ],
    x: glAxisX({ label: 'Easting (km)', domain: [-4, 104] }),
    y: glAxisY({ label: 'Northing (km)', domain: [-4, 72] }),
  });

  return (
    <GLFigure
      title="Nearest-neighbour structure, from the stations alone."
      subtitle={`Delaunay triangulation of ${stations.length} measurement stations, ${edges.length} edges`}
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={280} ariaLabel="Station triangulation" />
    </GLFigure>
  );
}

/**
 * `65-voronoi-nearest-tooltip` — the triangulation's dual, at rest.
 *
 * TanStack's version uses these cells to route pointer events: whichever cell
 * the cursor is in names the nearest station. That half is still not buildable —
 * 0.6.5 exports no interaction API — but the cells themselves are, and drawing
 * them is more informative than describing them: each cell IS the region the
 * pointer would resolve to, so the plate shows the hit-testing rather than
 * asserting it.
 *
 * Cells tile the plane and cannot overlap, so §3.4's full opacity applies and
 * the scatter's 0.8 would only dilute them. The reading is an ordered variable
 * with no midpoint, so §12 sends it to five equal-width steps of one hue.
 *
 * The bounds are passed explicitly and not inferred, because an unbounded
 * Voronoi diagram has infinite cells at the hull — any inferred rectangle would
 * be a silent decision about how far past the data the chart claims to describe.
 */
function VoronoiCells() {
  const BOUNDS = [0, 0, 100, 68] as const;
  const cells = glVoronoiCells(stations, { x: (d) => d.x, y: (d) => d.y, bounds: BOUNDS });
  const features = glVoronoiFeatures(cells);
  const readings = cells.map((c) => c.row.reading);
  // Hoisted so the ramp legend reads its bins and cut points off the SAME scale
  // the cells are painted from — a second copy is a second thing to drift.
  const readingColor = glSequentialColor({
    domain: [Math.min(...readings), Math.max(...readings)],
    steps: 5,
  });

  const chart = glChart({
    marks: [
      glGeoShape(features as never, {
        // `geoIdentity` because the coordinates are already in the plane. The
        // reflect is the one thing that always differs: screen y counts down and
        // the data counts up.
        projection: { type: () => geoIdentity().reflectY(true), fit: 'data', inset: 2 } as never,
        // `as never` for the same reason `projection` takes one: `glGeoShape` is
        // typed against `GLGeoObject`, d3-geo's permissible-object union, which
        // has no `id` or `properties` — a Voronoi cell and a contour band are
        // both GeoJSON the mark can draw and neither is a shape it was declared
        // for. The cast is at the boundary, once, and the accessor below is
        // still typed.
        color: ((f: { id: number }) => cells[f.id].row.reading) as never,
      }),
    ],
    guides: false,
    color: { scale: readingColor },
    margin: { left: 8, right: 8, top: 8, bottom: 8 },
  });

  return (
    <GLFigure
      title="Each cell is the area nearest one station — and the region a pointer resolves to."
      subtitle={`Voronoi partition of ${stations.length} stations, shaded by reading`}
      source={SYNTHETIC}
      // A shaded partition is a BINNED encoding, so §3.11 gives it the stepped
      // ramp with its cut points printed — not two swatches naming the ends. The
      // chart paints five steps; "Lower" and "Higher" showed two of them and let
      // the reader guess at the rest.
      legend={<GLRampLegend scale={readingColor} label="Station reading" format={round} />}
    >
      <Chart {...chart.props} height={280} ariaLabel="Voronoi partition of the stations" />
    </GLFigure>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Contours
// ════════════════════════════════════════════════════════════════════════════

/**
 * `39-density-contours` — the two-dimensional kernel estimate.
 *
 * Read this against `spec-14-hexbin`, which draws the *same* cloud — and note
 * that they disagree. The hexbin resolves two regimes; the kernel merges them
 * into one mode with a shoulder. Neither is a bug: a hexbin cannot claim density
 * anywhere it has no observations, and a kernel estimate smooths across the gap
 * between clusters by construction. §12 paints both identically, so everything
 * different on screen is the estimator, which is exactly what the pairing is for.
 *
 * The bandwidth is the knob that decides it, and no default can pick it: at ten
 * cells the two clusters became a single blob, and this plate's caption said so
 * until the number came down.
 *
 * The lowest level is dropped by `glContourDensity`. It is the ring that
 * balloons furthest past the data — a kernel estimate is a *model*, and an
 * iso-line drawn where nothing was observed reads as evidence rather than as
 * smoothing.
 */
function DensityContours() {
  const { features, domain } = glContourDensity(cloudData, {
    x: 'x',
    y: 'y',
    resolution: 72,
    // Five cells, not ten. At ten the estimate smoothed `cloudData`'s clusters
    // into a single blob and the plate's caption claimed a structure the picture
    // did not have — which is the exact failure mode a kernel estimate has and
    // the reason `spec-14-hexbin` sits beside it. Bandwidth is the one knob a
    // density plot cannot pick for you.
    bandwidth: 5,
    levels: 5,
  });

  const densityColor = glSequentialColor({ domain, steps: 5 });

  const chart = glChart({
    marks: [
      glGeoShape(features as never, {
        projection: { type: () => geoIdentity().reflectY(true), fit: 'data', inset: 2 } as never,
        color: ((f: GLContourFeature) => f.properties.value) as never,
      }),
    ],
    guides: false,
    color: { scale: densityColor },
    margin: { left: 8, right: 8, top: 8, bottom: 8 },
  });

  return (
    <GLFigure
      title="The kernel merges into one mode what the hexbin kept as two."
      subtitle={`Kernel density over ${cloudData.length} trade pairs, bandwidth 5 cells; the outermost level is dropped`}
      source={SYNTHETIC}
      // No `format`: the density domain is a fraction, and the default picks
      // its precision from the span. Rounding to integers printed "0 0 0 0 1 1".
      legend={<GLRampLegend scale={densityColor} label="Kernel density" />}
    >
      <Chart {...chart.props} height={280} ariaLabel="Trade pair density contours" />
    </GLFigure>
  );
}

/**
 * `38-contour-topography` — filled contours over a value grid.
 *
 * Thresholds are pinned to whole metres per second rather than left to the
 * estimator. That is the same argument `binValues` makes for its own option: a
 * contour interval is conventionally a round number, and an estimator picking
 * 13.7 makes the chart harder to read for no gain.
 *
 * The nesting is the check worth making by eye — two lows and a ridge between
 * them, with every higher level strictly inside a lower one. If the grid rescale
 * flipped an axis the plate would still draw and still be wrong, which is why
 * `tests/contour.test.ts` asserts the nesting rather than trusting the picture.
 */
function TopographicContours() {
  const { features, domain } = glContourGrid(windField, {
    width: WIND_GRID.width,
    height: WIND_GRID.height,
    // FIVE levels, and the count is the ramp's business rather than the field's:
    // `glSequentialColor` resamples the authored five steps to whatever it is
    // asked for, and a sixth would INTERPOLATE between them into fills the
    // tokens do not enumerate. `gallery/audit.mjs` flags every one — which is
    // the check working, and the same finding the waffle produced.
    thresholds: [12, 16, 20, 24, 28],
    // Data units rather than cell indices: the field covers 480 × 320 km.
    extent: [0, 0, 480, 320],
  });

  const speedColor = glSequentialColor({ domain, steps: 5 });

  const chart = glChart({
    marks: [
      glGeoShape(features as never, {
        projection: { type: () => geoIdentity().reflectY(true), fit: 'data', inset: 2 } as never,
        color: ((f: GLContourFeature) => f.properties.value) as never,
      }),
    ],
    guides: false,
    color: { scale: speedColor },
    margin: { left: 8, right: 8, top: 8, bottom: 8 },
  });

  return (
    <GLFigure
      title="Two separate lows, with faster air over the saddle between them."
      subtitle="Surface wind speed, m/s, contoured at 4 m/s intervals over a 480 × 320 km field"
      source={SYNTHETIC}
      // The contours are cut at 12/16/20/24/28, and the ramp legend prints those
      // five numbers — which is the whole argument for the form over two
      // swatches reading "12 m/s" and "28 m/s".
      legend={<GLRampLegend scale={speedColor} label="Wind speed (m/s)" format={round} />}
    >
      <Chart {...chart.props} height={280} ariaLabel="Surface wind speed contours" />
    </GLFigure>
  );
}

// ── Renderers ───────────────────────────────────────────────────────────────

export const NETWORK_RENDERERS: Record<string, () => ReactNode> = {
  'ts-111-basic-sankey': BasicSankey,
  'ts-111-sankey-flow': SankeyFlow,
  'ts-40-force-directed-network': ForceNetwork,
  'ts-37-delaunay-network': DelaunayNetwork,
  'ts-65-voronoi-nearest-tooltip': VoronoiCells,
  'ts-39-density-contours': DensityContours,
  'ts-38-contour-topography': TopographicContours,
};
