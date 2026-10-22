/**
 * Catalog specimens — Polar, Hierarchy and Part-to-Whole.
 *
 * Fourteen of TanStack's catalog entries are radial, which is more than any
 * other category, and §3.8 is the newest section of `grammar.md`. So this file
 * is where the rules get tested hardest, and where the GL answer most often
 * differs from TanStack's — usually by refusing something.
 *
 * ## The four-slice cap, and why several plates deliberately break it
 *
 * §3.8 caps a part-to-whole at four slices: past four, comparing angles stops
 * being safe and the chart is a ranked bar chart drawn badly. TanStack's pie,
 * donut, labelled pie, rounded donut, rose and radial-bar entries all draw the
 * same seven-category letter-frequency dataset.
 *
 * The plates below do not quietly reduce that to four. Two of them draw all
 * seven and carry `glDonutChart`'s warning as a recorded gap, because a rule
 * nobody can see being enforced is a rule nobody believes; the rest group the
 * tail into a residual and say so in the subtitle, which is what the rule
 * actually asks a chart author to do. Seeing both is the point.
 *
 * ## Hierarchy
 *
 * `d3-hierarchy` is already a declared dependency — the treemap needs it — so
 * `partition()` and `tree()` come free, and the sunburst, nested donut and tidy
 * tree are all composable from `glRadialArc`, `glLink` and `glPoint`. That is
 * why these three moved from "not reachable" to "built": no new dependency, and
 * the layouts are d3's rather than hand-rolled.
 *
 * Same contract as every specimen file: nothing is styled by hand.
 */

import type { ReactNode } from 'react';
import { Chart } from '@tanstack/react-charts';
import { scaleLinear } from '@tanstack/charts-scales/linear';
import { hierarchy, partition, tree } from 'd3-hierarchy';

import {
  glAxisX,
  glAxisY,
  glChart,
  glLabel,
  glLink,
  glPoint,
  glSequentialColor,
  glTile,
  ink,
  resolveTone,
  seriesKeyAt,
} from '../src/index.js';
import {
  arcAngles,
  glDonutChart,
  glLabelInkOn,
  glPolarChart,
  glRadarChart,
  glRadialAnnotation,
  glRadialArc,
  glRadialLabel,
  glTreemapChart,
} from '../src/shapes.js';
import { GLFigure, GLLegend } from '../src/figure.js';

import {
  capabilityData,
  exportHierarchy,
  shareRows,
  type HierarchyNode,
} from './tanstack-data.js';

const SYNTHETIC = 'Source: Synthetic data for illustration. Not a Growth Lab estimate.';

/** The four largest shares plus everything else — what §3.8 asks an author to do. */
const cappedShares = (() => {
  const top = shareRows.slice(0, 3);
  const rest = shareRows.slice(3).reduce((sum, d) => sum + d.share, 0);
  return [...top, { label: 'Everything else', share: rest }];
})();

// ════════════════════════════════════════════════════════════════════════════
// Part-to-whole — pie, donut and their variants
// ════════════════════════════════════════════════════════════════════════════

/**
 * `76-pie` — the form §3.8 allows and does not prefer.
 *
 * `pie: true` is opt-in for a reason: the hole costs nothing and gives the total
 * somewhere to live, so a donut is the default and a pie has to be asked for.
 * Four slices, directly labelled, each label in its own slice's DARK tone — a
 * text mark cannot read a colour scale, which is why `arcAngles` carries a tone
 * per slice rather than letting the chart-level scale assign them.
 */
function Pie() {
  const chart = glDonutChart(cappedShares, {
    key: (d) => d.label,
    value: (d) => d.share,
    pie: true,
  });

  return (
    <GLFigure
      title="Minerals are just under a third of the basket."
      subtitle="Export value by sector, 2024; the three smallest sectors grouped"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={300} ariaLabel="Export composition, pie" />
    </GLFigure>
  );
}

