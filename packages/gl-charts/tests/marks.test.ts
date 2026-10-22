/**
 * Checks for the mark defaults table.
 *
 * `marks.ts` is where the spec's per-mark values are applied, and most of them
 * are invisible in a render until they are wrong in a way a reader notices —
 * a scatter whose stroke opacity doesn't match its fill stops encoding density,
 * a label in the main tone fails WCAG AA against paper. The gallery catches those
 * eventually, in a screenshot; these catch them in a second.
 *
 * The tests read `glDefaults` rather than the `gl*` wrappers, because the wrappers
 * hand their result to a TanStack mark constructor whose internals we shouldn't
 * be asserting on. `glDefaults` is the boundary: everything above it is ours,
 * everything below it is TanStack's.
 *
 *   npm run check
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { glDefaults } from '../src/marks.js';
import { categorical, geometry, ink, muted, opacity, typeRoles } from '../src/tokens.js';

// ── GLTone resolution ─────────────────────────────────────────────────────────

test('a mark with no tone paints c-1, the single-series default', () => {
  assert.equal(glDefaults('line', {}).stroke, categorical['c-1'].main);
});

test('the muted keyword resolves to the de-emphasis grey', () => {
  assert.equal(glDefaults('line', { tone: 'muted' }).stroke, muted.main);
});

test('an explicit triple is used as given', () => {
  const tone = { light: '#111111', main: '#222222', dark: '#333333' };
  assert.equal(glDefaults('bar', { tone }).fill, '#222222');
  assert.equal(glDefaults('bar', { tone, step: 'dark' }).fill, '#333333');
});

// ── The rule a color channel imposes ────────────────────────────────────────

test('a color channel leaves the paint unset, so the chart scale assigns it', () => {
  // Pinning fill here would bypass the chart-level colour scale and collapse
  // every series onto one hue — silently, because nothing errors.
  const withColor = glDefaults('line', { color: 'country' });
  assert.equal(withColor.stroke, undefined);

  const withoutColor = glDefaults('line', {});
  assert.equal(withoutColor.stroke, categorical['c-1'].main);
});

test('an explicit paint still wins over the colour channel', () => {
  assert.equal(glDefaults('bar', { color: 'sector', fill: '#ABCDEF' }).fill, '#ABCDEF');
});

test('a scatter under a colour channel keeps a stroke, falling back to ink-2', () => {
  // DotOptions.stroke is a plain string, not a channel, so it cannot be
  // per-series. Ink is the honest answer; one series' dark tone on every point
  // would be a lie.
  assert.equal(glDefaults('point', { color: 'region' }).stroke, ink[2]);
});

// ── Per-mark geometry ───────────────────────────────────────────────────────

test('lines are 2px, and 2.4px for the series carrying the finding', () => {
  assert.equal(glDefaults('line', {}).strokeWidth, geometry.lineWidth);
  assert.equal(glDefaults('line', { focus: true }).strokeWidth, geometry.lineWidthFocus);
  assert.equal(glDefaults('line', { focus: true, strokeWidth: 6 }).strokeWidth, 6);
});

test('scatter circles carry the SAME 0.8 on fill and stroke', () => {
  // Matching the two is the whole point: overlapping points darken together into
  // a density signal instead of one layer punching through the other.
  const dot = glDefaults('point', { tone: 'c-3' });
  assert.equal(dot.fillOpacity, opacity.overlap);
  assert.equal(dot.strokeOpacity, opacity.overlap);
  assert.equal(dot.fill, categorical['c-3'].main);
  assert.equal(dot.stroke, categorical['c-3'].dark);
  assert.equal(dot.r, geometry.pointRadius);
});

test('single-layer marks stay at full opacity', () => {
  // 0.8 is for overlap only. Bars, areas and tiles are single-layer, so reducing
  // opacity would only dilute the colour.
  for (const kind of ['area', 'bar', 'tile', 'region'] as const) {
    assert.equal(glDefaults(kind, {}).fillOpacity, opacity.full, kind);
  }
});

test('the caller cannot pin an opacity the spec fixes', () => {
  // The table writes these last, deliberately. (The option types also Omit them,
  // so this is the runtime half of a compile-time guarantee.)
  assert.equal(glDefaults('bar', { fillOpacity: 0.5 } as any).fillOpacity, opacity.full);
  assert.equal(glDefaults('point', { fillOpacity: 1 } as any).fillOpacity, opacity.overlap);
});

test('tiles abut: no stroke at any depth, and no render-time inset', () => {
  // Separation is the layout's paper gutter (SPEC.md §3.4.1). TanStack's
  // default 0.75px inset would make that gutter uneven.
  const tile = glDefaults('tile', {});
  assert.equal(tile.inset, 0);
  assert.equal(tile.stroke, undefined);
  assert.equal(tile.strokeWidth, undefined);
});

test('binned bars carry the paper channel as an inset, not a stroke', () => {
  // SPEC.md §3.4.3. Half the channel per side, so two neighbours make one
  // binGap between them. A stroke would do it too, and would eat the top of
  // every 1-2px bar in the tail of a skewed distribution.
  const bin = glDefaults('binBar', {});
  assert.equal(bin.inset, geometry.binGap / 2);
  assert.equal(bin.stroke, undefined);
  assert.equal(bin.strokeWidth, undefined);
});

test('a binned bar is a plain bar everywhere except the channel', () => {
  // The two entries share `barPaint`, and this is what stops them drifting on
  // colour if one of them is edited later.
  const { inset, ...bin } = glDefaults('binBar', { tone: 'c-2' as const });
  assert.deepEqual(bin, glDefaults('bar', { tone: 'c-2' as const }));
});

test('regions take a thin ink-3 border', () => {
  const region = glDefaults('region', {});
  assert.equal(region.stroke, ink[3]);
  assert.equal(region.strokeWidth, geometry.mapStrokeWidth);
});

// ── Text tied to a colour ───────────────────────────────────────────────────

test('a label takes the DARK tone of the series it names', () => {
  // Decision Rule 2. The main tone fails WCAG AA against paper — this is the
  // most-violated rule in the spec, and it holds for the muted series too.
  assert.equal(glDefaults('label', { tone: 'c-2' }).fill, categorical['c-2'].dark);
  assert.equal(glDefaults('label', { tone: 'muted' }).fill, muted.dark);
});

test('label and annotation type come from the token roles, not literals', () => {
  const label = glDefaults('label', {});
  assert.equal(label.fontSize, typeRoles.seriesLabel.size);
  assert.equal(label.fontWeight, typeRoles.seriesLabel.weight);

  const note = glDefaults('annotation', {});
  assert.equal(note.fontSize, typeRoles.annotation.size);
  assert.equal(note.fontWeight, typeRoles.annotation.weight);
  assert.equal(note.fill, ink[2]);
});

// ── The escape hatch ────────────────────────────────────────────────────────

test('GL-only keys are consumed and never reach TanStack', () => {
  const options = glDefaults('line', { tone: 'c-4', focus: true, step: 'dark', x: 'year' });
  assert.equal('tone' in options, false);
  assert.equal('focus' in options, false);
  assert.equal('step' in options, false);
  assert.equal(options.x, 'year', 'TanStack options pass through untouched');
});

// ── §3.4.2: the chrome / data split ─────────────────────────────────────────
// These are the tests that close the "false generality" hole. Before the six
// kinds below existed, a reference rule was built with `glDefaults('line')`,
// which paints it 2px c-1 — a saturated series hue on something that is not a
// series. The audit passed it, because it IS a token and it IS 2px.

test('a reference rule is chrome: ink-3, gridline weight, dashed', () => {
  const rule = glDefaults('rule', {});
  assert.equal(rule.stroke, ink[3]);
  assert.equal(rule.strokeWidth, geometry.gridlineWidth);
  assert.equal(rule.strokeDasharray, geometry.ruleDash);
});

test('a reference rule ignores `tone` — chrome never carries a series hue', () => {
  // The whole point of the kind. §3.4.2: painting a threshold in c-1 spends the
  // institutional blue on something that is not a finding.
  assert.equal(glDefaults('rule', { tone: 'c-2' }).stroke, ink[3]);
  assert.equal(glDefaults('rule', { tone: 'c-4' }).stroke, ink[3]);
});

test('a stem is data: the series main tone at line weight', () => {
  const stem = glDefaults('stem', { tone: 'c-3' });
  assert.equal(stem.stroke, categorical['c-3'].main);
  assert.equal(stem.strokeWidth, geometry.lineWidth);
  assert.equal(stem.strokeDasharray, undefined, 'data marks are solid (§3.4)');
});

test('a stem and a rule are the same geometry and must not look alike', () => {
  assert.notEqual(glDefaults('stem', {}).stroke, glDefaults('rule', {}).stroke);
});

test('a connector takes the DARK tone — it strokes an assembled glyph', () => {
  const link = glDefaults('connector', { tone: 'c-2' });
  assert.equal(link.stroke, categorical['c-2'].dark);
  assert.equal(link.strokeWidth, geometry.lineWidth);
  assert.equal(link.lineCap, 'butt', 'a round cap overshoots the endpoint it names');
});

test('a data tick is twice the axis tick, so it cannot read as chrome', () => {
  const tick = glDefaults('tick', {});
  assert.equal(tick.length, geometry.dataTickLength);
  assert.equal(tick.length, geometry.tickLength * 2);
  assert.equal(tick.strokeWidth, geometry.tickWidth);
  assert.equal(tick.stroke, categorical['c-1'].dark);
});

test('an arrow head is pinned — a scaled head would encode the value twice', () => {
  assert.equal(glDefaults('arrow', { headLength: 40 }).headLength, geometry.arrowHeadLength);
});

test('a field vector takes chrome weight with a data tone', () => {
  const v = glDefaults('vector', { tone: 'c-5' });
  assert.equal(v.stroke, categorical['c-5'].main);
  assert.equal(v.strokeWidth, geometry.tickWidth, 'a dense field merges at line weight');
  assert.equal(v.headLength, geometry.vectorHeadLength);
});

// ── §3.9: uncertainty ───────────────────────────────────────────────────────

test('a band defaults to the LIGHT tone at full opacity', () => {
  // Not a translucent main: a translucent fill produces a different colour over
  // every mark it crosses, and vanishes in greyscale where lightness survives.
  const band = glDefaults('band', { tone: 'c-1' });
  assert.equal(band.fill, categorical['c-1'].light);
  assert.equal(band.fillOpacity, opacity.full);
});

test('a band still honours an explicit step, for a nested fan', () => {
  assert.equal(glDefaults('band', { tone: 'c-1', step: 'main' }).fill, categorical['c-1'].main);
});

// ── Binned marks are tiles, not points ──────────────────────────────────────

test('a heatmap cell and a hexbin take full opacity, not the scatter 0.8', () => {
  // The 0.8 exists so OVERLAPPING points darken into a density signal. Cells
  // and hexbins tile the plane and cannot overlap, so 0.8 only dilutes them.
  assert.equal(glDefaults('tile', {}).fillOpacity, opacity.full);
  assert.notEqual(glDefaults('tile', {}).fillOpacity, glDefaults('point', {}).fillOpacity);
});

test('every mark kind resolves to something — the table has no holes', () => {
  const kinds = [
    'line', 'point', 'area', 'bar', 'tile', 'region', 'label', 'annotation',
    'rule', 'stem', 'connector', 'tick', 'arrow', 'vector', 'band',
  ] as const;
  for (const kind of kinds) {
    const out = glDefaults(kind, {});
    assert.ok(Object.keys(out).length > 0, `${kind} produced no defaults`);
  }
});
