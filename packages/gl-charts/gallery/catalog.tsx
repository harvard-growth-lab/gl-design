/**
 * The gallery — every worked example in the spec PDF, rebuilt with gl-charts.
 *
 * These plates are the package's recipes, and they are the reason there are no
 * whole-chart presets for the Cartesian types. A preset is an API: it has to be
 * versioned, documented, and can only express what its option bag anticipated.
 * A plate below is a snippet — you copy the twelve lines, change the fields, and
 * the whole TanStack surface is still available to you. And unlike a snippet in a
 * README, these are rendered in Chrome and audited against the tokens on every
 * `npm run gallery`, so they cannot quietly stop being true.
 *
 * The contract each entry keeps: same finding, same subtitle, same source line,
 * same data shape as the PDF page it mirrors, and NOTHING styled by hand. If a
 * plate needs a hex, a font size, a stroke width or an opacity written here, the
 * library is missing something and that belongs in the entry's `gaps` in
 * `catalog-meta.mjs` — not in a style attribute.
 *
 * How to read a plate:
 *   - Cartesian charts (line, scatter, bar, stack) are COMPOSED: `glChart()` for
 *     the theme, margins and variant class, `gl*` marks for the spec's mark
 *     defaults, and the helpers in `compose.ts` for the moves the spec names —
 *     `popUp`, `toSeries`, `endLabels`, `stackOrder`, `toneRamp`, `yearAxisFor`.
 *   - Radar, treemap, boxplot and choropleth CALL A SHAPE FUNCTION from
 *     `@growth-lab/gl-charts/shapes`, because TanStack cannot express those at
 *     all and the library has to supply the geometry rather than just defaults.
 *   - Every builder returns `{ definition, className, props }`; spread `props`
 *     onto `<Chart>` and the CSS-only spec rules cannot be forgotten.
 *
 * The only import from outside `gl-charts` is `d3-geo`'s projection factory,
 * which the choropleth takes by design — the library refuses to pick a projection
 * for you, and refuses to depend on `d3-geo` to do it.
 */

import type { ReactNode } from 'react';
import { Chart } from '@tanstack/react-charts';
import { geoMercator } from 'd3-geo';

import {
  clearance,
  endLabels,
  glArea,
  glAxisLog,
  glAxisY,
  glAxisYearBand,
  glBar,
  glChart,
  glLine,
  glMutedLine,
  glMutedPoint,
  glPoint,
  popUp,
  stackOrder,
  toSeries,
  toneRamp,
  yearAxisFor,
} from '../src/index.js';
import {
  glBoxplotChart,
  glChoroplethChart,
  glRadarChart,
  glTreemapChart,
} from '../src/shapes.js';
import { GLFigure, GLLegend } from '../src/figure.js';

import { PLATES } from './catalog-meta.mjs';
import {
  bubbleData,
  incomeData,
  indexData,
  lineData,
  provinceValues,
  provinces,
  radarData,
  scatterData,
  stackedData,
  stackedOrder,
  threeToneData,
  threeToneOrder,
  treemapData,
  twoToneData,
  twoToneOrder,
  type BubblePoint,
} from './data.js';

/** Figure-block width in CSS px. The PDF's prose column is 476pt ≈ 635px. */
export const PLATE_WIDTH = 596;

export interface GalleryPlate {
  id: string;
  figure: string;
  page: number;
  kind: string;
  status: string;
  gaps: readonly string[];
  render?: () => ReactNode;
}

// ── Shared formatters ───────────────────────────────────────────────────────

const usd = (v: number) => `USD ${v.toFixed(1)}B`;

/** `$0`, `$5k`, `$20k` — the plate's own y-axis form on Figure 6. */
const usdThousands = (v: number) => (v === 0 ? '$0' : `$${Math.round(v / 1000)}k`);

// ── Figure 1 — scatter ──────────────────────────────────────────────────────

