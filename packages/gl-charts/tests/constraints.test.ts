/**
 * Expiry tests for every TanStack workaround this package carries.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * READ THIS BEFORE "FIXING" A FAILURE.
 *
 * Every test in this file asserts that a TanStack Charts **limitation still
 * exists**. That is deliberately backwards from a normal test. It is a tripwire:
 * `src/patch.css`, `src/shapes.css`, `src/marks.ts` and `src/chart.ts` all carry
 * rules whose only reason to exist is one of these limitations, and a value
 * pinned in two places drifts. When TanStack grows the API, the corresponding
 * test here goes red and its message names the exact file and rule to DELETE.
 *
 * So a red test is good news. Do not loosen the assertion to make it pass —
 * delete the workaround it names, then delete the test.
 *
 * Every number in this file is TanStack's, not the GL spec's. `tokens.json` owns
 * GL values and nothing here may author one; these literals are the foreign
 * values being watched.
 *
 * Findings recorded against @tanstack/charts 0.6.5, which the package pins
 * exactly (see the last test). TanStack is pre-alpha and has shipped API changes
 * in PATCH releases, so a version bump must re-run this file and re-read it.
 *
 * Most checks are BEHAVIOURAL: `createChartScene()` / `createChartRuntime()`
 * build a real scene from a real definition with no browser, and the emitted
 * `SceneNode`s carry the presentation values (`style.strokeOpacity`, `fontSize`,
 * `radius`, `inset`) that the CSS has to override. Where the limitation is in the
 * *type surface* rather than in emitted output — an option that does not exist
 * cannot be observed at runtime — the check is STRUCTURAL: it greps TanStack's
 * shipped `dist/*.d.ts` or `dist/*.js`. Each such test says so.
 * ───────────────────────────────────────────────────────────────────────────
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  areaY,
  colorLegend,
  createChartRuntime,
  createChartScene,
  defaultChartTheme,
  defineChart,
  dot,
  facet,
  lineY,
  rect,
  ruleX,
  ruleY,
} from '@tanstack/charts';
import { angleGrid, polar, radialGrid, radialLine } from '@tanstack/charts/polar';
import { scaleLinear } from '@tanstack/charts-scales/linear';
import { scalePoint } from '@tanstack/charts-scales/point';

// ── Locating files ──────────────────────────────────────────────────────────
// This file is bundled to `.tmp/` before Node's runner sees it (see the `check`
// script), so paths are resolved by walking up from wherever the bundle landed
// rather than assumed relative to the source tree.

function findUp(relative: string): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = join(dir, relative);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `constraints.test.ts could not find ${relative} by walking up from the test ` +
      `bundle. If the build output moved, fix findUp() — do not skip these tests.`,
  );
}

const PKG_JSON = findUp('package.json');
const TS_DIST = join(dirname(PKG_JSON), 'node_modules/@tanstack/charts/dist');

/** Read a file from TanStack's shipped dist. Used only by structural checks. */
const dist = (file: string): string => readFileSync(join(TS_DIST, file), 'utf8');

/**
 * The body of a `declare`d interface, for structural checks. TanStack's
 * generated `.d.ts` files indent members and close the brace at column 0, so a
 * scan to the first bare `}` is exact rather than approximate.
 */
function interfaceBody(file: string, name: string): string {
  const lines = dist(file).split('\n');
  const start = lines.findIndex((line) => new RegExp(`interface ${name}(<|\\s|$)`).test(line));
  assert.notEqual(start, -1, `${name} is no longer declared in dist/${file}`);
  const end = lines.findIndex((line, i) => i > start && line === '}');
  assert.notEqual(end, -1, `could not find the end of ${name} in dist/${file}`);
  return lines.slice(start + 1, end).join('\n');
}

// ── Building scenes ─────────────────────────────────────────────────────────

interface Node {
  kind: string;
  key: string;
  className?: string;
  children?: readonly Node[];
  style?: Record<string, unknown>;
  fontSize?: number;
  fontWeight?: number;
  radius?: number;
  inset?: number;
  x?: number;
  x1?: number;
  x2?: number;
  y1?: number;
  y2?: number;
}

/** Every node in the scene, depth-first. `SceneNode` is a union; reading one
 *  attribute off each member would need seven narrowings that say nothing. */
function flatten(nodes: readonly unknown[]): Node[] {
  const out: Node[] = [];
  const walk = (node: Node): void => {
    out.push(node);
    node.children?.forEach(walk);
  };
  (nodes as readonly Node[]).forEach(walk);
  return out;
}

function byKey(nodes: readonly Node[], key: string): Node {
  const found = nodes.find((node) => node.key === key);
  assert.ok(found, `no scene node keyed ${key}; TanStack renamed its scene keys`);
  return found;
}

/** A node's `x`, asserted present — a positioned label always has one. */
function xOf(node: Node): number {
  assert.equal(typeof node.x, 'number', `scene node ${node.key} has no x`);
  return node.x as number;
}