/**
 * `77-donut` — the same four slices with the hole §3.8 prefers.
 *
 * The difference from the pie above is one option and the reason is not
 * aesthetic: the hole removes the centre, which is where a pie's slices are
 * least distinguishable, and it gives the total a place to sit. Compare the two
 * plates side by side and the donut is the one you can read a share off.
 */
function Donut() {
  const chart = glDonutChart(cappedShares, {
    key: (d) => d.label,
    value: (d) => d.share,
  });

  return (
    <GLFigure
      title="The same four shares, read off the arc rather than the wedge."
      subtitle="Export value by sector, 2024; the three smallest sectors grouped"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={300} ariaLabel="Export composition, donut" />
    </GLFigure>
  );
}

/**
 * `93-labeled-pie` — seven slices, drawn as asked, warning and all.
 *
 * This plate deliberately breaks the four-slice cap, and it is the most useful
 * plate in the file: `glDonutChart` warns and draws anyway, which is the right
 * behaviour (refusing would leave a caller with an exception and no way to see
 * their data) and is invisible unless something exercises it. The recorded gap
 * carries the warning text.
 *
 * Look at what happens to the three smallest slices' labels. That is the rule
 * arguing for itself better than the rule can.
 */
function LabeledPie() {
  const chart = glDonutChart(shareRows, {
    key: (d) => d.label,
    value: (d) => d.share,
    pie: true,
    labelFormat: (s) => `${s.key} · ${(s.share * 100).toFixed(1)}%`,
  });

  return (
    <GLFigure
      title="Seven slices is past the point where angles can be compared."
      subtitle="Export value by sector, 2024, uncapped — the case §3.8 exists to refuse"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={320} ariaLabel="Export composition, seven slices" />
    </GLFigure>
  );
}

/**
 * `95-rounded-donut` — the one purely decorative variant in the catalog.
 *
 * `cornerRadius` is a real TanStack option and reaches through `glRadialArc`
 * untouched, so the plate is one line different from the donut above. Worth
 * having as a specimen precisely because it shows what the GL defaults do NOT
 * pin: the spec rules on fill, opacity, gap and slice count, and says nothing
 * about corner geometry, so the option stays available rather than being closed
 * off. A design system that only permits what it has ruled on is a straitjacket.
 *
 * The rounding does cost something and the plate shows it: a rounded arc no
 * longer meets its neighbour, so the 1px paper gap of §3.8 reads wider at the
 * ends than in the middle.
 */
function RoundedDonut() {
  const slices = arcAngles(cappedShares, {
    key: (d) => d.label,
    value: (d) => d.share,
  });

  const chart = glPolarChart({
    marks: [
      ...slices.map((s) =>
        glRadialArc([s], {
          startAngle: () => s.startAngle,
          endAngle: () => s.endAngle,
          padAngle: () => 1,
          padRadius: 1,
          cornerRadius: 6,
          tone: s.tone,
          innerRadius: (ctx) => ctx.radius * 0.46,
          outerRadius: (ctx) => ctx.radius * 0.78,
        }),
      ),
      glRadialLabel(slices, {
        angle: (s: (typeof slices)[number]) => s.midAngle,
        radius: () => 1,
        text: (s: (typeof slices)[number]) => `${s.key} · ${Math.round(s.share * 100)}%`,
        fill: (s: (typeof slices)[number]) => resolveTone(s.tone).dark,
        anchor: (s: (typeof slices)[number]) => (Math.sin(s.midAngle) < 0 ? 'end' : 'start'),
        baseline: 'middle',
      } as never),
    ],
    angle: { scale: scaleLinear().domain([0, Math.PI * 2]) as never, wrap: false },
    radius: { scale: scaleLinear().domain([0, 1]) as never },
  });

  return (
    <GLFigure
      title="Rounding the arcs costs the even gap that separates them."
      subtitle="Export value by sector, 2024, with rounded arc ends"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={300} ariaLabel="Export composition, rounded donut" />
    </GLFigure>
  );
}

