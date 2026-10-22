/**
 * `@growth-lab/gl-charts/shapes` — graph layouts.
 *
 * Sankey flows, force-directed networks, and Delaunay triangulations with their
 * Voronoi dual. All four are the same shape of problem the treemap is: TanStack
 * ships marks and transforms but **no layout of any kind**, so a chart whose
 * geometry has to be computed before any mark exists has to get that geometry
 * from somewhere. Here it is `d3-sankey`, `d3-force` and `d3-delaunay`, declared
 * and pinned exactly like `d3-hierarchy`.
 *
 * ## What is a whole chart here and what is only data
 *
 * `glSankeyChart` is a whole-chart function, for the two reasons the treemap is
 * one: the layout runs at the RESOLVED PIXEL SIZE (a Sankey's node rectangles
 * and ribbon widths are pixel quantities, not data quantities), and the paint
 * decision is not the caller's to make freely — see the ribbon note below.
 *
 * `glForceLayout`, `glDelaunayEdges` and `glVoronoiCells` return **data**, not
 * marks, on the same principle as `waterfall` and `linearFit` in `compose.ts`:
 * how you draw a network is editorial. The same positioned nodes are a scatter
 * with edges, a labelled diagram, or a backdrop for something else, and only the
 * caller knows which. §3.4.2 already decides how each of those marks is painted,
 * so there is nothing left for a preset to add.
 *
 * ## The ribbon, and where this departs from §3.4.2
 *
 * `SPEC.md` §3.4.2 names "a Sankey link" in its list of CONNECTORS, which
 * take the series DARK tone at line weight. That ruling was written for a
 * dumbbell bar, a candlestick wick and a boxplot whisker — marks that are two
 * pixels wide. A Sankey ribbon is the same geometry at forty, and the rule does
 * not survive the scale change: a plot of overlapping dark ribbons at full
 * opacity is unreadable, and the node rectangles the ribbons are supposed to
 * connect disappear underneath them.
 *
 * So `glSankeyChart` paints a ribbon in its source node's **light** tone and the
 * nodes in `main`. That follows §3.3, which already gives light the background
 * job — a flow is the background of the two nodes it joins — and it is the same
 * reasoning §3.9 uses to make a band the light tone rather than a translucent
 * main: a known flat colour wherever two ribbons cross, instead of a different
 * colour over every mark they cross, and a lightness step that survives
 * greyscale where an alpha does not.
 *
 * ## One hue, not one per column
 *
 * The other decision worth stating, because the form invites the opposite. A
 * Sankey's columns are stages of one process, not competing subjects, and §3.1
 * asks the prior question — is colour carrying a finding here? It is not: the
 * finding is in the positions and the ribbon widths. So every column defaults to
 * `c-1` and the diagram reads as one process. `tones` spends more when the
 * columns genuinely are different subjects.
 *
 * **This is a departure and it is recorded as one.** The rule should be amended
 * upstream in `grammar.md` — a connector's tone should depend on whether it is a
 * hairline or a ribbon — rather than left as a downstream file quietly
 * disagreeing with the spec. Until it is, `linkTone` lets a caller take the
 * §3.4.2 reading back.
 */

