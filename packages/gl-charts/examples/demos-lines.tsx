/**
 * Lines and Areas — eight catalog forms, drawn from the Atlas country panel.
 *
 * This is the family where the difference between synthetic and real data shows
 * up most plainly, in three ways worth naming because they recur across the rest
 * of the page:
 *
 * 1. **The Atlas is annual.** The catalog's line specimens are daily series with
 *    a time axis; there is no daily anything in the Atlas. So `timeAxisFor` and
 *    `toEpoch` are not used here — `yearAxisFor` is, and where a form genuinely
 *    depends on sub-annual grain (a 30-day trailing mean) the demo says so in
 *    its gaps rather than inventing days.
 *
 * 2. **Gaps are found, not placed.** The synthetic specimen puts its nulls where
 *    they demonstrate the rule. The real panel has almost none — every ECI and
 *    export series is complete (GDP per capita has 53 nulls; the growth
 *    projection is the column with structure to it) — so the gap demo had to go
 *    looking, and what it found separates two kinds of absence: a column that
 *    does not begin until 2004 for anyone, and Libya's own missing 2015–16. Only
 *    the second is a gap. That is the better demonstration anyway.
 *
 * 3. **The cohort is six, not five.** Every multi-series specimen was authored
 *    against a tidy five-series dataset. Six real economies with real crossings
 *    is a harder legibility test, and the pop-up effect is what makes it survive.
 *
 * Contract, unchanged from the gallery: no hex, no font size, no stroke width,
 * no opacity below. Data preparation is authored; appearance never is.
 */

import type { ReactNode } from 'react';
import { Chart } from '@tanstack/react-charts';
import { select } from '@tanstack/charts';

import {
  endLabels,
  glAxisY,
  glBand,
  glChart,
  glLabel,
  glLine,
  glMutedLine,
  glPoint,
  glRuleY,
  movingAverage,
  popUp,
  toSeries,
  yearAxisFor,
} from '../src/index.js';
import { GLFigure, GLLegend } from '../src/figure.js';

import {
  COHORT,
  FIRST_YEAR,
  LATEST_YEAR,
  countryName,
  countryYear,
  countryYearTable,
  defined,
  leadThresholdsTable,
  seriesFor,
  sourceOf,
  thresholdsFor,
  withNote,
} from './atlas-data.js';
import type { Demo, Family } from './demo.js';

const PANEL = sourceOf(countryYearTable);
const THRESHOLDS = sourceOf(leadThresholdsTable);

// ════════════════════════════════════════════════════════════════════════════

// #region demo:spec-08-band
/**
 * The middle half of a country's export basket, as a band.
 *
 * The Atlas computes the percentiles itself — `country_year_thresholds` carries
 * p25/p50/p75 of every country's product-level distributions per year. Drawing
 * the band straight off those columns rather than re-deriving quantiles from
 * product rows means this chart and the Atlas cannot disagree about what the
 * interquartile range is.
 *
 * §3.9: a band is the LIGHT tone at full opacity, never a translucent main.
 */
