/**
 * Checks for the graph layouts.
 *
 * Three things are guarded, and the third is the one that matters most.
 *
 * **The arithmetic.** A Sankey whose ribbons do not sum to their node's
 * throughput, or a triangulation that strokes every interior edge twice, is
 * wrong in a way the chart does not show — it draws, it just misstates the
 * quantity. Those are the bugs a render test cannot catch and a reader never
 * can.
 *
 * **Not mutating the caller's data.** `d3-sankey` and `d3-force` both rewrite
 * the objects they are handed — `source`/`target` strings become node
 * references, and nodes grow `x`/`y`/`vx`/`vy`. A caller who passed a module
 * constant and got it silently rewritten would find out on the second render.
 *
 * **Determinism.** The gallery's premise is that a diff only ever shows a real
 * change, and a force simulation that lands somewhere new on each pass breaks
 * it. `glForceLayout` pins its starting positions on a circle precisely so
 * `d3-force`'s one use of `Math.random()` — `jiggle()`, which fires when two
 * nodes coincide — never fires. If that ever stops holding, this file goes red
 * before a hundred plates start churning.
 *
 *   npm run check
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  glDelaunayEdges,
  glForceLayout,
  glSankeyLayout,
  glVoronoiCells,
  glVoronoiFeatures,
} from '../src/shapes/network.js';

// ── Fixtures ────────────────────────────────────────────────────────────────

const FLOW_NODES = [
  { id: 'Extraction' },
  { id: 'Refining' },
  { id: 'Domestic' },
  { id: 'Export' },
];

const FLOW_LINKS = [
  { source: 'Extraction', target: 'Refining', value: 60 },
  { source: 'Extraction', target: 'Domestic', value: 40 },
  { source: 'Refining', target: 'Export', value: 45 },
  { source: 'Refining', target: 'Domestic', value: 15 },
];

const SIZE = { width: 400, height: 240 };

/** A ring of points with one in the middle, so the triangulation is not a fan. */
const POINTS = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
  { x: 5, y: 5 },
];

// ════════════════════════════════════════════════════════════════════════════
// Sankey
// ════════════════════════════════════════════════════════════════════════════

test('every node is placed inside the extent it was given', () => {
  const { nodes } = glSankeyLayout({ nodes: FLOW_NODES, links: FLOW_LINKS }, SIZE);
  assert.equal(nodes.length, FLOW_NODES.length);
  for (const node of nodes) {
    assert.ok(node.x0 >= 0 && node.x1 <= SIZE.width, `${node.id} escaped horizontally`);
    assert.ok(node.y0 >= 0 && node.y1 <= SIZE.height, `${node.id} escaped vertically`);
    assert.ok(node.y1 > node.y0, `${node.id} has no height, so it carries no value`);
  }
});

test("a node's ribbons sum to its throughput", () => {
  // The one property a Sankey exists to assert. If the widths and the node
  // heights disagree, the diagram shows conservation it does not have.
  const { nodes, links } = glSankeyLayout({ nodes: FLOW_NODES, links: FLOW_LINKS }, SIZE);
  const refining = nodes.find((n) => n.id === 'Refining')!;
  const outgoing = links
    .filter((l) => l.source === 'Refining')
    .reduce((sum, l) => sum + l.value, 0);
  assert.equal(refining.value, outgoing);
  assert.equal(refining.value, 60);
});

test('ribbon width is proportional to value, at the same scale for every ribbon', () => {
  const { links } = glSankeyLayout({ nodes: FLOW_NODES, links: FLOW_LINKS }, SIZE);
  const perUnit = links.map((l) => l.width / l.value);
  for (const ratio of perUnit) {
    assert.ok(
      Math.abs(ratio - perUnit[0]) < 1e-9,
      'two ribbons use different pixels-per-unit, so their widths cannot be compared',
    );
  }
});

test('columns are ordered left to right by depth', () => {
  const { nodes } = glSankeyLayout({ nodes: FLOW_NODES, links: FLOW_LINKS }, SIZE);
  const extraction = nodes.find((n) => n.id === 'Extraction')!;
  const refining = nodes.find((n) => n.id === 'Refining')!;
  assert.equal(extraction.depth, 0);
  assert.ok(refining.x0 > extraction.x0, 'a downstream node is not to the right');
});

test('the caller\'s nodes and links are not rewritten', () => {
  // d3-sankey replaces `source`/`target` strings with node OBJECTS in place.
  const nodes = FLOW_NODES.map((n) => ({ ...n }));
  const links = FLOW_LINKS.map((l) => ({ ...l }));
  glSankeyLayout({ nodes, links }, SIZE);
  assert.deepEqual(nodes, FLOW_NODES, 'the node array was mutated');
  assert.deepEqual(links, FLOW_LINKS, 'the link array was mutated');
  assert.equal(typeof links[0].source, 'string');
});

test('a link naming an unknown node is dropped, not drawn', () => {
  const { links } = glSankeyLayout(
    {
      nodes: FLOW_NODES,
      links: [...FLOW_LINKS, { source: 'Extraction', target: 'Nowhere', value: 99 }],
    },
    SIZE,
  );
  assert.equal(links.length, FLOW_LINKS.length);
  assert.ok(!links.some((l) => l.target === 'Nowhere'));
});

// ════════════════════════════════════════════════════════════════════════════
// Force
// ════════════════════════════════════════════════════════════════════════════

const NET_NODES = Array.from({ length: 14 }, (_, i) => ({
  id: `n${i}`,
  group: i % 3 === 0 ? 'a' : 'b',
}));
const NET_LINKS = Array.from({ length: 13 }, (_, i) => ({
  source: `n${i}`,
  target: `n${i + 1}`,
}));