import type { ChartAxisOptions, ChartCurve } from '@tanstack/charts';
import { scaleLinear } from '@tanstack/charts-scales/linear';
import { Delaunay } from 'd3-delaunay';
import {
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from 'd3-force';
import { sankey as d3Sankey, sankeyJustify, sankeyLeft } from 'd3-sankey';

import { glChart, type GLChart } from '../chart.js';
import { warn } from '../dev.js';
import { glLabel, glLink, glTile } from '../marks.js';
import { resolveTone, series as toneAt, type GLToneRef } from '../tone.js';
import { typeRoles } from '../tokens.js';

// ── Shared ──────────────────────────────────────────────────────────────────

/**
 * A pixel-space axis: the scale is the plot in pixels and there is no visible
 * axis at all.
 *
 * The same device the treemap uses, and for the same reason. A graph layout's
 * coordinates are placement, not measurement — "412 pixels across" is not a
 * quantity anyone reads — so drawing an axis beside one would be labelling the
 * device rather than the data. `axis: false` keeps the scale and omits the
 * chrome; `guides: false` would drop the scales too and every channel would then
 * need a configured instance.
 */
function pixelAxis(extent: number, descending = false): ChartAxisOptions<number> {
  return {
    scale: scaleLinear().domain(descending ? [extent, 0] : [0, extent]),
    nice: false,
    grid: false,
    axis: false,
  };
}

/**
 * A horizontal bump curve — cubic bezier with control points pulled to the
 * midpoint in x, which is the shape a flow ribbon wants.
 *
 * Written out rather than imported from `d3-shape`'s `curveBumpX` because
 * `ChartCurve` is a two-method interface over point pairs and this is six lines.
 * Pulling in a whole shape package to get them would be the opposite of the rule
 * the rest of this file follows: take the dependency where it does real work
 * (a layout), never where it saves an arithmetic expression.
 */
export const glFlowCurve: ChartCurve = {
  line: (points) => {
    if (points.length < 2) return '';
    let path = `M${points[0][0]},${points[0][1]}`;
    for (let i = 1; i < points.length; i += 1) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      const mid = (x0 + x1) / 2;
      path += `C${mid},${y0} ${mid},${y1} ${x1},${y1}`;
    }
    return path;
  },
  // A ribbon drawn as a thick stroked line never asks for the area form; a flow
  // built out of two edges would, so it is implemented rather than thrown.
  area: (top, bottom) => {
    const forward = glFlowCurve.line(top);
    const back = glFlowCurve.line([...bottom].reverse());
    if (!forward || !back) return '';
    return `${forward}L${back.slice(1)}Z`;
  },
};

// ════════════════════════════════════════════════════════════════════════════
// Sankey
// ════════════════════════════════════════════════════════════════════════════

export interface GLFlowNode {
  /** Join key. Links name their endpoints with these. */
  id: string;
  /** Display name. Defaults to `id`. */
  name?: string;
}

export interface GLFlowLink {
  source: string;
  target: string;
  value: number;
}

/** A node after the layout has placed it. Coordinates are plot pixels. */
export interface GLPlacedNode extends GLFlowNode {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Total throughput — the larger of inflow and outflow. */
  value: number;
  /** Column index, zero at the left. Decides the node's hue. */
  depth: number;
  tone: GLToneRef;
}

