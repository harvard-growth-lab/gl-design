/**
 * Scatterplots and Relationships — seven catalog forms, drawn from the Atlas
 * country panel and the HS92 product tables.
 *
 * A scatter is the form the Atlas is built on: the whole complexity programme is
 * the claim that one measured quantity predicts another. So this family is where
 * the real data changes the *finding* rather than just the picture, in four ways:
 *
 * 1. **The relationships are weaker than a synthetic plate's.** Income explains
 *    61% of complexity, not 95%, and one of the seven pairs plotted here turns
 *    out to have no relationship at all. A fit through real economics is a claim with a
 *    residual, and the residual is usually the interesting part — which is why
 *    the regression demo reports its r² in the title rather than in a caption.
 *
 * 2. **The Atlas is annual, and a lag plot wants a long series.** `lagPairs`
 *    takes a flat array, so the panel has to be split per country *and* per run
 *    of consecutive years before it is handed over, or the plot silently claims
 *    an observation that straddles a missing year.
 *
 * 3. **Product data is log-normal over six orders of magnitude.** World trade in
 *    an HS92 line runs from $2.9m to $1.05tn. On a linear axis that is one point
 *    and 1,239 slivers; `glAxisLog` is not a preference here, it is the only way
 *    the chart exists.
 *
 * 4. **Density is real.** §3.4's "fill and stroke both at 0.8" was calibrated on
 *    400 points. Vietnam's basket is 1,199 of them, whose circles together cover
 *    more area than the plot they sit in, so the core saturates. That is
 *    recorded rather than thinned.
 *
 * Contract, unchanged: no hex, no font size, no stroke width, no opacity below.
 * Data preparation is authored; appearance never is.
 */

import type { ReactNode } from 'react';
import { Chart } from '@tanstack/react-charts';

import {
  clearOf,
  clearance,
  endLabels,
  glArrow,
  glAxisLog,
  glAxisX,
  glAxisY,
  glChart,
  glLabel,
  glLine,
  glMutedPoint,
  glPoint,
  glRuleY,
  lagPairs,
  linearFit,
  popUp,
} from '../src/index.js';
import { GLFigure, GLLegend } from '../src/figure.js';

import {
  FIRST_YEAR,
  LATEST_YEAR,
  LEAD,
  countryName,
  countryYear,
  countryYearTable,
  crossSection,
  defined,
  leadProductYearTable,
  leadProducts,
  productNodes,
  productSpaceNodesTable,
  seriesFor,
  sourceOf,
  usd,
  withNote,
} from './atlas-data.js';
import type { Demo, Family } from './demo.js';

const PANEL = sourceOf(countryYearTable);
const NODES = sourceOf(productSpaceNodesTable);
const BASKET = sourceOf(leadProductYearTable);

/** Thousands separators, pinned to one locale so the page renders the same everywhere. */
const count = (n: number): string => n.toLocaleString('en-US');

// ════════════════════════════════════════════════════════════════════════════

// #region demo:spec-11-regression
/**
 * The Atlas's founding scatter, with the estimate drawn on it.
 *
 * §3.10 splits a line into chrome and data by asking what it is *for*. This one
 * is the estimate the chart is about — it is the answer to "how much of
 * complexity is income?" — so it is DATA: `glLine` in the series hue at focus
 * weight, not a dashed `ink-3` rule. `linearFit` hands back the two fitted
 * endpoints already computed, so drawing it is one mark.
 *
 * The x channel is log₁₀ of GDP per capita rather than dollars, because that is
 * the space the regression is fitted in: complexity is linear in *log* income,
 * and a fit drawn against a variable it was not fitted against is not the fit.
 * Doing it this way puts the transform where the reader can see it.
 */
