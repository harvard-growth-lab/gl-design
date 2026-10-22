/**
 * Distributions — seven catalog forms, drawn from the Atlas cross-section and
 * from Vietnam's product basket.
 *
 * This is the family where the *shape* of the data is the finding, so it is also
 * the family where the difference between a synthetic sample and a real one is
 * least forgiving. Three things the Atlas did to these charts, all of them
 * recorded rather than worked around:
 *
 * 1. **Groups are the size the world made them.** The catalog's five synthetic
 *    regions held 16–41 observations each. The Atlas's five regions hold 42, 23,
 *    3, 43 and 35 — and a three-economy box is drawn with exactly the same
 *    authority as a forty-three-economy one. Every group-wise demo below carries
 *    that gap, and the beeswarm exists precisely because it is the one form that
 *    tells the reader n.
 *
 * 2. **A bin key is not a rounded number.** `binValues` hands back numeric edges
 *    and `glAxisBin` takes string categories, so every histogram invents a key.
 *    The catalog's `String(Math.round(x1))` is correct on dollars and silently
 *    merges four bars into one on PCI. Both histograms here key on `toFixed`,
 *    and the fact that the right key depends on the variable is the gap.
 *
 * 3. **Nine sectors, five ramp steps.** §12 asks a ridgeline to carry its group
 *    ordering in a sequential ramp. The Atlas has nine sectors and the ramps are
 *    authored at five, so the middle steps are interpolated to within a few
 *    percent of each other and the ordering stops being legible on its own.
 *
 * Contract, unchanged from the gallery: no hex, no font size, no stroke width,
 * no opacity below. Data preparation is authored; appearance never is.
 */

import type { ReactNode } from 'react';
import { Chart } from '@tanstack/react-charts';

import {
  binValues,
  ecdf,
  glAxisBin,
  glAxisLog,
  glAxisPercent,
  glAxisX,
  glAxisY,
  glBand,
  glBinBar,
  glChart,
  glLine,
  glPoint,
  glSequentialColor,
  stepPoints,
} from '../src/index.js';
import { glBoxplotChart, glDensity, glQuantile, glViolinChart } from '../src/shapes.js';
import { GLFigure } from '../src/figure.js';

import {
  LATEST_YEAR,
  SECTOR_ORDER,
  countriesTable,
  countryYearTable,
  country,
  crossSection,
  defined,
  index,
  leadProductYearTable,
  leadProducts,
  sourceOf,
  withNote,
} from './atlas-data.js';
import type { Demo, Family } from './demo.js';

/**
 * The cross-section demos read two tables — the panel for the value, the country
 * catalog for the grouping — so both are cited. `sourceOf` derives the year span
 * from each table's own metadata, which for the panel is the whole 1995–2023
 * extract; a chart showing one year has to say so itself, which is what
 * `withNote` is for.
 */
const PANEL = sourceOf(countryYearTable, countriesTable);
const BASKET = sourceOf(leadProductYearTable);

/** The 2023 cross-section, tagged with the region each economy is grouped into. */
const CROSS_SECTION_NOTE = `Cross-section of ${LATEST_YEAR}`;

// ════════════════════════════════════════════════════════════════════════════

// #region demo:spec-12-histogram
/**
 * The shape of a country's export basket, binned.
 *
 * The bin boundaries are authored at 0.25 PCI rather than left to
 * Freedman–Diaconis. The estimator's answer here is 26 bins over a span of
 * 6.688, which puts every edge on an irrational number that no tick label can
 * name; a quarter-point of PCI is a boundary the reader can read off the axis.
 * `binValues` takes `thresholds` for exactly this case.
 *
 * §3.5: drawn on `glAxisBin`, so the band spans the whole bin — on `glAxisBand`
 * the bars would carry the 0.28 categorical gap and the reader would see
 * twenty-eight categories where the analyst measured one distribution. The bins
 * are still separated, by the fixed 1px paper channel `glBinBar` cuts as an
 * inset (§3.4.3): one hue abutting itself reads as a single mass.
 */