/**
 * `96-nested-donut` — two levels of the hierarchy on two rings.
 *
 * `partition()` from `d3-hierarchy` does the angular layout, which is what moved
 * this from "the arcs compose but the layout does not ship" to built. Each ring
 * is `glRadialArc` at a different radius band.
 *
 * The colour rule is the interesting part: a child takes its PARENT's hue at the
 * light step rather than a hue of its own. A second palette pass would claim the
 * children are a second set of categories, when they are a decomposition of the
 * first — the same reasoning §8b applies to a two-category stack.
 */
function NestedDonut() {
  const root = partition<HierarchyNode>().size([Math.PI * 2, 1])(
    hierarchy(exportHierarchy)
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
  );

  const rings = root
    .descendants()
    .filter((node) => node.depth >= 1 && node.depth <= 2)
    .map((node) => {
      // Depth 1 owns a palette hue; depth 2 borrows its parent's at `light`.
      const branch = node.depth === 1 ? node : node.parent!;
      const index = (root.children ?? []).indexOf(branch);
      return {
        name: node.data.name,
        depth: node.depth,
        startAngle: node.x0,
        endAngle: node.x1,
        share: (node.value ?? 0) / (root.value ?? 1),
        tone: seriesKeyAt(Math.max(0, index)),
      };
    });

  const chart = glPolarChart({
    marks: [
      ...rings.map((ring) =>
        glRadialArc([ring], {
          startAngle: () => ring.startAngle,
          endAngle: () => ring.endAngle,
          padAngle: () => 1,
          padRadius: 1,
          tone: ring.tone,
          step: ring.depth === 1 ? 'main' : 'light',
          innerRadius: (ctx) => ctx.radius * (ring.depth === 1 ? 0.34 : 0.62),
          outerRadius: (ctx) => ctx.radius * (ring.depth === 1 ? 0.6 : 0.84),
        }),
      ),
      glRadialLabel(
        rings.filter((ring) => ring.depth === 1 && ring.share > 0.08),
        {
          angle: (r: (typeof rings)[number]) => (r.startAngle + r.endAngle) / 2,
          radius: () => 0.47,
          text: (r: (typeof rings)[number]) => r.name,
          fill: (r: (typeof rings)[number]) => glLabelInkOn(resolveTone(r.tone).main),
          anchor: 'middle',
          baseline: 'middle',
        } as never,
      ),
    ],
    angle: { scale: scaleLinear().domain([0, Math.PI * 2]) as never, wrap: false },
    radius: { scale: scaleLinear().domain([0, 1]) as never },
  });

  return (
    <GLFigure
      title="Minerals is one branch of four, and copper is half of it."
      subtitle="Export value by sector and product; the outer ring decomposes the inner"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={320} ariaLabel="Nested export composition" />
    </GLFigure>
  );
}

/**
 * `101-sunburst` — the same partition taken to full depth.
 *
 * Three rings rather than two, and the third level is where the form starts to
 * fail: an arc two levels down subtends a few degrees and cannot be labelled or
 * compared. §3.8's cap is about a single ring, but the same arithmetic applies
 * outward, which is why the treemap below is the honest answer for this data.
 *
 * Recorded `partial` for that: the plate draws what was asked and the labels
 * stop at depth 1, because a label that does not fit is a label that has to be
 * dropped — and unlike the treemap, nothing here can measure whether it fits.
 */