/** Every node under the group carrying `className`, excluding the group itself. */
function inGroup(nodes: readonly Node[], className: string): Node[] {
  const group = nodes.find((node) => node.className?.split(' ').includes(className));
  assert.ok(group, `no scene group with className "${className}"`);
  return flatten(group.children ?? []);
}

const ROWS = [
  { x: 1, y: 2 },
  { x: 2, y: 4 },
  { x: 3, y: 3 },
];

/** A Cartesian chart with grid, axis lines, tick labels and axis titles. */
function cartesian(width = 600, yLabelOffset: 'auto' | number = 'auto', rows = ROWS) {
  const definition = defineChart({
    marks: [
      lineY(rows, { x: 'x', y: 'y' }),
      areaY(rows, { x: 'x', y: 'y' }),
      dot(rows, { x: 'x', y: 'y' }),
      rect(rows, { x: 'x', y: 'y' }),
    ],
    // Pinned so TanStack's automatic margin fitting cannot absorb the offset
    // differences test 6 measures.
    margin: { top: 8, right: 16, bottom: 52, left: 140 },
    x: {
      scale: scaleLinear,
      axis: { line: true, label: { text: 'Year' }, ticks: { size: 4, padding: 6 } },
    },
    y: {
      scale: scaleLinear,
      grid: true,
      axis: {
        line: true,
        label: { text: 'Index', offset: yLabelOffset },
        ticks: { size: 4, padding: 6 },
      },
    },
  } as never);
  const scene = createChartScene(definition as never, { width, height: 300 });
  return { scene, nodes: flatten(scene.nodes) };
}

// ════════════════════════════════════════════════════════════════════════════
// 1. Gridline and axis stroke-opacity
// ════════════════════════════════════════════════════════════════════════════

test('BEHAVIOURAL: gridlines are still emitted at stroke-opacity 0.11', () => {
  const { nodes } = cartesian();
  const grid = nodes.find((node) => node.className === 'ts-chart__grid');
  assert.ok(grid, 'no ts-chart__grid group in the scene');
  assert.ok(
    (grid.children?.length ?? 0) > 0,
    'the grid group is empty, so this test is no longer measuring anything',
  );
  assert.equal(
    grid.style?.strokeOpacity,
    0.11,
    'TanStack no longer dilutes gridlines to stroke-opacity 0.11. DELETE the ' +
      '`.gl-figure .ts-chart__grid, .gl-chart .ts-chart__grid` rule from ' +
      'src/patch.css and set the gridline colour through ChartTheme.grid instead.',
  );
});

test('BEHAVIOURAL: axis lines and tick stubs are still emitted at stroke-opacity 0.28', () => {
  const { nodes } = cartesian();
  const rules = inGroup(nodes, 'ts-chart__axes').filter((node) => node.kind === 'rule');
  assert.ok(rules.length > 0, 'the axes group emits no rules, so nothing is being measured');
  for (const rule of rules) {
    assert.equal(
      rule.style?.strokeOpacity,
      0.28,
      `TanStack no longer dilutes the axis rule ${rule.key} to stroke-opacity 0.28. ` +
        'DELETE the `.gl-figure .ts-chart__axes line, .gl-chart .ts-chart__axes line` ' +
        'rule from src/patch.css.',
    );
  }
});

test('BEHAVIOURAL: a zero gridline is still indistinguishable from any other gridline', () => {
  const { nodes } = cartesian();
  const zero = byKey(nodes, 'y-grid:number:0');
  assert.equal(
    zero.style,
    undefined,
    'TanStack now styles the zero gridline separately from the rest of the grid. ' +
      'Re-read `.gl-chart--zero-baseline .ts-chart__grid line[data-ts-key$=":number:0"]` ' +
      'in src/patch.css — the selector keys off TanStack\'s own scene key and the ' +
      'promotion may now belong on the definition instead.',
  );
});

// ════════════════════════════════════════════════════════════════════════════
// 2. Axis typography
// ════════════════════════════════════════════════════════════════════════════

test('BEHAVIOURAL: axis tick labels are still 11px, flipping to 10px under a 360px container', () => {
  const wide = byKey(cartesian(600).nodes, 'y-tick-label:number:0');
  const atBoundary = byKey(cartesian(360).nodes, 'y-tick-label:number:0');
  const narrow = byKey(cartesian(359).nodes, 'y-tick-label:number:0');

  const remedy =
    'DELETE the font-size declaration from `.gl-figure .ts-chart__axes text` in ' +
    'src/patch.css and drop the "Tick-label font size flips at a 360px container ' +
    'width" bullet from skills/gl-charts/SKILL.md "Known constraints".';

  assert.equal(wide.fontSize, 11, `Tick labels are no longer 11px. ${remedy}`);
  assert.equal(atBoundary.fontSize, 11, `The 360px tick-label breakpoint moved. ${remedy}`);
  assert.equal(
    narrow.fontSize,
    10,
    `Tick labels no longer drop to 10px below a 360px container. ${remedy}`,
  );
});