/** A link after the layout has placed it. `width` is in plot pixels. */
export interface GLPlacedLink {
  source: string;
  target: string;
  value: number;
  width: number;
  /** Which step of `tone` paints the ribbon. See `linkTone`. */
  step: 'light' | 'dark';
  /** Ribbon centreline endpoints, ready for `glLink`. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  tone: GLToneRef;
}

/**
 * How nodes without an inflow or outflow are aligned into columns.
 *
 * `justify` (the default) pushes sinks to the right-hand edge, which is what
 * makes a flow diagram read as "in on the left, out on the right". `left`
 * packs every node as far left as its dependencies allow, which is right when
 * the columns are stages of a process and an early terminus is genuinely early.
 */
export type GLFlowAlign = 'justify' | 'left';

export interface GLSankeyChartOptions {
  nodes: readonly GLFlowNode[];
  links: readonly GLFlowLink[];
  /** Node rectangle width in px. Defaults to 14. */
  nodeWidth?: number;
  /** Vertical gap between nodes in a column, px. Defaults to 12. */
  nodePadding?: number;
  align?: GLFlowAlign;
  /** Draw node names beside their rectangles. On by default. */
  labels?: boolean;
  /** Format a node's label. Defaults to its name. */
  labelFormat?: (node: GLPlacedNode) => string;
  /**
   * Which tone a ribbon takes, and at which step.
   *
   * `'source'` (the default) and `'target'` give it the LIGHT tone of the node
   * at that end — see the module header for why that departs from §3.4.2 and why
   * the departure is the honest reading.
   *
   * Passing an explicit `GLToneRef` takes the §3.4.2 connector reading back
   * literally: every ribbon in that hue's DARK tone, at full opacity. It is worth
   * trying once on real data; `ts-111-sankey-flow` in the gallery is that plate.
   */
  linkTone?: 'source' | 'target' | GLToneRef;
  /**
   * Hue per column, in column order.
   *
   * Defaults to `c-1` for EVERY column, which is §3.1 applied to a form that
   * invites the opposite: a Sankey's columns are stages of one process, not four
   * competing subjects, and nothing about the chart's finding is carried by
   * telling them apart by hue. Position and ribbon width carry all of it. Pass
   * per-column tones when the columns genuinely are different subjects.
   */
  tones?: readonly GLToneRef[];
}

/**
 * Lay out a flow graph in a pixel box.
 *
 * Exported separately from the chart so a caller who wants a different drawing —
 * ribbons only, nodes only, an annotated variant — gets the geometry without
 * inheriting the paint. Returns plot-pixel coordinates, so it needs the size the
 * chart resolved to.
 */
export function glSankeyLayout(
  o: GLSankeyChartOptions,
  size: { width: number; height: number },
): { nodes: GLPlacedNode[]; links: GLPlacedLink[] } {
  const width = Math.max(1, size.width);
  const height = Math.max(1, size.height);

  const known = new Set(o.nodes.map((n) => n.id));
  const dangling = o.links.filter((l) => !known.has(l.source) || !known.has(l.target));
  if (dangling.length) {
    warn(
      `${dangling.length} link(s) name a node that is not in \`nodes\` ` +
        `(${dangling.slice(0, 3).map((l) => `${l.source}→${l.target}`).join(', ')}). ` +
        `They are dropped — a flow diagram that invents a node also invents the ` +
        `throughput it carries.`,
    );
  }
  const links = o.links.filter((l) => known.has(l.source) && known.has(l.target));
  if (!links.length) return { nodes: [], links: [] };

  // d3-sankey MUTATES the objects it is given, replacing `source`/`target`
  // strings with node references. Copies, so a caller's data is never rewritten
  // under them — the same courtesy `stackOrder` and `movingAverage` extend.
  const layout = d3Sankey<{ id: string; name?: string }, { value: number }>()
    .nodeId((d: any) => d.id)
    .nodeWidth(o.nodeWidth ?? 14)
    .nodePadding(o.nodePadding ?? 12)
    .nodeAlign(o.align === 'left' ? sankeyLeft : sankeyJustify)
    .extent([
      [0, 0],
      [width, height],
    ]);

  const graph = layout({
    nodes: o.nodes.map((n) => ({ ...n })) as any,
    links: links.map((l) => ({ ...l })) as any,
  });

  // One hue unless the caller spends more — see `tones`.
  const toneFor = (depth: number): GLToneRef => o.tones?.[depth] ?? 'c-1';

  const nodes: GLPlacedNode[] = (graph.nodes as any[]).map((n) => ({
    id: n.id,
    name: n.name ?? n.id,
    x0: n.x0,
    x1: n.x1,
    y0: n.y0,
    y1: n.y1,
    value: n.value ?? 0,
    depth: n.depth ?? 0,
    tone: toneFor(n.depth ?? 0),
  }));

  const end = o.linkTone ?? 'source';
  const explicitTone = end !== 'source' && end !== 'target' ? (end as GLToneRef) : undefined;
  const placed: GLPlacedLink[] = (graph.links as any[]).map((l) => {
    const from = l.source;
    const to = l.target;
    const explicit = explicitTone;
    return {
      source: from.id,
      target: to.id,
      value: l.value,
      width: Math.max(1, l.width ?? 1),
      // `light` for the endpoint-derived default, `dark` for an explicit tone —
      // the two readings of §3.4.2, and the caller picks by which they pass.
      step: (explicit ? 'dark' : 'light') as 'dark' | 'light',
      // The centreline, because `glLink` strokes a segment and the ribbon's
      // thickness is its stroke width. `y0`/`y1` from d3-sankey are already the
      // centre of the ribbon at each end.
      x1: from.x1,
      y1: l.y0,
      x2: to.x0,
      y2: l.y1,
      tone: explicit ?? toneFor((end === 'target' ? to.depth : from.depth) ?? 0),
    };
  });

  return { nodes, links: placed };
}

/**
 * Sankey diagram — flows between nodes, where the width of every ribbon is the
 * quantity moving along it.
 *
 * ```ts
 * glSankeyChart({
 *   nodes: [{ id: 'Extraction' }, { id: 'Refining' }, { id: 'Export' }],
 *   links: [
 *     { source: 'Extraction', target: 'Refining', value: 42 },
 *     { source: 'Refining', target: 'Export', value: 31 },
 *   ],
 * })
 * ```
 *
 * The definition is DYNAMIC — `glChart` is handed a `(ctx) => spec` build
 * function — because a Sankey's node rectangles and ribbon widths are pixel
 * quantities. Laying out in a unit box and scaling afterwards would make the
 * node width and the inter-node padding stretch with the aspect ratio, which is
 * exactly what those two constants exist to hold fixed.
 *
 * Marks paint in array order, so the ribbons are emitted before the nodes: a
 * node rectangle is the anchor the reader traces flows between, and it has to
 * sit on top of them.
 */
export function glSankeyChart(
  o: GLSankeyChartOptions,
): GLChart<unknown, number, number> {
  const labelled = o.labels ?? true;
  const format = o.labelFormat ?? ((n: GLPlacedNode) => n.name ?? n.id);

  return glChart<unknown, number, number>(({ width, height }) => {
    // Room on BOTH sides. The first column's labels read leftward and the last
    // column's read rightward, so reserving only the right gutter clips every
    // source node's name — which is exactly what the first render of the
    // gallery's Sankey did.
    const gutter = labelled ? 92 : 0;
    const inner = Math.max(1, width - gutter * 2);
    const { nodes, links } = glSankeyLayout(o, { width: inner, height });

    // The layout ran in a box `gutter` px narrower on each side, so everything
    // it placed shifts right by that much.
    for (const node of nodes) {
      node.x0 += gutter;
      node.x1 += gutter;
    }
    for (const link of links) {
      link.x1 += gutter;
      link.x2 += gutter;
    }

    const lastDepth = Math.max(0, ...nodes.map((n) => n.depth));

    const marks: unknown[] = [
      // Ribbons first — see the note above. The stroke width IS the value, which
      // is why it is a per-datum channel rather than a constant: `LinkOptions`
      // takes `strokeWidth` as a `VisualChannel`, so one mark carries every
      // ribbon at its own thickness.
      ...links.map((link) =>
        glLink([link], {
          x1: 'x1',
          y1: 'y1',
          x2: 'x2',
          y2: 'y2',
          tone: link.tone,
          stroke: resolveTone(link.tone)[link.step],
          strokeWidth: () => link.width,
          curve: glFlowCurve,
        }),
      ),
      ...nodes.map((node) =>
        glTile([node], {
          x1: 'x0',
          x2: 'x1',
          y1: 'y0',
          y2: 'y1',
          tone: node.tone,
        }),
      ),
    ];

    if (labelled) {
      marks.push(
        glLabel(nodes, {
          // Labels read outward: a node in the last column has nothing to its
          // right, so its label goes there; every other node's goes to the left
          // of its rectangle, into the gap the previous column's ribbons cross.
          x: (n: GLPlacedNode) => (n.depth === lastDepth ? n.x1 : n.x0),
          y: (n: GLPlacedNode) => (n.y0 + n.y1) / 2,
          text: (n: GLPlacedNode) => format(n),
          fill: (n: GLPlacedNode) => resolveTone(n.tone).dark,
          anchor: (n: GLPlacedNode) => (n.depth === lastDepth ? 'start' : 'end'),
          dx: (n: GLPlacedNode) => (n.depth === lastDepth ? 8 : -8),
          fontSize: typeRoles.seriesLabel.size,
          fontWeight: typeRoles.seriesLabel.weight,
        } as never),
      );
    }

    return {
      marks,
      x: pixelAxis(width),
      y: pixelAxis(height),
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    };
  }, { variant: { labelHalo: true } });
}

// ════════════════════════════════════════════════════════════════════════════
// Force-directed
// ════════════════════════════════════════════════════════════════════════════

export interface GLNetworkNode {
  id: string;
  /** Partition for colour. Optional; without it every node takes `c-1`. */
  group?: string;
}

export interface GLNetworkLink {
  source: string;
  target: string;
  /** Edge weight. Used for the link distance, and available for stroke width. */
  value?: number;
}

export interface GLPositionedNode extends GLNetworkNode {
  x: number;
  y: number;
  /** Number of edges incident on this node. */
  degree: number;
  tone: GLToneRef;
}

export interface GLPositionedLink extends GLNetworkLink {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface GLForceLayoutOptions {
  /** Plot extent the layout is centred in. */
  width: number;
  height: number;
  /**
   * Simulation steps. 300 is d3's own default lifetime and settles this size of
   * graph; more is slower and visibly no different.
   */
  ticks?: number;
  /** Target edge length in px. Defaults to a twelfth of the smaller extent. */
  distance?: number;
  /** Node repulsion. More negative spreads the graph. Defaults to −180. */
  charge?: number;
  /** Hue per group, in first-appearance order. Defaults to the palette. */
  tones?: readonly GLToneRef[];
}

/**
 * Force-directed layout, run to completion **synchronously and
 * deterministically**.
 *
 * Both of those matter more here than anywhere else in the library.
 *
 * *Synchronously*, because a chart definition is data: `glChart` produces a
 * `ChartDefinition` and nothing in the pipeline can await a simulation that
 * settles over animation frames. `simulation.stop()` followed by a fixed number
 * of `.tick()` calls is d3's own supported way to do this.
 *
 * *Deterministically*, because the gallery's whole premise is that a diff only
 * ever shows a real change, and a chart that lands somewhere new on every render
 * breaks it. d3 initializes nodes on a phyllotaxis spiral, which is already
 * deterministic; this pins them on a circle instead, which is both deterministic
 * and — the reason it is worth doing — guarantees no two nodes start at the same
 * point. `d3-force`'s only use of `Math.random()` is `jiggle()`, which fires
 * exactly when two nodes coincide, so removing coincidence removes the
 * randomness. A graph with duplicate ids can still coincide; that warns.
 *
 * Returns data, not marks. §3.4.2 already decides how to paint both halves — an
 * edge is a CONNECTOR (dark tone, line weight, butt cap) and a node is a scatter
 * circle at 0.8 — so there is nothing a preset would add beyond a layout the
 * caller may want to draw three different ways.
 */
export function glForceLayout(
  nodes: readonly GLNetworkNode[],
  links: readonly GLNetworkLink[],
  o: GLForceLayoutOptions,
): { nodes: GLPositionedNode[]; links: GLPositionedLink[] } {
  const ids = new Set(nodes.map((n) => n.id));
  if (ids.size !== nodes.length) {
    warn(
      'Duplicate node ids in the force layout. Two nodes sharing an id start at ' +
        'the same coordinates, which is the one case `d3-force` breaks its own ' +
        'determinism to escape — the render will differ between passes.',
    );
  }
  const edges = links.filter((l) => ids.has(l.source) && ids.has(l.target));
  if (edges.length !== links.length) {
    warn(
      `${links.length - edges.length} edge(s) name a node that is not in \`nodes\` ` +
        'and are dropped.',
    );
  }
  if (!nodes.length) return { nodes: [], links: [] };

  const degree = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }

