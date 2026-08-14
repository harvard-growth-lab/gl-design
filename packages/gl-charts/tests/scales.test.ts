/**
 * Checks for `scales.ts`.
 *
 * These four functions are the only pure logic in the package — everything else
 * produces a chart definition whose correctness is a picture, which is what
 * `gallery/` is for. Scales are different: an off-by-one in a bin boundary or a
 * diverging midpoint is invisible in a render and wrong in the data.
 *
 *   npm run check
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  formatLogTick,
  scaleDiverging,
  scaleLog,
  scaleSequential,
  yearTicks,
} from '../src/scales.js';

// ── Log scale ───────────────────────────────────────────────────────────────

test('log scale rounds an inferred domain outward to 1-2-5 bounds', () => {
  assert.deepEqual(scaleLog().domain([1950, 92_000]).domain(), [1000, 100_000]);
  assert.deepEqual(scaleLog().domain([3, 7]).domain(), [2, 10]);
});

test('log scale maps the domain onto the range logarithmically', () => {
  const s = scaleLog().domain([1000, 100_000]).range([0, 100]);
  assert.equal(s(1000), 0);
  assert.equal(s(100_000), 100);
  // 10k is one decade of two, so it lands halfway — the whole point of the scale.
  assert.equal(Math.round(s(10_000) as number), 50);
});

test('log scale drops non-positive values rather than clamping them', () => {
  const s = scaleLog().domain([1, 100]).range([0, 1]);
  assert.equal(s(0), undefined);
  assert.equal(s(-5), undefined);
  assert.equal(s(Number.NaN), undefined);
});

test('log ticks are 1-2-5, thinning to decades only when crowded', () => {
  assert.deepEqual(
    scaleLog().domain([1950, 92_000]).ticks(6),
    [1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000],
  );
  // Nine decades of 1-2-5 would be 28 labels; thin to the decades themselves.
  assert.equal(scaleLog().domain([1, 1e9]).ticks(6).length, 10);
});

test('log scale copies carry their domain and range', () => {
  const s = scaleLog().domain([1950, 92_000]).range([0, 50]);
  const copy = s.copy();
  assert.deepEqual(copy.domain(), [1000, 100_000]);
  assert.equal(copy(100_000), 50);
});

test('log tick labels are compact', () => {
  assert.deepEqual(
    [500, 1000, 20_000, 1.5e6, 2e9].map(formatLogTick),
    ['500', '1k', '20k', '1.5M', '2B'],
  );
});

// ── Year ticks ──────────────────────────────────────────────────────────────

test('year ticks always label the first and last year', () => {
  for (const [first, last] of [
    [2003, 2024],
    [2010, 2024],
    [1995, 2001],
    [2000, 2100],
  ] as const) {
    const ticks = yearTicks([first, last]);
    assert.equal(ticks[0], first, `${first}-${last} should start at ${first}`);
    assert.equal(ticks[ticks.length - 1], last, `${first}-${last} should end at ${last}`);
  }
});

test('year ticks prefer a step that divides the span evenly', () => {
  assert.deepEqual(yearTicks([2010, 2024]), [2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024]);
  assert.deepEqual(yearTicks([2003, 2024]), [2003, 2006, 2009, 2012, 2015, 2018, 2021, 2024]);
});

test('year ticks never leave a crowded final gap', () => {
  for (const span of [7, 11, 13, 17, 19, 23, 29]) {
    const ticks = yearTicks([2000, 2000 + span]);
    const gaps = ticks.slice(1).map((t, i) => t - ticks[i]);
    const step = gaps[0];
    assert.ok(
      gaps[gaps.length - 1] >= step * 0.6,
      `span ${span}: final gap ${gaps[gaps.length - 1]} crowds a step of ${step}`,
    );
  }
});

test('year ticks handle degenerate input', () => {
  assert.deepEqual(yearTicks([]), []);
  assert.deepEqual(yearTicks([2020]), [2020]);
  assert.deepEqual(yearTicks([2020, 2020]), [2020]);
});

// ── Sequential ──────────────────────────────────────────────────────────────

test('sequential runs pale to dark across equal-width bins', () => {
  const s = scaleSequential([0, 100]);
  // Five steps over [0,100] → bins of 20.
  assert.deepEqual(
    [0, 30, 60, 90, 100].map(s),
    ['#E5F0F9', '#B5D5EA', '#2F87C8', '#1A5A8E', '#1A5A8E'],
  );
});

test('sequential resampling keeps both ends of the ramp', () => {
  assert.deepEqual(scaleSequential([0, 1], 'sequential-1', { steps: 3 }).range?.(), [
    '#E5F0F9',
    '#6FA5CE',
    '#1A5A8E',
  ]);
});

test('sequential quantile binning follows the distribution, not the extent', () => {
  // One outlier at 1000 would leave four of five equal-width bins empty.
  const values = [1, 2, 3, 4, 1000];
  const quantized = scaleSequential(values);
  const quantiled = scaleSequential(values, 'sequential-1', { binning: 'quantile' });
  assert.equal(quantized(1), quantized(4), 'equal width collapses the cluster');
  assert.notEqual(quantiled(1), quantiled(4), 'quantile separates it');
});

// ── Diverging ───────────────────────────────────────────────────────────────

test('diverging puts the hue boundary exactly on the midpoint', () => {
  const s = scaleDiverging([-8, 8]);
  assert.equal(s(-0.1), '#EFC7C0', 'just below zero is the pale red step');
  assert.equal(s(0.1), '#C5DCEC', 'just above zero is the pale blue step');
  assert.equal(s(-8), '#8A2C2B');
  assert.equal(s(8), '#1A5A8E');
});

test('diverging holds the boundary at zero on an asymmetric domain', () => {
  // The failure this guards: scaling [-2, 8] linearly across six steps would put
  // the hue boundary at +3, so the chart would claim a midpoint it does not have.
  const s = scaleDiverging([-2, 8]);
  assert.equal(s(-0.1), '#EFC7C0');
  assert.equal(s(0.1), '#C5DCEC');
});

test('diverging honours an explicit midpoint', () => {
  const s = scaleDiverging([10, 90], 'div-2-1', { midpoint: 50 });
  assert.equal(s(49), '#EFC7C0');
  assert.equal(s(51), '#C5DCEC');
});

// ── Dates ───────────────────────────────────────────────────────────────────
// The package had no date support at all: `yearTicks` is numeric years, and
// `@tanstack/charts-scales` ships band / linear / ordinal / point and no time
// scale. Dates reach a chart as epoch ms either way; these make that legible.

import { dateTickUnit, dateTicks, formatDateTick, toEpoch } from '../src/scales.js';

const utc = (y: number, m = 0, d = 1) => Date.UTC(y, m, d);

test('toEpoch accepts a Date, a number, or an ISO string alike', () => {
  const t = utc(2020, 5, 15);
  assert.equal(toEpoch(new Date(t)), t);
  assert.equal(toEpoch(t), t);
  assert.equal(toEpoch('2020-06-15T00:00:00Z'), t);
});

test('the tick unit follows the span, not the row count', () => {
  assert.equal(dateTickUnit(utc(2030) - utc(2000)), 'year');
  assert.equal(dateTickUnit(utc(2023) - utc(2020)), 'month');
  assert.equal(dateTickUnit(utc(2021, 6) - utc(2020, 0)), 'month', '18 months is month-scale');
  assert.equal(dateTickUnit(utc(2020, 3) - utc(2020, 0)), 'day');
});

test('date ticks are pinned to both endpoints', () => {
  // The same rule `yearTicks` applies, for the same reason: the reader is being
  // asked to compare the ends of the span, so the ends must be labelled.
  const dates = [utc(2015, 2, 9), utc(2019, 7, 21), utc(2023, 11, 30)];
  const ticks = dateTicks(dates);
  assert.equal(ticks[0], utc(2015, 2, 9));
  assert.equal(ticks.at(-1), utc(2023, 11, 30));
});

test('a single date is its own only tick', () => {
  assert.deepEqual(dateTicks([utc(2020)]), [utc(2020)]);
  assert.deepEqual(dateTicks([]), []);
});

test('every tick on one axis is labelled at the same granularity', () => {
  // A per-tick decision would put "2020" next to "Mar 2020" on one axis.
  const ticks = dateTicks([utc(2020, 0), utc(2021, 6)]);
  const labels = ticks.map((t) => formatDateTick(t, ticks));
  assert.ok(labels.every((l) => /^[A-Z][a-z]{2} \d{4}$/.test(l)), labels.join(' | '));
});

test('a long span labels years alone; a short one labels days', () => {
  const long = dateTicks([utc(2000), utc(2024)]);
  assert.equal(formatDateTick(long[0], long), '2000');

  const short = dateTicks([utc(2020, 0, 1), utc(2020, 1, 1)]);
  assert.equal(formatDateTick(short[0], short), '1 Jan');
});

test('date ticks stay in UTC, so a chart does not move with the reader', () => {
  const t = utc(2020, 0, 1);
  assert.equal(formatDateTick(t, [t, utc(2020, 1, 1)]), '1 Jan');
});

test('date ticks never run past the end of the data', () => {
  const ticks = dateTicks([utc(2019, 3, 2), utc(2024, 8, 17)]);
  assert.ok(ticks.every((t) => t >= utc(2019, 3, 2) && t <= utc(2024, 8, 17)));
  assert.deepEqual([...ticks].sort((a, b) => a - b), ticks, 'ticks come out ascending');
  assert.equal(new Set(ticks).size, ticks.length, 'and without duplicates');
});

// ── Pinned domains ──────────────────────────────────────────────────────────

import { glAxisLog, glAxisPercent, glAxisX, glAxisY } from '../src/chart.js';

test('a pinned domain reaches the chart as a configured scale instance', () => {
  // TanStack has no `domain` field on an axis: a factory infers its domain from
  // the data, an INSTANCE retains its own. Setting `domain` as a plain key is
  // silently ignored, which is exactly how glAxisPercent shipped a domain that
  // did nothing.
  const axis = glAxisX({ domain: [-5, 5] }) as any;
  assert.equal(typeof axis.scale, 'function');
  assert.deepEqual(axis.scale.domain?.(), [-5, 5], 'the scale must carry the domain itself');
  assert.equal((axis as Record<string, unknown>).domain, undefined, 'and not a dead key');
});

test('an unpinned axis still passes the bare factory, so the data decides', () => {
  const axis = glAxisY() as any;
  assert.equal(axis.scale.domain, undefined, 'a factory has no configured domain');
  assert.equal(axis.nice, true);
});

test('pinning a domain turns nicening off — nice would round the padding back out', () => {
  assert.equal((glAxisY({ domain: [0, 7] }) as any).nice, false);
  assert.equal((glAxisY({ domain: [0, 7], nice: true }) as any).nice, true, 'unless asked');
});

test('a percent axis pins 0–100% so the parts visibly sum to the whole', () => {
  const axis = glAxisPercent({ scale: 'fraction' }) as any;
  assert.deepEqual(axis.scale.domain(), [0, 1]);
  assert.deepEqual(
    axis.axis.ticks.values.map(axis.axis.ticks.format),
    ['0%', '25%', '50%', '75%', '100%'],
  );
  assert.deepEqual((glAxisPercent({ scale: 'percent' }) as any).scale.domain(), [0, 100]);
});

test('a log axis honours a pinned domain too', () => {
  assert.deepEqual((glAxisLog({ domain: [100, 100_000] }) as any).scale.domain(), [100, 100_000]);
});