function Sunburst() {
  const root = partition<HierarchyNode>().size([Math.PI * 2, 1])(
    hierarchy(exportHierarchy)
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
  );

  const arcs = root
    .descendants()
    .filter((node) => node.depth >= 1)
    .map((node) => {
      const branch = node.ancestors().find((a) => a.depth === 1)!;
      const index = (root.children ?? []).indexOf(branch);
      return {
        name: node.data.name,
        depth: node.depth,
        startAngle: node.x0,
        endAngle: node.x1,
        share: (node.value ?? 0) / (root.value ?? 1),
        tone: seriesKeyAt(Math.max(0, index)),
      };
    });

  // Three rings inside 0.78 of the radius, leaving the outer fifth as the label
  // gutter — the same split `glDonutChart` makes with `ARC_EXTENT`. §3.8 asks for
  // direct labels over a legend, so the room for them is part of the chart.
  const BAND = 0.2;
  const chart = glPolarChart({
    marks: [
      ...arcs.map((arc) =>
        glRadialArc([arc], {
          startAngle: () => arc.startAngle,
          endAngle: () => arc.endAngle,
          padAngle: () => 1,
          padRadius: 1,
          tone: arc.tone,
          // Depth carries the lightness: the innermost ring is the full hue and
          // each level out is a step paler, so the hierarchy reads outward.
          step: arc.depth === 1 ? 'main' : arc.depth === 2 ? 'light' : 'light',
          innerRadius: (ctx) => ctx.radius * (0.18 + (arc.depth - 1) * BAND),
          outerRadius: (ctx) => ctx.radius * (0.18 + arc.depth * BAND - 0.012),
        }),
      ),
      // Outside the outermost ring, reading outward, in each branch's own DARK
      // tone. Placing them ON the arcs was the first attempt and it failed the
      // way the recorded gap predicts: nothing here can measure whether a label
      // fits its wedge, so "Minerals" ran straight across the ring boundary. In
      // the gutter the only constraint is angular separation, which four
      // depth-1 branches trivially satisfy.
      glRadialLabel(
        arcs.filter((arc) => arc.depth === 1),
        {
          angle: (a: (typeof arcs)[number]) => (a.startAngle + a.endAngle) / 2,
          radius: () => 1,
          text: (a: (typeof arcs)[number]) => `${a.name} · ${Math.round(a.share * 100)}%`,
          fill: (a: (typeof arcs)[number]) => resolveTone(a.tone).dark,
          anchor: (a: (typeof arcs)[number]) =>
            Math.sin((a.startAngle + a.endAngle) / 2) < 0 ? 'end' : 'start',
          baseline: 'middle',
        } as never,
      ),
      glRadialAnnotation([{ label: 'Exports' }], {
        angle: () => 0,
        radius: () => 0,
        text: (d: { label: string }) => d.label,
        anchor: 'middle',
        baseline: 'middle',
      } as never),
    ],
    angle: { scale: scaleLinear().domain([0, Math.PI * 2]) as never, wrap: false },
    radius: { scale: scaleLinear().domain([0, 1]) as never },
  });

  return (
    <GLFigure
      title="At the third ring the arcs are too small to compare or to label."
      subtitle="Export value to three levels; the same data the treemap below draws"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={340} ariaLabel="Export hierarchy sunburst" />
    </GLFigure>
  );
}

/**
 * `100-radial-bars` — magnitude as radius on concentric tracks.
 *
 * Each category gets its own ring and each ring is an arc swept in proportion to
 * the value, so length is the encoding. It is a bar chart bent around a centre,
 * and bending it costs the reader the one thing bars are best at: a common
 * baseline. The outer rings are physically longer at equal value, so the form
 * systematically overstates whatever is drawn outermost.
 *
 * Recorded `partial` for that, and the plate answers it the only way available —
 * it sorts descending so the largest value takes the longest track, making the
 * distortion reinforce the ranking rather than fight it.
 */
