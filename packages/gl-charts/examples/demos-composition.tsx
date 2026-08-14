/**
 * Stacked and Composition — eight catalog forms, drawn from the Atlas sector
 * and product tables.
 *
 * A composition chart answers "what is this made of", and the Atlas answers it
 * with nine sectors. That number is the pressure running through every plate
 * below, and it is worth stating once:
 *
 * 1. **Nine categories, six hues, three tone steps.** The categorical palette
 *    holds six (§14); `toneRamp` holds three (§8b/§8c). Neither holds nine. Two
 *    plates here take the honest reduction — an ordered three-way split of the
 *    sectors by the median complexity of the products in them, which is a
 *    variable the Atlas publishes rather than one invented to fit the ramp — and
 *    two draw all nine and let the palette wrap, because a page that only ever
 *    showed the workaround would never show the shortfall. The wrap is recorded,
 *    not styled away.
 *
 * 2. **Composition is the one thing the Atlas is unambiguous about.** Sector
 *    shares sum to classified exports by construction, so `offset: 'normalize'`
 *    is telling the truth and the 0–100% axis is earned rather than asserted.
 *    Where a form gives that up — the streamgraph's floating baseline — the
 *    plate says so instead of pretending the axis still means something.
 *
 * 3. **The midpoint has to be real.** Decision Rule 9 allows a diverging ramp
 *    only where the reader can name what the middle is. PCI is standardised so
 *    that zero is the world's average product complexity: that is a genuine
 *    threshold, which is why the Likert form survives the port at all.
 *
 * Contract, unchanged from the gallery: no hex, no font size, no stroke width,
 * no opacity below. Data preparation is authored; appearance never is.
 */

import type { ReactNode } from 'react';
import { Chart } from '@tanstack/react-charts';
import { stack } from '@tanstack/charts';

import {
  endLabels,
  glArea,
  glAxisBand,
  glAxisPercent,
  glAxisPoint,
  glAxisX,
  glAxisY,
  glBar,
  glBarX,
  glChart,
  glDivergingColor,
  glLabel,
  glLine,
  glMutedLine,
  glSequentialColor,
  glTile,
  ink,
  popUp,
  seriesKeyAt,
  stackOrder,
  toneRamp,
  yearAxisFor,
} from '../src/index.js';
import { GLFigure, GLLegend } from '../src/figure.js';

import {
  COHORT,
  FIRST_YEAR,
  LATEST_YEAR,
  LEAD,
  SECTOR_ORDER,
  countryName,
  countrySectorYear,
  countrySectorYearTable,
  countryYearTable,
  defined,
  leadProducts,
  leadProductYearTable,
  leadSectorsIn,
  productNodes,
  productSpaceNodesTable,
  seriesFor,
  sourceOf,
  withNote,
} from './atlas-data.js';
import type { Demo, Family } from './demo.js';

const SECTORS = sourceOf(countrySectorYearTable);
const PANEL = sourceOf(countryYearTable);
const PRODUCTS = sourceOf(leadProductYearTable);
/** Sector shares tiered by the complexity of the products inside them. */
const SECTORS_AND_PCI = sourceOf(countrySectorYearTable, productSpaceNodesTable);

// ════════════════════════════════════════════════════════════════════════════

// #region demo:spec-17-normalized
/**
 * Nine sectors reduced to three ordered tiers, normalized to 100%.
 *
 * The reduction is the whole demo. `toneRamp` holds three categories and the
 * Atlas has nine, so something has to give — and the honest move is to reduce on
 * a variable the Atlas itself publishes rather than to spend six hues on a
 * question with one dimension. Each sector is ranked by the MEDIAN PCI of the
 * products classified into it (from the product space, 1,241 products at HS92
 * 4-digit) and the ranking is cut into three groups of three. The tiers are
 * therefore ordered, which is what §8c's light → main → dark ramp encodes: the
 * lightness itself carries "less complex → more complex", bottom to top.
 *
 * The axis is pinned to 0–100% rather than niced off the data. "The parts sum to
 * the whole" is the one thing this chart exists to say, and here it is true by
 * construction — the sector table excludes only unclassified trade, so the three
 * tiers are exhaustive over classified exports.
 */
