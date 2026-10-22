/**
 * Facets and Multiple Views — three figures that put more than one plot on the
 * page, and the two different reasons a figure does that.
 *
 * The family splits cleanly in two, and the split is worth naming because it is
 * also the split between what `gl-charts` can do and what it cannot:
 *
 * 1. **One spec, many cells.** A faceted histogram and a faceted scatter are the
 *    *same chart* drawn once per group. TanStack's `facet` mark expresses that
 *    directly: it takes a `by` channel and a spec-returning callback, splits the
 *    data, and — this is the load-bearing part — resolves the axes ACROSS the
 *    cells rather than inside them. Panels on private scales are four pictures;
 *    panels on one scale are one comparison. Both demos below lean on that.
 *
 * 2. **Many specs, one pair of scales.** A joint plot with its two marginals is
 *    three *different* specs that have to agree about two domains. `facet`
 *    cannot express it, and nothing else in the library can either, so the third
 *    demo pins the domains by hand on three charts and places the panels with a
 *    CSS class this page does not ship. It comes out wrong on purpose. That is
 *    the recorded gap, and it is the most useful thing in this file.
 *
 * What real Atlas data adds to the specimen's own findings:
 *
 * - **Nine facets, not five, with names that do not fit.** `facet` centres each
 *   cell title at 11px and never truncates it. "Textiles, garments, footwear and
 *   furniture" is wider than the cell it titles. The synthetic specimen's
 *   groups were called "Europe" and "Asia".
 * - **Anscombe's quartet is synthetic by construction.** Four datasets with
 *   identical summary statistics do not occur; they were solved for. The Atlas
 *   cannot supply them and this page will not fabricate them, so the demo keeps
 *   the *rule* — every panel on the same two scales — and drops the conceit.
 *
 * Contract, unchanged: no hex, no font size, no stroke width, no opacity below.
 * Data preparation is authored; appearance never is.
 */

import type { ReactNode } from 'react';
import { Chart } from '@tanstack/react-charts';
import { facet } from '@tanstack/charts';

import {
  binValues,
  glAxisBin,
  glAxisLog,
  glAxisX,
  glAxisY,
  glBinBar,
  glBinBarX,
  glChart,
  glMutedLine,
  glPoint,
  linearFit,
} from '../src/index.js';
import { GLFigure } from '../src/figure.js';

import {
  LATEST_YEAR,
  countries,
  countriesTable,
  countryYearTable,
  crossSection,
  defined,
  leadProductYearTable,
  leadProducts,
  productNodes,
  productSpaceNodesTable,
  sourceOf,
  withNote,
} from './atlas-data.js';
import type { Demo, Family } from './demo.js';

const BASKET = sourceOf(leadProductYearTable);
const PANEL_AND_CATALOG = sourceOf(countryYearTable, countriesTable);
const NODES = sourceOf(productSpaceNodesTable);

/**
 * Equal-width bin edges over an interval, inclusive of both ends.
 *
 * Two of the three demos need bins that are *pinned* rather than inferred, for
 * two different reasons, so the arithmetic is shared:
 *
 *   - A faceted histogram needs every cell to emit the same bins, including the
 *     empty ones, or `facet` sees a different band domain per cell and refuses
 *     to share an outer axis. `binValues` with explicit `thresholds` always
 *     returns one bin per interval, count zero or not.
 *   - A marginal histogram needs its bins to span exactly the joint plot's
 *     domain, or the two panels stop lining up at the edges.
 */
const edgesOver = ([lo, hi]: readonly [number, number], count: number): number[] =>
  Array.from({ length: count + 1 }, (_, i) => lo + ((hi - lo) * i) / count);

// ════════════════════════════════════════════════════════════════════════════

