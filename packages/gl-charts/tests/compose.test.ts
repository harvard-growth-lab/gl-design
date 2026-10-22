/**
 * Checks for the composed moves.
 *
 * These helpers replaced the whole-chart presets, so they are now the only place
 * the spec's chart-level rules are implemented: which series go muted, which way
 * a stack builds, which tone each step of a ramp takes, where a direct label
 * lands. A preset's bug showed up as a wrong picture; a helper's bug shows up in
 * every chart that composes it, so it is worth testing directly.
 *
 *   npm run check
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  FOCUS_TONES,
  LABEL_GAP,
  anchorWithin,
  clearOf,
  clearance,
  dodgeAnchors,
  endLabels,
  lastByX,
  popUp,
  pointRadiusOf,
  seriesKeys,
  stackOrder,
  toSeries,
  toneRamp,
  yearAxisFor,
} from '../src/compose.js';
import { categorical, geometry, minTextSize, paletteOrder } from '../src/tokens.js';

interface Row {
  country: string;
  year: number;
  value: number;
}

const rows: Row[] = [
  { country: 'Mongolia', year: 2010, value: 100 },
  { country: 'Mongolia', year: 2024, value: 180 },
  { country: 'Chile', year: 2010, value: 100 },
  { country: 'Chile', year: 2024, value: 140 },
  { country: 'Peru', year: 2010, value: 100 },
  { country: 'Peru', year: 2024, value: 110 },
];

// ── The pop-up effect ───────────────────────────────────────────────────────

test('pop-up puts the named series in focus and everything else in the backdrop', () => {
  const { backdrop, focus, overflowed } = popUp(rows, { by: 'country', highlight: 'Mongolia' });

  assert.equal(focus.length, 1);
  assert.equal(focus[0].key, 'Mongolia');
  assert.equal(focus[0].rows.length, 2);
  assert.equal(focus[0].tone, FOCUS_TONES[0]);
  assert.equal(backdrop.length, 4);
  assert.equal(overflowed, false);
});

test('a second highlighted series takes c-2, in the order given', () => {
  const { focus } = popUp(rows, { by: 'country', highlight: ['Chile', 'Mongolia'] });
  assert.deepEqual(
    focus.map((s) => [s.key, s.tone]),
    [
      ['Chile', 'c-1'],
      ['Mongolia', 'c-2'],
    ],
  );
});

test('pop-up refuses more than two focus series and says so', () => {
  // Highlighting three defeats the pattern: the point is that one or two
  // saturated hues carry the finding over a muted backdrop.
  const { focus, backdrop, overflowed } = popUp(rows, {
    by: 'country',
    highlight: ['Mongolia', 'Chile', 'Peru'],
  });
  assert.equal(overflowed, true);
  assert.equal(focus.length, 2);
  assert.equal(backdrop.length, 2, 'the third stays in the backdrop rather than vanishing');
});

test('pop-up takes an accessor as well as a field name', () => {
  const { focus } = popUp(rows, {
    by: (d) => d.country.toUpperCase(),
    highlight: 'PERU',
  });
  assert.equal(focus[0].rows.length, 2);
});

test('a highlight that matches nothing yields an empty focus, not a crash', () => {
  const { backdrop, focus } = popUp(rows, { by: 'country', highlight: 'Bolivia' });
  assert.equal(focus.length, 1);
  assert.equal(focus[0].rows.length, 0);
  assert.equal(backdrop.length, rows.length);
});

// ── Series in palette order ─────────────────────────────────────────────────

test('series come back in first-appearance order, toned in palette order', () => {
  // Load-bearing: TanStack's colour scale also spends the palette in order of
  // first appearance, so series i's label matches series i's mark.
  const series = toSeries(rows, 'country');
  assert.deepEqual(
    series.map((s) => [s.key, s.tone]),
    [
      ['Mongolia', paletteOrder[0]],
      ['Chile', paletteOrder[1]],
      ['Peru', paletteOrder[2]],
    ],
  );
  assert.equal(series[0].rows.length, 2);
});

test('an explicit tone list overrides the palette order', () => {
  const series = toSeries(rows, 'country', ['muted', 'muted', 'c-2']);
  assert.deepEqual(series.map((s) => s.tone), ['muted', 'muted', 'c-2']);
});

test('seriesKeys is distinct-and-ordered', () => {
  assert.deepEqual(seriesKeys(rows, 'country'), ['Mongolia', 'Chile', 'Peru']);
});

// ── Direct labels ───────────────────────────────────────────────────────────

test('the label anchor row is the one with the largest x', () => {
  assert.equal(lastByX(rows.slice(0, 2), 'year')?.year, 2024);
  assert.equal(lastByX([], 'year'), undefined);
});

test('endLabels emits one label per non-empty series', () => {
  const { focus } = popUp(rows, { by: 'country', highlight: ['Mongolia', 'Bolivia'] });
  const marks = endLabels(focus, { x: 'year', y: 'value' });
  assert.equal(marks.length, 1, 'the empty series contributes nothing');

  const all = endLabels(toSeries(rows, 'country'), { x: 'year', y: 'value' });
  assert.equal(all.length, 3);
});

test('a label offset clears the bubble it names', () => {
  // A fixed offset is fine for a 6px dot and lands inside the circle the moment
  // `r` is a size channel — which is what a pop-up bubble chart is.
  const dx = clearOf<Row>((d) => d.value / 10);
  assert.equal(dx(rows[1], 1, rows), -(18 + LABEL_GAP));

  assert.equal(pointRadiusOf(undefined, rows[0], 0, rows), geometry.pointRadius);
  assert.equal(pointRadiusOf(12, rows[0], 0, rows), 12);
  assert.equal(
    pointRadiusOf(() => Number.NaN, rows[0], 0, rows),
    geometry.pointRadius,
    'a non-finite radius falls back rather than producing NaN geometry',
  );
});

// ── §3.12: which side, and inside the frame ─────────────────────────────────

test('the offset follows the side, and the vertical pair clears the text box', () => {
  // A helper that can only offset one way puts half the labels of any
  // bidirectional chart back on top of their own marks.
  assert.equal(clearOf<Row>(10, { side: 'left' })(rows[0], 0, rows), -(10 + LABEL_GAP));
  assert.equal(clearOf<Row>(10, { side: 'right' })(rows[0], 0, rows), 10 + LABEL_GAP);

  // `dy` moves a baseline, so above/below add half a line: what has to clear
  // the mark is the text's box, not the line it sits on.
  const half = minTextSize / 2;
  assert.equal(clearOf<Row>(10, { side: 'above' })(rows[0], 0, rows), -(10 + LABEL_GAP + half));
  assert.equal(clearOf<Row>(10, { side: 'below' })(rows[0], 0, rows), 10 + LABEL_GAP + half);

  // The original `clearOf(r, gap)` signature still means the gap.
  assert.equal(clearOf<Row>(10, 4)(rows[0], 0, rows), -14);
});

test('clearance pairs the anchor with the offset on the matching axis', () => {
  const right = clearance<Row>('right', 10);
  assert.equal(right.anchor, 'start');
  assert.equal(right.dx?.(rows[0], 0, rows), 10 + LABEL_GAP);
  assert.equal(right.dy, undefined, 'a horizontal side sets dx only');

  const above = clearance<Row>('above', 10);
  assert.equal(above.anchor, 'middle');
  assert.ok((above.dy?.(rows[0], 0, rows) ?? 0) < 0, 'above is negative — dy counts down');
  assert.equal(above.dx, undefined);
});

test('anchorWithin turns a label inwards at the edges of the plot', () => {
  // Measured against the SERIES, not against the rows being labelled: two
  // extrema compared with themselves are always one at each end.
  const span = [{ t: 0 }, { t: 50 }, { t: 100 }];
  const at = anchorWithin<{ t: number }>('t', span);

  assert.equal(at({ t: 2 }, 0, span), 'start', 'left edge reads rightwards');
  assert.equal(at({ t: 50 }, 0, span), 'middle');
  assert.equal(at({ t: 98 }, 0, span), 'end', 'right edge reads leftwards');

  const flat = [{ t: 7 }, { t: 7 }];
  assert.equal(
    anchorWithin<{ t: number }>('t', flat)({ t: 7 }, 0, flat),
    'middle',
    'a zero span has no edges to be near',
  );
});

test('dodge separates converging anchors and re-centres the block', () => {
  // Manufacturing and Retail end 7 thousand apart on an axis running to 1500,
  // so their end labels landed on top of each other — a collision that is a
  // property of the data, which no care at the call site can prevent.
  const spread = dodgeAnchors([633, 640, 200], 90);

  assert.ok(Math.abs(spread[1] - spread[0]) >= 90 - 1e-9, 'the pair is pushed apart');
  assert.equal(spread[2], 200, 'a label that never collided is left where it was');
  assert.equal((spread[0] + spread[1]) / 2, (633 + 640) / 2, 'the block stays on its midpoint');

  // Already clear: nothing moves, to the last decimal.
  assert.deepEqual(dodgeAnchors([100, 400, 900], 90), [100, 400, 900]);

  // Order is by value, not by position in the array.
  const reversed = dodgeAnchors([640, 633], 90);
  assert.ok(reversed[0] > reversed[1], 'the larger anchor stays the higher one');

  assert.deepEqual(dodgeAnchors([], 90), []);
  assert.deepEqual(dodgeAnchors([42], 90), [42], 'one label cannot collide with itself');
});

test('endLabels still emits one mark per series with a dodge in play', () => {
  const converge = [
    { country: 'A', year: 2024, value: 633 },
    { country: 'B', year: 2024, value: 640 },
    { country: 'C', year: 2024, value: 200 },
  ];
  const series = toSeries(converge, 'country');
  assert.equal(endLabels(series, { x: 'year', y: 'value', dodge: 90 }).length, 3);

  // `at: 'all'` is a scatter, which wants a repel rather than a one-axis nudge,
  // so the dodge is ignored rather than applied to the wrong thing.
  assert.equal(
    endLabels(series, { x: 'year', y: 'value', at: 'all', dodge: 90 }).length,
    3,
  );
});

// ── Stack order and tone ramps ──────────────────────────────────────────────

test('stackOrder imposes the bottom-to-top order on the data', () => {
  // TanStack stacks in the order it meets each key, so the spec's ordering
  // (largest mean share at the bottom) has to be imposed on the rows.
  const ordered = stackOrder(rows, 'country', ['Peru', 'Chile', 'Mongolia']);
  assert.deepEqual(
    [...new Set(ordered.map((d) => d.country))],
    ['Peru', 'Chile', 'Mongolia'],
  );
});

test('stackOrder leaves rows alone without an order, and parks unknown keys last', () => {
  assert.equal(stackOrder(rows, 'country'), rows);
  const ordered = stackOrder(rows, 'country', ['Peru']);
  assert.equal(ordered[0].country, 'Peru');
});

test('a two-tone ramp runs main then light; three runs light, main, dark', () => {
  const c1 = categorical['c-1'];

  assert.deepEqual(toneRamp({ tones: 'two', order: ['Goods', 'Services'] }), {
    domain: ['Goods', 'Services'],
    range: [c1.main, c1.light],
  });

  assert.deepEqual(toneRamp({ tones: 'three', order: ['Low', 'Medium', 'High'] }), {
    domain: ['Low', 'Medium', 'High'],
    range: [c1.light, c1.main, c1.dark],
  });
});

test('a tone ramp can be built from any hue', () => {
  const c3 = categorical['c-3'];
  assert.deepEqual(toneRamp({ tones: 'two', order: ['A', 'B'], tone: 'c-3' })?.range, [
    c3.main,
    c3.light,
  ]);
});

test('a tone ramp without an order falls back to the categorical palette', () => {
  // There is nothing to map the lightness steps onto, so returning undefined lets
  // the caller omit `color` and get the palette instead of a silent mis-paint.
  assert.equal(toneRamp({ tones: 'three' }), undefined);
  assert.equal(toneRamp({ tones: 'three', order: [] }), undefined);
});

test('a tone ramp truncates to its step count rather than dropping a category', () => {
  const ramp = toneRamp({ tones: 'two', order: ['A', 'B', 'C'] });
  assert.deepEqual(ramp?.domain, ['A', 'B']);
  assert.equal(ramp?.range.length, 2);
});

// ── Year axis ───────────────────────────────────────────────────────────────

test('a year axis pins ticks to the first and last year present', () => {
  const axis = yearAxisFor(rows, 'year') as any;
  const values = axis.axis.ticks.values as number[];
  assert.equal(values[0], 2010);
  assert.equal(values.at(-1), 2024);
  assert.equal(axis.grid, false, 'the year axis takes no gridlines');
});

test('a year axis takes no label — the tick labels already say what it is', () => {
  const axis = yearAxisFor(rows, 'year') as any;
  assert.equal(axis.axis.label, undefined);
});

// ── §3.10: derived series ───────────────────────────────────────────────────

import {
  binValues,
  ecdf,
  lagPairs,
  linearFit,
  movingAverage,
  signColor,
  signKey,
  signTone,
  waterfall,
} from '../src/compose.js';

const series = Array.from({ length: 10 }, (_, i) => ({ t: i, v: i * 2 }));

test('a moving average emits nothing until the window is full', () => {
  // A "3-year moving average" whose first point averages one year is not a
  // 3-year moving average, and the reader cannot see which points are which.
  const out = movingAverage(series, { x: 't', y: 'v', window: 3 });
  assert.equal(out.length, series.length - 2);
  assert.equal(out[0].v, (0 + 2 + 4) / 3);
});

test('a partial moving average opts in explicitly', () => {
  const out = movingAverage(series, { x: 't', y: 'v', window: 3, partial: true });
  assert.equal(out.length, series.length);
  assert.equal(out[0].v, 0, 'the first point averages the one value there is');
});

test('a moving average sorts by x before it averages', () => {
  const shuffled = [...series].reverse();
  const out = movingAverage(shuffled, { x: 't', y: 'v', window: 3 });
  assert.equal(out[0].v, (0 + 2 + 4) / 3, 'row order must not change the result');
});

test('a moving average writes to a named field when asked', () => {
  const out = movingAverage(series, { x: 't', y: 'v', window: 3, as: 'trend' });
  assert.equal(out[0].trend, 2);
  assert.equal(out[0].v, 4, 'the original value survives alongside it');
});

test('a linear fit recovers a known line exactly', () => {
  const fit = linearFit(series, { x: 't', y: 'v' })!;
  assert.equal(fit.slope, 2);
  assert.equal(fit.intercept, 0);
  assert.equal(fit.r2, 1);
  assert.deepEqual(fit.endpoints, [{ x: 0, y: 0 }, { x: 9, y: 18 }]);
});

test('a linear fit refuses a vertical or single-point input', () => {
  assert.equal(linearFit([{ x: 1, y: 1 }], { x: 'x', y: 'y' }), undefined);
  assert.equal(
    linearFit([{ x: 1, y: 1 }, { x: 1, y: 5 }], { x: 'x', y: 'y' }),
    undefined,
    'zero variance in x has no least-squares slope',
  );
});

// ── §3.6: sign encoding ─────────────────────────────────────────────────────

test('sign encoding is red below zero, blue at or above it', () => {
  assert.equal(signTone(-1), 'c-2');
  assert.equal(signTone(1), 'c-1');
  assert.equal(signTone(0), 'c-1', 'zero takes a side rather than a third colour');
});

test('a sign colour scale spends only the two ends of the default diverging pair', () => {
  const scale = signColor();
  assert.deepEqual(scale.domain, ['-', '+']);
  assert.deepEqual(scale.range, [categorical['c-2'].main, categorical['c-1'].main]);
  assert.equal(signKey(-0.001), '-');
  assert.equal(signKey(0), '+');
});

// ── Binning and cumulation ──────────────────────────────────────────────────

test('bins partition the range and account for every value', () => {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const bins = binValues(values, { count: 5 });
  assert.equal(bins.length, 5);
  assert.equal(
    bins.reduce((s, b) => s + b.count, 0),
    values.length,
    'no value may fall through the bin boundaries',
  );
});

test('the maximum lands in the last bin, not outside it', () => {
  // The off-by-one this guards: with half-open bins the maximum equals the last
  // upper edge and belongs to no bin at all.
  const bins = binValues([0, 5, 10], { count: 2 });
  assert.ok(bins.at(-1)!.values.includes(10), 'the maximum must land somewhere');
  assert.deepEqual(bins[0].values, [0], 'bins below the last stay half-open');
  assert.deepEqual(bins[1].values, [5, 10], 'the last bin is closed on both ends');
});

test('explicit thresholds win over an estimated count', () => {
  const bins = binValues([1, 2, 3, 4], { thresholds: [0, 2, 4], count: 99 });
  assert.equal(bins.length, 2);
  assert.deepEqual([bins[0].x1, bins[0].x2], [0, 2]);
});

test('binning a constant does not divide by zero', () => {
  const bins = binValues([3, 3, 3]);
  assert.equal(bins.length, 1);
  assert.equal(bins[0].count, 3);
});

test('an ECDF rises to exactly 1 and is sorted', () => {
  const points = ecdf([5, 1, 3]);
  assert.deepEqual(points.map((p) => p.value), [1, 3, 5]);
  assert.equal(points.at(-1)!.p, 1);
});

test('a waterfall staircase hands each step off to the next', () => {
  const steps = waterfall([{ k: 'a', v: 100 }, { k: 'b', v: -60 }], { key: 'k', value: 'v' });
  assert.deepEqual([steps[0].y1, steps[0].y2], [0, 100]);
  assert.deepEqual([steps[1].y1, steps[1].y2], [40, 100], 'the drop hangs off the running total');
  assert.equal(steps[1].cumulative, 40);
});

test('a waterfall total runs from zero and is marked as synthetic', () => {
  const steps = waterfall([{ k: 'a', v: 100 }, { k: 'b', v: -60 }], { key: 'k', value: 'v' });
  const total = steps.at(-1)!;
  assert.equal(total.isTotal, true);
  assert.deepEqual([total.y1, total.y2], [0, 40]);
  assert.equal(waterfall([{ k: 'a', v: 1 }], { key: 'k', value: 'v', total: false }).length, 1);
});

test('lag pairs shift by k and drop the unpaired head', () => {
  assert.deepEqual(lagPairs([1, 2, 3, 4], 1), [
    { x: 1, y: 2 },
    { x: 2, y: 3 },
    { x: 3, y: 4 },
  ]);
  assert.equal(lagPairs([1, 2, 3, 4], 2).length, 2);
});

import { stepPoints } from '../src/compose.js';

test('a staircase doubles each vertex, so the line goes across then up', () => {
  // The corner rows are real data, not a curve function's invention — which is
  // why this is a transform and not `curve: stepAfter`.
  const steps = stepPoints(
    [
      { v: 1, p: 0.25 },
      { v: 4, p: 0.5 },
    ],
    { x: 'v', y: 'p' },
  );
  assert.deepEqual(steps, [
    { v: 1, p: 0.25 },
    { v: 4, p: 0.25 },
    { v: 4, p: 0.5 },
  ]);
});

test('a staircase of one point is that point', () => {
  assert.deepEqual(stepPoints([{ v: 2, p: 1 }], { x: 'v', y: 'p' }), [{ v: 2, p: 1 }]);
  assert.deepEqual(stepPoints([], { x: 'v', y: 'p' }), []);
});

test('a staircase keeps the rows other fields', () => {
  const steps = stepPoints(
    [
      { v: 1, p: 0.5, label: 'a' },
      { v: 2, p: 1, label: 'b' },
    ],
    { x: 'v', y: 'p' },
  );
  assert.equal(steps.length, 3);
  assert.equal(steps[1].label, 'b', 'the riser belongs to the row it rises to');
});