function SectorComplexityTiers() {
  const TIERS = ['Least complex three sectors', 'Middle three', 'Most complex three sectors'];

  // Rank the nine sectors by the median complexity of their products, then cut
  // the ranking into thirds. Median rather than mean: PCI has a long tail at
  // both ends and one exotic product should not move a sector's tier.
  const median = (values: readonly number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const ranked = SECTOR_ORDER.map((sector) => ({
    sector,
    pci: median(
      defined(
        productNodes.filter((d) => d.sector === sector),
        'pci',
      ).map((d) => d.pci),
    ),
  })).sort((a, b) => a.pci - b.pci);
  const tierOf = new Map(ranked.map((d, i) => [d.sector, TIERS[Math.floor(i / 3)]]));

  const years = [...new Set(countrySectorYear.filter((d) => d.iso3 === LEAD).map((d) => d.year))].sort(
    (a, b) => a - b,
  );

  // Year-major, tier-minor: TanStack builds a stack in the order it MEETS each
  // series key, so emitting the tiers in ramp order is what puts the lightest
  // tier on the baseline. Sorting the rows afterwards would not do it.
  const rows = years.flatMap((year) => {
    const inYear = defined(
      countrySectorYear.filter((d) => d.iso3 === LEAD && d.year === year),
      'exportValueM',
    );
    return TIERS.map((tier) => ({
      year: String(year),
      tier,
      exports: inYear
        .filter((d) => tierOf.get(d.sector) === tier)
        .reduce((sum, d) => sum + d.exportValueM, 0),
    }));
  });

  const chart = glChart({
    marks: [
      glBar(rows, {
        x: 'year',
        y: 'exports',
        z: 'tier',
        color: 'tier',
        layout: stack({ offset: 'normalize' }),
      }),
    ],
    // Twenty-nine bars, seven labelled. Every year is drawn — the shift is
    // gradual and a snapshot series would hide when it happened — but a tick on
    // each would be unreadable, so the ticks are pinned to the half-decades.
    x: glAxisBand({
      domain: years.map(String),
      values: [1995, 2000, 2005, 2010, 2015, 2020, LATEST_YEAR].map(String),
    }),
    y: glAxisPercent({ scale: 'fraction', label: 'Share of classified goods exports' }),
    color: toneRamp({ tones: 'three', order: TIERS, tone: 'c-1' }),
    variant: { stacked: true },
  });

  return (
    <GLFigure
      title="The three least complex sectors were 93% of Vietnam's exports in 1995 and are 36% now."
      subtitle={`Share of classified goods exports by sector complexity tier, ${FIRST_YEAR}–${LATEST_YEAR}`}
      source={withNote(
        SECTORS_AND_PCI,
        'Tiers are the nine HS92 sectors ranked by the median PCI of their 4-digit products and cut into thirds',
      )}
      // Stacked bands, so the legend goes right and vertical, reversed into the
      // stack's own top-to-bottom order (§3.11). `TIERS` is the BOTTOM-up order
      // the stack is built in, which is the opposite of the order the reader's
      // eye takes down the column.
      legendPlacement="right"
      legend={
        <GLLegend
          items={TIERS.map((tier, i) => ({
            label: tier,
            tone: 'c-1' as const,
            step: (['light', 'main', 'dark'] as const)[i],
          })).reverse()}
        />
      }
    >
      <Chart {...chart.props} height={250} ariaLabel="Vietnam export composition by complexity tier" />
    </GLFigure>
  );
}
// #endregion

// #region demo:spec-18-marimekko
/**
 * Six economies, three complexity tiers, and both axes encoding.
 *
 * Column WIDTH is the economy's share of the cohort's classified exports;
 * segment HEIGHT is that economy's own composition. So the area of a rectangle
 * is the tier's share of the whole region, which is the only reason to prefer a
 * Marimekko to six separate stacks — and it is what makes the Philippines
 * legible as "most complex basket, least of it".
 *
 * The column boundaries are computed here. That is data preparation, not
 * styling, but it is general enough to belong in `compose.ts` — the same gap the
 * synthetic plate recorded, and real data does not change it.
 */
function CohortMarimekko() {
  const TIERS = ['Least complex three sectors', 'Middle three', 'Most complex three sectors'];

  const median = (values: readonly number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const ranked = SECTOR_ORDER.map((sector) => ({
    sector,
    pci: median(
      defined(
        productNodes.filter((d) => d.sector === sector),
        'pci',
      ).map((d) => d.pci),
    ),
  })).sort((a, b) => a.pci - b.pci);
  const tierOf = new Map(ranked.map((d, i) => [d.sector, TIERS[Math.floor(i / 3)]]));

  const columns = COHORT.map((iso) => {
    const rows = defined(
      countrySectorYear.filter((d) => d.iso3 === iso && d.year === LATEST_YEAR),
      'exportValueM',
    );
    return {
      name: countryName(iso),
      total: rows.reduce((sum, d) => sum + d.exportValueM, 0),
      rows,
    };
  }).sort((a, b) => b.total - a.total);
  const cohortTotal = columns.reduce((sum, c) => sum + c.total, 0);

  const tiles: {
    country: string;
    tier: string;
    x1: number;
    x2: number;
    y1: number;
    y2: number;
  }[] = [];
  let x = 0;
  for (const column of columns) {
    const x1 = x;
    const x2 = x + column.total / cohortTotal;
    x = x2;
    let y = 0;
    for (const tier of TIERS) {
      const share =
        column.rows
          .filter((d) => tierOf.get(d.sector) === tier)
          .reduce((sum, d) => sum + d.exportValueM, 0) / column.total;
      tiles.push({ country: column.name, tier, x1, x2, y1: y, y2: y + share });
      y += share;
    }
  }

  const chart = glChart({
    marks: [
      glTile(tiles, { x1: 'x1', x2: 'x2', y1: 'y1', y2: 'y2', color: 'tier' }),
      // One label per column, at the top edge. Taken off the first tier's tiles
      // because there is exactly one of those per column — filtering on the
      // country instead would need a de-duplication pass.
      glLabel(
        tiles.filter((t) => t.tier === TIERS[0]),
        {
          x: (d) => (d.x1 + d.x2) / 2,
          y: () => 1,
          text: (d) => d.country,
          anchor: 'middle',
          dy: -8,
          tone: 'c-1',
        },
      ),
    ],
    x: glAxisX({
      nice: false,
      label: "Share of the six economies' exports",
      format: (v: number) => `${Math.round(v * 100)}%`,
    }),
    y: glAxisPercent({ scale: 'fraction', label: "Share of the economy's exports" }),
    color: toneRamp({ tones: 'three', order: TIERS, tone: 'c-1' }),
    // The column labels sit above the plot frame, so the top margin has to hold
    // a line of text rather than the default 8px of breathing room.
    margin: { top: 24 },
    variant: { labelHalo: true },
  });

  return (
    <GLFigure
      title="The region's most complex export basket belongs to its smallest exporter."
      subtitle={`Classified goods exports by economy and sector complexity tier, ${LATEST_YEAR}; column width is the economy's share of the six`}
      source={withNote(
        SECTORS_AND_PCI,
        'Tiers are the nine HS92 sectors ranked by the median PCI of their 4-digit products and cut into thirds',
      )}
      legendPlacement="right"
      legend={
        <GLLegend
          items={TIERS.map((tier, i) => ({
            label: tier,
            tone: 'c-1' as const,
            step: (['light', 'main', 'dark'] as const)[i],
          })).reverse()}
        />
      }
    >
      <Chart {...chart.props} height={260} ariaLabel="Cohort export composition, Marimekko" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-04-stacked-time-area
/**
 * All nine sectors, stacked, with the palette left to run out.
 *
 * The stack happens INSIDE one mark, through `z`. That is not a style
 * preference: TanStack has no concept of stacking across marks, so one mark per
 * sector would produce nine areas drawn from the baseline on top of each other —
 * no stack, no warning, and a y axis topping out at the largest single sector
 * instead of the total.
 *
 * The reduction the two plates above make is deliberately NOT made here. Nine
 * real categories against a six-hue palette is the constraint this page exists
 * to surface, and the only way to show it is to draw it: sectors seven, eight
 * and nine come back round to c-1, c-2 and c-3, and the legend below says so
 * honestly rather than hiding it. Recorded as a gap.
 *
 * `stackOrder` on `SECTOR_ORDER` fixes both the build order and the tone: a
 * sector's index in the Atlas order decides its hue, so Electronics is the same
 * colour here as on every other plate.
 */
function SectorComposition() {
  const rows = stackOrder(
    defined(
      countrySectorYear.filter((d) => d.iso3 === LEAD),
      'exportValueM',
    ).sort((a, b) => a.year - b.year),
    'sector',
    SECTOR_ORDER,
  );

  const chart = glChart({
    marks: [
      glArea(rows, {
        x: 'year',
        y: 'exportValueM',
        z: 'sector',
        color: 'sector',
        layout: stack(),
      }),
    ],
    x: yearAxisFor(rows, 'year'),
    y: glAxisY({ label: 'Classified goods exports ($m)' }),
  });

  return (
    <GLFigure
      title="Electronics was Vietnam's second-smallest sector in 1995 and its largest by 2023."
      subtitle={`Classified goods exports by HS92 sector, millions of current USD, ${FIRST_YEAR}–${LATEST_YEAR}`}
      source={SECTORS}
      legendPlacement="right"
      legend={
        // `.reverse()` because `SECTOR_ORDER` is the order the stack is BUILT
        // in, which runs bottom-to-top, and §3.11 wants the legend in the order
        // the reader's eye takes down the column. The tone comes from the same
        // index the chart's ordinal colour scale spends, wrap included — a
        // legend that quietly assigned nine distinct tones would be lying about
        // the plot.
        <GLLegend
          items={SECTOR_ORDER.map((sector, i) => ({
            label: sector,
            tone: seriesKeyAt(i),
          })).reverse()}
        />
      }
    >
      <Chart {...chart.props} height={280} ariaLabel="Vietnam export composition by sector" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-21-streamgraph
/**
 * The same nine sectors on a wiggle baseline.
 *
 * Recorded `partial`, and the reason is a rule that does not exist rather than a
 * mark that does not. §3.5 assumes a baseline the reader can measure from; a
 * streamgraph deliberately has none, so every value is read as a THICKNESS,
 * which is the one visual comparison people are measurably bad at. The marks
 * compose — `stack({ offset: 'wiggle' })` and the same `glArea` — but until
 * `grammar.md` rules on when a baseline may be given up, this plate cannot say
 * whether it is on-spec.
 *
 * Real data makes the trade sharper than the synthetic specimen could. Vietnam's
 * classified exports grew seventy-five-fold over the span, so on a common baseline the first
 * fifteen years are a sliver and the composition in them is invisible. The
 * wiggle buys that back and charges the total for it: nothing on this chart can
 * be measured, and the y axis is left blank because its numbers are offsets from
 * a floating centre and mean nothing to a reader.
 */
function SectorStream() {
  const rows = stackOrder(
    defined(
      countrySectorYear.filter((d) => d.iso3 === LEAD),
      'exportValueM',
    ).sort((a, b) => a.year - b.year),
    'sector',
    SECTOR_ORDER,
  );

  const chart = glChart({
    marks: [
      glArea(rows, {
        x: 'year',
        y: 'exportValueM',
        z: 'sector',
        color: 'sector',
        layout: stack({ offset: 'wiggle' }),
      }),
    ],
    x: yearAxisFor(rows, 'year'),
    y: glAxisY({ grid: false, format: () => '' }),
  });

  return (
    <GLFigure
      title="Two sectors that were rounding errors in 1995 are now half of everything Vietnam exports."
      subtitle={`Classified goods exports by HS92 sector on a wiggle baseline, ${FIRST_YEAR}–${LATEST_YEAR}; thickness is value, but no scale is readable`}
      source={withNote(SECTORS, 'The vertical scale is suppressed: a wiggle baseline has no origin')}
      legendPlacement="right"
      legend={
        <GLLegend
          items={SECTOR_ORDER.map((sector, i) => ({
            label: sector,
            tone: seriesKeyAt(i),
          })).reverse()}
        />
      }
    >
      <Chart {...chart.props} height={280} ariaLabel="Vietnam export composition, streamgraph" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-70-composed-chart
/**
 * Two encodings, two units, one plot.
 *
 * The rule that decides this plate is which series gets the saturated hue. Bars
 * and a line on one frame is a chart with two subjects, and §3.1 does not allow
 * two findings; so the bars are the context and take `c-1-light`, and the line
 * carries the finding at `c-1` 2.4px. Two full-strength hues here would make the
 * reader choose which chart they were looking at.
 *
 * Recorded `partial`: dollars and an index are genuinely different units and
 * `glChart` has one y axis, so the export bars are rescaled onto the ECI scale
 * by this plate and the subtitle says so. The reader can compare the two shapes
 * and not their magnitudes.
 */
function ExportsAndComplexity() {
  const series = defined(defined(seriesFor(LEAD), 'exportValueM'), 'eci');
  const maxExports = Math.max(...series.map((d) => d.exportValueM));
  const maxEci = Math.max(...series.map((d) => d.eci));

  const rows = series.map((d) => ({
    year: String(d.year),
    eci: d.eci,
    // The rescale, done in the plate and disclosed in the subtitle. It is a
    // proportional map onto the other series' TOP value, so the two lines
    // coincide at their maxima and nowhere else — which is the honest reading of
    // "these have the same shape", and the only one available without a second
    // axis.
    scaled: (d.exportValueM / maxExports) * maxEci,
  }));

  const chart = glChart({
    marks: [
      glBar(rows, { x: 'year', y: 'scaled', tone: 'c-1', step: 'light' }),
      glLine(rows, { x: 'year', y: 'eci', tone: 'c-1', focus: true }),
    ],
    x: glAxisBand({
      domain: rows.map((d) => d.year),
      values: [1995, 2000, 2005, 2010, 2015, 2020, LATEST_YEAR].map(String),
    }),
    y: glAxisY({ label: 'Economic Complexity Index' }),
  });

  return (
    <GLFigure
      title="Vietnam's exports grew seventy-five-fold; its complexity gained a point and a half."
      subtitle={`Economic Complexity Index (line) over total goods exports (bars, rescaled to the index axis), ${FIRST_YEAR}–${LATEST_YEAR}`}
      source={withNote(PANEL, 'Export bars carry no scale of their own; they are rescaled to the index')}
      // Two encodings, so two DIFFERENT legend marks — the whole point of §3.11
      // on a composed chart. The subtitle spells out "(line)" and "(bars)" in
      // words; two identical squares would contradict it.
      legend={
        <GLLegend
          items={[
            { label: 'Total exports (rescaled)', tone: 'c-1', step: 'light' },
            { label: 'Economic Complexity Index', tone: 'c-1', mark: 'line', focus: true },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={250} ariaLabel="Vietnam complexity over exports" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-26-diverging-likert
/**
 * The Likert form, on the one Atlas variable that genuinely has a midpoint.
 *
 * Decision Rule 9 allows a diverging scale only where the reference point is
 * real, and PCI supplies one: it is standardised so that **zero is the average
 * complexity of world trade**. So "how much of this sector's exports are more
 * complex than the world average, and how much less" is a diverging question by
 * construction, in exactly the way a Likert scale's agree/disagree boundary is.
 * The nine sectors are the statements; the four PCI bands are the responses.
 *
 * Stack order is INSIDE-OUT from the zero line, not left-to-right along the
 * scale. `offset: 'diverging'` lays each side out in list order starting at
 * zero, so the mild bands have to come first or the chart reads backwards —
 * intensity would decrease outward, which is the opposite of what the scale
 * means.
 */
function ComplexityBands() {
  // Each band carries the MIDPOINT of its PCI range as its colour value, not an
  // ordinal rank. That matters: `glDivergingColor` bins by value, and the four
  // midpoints fall in four different bins where the ranks −2/−1/1/2 do not.
  const BANDS = [
    { label: 'Well below average (PCI under −1)', mid: -1.5, lo: -Infinity, hi: -1 },
    { label: 'Below average (−1 to 0)', mid: -0.5, lo: -1, hi: 0 },
    { label: 'Above average (0 to 1)', mid: 0.5, lo: 0, hi: 1 },
    { label: 'Well above average (PCI over 1)', mid: 1.5, lo: 1, hi: Infinity },
  ];
  // Mild bands first on each side, so the stack builds outward from zero.
  const order = [BANDS[1], BANDS[0], BANDS[2], BANDS[3]].map((b) => b.label);

  const products = defined(defined(leadProducts, 'pci'), 'exportValueM');

  const rows = SECTOR_ORDER.flatMap((sector) => {
    const own = products.filter((d) => d.sector === sector);
    const total = own.reduce((sum, d) => sum + d.exportValueM, 0);
    if (total === 0) return [];
    return BANDS.map((band) => ({
      sector,
      band: band.label,
      mid: band.mid,
      // Signed, because `offset: 'diverging'` reads the SIGN to decide which
      // wing a segment belongs to. The sign is a position, not a value — the
      // axis formatter takes the absolute value back off.
      share:
        (Math.sign(band.mid) *
          own
            .filter((d) => d.pci >= band.lo && d.pci < band.hi)
            .reduce((sum, d) => sum + d.exportValueM, 0)) /
        total,
    }));
  }).sort((a, b) => order.indexOf(a.band) - order.indexOf(b.band));

  // Most complex sector at the top of the band axis: the reader is being asked
  // to compare where each sector's mass falls, and an alphabetical or Atlas
  // ordering would leave that to be reconstructed row by row.
  const netAbove = (sector: string) =>
    rows.filter((d) => d.sector === sector).reduce((sum, d) => sum + d.share, 0);
  const sectors = [...new Set(rows.map((d) => d.sector))].sort((a, b) => netAbove(b) - netAbove(a));

  const ramp = glDivergingColor({ domain: [-2, 2], steps: 4 });

  const chart = glChart({
    marks: [
      glBarX(rows, {
        y: 'sector',
        x: 'share',
        z: 'band',
        color: 'mid',
        layout: stack({ offset: 'diverging', order }),
      }),
    ],
    x: glAxisPercent({
      scale: 'fraction',
      label: `Share of the sector's ${LATEST_YEAR} export value`,
      domain: [-1, 1],
      values: [-1, -0.5, 0, 0.5, 1],
      format: (v: number) => `${Math.abs(Math.round(v * 100))}%`,
    }),
    y: glAxisBand({ domain: sectors }),
    color: { scale: ramp },
    variant: { stacked: true, zeroBaseline: true },
    // Sized by hand to clear "Textiles, garments, footwear and furniture" at the
    // 12px floor. Recorded as a gap: no preset measures a band axis's own labels.
    margin: { left: 290 },
  });

  return (
    <GLFigure
      title="Vietnam's two largest sectors sit on opposite sides of the world's average product."
      subtitle={`Share of each sector's export value by Product Complexity Index band, HS92 4-digit, ${LATEST_YEAR}; zero is the average complexity of world trade`}
      source={PRODUCTS}
      // Squares, below the plot: the bands stack HORIZONTALLY here, so a
      // right-hand column would have no vertical order to mirror, and reading
      // the row left-to-right is already the scale's own order (§3.11).
      //
      // Marks come from the RAMP, and the label takes `ink-2` rather than a
      // series dark tone. A ramp step is not a series colour — there is no
      // "this mark's dark tone" to reach for. Spending c-1/c-2's light and main
      // instead would put four tones against four DIFFERENT fills and the legend
      // would stop matching the chart.
      legend={
        <GLLegend
          items={BANDS.map((band) => {
            const fill = ramp(band.mid);
            return { label: band.label, tone: { light: fill, main: fill, dark: ink[2] } };
          })}
        />
      }
    >
      <Chart {...chart.props} height={280} ariaLabel="Vietnam export value by product complexity band" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-27-parallel-coordinates
/**
 * Six economies across five dimensions in five different unit systems.
 *
 * Normalizing each dimension to its own observed range is what makes the form
 * correct, and it happens here because it is data preparation. The `popUp`
 * treatment then does the rest: six polylines in six hues is a plate of
 * spaghetti, and the point of the chart is one profile read against the field.
 *
 * The range is the COHORT's, not the world's. Against all 146 ranked economies
 * these six would sit in a narrow band near the top and the chart would say
 * nothing; against each other, the trade-offs are the whole picture.
 *
 * Recorded `partial`: each dimension wants its own tick labels in its own units
 * and a GL chart has one y axis. The dimension names are on the categorical x
 * axis and the values are unlabelled, so the reader gets the shape and not the
 * magnitudes — which the subtitle says.
 */
function CohortProfiles() {
  const latest = COHORT.map((iso) => seriesFor(iso).find((d) => d.year === LATEST_YEAR)!);
  const DIMENSIONS: { name: string; of: (d: (typeof latest)[number]) => number | null }[] = [
    { name: 'Complexity (ECI)', of: (d) => d.eci },
    { name: 'Opportunity (COI)', of: (d) => d.coi },
    { name: 'Diversity', of: (d) => d.diversity },
    { name: 'GDP per capita', of: (d) => d.gdpPerCapita },
    { name: 'Total exports', of: (d) => d.exportValueM },
  ];

  const rows = DIMENSIONS.flatMap((dimension) => {
    const observed = latest
      .map((d) => dimension.of(d))
      .filter((v): v is number => v != null);
    const lo = Math.min(...observed);
    const hi = Math.max(...observed);
    return latest.flatMap((d) => {
      const value = dimension.of(d);
      // A country missing one dimension drops that vertex rather than the whole
      // polyline: the path breaks and the reader sees which measure is absent.
      if (value == null) return [];
      return [
        {
          country: countryName(d.iso3),
          dimension: dimension.name,
          normalized: hi === lo ? 0.5 : (value - lo) / (hi - lo),
        },
      ];
    });
  });

  const { backdrop, focus } = popUp(rows, {
    by: 'country',
    highlight: [countryName('KOR'), countryName('VNM')],
  });

  const chart = glChart({
    marks: [
      glMutedLine(backdrop, { x: 'dimension', y: 'normalized', z: 'country' }),
      ...focus.map((s) =>
        glLine(s.rows, { x: 'dimension', y: 'normalized', z: 'country', tone: s.tone, focus: true }),
      ),
      ...endLabels(focus, { x: 'dimension', y: 'normalized' }),
    ],
    x: glAxisPoint({ domain: DIMENSIONS.map((d) => d.name) }),
    y: glAxisPercent({ scale: 'fraction', label: 'Position within the cohort range' }),
    endLabels: true,
  });

  return (
    <GLFigure
      title="Vietnam has more complexity opportunity left than Korea, on an eighth of the income."
      subtitle={`Six Southeast Asian economies across five measures, ${LATEST_YEAR}, each rescaled to the range observed within the six`}
      source={PANEL}
    >
      <Chart {...chart.props} height={260} ariaLabel="Cohort profiles across five dimensions" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-41-waffle-unit-chart
/**
 * One hundred squares, one per percentage point of Vietnam's export basket.
 *
 * The argument for a waffle over a pie is that it replaces an angle judgment
 * with a counting one, and people count reliably. Ten by ten is the grid that
 * makes the count trivial.
 *
 * Cells are `glTile` on two pinned continuous axes, which is the same treatment
 * a heatmap gets and for the same reason: a waffle tiles the plane, so §3.4's
 * full opacity applies and the scatter's 0.8 would only dilute it.
 */
function BasketWaffle() {
  // FIVE groups, not nine, and the reason is the ramp rather than taste.
  // `glSequentialColor` resamples the authored five steps to whatever count it
  // is asked for, and a count the tokens do not enumerate INTERPOLATES between
  // them — producing fills that are off-palette by construction. The spec names
  // five- and six-step ramps, so a waffle either fits in one or is the wrong
  // chart. Four sectors and a residual is the fit.
  const shares = (() => {
    const rows = defined(leadSectorsIn(LATEST_YEAR), 'exportValueM');
    const total = rows.reduce((sum, d) => sum + d.exportValueM, 0);
    return rows
      .map((d) => ({ label: d.sector, share: d.exportValueM / total }))
      .sort((a, b) => b.share - a.share);
  })();
  const groups = [
    ...shares.slice(0, 4),
    { label: 'Everything else', share: shares.slice(4).reduce((sum, d) => sum + d.share, 0) },
  ];

  const cells: { col: number; row: number; label: string }[] = [];
  let filled = 0;
  for (const group of groups) {
    const units = Math.round(group.share * 100);
    for (let i = 0; i < units && filled < 100; i += 1, filled += 1) {
      cells.push({ col: filled % 10, row: Math.floor(filled / 10), label: group.label });
    }
  }
  // Rounding rarely lands on exactly 100. The remainder joins the residual
  // rather than becoming a sixth group — it is the same claim ("not one of the
  // four") and a sixth would put the ramp back into interpolation.
  while (filled < 100) {
    cells.push({ col: filled % 10, row: Math.floor(filled / 10), label: 'Everything else' });
    filled += 1;
  }

  // `order` runs largest share first, and a sequential ramp runs pale to dark,
  // so the channel has to be the REVERSED rank. Feeding `indexOf` straight in
  // paints the biggest sector the palest tile and the residual the darkest —
  // backwards against grammar.md §1 ("Darker = higher value") and against §3.11,
  // which puts a muted "everything else" last rather than loudest. The residual
  // stays last in `order` whatever its share, so it takes the palest step.
  const order = groups.map((d) => d.label);
  const rank = (label: string) => order.length - 1 - order.indexOf(label);
  const ramp = glSequentialColor({ domain: [0, order.length - 1], steps: order.length });

  const chart = glChart({
    marks: [
      glTile(cells, {
        x1: (d) => d.col,
        x2: (d) => d.col + 0.88,
        y1: (d) => d.row,
        y2: (d) => d.row + 0.88,
        // The groups are ORDERED by share, so the channel is that rank and the
        // scale is sequential. A categorical palette here would claim five
        // unrelated subjects where there is one ordered variable.
        color: (d) => rank(d.label),
      }),
    ],
    // `axis: false` keeps the scale and drops the visible axis. A waffle's
    // coordinates are grid positions, not quantities — "column 7" is not a value
    // anyone reads off a scale — so an axis line here would be a frame
    // pretending to be a measurement.
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
      title="Two sectors take fifty-five of the hundred squares."
      subtitle={`Vietnam's classified goods exports by HS92 sector, ${LATEST_YEAR}, one square per percentage point`}
      source={SECTORS}
      legend={
        // The marks come from the RAMP the cells are painted with, resolved per
        // step. Spending `c-1`'s light/main/dark instead — the obvious shortcut
        // — puts three tones against five fills and the legend stops matching
        // the chart, which is worse than having no legend.
        <GLLegend
          // `rank`, not the array index — the same reversal the cells use, so
          // the swatch and the tile it stands for cannot drift apart.
          items={groups.map((d) => {
            const fill = ramp(rank(d.label));
            return { label: d.label, tone: { light: fill, main: fill, dark: ink[2] } };
          })}
        />
      }
    >
      <Chart {...chart.props} height={280} ariaLabel="Vietnam export composition waffle" />
    </GLFigure>
  );
}
// #endregion

// ════════════════════════════════════════════════════════════════════════════

const demos: Demo[] = [
  {
    id: 'spec-17-normalized',
    family: 'Stacked and Composition',
    name: 'Normalized 100% stacked bars',
    question: 'How fast did Vietnam’s exports move up the complexity ladder?',
    rule: 'The parts sum to the whole, so the axis is pinned to 0–100%.',
    render: SectorComplexityTiers,
    gaps: [
      'The three tiers are built here, in the demo, because `toneRamp` holds three categories and the Atlas has nine. Ranking sectors by the median PCI of their products and cutting the ranking into thirds is a defensible reduction, but it is a reduction this file invented: nothing in `compose.ts` turns an N-category composition into an ordered K-tier one, so every caller who hits the same wall will invent their own and two GL charts of the same data can disagree about what "high complexity" means.',
      'The band axis carries twenty-nine years and seven pinned tick values. `glAxisBand` accepts `values`, so the labels are right, but nothing checks that a pinned value is IN the domain — a typo would silently drop a tick rather than fail.',
    ],
  },
  {
    id: 'spec-18-marimekko',
    family: 'Stacked and Composition',
    name: 'Marimekko — width and height both encode',
    question: 'Which Southeast Asian economy exports the most complex basket, and how big is it?',
    rule: '§3.5 — both axes are binned, so segments abut on both.',
    render: CohortMarimekko,
    gaps: [
      'Column widths are computed by the plate. Nothing in compose.ts turns a two-level share table into paired intervals the way `waterfall` does for a signed sequence.',
      'The Philippines is 4% of the cohort’s exports, so its column is roughly 20px wide and the label "Philippines" is five times that. `glLabel` has no width awareness and no dodge pass, so the name runs across its neighbour. The synthetic specimen’s five markets were 15–25% each and never produced a column too narrow to name; a real size distribution does it immediately. §3.5 would drop a label that does not fit at the 12px floor rather than shrink it, and there is no mechanism here to do either.',
      'A Marimekko is two nested compositions and the y axis can only label one of them. The percentages down the left are shares of each COLUMN, so the same tick means a different absolute quantity in every column — correct, and impossible to state on the axis itself. It is in the subtitle instead, which is the plate compensating for a missing axis idiom.',
      '`sourceOf` derives the year scope from the cited TABLES, not from the rows the chart read, so this cross-section of 2023 is provenanced "1995–2023". It is the first thing on the page to be a cross-section of a panel; the Lines family never hit it because every one of its demos drew the whole span. The same over-claim appears on the parallel-coordinates and waffle plates below. It also takes the level off the first table that has one, so citing the sector table (1-digit) alongside the product space (4-digit) prints "HS92 1-digit" for a chart whose tiers came from 4-digit complexity — the note says so, but the scope clause does not.',
    ],
  },
  {
    id: 'ts-04-stacked-time-area',
    family: 'Stacked and Composition',
    name: 'Stacked area over time',
    question: 'What did Vietnam stop exporting, and what replaced it?',
    rule: 'A stack happens INSIDE one mark, through z — there is no stacking across marks.',
    render: SectorComposition,
    gaps: [
      'Nine sectors against a six-hue palette. TanStack’s ordinal colour scale wraps with `range[index % range.length]`, so Transport vehicles, Machinery and Electronics — the top three bands, and the three the finding is about — are painted c-1, c-2 and c-3 again, identical to Textiles, Vegetables and Stone below them. Nothing warns: `series()` documents the wrap in a doc comment and `popUp` warns when more than two series are highlighted, but the colour scale itself is silent. The synthetic specimen had five sectors and never reached the boundary. Recorded rather than worked around, because the reduction is available (see the two plates above) and the point is that the library lets you not take it.',
      'Every band is unreadably thin for the first fifteen years — Vietnam’s classified exports grew seventy-five-fold, so the whole of 1995 is 1.5% of the plot height and no composition is legible before about 2005. A stacked area on a series with that much growth cannot show early composition, which is the argument for the streamgraph and for the normalized stack above, and is not something any option on `glArea` can fix.',
    ],
  },
  {
    id: 'ts-21-streamgraph',
    family: 'Stacked and Composition',
    name: 'Streamgraph — a baseline-free stack',
    question: 'How did the shape of Vietnam’s export basket turn over?',
    rule: 'Unruled: §3.5 assumes a baseline the reader can measure from.',
    render: SectorStream,
    gaps: [
      'The marks compose and the plate renders, but `grammar.md` has no ruling on when a baseline may be given up. Every value on a wiggle baseline is read as a THICKNESS, which is the one visual comparison people are measurably bad at, and §3.5 has nothing to say for or against that trade. Until it does, this plate cannot claim to be on-spec — only to be drawable.',
      'The y axis is left unlabelled because its numbers are offsets from a floating centre and mean nothing to a reader. That is the plate deciding something the library should: an axis preset for a baseline-free stack would suppress the scale rather than leave every caller to blank it.',
      'Suppressing the scale is done with `format: () => \'\'`, which draws the ticks and labels them with nothing. The tick stubs are still there. There is no way to ask an axis preset for a line with no ticks at all, so the plate produces marks it does not want and cannot remove.',
      'Same nine-sector palette wrap as the stacked area, and worse here: on a wiggle baseline the bands are not in a fixed vertical order, so two bands with the same hue can end up adjacent.',
    ],
  },
  {
    id: 'ts-70-composed-chart',
    family: 'Stacked and Composition',
    name: 'Bars and a line in one frame',
    question: 'Did Vietnam’s complexity keep up with the size of its export boom?',
    rule: '§3.1 — two encodings, one finding: the bars take the light tone, the line the hue.',
    render: ExportsAndComplexity,
    gaps: [
      'The two series are on genuinely different units and `glChart` has one y axis, so the export bars are rescaled onto the complexity scale by the plate and the subtitle says so. A second axis is a real feature — it needs a ruling first, because a dual axis lets an author manufacture any correlation they want by choosing the two ranges, which is why most house styles ban it outright.',
      'The shared zero means two different things. Zero exports is a real quantity and the bars are correctly measured from it; ECI zero is the world average and nothing is measured from it, so the line crossing the baseline in 2009 looks like an event and is only a coincidence of the axis. `variant.zeroBaseline` is therefore off — but there is no way to say "this baseline is real for one mark and not the other", which is the same missing ruling as the second axis.',
      'The catalog specimen is twelve monthly observations. The Atlas is annual, so this is twenty-nine yearly bars: the form is exercised, the seasonal reading it was designed for is not, and the point markers the specimen carries were dropped because twenty-nine 12px dots on one line merge into a stripe.',
    ],
  },
  {
    id: 'ts-26-diverging-likert',
    family: 'Stacked and Composition',
    name: 'Diverging Likert responses',
    question: 'How much of each Vietnamese sector is more complex than the average world product?',
    rule: 'Decision Rule 9 — a diverging ramp needs a midpoint that MEANS something.',
    render: ComplexityBands,
    gaps: [
      '`glDivergingColor` bins by VALUE, and the ordinal ranks the synthetic Likert specimen uses collapse: with `domain: [-2, 2]` and `steps: 4` the cut points are −1, 0 and 1, so the values −2 and −1 land in different bins but 1 and 2 both land in the last one and the two positive responses come out the same fill. This demo passes the four bands’ PCI midpoints (−1.5, −0.5, 0.5, 1.5) instead, which is more honest anyway — the channel is the actual variable. But the failure is silent: nothing warns that two domain values collapsed onto one colour, and a caller reading the specimen would reproduce it.',
      'The left margin is 290px, chosen by hand to clear "Textiles, garments, footwear and furniture" at the 12px text floor. Nothing measures a band axis’s labels: `glMargin` is a constant and `glAxisBand` never sees a font metric, so every horizontal chart with real category names guesses. Guessing low clips the names; guessing high — as here — costs the plot about 40% of its width, which is why the 100% bars look short.',
      'Nine bars, nine sector names, and no way to say which sectors matter. Electronics is 34% of the basket and Stone, glass and ceramics is 1%, but every row is the same height because a Likert chart normalizes each statement — correct for a survey where every respondent counts once, and misleading here, where the rows carry wildly different weight. A `weight` channel on the band scale (a Marimekko’s row equivalent) would fix it and does not exist.',
    ],
  },
  {
    id: 'ts-27-parallel-coordinates',
    family: 'Stacked and Composition',
    name: 'Parallel coordinates',
    question: 'What does Vietnam have that Korea does not, and the other way round?',
    rule: '§3.1 — six polylines in six hues is spaghetti; one profile against a field is not.',
    render: CohortProfiles,
    gaps: [
      'Each dimension wants its own tick labels in its own units, and a GL chart has one y axis. The dimension names are on the categorical x axis and the values are unlabelled, so the reader gets the shape and not the magnitudes. A per-dimension axis stack is the missing piece and it is the same shortfall the marginal-histogram plate records — no linked-panel or multi-scale layout exists.',
      '`endLabels` puts each label at the series’ largest x, and it finds that with `lastByX`, which coerces the channel through `Number()`. On this chart x is a dimension NAME, so every comparison is `NaN > NaN`, the reduce keeps the first row, and both country labels land on the leftmost axis instead of the rightmost — while `endLabels: true` widens the RIGHT margin to hold labels that are not there. It is invisible on every specimen because every other user of `endLabels` has a numeric or date x. A categorical x needs the label placed at the last domain position, which `lastByX` has no way to know.',
      'Normalizing to the cohort’s own range makes at least one economy sit exactly on 0 and one exactly on 1 in every dimension, so two of the six polylines are always clipped to the plot edges. That is arithmetically correct and reads as data running off the chart. `glAxisPercent` pins 0–1 by design, which is right for a share and wrong for a rescaled position, and there is no preset for "normalized with headroom".',
    ],
  },
  {
    id: 'ts-41-waffle-unit-chart',
    family: 'Stacked and Composition',
    name: 'Waffle — one square per percentage point',
    question: 'What does one hundred dollars of Vietnamese exports consist of?',
    rule: '§3.4 — a unit square tiles the plane, so it is a TILE at full opacity.',
    render: BasketWaffle,
    gaps: [
      '`axis: false` is spread onto the axis object by hand, after the preset built it, because `GLAxisPreset` has no way to say "keep the scale, drop the visible axis". A waffle needs exactly that — its coordinates are grid positions, not quantities — and so does the tidy tree. Both plates reach around the preset the same way.',
      'The legend does not fit on one row. §3.11 says that means the chart has too many series, but four of the five entries are Atlas sector names and one of them is 41 characters — the chart has five categories, which is the right number, and the LABELS are the problem. Nothing in the system shortens or wraps a legend label, so the row runs past the figure or breaks where the browser decides.',
      'The four sector shares round to 34, 21, 16 and 13, which with a 16-square residual sums to exactly 100 — luck, not arithmetic. `Math.round` per group can total 99 or 101 and the plate patches the shortfall into the residual and truncates the overflow at 100. A largest-remainder allocation belongs in `compose.ts` next to `binValues`; every waffle will otherwise write its own.',
    ],
  },
];

export const compositionFamily: Family = {
  slug: 'stacked-and-composition',
  title: 'Stacked and Composition',
  blurb:
    'What a whole is made of, and how the mix changed. The Atlas classifies trade into nine sectors, which is more bands than any stack reads comfortably, so these charts either group first or lean on order and labelling to stay legible.',
  demos,
};

export function renderComposition(): Record<string, () => ReactNode> {
  return Object.fromEntries(demos.map((d) => [d.id, d.render]));
}
