/**
 * Scene-level checks: the marks actually draw, and draw where they should.
 *
 * `marks.test.ts` reads `glDefaults`, which is the right boundary for *values* —
 * everything above it is ours, everything below is TanStack's. But a wrapper can
 * produce a perfectly correct options bag and still draw nothing, because
 * TanStack channels are a field name or a function and a **raw number is
 * neither**: a mark handed one emits no nodes at all, with no error and no
 * warning. `glStemX` shipped that way for exactly as long as it took to look at
 * a scene.
 *
 * So these build a real scene with `createChartScene` — no browser — and assert
 * on the emitted `SceneNode`s. The rule of thumb for what belongs here: if the
 * failure mode is "the mark is missing" or "the mark is in the wrong place",
 * it is a scene test; if it is "the mark is the wrong colour", `marks.test.ts`
 * catches it a hundred times faster.
 *
 *   npm run check
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createChartScene } from '@tanstack/charts';

import {
  glAxisBand,
  glAxisBin,
  glAxisY,
  glBand,
  glBarX,
  glChart,
  glHexbin,
  glHexbinLattice,
  glLine,
  glLink,
  glPoint,
  glRuleY,
  glStemX,
  glStemY,
  glTickX,
} from '../src/index.js';
import { glDonutChart } from '../src/shapes/polar.js';
import { categorical, geometry, ink, opacity } from '../src/tokens.js';

type Node = Record<string, any>;

function sceneOf(chart: { definition: unknown }, width = 400, height = 300) {
  const scene = createChartScene(chart.definition as never, { width, height }) as any;
  const nodes: Node[] = [];
  const walk = (list: Node[]) =>
    list.forEach((n) => {
      nodes.push(n);
      if (n.children) walk(n.children);
    });
  walk(scene.nodes);
  return { scene, nodes };
}

/** Nodes a mark drew, as opposed to axis, gridline and tick chrome. */
const dataNodes = (nodes: Node[]) =>
  nodes.filter(
    (n) =>
      n.kind !== 'group' &&
      !/^(x|y)-(grid|axis|tick)/.test(String(n.key)) &&
      !String(n.key).startsWith('x-tick') &&
      !String(n.key).startsWith('y-tick'),
  );

const rows = [
  { c: 'A', v: 8 },
  { c: 'B', v: 3 },
];

// ── The silent-vanish class ─────────────────────────────────────────────────

test('a lollipop stem draws, and runs from the baseline to the value', () => {
  const chart = glChart({
    marks: [glStemX(rows, { x: 'c', y: 'v' }), glPoint(rows, { x: 'c', y: 'v' })],
    x: glAxisBand(),
    y: glAxisY(),
  });
  const { scene, nodes } = sceneOf(chart);
  const stems = dataNodes(nodes).filter((n) => n.kind === 'rule');

  assert.equal(stems.length, rows.length, 'every row needs a stem — none may vanish');

  const baseline = scene.chart.y + scene.chart.height;
  for (const stem of stems) {
    assert.equal(stem.y1, baseline, 'a stem starts at the baseline');
    assert.ok(stem.y2 < baseline, 'and stops at the value, not the plot edge');
    assert.equal(stem.style.stroke, categorical['c-1'].main, 'a stem is data: main tone');
    assert.equal(stem.style.strokeWidth, geometry.lineWidth);
  }
  // The taller value must produce the taller stem.
  assert.ok(stems[0].y2 < stems[1].y2);
});

test('a horizontal stem draws too', () => {
  const chart = glChart({
    marks: [glStemY(rows, { y: 'c', x: 'v' })],
    x: glAxisY(),
    y: glAxisBand(),
  });
  assert.equal(dataNodes(sceneOf(chart).nodes).filter((n) => n.kind === 'rule').length, 2);
});

test('every new mark emits at least one node', () => {
  // The blanket version of the test above: a wrapper that silently draws
  // nothing passes every value assertion in marks.test.ts.
  const est = [{ c: 'A', lo: 2, hi: 8 }];
  const cases: Record<string, { marks: unknown[]; x: unknown; y: unknown }> = {
    link: {
      marks: [glLink(est, { x1: 'c', x2: 'c', y1: 'lo', y2: 'hi' })],
      x: glAxisBand(),
      y: glAxisY(),
    },
    tick: { marks: [glTickX(est, { x: 'c', y: 'lo' })], x: glAxisBand(), y: glAxisY() },
    barX: { marks: [glBarX(rows, { y: 'c', x: 'v' })], x: glAxisY(), y: glAxisBand() },
    hexbin: { marks: [glHexbin(rows, { x: 'v', y: 'v' })], x: glAxisY(), y: glAxisY() },
  };
  for (const [name, { marks, x, y }] of Object.entries(cases)) {
    const chart = glChart({ marks, x: x as never, y: y as never });
    assert.ok(dataNodes(sceneOf(chart).nodes).length > 0, `${name} drew nothing`);
  }
});