test('BEHAVIOURAL: tick labels still carry fill-opacity 0.68 and no font-weight', () => {
  const label = byKey(cartesian().nodes, 'y-tick-label:number:0');
  assert.equal(
    label.style?.fillOpacity,
    0.68,
    'TanStack no longer dilutes tick labels to fill-opacity 0.68. DELETE the ' +
      'fill-opacity declaration from `.gl-figure .ts-chart__axes text` in src/patch.css.',
  );
  assert.equal(
    label.fontWeight,
    undefined,
    'TanStack now pins a font-weight on tick labels. Re-read the ' +
      '`text[data-ts-key^="x-tick-label"]` / `[^="y-tick-label"]` rule in ' +
      'src/patch.css — it exists only because the page weight would otherwise ' +
      'be inherited, and TanStack may now emit the spec weight itself.',
  );
});

test('BEHAVIOURAL: axis titles are still 11px / weight 600 / fill-opacity 0.76', () => {
  const label = byKey(cartesian().nodes, 'y-label');
  const remedy =
    'DELETE the `text[data-ts-key$="-label"]` font-weight rule from src/patch.css ' +
    '(and re-check the shared `.ts-chart__axes text` block above it).';
  assert.equal(label.fontSize, 11, `Axis titles are no longer 11px. ${remedy}`);
  assert.equal(label.fontWeight, 600, `Axis titles are no longer weight 600. ${remedy}`);
  assert.equal(
    label.style?.fillOpacity,
    0.76,
    `Axis titles are no longer diluted to fill-opacity 0.76. ${remedy}`,
  );
});

test('BEHAVIOURAL: facet cell labels are still 11px / weight 600 / fill-opacity 0.78', () => {
  // A facet renders its cells' scenes itself, so the label is only reachable by
  // building a real faceted chart rather than by reading an option back.
  const rows = [
    { panel: 'A', x: 1, y: 2 },
    { panel: 'A', x: 2, y: 3 },
    { panel: 'B', x: 1, y: 1 },
    { panel: 'B', x: 2, y: 4 },
  ];
  const definition = defineChart({
    marks: [
      facet(rows, {
        by: 'panel',
        // `axes: 'cell'` because the two panels' y extents differ, and shared
        // outer axes are refused outright when the resolved cell scales are not
        // identical. Irrelevant to what this measures — the cell label is drawn
        // by `facetCell` on both paths — and it keeps the test from failing for
        // a reason that has nothing to do with typography.
        axes: 'cell',
        chart: (data) => ({
          marks: [lineY(data, { x: 'x', y: 'y' })],
          x: { scale: scaleLinear },
          y: { scale: scaleLinear },
        }),
      }),
    ],
  } as never);
  const nodes = flatten(createChartScene(definition as never, { width: 600, height: 300 }).nodes);
  const label = nodes.find((node) => /:label$/.test(node.key ?? ''));

  const remedy =
    'DELETE the `.ts-chart__facet-cell > text` rule from src/patch.css — the ' +
    'only reason it exists is that facet() bakes these three values into the ' +
    'scene node with no option to change them.';

  assert.ok(label, `no facet cell label in the scene. ${remedy}`);
  assert.equal(label.fontSize, 11, `Facet cell labels are no longer 11px. ${remedy}`);
  assert.equal(label.fontWeight, 600, `Facet cell labels are no longer weight 600. ${remedy}`);
  assert.equal(
    label.style?.fillOpacity,
    0.78,
    `Facet cell labels are no longer diluted to fill-opacity 0.78. ${remedy}`,
  );
});

test('STRUCTURAL: ChartTheme still has exactly five fields, none of them typographic', () => {
  // Behavioural half: the shipped default theme object.
  assert.deepEqual(
    Object.keys(defaultChartTheme).sort(),
    ['background', 'foreground', 'grid', 'muted', 'palette'],
    'defaultChartTheme gained or lost a field.',
  );
  // Structural half: an OPTIONAL new field would be absent from the default
  // object but present on the type, so the interface itself has to be read.
  const body = interfaceBody('types.d.ts', 'ChartTheme');
  const fields = body
    .split('\n')
    .map((line) => line.trim().replace(/\?*:.*$/, ''))
    .filter(Boolean)
    .sort();
  assert.deepEqual(
    fields,
    ['background', 'foreground', 'grid', 'muted', 'palette'],
    'ChartTheme gained a field. If it is a font, a size, a stroke width, a tick ' +
      'length or a mark default, that is the reason src/chart.ts exists — move ' +
      'the corresponding preset onto the theme object and delete it from ' +
      'src/chart.ts, plus the matching typography declarations in src/patch.css.',
  );
});

