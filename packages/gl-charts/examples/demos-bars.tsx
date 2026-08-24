/**
 * Bars and Rankings — eleven catalog forms, drawn from the Atlas.
 *
 * A bar chart is the form the Atlas asks for most often, and it is also where
 * real data pushes hardest against the spec. Three pressures recur here and are
 * worth naming once rather than eleven times:
 *
 * 1. **Atlas category names are long.** "Textiles, garments, footwear and
 *    furniture" is a sector; "Transmission apparatus for radio, telephone and TV"
 *    is the single largest thing Vietnam exports. §3.5 forbids rotating a
 *    category label 90°, which leaves two honest answers: turn the chart
 *    horizontal and buy the room with a left margin, or leave it vertical and let
 *    the labels collide. Both appear below, and the collision is recorded rather
 *    than styled away.
 *
 * 2. **Nine sectors, three tone steps.** `toneRamp` tops out at three categories
 *    by construction (§8b/§8c), so any one-hue stack over Atlas sectors has to
 *    reduce first. Where a chart needs an ordered three-way split, the split is
 *    made from a variable the Atlas itself defines — RCA bands, income tiers —
 *    never invented to fit the ramp.
 *
 * 3. **A bar wants a zero baseline, and half the Atlas indices have one.** ECI is
 *    centred so that zero is the world average, so `zeroBaseline` is earned;
 *    an export level in dollars has a zero that nothing is measured against, and
 *    the variant stays off there.
 *
 * Contract, unchanged: no hex, no font size, no stroke width, no opacity below.
 * Data preparation is authored; appearance never is.
 */

import type { ReactNode } from 'react';
import { Chart } from '@tanstack/react-charts';
import { group, groupBy, stack } from '@tanstack/charts';

import {
  endLabels,
  glAxisBand,
  glAxisY,
  glBar,
  glBarX,
  glChart,
  glLine,
  glLink,
  glMutedBarX,
  glMutedLine,
  glMutedPoint,
  glPoint,
  glStemX,
  popUp,
  signColor,
  signKey,
  toneRamp,
  waterfall,
  yearAxisFor,
} from '../src/index.js';
import { GLFigure, GLLegend } from '../src/figure.js';

import {
  COHORT,
  FIRST_YEAR,
  LATEST_YEAR,
  SECTOR_ORDER,
  countriesTable,
  country,
  countryName,
  countrySectorYear,
  countrySectorYearTable,
  countryYear,
  countryYearTable,
  crossSection,
  defined,
  leadPartners,
  leadPartnersTable,
  leadProductPanel,
  leadProductPanelTable,
  leadProducts,
  leadProductYearTable,
  partnersIn,
  sourceOf,
  topProducts,
  withNote,
} from './atlas-data.js';
import type { Demo, Family } from './demo.js';

const PANEL = sourceOf(countryYearTable);
const SECTORS = sourceOf(countrySectorYearTable);
const PARTNERS = sourceOf(leadPartnersTable);
const PRODUCTS = sourceOf(leadProductYearTable);
const PRODUCT_PANEL = sourceOf(leadProductPanelTable);
const PANEL_AND_CATALOG = sourceOf(countryYearTable, countriesTable);

// ════════════════════════════════════════════════════════════════════════════

// #region demo:spec-01-lollipop
/**
 * A lollipop is a bar chart that spends less ink on the same value, and the stem
 * is DATA — it encodes the magnitude — so §3.4.2 gives it the series tone at line
 * weight rather than the dashed `ink-3` a reference rule would take.
 *
 * The value is a *difference between two ranks*, which is the one thing that made
 * this worth building on real data: a rank change is only meaningful if the field
 * being ranked is stable, and it is not — the Atlas ranked 139 economies in 1995
 * and 144 in 2023. The source line says so rather than the chart pretending
 * otherwise.
 */
function ComplexityRankGains() {
  const start = new Map(
    defined(
      countryYear.filter((d) => d.year === FIRST_YEAR && COHORT.includes(d.iso3)),
      'eciRank',
    ).map((d) => [d.iso3, d.eciRank]),
  );

  // A gain is places CLIMBED, so it is the old rank minus the new one — rank 119
  // to rank 48 is +71, not −71.
  const rows = defined(
    countryYear.filter((d) => d.year === LATEST_YEAR && COHORT.includes(d.iso3)),
    'eciRank',
  )
    .filter((d) => start.has(d.iso3))
    .map((d) => ({ country: countryName(d.iso3), gain: start.get(d.iso3)! - d.eciRank }))
    .sort((a, b) => b.gain - a.gain);

  const { backdrop, focus } = popUp(rows, { by: 'country', highlight: [countryName('VNM')] });

  const chart = glChart({
    marks: [
      glStemX(backdrop, { x: 'country', y: 'gain', tone: 'muted' }),
      glPoint(backdrop, { x: 'country', y: 'gain', tone: 'muted' }),
      ...focus.flatMap((s) => [
        glStemX(s.rows, { x: 'country', y: 'gain', tone: s.tone }),
        glPoint(s.rows, { x: 'country', y: 'gain', tone: s.tone }),
      ]),
    ],
    // Pinned, because `popUp` emits the muted backdrop before the focus series and
    // a band scale takes its domain from the order it MEETS each category — which
    // would send the highlighted stem to the end of a chart whose subject is rank.
    x: glAxisBand({ domain: rows.map((d) => d.country) }),
    y: glAxisY({ label: 'Places climbed in the ECI ranking' }),
  });

  return (
    <GLFigure
      title="Vietnam climbed seventy-one places in the complexity ranking; no neighbour moved more than thirty."
      subtitle={`Change in Economic Complexity Index rank, ${FIRST_YEAR}–${LATEST_YEAR}, six Southeast Asian economies`}
      source={withNote(
        PANEL,
        'The ranked field grew from 139 economies to 144 over the period, so a place is not a fixed quantity',
      )}
    >
      <Chart {...chart.props} height={240} ariaLabel="Change in complexity rank by economy" />
    </GLFigure>
  );
}
// #endregion

