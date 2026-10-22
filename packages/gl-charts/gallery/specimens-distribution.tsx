/**
 * Catalog specimens — Distribution, Matrix, Small Multiples and Time.
 *
 * Same contract as its siblings: **nothing is styled by hand**, and anything the
 * library cannot express is recorded in `gaps` rather than patched in a style
 * attribute.
 *
 * ## Why the boxplot and the violin are both here
 *
 * Because `groupedObservations` is bimodal in one group, and that is the only
 * arrangement where the two forms disagree. A boxplot draws Latin America's two
 * modes as one box with a median sitting in the gap between them — a summary
 * that is arithmetically correct and visually a lie. The violin is the form that
 * shows the gap is there. Drawing both from the same table is what makes the
 * comparison mean something; drawing each from data that flattered it would make
 * both look fine.
 *
 * ## Small multiples, and what `facet` costs
 *
 * `facet` is TanStack's own layout mark and this file uses it raw, because it
 * paints nothing: it takes a `by` channel and a spec-returning callback, splits
 * the data, and renders each cell's scene. There is no fill, stroke or opacity
 * to get wrong, so using it unwrapped does not breach the contract the way
 * reaching for a bare `dot()` would.
 *
 * What it does carry is typography — the cell titles are hard-coded at
 * `fontSize: 11` with `fillOpacity: 0.78`, below the 12px floor — and that is
 * corrected in `src/patch.css` alongside the axis labels, with an expiry test in
 * `constraints.test.ts`. That is a library fix, not a plate fix, which is the
 * distinction this whole gallery is built to keep.
 */

import type { ReactNode } from 'react';
import { Chart } from '@tanstack/react-charts';
import { facet } from '@tanstack/charts';

import {
  binValues,
  glAxisBand,
  glAxisBin,
  glAxisX,
  glAxisY,
  glBand,
  glBar,
  glBarX,
  glBinBar,
  glBinBarX,
  glCell,
  glChart,
  glLabel,
  glLine,
  glPoint,
  glSequentialColor,
} from '../src/index.js';
import { glBoxplotChart, glDensity, glLabelInkOn, glViolinChart } from '../src/shapes.js';
import { GLFigure, GLLegend, GLRampLegend } from '../src/figure.js';

import { cloudData } from './specimen-data.js';
import {
  DISTRIBUTION_REGIONS,
  MATRIX_COLUMNS,
  MATRIX_ROWS,
  MONTHS,
  calendarData,
  groupedObservations,
  ordinalMatrix,
} from './tanstack-data.js';

const SYNTHETIC = 'Source: Synthetic data for illustration. Not a Growth Lab estimate.';

// ════════════════════════════════════════════════════════════════════════════
// Distribution
// ════════════════════════════════════════════════════════════════════════════

/**
 * `15-boxplot` — five groups, five numbers each.
 *
 * `glBoxplotChart` computes the quantiles, so the chart is drawn from raw
 * observations and the summary cannot drift from the data. The muted boxes are
 * §11's rule and not a palette shortage: a distribution is context by
 * construction, and the saturated hue is reserved for whatever is being compared
 * against it.
 *
 * Read this one beside the violin below. Latin America is bimodal, and the box
 * puts its median in the empty space between the two modes.
 */
function Boxplot() {
  const chart = glBoxplotChart(groupedObservations, {
    category: 'region',
    value: 'complexity',
    categories: [...DISTRIBUTION_REGIONS],
    valueLabel: 'Economic Complexity Index',
    valueFormat: (v) => v.toFixed(1),
  });

  return (
    <GLFigure
      title="Europe is both the highest and the tightest distribution."
      subtitle={`Complexity by region, ${groupedObservations.length} economies`}
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={280} ariaLabel="Complexity distribution by region" />
    </GLFigure>
  );
}

/**
 * `63-violin-distributions` — the same five groups as silhouettes.
 *
 * The estimate is trimmed to the observed range rather than run three bandwidths
 * past the ends, which is `geom_violin`'s `trim = TRUE` and for the same reason:
 * an untrimmed tail tapers into territory nobody measured, and on a chart that
 * reads as evidence rather than as smoothing.
 *
 * `scale: 'area'` keeps every silhouette holding the same area, so width reads
 * as density. The alternative — every violin peaking at the full slot — compares
 * shape and throws the magnitude away, which is wrong here because the group
 * sizes differ by a factor of two and a half.
 */
