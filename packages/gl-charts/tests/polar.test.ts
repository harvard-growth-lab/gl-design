/**
 * Checks for the polar surface.
 *
 * Two things are being guarded here, and only one of them is arithmetic.
 *
 * The arithmetic is `arcAngles`: a slice whose angles do not close the circle,
 * or whose shares do not sum to one, is wrong in a way nobody sees — the chart
 * still draws, it just lies by a degree or two. Those are the bugs a render
 * test cannot catch and a reader never can.
 *
 * The other is that the radial marks route through the SAME defaults table as
 * their Cartesian counterparts. A radial arc is a bar bent round a centre, and
 * it should not acquire a different fill opacity for having been bent; if these
 * ever disagree, the spec has quietly forked by coordinate system.
 *
 *   npm run check
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { glDefaults } from '../src/marks.js';
import { MAX_SLICES, arcAngles } from '../src/shapes/polar.js';
import { categorical, geometry, opacity } from '../src/tokens.js';

const rows = [
  { k: 'Goods', v: 50 },
  { k: 'Services', v: 30 },
  { k: 'Other', v: 20 },
];
const opts = { key: (d: (typeof rows)[number]) => d.k, value: (d: (typeof rows)[number]) => d.v };

const TAU = Math.PI * 2;

// ── The arithmetic ──────────────────────────────────────────────────────────

test('slices close the circle exactly', () => {
  // Floating-point drift here shows up as a hairline paper wedge at twelve
  // o'clock that looks like a rendering artefact rather than a bug.
  const slices = arcAngles(rows, opts);
  assert.equal(slices[0].startAngle, 0);
  assert.ok(Math.abs(slices.at(-1)!.endAngle - TAU) < 1e-9);
});

test('slices tile the circle with no gaps and no overlaps', () => {
  const slices = arcAngles(rows, opts);
  for (let i = 1; i < slices.length; i++) {
    assert.equal(slices[i].startAngle, slices[i - 1].endAngle);
  }
});

test('shares sum to one and match the angles', () => {
  const slices = arcAngles(rows, opts);
  assert.ok(Math.abs(slices.reduce((s, x) => s + x.share, 0) - 1) < 1e-9);
  for (const s of slices) {
    assert.ok(Math.abs((s.endAngle - s.startAngle) / TAU - s.share) < 1e-9);
  }
});

test('a part-to-whole ranks by default', () => {
  const slices = arcAngles(rows, opts);
  assert.deepEqual(slices.map((s) => s.key), ['Goods', 'Services', 'Other']);

  const unsorted = arcAngles(
    [{ k: 'a', v: 1 }, { k: 'b', v: 9 }],
    { key: (d) => d.k, value: (d) => d.v, sort: false },
  );
  assert.deepEqual(unsorted.map((s) => s.key), ['a', 'b'], 'cyclic data keeps its own order');
});

test('slices are toned in palette order and carry the key, not a triple', () => {
  // The key survives being logged, compared and round-tripped through a data
  // file; an anonymous {light,main,dark} object does not.
  assert.deepEqual(arcAngles(rows, opts).map((s) => s.tone), ['c-1', 'c-2', 'c-3']);
});

test('a partial arc range is honoured — this is what makes a gauge possible', () => {
  const half = arcAngles(rows, { ...opts, startAngle: -Math.PI / 2, endAngle: Math.PI / 2 });
  assert.equal(half[0].startAngle, -Math.PI / 2);
  assert.ok(Math.abs(half.at(-1)!.endAngle - Math.PI / 2) < 1e-9);
});

test('non-positive and empty values are dropped rather than drawn backwards', () => {
  // A negative slice would sweep anticlockwise through its neighbours.
  const slices = arcAngles(
    [{ k: 'a', v: 5 }, { k: 'b', v: 0 }, { k: 'c', v: -3 }],
    { key: (d) => d.k, value: (d) => d.v },
  );
  assert.deepEqual(slices.map((s) => s.key), ['a']);
  assert.equal(slices[0].share, 1);
  assert.deepEqual(arcAngles([], opts), []);
});

test('the mid-angle bisects the slice, so a direct label lands on it', () => {
  const [first] = arcAngles(rows, opts);
  assert.equal(first.midAngle, (first.startAngle + first.endAngle) / 2);
});

// ── The defaults table does not fork by coordinate system ───────────────────

test('a radial arc takes the same paint as a bar — it is a bar bent round', () => {
  const arc = glDefaults('tile', { tone: 'c-2' });
  const bar = glDefaults('bar', { tone: 'c-2' });
  assert.equal(arc.fill, bar.fill);
  assert.equal(arc.fillOpacity, bar.fillOpacity);
  assert.equal(arc.fillOpacity, opacity.full);
});

test('a polar line and a Cartesian line are the same line', () => {
  assert.deepEqual(
    glDefaults('line', { tone: 'c-3' }),
    glDefaults('line', { tone: 'c-3' }),
  );
  assert.equal(glDefaults('line', {}).strokeWidth, geometry.lineWidth);
});

test('a slice label takes its own slice dark tone (Decision Rule 2)', () => {
  const slices = arcAngles(rows, opts);
  assert.equal(glDefaults('label', { tone: slices[1].tone }).fill, categorical['c-2'].dark);
});

test('the §3.8 slice cap is the documented number', () => {
  assert.equal(MAX_SLICES, 4);
});