test('the force layout is deterministic across runs', () => {
  // The check the whole gallery depends on. Two calls with identical input must
  // produce byte-identical coordinates, or a re-render shows a diff that is not
  // a change.
  const a = glForceLayout(NET_NODES, NET_LINKS, { width: 400, height: 300 });
  const b = glForceLayout(NET_NODES, NET_LINKS, { width: 400, height: 300 });
  assert.deepEqual(
    a.nodes.map((n) => [n.id, n.x, n.y]),
    b.nodes.map((n) => [n.id, n.x, n.y]),
    'two identical layouts disagreed — d3-force reached Math.random(), which means ' +
      'two nodes coincided. Check the circular initialization in glForceLayout.',
  );
});

test('every node lands somewhere finite', () => {
  const { nodes } = glForceLayout(NET_NODES, NET_LINKS, { width: 400, height: 300 });
  assert.equal(nodes.length, NET_NODES.length);
  for (const node of nodes) {
    assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y), `${node.id} is at NaN`);
  }
});

test('degree counts both ends of every edge', () => {
  const { nodes } = glForceLayout(NET_NODES, NET_LINKS, { width: 400, height: 300 });
  const total = nodes.reduce((sum, n) => sum + n.degree, 0);
  assert.equal(total, NET_LINKS.length * 2);
  // A path graph: the two ends have one edge, everything between has two.
  assert.equal(nodes.find((n) => n.id === 'n0')!.degree, 1);
  assert.equal(nodes.find((n) => n.id === 'n7')!.degree, 2);
});

test('groups take distinct tones and ungrouped nodes take c-1', () => {
  const { nodes } = glForceLayout(NET_NODES, NET_LINKS, { width: 400, height: 300 });
  const a = nodes.find((n) => n.group === 'a')!.tone;
  const b = nodes.find((n) => n.group === 'b')!.tone;
  assert.notDeepEqual(a, b, 'two groups share a hue');

  const plain = glForceLayout(
    [{ id: 'x' }, { id: 'y' }],
    [{ source: 'x', target: 'y' }],
    { width: 100, height: 100 },
  );
  assert.equal(plain.nodes[0].tone, 'c-1');
});

test('the force layout does not rewrite the caller\'s nodes', () => {
  // d3-force writes x/y/vx/vy onto every node it simulates.
  const nodes = NET_NODES.map((n) => ({ ...n }));
  glForceLayout(nodes, NET_LINKS, { width: 400, height: 300 });
  assert.deepEqual(nodes, NET_NODES, 'the node array grew simulation state');
});

test('link endpoints resolve back to node positions', () => {
  const { nodes, links } = glForceLayout(NET_NODES, NET_LINKS, { width: 400, height: 300 });
  const at = new Map(nodes.map((n) => [n.id, n]));
  for (const link of links) {
    assert.equal(link.x1, at.get(link.source)!.x);
    assert.equal(link.y2, at.get(link.target)!.y);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// Delaunay and Voronoi
// ════════════════════════════════════════════════════════════════════════════

test('each triangulation edge appears exactly once', () => {
  // Drawn from raw triangle sides, every interior edge is stroked twice and
  // renders visibly heavier than the hull.
  const edges = glDelaunayEdges(POINTS, { x: (d) => d.x, y: (d) => d.y });
  const keys = edges.map((e) =>
    [`${e.x1},${e.y1}`, `${e.x2},${e.y2}`].sort().join('|'),
  );
  assert.equal(new Set(keys).size, keys.length, 'an edge was emitted twice');
  // Euler: a triangulation of 5 points with 4 on the hull has 8 edges.
  assert.equal(edges.length, 8);
});

test('a triangulation of fewer than three points is refused, not guessed', () => {
  assert.deepEqual(glDelaunayEdges([{ x: 0, y: 0 }], { x: (d) => d.x, y: (d) => d.y }), []);
});

test('every Voronoi cell is closed and inside its bounds', () => {
  const cells = glVoronoiCells(POINTS, {
    x: (d) => d.x,
    y: (d) => d.y,
    bounds: [-1, -1, 11, 11],
  });
  assert.equal(cells.length, POINTS.length);
  for (const cell of cells) {
    const first = cell.polygon[0];
    const last = cell.polygon[cell.polygon.length - 1];
    assert.deepEqual(first, last, 'a cell ring is not closed');
    for (const [x, y] of cell.polygon) {
      assert.ok(x >= -1.001 && x <= 11.001 && y >= -1.001 && y <= 11.001, 'a cell escaped');
    }
  }
});

test('a cell centroid ignores the duplicated closing vertex', () => {
  // Averaging the closed ring double-counts one corner and pulls the label
  // toward it — invisible on a regular cell, obvious on a long thin one.
  const cells = glVoronoiCells(
    [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    { x: (d) => d.x, y: (d) => d.y, bounds: [0, 0, 10, 10] },
  );
  // Each cell is half the square, so its centroid is the middle of that half.
  assert.ok(Math.abs(cells[0].cx - 2.5) < 1e-9);
  assert.ok(Math.abs(cells[0].cy - 5) < 1e-9);
});

test('cells convert to GeoJSON features keyed by their row index', () => {
  const cells = glVoronoiCells(POINTS, {
    x: (d) => d.x,
    y: (d) => d.y,
    bounds: [-1, -1, 11, 11],
  });
  const features = glVoronoiFeatures(cells);
  assert.equal(features.length, cells.length);
  assert.equal(features[0].type, 'Feature');
  assert.equal(features[0].geometry.type, 'Polygon');
  assert.equal(features[0].id, cells[0].index);
});
