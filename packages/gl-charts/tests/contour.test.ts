/**
 * Checks for the contour surface.
 *
 * The whole of this file is about ONE bug, in two forms: contours that come back
 * in the wrong coordinate space.
 *
 * `d3-contour` is handed a grid and returns rings measured in grid CELLS. If the
 * rescale back into data space is off — wrong origin, wrong cell size, off by
 * half a cell — the contours still draw, still look like contours, and sit
 * quietly beside the points they claim to describe. That reads as a smoothing
 * artifact rather than as a defect, which is exactly why it needs a test rather
 * than an eye.
 *
 * The second form is subtler: a level ordering that does not run low-to-high
 * breaks §12's promise that darker always means more, because the colour scale
 * reads `properties.value` and trusts it.
 *
 *   npm run check
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { glContourDensity, glContourGrid } from '../src/shapes/contour.js';

/** Every vertex of every ring, flattened. */
function vertices(features: readonly { geometry: { coordinates: number[][][][] } }[]) {
  return features.flatMap((f) => f.geometry.coordinates.flat(2));
}

const bounds = (features: Parameters<typeof vertices>[0]) => {
  const points = vertices(features);
  return {
    x0: Math.min(...points.map(([x]) => x)),
    x1: Math.max(...points.map(([x]) => x)),
    y0: Math.min(...points.map(([, y]) => y)),
    y1: Math.max(...points.map(([, y]) => y)),
  };
};

// ── Density ─────────────────────────────────────────────────────────────────

/** Two well-separated clusters, so the density genuinely has two modes. */
const CLOUD = [
  ...Array.from({ length: 120 }, (_, i) => ({
    x: 100 + Math.cos(i) * 4,
    y: 50 + Math.sin(i) * 4,
  })),
  ...Array.from({ length: 120 }, (_, i) => ({
    x: 160 + Math.cos(i) * 4,
    y: 90 + Math.sin(i) * 4,
  })),
];

test('density contours come back in DATA space, not grid space', () => {
  // The bug this file exists for. Grid space here would be 0–64; data space is
  // roughly 96–164 in x and 46–94 in y.
  const { features } = glContourDensity(CLOUD, { x: 'x', y: 'y' });
  assert.ok(features.length > 0, 'no contours were produced');

  const box = bounds(features);
  assert.ok(box.x0 > 80 && box.x1 < 180, `x is in grid units: ${box.x0}–${box.x1}`);
  assert.ok(box.y0 > 30 && box.y1 < 110, `y is in grid units: ${box.y0}–${box.y1}`);
});

test('the contours sit on the data they describe', () => {
  // A half-cell error is invisible by eye and caught here: every ring has to
  // enclose at least one of the two cluster centres.
  const { features } = glContourDensity(CLOUD, { x: 'x', y: 'y' });
  const box = bounds(features);
  assert.ok(box.x0 <= 100 && box.x1 >= 160, 'the contours miss one of the two clusters');
  assert.ok(box.y0 <= 50 && box.y1 >= 90);
});

test('levels are ordered low to high, so darker can mean more', () => {
  const { thresholds, domain } = glContourDensity(CLOUD, { x: 'x', y: 'y' });
  const sorted = [...thresholds].sort((a, b) => a - b);
  assert.deepEqual(thresholds, sorted, '§12 reads this order and would invert the ramp');
  assert.equal(domain[0], thresholds[0]);
  assert.equal(domain[1], thresholds[thresholds.length - 1]);
});

test('a pinned domain moves the grid, and does NOT clip the result', () => {
  // Worth pinning down because the obvious reading is wrong. `domain` sets the
  // box the kernel is evaluated over; it is not a clip rectangle. A wider domain
  // makes each grid cell cover more data units, so a bandwidth measured in CELLS
  // covers more data units too — and the estimate spreads further, past the
  // domain's own edges. That is documented on the option, and it is why the
  // gallery draws contours through `fit: 'data'` rather than pinning an axis.
  const inferred = bounds(glContourDensity(CLOUD, { x: 'x', y: 'y' }).features);
  const pinned = bounds(
    glContourDensity(CLOUD, { x: 'x', y: 'y', domain: { x: [0, 200], y: [0, 200] } })
      .features,
  );

  assert.notEqual(inferred.x0, pinned.x0, 'the pinned domain changed nothing');
  assert.ok(
    pinned.x1 - pinned.x0 > inferred.x1 - inferred.x0,
    'a wider domain did not widen the estimate, so the bandwidth is not in cells',
  );
});

test('accessor and field-name channels agree', () => {
  const byName = glContourDensity(CLOUD, { x: 'x', y: 'y' });
  const byFn = glContourDensity(CLOUD, { x: (d) => d.x, y: (d) => d.y });
  assert.deepEqual(byName.thresholds, byFn.thresholds);
});

test('too few points is refused, not guessed at', () => {
  const { features, thresholds } = glContourDensity([{ x: 1, y: 1 }], { x: 'x', y: 'y' });
  assert.deepEqual(features, []);
  assert.deepEqual(thresholds, []);
});

// ── Grid ────────────────────────────────────────────────────────────────────

/** A cone: highest at the centre, falling to zero at the corners. */
const W = 20;
const H = 20;
const CONE = Array.from({ length: W * H }, (_, i) => {
  const x = i % W;
  const y = Math.floor(i / W);
  return Math.max(0, 10 - Math.hypot(x - W / 2, y - H / 2));
});

test('grid contours honour an explicit extent', () => {
  // Default extent is the cell indices; an explicit one is data units, and the
  // rescale has to reach every vertex.
  const plain = glContourGrid(CONE, { width: W, height: H, levels: 4 });
  const scaled = glContourGrid(CONE, {
    width: W,
    height: H,
    levels: 4,
    extent: [0, 0, 200, 100],
  });

  const a = bounds(plain.features);
  const b = bounds(scaled.features);
  assert.ok(a.x1 <= W + 1e-9, `default extent is not cell indices: ${a.x1}`);
  assert.ok(b.x1 > 100, `explicit extent did not reach the vertices: ${b.x1}`);
  // 10× in x and 5× in y — the two axes rescale independently.
  assert.ok(Math.abs(b.x1 / a.x1 - 10) < 0.01);
  assert.ok(Math.abs(b.y1 / a.y1 - 5) < 0.01);
});

test('explicit thresholds are used verbatim', () => {
  // The whole reason the option exists: a contour interval on a map is a round
  // number of metres, and an estimator picking 3.7 makes it harder to read.
  const { thresholds } = glContourGrid(CONE, {
    width: W,
    height: H,
    thresholds: [2, 4, 6, 8],
  });
  assert.deepEqual(thresholds, [2, 4, 6, 8]);
});

test('a mis-sized grid warns rather than silently producing nonsense', () => {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args.join(' '));
  try {
    glContourGrid(CONE.slice(0, 100), { width: W, height: H });
  } finally {
    console.warn = original;
  }
  assert.ok(
    warnings.some((w) => /grid needs 400 values/.test(w)),
    `expected a size warning, got ${JSON.stringify(warnings)}`,
  );
});

test('nested levels are nested — a higher level is inside a lower one', () => {
  // A cone's contours must be concentric. If the rescale flipped an axis they
  // would still draw, and still be wrong.
  const { features } = glContourGrid(CONE, { width: W, height: H, thresholds: [2, 8] });
  const [low, high] = features;
  const outer = bounds([low]);
  const inner = bounds([high]);
  assert.ok(inner.x0 > outer.x0 && inner.x1 < outer.x1, 'the high level is not inside');
  assert.ok(inner.y0 > outer.y0 && inner.y1 < outer.y1);
});