function Violin() {
  const chart = glViolinChart(groupedObservations, {
    category: 'region',
    value: 'complexity',
    categories: [...DISTRIBUTION_REGIONS],
    valueLabel: 'Economic Complexity Index',
    valueFormat: (v) => v.toFixed(1),
    scale: 'area',
  });

  return (
    <GLFigure
      title="Latin America is two distributions, which the boxplot cannot show."
      subtitle={`Kernel density by region, ${groupedObservations.length} economies, equal-area scaling`}
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={280} ariaLabel="Complexity density by region" />
    </GLFigure>
  );
}

/**
 * `62-ridgeline-density` — the same densities stacked down the page.
 *
 * A ridgeline trades the violin's symmetry for vertical space, which is the
 * right trade when the *shape* is the finding and the groups have a natural
 * order. The offset is computed here — that is layout arithmetic, like the
 * hexbin lattice — and each curve takes one step of the sequential ramp so the
 * ordering is carried by the lightness as well as the position.
 *
 * The groups are named on the Y AXIS rather than by labels floating in the plot.
 * That is not a layout convenience: §3.5 puts an axis line on both dimensions,
 * and a ridgeline's y axis is otherwise a bare vertical line measuring an offset
 * nobody chose. Putting the group names on it makes the axis mean something and
 * removes five labels from over the data at the same time.
 *
 * Recorded `partial`: the ridges are spaced rather than overlapped, which gives
 * up the compactness that is a ridgeline's argument. See the gap.
 */
function Ridgeline() {
  const ramp = glSequentialColor({ domain: [0, DISTRIBUTION_REGIONS.length - 1], steps: 5 });
  const STEP = 1;
  const baseline = (i: number) => (DISTRIBUTION_REGIONS.length - 1 - i) * STEP;

  const curves = DISTRIBUTION_REGIONS.map((region, i) => {
    const values = groupedObservations
      .filter((d) => d.region === region)
      .map((d) => d.complexity);
    const density = glDensity(values, { samples: 64 });
    const peak = Math.max(...density.map((d) => d.density), 1e-9);
    return {
      region,
      index: i,
      rows: density.map((d) => ({
        value: d.value,
        // Each ridge sits on its own baseline and rises at most 0.85 of the gap,
        // so neighbours stay clear of each other.
        y: baseline(i) + (d.density / peak) * STEP * 0.85,
        base: baseline(i),
      })),
    };
  });

  const chart = glChart({
    marks: curves.map((curve) =>
      // Filled, not stroked. A ridge is a silhouette — the same mark a violin
      // uses — and §12's palest ramp step is designed to work as a FILL against
      // paper; as a 2px line it barely reads at all.
      glBand(curve.rows, { x: 'value', y1: 'base', y2: 'y', fill: ramp(curve.index) }),
    ),
    x: glAxisX({ label: 'Economic Complexity Index' }),
    y: glAxisY({
      grid: false,
      domain: [-0.1, DISTRIBUTION_REGIONS.length * STEP],
      values: DISTRIBUTION_REGIONS.map((_, i) => baseline(i)),
      format: (v) => DISTRIBUTION_REGIONS[DISTRIBUTION_REGIONS.length - 1 - Math.round(v)] ?? '',
    }),
    margin: { left: 132 },
  });

  return (
    <GLFigure
      title="Every region is unimodal except Latin America."
      subtitle="Kernel density of complexity by region, offset vertically"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={280} ariaLabel="Ridgeline density by region" />
    </GLFigure>
  );
}

/**
 * `52-beeswarm-dodge` — every observation kept, none of them overlapping.
 *
 * The dodge is computed in the plate: observations are binned along the value
 * axis and offset within their slot until nothing collides. That is layout
 * arithmetic and belongs here, but it is general enough to belong in
 * `compose.ts` instead — which is what the recorded gap says.
 *
 * The form's argument over a boxplot is n: the reader can see that South Asia
 * has sixteen economies and Sub-Saharan Africa forty-one, which five quantiles
 * cannot tell them.
 */