function Fig1() {
  // Three series, three hues: a scatter of regions is the case where a
  // categorical palette genuinely earns its place. The `color` channel routes
  // paint through the chart scale, which spends the palette c-1, c-2, c-3.
  const chart = glChart({
    marks: [glPoint(scatterData, { x: 'gdp', y: 'eci', color: 'region' })],
    x: glAxisLog({ label: 'GDP per capita, PPP (log scale)' }),
    y: glAxisY({ label: 'Economic Complexity Index' }),
  });

  return (
    <GLFigure
      number={1}
      title="Economic complexity tracks income, with notable outliers."
      subtitle="GDP per capita (PPP, log scale) vs. Economic Complexity Index, by region, 2022"
      source="Source: Growth Lab analysis of Atlas of Economic Complexity, 2022."
      // Dots, not squares: the series is a scatter, so its legend marks are the
      // scatter circles of §3.4 — main fill, 1px dark stroke, 0.8 opacity.
      // Below the plot, which is where the spec's own Figure 1 puts it, and
      // flush left with the rest of the figure block.
      legend={
        <GLLegend
          items={[
            { label: 'East Asia', tone: 'c-1', mark: 'point' },
            { label: 'Europe', tone: 'c-2', mark: 'point' },
            { label: 'South Asia', tone: 'c-3', mark: 'point' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={260} ariaLabel="Complexity versus income" />
    </GLFigure>
  );
}

// ── Figure 2 — line, four series ────────────────────────────────────────────

function Fig2() {
  // Four series is the ceiling for coloured lines. `toSeries` tones them in
  // palette order — the same order the colour scale spends — so each end-label
  // lands on the hue of the line it names.
  const series = toSeries(lineData, 'category');

  const chart = glChart({
    marks: [
      glLine(lineData, { x: 'year', y: 'share', z: 'category', color: 'category' }),
      ...endLabels(series, { x: 'year', y: 'share' }),
    ],
    x: yearAxisFor(lineData, 'year'),
    y: glAxisY({ label: 'Share of exports (%)' }),
    endLabels: true,
  });

  return (
    <GLFigure
      number={2}
      title="Copper and coal carried the Mongolian boom."
      subtitle="Share of merchandise exports by category, 2003–2024, percent"
      source="Source: Growth Lab analysis of UN Comtrade. Categories: Copper (HS 2603, 7402); Coal (HS 2701, 2702)."
    >
      <Chart {...chart.props} height={260} ariaLabel="Export shares by category" />
    </GLFigure>
  );
}

// ── Figure 3 — stacked bar ──────────────────────────────────────────────────

function Fig3() {
  // `stackOrder` imposes the bottom-to-top order on the rows, because TanStack
  // stacks in the order it first meets each key. A stacked bar is categorical on
  // x by construction — hence the band axis, not the linear year axis: on a
  // linear scale the end bars centre on the domain endpoints and hang half off
  // the plot.
  const rows = stackOrder(stackedData, 'sector', stackedOrder);

  const chart = glChart({
    marks: [glBar(rows, { x: 'year', y: 'share', z: 'sector', color: 'sector' })],
    x: glAxisYearBand(),
    y: glAxisY({ label: 'Share of exports (%)' }),
    variant: { stacked: true },
  });

  return (
    <GLFigure
      number={3}
      title="Services took over the export basket."
      subtitle="Export composition by sector, 2010–2024, share of total exports"
      source="Source: Growth Lab analysis of national statistics."
      // Right of the plot and vertical — the one case §3.11 allows besides
      // "below, flush left". The entries run in the stack's own top-to-bottom
      // order, so a reader maps row to band by position rather than by
      // matching four squares against four bands.
      legendPlacement="right"
      legend={
        <GLLegend
          items={[
            { label: 'Services', tone: 'c-4' },
            { label: 'Manuf.', tone: 'c-3' },
            { label: 'Agri.', tone: 'c-2' },
            { label: 'Minerals', tone: 'c-1' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={280} ariaLabel="Export composition by sector" />
    </GLFigure>
  );
}

// ── Figure 3B — two tones of one hue ────────────────────────────────────────

function Fig3B() {
  // Goods vs. services share a parent concept, so they are one hue at two tones
  // rather than two unrelated colours: the shared hue keeps the bar reading as
  // one total while lightness carries the split. The ramp arrives as a
  // chart-level colour scale, not as separate marks — TanStack stacks *within* a
  // mark, so one mark per tone would draw both bands from the baseline.
  const rows = stackOrder(twoToneData, 'group', twoToneOrder);

  const chart = glChart({
    marks: [glBar(rows, { x: 'year', y: 'share', z: 'group', color: 'group' })],
    color: toneRamp({ tones: 'two', order: twoToneOrder }),
    x: glAxisYearBand(),
    y: glAxisY({ label: 'Share of exports (%)' }),
    variant: { stacked: true },
  });

  return (
    <GLFigure
      number="Figure 3B"
      title="Services overtook goods in the export basket."
      subtitle="Goods vs. services share of total exports, 2010–2024, percent"
      source="Source: Growth Lab analysis of national statistics."
      legendPlacement="right"
      legend={
        <GLLegend
          items={[
            { label: 'Services', tone: 'c-1', step: 'light' },
            { label: 'Goods', tone: 'c-1' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={280} ariaLabel="Goods versus services share" />
    </GLFigure>
  );
}

// ── Figure 3C — three tones, stacked area ───────────────────────────────────

function Fig3C() {
  // Three tones encode an ORDERED variable, so the ramp runs monotonically
  // light → main → dark, lightest tier at the bottom. This is the only place in
  // the spec where a dark tone is used as a fill. Areas belong on a continuum —
  // a band flows across time rather than owning a slot — so unlike Figure 3 this
  // keeps the linear year axis, and takes no `stacked` variant: bands sit
  // edge-to-edge and the tone step is what separates them.
  const rows = stackOrder(threeToneData, 'group', threeToneOrder);

  const chart = glChart({
    marks: [glArea(rows, { x: 'year', y: 'share', z: 'group', color: 'group' })],
    color: toneRamp({ tones: 'three', order: threeToneOrder }),
    x: yearAxisFor(rows, 'year'),
    y: glAxisY({ label: 'Share of exports (%)' }),
  });

  return (
    <GLFigure
      number="Figure 3C"
      title="High-complexity exports grew share over the decade."
      subtitle="Composition of merchandise exports by complexity tier, 2010–2024, percent"
      source="Source: Growth Lab analysis of UN Comtrade. Complexity tiers derived from PCI percentile."
      // A stacked area, so the legend goes right and vertical like Figure 3's
      // — and in the stack's order, which for a three-tone ramp is darkest
      // (top) to lightest (bottom). Listing it lightest-first would put the
      // ramp upside down against the plot.
      legendPlacement="right"
      legend={
        <GLLegend
          items={[
            { label: 'High complexity', tone: 'c-1', step: 'dark' },
            { label: 'Medium', tone: 'c-1' },
            { label: 'Low', tone: 'c-1', step: 'light' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={280} ariaLabel="Export composition by complexity tier" />
    </GLFigure>
  );
}

// ── Figures 4 & 11 — treemap ────────────────────────────────────────────────

const TREEMAP_HEIGHT = 300;

function Fig4() {
  // A shape function, not a composition: nothing in TanStack computes squarified
  // rectangles or decides whether a label fits inside one. It sets its own
  // variant class, so the crispEdges rule that keeps abutting tiles clean can't
  // be left off at the call site.
  const chart = glTreemapChart(treemapData, {
    category: 'name',
    value: 'value',
    valueFormat: usd,
  });

  return (
    <GLFigure
      number={4}
      title="A handful of products dominate the export basket."
      subtitle="Tiles sized by 2024 export value, USD billions"
      source="Source: Growth Lab analysis of UN Comtrade, 2024."
    >
      <Chart {...chart.props} height={TREEMAP_HEIGHT} ariaLabel="Export basket by product" />
    </GLFigure>
  );
}

function Fig11() {
  // The spec's default move on a treemap too: everything c-muted, one hue on the
  // tile that carries the finding.
  const chart = glTreemapChart(treemapData, {
    category: 'name',
    value: 'value',
    highlight: 'Copper',
    valueFormat: usd,
  });

  return (
    <GLFigure
      number={11}
      title="Copper alone accounts for nearly 40% of exports."
      subtitle="Tiles sized by 2024 export value; only the focus category is colored"
      source="Source: Growth Lab analysis of UN Comtrade, 2024."
    >
      <Chart
        {...chart.props}
        height={TREEMAP_HEIGHT}
        ariaLabel="Export basket with copper highlighted"
      />
    </GLFigure>
  );
}

// ── Figure 5 — radar ────────────────────────────────────────────────────────

function Fig5() {
  const chart = glRadarChart(radarData, {
    dimension: 'dimension',
    value: 'value',
    // The dimensions are normalized to a common 0–1 index, so the outer ring is
    // 1 by construction rather than by whatever the tallest observation was.
    max: 1,
    format: (v) => v.toFixed(1),
  });

  return (
    <GLFigure
      number={5}
      title="A balanced complexity profile, weakest on growth volatility."
      subtitle="Six-dimension capability index, normalized 0–1, latest year"
      source="Source: Growth Lab analysis. Dimensions normalized to the cross-country max in each axis."
      // `band`, not `fill`: a radar polygon has a light fill AND a stroke
      // (§3.4), so its miniature carries both. The spec PDF's own Figure 5
      // draws exactly this — a pale square with a blue border — and a solid
      // square here would claim the polygon is opaque.
      legendPlacement="right"
      legend={<GLLegend items={[{ label: 'Country profile', tone: 'c-1', mark: 'polygon' }]} />}
    >
      <Chart {...chart.props} height={340} ariaLabel="Six-dimension capability profile" />
    </GLFigure>
  );
}

// ── Figure 6 — boxplot ──────────────────────────────────────────────────────

function Fig6() {
  const chart = glBoxplotChart(incomeData, {
    category: 'year',
    value: 'gdpPerCapita',
    series: 'country',
    // Lifts Pakistan's own observations out of the boxes and draws them over the
    // top — the box is the peer group, and a line compared against a spread that
    // contains it is comparing an entity to itself.
    highlight: 'Pakistan',
    valueLabel: 'GDP per capita',
    valueFormat: usdThousands,
  });

  return (
    <GLFigure
      number={6}
      title="Pakistan sits in the lower half of the regional income distribution."
      subtitle="GDP per capita by year across regional peers, 2019–2023, USD"
      source="Source: Growth Lab analysis of World Bank WDI."
    >
      <Chart
        {...chart.props}
        height={300}
        ariaLabel="GDP per capita distribution across regional peers, Pakistan highlighted"
      />
    </GLFigure>
  );
}

// ── Figures 7 & 8 — choropleths ─────────────────────────────────────────────

const provinceId = (f: (typeof provinces)[number]) => f.properties.id;

function Fig7() {
  const chart = glChoroplethChart(provinces, {
    projection: geoMercator,
    id: provinceId,
    values: {
      rows: provinceValues,
      id: (r) => r.province,
      value: (r) => r.eci,
    },
    // Pinned rather than inferred so the five bins cut on the round half-index
    // boundaries the plate's legend prints, instead of on the observed extent.
    domain: [-1, 1.5],
    legend: { label: 'Economic Complexity Index' },
  });

  return (
    <GLFigure
      number={7}
      title="Complexity is concentrated in the central provinces."
      subtitle="Economic Complexity Index by province, 2022"
      source="Source: Growth Lab analysis. Provinces stylized for illustration."
    >
      <Chart {...chart.props} height={320} ariaLabel="Economic complexity by province" />
    </GLFigure>
  );
}

function Fig8() {
  const chart = glChoroplethChart(provinces, {
    kind: 'diverging',
    projection: geoMercator,
    id: provinceId,
    values: {
      rows: provinceValues,
      id: (r) => r.province,
      value: (r) => r.shareChange,
    },
    midpoint: 0,
    domain: [-6, 6],
    legend: { label: 'Δ share of exports (pp), 2010–2024' },
  });

  return (
    <GLFigure
      number={8}
      title="Coastal provinces gained share; the interior lost it."
      subtitle="Change in share of national exports, 2010 vs. 2024, percentage points"
      source="Source: Growth Lab analysis of national export records."
    >
      <Chart {...chart.props} height={320} ariaLabel="Change in export share by province" />
    </GLFigure>
  );
}

// ── Figure 9 — bubble scatter, pop-up ───────────────────────────────────────

function Fig9() {
  // Radius, not quantity — TanStack applies no size scale, so area-true sizing
  // means passing the square root here.
  const r = (d: BubblePoint) => 4 + Math.sqrt(d.exports) * 1.1;

  const { backdrop, focus } = popUp(bubbleData, {
    by: 'country',
    highlight: 'South Korea',
  });

  const chart = glChart({
    marks: [
      glMutedPoint(backdrop, { x: 'gdp', y: 'eci', r }),
      ...focus.map((s) => glPoint(s.rows, { x: 'gdp', y: 'eci', r, tone: s.tone })),
      // The label sits ON the plot beside a bubble, so it needs an offset that
      // knows the bubble's radius (`clearOf`) and the paper halo that keeps it
      // legible over whatever it crosses (`variant.labelHalo`).
      //
      // ABOVE the bubble, not beside it. §3.12 asks for the side with open plot
      // space, and there is none on either flank here: the highlighted bubble is
      // the largest mark on the chart and sits in the top-right corner, so a
      // label to its right leaves the frame and a label to its left — which is
      // what this plate used to draw — lands in the densest part of the
      // backdrop. Straight up is the one clear direction, and `clearOf` still
      // measures the offset off the bubble's own radius rather than a guess.
      ...endLabels(focus, {
        x: 'gdp',
        y: 'eci',
        at: 'all',
        ...clearance('above', r),
      }),
    ],
    x: glAxisLog({ label: 'GDP per capita, PPP (log scale)' }),
    y: glAxisY({ label: 'Economic Complexity Index' }),
    variant: { labelHalo: true },
  });

  return (
    <GLFigure
      number={9}
      title="South Korea climbed the complexity ladder faster than its peers."
      subtitle="GDP per capita vs. Economic Complexity Index, bubble size = export value, 2022"
      source="Source: Growth Lab analysis of Atlas of Economic Complexity, 2022."
    >
      <Chart
        {...chart.props}
        height={250}
        ariaLabel="Complexity versus income, South Korea highlighted"
      />
    </GLFigure>
  );
}

// ── Figure 10 — line, pop-up ────────────────────────────────────────────────

function Fig10() {
  // The spec's central move, and the shape to reach for before a categorical
  // palette: twelve series would need twelve hues, so eleven go muted as ONE
  // mark and the two carrying the finding get c-1 and c-2 at 2.4px, each with a
  // direct end-label in its own dark tone.
  const { backdrop, focus } = popUp(indexData, {
    by: 'country',
    highlight: ['Mongolia', 'Chile'],
  });

  const chart = glChart({
    marks: [
      glMutedLine(backdrop, { x: 'year', y: 'index', z: 'country' }),
      ...focus.map((s) =>
        glLine(s.rows, { x: 'year', y: 'index', z: 'country', tone: s.tone, focus: true }),
      ),
      ...endLabels(focus, { x: 'year', y: 'index' }),
    ],
    x: yearAxisFor(indexData, 'year'),
    y: glAxisY({ label: 'Index (2010 = 100)' }),
    endLabels: true,
  });

  return (
    <GLFigure
      number={10}
      title="Mongolia and Chile broke from the pack on copper exports."
      subtitle="Index of copper export value (2010 = 100), twelve mineral economies, 2010–2024"
      source="Source: Growth Lab analysis of UN Comtrade. HS 2603, 7402."
    >
      <Chart {...chart.props} height={250} ariaLabel="Copper export index" />
    </GLFigure>
  );
}

// ── Catalog ─────────────────────────────────────────────────────────────────

const RENDERERS: Record<string, () => ReactNode> = {
  'fig-01-scatter': Fig1,
  'fig-02-line': Fig2,
  'fig-03-stacked-bar': Fig3,
  'fig-03b-two-tone': Fig3B,
  'fig-03c-three-tone': Fig3C,
  'fig-04-treemap': Fig4,
  'fig-05-radar': Fig5,
  'fig-06-boxplot': Fig6,
  'fig-07-choropleth-sequential': Fig7,
  'fig-08-choropleth-diverging': Fig8,
  'fig-09-popup-scatter': Fig9,
  'fig-10-popup-line': Fig10,
  'fig-11-popup-treemap': Fig11,
};

export const gallery: GalleryPlate[] = (PLATES as GalleryPlate[]).map((plate) => ({
  ...plate,
  render: RENDERERS[plate.id],
}));