function RadialBars() {
  const rows = [...shareRows].sort((a, b) => b.share - a.share);
  const max = Math.max(...rows.map((d) => d.share));
  const TRACK = 0.9 / rows.length;

  const chart = glPolarChart({
    marks: [
      ...rows.flatMap((row, i) => {
        const inner = 0.18 + (rows.length - 1 - i) * TRACK;
        const outer = inner + TRACK * 0.72;
        return [
          // The track: how far the bar could have gone. Chrome, so c-muted-light.
          glRadialArc([row], {
            startAngle: () => 0,
            endAngle: () => Math.PI * 2,
            tone: 'muted',
            step: 'light',
            innerRadius: (ctx) => ctx.radius * inner,
            outerRadius: (ctx) => ctx.radius * outer,
          }),
          glRadialArc([row], {
            startAngle: () => 0,
            endAngle: () => (row.share / max) * Math.PI * 1.75,
            tone: 'c-1',
            innerRadius: (ctx) => ctx.radius * inner,
            outerRadius: (ctx) => ctx.radius * outer,
          }),
        ];
      }),
      glRadialLabel(
        rows.map((row, i) => ({
          ...row,
          radius: 0.18 + (rows.length - 1 - i) * TRACK + TRACK * 0.36,
        })),
        {
          angle: () => Math.PI * 1.97,
          radius: (d: { radius: number }) => d.radius,
          text: (d: { label: string; share: number }) =>
            `${d.label} · ${Math.round(d.share * 100)}%`,
          anchor: 'end',
          baseline: 'middle',
        } as never,
      ),
    ],
    angle: { scale: scaleLinear().domain([0, Math.PI * 2]) as never, wrap: false },
    radius: { scale: scaleLinear().domain([0, 1]) as never },
  });

  return (
    <GLFigure
      title="Concentric bars rank correctly and compare badly."
      subtitle="Export value by sector, 2024; every track spans the same angular range"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={330} ariaLabel="Export value on concentric bars" />
    </GLFigure>
  );
}

/**
 * `41-waffle-unit-chart` — one hundred squares, one per percentage point.
 *
 * The argument for a waffle over a pie is that it replaces an angle judgment
 * with a counting one, and people count reliably. Ten by ten is the grid that
 * makes the count trivial.
 *
 * Cells are `glTile` on two binned axes, which is the same treatment a heatmap
 * gets and for the same reason: a waffle tiles the plane, so §3.4's full opacity
 * applies and the scatter's 0.8 would only dilute it.
 */