function Beeswarm() {
  const LANE = 0.052;
  const rows: { region: string; complexity: number; offset: number }[] = [];

  for (const region of DISTRIBUTION_REGIONS) {
    const values = groupedObservations
      .filter((d) => d.region === region)
      .sort((a, b) => a.complexity - b.complexity);
    // Bins along the value axis; within a bin, alternate outward from the
    // centre so the swarm stays symmetric about its slot.
    const bins = new Map<number, number>();
    for (const d of values) {
      const bin = Math.round(d.complexity / 0.11);
      const seen = bins.get(bin) ?? 0;
      bins.set(bin, seen + 1);
      const rank = Math.ceil(seen / 2) * (seen % 2 === 0 ? 1 : -1);
      rows.push({ region, complexity: d.complexity, offset: rank * LANE });
    }
  }

  const slot = new Map<string, number>(DISTRIBUTION_REGIONS.map((region, i) => [region, i]));
  const placed = rows.map((d) => ({ ...d, x: (slot.get(d.region) ?? 0) + d.offset }));

  const chart = glChart({
    marks: [glPoint(placed, { x: 'x', y: 'complexity', tone: 'c-1' })],
    x: glAxisX({
      domain: [-0.55, DISTRIBUTION_REGIONS.length - 0.45],
      values: DISTRIBUTION_REGIONS.map((_, i) => i),
      format: (v) => DISTRIBUTION_REGIONS[v] ?? '',
      nice: false,
    }),
    y: glAxisY({ label: 'Economic Complexity Index' }),
    margin: { bottom: 74 },
  });

  return (
    <GLFigure
      title="Sub-Saharan Africa has more than twice the economies of South Asia."
      subtitle={`Every observation shown, dodged within its slot; ${groupedObservations.length} economies`}
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={280} ariaLabel="Complexity beeswarm by region" />
    </GLFigure>
  );
}

/**
 * `51-faceted-distributions` — one histogram per region.
 *
 * Small multiples answer the question a five-group violin cannot: what does each
 * distribution look like on its *own* axis, without four others competing for
 * the reader's attention. The shared y scale is what keeps the panels
 * comparable, and `facet` resolves it across cells rather than per cell.
 *
 * Recorded `partial`: `facet` is unwrapped. `glChart`'s margins are sized for a
 * single chart (74px left to clear a rotated axis label), which is most of a
 * narrow facet cell, so the margin is overridden here. A `glFacet` that knew the
 * small-multiple margin model is the missing piece.
 */
function FacetedDistributions() {
  const chart = glChart({
    marks: [
      facet(groupedObservations, {
        by: 'region',
        columns: 3,
        gap: 22,
        chart: (rows) => {
          const bins = binValues(
            rows.map((d) => d.complexity),
            { thresholds: [-2.5, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5] },
          );
          const counts = bins.map((b) => ({ bin: b.x1.toFixed(1), count: b.count }));
          return {
            marks: [glBinBar(counts, { x: 'bin', y: 'count' })],
            x: glAxisBin({ format: (v) => (Number(v) % 1 === 0 ? v : '') }),
            y: glAxisY({ domain: [0, 16], tickCount: 4 }),
          };
        },
      }),
    ],
    margin: { left: 40, bottom: 30, top: 4 },
  });

  return (
    <GLFigure
      title="On a shared axis, only Europe is concentrated above zero."
      subtitle="Distribution of complexity by region, common bins and a common count axis"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={320} ariaLabel="Faceted complexity distributions" />
    </GLFigure>
  );
}

/**
 * `facets-anscombe` — four datasets with the same summary statistics.
 *
 * The point of Anscombe's quartet is that the numbers agree and the pictures do
 * not, so every panel must be on the SAME scales or the demonstration collapses.
 * `facet` resolves shared outer axes by default, which is exactly the behaviour
 * this needs and the reason the plate does not pin domains itself.
 */