// ════════════════════════════════════════════════════════════════════════════
// 3. Mark defaults — the reason src/marks.ts pins them
// ════════════════════════════════════════════════════════════════════════════

test('BEHAVIOURAL: areaY still defaults fill-opacity to 0.2', () => {
  const { nodes } = cartesian();
  const [area] = inGroup(nodes, 'ts-chart__area').filter((node) => node.kind === 'area');
  assert.ok(area, 'no area node in the scene');
  assert.equal(
    area.style?.fillOpacity,
    0.2,
    'areaY no longer defaults to fill-opacity 0.2. DELETE the ' +
      '`.gl-figure .ts-chart__area path` rule from src/patch.css and the ' +
      '`fillOpacity: opacity.full` line from glArea in src/marks.ts.',
  );
});

test('BEHAVIOURAL: dot still defaults r to 3.5', () => {
  const { nodes } = cartesian();
  const [point] = inGroup(nodes, 'ts-chart__dot').filter((node) => node.kind === 'dot');
  assert.ok(point, 'no dot node in the scene');
  assert.equal(
    point.radius,
    3.5,
    'dot no longer defaults r to 3.5. Re-read glPoint in src/marks.ts — the ' +
      '`r: rest.r ?? geometry.pointRadius` default exists to overwrite it.',
  );
});

test('BEHAVIOURAL: lineY still defaults strokeWidth to 2.25', () => {
  const { nodes } = cartesian();
  const [line] = inGroup(nodes, 'ts-chart__line').filter((node) => node.kind === 'polyline');
  assert.ok(line, 'no polyline node in the scene');
  assert.equal(
    line.style?.strokeWidth,
    2.25,
    'lineY no longer defaults strokeWidth to 2.25. Re-read glLine in ' +
      'src/marks.ts — the geometry.lineWidth default exists to overwrite it.',
  );
});

test('BEHAVIOURAL: rect still insets 0.75px on every edge', () => {
  const { nodes } = cartesian();
  const [tile] = inGroup(nodes, 'ts-chart__rect').filter((node) => node.kind === 'rect');
  assert.ok(tile, 'no rect node in the scene');
  assert.equal(
    tile.inset,
    0.75,
    'rect no longer insets 0.75px. DELETE the `inset: rest.inset ?? 0` line from ' +
      'glTile and glRegion in src/marks.ts — it exists only to cancel this, so a ' +
      'treemap tile is painted at the size the gutter left it.',
  );
});

test('STRUCTURAL: rect still emits no shape-rendering, and RectOptions has no option for it', () => {
  // Structural rather than behavioural: `SceneStyle` has no shape-rendering
  // member at all, so there is no emitted value to observe — the absence is only
  // visible in the type surface.
  const rectOptions = interfaceBody('rect.d.ts', 'RectOptions');
  assert.ok(
    !/shapeRendering/.test(rectOptions),
    'RectOptions now exposes shapeRendering. DELETE the ' +
      '`.gl-chart--treemap .ts-chart__rect rect` rule from src/shapes.css and set ' +
      'it on the mark in src/shapes/treemap.ts instead.',
  );
  assert.ok(
    !/shapeRendering/.test(interfaceBody('types.d.ts', 'SceneStyle')),
    'SceneStyle now carries shapeRendering; re-read the treemap rule in src/shapes.css.',
  );
});

test('STRUCTURAL: barY still exposes no stroke option', () => {
  // Structural: an option that does not exist emits nothing to observe.
  const body = interfaceBody('bar.d.ts', 'BarYOptions');
  assert.ok(
    !/\bstroke\??:/.test(body),
    'BarYOptions now exposes a stroke. DELETE the ' +
      '`.gl-chart--stacked [data-ts-key^="bar-y"]` rule from src/patch.css and cut ' +
      'the 1px stack gap on the mark instead.',
  );
  assert.ok(
    /inset\?: number;/.test(body),
    "BarYOptions lost `inset`; the stacked-gap comment in src/patch.css explains " +
      'why inset is not the answer and needs re-checking.',
  );
});

test('STRUCTURAL: the text mark still has no halo option', () => {
  // Structural: same reason — `TextOptions` carries no stroke or paint-order, so
  // there is no emitted attribute whose absence could be asserted.
  const body = interfaceBody('text.d.ts', 'TextOptions');
  assert.ok(
    !/\bstroke\??:/.test(body) && !/paintOrder/.test(body),
    'TextOptions now exposes a stroke or paint-order. DELETE the ' +
      '`.gl-chart--label-halo .ts-chart__text text` rule from src/patch.css, the ' +
      '`.gl-label--over-data` rule from reference/reference.css, and glChartProps\' ' +
      '`labelHalo` variant — put the halo on the mark.',
  );
  assert.ok(
    !/className/.test(body),
    'TextOptions now takes a className, so a single label can be haloed without ' +
      'opting the whole chart in. Re-read `.gl-chart--label-halo` in src/patch.css.',
  );
});