// #region demo:spec-02-dumbbell
/**
 * Two states of one entity, joined. The connector is what the reader measures —
 * the *distance* is the finding — but it is still a stroke on an assembled glyph
 * rather than a series line of its own, so §3.3 gives it the DARK tone; passing
 * `tone: 'muted'` to `glLink` resolves to `c-muted-dark`.
 *
 * Rows are sorted by the change rather than by either endpoint, so the chart is
 * ordered by the thing it is about. Every economy in the cohort improved, which
 * is why the endpoints carry different tones rather than an arrowhead: there is
 * no direction to encode, only a before and an after.
 */
function ComplexityThenAndNow() {
  const start = new Map(
    defined(
      countryYear.filter((d) => d.year === FIRST_YEAR && COHORT.includes(d.iso3)),
      'eci',
    ).map((d) => [d.iso3, d.eci]),
  );

  const rows = defined(
    countryYear.filter((d) => d.year === LATEST_YEAR && COHORT.includes(d.iso3)),
    'eci',
  )
    .filter((d) => start.has(d.iso3))
    .map((d) => ({ country: countryName(d.iso3), then: start.get(d.iso3)!, now: d.eci }))
    .sort((a, b) => b.now - b.then - (a.now - a.then));

  const chart = glChart({
    marks: [
      glLink(rows, { x1: 'then', x2: 'now', y1: 'country', y2: 'country', tone: 'muted' }),
      glPoint(rows, { x: 'then', y: 'country', tone: 'muted' }),
      glPoint(rows, { x: 'now', y: 'country', tone: 'c-1' }),
    ],
    x: glAxisY({ label: 'Economic Complexity Index' }),
    y: glAxisBand({ domain: rows.map((d) => d.country) }),
    margin: { left: 96 },
  });

  return (
    <GLFigure
      title="Every economy in the region gained complexity; Vietnam moved more than twice as far as any other."
      subtitle={`Economic Complexity Index, ${FIRST_YEAR} and ${LATEST_YEAR}, ordered by the size of the move`}
      source={PANEL}
      legend={
        <GLLegend
          items={[
            { label: String(FIRST_YEAR), tone: 'muted', mark: 'point' },
            { label: String(LATEST_YEAR), tone: 'c-1', mark: 'point' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={230} ariaLabel="Complexity change by economy" />
    </GLFigure>
  );
}
// #endregion

// #region demo:spec-16-waterfall
/**
 * The bridge from one decade's export total to the next, decomposed by sector.
 *
 * `waterfall` computes the staircase; `signColor` paints every bar by its sign
 * **including the total**, which is the part §3.6 singles out — a residual pulled
 * out into grey reads as a third category and breaks the encoding. The netted
 * "other sectors" bar is subject to exactly the same rule, so it takes blue
 * because it is positive, not grey because it is a remainder.
 *
 * Nine sectors would be nine bars plus a total, and the Atlas sector names are
 * long enough that ten of them are unreadable side by side. So the three largest
 * contributors and the single decliner are named, and the remaining five are
 * netted into one step — the aggregation is stated in the subtitle rather than
 * being silently absorbed.
 *
 * `zeroBaseline` promotes the zero gridline to axis weight: here zero is a real
 * baseline the reader measures contributions from.
 */
function ExportGrowthBridge() {
  const from = 2013;
  const sectorTotal = (iso3: string, year: number, sector: string) =>
    defined(
      countrySectorYear.filter((d) => d.iso3 === iso3 && d.year === year && d.sector === sector),
      'exportValueM',
    ).reduce((sum, d) => sum + d.exportValueM, 0);

  const ranked = SECTOR_ORDER
    // Billions, so the axis reads in the units the finding is stated in.
    .map((sector) => ({
      sector,
      delta: (sectorTotal('VNM', LATEST_YEAR, sector) - sectorTotal('VNM', from, sector)) / 1000,
    }))
    .sort((a, b) => b.delta - a.delta);

  const named = ranked.slice(0, 3);
  const decline = ranked[ranked.length - 1];
  const netted = ranked.slice(3, -1);
  const bridge = [
    ...named,
    {
      sector: `${netted.length} other sectors`,
      delta: netted.reduce((sum, d) => sum + d.delta, 0),
    },
    decline,
  ];

  const steps = waterfall(bridge, { key: 'sector', value: 'delta', total: 'Net change' });

  const chart = glChart({
    marks: [glBar(steps, { x: 'key', y1: 'y1', y2: 'y2', color: (d) => signKey(d.delta) })],
    x: glAxisBand(),
    y: glAxisY({ label: 'Contribution to export growth ($bn)' }),
    color: signColor(),
    variant: { stacked: true, zeroBaseline: true },
  });

  return (
    <GLFigure
      title="Electronics alone added more to Vietnam's exports than the next two sectors combined."
      subtitle={`Change in goods exports by sector, ${from}–${LATEST_YEAR}; the five smallest contributors are netted into one step`}
      source={withNote(SECTORS, 'Excludes the unclassified "Other" sector')}
    >
      <Chart {...chart.props} height={250} ariaLabel="Export growth decomposed by sector" />
    </GLFigure>
  );
}
// #endregion

// #region demo:spec-19-ranked-barx
/**
 * The ranked pop-up in its horizontal orientation. Twelve destination markets,
 * one of them carrying the finding; §3.1 says colour is spent only where it does,
 * so the other eleven are `c-muted` and the chart still reads as a ranking.
 *
 * The band domain is pinned for the reason it always is here: `popUp` emits the
 * backdrop first, and an inferred band domain would reorder the ranking around
 * whichever bar was highlighted.
 */
function DestinationMarkets() {
  // `partnersIn` already sorts largest-first; the pivot only converts $m to $bn
  // so the axis reads in the units the title uses.
  const rows = defined(partnersIn(LATEST_YEAR), 'exportValueM').map((d) => ({
    market: d.partnerShort,
    exports: d.exportValueM / 1000,
  }));

  const { backdrop, focus } = popUp(rows, { by: 'market', highlight: ['China'] });

  const chart = glChart({
    marks: [
      glMutedBarX(backdrop, { y: 'market', x: 'exports' }),
      ...focus.map((s) => glBarX(s.rows, { y: 'market', x: 'exports', tone: s.tone })),
    ],
    x: glAxisY({ label: `Exports from Vietnam, ${LATEST_YEAR} ($bn)` }),
    y: glAxisBand({ domain: rows.map((d) => d.market) }),
    margin: { left: 168 },
  });

  return (
    <GLFigure
      title="China has almost caught the United States as a destination for Vietnam's exports."
      subtitle={`Vietnam's twelve largest destination markets, goods exports, ${LATEST_YEAR}`}
      source={PARTNERS}
    >
      <Chart {...chart.props} height={270} ariaLabel="Vietnam exports by destination market" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-bar-horizontal-ranking
/**
 * The case the horizontal orientation exists for, at the length the Atlas
 * actually publishes.
 *
 * §3.5 forbids rotating a category label 90°, and the largest single thing
 * Vietnam exports is called "Transmission apparatus for radio, telephone and TV"
 * — fifty characters, and that is already the Atlas's *short* name; the full one
 * runs to 213. On a vertical axis this chart cannot be drawn at all. On a
 * horizontal one it can, at the price of a left margin wider than a third of the
 * figure, which is a cost the reader can see and judge.
 */
function LargestProducts() {
  const rows = defined(topProducts(10), 'exportValueM').map((d) => ({
    product: d.nameShort,
    exports: d.exportValueM / 1000,
  }));

  const { backdrop, focus } = popUp(rows, { by: 'product', highlight: [rows[0].product] });

  const chart = glChart({
    marks: [
      glMutedBarX(backdrop, { y: 'product', x: 'exports' }),
      ...focus.map((s) => glBarX(s.rows, { y: 'product', x: 'exports', tone: s.tone })),
    ],
    x: glAxisY({ label: `Exports, ${LATEST_YEAR} ($bn)` }),
    y: glAxisBand({ domain: rows.map((d) => d.product) }),
    margin: { left: 300 },
  });

  return (
    <GLFigure
      title="One product line is larger than the next two put together."
      subtitle={`Vietnam's ten largest exports, HS92 4-digit, ${LATEST_YEAR}`}
      source={PRODUCTS}
    >
      <Chart {...chart.props} height={260} ariaLabel="Vietnam's ten largest export products" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-bar-grouped
/**
 * Three periods per economy, side by side.
 *
 * `group()` is TanStack's own dodge layout, so the sub-band arithmetic is not the
 * demo's business. Three snapshots of ONE ordered variable is exactly §8c's case,
 * so they take the light → main → dark ramp of a single hue rather than three
 * unrelated colours: the lightness carries the direction of time, and the reader
 * can see which bar is which without consulting the legend.
 *
 * The rows are built period-major on purpose. TanStack spends a colour scale in
 * the order it first meets each key, and `toneRamp` pins the domain — but the
 * sub-band ORDER inside each group still follows first appearance, so building
 * 2023's bars before 1995's would run the ramp backwards.
 */
function DiversitySnapshots() {
  const PERIODS = [FIRST_YEAR, 2009, LATEST_YEAR];
  const LABELS = PERIODS.map(String);

  const rows = PERIODS.flatMap((year) =>
    defined(
      countryYear.filter((d) => d.year === year && COHORT.includes(d.iso3)),
      'diversity',
    ).map((d) => ({ country: countryName(d.iso3), period: String(year), products: d.diversity })),
  );

  // Ordered by the latest reading, so the axis itself ranks the economies.
  const order = rows
    .filter((d) => d.period === String(LATEST_YEAR))
    .sort((a, b) => b.products - a.products)
    .map((d) => d.country);

  const chart = glChart({
    marks: [
      glBar(rows, { x: 'country', y: 'products', z: 'period', color: 'period', layout: group() }),
    ],
    x: glAxisBand({ domain: order }),
    y: glAxisY({ label: 'Products exported with comparative advantage' }),
    color: toneRamp({ tones: 'three', order: LABELS, tone: 'c-1' }),
  });

  return (
    <GLFigure
      title="The Philippines exports a third fewer products competitively than it did in 1995."
      subtitle={`Diversity — the count of products exported with revealed comparative advantage — in ${LABELS.join(', ')}`}
      source={PANEL}
      // Below and centred: the bars are GROUPED, not stacked, so there is no
      // vertical band order for a right-hand legend to mirror (§3.11).
      legend={
        <GLLegend
          items={LABELS.map((label, i) => ({
            label,
            tone: 'c-1' as const,
            step: (['light', 'main', 'dark'] as const)[i],
          }))}
        />
      }
    >
      <Chart {...chart.props} height={250} ariaLabel="Export diversity by economy and period" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-bar-stacked
/**
 * A stack over an ordered three-way split the Atlas defines for itself.
 *
 * Revealed comparative advantage is a ratio with a meaning at 1 — a country
 * exports more of a product than its share of world trade would predict — so
 * banding at 1 and 3 is reading the Atlas's own threshold rather than choosing a
 * cut to fit the palette. That matters because `toneRamp` holds three categories
 * and no more: the honest way to fit a nine-sector basket into it is to find a
 * variable that is genuinely ordered and genuinely three-valued, not to merge
 * sectors until the count works.
 *
 * `variant: { stacked: true }` cuts the 1px gap between segments. `barY` exposes
 * no stroke option and its `inset` trims width rather than height, so that gap can
 * only come from CSS — which is the rule this specimen exists to carry.
 */
function AdvantageTiers() {
  const TIERS = ['No advantage (RCA below 1)', 'Emerging (RCA 1 to 3)', 'Strong (RCA above 3)'];
  const tierOf = (rca: number) => (rca < 1 ? TIERS[0] : rca < 3 ? TIERS[1] : TIERS[2]);
  const SNAPSHOTS = [1995, 2000, 2005, 2010, 2015, 2020, LATEST_YEAR];

  // Tier-minor inside each year, so the light → main → dark ramp runs bottom to
  // top: §8c puts the lightest tier at the bottom and the darkest at the top, and
  // the stack builds in the order it meets each key.
  const rows = SNAPSHOTS.flatMap((year) => {
    const inYear = defined(
      defined(
        leadProductPanel.filter((d) => d.year === year),
        'exportValueM',
      ),
      'rca',
    );
    return TIERS.map((tier) => ({
      year: String(year),
      tier,
      exports:
        inYear
          .filter((d) => tierOf(d.rca) === tier)
          .reduce((sum, d) => sum + d.exportValueM, 0) / 1000,
    }));
  });

  const chart = glChart({
    marks: [glBar(rows, { x: 'year', y: 'exports', z: 'tier', color: 'tier', layout: stack() })],
    x: glAxisBand({ domain: SNAPSHOTS.map(String) }),
    y: glAxisY({ label: 'Exports ($bn)' }),
    color: toneRamp({ tones: 'three', order: TIERS, tone: 'c-1' }),
    variant: { stacked: true },
  });

  return (
    <GLFigure
      title="By 2020 every one of Vietnam's twelve largest products was one it exported competitively."
      subtitle="Export value of Vietnam's twelve largest 2023 products, by revealed comparative advantage band"
      source={PRODUCT_PANEL}
      // Stacked bands, so §3.11 moves the legend to the right — and reverses it,
      // because the legend has to run in the stack's own top-to-bottom order.
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
      <Chart {...chart.props} height={250} ariaLabel="Export value by comparative advantage band" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-59-grouped-reducer-bars
/**
 * Bar heights that are a computed statistic rather than a measured one.
 *
 * `groupBy` with a `mean` reducer does the aggregation, so the chart is drawn from
 * all 145 country rows rather than from a summary table prepared elsewhere —
 * worth doing for the reason the reducer exists: the mean and the chart cannot
 * disagree, because there is only one of them.
 *
 * Income tier is two categories sharing a parent (one classification, collapsed
 * to two levels), which §8b sends to one hue at main + light rather than to two
 * unrelated colours. And because ECI is centred so that zero is the world
 * average, `zeroBaseline` is earned here: the reader really is measuring above
 * and below a meaningful line.
 */
function ComplexityByIncomeTier() {
  const HIGH = 'High income';
  const REST = 'Everyone else';

  const rows = defined(crossSection(LATEST_YEAR), 'eci').flatMap((d) => {
    const catalog = country(d.iso3);
    // One economy in the panel (Taiwan) carries no income classification. It is
    // dropped rather than folded into "everyone else", which would assert a
    // grouping the Atlas declines to make.
    if (!catalog || catalog.incomeGroup == null) return [];
    return [
      {
        region: catalog.region,
        tier: catalog.incomeGroup === 'high' ? HIGH : REST,
        eci: d.eci,
      },
    ];
  });

  const means = groupBy(rows, {
    // A Record, not an array: `TransformGroupSpec` names the output field on the
    // left and reads the channel on the right, so the reduced rows come back
    // carrying `region` and `tier` rather than a positional tuple.
    by: { region: 'region', tier: 'tier' },
    outputs: { eci: { value: 'eci', reduce: 'mean' } },
  }).sort((a, b) => (a.tier === b.tier ? 0 : a.tier === HIGH ? -1 : 1));

  const order = [...new Set(rows.map((d) => d.region))]
    .map((region) => {
      const values = rows.filter((d) => d.region === region).map((d) => d.eci);
      return { region, mean: values.reduce((s, v) => s + v, 0) / values.length };
    })
    .sort((a, b) => a.mean - b.mean)
    .map((d) => d.region);

  const chart = glChart({
    marks: [glBar(means, { x: 'region', y: 'eci', z: 'tier', color: 'tier', layout: group() })],
    x: glAxisBand({ domain: order }),
    y: glAxisY({ label: 'Mean Economic Complexity Index' }),
    color: toneRamp({ tones: 'two', order: [HIGH, REST], tone: 'c-1' }),
    variant: { zeroBaseline: true },
  });

  return (
    <GLFigure
      title="Africa is the only region in which the Atlas ranks no high-income economy at all."
      subtitle={`Mean Economic Complexity Index by region and income tier, ${LATEST_YEAR}, ${rows.length} economies`}
      source={withNote(
        PANEL_AND_CATALOG,
        'Taiwan is excluded: the catalog carries no income classification for it',
      )}
      legend={
        <GLLegend
          items={[
            { label: HIGH, tone: 'c-1' },
            { label: REST, tone: 'c-1', step: 'light' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={250} ariaLabel="Mean complexity by region and income tier" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-71-population-pyramid
/**
 * A population pyramid, drawn over the population the Atlas actually has.
 *
 * The Atlas has no age or sex data of any kind, so this form cannot be filled
 * honestly at its usual subject. What it *does* have is a population of 1,199
 * products, each with a complexity score and a revealed comparative advantage —
 * and that is the same shape: an ordered set of bands, split two ways, read as
 * two wings off a shared baseline.
 *
 * The signed counts are data preparation; once they exist the chart is an
 * ordinary horizontal diverging stack. The one design decision is the colour, and
 * it is the decision the original specimen exists to make: comparative advantage
 * is not a SIGN, so this must not reach for `signColor()` even though the geometry
 * invites it. Red-for-"no advantage" would import a valence the data does not
 * carry. §8b's two-tone ramp is the right answer.
 */
function ComplexityPyramid() {
  // Descending, so the axis reads most complex at the top — and unit-wide, because
  // PCI has no published bracket and a round band is the honest default.
  const EDGES = [3, 2, 1, 0, -1, -2, -3, -4, -5];
  const BANDS = EDGES.slice(0, -1).map((hi, i) => ({
    label: `${EDGES[i + 1]} to ${hi}`,
    lo: EDGES[i + 1],
    hi,
  }));

  const WITH = 'Comparative advantage';
  const WITHOUT = 'No comparative advantage';

  const products = defined(defined(leadProducts, 'pci'), 'rca');
  const rows = BANDS.flatMap((band) => {
    const inBand = products.filter((d) => d.pci >= band.lo && d.pci < band.hi);
    return [
      { band: band.label, side: WITH, count: inBand.filter((d) => d.rca >= 1).length },
      // Negative so `offset: 'diverging'` sends this wing left. The sign is a
      // POSITION, not a value — see the axis formatter below.
      { band: band.label, side: WITHOUT, count: -inBand.filter((d) => d.rca < 1).length },
    ];
  });

  const chart = glChart({
    marks: [
      glBarX(rows, {
        y: 'band',
        x: 'count',
        z: 'side',
        color: 'side',
        layout: stack({ offset: 'diverging' }),
      }),
    ],
    x: glAxisY({
      label: `Products in Vietnam's ${LATEST_YEAR} basket`,
      format: (v: number) => String(Math.abs(v)),
    }),
    y: glAxisBand({ domain: BANDS.map((b) => b.label) }),
    color: toneRamp({ tones: 'two', order: [WITH, WITHOUT], tone: 'c-1' }),
    variant: { stacked: true, zeroBaseline: true },
    margin: { left: 96 },
  });

  return (
    <GLFigure
      title="The products Vietnam is competitive in are less complex than the ones it is not."
      subtitle={`Count of exported products by Product Complexity Index band, split by whether Vietnam holds a revealed comparative advantage, ${LATEST_YEAR}`}
      source={PRODUCTS}
      legend={
        <GLLegend
          items={[
            { label: WITH, tone: 'c-1' },
            { label: WITHOUT, tone: 'c-1', step: 'light' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={290} ariaLabel="Products by complexity band and advantage" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-72-mixed-bars
/**
 * A stack and a line in one frame, which only works when both are in the same
 * unit and the reader can see that they are.
 *
 * Both series here are billions of dollars of classified goods exports from the
 * same table, so the line is a genuine comparator rather than a second chart
 * borrowing an axis. §8b does the rest: the stack is ONE hue in two tones, which
 * keeps it reading as a single total and leaves `c-2` free for the line.
 *
 * The x axis samples every fourth year rather than showing all twenty-nine. A
 * band scale spaces its categories evenly whatever their values, so an irregular
 * sample would draw a regular axis and quietly distort the slope — the step is
 * kept constant for that reason, not for tidiness.
 */
function ElectronicsAgainstThailand() {
  const years = Array.from(
    { length: Math.floor((LATEST_YEAR - FIRST_YEAR) / 4) + 1 },
    (_, i) => FIRST_YEAR + i * 4,
  );

  const totalFor = (iso3: string, year: number, sectors?: (s: string) => boolean) =>
    defined(
      countrySectorYear.filter(
        (d) => d.iso3 === iso3 && d.year === year && (sectors ? sectors(d.sector) : true),
      ),
      'exportValueM',
    ).reduce((sum, d) => sum + d.exportValueM, 0) / 1000;

  const ELECTRONICS = 'Electronics';
  const OTHER = 'All other sectors';

  // "All other sectors" FIRST, which is the opposite of what §8b's tone order
  // suggests and is required by the question. The headline asks whether Vietnam
  // clears Thailand *without* electronics, and a segment's length is only
  // comparable to a line's height when the segment starts at the baseline.
  // Stacking electronics at the bottom put the other-sectors band between 113
  // and 340 in 2023: its LENGTH is the quantity being compared (227) but its TOP
  // EDGE reads as 340, so the naive read says Vietnam clears the 277 line when
  // the answer is that it does not. Bottom-anchoring the band makes the
  // comparison edge-to-edge and the chart answers its own headline.
  const stacked = years.flatMap((year) => [
    { year: String(year), part: OTHER, exports: totalFor('VNM', year, (s) => s !== ELECTRONICS) },
    { year: String(year), part: ELECTRONICS, exports: totalFor('VNM', year, (s) => s === ELECTRONICS) },
  ]);

  const thailand = years.map((year) => ({ year: String(year), exports: totalFor('THA', year) }));

  const chart = glChart({
    marks: [
      glBar(stacked, { x: 'year', y: 'exports', z: 'part', color: 'part', layout: stack() }),
      glLine(thailand, { x: 'year', y: 'exports', tone: 'c-2', focus: true }),
    ],
    x: glAxisBand({ domain: years.map(String) }),
    y: glAxisY({ label: 'Classified goods exports ($bn)' }),
    color: toneRamp({ tones: 'two', order: [ELECTRONICS, OTHER], tone: 'c-1' }),
    variant: { stacked: true },
  });

  return (
    <GLFigure
      title="Take electronics out and Vietnam is still behind Thailand."
      subtitle={`Vietnam's goods exports split by sector against Thailand's total, every fourth year, ${FIRST_YEAR}–${LATEST_YEAR}`}
      source={withNote(SECTORS, 'Excludes the unclassified "Other" sector for both economies')}
      legend={
        <GLLegend
          items={[
            { label: `Vietnam — ${ELECTRONICS.toLowerCase()}`, tone: 'c-1' },
            { label: `Vietnam — ${OTHER.toLowerCase()}`, tone: 'c-1', step: 'light' },
            { label: 'Thailand, total', tone: 'c-2', mark: 'line', focus: true },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={260} ariaLabel="Vietnam exports by sector against Thailand" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-54-bump-ranking
/**
 * Position over time rather than value over time.
 *
 * The ranks are computed per year, then the y axis is INVERTED by pinning its
 * domain high-to-low, because rank 1 belongs at the top and a scale left to infer
 * its own direction puts it at the bottom.
 *
 * §3.1 applies as everywhere: twelve series would be twelve hues, so the two that
 * actually trade places take `c-1` and `c-2` and the rest carry the shape of the
 * field in `c-muted`. The ranking is computed from whatever markets the Atlas has
 * a figure for in each year, which is not always twelve — the United Arab
 * Emirates has no rows before 2000, so the first five years rank eleven markets
 * and its line simply starts later.
 */
function MarketRanks() {
  const years = [...new Set(leadPartners.map((d) => d.year))].sort((a, b) => a - b);

  const ranked = years.flatMap((year) =>
    defined(
      leadPartners.filter((d) => d.year === year),
      'exportValueM',
    )
      .sort((a, b) => b.exportValueM - a.exportValueM)
      .map((d, i) => ({ year, market: d.partnerShort, rank: i + 1 })),
  );

  const markets = [...new Set(ranked.map((d) => d.market))];
  const { backdrop, focus } = popUp(ranked, {
    by: 'market',
    highlight: ['Japan', 'United States of America'],
  });

  const chart = glChart({
    marks: [
      glMutedLine(backdrop, { x: 'year', y: 'rank', z: 'market' }),
      glMutedPoint(backdrop, { x: 'year', y: 'rank' }),
      ...focus.flatMap((s) => [
        glLine(s.rows, { x: 'year', y: 'rank', z: 'market', tone: s.tone, focus: true }),
        glPoint(s.rows, { x: 'year', y: 'rank', tone: s.tone }),
      ]),
      ...endLabels(focus, { x: 'year', y: 'rank' }),
    ],
    // Padded a third of a year either side: every year carries a 6px dot, and the
    // endpoints' dots would otherwise straddle the axis lines.
    x: yearAxisFor(ranked, 'year', {
      domain: [FIRST_YEAR - 0.3, LATEST_YEAR + 0.3],
      nice: false,
    }),
    // High-to-low, so rank 1 is at the top. `nice: false` because the domain is
    // the rank range exactly — nicening it would invent a rank 0 and a rank 13.
    y: glAxisY({
      label: 'Rank among Vietnam’s destination markets',
      domain: [markets.length + 0.4, 0.6],
      values: markets.map((_, i) => i + 1),
      nice: false,
    }),
    endLabels: true,
  });

  return (
    <GLFigure
      title="Japan was Vietnam's largest market for eight years; it is now fourth."
      subtitle={`Rank by goods exports received, Vietnam's twelve largest destination markets, ${FIRST_YEAR}–${LATEST_YEAR}`}
      source={withNote(
        PARTNERS,
        'Ranks are computed among the markets with a reported figure in each year; the United Arab Emirates has none before 2000',
      )}
    >
      <Chart {...chart.props} height={300} ariaLabel="Destination market ranks over time" />
    </GLFigure>
  );
}
// #endregion

// ════════════════════════════════════════════════════════════════════════════

const demos: Demo[] = [
  {
    id: 'spec-01-lollipop',
    family: 'Bars and Rankings',
    name: 'Lollipop over ranked categories',
    question: 'Which Southeast Asian economy climbed furthest up the complexity ranking?',
    rule: '§3.4.2 — a stem is DATA, so it takes the series tone at line weight, not the dashed ink-3 of a reference rule.',
    render: ComplexityRankGains,
    gaps: [
      'A rank change is only comparable if the ranked field is fixed, and the Atlas’ is not: 139 economies were ranked in 1995 and 144 in 2023. The library has no way to express “this axis measures a moving denominator”, so the caveat lives in the source line where a reader may or may not look. A chart-level caveat slot next to the subtitle would be the honest home for it.',
    ],
  },
  {
    id: 'spec-02-dumbbell',
    family: 'Bars and Rankings',
    name: 'Dumbbell between two states',
    question: 'How far did each economy in the region move on complexity in a generation?',
    rule: '§3.4.2 / §3.3 — a connector strokes an assembled glyph, so it takes the DARK tone rather than a series line’s main.',
    render: ComplexityThenAndNow,
    gaps: [
      'Every economy in the cohort moved the same direction, so the specimen’s backwards-mover case is not exercised by the Atlas at this grain. Widening to all 146 economies would exercise it but abandons the band axis — 146 rows is a distribution, not a dumbbell.',
      'The two endpoints are distinguished only by tone, and the legend has to say which is which. §3.12 would prefer a direct label on the first and last point of one row, but `endLabels` labels a SERIES at its last x, not a row at each end of its own connector, so there is no compose helper for it.',
      'Vietnam’s 1995 ECI (−0.998) is the domain minimum, so its dot straddles the y axis — the token audit flags it starting 5.6px left of the frame. Same shortfall as the slopegraph: there is no domain-padding convention for a mark that lands exactly on the plot edge, and real data lands there whenever the extreme value is the one the chart is about.',
    ],
  },
  {
    id: 'spec-16-waterfall',
    family: 'Bars and Rankings',
    name: 'Waterfall bridge',
    question: 'What produced the $216bn increase in Vietnam’s exports over the last decade?',
    rule: '§3.6 — every bar follows the sign encoding, the total and the netted residual included.',
    render: ExportGrowthBridge,
    gaps: [
      'Three of this chart\'s six category labels do not appear. Atlas sector names are long — "Textiles, garments, footwear and furniture" is one category — and a waterfall is vertical by construction, so they sit on a band axis that §3.5 forbids rotating; TanStack silently drops the ticks that would overlap, so "Machinery and instruments", "Textiles, garments, footwear and furniture" and "Minerals, fuels, ores and salts" render as nothing at all. Half the bars on the chart are therefore unlabelled with no indication that a label was ever meant to be there, which is worse than a collision because a collision is visible. gl-charts offers no tick wrapping, no two-line tick and no measured-label axis, so there is nothing to reach for.',
      'Five of the nine sectors are netted into one step because ten of these labels would be hopeless. The aggregation is a workaround for the missing axis feature above, and it costs the chart the fact that exactly one sector shrank — the reader can see one red bar but cannot see that nothing else fell.',
      'The netted "5 other sectors" step is positive, so §3.6 paints it blue like any other gain — correct by the rule, but it makes a synthesised bucket indistinguishable from a measured sector. The spec has no convention for marking an aggregate step in a bridge.',
    ],
  },
  {
    id: 'spec-19-ranked-barx',
    family: 'Bars and Rankings',
    name: 'Horizontal ranked bars with the pop-up effect',
    question: 'Where do Vietnam’s exports actually go?',
    rule: '§3.1 — mute everything and let one bar carry the finding.',
    render: DestinationMarkets,
    gaps: [
      'The bar values are not labelled, so the reader estimates $86bn against $95bn off gridlines. §3.12 prefers a direct value label on a ranked bar, but `endLabels` places one label per SERIES at its last x — on a bar chart every row is its own category, and passing `at: "all"` labels every row with the series key rather than its value. A `valueLabels` helper that reads the measure and places it just past the bar end is the missing piece.',
      'The left margin is a hand-chosen constant (168px). The library has no label-measuring axis, so every horizontal ranking on this page had to guess a margin and be checked by eye.',
      'The source line reads "1995–2023" for a chart that shows only 2023. `sourceOf` derives the span from the table’s own metadata, which is right for provenance and wrong for this figure — the partner table covers 29 years and this cross-section reads one of them. There is no way to tell `sourceOf` which slice was actually taken, so the year has to be repeated in the subtitle to keep the figure honest.',
    ],
  },
  {
    id: 'ts-bar-horizontal-ranking',
    family: 'Bars and Rankings',
    name: 'Horizontal ranking with long labels',
    question: 'What are the ten largest single products Vietnam exports?',
    rule: '§3.5 — long category names read left-to-right, never rotated 90°.',
    render: LargestProducts,
    gaps: [
      'The Atlas short name for the largest product is fifty characters ("Transmission apparatus for radio, telephone and TV") and the full name is 213. Every label does render, but only because the left margin was widened to 300px by hand — 47% of the figure, so the plot and the labels get roughly half each. There is no truncation, ellipsis or wrap the library can apply, because doing any of those to a category name is a design decision the spec has not made; and nothing warns the author when the margin is too small, the labels just disappear (see the waterfall). The synthetic specimen’s longest label was 33 characters and never forced the question.',
      'Same missing value-label helper as the destination-market ranking: a ranked bar without its number makes the reader measure a 34.3 against gridlines.',
    ],
  },
  {
    id: 'ts-bar-grouped',
    family: 'Bars and Rankings',
    name: 'Grouped bars',
    question: 'Which economies in the region broadened their export basket, and which narrowed it?',
    rule: '§8c — three periods of ONE ordered variable walk light → main → dark.',
    render: DiversitySnapshots,
    gaps: [
      'The middle period is an editorial choice — the Atlas has all 29 years and the chart shows 3. The form cannot hold more, which is the trade the grouped bar makes; the line chart in the Lines family is the answer when the intervening years matter.',
    ],
  },
  {
    id: 'ts-bar-stacked',
    family: 'Bars and Rankings',
    name: 'Stacked bars',
    question: 'Did Vietnam’s biggest products become ones it is actually competitive in?',
    rule: 'The 1px inter-segment gap is CSS — barY exposes no stroke and its inset trims width, not height.',
    render: AdvantageTiers,
    gaps: [
      'The stack covers only twelve products, because `lead-product-panel` is the only table with a product-level time dimension. Vietnam exported 1,199 products in 2023; the other 1,187 have no history in this extract, so the totals here are not the export basket and the subtitle has to say so.',
      'Two of the seven bars have an empty bottom segment (no product was below RCA 1 in 2020 or 2023). A zero-height segment is drawn as nothing, so the reader cannot distinguish "this tier is empty" from "this tier was never in the chart" — the legend is the only thing that says three tiers exist. The library has no convention for a present-but-zero stack segment.',
      'These twelve products grew from $0.3bn to $140bn, so on the linear axis a stack requires, the first four bars are slivers a few pixels tall and their composition cannot be read at all. `glAxisLog` is the answer to that skew everywhere else on this page and is unavailable here by construction: a stack’s segments have to sum to the bar, and on a log axis they do not. The honest alternatives are a normalized stack (which throws away the levels this chart is partly about) or two figures.',
    ],
  },
  {
    id: 'ts-59-grouped-reducer-bars',
    family: 'Bars and Rankings',
    name: 'Bars whose height is a computed mean',
    question: 'How much of a region’s complexity is explained by how rich its economies are?',
    rule: '§8b — two categories sharing a parent are one hue at main + light.',
    render: ComplexityByIncomeTier,
    gaps: [
      'Africa has no high-income economy in the Atlas’ 146, so its group holds one bar where every other region holds two. `group()` does the right thing — the empty sub-band is reserved, so the surviving bar stays in the slot its tone says it belongs to — but nothing on the chart says the missing bar is missing rather than zero. §3.9 has a convention for an absent VALUE (a broken line) and none for an absent CATEGORY, and a mean of no observations is not a zero.',
      'Oceania contributes three economies (one outside the high-income tier, two inside), so two of its bars are means over one and two observations. A bar whose height is a statistic ought to be able to declare its n; there is no channel for that, and the count only reaches the reader if the subtitle carries it.',
    ],
  },
  {
    id: 'ts-71-population-pyramid',
    family: 'Bars and Rankings',
    name: 'Population pyramid',
    question:
      'Are the products Vietnam is competitive in the complex ones, or the simple ones?',
    rule: '§8b — advantage is not a sign, so this must not reach for signColor().',
    render: ComplexityPyramid,
    gaps: [
      'The x axis labels the signed value, so the left wing reads negative. A mirrored axis that labels both wings positive is one formatter, and the library has no way to express "format the absolute value but keep the sign for placement" other than the plate passing `Math.abs` itself — which it does. That works and is invisible to a reader; it is recorded because the next chart that needs it will write it again.',
      'The Atlas holds no age or sex data at all, so the demographic subject of this form cannot be drawn from it honestly. The nearest true framing is the population of *products*: complexity bands stand in for age bands and comparative advantage for sex. The geometry, the diverging stack and the §8b colour rule are all exercised; the subject is not the specimen’s.',
      'The complexity bands are unit-wide because PCI has no published bracket, and the top and bottom bands hold five products between them — so the pyramid has two near-invisible rows that still consume a full band slot. `binValues` would choose widths by Freedman–Diaconis, but a band axis needs the bins as labelled categories and there is no helper that turns bins into a band domain.',
    ],
  },
  {
    id: 'ts-72-mixed-bars',
    family: 'Bars and Rankings',
    name: 'A stack and a line in one frame',
    question: 'Would Vietnam have overtaken Thailand without electronics?',
    rule: '§8b — the stack is one hue in two tones, so the line can take a second.',
    render: ElectronicsAgainstThailand,
    gaps: [
      'The line and the stack share one y axis, which is what makes the comparison legitimate — but it also means this form is unavailable for the pairing an Atlas reader most often wants (a level against an index, exports against ECI). gl-charts exposes a single y axis and no secondary-axis preset, and the spec is silent on whether it should; drawing the pair would require inventing the rule.',
      'The x axis samples every fourth year because a band scale spaces categories evenly whatever their values. A continuous year axis would show the real spacing but bars on a linear scale straddle the axis lines, which is exactly why `glAxisYearBand` exists. The two cannot both be satisfied, so 21 of the 29 years are not on this chart.',
    ],
  },
  {
    id: 'ts-54-bump-ranking',
    family: 'Bars and Rankings',
    name: 'Bump chart — rank over time',
    question: 'Which of Vietnam’s export markets changed places, and when?',
    rule: '§3.5 — rank 1 belongs at the top, so the y domain is pinned high-to-low.',
    render: MarketRanks,
    gaps: [
      'The end label reads "United States of America". `glChart({ endLabels: true })` widens the right margin to a fixed 72px (`glMarginEndLabels`), the label is placed at x=571 in a 640-wide frame, and roughly 140px of it renders outside the figure — the chart SVG is `overflow: visible`, so it spills over the source line rather than being clipped. The margin is a constant rather than a function of the labels it has to hold, which was invisible with synthetic series named "Construction" and "Manufacturing". Widening it at this call site would hide the defect; the fix is for `endLabels: true` to size the margin from the label text.',
      'The partner panel is unbalanced: the United Arab Emirates has no rows before 2000, so 1995–1999 rank eleven markets and 2000 onward rank twelve. Its line correctly starts in 2000, but every other market’s rank silently shifts by one that year for a reason no mark on the chart explains.',
      'Twelve muted series cross repeatedly in the middle of the plot and are indistinguishable from one another there — the backdrop shows the shape of the field but no individual path can be followed. That is the pop-up effect working as designed; it is recorded because a reader who wants to trace a third market has no way to.',
    ],
  },
];

export const barsFamily: Family = {
  slug: 'bars-and-rankings',
  title: 'Bars and Rankings',
  blurb:
    'Magnitude and order — the two questions an atlas gets asked most. Every chart here is a length measured from a baseline, so the axis always starts at zero and long country and product names are set to be read, never rotated.',
  demos,
};

export function renderBars(): Record<string, () => ReactNode> {
  return Object.fromEntries(demos.map((d) => [d.id, d.render]));
}