  const groups = [...new Set(nodes.map((n) => n.group ?? ''))];
  const toneFor = (group: string): GLToneRef => {
    if (!group) return 'c-1';
    const index = groups.filter(Boolean).indexOf(group);
    return o.tones?.[index] ?? toneAt(Math.max(0, index));
  };

  const radius = Math.min(o.width, o.height) / 3;
  // Deterministic, non-coincident starting positions. See the doc comment.
  const simNodes = nodes.map((n, i) => ({
    ...n,
    x: o.width / 2 + Math.cos((i / nodes.length) * Math.PI * 2) * radius,
    y: o.height / 2 + Math.sin((i / nodes.length) * Math.PI * 2) * radius,
  }));
  const simLinks = edges.map((l) => ({ ...l }));

  const distance = o.distance ?? Math.min(o.width, o.height) / 12;
  const simulation = forceSimulation(simNodes as any)
    .force(
      'link',
      forceLink(simLinks as any)
        .id((d: any) => d.id)
        .distance(distance)
        .strength(0.4),
    )
    .force('charge', forceManyBody().strength(o.charge ?? -180))
    .force('center', forceCenter(o.width / 2, o.height / 2))
    // Weak positional forces toward the centre, so a disconnected component
    // cannot drift out of the plot and be silently clipped.
    .force('x', forceX(o.width / 2).strength(0.045))
    .force('y', forceY(o.height / 2).strength(0.045))
    .stop();