// ── §3.4.2: chrome spans the plot, data does not ────────────────────────────

test('a reference rule spans the plot and takes no series hue', () => {
  // The chrome/data split lands on two different TanStack marks, because a rule
  // ignores its endpoint channels (constraints.test.ts §7). That limitation is
  // exactly right for chrome: a threshold SHOULD cross the plot.
  const chart = glChart({
    marks: [glLine(rows, { x: 'c', y: 'v' }), glRuleY([5], { y: (d: number) => d })],
    x: glAxisBand(),
    y: glAxisY(),
  });
  const { scene, nodes } = sceneOf(chart);
  const rule = dataNodes(nodes).find(
    (n) => n.kind === 'rule' && n.style?.strokeDasharray === geometry.ruleDash,
  );
  assert.ok(rule, 'no dashed reference rule in the scene');
  assert.equal(rule.x1, scene.chart.x);
  assert.equal(rule.x2, scene.chart.x + scene.chart.width);
  assert.equal(rule.style.stroke, ink[3]);
});

// ── §3.9: a band sits behind the line it qualifies ──────────────────────────

test('a band listed before its line paints behind it', () => {
  // Marks paint in array order, so this is really a check that the ordering
  // contract holds in the emitted scene — a band that painted last would cover
  // the value it exists to qualify.
  const series = rows.map((r) => ({ ...r, lo: r.v - 1, hi: r.v + 1 }));
  const chart = glChart({
    marks: [
      glBand(series, { x: 'c', y1: 'lo', y2: 'hi' }),
      glLine(series, { x: 'c', y: 'v' }),
    ],
    x: glAxisBand(),
    y: glAxisY(),
  });
  const drawn = dataNodes(sceneOf(chart).nodes);
  const band = drawn.findIndex((n) => n.style?.fill === categorical['c-1'].light);
  const line = drawn.findIndex((n) => n.style?.stroke === categorical['c-1'].main);
  assert.ok(band >= 0, 'the band did not draw');
  assert.ok(line >= 0, 'the line did not draw');
  assert.ok(band < line, 'the band must be emitted before the line');
});

// ── Binned marks are tiles ──────────────────────────────────────────────────

test('a binned axis leaves no gap between bars, unlike a band axis', () => {
  const bars = (axis: unknown) =>
    dataNodes(
      sceneOf(
        glChart({ marks: [glBarX(rows, { y: 'c', x: 'v' })], x: glAxisY(), y: axis as never }),
      ).nodes,
    ).filter((n) => n.kind === 'rect');

  const binned = bars(glAxisBin());
  const banded = bars(glAxisBand());
  assert.ok(binned.length && banded.length, 'no bars drawn');
  assert.ok(
    binned[0].height > banded[0].height,
    'a binned axis must give bars more height than a padded band axis',
  );
});

test('a hexbin reaches the scene at full opacity, not the scatter 0.8', () => {
  const chart = glChart({
    marks: [glHexbin(rows, { x: 'v', y: 'v' })],
    x: glAxisY(),
    y: glAxisY(),
  });
  const hex = dataNodes(sceneOf(chart).nodes).find((n) => n.style?.fill);
  assert.ok(hex, 'the hexbin drew nothing');
  assert.equal(hex.style.fillOpacity ?? opacity.full, opacity.full);
});

// ── A hexbin has to TILE ────────────────────────────────────────────────────
// The failure this catches is the one that shipped: a lattice binned in data
// space drawn with a hexagon of a guessed pixel radius. It renders as a field
// of separated hexagons — a chart claiming there is no observation in gaps the
// lattice never had a tile for — and it changes with the container width, so a
// single size proves nothing. Both sizes below are checked, and neither is the
// aspect the lattice was laid out for.

/** A cloud dense enough that the lattice comes out with interior neighbours. */
const cloud = Array.from({ length: 600 }, (_, i) => ({
  x: Math.sin(i * 1.7) * 5 + Math.cos(i * 0.31) * 3,
  y: Math.cos(i * 2.3) * 4 + Math.sin(i * 0.17) * 2,
}));

/** Pinned on both the lattice and the axes, so the two agree on the extent. */
const cloudDomain = { x: [-9, 9] as const, y: [-7, 7] as const };