// ════════════════════════════════════════════════════════════════════════════
// 4. Axis-label offset — why AXIS_LABEL_OFFSET is pinned to 'auto'
// ════════════════════════════════════════════════════════════════════════════

test("BEHAVIOURAL: a numeric axis-label offset still measures from the AXIS LINE", () => {
  // Uses createChartRuntime rather than createChartScene: same code path, and it
  // is the API a host actually renders through.
  const runtime = createChartRuntime();
  try {
    for (const offset of [0, 20, 40]) {
      const narrow = cartesian(600, offset, [
        { x: 1, y: 1 },
        { x: 2, y: 4 },
      ]);
      const wide = cartesian(600, offset, [
        { x: 1, y: 100000 },
        { x: 2, y: 400000 },
      ]);
      const narrowX = xOf(byKey(narrow.nodes, 'y-label'));
      const wideX = xOf(byKey(wide.nodes, 'y-label'));
      assert.equal(
        narrowX,
        narrow.scene.chart.x - offset,
        `A numeric offset of ${offset} no longer lands at chart.x - offset. Re-read ` +
          'AXIS_LABEL_OFFSET in src/chart.ts: it is pinned to \'auto\' only because ' +
          'the numeric mode measures from the wrong reference point.',
      );
      assert.equal(
        wideX,
        narrowX,
        `A numeric offset of ${offset} now moves with the tick-label width, i.e. it ` +
          'measures from the tick label. That is the reference point the spec wants — ' +
          'unpin AXIS_LABEL_OFFSET in src/chart.ts and use geometry.axisLabelOffset ' +
          '(20px) so the spec gap is honoured too.',
      );
    }
  } finally {
    runtime.destroy();
  }
});

test("BEHAVIOURAL: offset 'auto' still measures from the TICK LABEL", () => {
  const narrow = cartesian(600, 'auto', [
    { x: 1, y: 1 },
    { x: 2, y: 4 },
  ]);
  const wide = cartesian(600, 'auto', [
    { x: 1, y: 100000 },
    { x: 2, y: 400000 },
  ]);
  const narrowX = xOf(byKey(narrow.nodes, 'y-label'));
  const wideX = xOf(byKey(wide.nodes, 'y-label'));
  assert.ok(
    wideX < narrowX,
    "offset 'auto' no longer shifts left as the tick labels get wider, so it no " +
      'longer measures from the tick label. AXIS_LABEL_OFFSET in src/chart.ts is ' +
      "pinned to 'auto' for exactly that reference point — re-read it.",
  );
  assert.notEqual(
    narrowX,
    narrow.scene.chart.x - 8,
    "offset 'auto' now measures 8px from the axis line rather than from the tick " +
      'label. Re-read AXIS_LABEL_OFFSET in src/chart.ts.',
  );
});

test("STRUCTURAL: offset 'auto' still hardcodes the 8px gap", () => {
  // Structural: the gap is a literal inside the layout pass, and the only way to
  // observe it numerically would be to reimplement TanStack's text measurement.
  const scene = dist('scene.js');
  assert.ok(
    scene.includes('yTickLeft - 8'),
    "the 8px gap in offset 'auto' changed for the Y axis. If it is now 20px the " +
      'known deviation in AXIS_LABEL_OFFSET (src/chart.ts) and in ' +
      'skills/gl-charts/SKILL.md "Axis-label gap is 8px, not the spec\'s 20px" is ' +
      'fixed — update both.',
  );
  assert.ok(
    scene.includes('xTickBottom + 8'),
    "the 8px gap in offset 'auto' changed for the X axis; see AXIS_LABEL_OFFSET in " +
      'src/chart.ts.',
  );
});

// ════════════════════════════════════════════════════════════════════════════
// 5. Colour legend
// ════════════════════════════════════════════════════════════════════════════

/** A minimal stepped colour scale in TanStack's `ConfiguredColorScaleLike`
 *  shape. Hand-rolled rather than imported from src/scales.ts so this file
 *  measures TanStack and nothing else. `thresholds()` is what earns the
 *  `quantize` classification that makes colorLegend draw discrete swatches. */
function steppedScale(): unknown {
  const bins = ['#eeeeee', '#999999', '#333333'];
  const thresholds = [33, 66];
  const scale = ((value: number) => bins[thresholds.filter((t) => value >= t).length]) as Record<
    string,
    unknown
  > &
    ((value: number) => string);
  scale.copy = () => steppedScale();
  scale.domain = () => [0, 100];
  scale.range = () => bins;
  scale.thresholds = () => thresholds;
  return scale;
}