function AnscombeFacets() {
  const QUARTET: Record<string, [number, number][]> = {
    I: [[10, 8.04], [8, 6.95], [13, 7.58], [9, 8.81], [11, 8.33], [14, 9.96],
        [6, 7.24], [4, 4.26], [12, 10.84], [7, 4.82], [5, 5.68]],
    II: [[10, 9.14], [8, 8.14], [13, 8.74], [9, 8.77], [11, 9.26], [14, 8.1],
         [6, 6.13], [4, 3.1], [12, 9.13], [7, 7.26], [5, 4.74]],
    III: [[10, 7.46], [8, 6.77], [13, 12.74], [9, 7.11], [11, 7.81], [14, 8.84],
          [6, 6.08], [4, 5.39], [12, 8.15], [7, 6.42], [5, 5.73]],
    IV: [[8, 6.58], [8, 5.76], [8, 7.71], [8, 8.84], [8, 8.47], [8, 7.04],
         [8, 5.25], [19, 12.5], [8, 5.56], [8, 7.91], [8, 6.89]],
  };
  const rows = Object.entries(QUARTET).flatMap(([set, points]) =>
    points.map(([x, y]) => ({ set, x, y })),
  );

  const chart = glChart({
    marks: [
      facet(rows, {
        by: 'set',
        columns: 4,
        gap: 18,
        label: (key) => `Set ${key}`,
        chart: (data) => ({
          marks: [glPoint(data, { x: 'x', y: 'y' })],
          x: glAxisX({ domain: [2, 21], tickCount: 3 }),
          y: glAxisY({ domain: [2, 14], tickCount: 4 }),
        }),
      }),
    ],
    margin: { left: 36, bottom: 28, top: 4 },
  });

  return (
    <GLFigure
      title="Four datasets, identical statistics, four different stories."
      subtitle="Anscombe's quartet on shared axes; every set has the same mean, variance and fit"
      source="Source: Anscombe, F. J. (1973), Graphs in Statistical Analysis."
    >
      <Chart {...chart.props} height={230} ariaLabel="Anscombe's quartet" />
    </GLFigure>
  );
}

/**
 * `57-scatter-marginal-histograms` — a joint distribution with both marginals.
 *
 * Recorded `partial`, and the gap is architectural rather than cosmetic: three
 * panels sharing two scales is a *linked-panel layout*, and the library has one.
 * `facet` splits one spec across cells; it cannot compose three different specs
 * against shared scales. So the panels here are three charts placed by the
 * plate's own grid, and the shared domains are pinned by hand on all three —
 * which is precisely what a layout would otherwise guarantee.
 */