function ComplexityAgainstIncome() {
  // Cuba has no GDP figure in this release; `defined` drops it here rather than
  // letting a `?? 0` put a $0-per-capita economy at the left edge.
  const rows = defined(defined(crossSection(LATEST_YEAR), 'eci'), 'gdpPerCapita').map((d) => ({
    country: countryName(d.iso3),
    logIncome: Math.log10(d.gdpPerCapita),
    eci: d.eci,
  }));

  const fit = linearFit(rows, { x: 'logIncome', y: 'eci' });

  const chart = glChart({
    marks: [
      glMutedPoint(rows, { x: 'logIncome', y: 'eci' }),
      ...(fit ? [glLine(fit.endpoints, { x: 'x', y: 'y', tone: 'c-1', focus: true })] : []),
    ],
    x: glAxisX({ label: 'GDP per capita (log₁₀ of current USD)' }),
    y: glAxisY({ label: 'Economic Complexity Index' }),
  });

  return (
    <GLFigure
      title={`Complexity rises with income, but income explains only ${Math.round(
        (fit?.r2 ?? 0) * 100,
      )}% of it.`}
      subtitle={`Economic Complexity Index against GDP per capita, ${rows.length} economies, ${LATEST_YEAR}; ordinary least squares`}
      source={withNote(PANEL, `${LATEST_YEAR} cross-section; Cuba has no GDP figure and is dropped`)}
      legend={
        <GLLegend
          items={[
            { label: 'Economy', tone: 'muted', mark: 'point' },
            { label: 'Ordinary least squares', tone: 'c-1', mark: 'line', focus: true },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={250} ariaLabel="Complexity against income with a fitted line" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-scatter-bubble
/**
 * The same two variables with a third on the size channel — and the reason the
 * radius passes through a square root.
 *
 * TanStack applies no size scale: `r` is a pixel radius, so a radius set to the
 * quantity encodes it as *area squared*. On this data that is not a rounding
 * error — India is 1,553 times Cyprus's population, and drawing radius ∝
 * population would make its circle 1,553 times as wide instead of 39 times.
 * The square root is the whole encoding, and nothing in the library enforces it.
 *
 * The label offset comes from `clearOf(r)`, which reads back the same radius
 * accessor the mark used. A fixed 8px gap is fine for a 6px dot and lands well
 * *inside* India's 23px bubble.
 */
function IncomeComplexityPopulation() {
  const rows = defined(
    defined(defined(crossSection(LATEST_YEAR), 'eci'), 'gdpPerCapita'),
    'population',
  ).map((d) => ({
    country: countryName(d.iso3),
    income: d.gdpPerCapita,
    eci: d.eci,
    population: d.population,
  }));

  // Area ∝ population. The floor keeps the smallest economies from vanishing;
  // the multiplier sets the largest bubble at about 23px, which is as wide as a
  // 250px plot can carry without the cloud becoming one shape.
  const r = (d: (typeof rows)[number]) => 2 + Math.sqrt(d.population / 1e6) * 0.55;

  const { backdrop, focus } = popUp(rows, {
    by: 'country',
    highlight: [countryName(LEAD), countryName('IND')],
  });

  const incomes = rows.map((d) => d.income);
  const ecis = rows.map((d) => d.eci);
  // Both domains are padded past the data, because a mark with a fixed PIXEL
  // extent is wider than its datum and TanStack infers a domain from values
  // alone. On the log axis the padding is MULTIPLICATIVE — half a bubble is a
  // ratio there, not a difference. `nice` does not help either way: nicening
  // rounds to a tick and the extreme datum can land exactly on it.
  const pad = (Math.max(...ecis) - Math.min(...ecis)) * 0.15;

  const chart = glChart({
    marks: [
      glMutedPoint(backdrop, { x: 'income', y: 'eci', r }),
      ...focus.map((s) => glPoint(s.rows, { x: 'income', y: 'eci', r, tone: s.tone })),
      ...endLabels(focus, {
        x: 'income',
        y: 'eci',
        at: 'all',
        anchor: 'end',
        dx: clearOf(r),
      }),
    ],
    x: glAxisLog({
      label: 'GDP per capita (current USD, log scale)',
      domain: [Math.min(...incomes) / 1.4, Math.max(...incomes) * 1.4],
      tickCount: 10,
    }),
    y: glAxisY({
      label: 'Economic Complexity Index',
      domain: [Math.min(...ecis) - pad, Math.max(...ecis) + pad],
    }),
    variant: { labelHalo: true },
  });

  return (
    <GLFigure
      title="Vietnam and India make far more complex things than their incomes predict."
      subtitle={`Economic Complexity Index against GDP per capita, bubble area ∝ population, ${rows.length} economies, ${LATEST_YEAR}`}
      source={withNote(
        PANEL,
        `${LATEST_YEAR} cross-section; Cuba has no GDP or population figure and is dropped`,
      )}
    >
      <Chart
        {...chart.props}
        height={250}
        ariaLabel="Complexity against income, sized by population"
      />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-53-log-scale-scatter
/**
 * Six orders of magnitude on one axis.
 *
 * TanStack ships no log scale at all (`@tanstack/charts-scales` is band, linear,
 * ordinal and point), so `glAxisLog` wires up the one in `scales.ts`: the domain
 * rounds outward to 1–2–5 bounds and the ticks land on 1–2–5 steps, thinning to
 * decades when a multi-decade span would otherwise crowd. Six decades is well
 * past that threshold, so what comes back is one tick per decade, formatted by
 * the page's own `usd` so a reader never has to convert "millions" in their head.
 *
 * On a linear axis this is a single point at the right edge and 1,239 stacked
 * against the left. World trade in an HS92 line runs from $2.9m to $1.05tn — the
 * collapse a log axis exists to prevent is not hypothetical here.
 */
function WorldTradeAgainstComplexity() {
  const rows = defined(defined(productNodes, 'exportValueM'), 'pci');
  const trade = rows.map((d) => d.exportValueM);

  const chart = glChart({
    marks: [glPoint(rows, { x: 'exportValueM', y: 'pci' })],
    x: glAxisLog({
      label: 'World trade in the product (log scale)',
      // Padded MULTIPLICATIVELY, for the same reason the bubble chart is: half a
      // circle on a log axis is a ratio, not a difference.
      domain: [Math.min(...trade) / 1.7, Math.max(...trade) * 1.7],
      format: usd,
    }),
    y: glAxisY({ label: 'Product Complexity Index (PCI)' }),
  });

  return (
    <GLFigure
      title="How much of a product the world trades says nothing about how complex it is."
      subtitle={`${count(rows.length)} HS92 4-digit products, ${LATEST_YEAR}; world trade on a log scale`}
      source={withNote(NODES, 'One product with no recorded world trade is dropped')}
    >
      <Chart
        {...chart.props}
        height={250}
        ariaLabel="Product complexity against world trade on a log scale"
      />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-56-connected-scatter
/**
 * A path through a two-dimensional state space, with time as direction rather
 * than as an axis.
 *
 * The two indices are the Atlas's own pair: ECI is where an economy's
 * capabilities *are*, COI is what those capabilities put within reach. Plotting
 * one against the other over thirty years asks whether getting more complex uses
 * up the opportunity to get more complex — and Vietnam's answer doubles back on
 * itself five times, which is exactly the condition arrowheads are for. §3.4.2
 * pins the head at 8px for the related reason: a head that grew with the step
 * length would encode the year's magnitude a second time.
 */
function ComplexityOpportunityPath() {
  const path = defined(defined(seriesFor(LEAD), 'eci'), 'coi');

  // One arrow per year-to-year step: the mark is the SEGMENT, so the path has to
  // be rewritten as pairs of endpoints rather than handed over as a series.
  const segments = path.slice(0, -1).map((d, i) => ({
    year: d.year,
    x1: d.eci,
    y1: d.coi,
    x2: path[i + 1].eci,
    y2: path[i + 1].coi,
  }));

  // Every fifth year plus the last one — enough to date the path without
  // labelling twenty-nine points.
  const marked = path.filter((d) => d.year % 5 === 0 || d.year === LATEST_YEAR);

  const ecis = path.map((d) => d.eci);
  const cois = path.map((d) => d.coi);
  const padX = (Math.max(...ecis) - Math.min(...ecis)) * 0.12;
  const padY = (Math.max(...cois) - Math.min(...cois)) * 0.12;

  const chart = glChart({
    marks: [
      glArrow(segments, { x1: 'x1', y1: 'y1', x2: 'x2', y2: 'y2', tone: 'muted' }),
      glPoint(marked, { x: 'eci', y: 'coi', tone: 'c-1' }),
      glLabel(marked, {
        x: 'eci',
        y: 'coi',
        text: (d) => String(d.year),
        tone: 'c-1',
        // `clearance` returns the anchor and the offset together, measured from
        // the mark's EDGE, so the two cannot disagree about which side the label
        // is on.
        ...clearance('right'),
      }),
    ],
    x: glAxisX({
      label: 'Economic Complexity Index',
      domain: [Math.min(...ecis) - padX, Math.max(...ecis) + padX],
    }),
    y: glAxisY({
      label: 'Complexity Opportunity Index',
      domain: [Math.min(...cois) - padY, Math.max(...cois) + padY],
    }),
    variant: { labelHalo: true },
  });

  return (
    <GLFigure
      title="Vietnam kept getting more complex; its room to keep going peaked in 2011."
      subtitle={`Complexity opportunity against complexity, ${countryName(LEAD)}, ${FIRST_YEAR}–${LATEST_YEAR}; arrows run forward in time`}
      source={PANEL}
    >
      <Chart
        {...chart.props}
        height={260}
        ariaLabel="Vietnam's path through complexity and opportunity"
      />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-60-lag-autocorrelation
/**
 * Every observation against the one before it — the question "how much does last
 * year tell you about this year?", asked of the whole panel.
 *
 * The shaping is the interesting half. `lagPairs` takes a flat array, so handing
 * it the panel's ECI column would pair Zimbabwe's first year against Zambia's
 * last and then pair across every year the Atlas has no ECI for. Both are
 * fabricated observations. So the column is split per country and then per RUN
 * OF CONSECUTIVE YEARS, and `lagPairs` is called on each run.
 *
 * The reference is the specimen. It is a *reference* — nothing was measured
 * along it, the reader brought it — so §3.4.2 makes it chrome and `glRuleY`
 * refuses a series hue outright. See the recorded gap for why it is horizontal
 * rather than at 45°, which on this data is the wrong line in the right style.
 */
function ComplexityLagPlot() {
  const isos = [...new Set(countryYear.map((d) => d.iso3))];

  const pairs = isos.flatMap((iso) => {
    const rows = defined(seriesFor(iso), 'eci');
    const runs: number[][] = [];
    rows.forEach((d, i) => {
      if (i === 0 || d.year !== rows[i - 1].year + 1) runs.push([]);
      runs[runs.length - 1].push(d.eci);
    });
    return runs.flatMap((run) => lagPairs(run, 1));
  });

  const values = pairs.flatMap((p) => [p.x, p.y]);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;

  // Pearson r, so the title can state the strength rather than gesture at it.
  const dx = pairs.map((p) => p.x - mean);
  const dy = pairs.map((p) => p.y - mean);
  const r =
    dx.reduce((s, v, i) => s + v * dy[i], 0) /
    Math.sqrt(dx.reduce((s, v) => s + v * v, 0) * dy.reduce((s, v) => s + v * v, 0));

  // One domain for both axes. A lag plot is read against the identity line, and
  // a lag plot whose axes have different scales cannot be.
  const lo = Math.min(...values) - 0.3;
  const hi = Math.max(...values) + 0.3;

  const chart = glChart({
    marks: [
      glRuleY([mean], { y: (d: number) => d }),
      glPoint(pairs, { x: 'x', y: 'y' }),
    ],
    x: glAxisX({ label: 'Economic Complexity Index, year t − 1', domain: [lo, hi] }),
    y: glAxisY({ label: 'Economic Complexity Index, year t', domain: [lo, hi] }),
  });

  return (
    <GLFigure
      title="A country's complexity next year is almost exactly its complexity this year."
      subtitle={`${count(pairs.length)} consecutive-year pairs across ${isos.length} economies, ${FIRST_YEAR}–${LATEST_YEAR}; r = ${r.toFixed(2)}. The dashed rule is the panel mean`}
      source={withNote(PANEL, 'Pairs are built within a country and never across a missing year')}
    >
      <Chart {...chart.props} height={250} ariaLabel="Lag-one autocorrelation of economic complexity" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-73-many-point-scatter
/**
 * Twelve hundred points with heavy overplotting.
 *
 * This is the plate that justifies §3.4's most-questioned rule: scatter fill AND
 * stroke both at 0.8. Matching them is the point — overlapping circles then
 * darken *together* into a density signal instead of one layer punching through
 * the other. Reduce only the fill and every circle keeps a hard dark edge, so a
 * pile of forty reads exactly like a pile of four.
 *
 * The Atlas makes the test harder than the synthetic plate did — not because the
 * points spread badly, but because there are three times as many of them. Twelve
 * hundred circles at the spec's 6px radius have more total area than the plot
 * they sit in, so the middle of the cloud is guaranteed to saturate however the
 * axis is scaled.
 */
function BasketDensity() {
  const rows = defined(defined(leadProducts, 'distance'), 'pci');

  const chart = glChart({
    marks: [glPoint(rows, { x: 'distance', y: 'pci' })],
    x: glAxisX({ label: `Distance from ${countryName(LEAD)}'s current capabilities` }),
    y: glAxisY({ label: 'Product Complexity Index (PCI)' }),
  });

  return (
    <GLFigure
      title="The products Vietnam is furthest from making are, on the whole, the complex ones."
      subtitle={`${count(rows.length)} HS92 4-digit products in ${countryName(LEAD)}'s ${LATEST_YEAR} basket; overlapping marks darken into density`}
      source={BASKET}
    >
      <Chart {...chart.props} height={250} ariaLabel="Product complexity against distance" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-44-framed-scatter
/**
 * TanStack's demonstration that a chart can drop its axes, answered rather than
 * reproduced.
 *
 * The GL answer is no, and this plate is what that refusal looks like. §3.5 puts
 * an axis line on both dimensions and gridlines on the one the reader estimates
 * values from; a frame instead of axes leaves them with a box and no way to read
 * a value off it. So the demo keeps its axes and draws the scatter the frame was
 * drawn around.
 *
 * The pair is the Atlas's own diagnostic: an economy high on both indices is
 * complex *and* still has somewhere to go. Germany — sixth on complexity, last
 * of all 146 on opportunity — sits alone at the bottom right and is the chart's
 * argument for itself: inside a frame it is a dot near a corner, and only the
 * two labelled axes make it a finding.
 */
function OpportunityAgainstComplexity() {
  const rows = defined(defined(crossSection(LATEST_YEAR), 'eci'), 'coi').map((d) => ({
    country: countryName(d.iso3),
    eci: d.eci,
    coi: d.coi,
  }));

  const chart = glChart({
    marks: [glPoint(rows, { x: 'eci', y: 'coi' })],
    x: glAxisX({ label: 'Economic Complexity Index' }),
    y: glAxisY({ label: 'Complexity Opportunity Index' }),
  });

  return (
    <GLFigure
      title="A frame is not an axis, and the reader needs an axis."
      subtitle={`Complexity opportunity against complexity, ${rows.length} economies, ${LATEST_YEAR}; the same scatter TanStack draws guide-free`}
      source={withNote(PANEL, `${LATEST_YEAR} cross-section`)}
    >
      <Chart
        {...chart.props}
        height={240}
        ariaLabel="Complexity opportunity against complexity, with axes rather than a frame"
      />
    </GLFigure>
  );
}
// #endregion

// ════════════════════════════════════════════════════════════════════════════

const demos: Demo[] = [
  {
    id: 'spec-11-regression',
    family: 'Scatterplots and Relationships',
    name: 'Scatter with a fitted line',
    question: 'How much of an economy’s complexity is explained by how rich it is?',
    rule: '§3.10 — the fit is the estimate the chart is about, so it is data, not chrome.',
    render: ComplexityAgainstIncome,
    gaps: [
      'The x axis carries log₁₀ dollars rather than dollars. `linearFit` fits in whatever space it is handed and knows nothing about the axis the result will be drawn on, so a `glAxisLog` x with dollar ticks would mean mapping the fitted endpoints back through 10ˣ at the call site — correct, because the log axis is linear in log₁₀, but entirely on trust. A transform-aware fit (or a `fitOn: "log"` option) belongs in compose.ts.',
      'The fit has no interval. `linearFit` returns slope, intercept, r² and two endpoints; there is nothing to hand `glBand`, so §3.9’s uncertainty rules have nothing to draw and a fit with r² = 0.61 is displayed exactly as confidently as one with r² = 0.99.',
    ],
  },
  {
    id: 'ts-scatter-bubble',
    family: 'Scatterplots and Relationships',
    name: 'Bubble scatter — a third variable on size',
    question: 'Which economies are more complex than their income predicts, and how many people live in them?',
    rule: 'Radius takes the square root, or the value is encoded as area SQUARED.',
    render: IncomeComplexityPopulation,
    gaps: [
      'gl-charts ships no size scale. `r` is a raw pixel radius, so the square root, the floor and the multiplier are all chosen at the call site and nothing audits them — the single most common bubble-chart error (radius set to the value) is one keystroke away and would render without a warning. A `sizeScale(values, { maxRadius })` returning the accessor belongs in compose.ts.',
      'There is no size legend and no way to build one. `GLLegend` draws every mark at one fixed size, so the chart can say what the bubble area means only in its subtitle. With population spanning 926,000 to 1.44bn that is a real loss: the reader can rank the bubbles but cannot value them.',
      'The y domain is padded by a hand-chosen fraction of the data range because the largest bubble’s radius is known in pixels and the domain is in ECI units, and nothing in the library can convert between them before layout. Every bubble chart in this package therefore pads its domains by eye.',
    ],
  },
  {
    id: 'ts-53-log-scale-scatter',
    family: 'Scatterplots and Relationships',
    name: 'Log-scale scatter',
    question: 'Do the products the world trades most of tend to be the complex ones?',
    rule: '§3.5 — a log axis rounds outward to 1–2–5 bounds and ticks on 1–2–5 steps.',
    render: WorldTradeAgainstComplexity,
    gaps: [
      'The span is past the point where `logTicks` thins to decades, so the 1–2–5 set the rule names is not what renders — the axis comes back with one tick per decade, $1m through $1.0tn. That is the right call here, but the thinning is automatic and silent: there is no way to ask for the intermediate ticks back, and nothing on the chart says they were dropped.',
      '`scaleLog` maps non-positive values to `undefined` and TanStack drops them. Nothing reports the count. No product here trades zero, so nothing is lost — but a dataset with zeros would lose points invisibly, which is the failure mode a log axis is most prone to.',
    ],
  },
  {
    id: 'ts-56-connected-scatter',
    family: 'Scatterplots and Relationships',
    name: 'Connected scatter — a path through a state space',
    question: 'Does getting more complex use up an economy’s opportunity to get more complex?',
    rule: '§3.4.2 — the 8px arrowhead is pinned; a scaled head encodes the value twice.',
    render: ComplexityOpportunityPath,
    gaps: [
      'The synthetic path crossed itself twice, which is the strongest case for arrowheads. Vietnam’s does not — it reverses in x five times but never crosses itself — so the heads are doing less work here than the specimen implies. That is the honest Atlas answer rather than a shortfall to fix: 29 annual observations are too few to knot, and no amount of library work changes that.',
      'The head length is pinned in pixels and the segment length comes from the data, so the two are unrelated. Between 2006 and 2008 the path barely moves and the head is a large fraction of the whole segment; over 2017–2018 it is a tenth of one. §3.4.2 pins the head for a good reason and there is no companion rule for what to do when a step is shorter than its own head.',
      'The year labels are placed by `clearance(\'right\')`, which offsets from the mark’s edge but has no idea what else is nearby. Labelling every fifth year keeps them apart here; labelling every year would not, and the collision would look exactly like the `endLabels` one already recorded on the Lines family. Placement is per-mark, and nothing in compose.ts looks at the set.',
    ],
  },
  {
    id: 'ts-60-lag-autocorrelation',
    family: 'Scatterplots and Relationships',
    name: 'Lag-one autocorrelation',
    question: 'How much does an economy’s complexity this year tell you about next year’s?',
    rule: '§3.4.2 — a reference line is chrome, and glRuleY ignores tone outright.',
    render: ComplexityLagPlot,
    gaps: [
      'The reference is drawn as a horizontal rule at the series mean rather than as the 45° identity line the entry uses. TanStack rules ignore their endpoint channels and always span the plot (`constraints.test.ts` §7), so a diagonal cannot be a rule — and drawing it with `glLine` would make it DATA under §3.4.2, which is exactly the confusion the chrome/data split exists to prevent. A `glRuleDiagonal` built on `link` (the way `glStemX` is) would close it.',
      'The real data makes that gap worse, not better. At r = 0.98 the cloud lies almost exactly on the identity line, so the one reference the reader needs is the one that cannot be drawn — and the rule that can be drawn runs perpendicular to the structure it is meant to reference. On the synthetic plate the mean rule was merely unhelpful; here it is actively the wrong line.',
      '`lagPairs` takes a flat array of values, so it cannot know about panel structure or about gaps in a series. Splitting the panel per country and per run of consecutive years is done in the demo, by hand, and any caller who forgets will get pairs that straddle a country boundary or a missing year with no warning. A `lagPairs(rows, { by, x, y })` overload would make the correct thing the easy one.',
    ],
  },
  {
    id: 'ts-73-many-point-scatter',
    family: 'Scatterplots and Relationships',
    name: 'Many-point scatter',
    question: 'Are the products Vietnam is furthest from making the complex ones?',
    rule: '§3.4 — fill AND stroke at 0.8, so overlaps darken together into density.',
    render: BasketDensity,
    gaps: [
      'At 1,199 points the 0.8-on-both rule reaches its limit. Circles at the spec’s 6px radius cover more total area than the plot does, so the middle of the cloud saturates to solid ink and stops carrying any gradient — the density signal works at the fringe and is gone at the core, which is where the reader is looking. §3.4 has no rule for the point at which a scatter should become a binned mark, and although `glHexbin` exists, nothing in the library decides when to reach for it.',
      'A scatter this dense wants opacity to fall as n rises, and the opacity is a pinned token. That is the right default — it is what makes every scatter on this page comparable — but it means the only honest response to over-plotting is to change the mark, not to tune it, and that decision is left entirely to the author.',
    ],
  },
  {
    id: 'ts-44-framed-scatter',
    family: 'Scatterplots and Relationships',
    name: 'The guide-free scatter, answered',
    question: 'Do the most complex economies still have the most room to grow?',
    rule: '§3.5 — a frame is not an axis, and the reader needs an axis.',
    render: OpportunityAgainstComplexity,
    gaps: [
      'This entry is REFUSED rather than built, and the plate is what the refusal looks like. TanStack drops the axes and draws a frame; §3.5 puts an axis line on both dimensions and gridlines on the one values are estimated from, so the GL answer is the same scatter with its guides. `frame` stays unwrapped because a GL chart has no use for it — recorded here so the coverage table shows a decision rather than an omission.',
      'The Atlas data shows the guides are necessary and not sufficient. 146 unlabelled points let the reader read a value off the axes but never say which economy any point is, and the finding — that the most complex economies are not the ones with the most opportunity left — depends on identifying two of them. §3.5 settles the guides and has nothing to say about identification; there is no `annotate(rows, { select })` to pick out the extremes the way `select` does on a time series.',
    ],
  },
];

export const scatterFamily: Family = {
  slug: 'scatterplots-and-relationships',
  title: 'Scatterplots and Relationships',
  blurb:
    'The form the Atlas is built on: every complexity measure is a claim that one quantity predicts another. Income explains about three fifths of complexity, not all of it, so most of these charts show the estimate and how far each country sits from it.',
  demos,
};

export function renderScatter(): Record<string, () => ReactNode> {
  return Object.fromEntries(demos.map((d) => [d.id, d.render]));
}