test('BEHAVIOURAL: colorLegend still hardcodes 10px boundary labels and an 11px/600 title, both diluted', () => {
  const rows = [
    { x: 1, y: 1, v: 0 },
    { x: 2, y: 2, v: 50 },
    { x: 3, y: 3, v: 100 },
  ];
  const definition = defineChart({
    marks: [dot(rows, { x: 'x', y: 'y', color: 'v' })],
    x: { scale: scaleLinear, axis: { line: true } },
    y: { scale: scaleLinear, axis: { line: true } },
    color: { scale: steppedScale(), legend: colorLegend({ label: 'Value' }) },
  } as never);
  const nodes = flatten(createChartScene(definition as never, { width: 600, height: 340 }).nodes);

  const remedy =
    'DELETE the `.ts-chart__legend text` rules from src/shapes.css and pass the ' +
    'sizes through ColorLegendOptions instead.';

  const title = byKey(nodes, 'legend-label');
  assert.equal(title.fontSize, 11, `The colour-legend title is no longer 11px. ${remedy}`);
  assert.equal(title.fontWeight, 600, `The colour-legend title is no longer weight 600. ${remedy}`);
  assert.equal(
    title.style?.fillOpacity,
    0.78,
    `The colour-legend title is no longer diluted to fill-opacity 0.78. ${remedy}`,
  );

  const boundaries = nodes.filter((node) => node.key.startsWith('legend-step-label:'));
  assert.ok(boundaries.length > 0, 'the stepped legend emitted no boundary labels');
  for (const label of boundaries) {
    assert.equal(
      label.fontSize,
      10,
      `Colour-legend boundary label ${label.key} is no longer 10px — below the ` +
        `12px floor was the whole problem. ${remedy}`,
    );
    assert.equal(
      label.style?.fillOpacity,
      0.72,
      `Colour-legend boundary label ${label.key} is no longer diluted to 0.72. ${remedy}`,
    );
  }

  const options = interfaceBody('legend.d.ts', 'ColorLegendOptions');
  assert.ok(
    !/font/i.test(options),
    `ColorLegendOptions now exposes typography. ${remedy}`,
  );
});

// ════════════════════════════════════════════════════════════════════════════
// 6. Polar guides — the radar workaround
// ════════════════════════════════════════════════════════════════════════════

test('BEHAVIOURAL + STRUCTURAL: PolarGuideStyle still exposes no labelFontWeight', () => {
  const rows = [
    { d: 'a', v: 1 },
    { d: 'b', v: 2 },
    { d: 'c', v: 3 },
    { d: 'e', v: 2 },
  ];
  const mark = polar({
    angle: { scale: () => scalePoint<string>() },
    radius: { scale: scaleLinear },
    marks: [radialLine(rows, { angle: 'd', radius: 'v' })],
    guides: [
      // labelFontWeight is passed deliberately: if TanStack starts honouring it,
      // the emitted label gains a fontWeight and this test goes red.
      radialGrid({ labelClassName: 'gl-radar__scale-tick', labelFontWeight: 400 } as never),
      angleGrid({ labelClassName: 'gl-radar__axis-label', labelFontWeight: 500 } as never),
    ],
  } as never);
  const definition = defineChart({ marks: [mark], x: null, y: null } as never);
  const nodes = flatten(createChartScene(definition as never, { width: 400, height: 400 }).nodes);

  const labels = nodes.filter(
    (node) => node.key.startsWith('angle-label:') || node.key.startsWith('radius-label:'),
  );
  assert.ok(labels.length > 0, 'the polar guides emitted no labels');

  const remedy =
    'DELETE the `.gl-radar__axis-label text` and `.gl-radar__scale-tick text` rules ' +
    'from src/shapes.css and set labelFontWeight in src/shapes/radar.ts instead.';

  for (const label of labels) {
    assert.equal(
      label.fontWeight,
      undefined,
      `Polar guide label ${label.key} now carries a font-weight. ${remedy}`,
    );
  }
  assert.ok(
    !/labelFontWeight/.test(interfaceBody('polar.d.ts', 'PolarGuideStyle')),
    `PolarGuideStyle now declares labelFontWeight. ${remedy}`,
  );
  assert.ok(
    /labelFontSize\?: number;/.test(interfaceBody('polar.d.ts', 'PolarGuideStyle')),
    'PolarGuideStyle lost labelFontSize; src/shapes/radar.ts sets the 12px floor ' +
      'through it, and the comment in src/shapes.css says only the WEIGHT has to ' +
      'come from CSS. Re-read both.',
  );
});

// ════════════════════════════════════════════════════════════════════════════
// 7. ruleY / ruleX span the whole plot
// ════════════════════════════════════════════════════════════════════════════