function BasketComplexity() {
  const products = defined(leadProducts, 'pci');

  // Quarter-point bins spanning the observed range, −4.5 through 2.5.
  const edges = Array.from({ length: 29 }, (_, i) => -4.5 + i * 0.25);
  const bins = binValues(
    products.map((d) => d.pci),
    { thresholds: edges },
  );

  // `toFixed(2)`, not `Math.round`: the catalog's key rounds four adjacent
  // quarter-point bins onto one string and TanStack welds their bars together.
  const rows = bins.map((b) => ({ bin: b.x1.toFixed(2), count: b.count }));

  const chart = glChart({
    marks: [glBinBar(rows, { x: 'bin', y: 'count' })],
    x: glAxisBin({
      label: 'Product Complexity Index (PCI)',
      // One label per whole PCI point; the rest of the edges are ticks only.
      format: (v) => (Math.round(Number(v) * 4) % 4 === 0 ? String(Number(v)) : ''),
    }),
    y: glAxisY({ label: 'Products' }),
  });

  return (
    <GLFigure
      title="Vietnam's basket is left-skewed: a long tail of simple products pulls the mean below the mode."
      subtitle={`Product Complexity Index of the ${products.length} products Vietnam exported in ${LATEST_YEAR}, ${bins.length} bins of 0.25`}
      source={BASKET}
    >
      <Chart {...chart.props} height={240} ariaLabel="Distribution of product complexity in Vietnam's export basket" />
    </GLFigure>
  );
}
// #endregion

// #region demo:spec-15-ecdf
/**
 * The world income distribution, read as "what share sits at or below".
 *
 * An ECDF is a step function and must be drawn as one: the distribution is
 * genuinely flat between observations, so an interpolated line would claim data
 * at values nobody measured. `ecdf` produces one point per economy and
 * `stepPoints` doubles each vertex into a riser and a tread.
 *
 * The x axis is `glAxisLog`, not the catalog's `glAxisX`. Real income per head
 * spans USD 409 to USD 106,502 and is log-normal — on a linear axis half the
 * sample is compressed into the first fourteenth and the staircase is a vertical
 * smear against the y axis. The form survives the swap; the catalog's linear
 * framing does not.
 */