function MarginalHistograms() {
  const xs = cloudData.map((d) => d.x);
  const ys = cloudData.map((d) => d.y);
  const xDomain: [number, number] = [Math.min(...xs) - 0.3, Math.max(...xs) + 0.3];
  const yDomain: [number, number] = [Math.min(...ys) - 0.3, Math.max(...ys) + 0.3];

  const xBins = binValues(xs, { count: 26 });
  const yBins = binValues(ys, { count: 20 });

  // The three panels only read as one chart if their PLOT rectangles line up, so
  // every margin below is chosen to match its neighbour's rather than to look
  // right on its own: the top marginal inherits the joint plot's left and right
  // gutters, the side marginal inherits its top and bottom. Doing that by hand,
  // in three places, on values that have to stay in sync is precisely the work a
  // linked-panel layout would do — which is this plate's recorded gap, made
  // concrete.
  const GUTTER = { left: 74, right: 16 };

  const joint = glChart({
    marks: [glPoint(cloudData, { x: 'x', y: 'y' })],
    x: glAxisX({ label: 'Log exports', domain: xDomain, nice: false }),
    y: glAxisY({ label: 'Log imports', domain: yDomain, nice: false }),
    margin: { ...GUTTER, top: 4 },
  });

  const top = glChart({
    marks: [
      glBinBar(
        xBins.map((b) => ({ bin: b.x1.toFixed(2), count: b.count })),
        { x: 'bin', y: 'count', tone: 'c-1', step: 'light' },
      ),
    ],
    // `values: []`, not `format: () => ''`. Both blank the labels; only the
    // first drops the TICKS, and a marginal that keeps them draws 26 teeth
    // under a bin axis whose scale is already stated by the joint plot below.
    x: glAxisBin({ values: [] }),
    y: glAxisY({ grid: false, tickCount: 2 }),
    margin: { ...GUTTER, bottom: 10, top: 4 },
  });

  // The y marginal is a HORIZONTAL histogram beside the plot, not a second
  // vertical one above it. A marginal has to share the axis it summarises or it
  // is just a third chart in the same figure.
  const side = glChart({
    marks: [
      glBinBarX(
        yBins.map((b) => ({ bin: b.x1.toFixed(2), count: b.count })),
        { y: 'bin', x: 'count', tone: 'c-1', step: 'light' },
      ),
    ],
    x: glAxisY({ grid: false, tickCount: 2 }),
    y: glAxisBin({ values: [] }),
    // Matches the joint chart's vertical gutters so the two share a baseline.
    margin: { left: 8, right: 8, top: 4, bottom: 52 },
  });

  return (
    <GLFigure
      title="Both marginals are bimodal, and the joint shows why."
      subtitle="Trade pairs with the distribution of each axis; marginals share the joint plot's domains"
      source={SYNTHETIC}
    >
      <div className="gl-plate__joint">
        <Chart {...top.props} height={64} ariaLabel="Distribution of log exports" />
        <div />
        <Chart {...joint.props} height={250} ariaLabel="Log imports against log exports" />
        <Chart {...side.props} height={250} ariaLabel="Distribution of log imports" />
      </div>
    </GLFigure>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Matrix
// ════════════════════════════════════════════════════════════════════════════

/**
 * `heatmap-labeled` — the cells carry their own numbers.
 *
 * A label on a fill cannot take Decision Rule 6's dark tone: that rule's stated
 * justification is WCAG AA *against paper*, and it does not reach text drawn on
 * a saturated fill — `c-1-dark` on `c-1` measures 2.5:1. The right rule is the
 * treemap's, which follows the fill's own luminance, and this plate is the
 * reason it is no longer private: `glLabelInkOn` now ships from
 * `@growth-lab/gl-charts/shapes` so a heatmap cell and a treemap tile answer the
 * question the same way instead of each guessing.
 *
 * It takes the resolved fill rather than a tone reference, which is what makes
 * it usable here at all — a sequential ramp's fourth bin has no tone triple to
 * ask about.
 *
 * Recorded `partial`: the *fit* half is still private. `estimateTextWidth` plus
 * the shorten ladder live in `shapes/treemap.ts`, so this plate can only label
 * because a 5×5 matrix of two-digit percentages fits by construction — which
 * the plate knows and the library cannot check.
 */
function LabeledHeatmap() {
  const values = ordinalMatrix.map((d) => d.value);
  const ramp = glSequentialColor({
    domain: [Math.min(...values), Math.max(...values)],
    steps: 5,
  });

  const chart = glChart({
    marks: [
      glCell(ordinalMatrix, { x: 'column', y: 'row', color: 'value' }),
      glLabel(ordinalMatrix, {
        x: 'column',
        y: 'row',
        text: (d) => `${d.value}%`,
        anchor: 'middle',
        fill: (d) => glLabelInkOn(ramp(d.value)),
      }),
    ],
    x: glAxisBin({ label: 'Quintile in 2024', domain: [...MATRIX_COLUMNS] }),
    y: glAxisBin({ label: 'Quintile in 2014', domain: [...MATRIX_ROWS] }),
    color: { scale: ramp },
    margin: { left: 104 },
  });

  return (
    <GLFigure
      title="Four in ten stay in the quintile they started in."
      subtitle="Transition between income quintiles, 2014 → 2024, row percentages"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={260} ariaLabel="Income quintile transition matrix" />
    </GLFigure>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Time
// ════════════════════════════════════════════════════════════════════════════

/** Both calendar plates are the same chart on different framing. */
function calendarChart(label: string) {
  const values = calendarData.map((d) => d.value);
  // Held here, not inlined into the chart, so the ramp legend can read its bins
  // and cut points back off the same object the cells are painted from. Two
  // copies of a ramp is two things that can drift apart.
  const color = glSequentialColor({ domain: [0, Math.max(...values)], steps: 5 });
  const chart = glChart({
    marks: [
      glCell(
        calendarData.map((d) => ({
          week: String(d.week).padStart(2, '0'),
          day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d.weekday],
          value: d.value,
        })),
        { x: 'week', y: 'day', color: 'value' },
      ),
    ],
    // A calendar is binned on BOTH axes — a week abuts the next week, a Tuesday
    // abuts a Wednesday. `glAxisBand`'s 0.28 gap would invent a discreteness the
    // calendar does not have.
    x: glAxisBin({
      format: (v) => {
        const week = Number(v);
        const first = calendarData.find((d) => d.week === week);
        // One label per month, on the week that starts it.
        return first && first.date.getUTCDate() <= 7 ? MONTHS[first.date.getUTCMonth()] : '';
      },
    }),
    y: glAxisBin({ domain: ['Sun', 'Sat', 'Fri', 'Thu', 'Wed', 'Tue', 'Mon'] }),
    color: { scale: color },
    margin: { left: 60 },
  });
  return { chart, color, label };
}

/**
 * `25-calendar-heatmap` — a year on a week × weekday lattice.
 *
 * Two structures are visible and both are real: the weekend band across the
 * bottom two rows, and a fortnight of zeroes in August. That is the test a
 * calendar heatmap has to pass — if the only thing on the grid is noise, the
 * form has bought a lot of ink for nothing.
 */
function CalendarHeatmap() {
  const { chart, color } = calendarChart('daily');

  return (
    <GLFigure
      title="The weekend band and the August shutdown are both visible."
      subtitle="Daily transaction count, 2023"
      source={SYNTHETIC}
      // A calendar's colour is a BINNED encoding, so §3.11 gives it a stepped
      // ramp with its cut points printed, not a set of categorical swatches.
      legend={
        <GLRampLegend
          scale={color}
          label="Transactions per day"
          format={(v) => String(Math.round(v))}
        />
      }
    >
      <Chart {...chart.props} height={220} ariaLabel="Daily transactions, 2023" />
    </GLFigure>
  );
}

/**
 * `118-token-usage-calendar` — the same lattice, read as consumption.
 *
 * Kept as its own plate rather than folded into the one above because the two
 * entries differ in the only way that matters to a design system: what the
 * colour means. A count ramp and a consumption ramp are both sequential with no
 * midpoint, so §12 sends both to the same five steps of one hue — and the plate
 * exists to show that the answer really is the same, rather than to assert it.
 */
function TokenCalendar() {
  const { chart, color } = calendarChart('tokens');
  const total = calendarData.reduce((sum, d) => sum + d.value, 0);

  return (
    <GLFigure
      title="Consumption is a weekday activity with one quiet fortnight."
      subtitle={`Daily API consumption, 2023; ${(total / 1000).toFixed(1)}k units in total`}
      source={SYNTHETIC}
      // This plate carried the counter-example: two swatches labelled "Lower"
      // and "Higher". They named the ramp's direction and nothing else — five
      // steps were painted and two were shown, so a reader could not place a
      // cell on the scale at all. §3.11 sends a binned encoding to a ramp.
      legend={
        <GLRampLegend
          scale={color}
          label="Units consumed per day"
          format={(v) => String(Math.round(v))}
        />
      }
    >
      <Chart {...chart.props} height={220} ariaLabel="Daily API consumption, 2023" />
    </GLFigure>
  );
}

// ── Renderers ───────────────────────────────────────────────────────────────

export const DISTRIBUTION_RENDERERS: Record<string, () => ReactNode> = {
  'ts-15-boxplot': Boxplot,
  'ts-63-violin-distributions': Violin,
  'ts-62-ridgeline-density': Ridgeline,
  'ts-52-beeswarm-dodge': Beeswarm,
  'ts-51-faceted-distributions': FacetedDistributions,
  'ts-facets-anscombe': AnscombeFacets,
  'ts-57-scatter-marginal-histograms': MarginalHistograms,
  'ts-heatmap-labeled': LabeledHeatmap,
  'ts-25-calendar-heatmap': CalendarHeatmap,
  'ts-118-token-usage-calendar': TokenCalendar,
};