// #region demo:ts-51-faceted-distributions
/**
 * One histogram per sector, on shared bins and a shared count axis.
 *
 * §3.5: panels are only comparable on a shared scale, and `facet` resolves the
 * scale across cells rather than inside them. That is doing real work here.
 * `demos-distributions` draws this same table as a ridgeline, and a ridgeline
 * scales every density to equal area — so it can show that minerals sit two PCI
 * points below electronics and it *cannot* show that Vietnam ships 271
 * agricultural and wood products against 32 vehicles. A shared count axis shows
 * both at once, and the price is that the small sectors get short bars.
 *
 * Two pieces of preparation carry the chart:
 *
 * 1. **The bins are pinned, not inferred.** `binValues` defaults to a
 *    Freedman–Diaconis estimate computed per call, which would give each cell a
 *    different number of bins with different edges — nine incomparable
 *    histograms wearing a shared axis. Explicit thresholds every 0.25 PCI make
 *    every cell emit the same fourteen bins in the same order, which is also
 *    what lets `facet` share an outer axis at all: it compares the resolved cell
 *    scales and throws if they disagree.
 * 2. **The panel order is by median PCI**, matching the ridgeline in
 *    `demos-distributions` so the two figures can be read against each other.
 *    `facet` groups in the order it meets each key, so ordering the panels means
 *    ordering the rows.
 */