function ProductComplexityBand() {
  const rows = thresholdsFor('pci');

  const chart = glChart({
    marks: [
      glBand(rows, { x: 'year', y1: 'p25', y2: 'p75' }),
      glLine(rows, { x: 'year', y: 'p50', focus: true }),
    ],
    x: yearAxisFor(rows, 'year'),
    y: glAxisY({ label: 'Product complexity (PCI)' }),
  });

  return (
    <GLFigure
      title="Vietnam's basket spans the same two full complexity points it did in 1995."
      subtitle={`Median product complexity with the interquartile range, ${FIRST_YEAR}–${LATEST_YEAR}`}
      source={THRESHOLDS}
      legend={
        <GLLegend
          items={[
            { label: 'Median product', tone: 'c-1', mark: 'line', focus: true },
            // `band`, not a light square: §3.9's interval has a fill, and the
            // legend mark carries the same fill the plot does.
            { label: 'Middle 50% of the basket', tone: 'c-1', mark: 'band' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={230} ariaLabel="Vietnam product complexity distribution" />
    </GLFigure>
  );
}
// #endregion

// #region demo:spec-10-moving-average
/**
 * A noisy annual series with its trailing mean over it.
 *
 * Year-on-year export growth is genuinely volatile — commodity cycles, the 2009
 * collapse, 2020 — which is exactly the condition a moving average is for. The
 * window is five years rather than the catalog's thirty days because the Atlas
 * has no days; `movingAverage` does not care what the x unit is.
 */
function ExportGrowthTrend() {
  const series = defined(seriesFor('VNM'), 'exportValueM');
  const growth = series.slice(1).map((d, i) => ({
    year: d.year,
    growth: (d.exportValueM / series[i].exportValueM - 1) * 100,
  }));
  const trend = movingAverage(growth, { x: 'year', y: 'growth', window: 5 });

  const chart = glChart({
    marks: [
      glLine(growth, { x: 'year', y: 'growth', tone: 'muted' }),
      glLine(trend, { x: 'year', y: 'growth', tone: 'c-1', focus: true }),
      glRuleY([0], { y: (d: number) => d }),
    ],
    x: yearAxisFor(growth, 'year'),
    y: glAxisY({ label: 'Export growth (% year on year)' }),
  });

  return (
    <GLFigure
      title="Vietnam's export growth has slowed, but it has never gone negative for long."
      subtitle={`Year-on-year growth in total exports with a five-year trailing mean, ${FIRST_YEAR + 1}–${LATEST_YEAR}`}
      source={PANEL}
      legend={
        <GLLegend
          items={[
            // Both series are lines, and the weight is half the encoding:
            // the annual series is muted context at 2px, the trend is the
            // finding at 2.4px. Two squares threw that away (§3.11).
            { label: 'Annual', tone: 'muted', mark: 'line' },
            { label: 'Five-year mean', tone: 'c-1', mark: 'line', focus: true },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={230} ariaLabel="Vietnam export growth and trend" />
    </GLFigure>
  );
}
// #endregion

// #region demo:spec-20-date-axis
/**
 * The time-axis specimen, at the only grain the Atlas has.
 *
 * `yearAxisFor` rather than `timeAxisFor`: it pins the first and last year as
 * ticks so the reader can see the span the series actually covers, which is the
 * rule the original date-axis plate exists to demonstrate. An epoch axis over
 * annual data would put ticks wherever the time scale felt like it.
 */
function ExportsOverTime() {
  const rows = defined(seriesFor('VNM'), 'exportValueM');
  const series = [{ key: 'Vietnam', rows, tone: 'c-1' as const }];

  const chart = glChart({
    marks: [
      glLine(rows, { x: 'year', y: 'exportValueM', focus: true }),
      ...endLabels(series, { x: 'year', y: 'exportValueM' }),
    ],
    x: yearAxisFor(rows, 'year'),
    y: glAxisY({ label: 'Total exports ($m)' }),
    endLabels: true,
  });

  return (
    <GLFigure
      title="Vietnam's exports grew seventy-five-fold in a generation."
      subtitle={`Total goods exports, millions of current USD, ${FIRST_YEAR}–${LATEST_YEAR}`}
      source={PANEL}
    >
      <Chart {...chart.props} height={230} ariaLabel="Vietnam total exports by year" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-01-line-gaps
/**
 * A null is not a missing row — the path breaks rather than interpolating.
 *
 * Finding a genuine gap in the Atlas took looking. Every ECI, export and
 * population series in the panel is complete; the growth projection is not.
 *
 * It is null for **two different reasons**, and only one of them is a gap. The
 * Atlas publishes no projection at all before 2004 — that column is null for
 * every one of the 146 economies, 1995–2003 — so drawing from `FIRST_YEAR` puts
 * nine empty years at the left of the plot that mean "this series does not start
 * here", which is a statement about the axis, not about Libya. The demo therefore
 * opens at `PROJECTION_FROM` and the axis is honest. What is left inside that
 * span is the real thing this form is for: Libya alone is missing 2015 and 2016,
 * the two years its trade data was too disrupted to project from. Interpolating
 * across *that* hole would draw a confident line through the period the Atlas is
 * explicitly declining to describe.
 */
const PROJECTION_FROM = 2004;

function ProjectionWithGaps() {
  const rows = seriesFor('LBY')
    .filter((d) => d.year >= PROJECTION_FROM)
    .map((d) => ({ year: d.year, projection: d.growthProjection }));

  const chart = glChart({
    marks: [glLine(rows, { x: 'year', y: 'projection', focus: true })],
    x: yearAxisFor(rows, 'year'),
    y: glAxisY({ label: 'Projected annual growth (%)' }),
  });

  return (
    <GLFigure
      title="The Atlas declines to project Libya's growth for two years, and the line says so."
      subtitle={`Economic complexity growth projection, ${PROJECTION_FROM}–${LATEST_YEAR}; 2015 and 2016 absent`}
      source={withNote(
        PANEL,
        `Gap is missing data, not zero growth. The Atlas publishes no growth projection before ${PROJECTION_FROM} for any economy, so the series opens there`,
      )}
    >
      <Chart {...chart.props} height={230} ariaLabel="Libya growth projection with gaps" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-02-multi-line-end-labels
/**
 * Six series, two of them coloured.
 *
 * §3.1: colour is spent only where it carries a finding. The finding is the
 * CONVERGENCE: in 1995 the Philippines led Vietnam by 1.11 index points, the
 * widest gap between the two in the whole panel, and by 2023 it led by 0.18. So
 * those two get hues and the other four are the muted backdrop that makes the
 * comparison legible. Direct end labels rather than a legend: the reader never
 * has to look away from the line to find out whose it is.
 */
function CohortComplexity() {
  const rows = defined(
    countryYear.filter((d) => COHORT.includes(d.iso3)),
    'eci',
  ).map((d) => ({ ...d, country: countryName(d.iso3) }));

  const highlight = [countryName('VNM'), countryName('PHL')];
  const { backdrop, focus } = popUp(rows, { by: 'country', highlight });
  // Keyed by series name, not by position. `toSeries` matches a positional
  // array against first-appearance order in the ROWS; COHORT is a roster, and
  // the two orders are different, so an array built here would hand Vietnam's
  // hue to whichever economy the Atlas happens to list first.
  const series = toSeries(rows, 'country', (key) => {
    const rank = highlight.indexOf(key);
    return rank === 0 ? 'c-1' : rank === 1 ? 'c-2' : 'muted';
  });

  const chart = glChart({
    marks: [
      glMutedLine(backdrop, { x: 'year', y: 'eci', z: 'country' }),
      ...focus.map((s) =>
        glLine(s.rows, { x: 'year', y: 'eci', z: 'country', tone: s.tone, focus: true }),
      ),
      ...endLabels(series, { x: 'year', y: 'eci' }),
    ],
    x: yearAxisFor(rows, 'year'),
    y: glAxisY({ label: 'Economic Complexity Index' }),
    endLabels: true,
  });

  return (
    <GLFigure
      title="Vietnam closed almost all of a one-point complexity gap with the Philippines."
      subtitle={`Economic Complexity Index, six Southeast Asian economies, ${FIRST_YEAR}–${LATEST_YEAR}`}
      source={PANEL}
    >
      <Chart {...chart.props} height={260} ariaLabel="Economic complexity of six economies" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-55-indexed-multi-line
/**
 * Series rebased to a common index, so growth rates can be compared across
 * economies of wildly different size.
 *
 * §3.4.2: the line at 100 is a REFERENCE — nothing was measured there, the
 * reader brought it — so it is dashed ink-3 and takes no hue.
 */
function IndexedExports() {
  // A base year that is missing is a series that cannot be indexed, not a series
  // whose base is 1. `?? 1` would emit an index of exportValueM × 100 — a line
  // four orders of magnitude off, drawn with no indication anything went wrong.
  // The whole cohort has a 1995 observation today; the guard is here so the next
  // release cannot quietly invent one.
  const base = new Map(
    COHORT.map((iso) => [
      iso,
      countryYear.find((d) => d.iso3 === iso && d.year === FIRST_YEAR)?.exportValueM,
    ]).filter(([, v]) => typeof v === 'number' && v > 0) as [string, number][],
  );
  const rows = defined(
    countryYear.filter((d) => COHORT.includes(d.iso3) && base.has(d.iso3)),
    'exportValueM',
  ).map((d) => ({
    year: d.year,
    country: countryName(d.iso3),
    index: (d.exportValueM / base.get(d.iso3)!) * 100,
  }));

  const { backdrop, focus } = popUp(rows, { by: 'country', highlight: [countryName('VNM')] });
  const lead = countryName('VNM');
  // Keyed, not positional — see CohortComplexity above.
  const series = toSeries(rows, 'country', (key) => (key === lead ? 'c-1' : 'muted'));

  const chart = glChart({
    marks: [
      glRuleY([100], { y: (d: number) => d }),
      glMutedLine(backdrop, { x: 'year', y: 'index', z: 'country' }),
      ...focus.map((s) =>
        glLine(s.rows, { x: 'year', y: 'index', z: 'country', tone: s.tone, focus: true }),
      ),
      ...endLabels(series, { x: 'year', y: 'index' }),
    ],
    x: yearAxisFor(rows, 'year'),
    y: glAxisY({ label: `Index (${FIRST_YEAR} = 100)` }),
    endLabels: true,
  });

  return (
    <GLFigure
      title="Rebasing shows what the levels hide: Vietnam grew from a far smaller base."
      subtitle={`Total exports indexed to ${FIRST_YEAR} = 100, six Southeast Asian economies`}
      source={PANEL}
    >
      <Chart {...chart.props} height={260} ariaLabel="Indexed exports by economy" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-58-select-extrema
/**
 * A series with its extrema annotated.
 *
 * §3.4: a label placed over data takes the paper halo, never a lighter ink —
 * lightening the text to avoid a collision makes the most important annotation
 * on the chart the least readable one.
 */
function GrowthExtrema() {
  const series = defined(seriesFor('VNM'), 'exportValueM');
  const rows = series.slice(1).map((d, i) => ({
    year: d.year,
    growth: (d.exportValueM / series[i].exportValueM - 1) * 100,
  }));

  const peak = select(rows, { value: 'growth', select: 'max' });
  const trough = select(rows, { value: 'growth', select: 'min' });
  const marked = [
    ...peak.map((d) => ({ ...d, note: 'Best year' })),
    ...trough.map((d) => ({ ...d, note: 'Worst year' })),
  ];

  const chart = glChart({
    marks: [
      glLine(rows, { x: 'year', y: 'growth', tone: 'muted' }),
      glRuleY([0], { y: (d: number) => d }),
      glPoint(marked, { x: 'year', y: 'growth', tone: 'c-1' }),
      glLabel(marked, {
        x: 'year',
        y: 'growth',
        text: (d) => `${d.note} · ${d.year}`,
        tone: 'c-1',
        anchor: 'middle',
        dy: -14,
      }),
    ],
    x: yearAxisFor(rows, 'year'),
    y: glAxisY({ label: 'Export growth (% year on year)' }),
    variant: { labelHalo: true },
  });

  return (
    <GLFigure
      title="Vietnam's best export year was 2000; its worst was the financial crisis."
      subtitle={`Year-on-year growth in total exports, ${FIRST_YEAR + 1}–${LATEST_YEAR}`}
      source={PANEL}
    >
      <Chart {...chart.props} height={230} ariaLabel="Vietnam export growth extrema" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-03-temperature-range-band
/**
 * An observed range around a central line — here the spread of a whole cohort
 * rather than of one series.
 *
 * The band is the full min–max across the six economies, so it is a *range*, not
 * an interval: every year, some economy in the cohort actually sat on each edge.
 * §3.9 gives it the light tone at full opacity.
 */
function CohortRange() {
  const years = [...new Set(countryYear.map((d) => d.year))].sort((a, b) => a - b);
  const rows = years
    .map((year) => {
      const values = defined(
        countryYear.filter((d) => d.year === year && COHORT.includes(d.iso3)),
        'eci',
      ).map((d) => d.eci);
      return values.length
        ? {
            year,
            low: Math.min(...values),
            high: Math.max(...values),
            mean: values.reduce((a, b) => a + b, 0) / values.length,
          }
        : null;
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  const chart = glChart({
    marks: [
      glBand(rows, { x: 'year', y1: 'low', y2: 'high' }),
      glLine(rows, { x: 'year', y: 'mean', focus: true }),
    ],
    x: yearAxisFor(rows, 'year'),
    y: glAxisY({ label: 'Economic Complexity Index' }),
  });

  return (
    <GLFigure
      title="The gap between the region's most and least complex economies has barely closed."
      subtitle={`Range and mean of the Economic Complexity Index across six Southeast Asian economies, ${FIRST_YEAR}–${LATEST_YEAR}`}
      source={PANEL}
      legend={
        <GLLegend
          items={[
            { label: 'Cohort mean', tone: 'c-1', mark: 'line', focus: true },
            { label: 'Observed range', tone: 'c-1', mark: 'band' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={230} ariaLabel="Complexity range across the cohort" />
    </GLFigure>
  );
}
// #endregion

// ════════════════════════════════════════════════════════════════════════════

const demos: Demo[] = [
  {
    id: 'spec-08-band',
    family: 'Lines and Areas',
    name: 'Band around a central line',
    question: 'Is Vietnam making more complex products, or just more of the same ones?',
    rule: '§3.9 — a band is the light tone at full opacity, never a translucent main.',
    render: ProductComplexityBand,
  },
  {
    id: 'spec-10-moving-average',
    family: 'Lines and Areas',
    name: 'Moving average over a noisy series',
    question: 'Underneath the volatility, is Vietnam’s export growth speeding up or slowing down?',
    rule: '§3.1 — the smoothed series carries the finding and takes the hue; the raw series is muted.',
    render: ExportGrowthTrend,
    gaps: [
      'The catalog specimen is a 30-day trailing mean on a daily series. The Atlas is annual, so the window here is five years — the form is exercised, the grain is not.',
    ],
  },
  {
    id: 'spec-20-date-axis',
    family: 'Lines and Areas',
    name: 'Time axis with pinned endpoints',
    question: 'How much did Vietnam’s exports grow between 1995 and 2023?',
    rule: '§3.6 — the first and last year are pinned as ticks so the span is legible.',
    render: ExportsOverTime,
    gaps: [
      'A true date axis (timeAxisFor / toEpoch) is untested here: the Atlas has no sub-annual observations to put on one.',
    ],
  },
  {
    id: 'ts-01-line-gaps',
    family: 'Lines and Areas',
    name: 'Line with genuine gaps',
    question: 'What happens to a chart when the Atlas has no number to give?',
    rule: 'A null is not a missing row — the path breaks rather than interpolating.',
    render: ProjectionWithGaps,
  },
  {
    id: 'ts-02-multi-line-end-labels',
    family: 'Lines and Areas',
    name: 'Multi-series with direct end labels',
    question: 'Which Southeast Asian economies became more complex, and which stalled?',
    rule: '§3.1 — colour is spent only where it carries a finding; the rest is c-muted.',
    render: CohortComplexity,
    gaps: [
      'endLabels has no collision handling: it places every series label at that series’ last point with a fixed offset. Malaysia and Thailand end within a few hundredths of each other and their labels overlap. The catalog specimen never showed this because its five synthetic series were spread evenly — real economies converge. A dodge pass over the placed labels belongs in compose.ts; hand-tuning dy per series here would hide the gap instead of recording it.',
    ],
  },
  {
    id: 'ts-55-indexed-multi-line',
    family: 'Lines and Areas',
    name: 'Series rebased to a common index',
    question: 'Whose exports grew fastest, once you correct for how big they started?',
    rule: '§3.4.2 — the line at 100 is a reference, so it is dashed ink-3 and takes no hue.',
    render: IndexedExports,
    gaps: [
      'Same endLabels collision as the multi-series demo above: rebasing compresses the four muted series into a narrow band at the right edge and their labels stack.',
    ],
  },
  {
    id: 'ts-58-select-extrema',
    family: 'Lines and Areas',
    name: 'Series with its extrema annotated',
    question: 'When were Vietnam’s best and worst export years?',
    rule: '§3.4 — a label over data takes the paper halo, never a lighter ink.',
    render: GrowthExtrema,
  },
  {
    id: 'ts-03-temperature-range-band',
    family: 'Lines and Areas',
    name: 'Observed range around a mean',
    question: 'Is the region converging on a common level of complexity?',
    rule: '§3.9 — a band is the light tone at full opacity, never a translucent main.',
    render: CohortRange,
  },
];

export const linesFamily: Family = {
  slug: 'lines-and-areas',
  title: 'Lines and Areas',
  blurb:
    'Change over time, which is most of what an economic atlas has to say. Most of these charts colour at most two series and mute the rest, so the eye lands on the comparison the chart was drawn to make.',
  demos,
};

export function renderLines(): Record<string, () => ReactNode> {
  return Object.fromEntries(demos.map((d) => [d.id, d.render]));
}