test('BEHAVIOURAL: ruleY and ruleX still span the whole plot', () => {
  const definition = defineChart({
    marks: [
      lineY(ROWS, { x: 'x', y: 'y' }),
      // y1/y2 and x1/x2 are passed deliberately, cast past the types: if
      // TanStack starts honouring bounds, these rules stop spanning the plot.
      ruleY([3], { y: (d: number) => d, y1: 1, y2: 2, x1: 1, x2: 2 } as never),
      ruleX([2], { x: (d: number) => d, y1: 1, y2: 2 } as never),
    ],
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
    x: { scale: scaleLinear, axis: false },
    y: { scale: scaleLinear, axis: false },
  } as never);
  const scene = createChartScene(definition as never, { width: 600, height: 300 });
  const nodes = flatten(scene.nodes);
  const { chart } = scene;

  const remedy =
    'ruleY/ruleX can now draw a bounded segment. Re-read src/shapes/distribution.ts ' +
    '(whiskers, medians) and the "ruleY / ruleX span the whole plot" bullet in ' +
    'skills/gl-charts/SKILL.md — the `link` workaround can go.';

  const horizontal = nodes.find(
    (node) => node.kind === 'rule' && node.key.startsWith('rule-y-'),
  );
  assert.ok(horizontal, 'no ruleY node in the scene');
  assert.equal(horizontal.x1, chart.x, `ruleY no longer starts at the plot's left edge. ${remedy}`);
  assert.equal(
    horizontal.x2,
    chart.x + chart.width,
    `ruleY no longer ends at the plot's right edge. ${remedy}`,
  );

  const vertical = nodes.find((node) => node.kind === 'rule' && node.key.startsWith('rule-x-'));
  assert.ok(vertical, 'no ruleX node in the scene');
  assert.equal(vertical.y1, chart.y, `ruleX no longer starts at the plot's top edge. ${remedy}`);
  assert.equal(
    vertical.y2,
    chart.y + chart.height,
    `ruleX no longer ends at the plot's bottom edge. ${remedy}`,
  );

  for (const name of ['RuleYOptions', 'RuleXOptions']) {
    const body = interfaceBody('rule.d.ts', name);
    assert.ok(
      !/\b(y1|y2|x1|x2)\??:/.test(body),
      `${name} now declares endpoint channels. ${remedy}`,
    );
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 8. RectOptions.fill / DotOptions.fill are plain strings
// ════════════════════════════════════════════════════════════════════════════

test('BEHAVIOURAL + STRUCTURAL: RectOptions.fill and DotOptions.fill are still plain strings', () => {
  const perDatum = (d: { y: number }) => (d.y > 2 ? '#ff0000' : '#00ff00');
  const definition = defineChart({
    marks: [
      rect(ROWS, { x: 'x', y: 'y', fill: perDatum as never }),
      dot(ROWS, { x: 'x', y: 'y', fill: perDatum as never }),
    ],
    x: { scale: scaleLinear, axis: false },
    y: { scale: scaleLinear, axis: false },
  } as never);
  const nodes = flatten(createChartScene(definition as never, { width: 600, height: 300 }).nodes);

  const remedy =
    'An ordered per-datum fill no longer has to route through the chart-level ' +
    'colour scale. Re-read glSequentialColor / glDivergingColor in src/scales.ts, ' +
    'the paint() rule in src/marks.ts, and the matching bullet in ' +
    'skills/gl-charts/SKILL.md "Known constraints".';

  // `rect.js` / `dot.js` do `options.fill ?? resolveColor(...)` — the option is
  // passed through verbatim, never invoked per datum. So the accessor arrives on
  // every node as the same function object, which is nonsense as a paint value:
  // there is no per-datum fill to be had. If TanStack turns `fill` into a
  // channel, these become distinct colour strings and the assertion fails.
  for (const group of ['ts-chart__rect', 'ts-chart__dot']) {
    const painted = inGroup(nodes, group).filter((n) => n.kind === 'rect' || n.kind === 'dot');
    assert.ok(painted.length > 1, `${group} emitted fewer than two nodes to compare`);
    for (const node of painted) {
      assert.equal(
        node.style?.fill,
        perDatum,
        `${group} evaluated the function passed as \`fill\`. ${remedy}`,
      );
    }
  }

  assert.ok(
    /fill\?: string;/.test(interfaceBody('rect.d.ts', 'RectOptions')),
    `RectOptions.fill is no longer a plain string. ${remedy}`,
  );
  assert.ok(
    /fill\?: string;/.test(interfaceBody('dot.d.ts', 'DotOptions')),
    `DotOptions.fill is no longer a plain string. ${remedy}`,
  );
  // The contrast that makes the point: bar and line DO take a visual channel.
  assert.ok(
    /fill\?: VisualChannel/.test(interfaceBody('bar.d.ts', 'BarYOptions')),
    'BarYOptions.fill is no longer a VisualChannel, so the rect/dot limitation is ' +
      'no longer the exception it is documented as. Re-read src/marks.ts.',
  );
});

// ════════════════════════════════════════════════════════════════════════════
// 9. No time scale — why glAxisTime is linear over epoch ms
// ════════════════════════════════════════════════════════════════════════════

test('STRUCTURAL: @tanstack/charts-scales still ships no time scale', () => {
  const remedy =
    'TanStack now ships a time scale. Rewrite glAxisTime (src/chart.ts) onto it and ' +
    'delete dateTicks/formatDateTick/dateTickUnit/toEpoch from src/scales.ts — ' +
    'they exist only because dates have to reach a chart as epoch milliseconds. ' +
    'timeAxisFor (src/compose.ts) and the date tests in tests/scales.test.ts go too.';

  const scalesPkg = JSON.parse(
    readFileSync(
      join(dirname(PKG_JSON), 'node_modules/@tanstack/charts-scales/package.json'),
      'utf8',
    ),
  ) as { exports: Record<string, unknown> };

  const subpaths = Object.keys(scalesPkg.exports);
  assert.deepEqual(
    subpaths.sort(),
    ['./band', './linear', './ordinal', './point'],
    `charts-scales subpaths changed. ${remedy}`,
  );
  for (const name of ['time', 'utc', 'date']) {
    assert.ok(!subpaths.includes(`./${name}`), `a ./${name} scale appeared. ${remedy}`);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 10. The docs site runs ahead of the pinned version
// ════════════════════════════════════════════════════════════════════════════

// `todo`, not a plain failure: the assertion below is TRUE today and will stay
// true until grammar.md rules on the interaction layer, and a suite that is
// permanently red is a suite people stop reading. `todo` keeps the claim in the
// report, checked on every run, without turning the gate into noise — and it
// flips to a hard failure the moment TanStack REMOVES the API, which is the only
// other way this could resolve.
test('STRUCTURAL: grammar.md has still not ruled on the interaction layer TanStack ships', { todo: 'grammar.md owes a ruling on focus, tooltip, focus ring and selected mark' }, () => {
  // This test used to assert that `crosshair` and `createChartCursor` were
  // absent from `index.d.ts`, on the belief that TanStack's docs demonstrated an
  // interaction API the pinned release had not shipped. That was wrong twice
  // over: `createChartCursor` appears nowhere in the package, `crosshair` only
  // in one line of PROSE, and the real interaction API — `focus`, `tooltip`,
  // `keyboard`, `spatialIndex`, `whenFocused`, per-mark `states`, `onSelect` —
  // had already landed. So the tripwire watched two names that were never in the
  // API and passed forever while the condition it was written to detect was
  // already true.
  //
  // It now watches the shipped surface. It FAILS today, deliberately: that is
  // the accurate state of the world, and the failure is the reminder that the
  // ruling is owed. Delete the assertion when grammar.md has one.
  const remedy =
    'TanStack ships an interaction API (focus / focusRing / tooltip / keyboard / ' +
    'spatialIndex on ChartDefinitionOptions, whenFocused on the root, per-mark ' +
    '`states`). gl-charts has NO tokens for a hover state, tooltip surface, focus ' +
    'ring or selected mark, so every interactive chart built with it is off-spec ' +
    'by omission. Add the rulings to grammar.md FIRST, then the tokens, then the ' +
    'presets to src/chart.ts — and delete this test.';

  const types = readFileSync(join(TS_DIST, 'types.d.ts'), 'utf8');
  const shipped = ['focus', 'focusRing', 'tooltip', 'keyboard', 'spatialIndex'].filter((name) =>
    new RegExp(`^\\s+${name}\\?:`, 'm').test(types),
  );

  assert.equal(
    shipped.length,
    0,
    `TanStack 0.6.5 exposes ${shipped.join(', ')} on ChartDefinitionOptions. ${remedy}`,
  );
});

// ════════════════════════════════════════════════════════════════════════════
// 11. The version these findings were recorded against
// ════════════════════════════════════════════════════════════════════════════

test('the pinned TanStack version has not moved', () => {
  const PINNED = '0.6.5';
  const remedy =
    'Every finding in tests/constraints.test.ts was recorded against ' +
    `@tanstack/charts ${PINNED}. TanStack is pre-alpha and has shipped API changes ` +
    'in PATCH releases, so a bump is a deliberate act: re-read this file top to ' +
    'bottom, re-run `node reference/build-reference.mjs` and diff the render, then ' +
    'update the version here.';

  const own = JSON.parse(readFileSync(PKG_JSON, 'utf8')) as {
    peerDependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  for (const name of ['@tanstack/charts', '@tanstack/charts-scales', '@tanstack/react-charts']) {
    assert.equal(own.peerDependencies?.[name], PINNED, `peerDependencies["${name}"]: ${remedy}`);
    assert.equal(own.devDependencies?.[name], PINNED, `devDependencies["${name}"]: ${remedy}`);
  }

  const installed = JSON.parse(
    readFileSync(join(dirname(TS_DIST), 'package.json'), 'utf8'),
  ) as { version: string };
  assert.equal(installed.version, PINNED, `the installed @tanstack/charts: ${remedy}`);
});