for (const [width, height] of [
  [400, 300],
  [960, 240],
] as const) {
  test(`hexbin tiles share their edges exactly at ${width}×${height}`, () => {
    const lattice = glHexbinLattice(cloud, {
      x: 'x',
      y: 'y',
      rows: 6,
      aspect: 1.6,
      domain: cloudDomain,
    });
    const chart = glChart({
      marks: [glHexbin(lattice, { color: 'count' })],
      x: glAxisY({ domain: [...cloudDomain.x] }),
      y: glAxisY({ domain: [...cloudDomain.y] }),
    });
    const tiles = new Map<string, [number, number][]>();
    for (const node of sceneOf(chart, width, height).nodes) {
      const match = /:(-?\d+(?:\.\d+)?):(-?\d+)$/.exec(String(node.key));
      if (node.kind === 'area' && match) tiles.set(`${match[1]}:${match[2]}`, node.points);
    }
    assert.ok(tiles.size > 10, `only ${tiles.size} tiles drew`);

    // The vertex order the mark emits: top, upper-right, lower-right, bottom,
    // lower-left, upper-left. The neighbour to the right therefore carries our
    // right-hand pair as its own left-hand pair, and the neighbour up-and-right
    // carries our top vertex as its lower-left and our upper-right as its
    // bottom. Nothing here is approximate — a shared data coordinate is the same
    // pixel, so the assertion is equality, not tolerance.
    let across = 0;
    let diagonal = 0;
    for (const [key, hex] of tiles) {
      const [col, row] = key.split(':').map(Number);
      const right = tiles.get(`${col + 1}:${row}`);
      if (right) {
        assert.deepEqual([right[5], right[4]], [hex[1], hex[2]], `${key} → right neighbour`);
        across++;
      }
      // Row `row + 1` is the row ABOVE — y counts up in data space and down in
      // pixels. Odd rows are offset half a column, so the tile up-and-right is
      // at the same column index above an even row and one along above an odd.
      const upRight = tiles.get(`${row % 2 === 0 ? col : col + 1}:${row + 1}`);
      if (upRight) {
        assert.deepEqual([upRight[4], upRight[3]], [hex[0], hex[1]], `${key} → up-right`);
        diagonal++;
      }
    }
    assert.ok(across > 5, `only ${across} horizontal neighbours to check`);
    assert.ok(diagonal > 5, `only ${diagonal} diagonal neighbours to check`);
  });
}

test('a hexbin lattice bins every point exactly once, and is regular at its aspect', () => {
  const lattice = glHexbinLattice(cloud, { x: 'x', y: 'y', rows: 6, aspect: 2.5 });
  const total = lattice.bins.reduce((sum, bin) => sum + bin.count, 0);
  assert.equal(total, cloud.length, 'a point falls in exactly one hexagon');
  assert.equal(lattice.max, Math.max(...lattice.bins.map((b) => b.count)));

  // Regular means √3·r across against 1.5·r down, once the pitches are in
  // pixels. At the aspect the lattice was built for, that ratio must come out.
  const spanX = Math.max(...cloud.map((p) => p.x)) - Math.min(...cloud.map((p) => p.x));
  const spanY = Math.max(...cloud.map((p) => p.y)) - Math.min(...cloud.map((p) => p.y));
  const pitchRatio = (lattice.dx / spanX) * 2.5 / (lattice.dy / spanY);
  assert.ok(Math.abs(pitchRatio - 2 / Math.sqrt(3)) < 1e-12, `pitch ratio ${pitchRatio}`);
});

// ── §3.8: the donut ─────────────────────────────────────────────────────────

test('a donut draws one arc per slice, each label in its own dark tone', () => {
  const chart = glDonutChart(
    [
      { k: 'Goods', v: 62 },
      { k: 'Services', v: 38 },
    ],
    { key: (d) => d.k, value: (d) => d.v, centerValue: '$4.2B' },
  );
  const { nodes } = sceneOf(chart, 420, 420);
  // A radial arc reaches the scene as an `area` node, not a `path` — polar
  // marks share the Cartesian scene vocabulary rather than adding to it.
  const arcs = nodes.filter((n) => n.kind === 'area' && String(n.key).includes(':arc-'));
  const labels = nodes.filter((n) => n.kind === 'label');

  assert.equal(arcs.length, 2, 'one arc per slice');
  assert.deepEqual(
    arcs.map((a) => a.style.fill),
    [categorical['c-1'].main, categorical['c-2'].main],
    'arcs take the palette in order at full main tone',
  );
  const fills = labels.map((l) => l.style?.fill);
  assert.ok(fills.includes(categorical['c-1'].dark), 'slice label in its own dark tone');
  assert.ok(fills.includes(categorical['c-2'].dark));
  assert.ok(
    labels.some((l) => String(l.text) === '$4.2B'),
    'the centre total is what makes a donut worth preferring to a pie',
  );
});