function Waffle() {
  // FIVE categories, not eight, and the reason is the ramp rather than taste.
  // `glSequentialColor` resamples the authored five steps to whatever count it is
  // asked for, and a count the tokens do not enumerate INTERPOLATES between them
  // — producing fills that are off-palette by construction. `gallery/audit.mjs`
  // flags every one of them, which is the check working: the spec names five- and
  // six-step ramps, so a waffle either fits in one or is the wrong chart.
  const top = shareRows.slice(0, 4);
  const tail = shareRows.slice(4).reduce((sum, d) => sum + d.share, 0);
  const groups = [...top, { label: 'Everything else', share: tail }];

  const cells: { col: number; row: number; label: string }[] = [];
  let filled = 0;
  for (const group of groups) {
    const units = Math.round(group.share * 100);
    for (let i = 0; i < units && filled < 100; i += 1, filled += 1) {
      cells.push({ col: filled % 10, row: Math.floor(filled / 10), label: group.label });
    }
  }
  // Rounding rarely lands on exactly 100. The remainder joins the residual rather
  // than becoming a sixth category — it is the same claim ("not one of the four")
  // and a sixth would put the ramp back into interpolation.
  while (filled < 100) {
    cells.push({ col: filled % 10, row: Math.floor(filled / 10), label: 'Everything else' });
    filled += 1;
  }

  const order = groups.map((d) => d.label);
  const ramp = glSequentialColor({ domain: [0, order.length - 1], steps: order.length });
  const chart = glChart({
    marks: [
      glTile(cells, {
        x1: (d) => d.col,
        x2: (d) => d.col + 0.88,
        y1: (d) => d.row,
        y2: (d) => d.row + 0.88,
        // The categories are ORDERED by share, so the channel is that rank and
        // the scale is sequential. A categorical palette here would claim eight
        // unrelated subjects where there is one ordered variable.
        color: (d) => order.indexOf(d.label),
      }),
    ],
    // `axis: false` keeps the scale and drops the visible axis. A waffle's
    // coordinates are grid positions, not quantities — "column 7" is not a value
    // anyone reads off a scale — so an axis line here would be a frame
    // pretending to be a measurement. Same call as the tidy tree, and the same
    // recorded gap: `GLAxisPreset` cannot say "scale without axis".
    x: { ...glAxisX({ domain: [0, 10], nice: false }), axis: false as const },
    y: { ...glAxisY({ grid: false, domain: [10, 0], nice: false }), axis: false as const },
    color: { scale: ramp },
    // Symmetric and wide, so the plot is close to square and the units are close
    // to SQUARES. A ten-by-ten grid stretched to a 3:1 plot is a ten-by-ten grid
    // of rectangles, and the form's whole argument is that people count units.
    margin: { left: 168, right: 168, top: 8, bottom: 8 },
  });

  return (
    <GLFigure
      title="Three sectors account for two-thirds of the hundred."
      subtitle="Export value by sector, 2024, one square per percentage point"
      source={SYNTHETIC}
      legend={
        <GLLegend
          // The marks come from the RAMP the cells are painted with, resolved
          // per step. Spending `c-1`'s light/main/dark instead — the obvious
          // shortcut — puts three tones against five fills and the legend stops
          // matching the chart, which is worse than having no legend.
          items={groups.map((d, i) => {
            const fill = ramp(i);
            return { label: d.label, tone: { light: fill, main: fill, dark: ink[2] } };
          })}
        />
      }
    >
      <Chart {...chart.props} height={280} ariaLabel="Export composition waffle" />
    </GLFigure>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Radar
// ════════════════════════════════════════════════════════════════════════════

/**
 * `75-radar` — one profile across six dimensions.
 *
 * Every dimension must be on the SAME normalized scale, because a radar's whole
 * read is the shape of the polygon and a shape drawn over mixed units means
 * nothing. `glRadarChart` sorts the rows onto the angle scale before drawing —
 * without that the polygon crosses itself — and pins `max` so the outer ring is
 * 1 by construction rather than whatever the tallest observation happened to be.
 */
function Radar() {
  const chart = glRadarChart(
    capabilityData.filter((d) => d.country === 'This economy'),
    {
      dimension: 'dimension',
      value: 'value',
      max: 1,
      format: (v) => v.toFixed(1),
    },
  );

  return (
    <GLFigure
      title="Strong on complexity and infrastructure, weak on openness."
      subtitle="Capability profile across six dimensions, normalized 0–1"
      source={SYNTHETIC}
      // A radar polygon is a fill AND a stroke (§3.4), so `band` — a pale square
      // with a dark border — is its miniature. A solid square would claim an
      // opacity the polygon does not have.
      legendPlacement="right"
      legend={<GLLegend items={[{ label: 'This economy', tone: 'c-1', mark: 'polygon' }]} />}
    >
      <Chart {...chart.props} height={330} ariaLabel="Capability profile" />
    </GLFigure>
  );
}

/**
 * `99-comparative-radar` — two profiles, and the pop-up effect in radar form.
 *
 * The comparison is painted `c-muted` and stacked UNDER the focus polygon, which
 * §11 states explicitly for this chart type: the second series is a *peer*, not
 * a co-finding. That is the one place the distribution and radar rules depart
 * from `FOCUS_TONES` — everywhere else a second highlighted series takes `c-2`.
 *
 * Two translucent polygons are already at the limit of what overlaps legibly;
 * `glRadarChart` refuses a third with a warning and says small multiples are the
 * right move, which is what `facets-anscombe` demonstrates the machinery for.
 */
function ComparativeRadar() {
  const chart = glRadarChart(capabilityData, {
    dimension: 'dimension',
    value: 'value',
    series: 'country',
    focus: 'This economy',
    max: 1,
    format: (v) => v.toFixed(1),
  });

  return (
    <GLFigure
      title="It trades places with the peer median on four of the six."
      subtitle="Capability profile against the peer median, normalized 0–1"
      source={SYNTHETIC}
      legendPlacement="right"
      legend={
        <GLLegend
          items={[
            { label: 'This economy', tone: 'c-1', mark: 'polygon' },
            { label: 'Peer median', tone: 'muted', mark: 'polygon' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={330} ariaLabel="Capability profile against peers" />
    </GLFigure>
  );
}

/**
 * `78-gauge` — one value against its range, without a needle.
 *
 * The catalog has two gauges and they differ in exactly one thing: whether the
 * value is shown by a needle or by the arc itself. `spec-22-gauge` is the needle
 * form; this is the arc form, and it is the one §3.8 prefers, because the filled
 * arc encodes the value as a *length* the reader can compare against the track,
 * where a needle encodes it as an angle they have to estimate against ticks.
 */
function ArcGauge() {
  const VALUE = 0.72;
  const START = -Math.PI * 0.62;
  const END = Math.PI * 0.62;

  const arc = (fraction: number, tone: 'muted' | 'c-1') =>
    glRadialArc([{ fraction }], {
      startAngle: () => START,
      endAngle: () => START + (END - START) * fraction,
      tone,
      step: tone === 'muted' ? 'light' : 'main',
      cornerRadius: 4,
      innerRadius: (ctx) => ctx.radius * 0.6,
      outerRadius: (ctx) => ctx.radius * 0.86,
    });

  const chart = glPolarChart({
    marks: [
      arc(1, 'muted'),
      arc(VALUE, 'c-1'),
      glRadialAnnotation([{ label: `${Math.round(VALUE * 100)}%` }], {
        angle: () => 0,
        radius: () => 0,
        text: (d: { label: string }) => d.label,
        anchor: 'middle',
        baseline: 'middle',
      } as never),
      glRadialAnnotation([{ label: 'agree or strongly agree' }], {
        angle: () => 0,
        radius: () => 0,
        text: (d: { label: string }) => d.label,
        anchor: 'middle',
        baseline: 'middle',
        dy: 20,
      } as never),
    ],
    angle: { scale: scaleLinear().domain([0, Math.PI * 2]) as never, wrap: false },
    radius: { scale: scaleLinear().domain([0, 1]) as never },
  });

  return (
    <GLFigure
      title="Just under three-quarters of respondents agree."
      subtitle="Share agreeing that regulations are predictable, n = 1,240"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={230} ariaLabel="Share agreeing" />
    </GLFigure>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Hierarchy
// ════════════════════════════════════════════════════════════════════════════

/**
 * `74-recharts-treemap` — the same hierarchy as area.
 *
 * Read against the sunburst above: identical data, and the treemap labels ten
 * tiles where the sunburst labels four. Area is simply a better channel than
 * angle-at-radius for a decomposition with uneven shares, which is why §9 makes
 * the treemap the spec's composition chart and the sunburst a form it tolerates.
 *
 * `group` makes it two-level. The tiers are separated by two widths of paper
 * gutter and no strokes at either depth — the boundary is drawn in negative
 * space (§3.4.1), which is the one thing about a GL treemap people try to
 * "fix" back.
 */
function Treemap() {
  const leaves = (exportHierarchy.children ?? []).flatMap((branch) => {
    const walk = (node: HierarchyNode): { product: string; sector: string; value: number }[] =>
      node.children
        ? node.children.flatMap(walk)
        : [{ product: node.name, sector: branch.name, value: node.value ?? 0 }];
    return walk(branch);
  });

  const chart = glTreemapChart(leaves, {
    category: 'product',
    group: 'sector',
    value: 'value',
    // ONE hue, not the palette. The library warns if you spend the palette here
    // and it is right to: ten leaves exhaust six categorical tones, so four
    // products would silently go muted and read as a residual bucket. On a
    // two-level treemap the paper gutters already carry the structure colour
    // would otherwise have to, which is exactly what `tone` is for.
    tone: 'c-1',
    valueFormat: (v) => `${v}`,
  });

  return (
    <GLFigure
      title="Copper alone is larger than every service export combined."
      subtitle="Export value by sector and product, USD millions"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={320} ariaLabel="Export value by sector and product" />
    </GLFigure>
  );
}

/**
 * `36-hierarchy-tree` — the tidy tree, laid out by `d3-hierarchy`'s `tree()`.
 *
 * The links are the specimen. A tree edge joins two nodes of one structure, so
 * §3.4.2 makes it a CONNECTOR: dark tone, line weight, butt cap. It is not a
 * series line (there is no series) and not chrome (the edges are the data), and
 * getting that wrong in either direction is the standing failure the chrome/data
 * split exists to close.
 *
 * Recorded `partial`: `tree()` is called here rather than wrapped. The layout is
 * three lines and the library ships no graph-layout subsystem, so a
 * `glTreeChart` would be a whole-chart function for a chart the spec has never
 * ruled on.
 */
function HierarchyTree() {
  const root = tree<HierarchyNode>().size([1, 1])(hierarchy(exportHierarchy));
  const nodes = root.descendants().map((node) => ({
    name: node.data.name,
    x: node.y,
    y: node.x,
    depth: node.depth,
    leaf: !node.children,
  }));
  const links = root.links().map((link) => ({
    x1: link.source.y,
    y1: link.source.x,
    x2: link.target.y,
    y2: link.target.x,
  }));

  const chart = glChart({
    marks: [
      glLink(links, { x1: 'x1', y1: 'y1', x2: 'x2', y2: 'y2', tone: 'muted' }),
      glPoint(nodes, { x: 'x', y: 'y', tone: 'c-1' }),
      glLabel(nodes, {
        x: 'x',
        y: 'y',
        text: (d) => d.name,
        tone: 'c-1',
        // Leaves read outward to the right; internal nodes sit ABOVE their own
        // circle. Putting an internal label to the left of its node — the
        // obvious first choice — lands it on top of the link arriving from the
        // parent, which is the one place on the plot guaranteed to have ink.
        anchor: (d) => (d.leaf ? 'start' : 'middle'),
        dx: (d) => (d.leaf ? 10 : 0),
        dy: (d) => (d.leaf ? 0 : -12),
      }),
    ],
    // `axis: false` keeps the scale and omits the visible axis, and this is the
    // one chart in the gallery where dropping it is CORRECT rather than a
    // shortcut. §3.5 requires an axis line where the reader estimates a value
    // off a scale; a tidy tree's coordinates are layout output — "0.62 of the
    // way across" is not a quantity anyone reads — so an axis here would be a
    // frame pretending to be a measurement. Compare `ts-44-framed-scatter`,
    // where the same rule points the other way and the axes stay.
    //
    // Note `guides: false` is NOT the way to do this: it drops the axes *and*
    // stops TanStack inferring scales from the marks, so every channel then
    // needs a configured scale instance. Recorded as a gap — `GLAxisPreset` has no
    // way to say "scale without axis", so the plate reaches past the preset.
    x: { ...glAxisX({ domain: [-0.02, 1.02], nice: false }), axis: false as const },
    y: { ...glAxisY({ grid: false, domain: [-0.04, 1.04], nice: false }), axis: false as const },
    variant: { labelHalo: true },
    margin: { left: 76, right: 96, top: 12, bottom: 12 },
  });

  return (
    <GLFigure
      title="Two branches are three levels deep; two are one."
      subtitle="Export classification as a tidy tree; depth runs left to right"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={320} ariaLabel="Export classification tree" />
    </GLFigure>
  );
}

// ── Renderers ───────────────────────────────────────────────────────────────

export const RADIAL_RENDERERS: Record<string, () => ReactNode> = {
  'ts-76-pie': Pie,
  'ts-77-donut': Donut,
  'ts-93-labeled-pie': LabeledPie,
  'ts-95-rounded-donut': RoundedDonut,
  'ts-96-nested-donut': NestedDonut,
  'ts-101-sunburst': Sunburst,
  'ts-100-radial-bars': RadialBars,
  'ts-41-waffle-unit-chart': Waffle,
  'ts-75-radar': Radar,
  'ts-99-comparative-radar': ComparativeRadar,
  'ts-78-gauge': ArcGauge,
  'ts-74-treemap': Treemap,
  'ts-36-hierarchy-tree': HierarchyTree,
};