function BasketBySector() {
  const products = defined(leadProducts, 'pci');

  // 0.5 PCI per bin, from below the least complex product Vietnam ships to above
  // the most complex. Fixed rather than derived: bins that move with the data
  // would make this figure and the next release's incomparable.
  const PCI_BINS = edgesOver([-4.5, 2.5], 14);

  const median = (values: readonly number[]): number =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

  const medianBySector = new Map<string, number>();
  for (const sector of new Set(products.map((d) => d.sector))) {
    medianBySector.set(
      sector,
      median(products.filter((d) => d.sector === sector).map((d) => d.pci)),
    );
  }

  const rows = [...products].sort(
    (a, b) => (medianBySector.get(a.sector) ?? 0) - (medianBySector.get(b.sector) ?? 0),
  );

  const chart = glChart({
    marks: [
      facet(rows, {
        by: 'sector',
        columns: 3,
        gap: 22,
        chart: (cell) => {
          const bins = binValues(
            cell.map((d) => d.pci),
            { thresholds: PCI_BINS },
          );
          const counts = bins.map((b) => ({ bin: b.x1.toFixed(2), count: b.count }));
          return {
            marks: [glBinBar(counts, { x: 'bin', y: 'count' })],
            // Label only the whole-number bins: fourteen labels in a cell this
            // narrow is a grey smear. The test is on the bin's own lower edge,
            // so it survives the panels being reordered.
            x: glAxisBin({
              label: 'Product Complexity Index',
              format: (v) => (Number(v) % 1 === 0 ? String(Number(v)) : ''),
            }),
            // Pinned, and pinned above the tallest bin in ANY sector (82
            // machinery products in the 0.5–1.0 bin). An inferred domain would
            // be per-cell, which is the failure this demo exists to avoid.
            y: glAxisY({ label: 'Products', domain: [0, 90], tickCount: 4 }),
          };
        },
      }),
    ],
    // `facet` computes its own margins for the outer axes from the cell scenes,
    // so the chart's own margin is dead space around them. Zeroing it hands the
    // whole canvas to the mark rather than picking a number that happens to look
    // right — see this demo's gaps.
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  return (
    <GLFigure
      title="Vietnam ships eight times as many agricultural and wood products as vehicles, and only a shared count axis says so."
      subtitle={`Product Complexity Index of the ${products.length} products Vietnam exported in ${LATEST_YEAR}, one panel per sector, common bins of 0.5 and a common count axis; panels ordered by median PCI`}
      source={BASKET}
    >
      <Chart {...chart.props} height={430} ariaLabel="Product complexity by sector, small multiples" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-facets-anscombe
/**
 * The Atlas's nearest honest version of Anscombe's quartet.
 *
 * Anscombe's four datasets were *solved for*: they share a mean, a variance, a
 * correlation and a regression line, and they were constructed to. The Atlas
 * contains no such quartet, and manufacturing one would be exactly the
 * fabrication this page refuses. So what ports is the rule, which is the half
 * that was ever about charts: **the demonstration collapses unless every panel
 * is on the same two scales.**
 *
 * Here the four panels are the World Bank income bands, and the shared scales
 * are load-bearing in both directions:
 *
 *   - Across panels, they place each band's cloud where it actually sits. Give
 *     each cell its own axes and all four look alike — which is Anscombe run
 *     backwards, four identical pictures hiding four different datasets.
 *   - Within panels, they show the fit lines are *not* the same, and the R² in
 *     each cell title says by how much. Complexity explains three fifths of the
 *     world's income differences (R² 0.61 pooled) and at most a sixth of any one
 *     band's — a range-restriction result the pooled scatter cannot show.
 *
 * The fit is drawn muted: §3.10 makes a fit line data when it is the estimate
 * the chart is about, and here the observations are, so the hue stays on them.
 */
function ComplexityAgainstIncome() {
  const catalog = new Map(countries.map((c) => [c.iso3, c]));

  // Income band is a string, so `defined` (which narrows to number) is the wrong
  // tool; the drop is explicit instead. Two economies leave: Taiwan has no World
  // Bank band and Cuba has no GDP figure. Neither is a zero.
  const rows = crossSection(LATEST_YEAR).flatMap((d) => {
    const band = catalog.get(d.iso3)?.incomeGroup;
    if (band == null || d.eci == null || d.gdpPerCapita == null) return [];
    return [{ iso3: d.iso3, band, eci: d.eci, gdpPerCapita: d.gdpPerCapita }];
  });

  // Panels read poorest to richest. `facet` groups in the order it meets each
  // key, so this sort IS the panel order.
  const BANDS: readonly string[] = ['low', 'lower middle', 'upper middle', 'high'];
  const BAND_NAME: Record<string, string> = {
    low: 'Low',
    'lower middle': 'Lower middle',
    'upper middle': 'Upper middle',
    high: 'High',
  };
  const ordered = [...rows].sort((a, b) => BANDS.indexOf(a.band) - BANDS.indexOf(b.band));

  // Income is log-normal across countries, so the fit is on log income and the
  // endpoints come back through 10^y to be drawn on the log axis.
  const logIncome = (d: (typeof rows)[number]) => Math.log10(d.gdpPerCapita);
  const fits = new Map(
    BANDS.map((band) => [band, linearFit(rows.filter((d) => d.band === band), { x: 'eci', y: logIncome })]),
  );

  // Both domains are pinned and shared. The x pad is a scatter radius' worth of
  // room at each end so the extreme economies are not half outside the plot.
  const ECI: readonly [number, number] = [-2.8, 2.15];
  const INCOME: readonly [number, number] = [200, 200_000];

  const chart = glChart({
    marks: [
      facet(ordered, {
        by: 'band',
        columns: 4,
        gap: 18,
        label: (key) => {
          const fit = fits.get(String(key));
          const name = BAND_NAME[String(key)] ?? String(key);
          return fit ? `${name} · R² ${fit.r2.toFixed(2)}` : name;
        },
        chart: (cell) => {
          const fit = linearFit(cell, { x: 'eci', y: logIncome });
          const line = (fit?.endpoints ?? []).map((p) => ({ eci: p.x, gdpPerCapita: 10 ** p.y }));
          return {
            marks: [
              glMutedLine(line, { x: 'eci', y: 'gdpPerCapita' }),
              glPoint(cell, { x: 'eci', y: 'gdpPerCapita' }),
            ],
            x: glAxisX({ label: 'Economic Complexity Index', domain: ECI, tickCount: 3 }),
            // Gridlines on: three decades of income is where the reader
            // estimates values off the axis, and here they do it in a cell that
            // has no axis of its own — the outer y ticks are two panels away.
            y: glAxisLog({
              label: 'GDP per capita (current USD)',
              domain: INCOME,
              tickCount: 3,
              grid: true,
            }),
          };
        },
      }),
    ],
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  return (
    <GLFigure
      title="Complexity explains three fifths of the world's income differences and a sixth of any one income band's."
      subtitle={`Economic Complexity Index against GDP per capita, ${rows.length} economies, ${LATEST_YEAR}, one panel per World Bank income band on shared scales; line is the within-band least-squares fit`}
      source={withNote(
        PANEL_AND_CATALOG,
        `${LATEST_YEAR} cross-section; Taiwan has no income band and Cuba no GDP figure, and both are dropped`,
      )}
    >
      <Chart {...chart.props} height={260} ariaLabel="Complexity against income by income band" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-57-scatter-marginal-histograms
/**
 * A joint distribution with both of its marginals — and the clearest case on
 * this page for a layout the library does not have.
 *
 * Three panels sharing two scales is a LINKED-PANEL layout. `facet` splits one
 * spec across cells and cannot compose three different specs against shared
 * scales, so everything that a layout would guarantee is done by hand below:
 * the domains are pinned three times, the bins are cut to span exactly those
 * domains, and the gutters are chosen to match a neighbour's rather than to look
 * right on their own. Every one of those is a value that has to stay in sync
 * with a value in another `glChart` call, which is the definition of the thing
 * a layout is for. Then the panels are *placed* by a CSS grid class that lives
 * in the gallery's stylesheet and not in this page's — so on this page they
 * stack. See the gaps; that stacking is the finding, not an oversight.
 *
 * The Atlas question is worth the trouble. Each axis has a strong shape of its
 * own — world trade across products is textbook log-normal, complexity is
 * left-skewed with a long simple tail — and jointly they have none at all
 * (r = -0.002). Marginals earn their place exactly when the joint plot is a
 * featureless blob and the reader would otherwise conclude the data is too.
 */
function ComplexityAgainstWorldTrade() {
  // World trade is log-normal over four decades, so the y variable is its log.
  // Taking the log in the DATA rather than reaching for `glAxisLog` is forced by
  // the marginals: a marginal's bins sit on a band scale, which is linear in
  // whatever units it is handed, so the joint plot's axis has to be linear in
  // the same units or the two panels stop lining up. That is a real cost of the
  // missing layout and it is recorded below.
  const traded = productNodes.flatMap((d) =>
    d.pci == null || d.exportValueM == null || d.exportValueM <= 0
      ? []
      : [{ code: d.code, nameShort: d.nameShort, pci: d.pci, logValue: Math.log10(d.exportValueM) }],
  );

  const padded = (values: readonly number[], by: number): readonly [number, number] => [
    Math.min(...values) - by,
    Math.max(...values) + by,
  ];
  const xDomain = padded(traded.map((d) => d.pci), 0.2);
  const yDomain = padded(traded.map((d) => d.logValue), 0.2);

  // The bins span the joint plot's domains exactly, so the first and last bar of
  // each marginal end where the plot does. Cutting them from the data extent
  // instead — which is what `binValues({ count })` does — would leave the
  // marginal a fifth of a bin narrower than the panel it summarises.
  const xBins = binValues(
    traded.map((d) => d.pci),
    { thresholds: edgesOver(xDomain, 28) },
  );
  const yBins = binValues(
    traded.map((d) => d.logValue),
    { thresholds: edgesOver(yDomain, 22) },
  );

  // The three panels only read as one chart if their PLOT rectangles line up, so
  // every margin below is chosen to match its neighbour's rather than to look
  // right on its own: the top marginal inherits the joint plot's left and right
  // gutters, the side marginal its top and bottom. Doing that by hand, in three
  // places, on values that have to stay in sync is precisely the work a
  // linked-panel layout would do.
  const GUTTER = { left: 74, right: 16 };

  const joint = glChart({
    marks: [glPoint(traded, { x: 'pci', y: 'logValue' })],
    x: glAxisX({ label: 'Product complexity (PCI)', domain: xDomain, nice: false }),
    y: glAxisY({ label: 'World trade (log₁₀ of $m)', domain: yDomain, nice: false }),
    margin: { ...GUTTER, top: 4 },
  });

  const xKeys = xBins.map((b) => b.x1.toFixed(2));
  const yKeys = yBins.map((b) => b.x1.toFixed(2));

  const top = glChart({
    marks: [
      glBinBar(
        xBins.map((b) => ({ bin: b.x1.toFixed(2), count: b.count })),
        { x: 'bin', y: 'count', tone: 'c-1', step: 'light' },
      ),
    ],
    x: glAxisBin({ domain: xKeys, format: () => '' }),
    y: glAxisY({ grid: false, tickCount: 2 }),
    margin: { ...GUTTER, bottom: 10, top: 4 },
  });

  // The y marginal is a HORIZONTAL histogram beside the plot, not a second
  // vertical one above it. A marginal has to share the axis it summarises or it
  // is just a third chart in the same figure.
  //
  // Its bins go in REVERSED. A band scale runs down the plot in the order it is
  // given its categories; a linear y scale runs up it from the domain minimum.
  // Handing the same ascending bins to both draws the marginal upside down
  // beside a joint plot that still reads correctly — which is what the catalog
  // specimen does, because nothing in the library relates the two directions.
  const side = glChart({
    marks: [
      glBinBarX(
        yBins.map((b) => ({ bin: b.x1.toFixed(2), count: b.count })),
        { y: 'bin', x: 'count', tone: 'c-1', step: 'light' },
      ),
    ],
    x: glAxisY({ grid: false, tickCount: 2 }),
    y: glAxisBin({ domain: [...yKeys].reverse(), format: () => '' }),
    margin: { left: 8, right: 8, top: 4, bottom: 52 },
  });

  return (
    <GLFigure
      title="The world's largest export markets are no more complex than its smallest."
      subtitle={`Product Complexity Index against world trade for ${traded.length} HS92 products, ${LATEST_YEAR}, with the distribution of each axis; marginals share the joint plot's domains`}
      source={withNote(NODES, 'One product with no recorded world trade is dropped')}
    >
      <div className="gl-plate__joint">
        <Chart {...top.props} height={64} ariaLabel="Distribution of product complexity" />
        <div />
        <Chart {...joint.props} height={250} ariaLabel="World trade against product complexity" />
        <Chart {...side.props} height={250} ariaLabel="Distribution of world trade" />
      </div>
    </GLFigure>
  );
}
// #endregion

// ════════════════════════════════════════════════════════════════════════════

const demos: Demo[] = [
  {
    id: 'ts-51-faceted-distributions',
    family: 'Facets and Multiple Views',
    name: 'Small multiples — one histogram per group',
    question: 'Which of Vietnam’s sectors are complex, and which are merely large?',
    rule: '§3.5 — panels are only comparable on a shared scale, so facet resolves it.',
    render: BasketBySector,
    gaps: [
      '`facet` is used unwrapped. It paints nothing — no fill, stroke or opacity — so that does not breach the no-hand-styling contract, but two things are missing. `glMargin` is sized for a single chart (74px left to clear a rotated axis label), which is most of a narrow facet cell, so every faceted plate overrides it by hand; and `facet` hard-codes its cell titles at 11px/600 with fill-opacity 0.78, below the 12px floor. The type is now corrected in `src/patch.css` with an expiry test, but the margin model is still the caller’s problem. A `glFacet` would own both.',
      'The margin override this demo writes is `{ top: 0, right: 0, bottom: 0, left: 0 }`, which is not a tuned number but a way of saying "the mark owns the layout" — `facet` computes its own outer-axis margins from the cell scenes and `glMargin` is only dead space around them. `glChart` has no way to express that except four zeros, and a reader cannot tell those four zeros from four hand-picked ones. That is the same `glFacet` the gap above asks for, seen from the other side.',
      'Cell titles do not fit and `facet` does not know it. The title is centred at the cell’s midpoint with no truncation, no wrap and no measurement, so "Textiles, garments, footwear and furniture" and "Vegetables, animals, wood and paper" run past their cells and into their neighbours’. Nine real Atlas sector names in three columns is the first time this has been visible: the synthetic specimen’s groups were "Europe" and "Asia". Either the mark truncates with the ellipsis the spec already defines for long category labels, or a caller-supplied `label` has to shorten every key by hand — and shortening by hand puts an invented sector name on the figure.',
      'The nine panels are three columns wide because that is what fits, not because the data says three. `facet` has `minWidth` and will choose columns itself, but the choice interacts with cell-title width — which it cannot measure — so a column count that reads well at one page width smears at another.',
    ],
  },
  {
    id: 'ts-facets-anscombe',
    family: 'Facets and Multiple Views',
    name: 'Scatter facets on shared axes',
    question: 'Does complexity predict income as strongly within an income band as it does across the world?',
    rule: 'The demonstration collapses unless every panel is on the SAME two scales.',
    render: ComplexityAgainstIncome,
    gaps: [
      'Same `facet` shortfall as the faceted distributions: unwrapped, and the small-multiple margin model is the plate’s to supply.',
      'Anscombe’s quartet cannot be drawn from the Atlas, and this demo does not pretend otherwise. The quartet is four datasets solved for identical mean, variance, correlation and regression line; nothing in economic data does that, and synthesising four series to make the picture would breach the rule this page is built on. What ports is the rule the specimen is filed under — every panel on the same two scales — so the demo keeps that and answers a real Atlas question with it. The consequence is that the *inverse* of Anscombe is what gets demonstrated: the four fits here are visibly different, and the point is that shared scales are what let you see it.',
      'The R² in each cell title is computed by the demo and passed through `facet`’s `label`. That is the only channel a facet cell has for a per-panel statistic, and it is a string — so the number cannot be positioned, formatted or given the ink a figure’s own annotations get, and it competes for width with the panel name. A per-cell annotation slot would be the right shape.',
    ],
  },
  {
    id: 'ts-57-scatter-marginal-histograms',
    family: 'Facets and Multiple Views',
    name: 'Joint distribution with both marginals',
    question: 'Are the world’s most-traded products its most complex ones?',
    rule: '§3.5 — the marginals are only readable against the joint plot’s own domains.',
    render: ComplexityAgainstWorldTrade,
    gaps: [
      'This is the clearest case for a layout the library does not have. Three panels sharing two scales is a LINKED-PANEL layout; `facet` splits one spec across cells and cannot compose three different specs against shared scales. So the panels are placed by a grid rule in `gallery.css` and the shared domains are pinned by hand on all three charts — which is exactly what a layout would otherwise guarantee, and exactly the kind of hand-coordination that rots the first time the data changes.',
      'It has already rotted, and moving the plate one page proved it. The grid that made these three panels read as one figure is a rule in `gallery.css`; this page loads `examples.css`, which has no such rule, so `gl-plate__joint` resolves to nothing and the three charts stack vertically — the side marginal ends up below the joint plot at full width instead of beside it at 118px. The demo keeps the class name rather than reaching for an inline grid, because the point is that a layout whose only definition is a stylesheet belonging to one page is not a layout the library has. One `glJointPlot` would carry it; a second copy of the CSS rule would only postpone the next divergence.',
      'The log has to be taken in the data. World trade spans four decades and belongs on `glAxisLog`, but a marginal’s bins sit on a BAND scale, which is linear in whatever units it is given — so the joint plot’s y axis must be linear in the same units the bins were cut in, or the marginal stops lining up with the panel it summarises. The axis therefore reads "log₁₀ of $m" instead of "$1m / $10m / $100m", which is strictly worse for the reader and entirely the missing layout’s fault: a layout that shared a *scale* between panels, rather than a *domain*, would let the log axis stand and bin the marginal through it.',
      'The side marginal has to be handed its bins REVERSED, and finding that out required rendering it. A y band scale runs down the plot in the order it meets its categories; a linear y scale runs up it from the domain minimum. Give both the same ascending bins — which is what the catalog specimen does, and what this demo did until the DOM was measured — and the marginal draws upside down beside a joint plot that still reads correctly, with no warning and nothing visibly broken. The fix is one more pinned domain, which is one more value that has to stay in sync with a value in another `glChart` call. A linked-panel layout would derive the marginal’s direction from the axis it summarises instead of asking the caller to know that band and linear scales disagree about which way is up.',
    ],
  },
];

export const facetsFamily: Family = {
  slug: 'facets-and-multiple-views',
  title: 'Facets and Multiple Views',
  blurb:
    'More than one plot in a figure, for the two different reasons that happens: the same chart repeated once per group, and several different charts that have to agree about a scale. Panels are only comparable when they share a domain, so they do.',
  demos,
};

export function renderFacets(): Record<string, () => ReactNode> {
  return Object.fromEntries(demos.map((d) => [d.id, d.render]));
}