function IncomePerHead() {
  const economies = defined(crossSection(LATEST_YEAR), 'gdpPerCapita');
  const points = stepPoints(
    ecdf(economies.map((d) => d.gdpPerCapita)),
    { x: 'value', y: 'p' },
  );

  const chart = glChart({
    marks: [glLine(points, { x: 'value', y: 'p', focus: true })],
    x: glAxisLog({ label: 'GDP per capita (current USD)' }),
    y: glAxisPercent({ scale: 'fraction', label: 'Share of economies at or below' }),
  });

  return (
    <GLFigure
      title="Half the economies the Atlas ranks produce under $7,300 a head; the top tenth produce seven times that."
      subtitle={`Empirical cumulative distribution of GDP per capita, ${economies.length} economies, ${LATEST_YEAR}`}
      source={withNote(
        sourceOf(countryYearTable),
        `${CROSS_SECTION_NOTE}; one ranked economy has no GDP figure and is dropped`,
      )}
    >
      <Chart {...chart.props} height={240} ariaLabel="Cumulative distribution of GDP per capita" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-15-boxplot
/**
 * Complexity by world region, as five-number summaries.
 *
 * `glBoxplotChart` computes the quantiles from the raw observations, so the
 * summary cannot drift from the data. §11's muted boxes are not a palette
 * shortage: a distribution is context by construction, and the saturated hue is
 * reserved for whatever is being compared against it.
 *
 * The slot order is authored — ascending by median — because `categories` takes
 * a pinned list and nothing derives one. Without it the axis would follow
 * first-appearance order in the panel, which is alphabetical by ISO3 and means
 * nothing.
 *
 * Read this one beside the violin below. Asia's box puts its whiskers through a
 * second, separate cluster of nine economies that five numbers cannot show.
 */
function ComplexityByRegion() {
  const rows = defined(crossSection(LATEST_YEAR), 'eci').map((d) => ({
    ...d,
    region: country(d.iso3)?.region ?? 'Unclassified',
  }));

  const regions = [...new Set(rows.map((d) => d.region))].sort(
    (a, b) =>
      glQuantile(rows.filter((d) => d.region === a).map((d) => d.eci), 0.5) -
      glQuantile(rows.filter((d) => d.region === b).map((d) => d.eci), 0.5),
  );

  const chart = glBoxplotChart(rows, {
    category: 'region',
    value: 'eci',
    categories: regions,
    valueLabel: 'Economic Complexity Index',
    valueFormat: index,
  });

  return (
    <GLFigure
      title="Nine in ten European economies are more complex than the typical economy anywhere else."
      subtitle={`Economic Complexity Index by region, ${rows.length} economies, ${LATEST_YEAR}; box spans the interquartile range, whiskers the 10th and 90th percentiles`}
      source={withNote(PANEL, CROSS_SECTION_NOTE)}
    >
      <Chart {...chart.props} height={300} ariaLabel="Complexity distribution by world region" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-63-violin-distributions
/**
 * The same five groups as density silhouettes.
 *
 * The estimate is trimmed to the observed range rather than run three bandwidths
 * past the ends — `geom_violin`'s `trim = TRUE`, and for the same reason: an
 * untrimmed tail tapers into territory nobody measured, and on a chart that
 * reads as evidence rather than as smoothing.
 *
 * `scale: 'area'` keeps every silhouette holding the same area, so width reads
 * as density rather than as group size. That is the right default and it is also
 * the choice that flatters Oceania, whose three observations get as much ink as
 * Europe's thirty-five — see the gaps.
 *
 * The finding is one the boxplot above cannot state: Asia is bimodal. Nine
 * economies — Afghanistan, Bangladesh, Iraq, Laos, Myanmar, Mongolia,
 * Tajikistan, Turkmenistan and Yemen — sit in a separate low cluster below the
 * density trough at −0.86, and the box renders all nine as whisker length.
 */
function ComplexityDensityByRegion() {
  const rows = defined(crossSection(LATEST_YEAR), 'eci').map((d) => ({
    ...d,
    region: country(d.iso3)?.region ?? 'Unclassified',
  }));

  // Same slot order as the boxplot, so the two figures can be read side by side.
  const regions = [...new Set(rows.map((d) => d.region))].sort(
    (a, b) =>
      glQuantile(rows.filter((d) => d.region === a).map((d) => d.eci), 0.5) -
      glQuantile(rows.filter((d) => d.region === b).map((d) => d.eci), 0.5),
  );

  const chart = glViolinChart(rows, {
    category: 'region',
    value: 'eci',
    categories: regions,
    valueLabel: 'Economic Complexity Index',
    valueFormat: index,
    scale: 'area',
  });

  return (
    <GLFigure
      title="Asia is two distributions, which the boxplot draws as one long whisker."
      subtitle={`Kernel density of the Economic Complexity Index by region, ${rows.length} economies, ${LATEST_YEAR}, equal-area scaling`}
      source={withNote(PANEL, CROSS_SECTION_NOTE)}
    >
      <Chart {...chart.props} height={300} ariaLabel="Complexity density by world region" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-62-ridgeline-density
/**
 * Nine sector densities stacked down the page.
 *
 * A ridgeline trades the violin's symmetry for vertical space, which is the
 * right trade when the *shape* is the finding and the groups have a natural
 * order. The order here is by median PCI, ascending, so the page reads from the
 * simplest sector at the bottom to the most complex at the top — and §12 asks
 * the ramp to carry that ordering, so each ridge takes one step of
 * `glSequentialColor` and darker means more complex.
 *
 * The groups are named on the Y AXIS rather than by labels floating in the plot:
 * §3.5 puts an axis line on both dimensions, and a ridgeline's y axis is
 * otherwise a bare vertical line measuring an offset nobody chose. It costs a
 * 250px left margin here, which is the price of nine real Atlas sector names —
 * see the gaps.
 *
 * The offsets are computed below. That is layout arithmetic, like the beeswarm's
 * dodge and the hexbin lattice, and it never decides what a mark looks like.
 */
function SectorComplexityRidges() {
  const products = defined(leadProducts, 'pci');

  // Sector order is the finding: ascending by median PCI, simplest at the
  // bottom of the page. `glQuantile` is the same estimator the boxplot's median
  // rule uses, so the two figures cannot disagree about where a median is.
  const groups = SECTOR_ORDER.map((sector) => ({
    sector,
    values: products.filter((d) => d.sector === sector).map((d) => d.pci),
  }))
    .filter((g) => g.values.length > 1)
    .sort((a, b) => glQuantile(a.values, 0.5) - glQuantile(b.values, 0.5));

  const ramp = glSequentialColor({ domain: [0, groups.length - 1], steps: groups.length });
  const STEP = 1;

  const curves = groups.map((group, i) => {
    const density = glDensity(group.values, { samples: 64 });
    const peak = Math.max(...density.map((d) => d.density), 1e-9);
    return {
      sector: group.sector,
      rank: i,
      rows: density.map((d) => ({
        value: d.value,
        // Each ridge sits on its own baseline and rises at most 0.85 of the gap
        // to the next, so neighbours stay clear of each other.
        y: i * STEP + (d.density / peak) * STEP * 0.85,
        base: i * STEP,
      })),
    };
  });

  const chart = glChart({
    // Filled, not stroked. A ridge is a silhouette — the same mark a violin
    // uses — and §12's palest ramp step is designed to work as a FILL against
    // paper; as a 2px line it barely reads at all.
    marks: curves.map((curve) =>
      glBand(curve.rows, { x: 'value', y1: 'base', y2: 'y', fill: ramp(curve.rank) }),
    ),
    x: glAxisX({ label: 'Product Complexity Index (PCI)' }),
    y: glAxisY({
      grid: false,
      domain: [-0.1, groups.length * STEP],
      values: groups.map((_, i) => i * STEP),
      format: (v) => groups[Math.round(v)]?.sector ?? '',
    }),
    margin: { left: 250 },
  });

  return (
    <GLFigure
      title="Complexity in Vietnam's basket is a property of the sector: two full PCI points separate minerals from electronics."
      subtitle={`Kernel density of product complexity by sector, ${products.length} products, ${LATEST_YEAR}; sectors ordered by median PCI`}
      source={BASKET}
    >
      <Chart {...chart.props} height={380} ariaLabel="Ridgeline of product complexity by sector" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-52-beeswarm-dodge
/**
 * Every ranked economy, plotted, none of them overlapping.
 *
 * The form's argument over a boxplot is n: the reader can see that the Atlas
 * ranks forty-three economies in Asia and three in Oceania, which five quantiles
 * cannot tell them and which the boxplot two figures up quietly hides.
 *
 * §3.4: the dodge is LAYOUT, so the marks stay ordinary scatter circles — same
 * radius, same 0.8 overlap opacity, same 1px dark stroke. Observations are
 * binned along the value axis and offset within their slot, alternating outward
 * from the centre so each swarm stays symmetric about its column.
 */
function EveryEconomyDodged() {
  /** Value-axis bin the dodge packs into, and the pitch between lanes. */
  const BIN = 0.11;
  const LANE = 0.052;

  const economies = defined(crossSection(LATEST_YEAR), 'eci').map((d) => ({
    ...d,
    region: country(d.iso3)?.region ?? 'Unclassified',
  }));

  // Same slot order as the boxplot and the violin.
  const regions = [...new Set(economies.map((d) => d.region))].sort(
    (a, b) =>
      glQuantile(economies.filter((d) => d.region === a).map((d) => d.eci), 0.5) -
      glQuantile(economies.filter((d) => d.region === b).map((d) => d.eci), 0.5),
  );

  const placed: { region: string; eci: number; x: number }[] = [];
  regions.forEach((region, slot) => {
    const values = economies
      .filter((d) => d.region === region)
      .sort((a, b) => a.eci - b.eci);
    const bins = new Map<number, number>();
    for (const d of values) {
      const bin = Math.round(d.eci / BIN);
      const seen = bins.get(bin) ?? 0;
      bins.set(bin, seen + 1);
      // 0, −1, +1, −2, +2 … so the column grows outward from its centre.
      const lane = Math.ceil(seen / 2) * (seen % 2 === 0 ? 1 : -1);
      placed.push({ region, eci: d.eci, x: slot + lane * LANE });
    }
  });

  const chart = glChart({
    marks: [glPoint(placed, { x: 'x', y: 'eci', tone: 'c-1' })],
    x: glAxisX({
      domain: [-0.55, regions.length - 0.45],
      values: regions.map((_, i) => i),
      format: (v) => regions[v] ?? '',
      nice: false,
    }),
    y: glAxisY({ label: 'Economic Complexity Index' }),
  });

  return (
    <GLFigure
      title="The Atlas ranks forty-three economies in Asia and three in Oceania."
      subtitle={`Every ranked economy shown, dodged within its region slot; ${placed.length} economies, ${LATEST_YEAR}`}
      source={withNote(PANEL, CROSS_SECTION_NOTE)}
    >
      <Chart {...chart.props} height={300} ariaLabel="Beeswarm of complexity by world region" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-18-cumulative-histogram
/**
 * The histogram's cumulative twin — the same binning, read as "at or below".
 *
 * Distance is the Atlas's measure of how far a product sits from what a country
 * already makes well: 0 is next door, 1 is unreachable. Running the bins into a
 * cumulative share turns the question from "how many products are at distance
 * 0.7" into the one a policy reader actually asks — "how much of the basket is
 * within reach at all".
 *
 * §3.5 again: `glAxisBin` so the bars abut, because bins partition a continuum.
 * The edges are authored at 0.01 for the same reason the histogram's are
 * authored at 0.25 — a labelled axis needs edges a reader can name.
 *
 * The bins are keyed on `x2`, their UPPER edge, and that is the one place this
 * demo departs from the catalog plate. A plain histogram bar spans `[x1, x2)`
 * and is properly named by its left edge; a *cumulative* bar reports the share
 * at or below its right edge, so keying it on `x1` labels every bar one bin
 * early. On this data that is the difference between 15% and 19% at 0.70 — see
 * the gaps.
 */
function DistanceCumulative() {
  const products = defined(leadProducts, 'distance');

  // 0.54 through 0.89, one hundredth of distance per bin. The observed range is
  // 0.549–0.882, so nothing falls outside and the last bar reaches 100%.
  const edges = Array.from({ length: 36 }, (_, i) => (540 + i * 10) / 1000);
  const bins = binValues(
    products.map((d) => d.distance),
    { thresholds: edges },
  );

  let running = 0;
  const rows = bins.map((b) => {
    running += b.count;
    return { bin: b.x2.toFixed(2), cumulative: running / products.length };
  });

  const chart = glChart({
    marks: [glBinBar(rows, { x: 'bin', y: 'cumulative' })],
    x: glAxisBin({
      label: "Distance from Vietnam's current capabilities",
      // One label every five hundredths; parsed off the key the bins created.
      format: (v) => (Math.round(Number(v) * 100) % 5 === 0 ? Number(v).toFixed(2) : ''),
    }),
    y: glAxisPercent({ scale: 'fraction', label: 'Share of products at or below' }),
  });

  return (
    <GLFigure
      title="Fewer than one product in six that Vietnam ships is within 0.70 of what it already makes well."
      subtitle={`Cumulative distribution of distance across the ${products.length} products Vietnam exported in ${LATEST_YEAR}, ${bins.length} bins of 0.01`}
      source={BASKET}
    >
      <Chart {...chart.props} height={240} ariaLabel="Cumulative distribution of product distance" />
    </GLFigure>
  );
}
// #endregion

// ════════════════════════════════════════════════════════════════════════════

const demos: Demo[] = [
  {
    id: 'spec-12-histogram',
    family: 'Distributions',
    name: 'Histogram',
    question: 'What does the complexity of Vietnam’s export basket actually look like?',
    rule: '§3.5 — a binned axis has ZERO padding; bins partition a continuum.',
    render: BasketComplexity,
    gaps: [
      '`binValues` returns numeric bin edges and `glAxisBin` takes string categories, so every histogram has to invent a key. The catalog specimen used `String(Math.round(b.x1))`, which is safe on income in dollars and silently wrong here: quarter-point PCI bins round onto the same string, and TanStack welds four bars into one. Keying on `x1.toFixed(2)` fixes it — the gap is that the right key depends on the variable, where a bin-aware axis carrying the edges through would have no such failure mode.',
      'The tick labels are thinned by a modulo test on a string the chart itself created. Two demos in this family alone now write that arithmetic, because `glAxisBin` knows nothing about bin width and there is no `every: n` to ask for.',
    ],
  },
  {
    id: 'spec-15-ecdf',
    family: 'Distributions',
    name: 'Empirical cumulative distribution',
    question: 'How poor is the median economy the Atlas ranks?',
    rule: 'A step curve: the distribution is genuinely flat between observations.',
    render: IncomePerHead,
    gaps: [
      'The catalog specimen puts the value on `glAxisX`. On the real income distribution that is unreadable — USD 409 to USD 106,502, with half the sample inside the first fourteenth of a linear axis — so the x axis here is `glAxisLog`. The form survives the swap; the specimen’s linear framing does not, and nothing in `grammar.md` rules on which axis an ECDF takes.',
      '`ecdf` emits one point per observation and `stepPoints` doubles every vertex, so 145 economies become a 289-point path. That is right at this n and would not be at 1,199 products: there is no decimation helper, so an ECDF of the product table would put 2,397 vertices in the DOM to draw a curve 600px wide.',
    ],
  },
  {
    id: 'ts-15-boxplot',
    family: 'Distributions',
    name: 'Grouped boxplot',
    question: 'Which parts of the world hold the complex economies, and how tightly?',
    rule: '§11 — a distribution is context, so the boxes are muted by construction.',
    render: ComplexityByRegion,
    gaps: [
      'The Atlas’s `region` is five continents and one of them, Oceania, has three ranked economies. `glBoxplotChart` computes p10/q1/median/q3/p90 from those three and draws a box the same width and weight as Asia’s forty-three. §11 has no minimum-n rule, the figure carries no n, and nothing warns the reader. The catalog’s five synthetic groups held 16–41 observations each, which never exposed it.',
      'Slot order is authored here — ascending by median — because `categories` takes a pinned list and nothing derives one. Left to itself the axis follows first-appearance order in the panel, which is alphabetical by ISO3 and means nothing. Three demos in this family now write the same median sort; it belongs beside `stackOrder` in `compose.ts`.',
    ],
  },
  {
    id: 'ts-63-violin-distributions',
    family: 'Distributions',
    name: 'Violin — density instead of five numbers',
    question: 'Is any region actually two distributions wearing one box?',
    rule: 'Trimmed to the observed range: an untrimmed tail reads as evidence.',
    render: ComplexityDensityByRegion,
    gaps: [
      '`scale: \'area\'` normalises every estimate to the same area, so Oceania’s three observations produce a silhouette holding as much ink as Europe’s thirty-five. `scale: \'count\'` is the honest option for groups this uneven and the library has it — but the spec names neither, so which one a figure takes is currently a judgement with no rule behind it.',
      'Silverman’s bandwidth on Oceania’s three points is 0.57, three and a half times Europe’s 0.16. The widest and smoothest curve on the chart is therefore the one with the least evidence behind it, and the silhouette gives the reader no way to see that.',
    ],
  },
  {
    id: 'ts-62-ridgeline-density',
    family: 'Distributions',
    name: 'Ridgeline — densities stacked down the page',
    question: 'Does complexity in Vietnam’s basket belong to the product or to the sector?',
    rule: '§12 — the group ordering is carried by a sequential ramp, not by six hues.',
    render: SectorComplexityRidges,
    gaps: [
      'The curves are spaced rather than overlapped, which gives up the compactness that is a ridgeline’s whole argument. Overlapping them needs a translucent fill, and §3.4 puts every area mark at full opacity — a translucent overlap would read as a new colour wherever two curves cross and would vanish in greyscale. The rule §3.9 uses for nested bands (walk the sequential ramp instead of stacking alpha) is the likely answer, but it is unruled for this form.',
      'The specimen still records "each ridge is a line rather than a filled silhouette" as a gap. It is drawn as a filled silhouette here, and in the gallery plate, because §12’s palest ramp step is designed to work as a fill against paper and reads as almost nothing at 2px. What survives of the original gap is the reason it was written: the fill only works *because* the ridges are spaced, so gap one and this one are the same shortfall seen from two sides.',
      'Nine sectors need nine steps of a ramp authored with five, so `glSequentialColor({ steps: 9 })` interpolates the gaps. Adjacent ridges then differ by a few percent of lightness and the ordering the ramp is supposed to carry is not legible without reading the axis labels — which is precisely what §12 says the ramp is there to avoid.',
      'The ramp orders sectors by median PCI. `SECTOR_ORDER` — the page’s categorical key — fixes Electronics’ hue on the treemap, the stack and the map. On this figure the two cannot both hold: §12 wants the sequential ramp to carry the ordering, §3.1 wants a sector to be one colour everywhere, and nothing rules on which wins.',
      'Nine Atlas sector names on the Y axis need a 250px left margin — "Textiles, garments, footwear and furniture" is 41 characters — which is about a third of the figure width. The tick renderer neither wraps nor truncates, and the sectors table carries no short form to fall back on. The catalog’s five one-word regions never surfaced this.',
    ],
  },
  {
    id: 'ts-52-beeswarm-dodge',
    family: 'Distributions',
    name: 'Beeswarm — every observation, none overlapping',
    question: 'How many economies is each of those boxes actually summarising?',
    rule: '§3.4 — the dodge is layout, so the marks stay ordinary scatter circles.',
    render: EveryEconomyDodged,
    gaps: [
      'The dodge is computed here. It is layout arithmetic rather than styling — the same class of thing as the hexbin lattice and the Marimekko column boundaries — but it is general enough to belong in `compose.ts` beside `binValues`, and three plates in this gallery now roll their own variant of "bin, then offset within the slot".',
      'Both constants are tuned to this variable by hand. On the catalog’s synthetic sample 0.11/0.052 packed cleanly; on the real ECI cross-section the deepest bin holds seven economies, so the swarm reaches three lanes either side of its column centre and the pitch had to be re-checked against the slot width. A helper would take the slot width and the point radius and derive both instead.',
      'Oceania’s three points read as a rendering failure beside Asia’s forty-three. That is the true picture, and telling the reader n is why this form is on the page at all — but nothing in the figure says "three is all there is", so the honest chart and the broken one look alike.',
    ],
  },
  {
    id: 'ts-18-cumulative-histogram',
    family: 'Distributions',
    name: 'Cumulative histogram',
    question: 'How much of what Vietnam ships is anywhere near what it already does well?',
    rule: '§3.5 — a binned axis has ZERO padding; bins partition a continuum.',
    render: DistanceCumulative,
    gaps: [
      'Same bin-key problem as the histogram above, and worse: distance runs 0.549 to 0.882, so the catalog’s `String(Math.round(b.x1))` would collapse all thirty-five bins onto the single key "1" and draw one bar.',
      'The catalog specimen keys its cumulative bars on `x1`, the bin’s lower edge, which is right for a histogram and wrong for a cumulative one: the bar reports the share at or below its UPPER edge, so an `x1` key labels every bar one bin early. Here that is 19% read off the bar labelled 0.70 against a true 15%. This demo keys on `x2` instead. Nothing in the library or the spec makes the distinction — `binValues` hands back both edges and leaves the naming to the caller, so the same silent one-bin lie is available to every cumulative chart on the page. Even keyed correctly the interval stays half-open, so the bar labelled 0.70 is strictly "below 0.70": four products sit exactly on that edge and land in the next bar.',
      'The edges are authored at 0.01 rather than left to Freedman–Diaconis, whose 27 bins land on edges no tick label can name. Choosing bin boundaries is legitimate data preparation; having to choose them so that the axis can be labelled at all is the shortfall.',
    ],
  },
];

export const distributionsFamily: Family = {
  slug: 'distributions',
  title: 'Distributions',
  blurb:
    'The shape of a variable rather than one number from it. Several draw the same 2023 cross-section more than one way on purpose — the boxplot, the violin and the beeswarm tell slightly different stories about Asia and Oceania, and the difference between them is worth seeing.',
  demos,
};

export function renderDistributions(): Record<string, () => ReactNode> {
  return Object.fromEntries(demos.map((d) => [d.id, d.render]));
}