  simulation.tick(Math.max(1, o.ticks ?? 300));

  const placed: GLPositionedNode[] = (simNodes as any[]).map((n) => ({
    id: n.id,
    group: n.group,
    x: n.x,
    y: n.y,
    degree: degree.get(n.id) ?? 0,
    tone: toneFor(n.group ?? ''),
  }));
  const at = new Map(placed.map((n) => [n.id, n]));

  return {
    nodes: placed,
    links: (simLinks as any[]).map((l) => {
      const from = at.get(typeof l.source === 'object' ? l.source.id : l.source)!;
      const to = at.get(typeof l.target === 'object' ? l.target.id : l.target)!;
      return {
        source: from.id,
        target: to.id,
        value: l.value,
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
      };
    }),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Delaunay and Voronoi
// ════════════════════════════════════════════════════════════════════════════

export interface GLEdge<T> {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** The two rows the edge joins, for labelling or filtering. */
  from: T;
  to: T;
}

export interface GLDelaunayOptions<T> {
  x: (d: T, index: number) => number;
  y: (d: T, index: number) => number;
}

/**
 * The edges of a Delaunay triangulation, de-duplicated.
 *
 * Each edge appears once, not once per incident triangle — a triangulation
 * drawn from raw triangle sides strokes every interior edge twice, which at
 * §3.4.2's line weight is visibly heavier than the hull.
 *
 * Returns data. An edge is a CONNECTOR under §3.4.2 (dark tone, line weight,
 * butt cap) whether it is a network link or a triangulation side, so `glLink`
 * paints these correctly with no further decision.
 */
export function glDelaunayEdges<T>(
  rows: readonly T[],
  o: GLDelaunayOptions<T>,
): GLEdge<T>[] {
  if (rows.length < 3) {
    warn(`A triangulation needs at least three points; ${rows.length} were given.`);
    return [];
  }
  const delaunay = Delaunay.from(
    rows as T[],
    (d, i) => o.x(d, i),
    (d, i) => o.y(d, i),
  );

  const seen = new Set<string>();
  const edges: GLEdge<T>[] = [];
  const { triangles } = delaunay;
  for (let i = 0; i < triangles.length; i += 3) {
    const corners = [triangles[i], triangles[i + 1], triangles[i + 2]];
    for (let c = 0; c < 3; c += 1) {
      const a = corners[c];
      const b = corners[(c + 1) % 3];
      // Order-independent key, so the two triangles sharing an edge agree.
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({
        x1: delaunay.points[a * 2],
        y1: delaunay.points[a * 2 + 1],
        x2: delaunay.points[b * 2],
        y2: delaunay.points[b * 2 + 1],
        from: rows[a],
        to: rows[b],
      });
    }
  }
  return edges;
}

export interface GLVoronoiCell<T> {
  /** Ring in input coordinates, closed. */
  polygon: [number, number][];
  /** Centroid, for placing a label. */
  cx: number;
  cy: number;
  row: T;
  index: number;
}

export interface GLVoronoiOptions<T> extends GLDelaunayOptions<T> {
  /** Clip rectangle: `[xMin, yMin, xMax, yMax]` in input coordinates. */
  bounds: readonly [number, number, number, number];
}

/**
 * Voronoi cells — the region of the plane closest to each point.
 *
 * The bounds are REQUIRED and not inferred, because an unbounded Voronoi
 * diagram has infinite cells at the hull and any inferred rectangle would be a
 * silent editorial decision about how far past the data the chart claims to
 * describe. Pass the axis domains.
 *
 * Cells tile the plane and cannot overlap, so they are single-layer marks:
 * §3.4's full opacity applies and the scatter's 0.8 would only dilute them.
 * Draw with `glRegion` or route the ring through a polygon-capable mark.
 */
export function glVoronoiCells<T>(
  rows: readonly T[],
  o: GLVoronoiOptions<T>,
): GLVoronoiCell<T>[] {
  if (!rows.length) return [];
  const delaunay = Delaunay.from(
    rows as T[],
    (d, i) => o.x(d, i),
    (d, i) => o.y(d, i),
  );
  const [xMin, yMin, xMax, yMax] = o.bounds;
  const voronoi = delaunay.voronoi([xMin, yMin, xMax, yMax]);

  const cells: GLVoronoiCell<T>[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const polygon = voronoi.cellPolygon(i) as [number, number][] | null;
    if (!polygon || polygon.length < 3) continue;
    // Drop the duplicated closing vertex before averaging, or it weights one
    // corner twice and the label drifts toward it.
    const ring = polygon.slice(0, -1);
    cells.push({
      polygon,
      cx: ring.reduce((sum, [x]) => sum + x, 0) / ring.length,
      cy: ring.reduce((sum, [, y]) => sum + y, 0) / ring.length,
      row: rows[i],
      index: i,
    });
  }
  return cells;
}

/**
 * Voronoi cells as GeoJSON `Polygon` features.
 *
 * The one polygon-capable mark in the stack is `geoShape`, so an arbitrary ring
 * reaches a chart by being handed to it through `geoIdentity` — the same route
 * the contour module takes, and the reason both live behind `/shapes`. Each
 * feature carries its row's index as `id` so a colour join has a key.
 */
export function glVoronoiFeatures<T>(cells: readonly GLVoronoiCell<T>[]) {
  return cells.map((cell) => ({
    type: 'Feature' as const,
    id: cell.index,
    properties: { index: cell.index },
    geometry: { type: 'Polygon' as const, coordinates: [cell.polygon] },
  }));
}
