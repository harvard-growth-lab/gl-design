/**
 * Catalog specimens — the Cartesian families.
 *
 * Trend, Range, Composition, Bar, Relationship, Change, Interval, Comparison,
 * Ranking, Decoration, Multivariate and Survey: everything TanStack draws on an
 * x/y plot. The radial, distribution, hierarchy, geographic and interaction
 * families live in their sibling files.
 *
 * **Same contract as `specimens.tsx`, and it is the point of the exercise: no
 * hex, no font size, no stroke width, no opacity appears below.** Every value on
 * screen comes from `tokens.json` by way of a `gl*` mark, an axis preset or a
 * compose helper. Where the library cannot express something, the plate comes out
 * without it and the shortfall is recorded in `gaps` — a specimen that reaches for
 * a style attribute to look right has disproved the thing it was written to prove.
 *
 * What these DO author is data preparation: a pyramid's signed counts, an index
 * rebased to 100, a bump chart's ranks. That decides *where* a mark goes and
 * never what it looks like. Where the preparation is general it comes from
 * `compose.ts` (`popUp`, `waterfall`, `binValues`, `linearFit`, `lagPairs`) or
 * from TanStack's own transforms (`stack`, `group`, `groupBy`, `rank`,
 * `normalize`, `select`) rather than being rewritten here.
 *
 * ## Why so many of these are the pop-up effect
 *
 * Because that is the answer, and the difference from TanStack's version of the
 * same chart is the finding this whole page exists to show. Their multi-line
 * chart spends five saturated hues; their slopegraph spends eight. §3.1 says
 * colour is only spent when it is necessary, so the GL answer is one muted
 * backdrop and one or two highlighted series almost every time. Seeing that
 * answer arrive at seven different charts is more informative than seeing seven
 * different answers.
 */

import type { ReactNode } from 'react';
import { Chart } from '@tanstack/react-charts';
import { group, groupBy, select, stack } from '@tanstack/charts';

import {
  anchorWithin,
  binValues,
  clearOf,
  endLabels,
  glArea,
  glArrow,
  glAxisBand,
  glAxisBin,
  glAxisLog,
  glAxisPercent,
  glAxisPoint,
  glAxisX,
  glAxisY,
  glBand,
  glBar,
  glBarX,
  glBinBar,
  glChart,
  glDivergingColor,
  glLabel,
  glLine,
  glLink,
  glMutedBarX,
  glMutedLine,
  glMutedPoint,
  glPoint,
  glRuleY,
  glTickY,
  ink,
  lagPairs,
  movingAverage,
  popUp,
  seriesKeyAt,
  signColor,
  signKey,
  timeAxisFor,
  toEpoch,
  toneRamp,
  toSeries,
  yearAxisFor,
} from '../src/index.js';
import { GLFigure, GLLegend } from '../src/figure.js';

import { candleData, dailyData, fitData } from './specimen-data.js';
import {
  AGE_BANDS,
  GROUPED_PERIODS,
  LIKERT_RESPONSES,
  LIKERT_SIGN,
  MONTHS,
  PARALLEL_DIMENSIONS,
  SECTORS,
  SLOPE_PERIODS,
  bubbleRows,
  carRows,
  gappedSeries,
  groupedBars,
  likertData,
  logSizes,
  longRankData,
  monthlyRange,
  parallelData,
  phillipsPath,
  pyramidData,
  sectorData,
  slopeData,
  specimenObservations,
} from './tanstack-data.js';

const SYNTHETIC = 'Source: Synthetic data for illustration. Not a Growth Lab estimate.';

/** Slot every sector onto a tone, muting all but the named ones. */
function focusSeries(highlight: readonly string[]) {
  return toSeries(
    sectorData,
    'sector',
    SECTORS.map((sector) => {
      const rank = highlight.indexOf(sector);
      return rank === 0 ? ('c-1' as const) : rank === 1 ? ('c-2' as const) : ('muted' as const);
    }),
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Trend
// ════════════════════════════════════════════════════════════════════════════

/**
 * `01-line-gaps` — a series with holes in it.
 *
 * The whole specimen is one property of the data: the closed days are `null`,
 * not absent rows. TanStack's `lineY` breaks its path on a null `y`, so the two
 * suspensions show as gaps. Filter those rows out instead and the line draws
 * straight across a month nobody observed — a fabricated trend that looks
 * exactly like a measured one, which is the failure this plate exists to make
 * visible by not having it.
 */
function LineGaps() {
  const chart = glChart({
    marks: [glLine(gappedSeries, { x: 't', y: 'value', focus: true })],
    x: timeAxisFor(gappedSeries, 't'),
    y: glAxisY({ label: 'Index (Jan 2022 = 100)' }),
  });

  return (
    <GLFigure
      title="Trading was suspended twice, and the line says so."
      subtitle="Daily settlement index, 2022–2023; weekends and two suspensions left empty"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={230} ariaLabel="Settlement index with gaps" />
    </GLFigure>
  );
}

/**
 * `02-multi-line-end-labels` — five series, and the clearest single instance of
 * what the GL rules change.
 *
 * TanStack's version spends five saturated hues and a legend. §3.1 asks the
 * prior question — does colour here carry a finding? — and the answer is that
 * two of these series carry it and three are context. So three go muted as ONE
 * mark (`z` keeps them from joining into a single path), two take `c-1` and
 * `c-2` at 2.4px, and every label is direct.
 */
function MultiLineEndLabels() {
  const series = focusSeries(['Services', 'Manufacturing']);
  const { backdrop, focus } = popUp(sectorData, {
    by: 'sector',
    highlight: ['Services', 'Manufacturing'],
  });

  const chart = glChart({
    marks: [
      glMutedLine(backdrop, { x: 'year', y: 'value', z: 'sector' }),
      ...focus.map((s) =>
        glLine(s.rows, { x: 'year', y: 'value', z: 'sector', tone: s.tone, focus: true }),
      ),
      ...endLabels(series, { x: 'year', y: 'value' }),
    ],
    x: yearAxisFor(sectorData, 'year'),
    y: glAxisY({ label: 'Employment (thousands)' }),
    endLabels: true,
  });

  return (
    <GLFigure
      title="Services passed manufacturing in 2011 and never gave it back."
      subtitle="Employment by sector, thousands, 2004–2024"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={250} ariaLabel="Employment by sector" />
    </GLFigure>
  );
}

/**
 * `55-indexed-multi-line` — the same five series rebased to their first year.
 *
 * Two rules meet here. The rebasing is data preparation, so it happens in the
 * plate. The line at 100 is a *reference* — the reader brought it to the chart,
 * nothing was measured there — so §3.4.2 makes it chrome: dashed `ink-3`, and
 * `glRuleY` ignores `tone` outright, which is what stops it being drawn as a
 * sixth series.
 *
 * Note the axis: `zeroBaseline` is deliberately NOT set. An index axis merely
 * spans its own reference; promoting the gridline at 100 to axis weight would
 * read as a second x axis floating in mid-plot.
 */
function IndexedMultiLine() {
  const base = new Map<string, number>(
    SECTORS.map((sector) => [
      sector,
      sectorData.find((d) => d.sector === sector)?.value ?? 1,
    ]),
  );
  const rows = sectorData.map((d) => ({
    ...d,
    index: (d.value / (base.get(d.sector) ?? 1)) * 100,
  }));

  const { backdrop, focus } = popUp(rows, { by: 'sector', highlight: ['Construction'] });
  const series = toSeries(
    rows,
    'sector',
    SECTORS.map((s) => (s === 'Construction' ? ('c-1' as const) : ('muted' as const))),
  );

  const chart = glChart({
    marks: [
      glRuleY([100], { y: (d: number) => d }),
      glMutedLine(backdrop, { x: 'year', y: 'index', z: 'sector' }),
      ...focus.map((s) =>
        glLine(s.rows, { x: 'year', y: 'index', z: 'sector', tone: s.tone, focus: true }),
      ),
      ...endLabels(series, { x: 'year', y: 'index' }),
    ],
    x: yearAxisFor(rows, 'year'),
    y: glAxisY({ label: 'Index (2004 = 100)' }),
    endLabels: true,
  });

  return (
    <GLFigure
      title="Construction doubled and gave half of it back."
      subtitle="Employment indexed to 2004 = 100, by sector, 2004–2024"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={250} ariaLabel="Indexed employment by sector" />
    </GLFigure>
  );
}

/**
 * `58-select-extrema` — a series with its own maximum and minimum called out.
 *
 * The two extrema come from TanStack's `select` transform rather than from a
 * hand-written reduce, because `select({ select: 'max' })` is the same code path
 * the interaction layer uses and will keep agreeing with it. The annotations sit
 * ON the plot, so they need the paper halo — `variant: { labelHalo: true }` is
 * the only sanctioned way to put text over data (§3.4).
 *
 * The anchor is `anchorWithin`, not `'middle'`, and this plate is why the helper
 * exists: the trough falls in the first month of a 14-month span, so a centred
 * label put half of "Trough · 58" outside the plot and across the Y tick
 * labels. §3.12 wants the side with open space, which at the left edge means
 * anchoring the text at the mark and letting it run right.
 */
function SelectExtrema() {
  const rows = dailyData.map((d) => ({ t: toEpoch(d.date), value: d.value }));
  const peak = select(rows, { value: 'value', select: 'max' });
  const trough = select(rows, { value: 'value', select: 'min' });
  const marked = [
    ...peak.map((d) => ({ ...d, note: 'Peak' })),
    ...trough.map((d) => ({ ...d, note: 'Trough' })),
  ];

  const chart = glChart({
    marks: [
      glLine(rows, { x: 't', y: 'value', tone: 'muted' }),
      glPoint(marked, { x: 't', y: 'value', tone: 'c-1' }),
      glLabel(marked, {
        x: 't',
        y: 'value',
        text: (d) => `${d.note} · ${Math.round(d.value)}`,
        tone: 'c-1',
        anchor: anchorWithin('t', rows),
        dy: -14,
      }),
    ],
    x: timeAxisFor(rows, 't'),
    y: glAxisY({ label: 'Shipments (index)' }),
    variant: { labelHalo: true },
  });

  return (
    <GLFigure
      title="The trough came eight months before the peak."
      subtitle="Daily shipment index with extrema marked, Mar 2022 – May 2023"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={230} ariaLabel="Shipment index with extrema" />
    </GLFigure>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Range
// ════════════════════════════════════════════════════════════════════════════

/**
 * `03-temperature-range-band` — §3.9's rule stated as plainly as it can be.
 *
 * The band is `c-1-light` at FULL opacity, never a translucent `c-1`. Two things
 * follow that alpha would lose: the band is the same colour wherever it goes,
 * and it survives greyscale, because a lightness step does and an alpha does not.
 * The band is listed first because marks paint in array order.
 */
function RangeBand() {
  const chart = glChart({
    marks: [
      glBand(monthlyRange, { x: 'index', y1: 'low', y2: 'high' }),
      glLine(monthlyRange, { x: 'index', y: 'mean', focus: true }),
    ],
    x: glAxisX({
      nice: false,
      domain: [0, 11],
      values: monthlyRange.map((d) => d.index),
      format: (v) => MONTHS[v] ?? '',
    }),
    y: glAxisY({ label: 'Temperature (°C)' }),
  });

  return (
    <GLFigure
      title="Winter is not just colder — it is far less predictable."
      subtitle="Monthly mean daily temperature with the observed daily range"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={230} ariaLabel="Monthly temperature range" />
    </GLFigure>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Composition
// ════════════════════════════════════════════════════════════════════════════

/**
 * `04-stacked-time-area` — five series stacked to a total.
 *
 * The stack happens INSIDE one mark, through `z`. That is not a style
 * preference: TanStack has no concept of stacking across marks, so one mark per
 * series produces five areas drawn from the baseline on top of each other — no
 * stack, no warning, and a y axis topping out at the largest single series
 * instead of the total. The same trap `toneRamp`'s doc comment records.
 *
 * Five categories exceed what one hue's tone ramp holds (§8c tops out at three),
 * so this takes the categorical palette in order — the one composition case
 * where it is the right answer rather than the lazy one.
 */
function StackedArea() {
  const chart = glChart({
    marks: [
      glArea(sectorData, {
        x: 'year',
        y: 'value',
        z: 'sector',
        color: 'sector',
        layout: stack(),
      }),
    ],
    x: yearAxisFor(sectorData, 'year'),
    y: glAxisY({ label: 'Employment (thousands)' }),
  });

  return (
    <GLFigure
      title="Total employment grew a fifth while its composition inverted."
      subtitle="Employment by sector, thousands, 2004–2024"
      source={SYNTHETIC}
      legendPlacement="right"
      legend={
        // `.reverse()` because `SECTORS` is the order the stack is BUILT in,
        // which runs bottom-to-top, and §3.11 wants the legend in the order the
        // reader's eye takes down the column. Without it the top entry names
        // the bottom band, which is worse than no legend at all.
        <GLLegend
          items={SECTORS.map((sector, i) => ({ label: sector, tone: seriesKeyAt(i) })).reverse()}
        />
      }
    >
      <Chart {...chart.props} height={250} ariaLabel="Employment composition" />
    </GLFigure>
  );
}

/**
 * `21-streamgraph` — the same stack on a `wiggle` baseline.
 *
 * Recorded `partial`, and the reason is a rule that does not exist rather than a
 * mark that does not. §3.5 assumes a baseline the reader can measure from; a
 * streamgraph deliberately has none, so every value is read as a *thickness*,
 * which is the one visual comparison people are measurably bad at. The marks
 * compose — `stack({ offset: 'wiggle' })` and the same `glArea` — but until
 * `grammar.md` rules on when a baseline may be given up, this plate cannot say
 * whether it is on-spec.
 *
 * The y axis is deliberately unlabelled: on a wiggle baseline its numbers are
 * offsets from a floating centre and mean nothing to a reader.
 */
function Streamgraph() {
  const chart = glChart({
    marks: [
      glArea(sectorData, {
        x: 'year',
        y: 'value',
        z: 'sector',
        color: 'sector',
        layout: stack({ offset: 'wiggle' }),
      }),
    ],
    x: yearAxisFor(sectorData, 'year'),
    y: glAxisY({ grid: false, format: () => '' }),
  });

  return (
    <GLFigure
      title="Composition reads clearly; magnitude does not."
      subtitle="Employment by sector on a wiggle baseline, 2004–2024"
      source={SYNTHETIC}
      legendPlacement="right"
      legend={
        <GLLegend
          items={SECTORS.map((sector, i) => ({ label: sector, tone: seriesKeyAt(i) })).reverse()}
        />
      }
    >
      <Chart {...chart.props} height={250} ariaLabel="Employment streamgraph" />
    </GLFigure>
  );
}

/**
 * `70-composed-chart` — two encodings, two units, one plot.
 *
 * The rule that decides this plate is which series gets the saturated hue. Bars
 * and a line on one frame is a chart with two subjects, and §3.1 does not allow
 * two findings; so the bars are the context and take `c-1-light` through the
 * band tone, and the line carries the finding at `c-1` 2.4px. Two full-strength
 * hues here would make the reader choose which chart they were looking at.
 *
 * Recorded `partial`: the two series are on genuinely different units and the
 * library has no second y axis, so the precipitation bars are drawn on the
 * temperature scale after a linear rescale done in the plate. The reader can
 * compare the shapes and not the magnitudes, which the subtitle says.
 */
function ComposedChart() {
  const maxPrecipitation = Math.max(...monthlyRange.map((d) => d.precipitation));
  const maxTemperature = Math.max(...monthlyRange.map((d) => d.high));
  const rows = monthlyRange.map((d) => ({
    ...d,
    scaled: (d.precipitation / maxPrecipitation) * maxTemperature,
  }));

  const chart = glChart({
    marks: [
      glBar(rows, { x: 'month', y: 'scaled', tone: 'c-1', step: 'light' }),
      glLine(rows, { x: 'month', y: 'mean', tone: 'c-1', focus: true }),
      glPoint(rows, { x: 'month', y: 'mean', tone: 'c-1' }),
    ],
    x: glAxisBand({ domain: [...MONTHS] }),
    y: glAxisY({ label: 'Temperature (°C)' }),
  });

  return (
    <GLFigure
      title="The wettest months are the coldest, but the lag is a month."
      subtitle="Mean temperature (line) over rainfall (bars, rescaled to the temperature axis)"
      source={SYNTHETIC}
      // Two encodings, so two DIFFERENT legend marks — which is the whole point
      // of §3.11 on a composed chart. The subtitle spells out "(line)" and
      // "(bars)" in words; before this the legend contradicted it with two
      // identical squares, and a reader who trusted the legend had no way to
      // tell which series was which geom.
      legend={
        <GLLegend
          items={[
            { label: 'Rainfall (rescaled)', tone: 'c-1', step: 'light' },
            { label: 'Mean temperature', tone: 'c-1', mark: 'line', focus: true, dot: true },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={240} ariaLabel="Temperature over rainfall" />
    </GLFigure>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Bar
// ════════════════════════════════════════════════════════════════════════════

/**
 * `bar-horizontal-ranking` — the case the horizontal orientation exists for.
 *
 * Seven category names, one of them thirty-three characters. On a vertical axis
 * they rotate 90° and the chart stops being readable; on a horizontal one they
 * read left-to-right at 12px. The defaults table needs no orientation-specific
 * entry, because fill and opacity do not care which way a bar points.
 *
 * The domain is pinned. `popUp` emits the muted backdrop before the focus
 * series, and a band scale takes its domain from the order it MEETS each
 * category — so on a chart whose entire subject is rank, the highlighted bar
 * would silently jump to the end.
 */
function HorizontalRanking() {
  const { backdrop, focus } = popUp(longRankData, {
    by: 'name',
    highlight: ['Mineral fuels and lubricants'],
  });

  const chart = glChart({
    marks: [
      glMutedBarX(backdrop, { y: 'name', x: 'value' }),
      ...focus.map((s) => glBarX(s.rows, { y: 'name', x: 'value', tone: s.tone })),
    ],
    x: glAxisY({ label: 'Share of goods exports (%)' }),
    y: glAxisBand({ domain: longRankData.map((d) => d.name) }),
    margin: { left: 232 },
  });

  return (
    <GLFigure
      title="Two SITC sections carry three-quarters of the export basket."
      subtitle="Share of goods exports by SITC section, 2024"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={250} ariaLabel="Exports by SITC section" />
    </GLFigure>
  );
}

/**
 * `bar-grouped` — three periods per region, side by side.
 *
 * `group()` is TanStack's own dodge layout, so the sub-band arithmetic is not
 * the plate's business. Three periods of ONE ordered variable is exactly §8c's
 * case, so they take the light → main → dark ramp of one hue rather than three
 * unrelated colours: the lightness carries the ordering, and the reader can see
 * which direction time runs without consulting the legend.
 */
function GroupedBars() {
  const chart = glChart({
    marks: [
      glBar(groupedBars, {
        x: 'region',
        y: 'value',
        z: 'period',
        color: 'period',
        layout: group(),
      }),
    ],
    x: glAxisBand(),
    y: glAxisY({ label: 'Share of exports (%)' }),
    color: toneRamp({ tones: 'three', order: [...GROUPED_PERIODS], tone: 'c-1' }),
    margin: { bottom: 66 },
  });

  return (
    <GLFigure
      title="Latin America is the only region whose share fell in both decades."
      subtitle="Share of world manufactured exports by region, 2014 · 2019 · 2024"
      source={SYNTHETIC}
      // Below and flush left: the bars are GROUPED, not stacked, so there is no
      // vertical band order for a right-hand legend to mirror (§3.11).
      legend={
        <GLLegend
          items={GROUPED_PERIODS.map((period, i) => ({
            label: period,
            tone: 'c-1' as const,
            step: (['light', 'main', 'dark'] as const)[i],
          }))}
        />
      }
    >
      <Chart {...chart.props} height={240} ariaLabel="Export share by region and period" />
    </GLFigure>
  );
}

/**
 * `bar-stacked` — the absolute-magnitude twin of the normalized stack.
 *
 * Same data, same three-tone ramp, one difference: no `normalize` offset, so the
 * bar heights carry the totals and the reader can see that the composition
 * shifted while the level did too. `variant: { stacked: true }` cuts the 1px gap
 * between segments — `barY` exposes no stroke option and its `inset` trims width
 * rather than height, so that gap can only come from CSS.
 */
function StackedBars() {
  const chart = glChart({
    marks: [
      glBar(groupedBars, {
        x: 'region',
        y: 'value',
        z: 'period',
        color: 'period',
        layout: stack(),
      }),
    ],
    x: glAxisBand(),
    y: glAxisY({ label: 'Share of exports (%)' }),
    color: toneRamp({ tones: 'three', order: [...GROUPED_PERIODS], tone: 'c-1' }),
    variant: { stacked: true },
    margin: { bottom: 66 },
  });

  return (
    <GLFigure
      title="Stacking the same three periods hides the fall it was drawn to show."
      subtitle="Share of world manufactured exports by region, 2014 · 2019 · 2024, stacked"
      source={SYNTHETIC}
      // The grouped twin above puts the same three entries below the plot; this
      // one is stacked, so §3.11 moves them to the right — and reverses them,
      // because the legend has to run in the stack's own top-to-bottom order.
      legendPlacement="right"
      legend={
        <GLLegend
          items={[...GROUPED_PERIODS]
            .map((period, i) => ({
              label: period,
              tone: 'c-1' as const,
              step: (['light', 'main', 'dark'] as const)[i],
            }))
            .reverse()}
        />
      }
    >
      <Chart {...chart.props} height={240} ariaLabel="Stacked export share by region" />
    </GLFigure>
  );
}

/**
 * `59-grouped-reducer-bars` — bar heights that are a computed statistic.
 *
 * `groupBy` with a `mean` reducer does the aggregation, so the chart is drawn
 * from 333 raw observations rather than from a summary table someone prepared
 * elsewhere. Worth doing for the reason the reducer exists: the mean and the
 * chart cannot disagree, because there is only one of them.
 *
 * Sex is two categories sharing a parent, which §8b sends to one hue at main +
 * light rather than to two unrelated colours.
 */
function ReducerBars() {
  const means = groupBy(specimenObservations, {
    // A Record, not an array: `TransformGroupSpec` names the output field on the
    // left and reads the channel on the right, so the reduced rows come back
    // carrying `species` and `sex` rather than a positional tuple.
    by: { species: 'species', sex: 'sex' },
    outputs: { mass: { value: 'mass', reduce: 'mean' } },
  });

  const chart = glChart({
    marks: [
      glBar(means, {
        x: 'species',
        y: 'mass',
        z: 'sex',
        color: 'sex',
        layout: group(),
      }),
    ],
    x: glAxisBand(),
    y: glAxisY({ label: 'Mean body mass (g)' }),
    color: toneRamp({ tones: 'two', order: ['male', 'female'], tone: 'c-1' }),
  });

  return (
    <GLFigure
      title="The sex gap is widest in the largest species."
      subtitle={`Mean body mass by species and sex, ${specimenObservations.length} observations`}
      source={SYNTHETIC}
      legend={
        <GLLegend
          items={[
            { label: 'Male', tone: 'c-1' },
            { label: 'Female', tone: 'c-1', step: 'light' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={230} ariaLabel="Mean body mass by species and sex" />
    </GLFigure>
  );
}

/**
 * `71-recharts-population-pyramid` — a signed bar chart drawn as two wings.
 *
 * The signed counts are data preparation, and once they exist the chart is an
 * ordinary horizontal stack. The one design decision is the colour: sex is NOT a
 * sign, so this must not reach for `signColor()` even though the geometry
 * invites it — red-for-female would import a valence the data does not have.
 * §8b's two-tone ramp is the right answer.
 *
 * Recorded `partial`: the x axis labels the signed value, so the female wing
 * reads negative. A mirrored axis that labels both wings positive is a
 * formatter the library does not have.
 */
function PopulationPyramid() {
  const chart = glChart({
    marks: [
      glBarX(pyramidData, {
        y: 'band',
        x: 'count',
        z: 'sex',
        color: 'sex',
        layout: stack({ offset: 'diverging' }),
      }),
    ],
    x: glAxisY({ label: 'Share of population (%)' }),
    y: glAxisBand({ domain: [...AGE_BANDS].reverse() }),
    color: toneRamp({ tones: 'two', order: ['Male', 'Female'], tone: 'c-1' }),
    variant: { stacked: true, zeroBaseline: true },
    margin: { left: 90 },
  });

  return (
    <GLFigure
      title="The bulge is the cohort now entering its thirties."
      subtitle="Population by age band and sex, share of total"
      source={SYNTHETIC}
      // A pyramid stacks left and right, not top and bottom, so the legend has
      // no vertical order to mirror and goes below like any grouped chart.
      legend={
        <GLLegend
          items={[
            { label: 'Male', tone: 'c-1' },
            { label: 'Female', tone: 'c-1', step: 'light' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={260} ariaLabel="Population by age and sex" />
    </GLFigure>
  );
}

/**
 * `72-recharts-mixed-bars` — a stack and a grouped bar in the same frame.
 *
 * TanStack's version proves the two layouts coexist. The GL question is whether
 * they should, and the answer here is a qualified yes: the stack is the
 * composition and the adjacent bar is a total drawn against it, which the reader
 * can only do because the two carry different tones of ONE hue. Two hues would
 * make it two charts sharing an axis.
 */
function MixedBars() {
  const rows = monthlyRange.flatMap((d) => [
    { month: d.month, part: 'Daytime', value: Math.max(0, d.high) },
    { month: d.month, part: 'Overnight', value: Math.max(0, d.mean - d.low) },
  ]);

  const chart = glChart({
    marks: [
      glBar(rows, { x: 'month', y: 'value', z: 'part', color: 'part', layout: stack() }),
      glLine(monthlyRange, { x: 'month', y: 'mean', tone: 'c-2', focus: true }),
    ],
    x: glAxisBand({ domain: [...MONTHS] }),
    y: glAxisY({ label: 'Degrees (°C)' }),
    color: toneRamp({ tones: 'two', order: ['Daytime', 'Overnight'], tone: 'c-1' }),
    variant: { stacked: true },
  });

  return (
    <GLFigure
      title="Overnight variation is largest exactly when daytime warmth is smallest."
      subtitle="Daytime maximum and overnight swing by month, with the monthly mean"
      source={SYNTHETIC}
      legend={
        <GLLegend
          items={[
            { label: 'Daytime', tone: 'c-1' },
            { label: 'Overnight swing', tone: 'c-1', step: 'light' },
            // The mean is the one series that is NOT a bar, and it is also the
            // only one in a second hue — so the legend has to say "line" or the
            // reader reads c-2 as a third band of the stack.
            { label: 'Mean', tone: 'c-2', mark: 'line', focus: true },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={240} ariaLabel="Daytime and overnight temperature" />
    </GLFigure>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Relationship
// ════════════════════════════════════════════════════════════════════════════

/**
 * `scatter-bubble` — a third variable on the size channel.
 *
 * The radius passes through a square root, because TanStack applies no size
 * scale and a radius set to the quantity encodes it as *area squared* — a
 * country four times larger draws sixteen times the ink. That is the single most
 * common bubble-chart error and the library cannot prevent it, so the plate
 * documents it by doing it right.
 *
 * The label offset comes from `clearOf(r)`, which reads the same radius the mark
 * used. A fixed 8px offset is fine for a 6px dot and lands *inside* the circle
 * the moment `r` is a size channel.
 */
function BubbleScatter() {
  const r = (d: (typeof bubbleRows)[number]) => 4 + Math.sqrt(d.population) * 0.75;
  const { backdrop, focus } = popUp(bubbleRows, { by: 'country', highlight: ['Vietnam', 'India'] });

  const chart = glChart({
    marks: [
      glMutedPoint(backdrop, { x: 'income', y: 'complexity', r }),
      ...focus.map((s) => glPoint(s.rows, { x: 'income', y: 'complexity', r, tone: s.tone })),
      ...endLabels(focus, {
        x: 'income',
        y: 'complexity',
        at: 'all',
        anchor: 'end',
        dx: clearOf(r),
      }),
    ],
    x: glAxisLog({
      label: 'GDP per capita, PPP (log scale)',
      domain: [
        Math.min(...bubbleRows.map((d) => d.income)) / 1.9,
        Math.max(...bubbleRows.map((d) => d.income)) * 1.9,
      ],
    }),
    // Padded by more than the largest bubble's radius in data units. A mark with
    // a fixed PIXEL extent is wider than its datum, and TanStack infers a domain
    // from data values alone — so Germany's bubble renders half outside the plot
    // unless the domain is told about it. `nice` does not help: nicening rounds
    // to a tick and the extreme datum can land exactly on it.
    y: glAxisY({ label: 'Economic Complexity Index', domain: [-1.9, 2.75] }),
    variant: { labelHalo: true },
  });

  return (
    <GLFigure
      title="India and Vietnam are complex for their income; both are outliers."
      subtitle="Complexity against income, bubble area = population, 2024"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={250} ariaLabel="Complexity against income" />
    </GLFigure>
  );
}

/**
 * `53-log-scale-scatter` — four orders of magnitude on one axis.
 *
 * TanStack ships no log scale at all (`@tanstack/charts-scales` is band, linear,
 * ordinal and point), so `glAxisLog` wires up the one in `scales.ts`: the domain
 * rounds outward to 1–2–5 bounds and the ticks land on 1–2–5 steps, thinning to
 * decades when a multi-decade span would otherwise crowd.
 *
 * On a linear axis nine in ten of these points stack into a band a few pixels
 * wide against the left edge. That collapse is what the specimen is about.
 */
function LogScatter() {
  const sizes = logSizes.map((d) => d.size);
  // Padded MULTIPLICATIVELY, because a log axis's "half a circle" is a ratio
  // rather than a difference. A fixed pair of bounds would clip whichever tail
  // the seed happened to produce — which it did, on the first attempt.
  const xDomain: [number, number] = [Math.min(...sizes) / 1.7, Math.max(...sizes) * 1.7];

  const chart = glChart({
    marks: [glPoint(logSizes, { x: 'size', y: 'depth' })],
    x: glAxisLog({ label: 'Module size (bytes, log scale)', domain: xDomain }),
    y: glAxisY({ label: 'Depth in the dependency tree', domain: [0.6, 5.4], tickCount: 5 }),
  });

  return (
    <GLFigure
      title="Size is independent of depth across four orders of magnitude."
      subtitle={`${logSizes.length} modules; the x axis is logarithmic`}
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={230} ariaLabel="Module size against depth" />
    </GLFigure>
  );
}

/**
 * `56-connected-scatter` — a path through a two-dimensional state space.
 *
 * The arrowheads are load-bearing rather than decorative: this path crosses
 * itself twice, and without direction a self-crossing path is genuinely
 * ambiguous about which way time runs. §3.4.2 pins the head at 8px for the
 * related reason — a head that grew with the step length would encode the
 * magnitude a second time, and the reader would have to guess which encoding to
 * believe.
 */
function ConnectedScatter() {
  const segments = phillipsPath.slice(0, -1).map((d, i) => ({
    year: d.year,
    x1: d.unemployment,
    y1: d.inflation,
    x2: phillipsPath[i + 1].unemployment,
    y2: phillipsPath[i + 1].inflation,
  }));
  const marked = phillipsPath.filter((d) => d.year % 5 === 0 || d.year === 2022);

  const chart = glChart({
    marks: [
      glArrow(segments, { x1: 'x1', y1: 'y1', x2: 'x2', y2: 'y2', tone: 'muted' }),
      glPoint(marked, { x: 'unemployment', y: 'inflation', tone: 'c-1' }),
      glLabel(marked, {
        x: 'unemployment',
        y: 'inflation',
        text: (d) => String(d.year),
        tone: 'c-1',
        anchor: 'start',
        dx: 9,
      }),
    ],
    x: glAxisX({ label: 'Unemployment rate (%)', domain: [3.1, 10.1] }),
    y: glAxisY({ label: 'Inflation (%)', domain: [-1.4, 9] }),
    variant: { labelHalo: true },
  });

  return (
    <GLFigure
      title="The 2022 loop left the curve the previous decade traced."
      subtitle="Inflation against unemployment, 2003–2024; arrows run forward in time"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={260} ariaLabel="Inflation against unemployment over time" />
    </GLFigure>
  );
}

/**
 * `60-lag-autocorrelation` — each observation against the one before it.
 *
 * `lagPairs` builds the pairs; the 45° line is the specimen. It is a *reference*
 * — nothing was measured along it, the reader brought it — so §3.4.2 makes it
 * chrome and `glRuleY` refuses a series hue outright. Painting it `c-1` would
 * spend the institutional blue on something that is not a finding, and the
 * reader would then have to work out why this blue line means something
 * different from the other blue marks.
 *
 * Recorded `partial`: the identity line is drawn as a horizontal rule at the
 * series mean rather than at 45°. TanStack's rules ignore their endpoint
 * channels and always span the plot (`constraints.test.ts` §7), so a diagonal
 * reference cannot be a rule, and drawing it as a `glLine` would make it data.
 */
function LagPlot() {
  const values = dailyData.map((d) => d.value);
  const pairs = lagPairs(values, 1);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const lo = Math.min(...values) - 2;
  const hi = Math.max(...values) + 2;

  const chart = glChart({
    marks: [
      glRuleY([mean], { y: (d: number) => d }),
      glPoint(pairs, { x: 'x', y: 'y' }),
    ],
    x: glAxisX({ label: 'Value at t − 1', domain: [lo, hi] }),
    y: glAxisY({ label: 'Value at t', domain: [lo, hi] }),
  });

  return (
    <GLFigure
      title="Consecutive days are almost perfectly correlated."
      subtitle={`Lag-one autocorrelation, ${pairs.length} pairs; the dashed rule is the series mean`}
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={250} ariaLabel="Lag-one autocorrelation" />
    </GLFigure>
  );
}

/**
 * `73-many-point-scatter` — four hundred points with heavy overplotting.
 *
 * This is the plate that justifies §3.4's most-questioned rule: scatter fill AND
 * stroke both at 0.8. Matching them is the point — overlapping circles then
 * darken *together* into a density signal instead of one layer punching through
 * the other. Reduce only the fill and every circle keeps a hard dark edge, so a
 * pile of forty reads exactly like a pile of four.
 */
function ManyPointScatter() {
  const chart = glChart({
    marks: [glPoint(carRows, { x: 'weight', y: 'economy' })],
    x: glAxisX({ label: 'Kerb weight (kg)' }),
    y: glAxisY({ label: 'Fuel economy (mpg)' }),
  });

  return (
    <GLFigure
      title="Economy falls with weight, and the spread narrows as it does."
      subtitle={`${carRows.length} vehicles; overlapping marks darken into density`}
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={250} ariaLabel="Fuel economy against weight" />
    </GLFigure>
  );
}

/**
 * `44-framed-scatter` — TanStack's demonstration that a chart can drop its axes.
 *
 * The GL answer is no, and this plate is what that refusal looks like. §3.5 puts
 * an axis line on both dimensions and gridlines on the one the reader estimates
 * values from; a frame instead of axes leaves them with a box and no way to read
 * a value off it. So the specimen keeps its axes and shows the scatter TanStack's
 * frame was drawn around.
 *
 * Recorded `partial` for exactly that: the entry is answered rather than
 * reproduced, and `frame` stays unwrapped because a GL chart has no use for it.
 */
function FramedScatter() {
  const chart = glChart({
    marks: [glPoint(fitData, { x: 'x', y: 'y' })],
    x: glAxisX({ label: 'Log GDP per capita', domain: [5.7, 11.5] }),
    y: glAxisY({ label: 'Economic complexity index' }),
  });

  return (
    <GLFigure
      title="A frame is not an axis, and the reader needs an axis."
      subtitle="The same scatter TanStack draws guide-free, drawn with the guides §3.5 requires"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={240} ariaLabel="Scatter with axes rather than a frame" />
    </GLFigure>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Change
// ════════════════════════════════════════════════════════════════════════════

/**
 * `30-slopegraph` — the example the whole comparison page was built around.
 *
 * TanStack's version spends eight saturated hues and lets two end-labels
 * collide. Under §3.1 and Decision Rule 1 the same data is one muted backdrop
 * and one highlighted series, and the collision goes away for free because only
 * the labels that carry the finding are drawn. Neither chart is wrong; they
 * answer to different rules, and this pair is where you can see which rule did
 * what.
 */
function Slopegraph() {
  const { backdrop, focus } = popUp(slopeData, { by: 'country', highlight: ['Vietnam', 'Venezuela'] });

  const chart = glChart({
    marks: [
      glMutedLine(backdrop, { x: 'period', y: 'value', z: 'country' }),
      glMutedPoint(backdrop, { x: 'period', y: 'value' }),
      ...focus.flatMap((s) => [
        glLine(s.rows, { x: 'period', y: 'value', z: 'country', tone: s.tone, focus: true }),
        glPoint(s.rows, { x: 'period', y: 'value', tone: s.tone }),
      ]),
      ...endLabels(focus, { x: 'period', y: 'value' }),
    ],
    x: glAxisPoint({ domain: [...SLOPE_PERIODS] }),
    y: glAxisY({ label: 'Complexity percentile' }),
    endLabels: true,
  });

  return (
    <GLFigure
      title="Vietnam gained a decade of complexity; Venezuela lost two."
      subtitle="Economic complexity percentile, 2014 versus 2024, eight economies"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={260} ariaLabel="Complexity percentile, 2014 versus 2024" />
    </GLFigure>
  );
}

/**
 * `33-difference-chart` — a series against its own trend, with the gap shaded.
 *
 * §3.10 decides the pair: a moving average is a DERIVED series, so it keeps its
 * parent's hue and separates by dash. A second colour would claim a second
 * subject, and the reader would reasonably ask what the red line *is*.
 *
 * Recorded `partial`: the difference is shaded as one band in the series' light
 * tone, not as two sign-coloured regions. Splitting a band at its crossings
 * needs the band clipped at the points where the two series cross, and nothing
 * in `compose.ts` computes those — `waterfall` does the analogous job for a
 * signed sequence and there is no equivalent for a pair of curves.
 */
function DifferenceChart() {
  const rows = dailyData.map((d) => ({ t: toEpoch(d.date), value: d.value }));
  const trend = movingAverage(rows, { x: 't', y: 'value', window: 30, as: 'trend' });
  const trendAt = new Map(trend.map((d) => [d.t, d.trend]));
  const paired = rows
    .filter((d) => trendAt.has(d.t))
    .map((d) => ({ ...d, trend: trendAt.get(d.t)! }));

  const chart = glChart({
    marks: [
      glBand(paired, { x: 't', y1: 'value', y2: 'trend' }),
      glLine(paired, { x: 't', y: 'trend', tone: 'c-1', strokeDasharray: '6 4' }),
      glLine(paired, { x: 't', y: 'value', tone: 'c-1', focus: true }),
    ],
    x: timeAxisFor(paired, 't'),
    y: glAxisY({ label: 'Shipments (index)' }),
  });

  return (
    <GLFigure
      title="The series ran above its own trend for most of 2022."
      subtitle="Daily shipments against a 30-day trailing mean; the band is the difference"
      source={SYNTHETIC}
      // This legend used to say the two series differed in TONE — main against
      // light — when on the plot they are both `c-1` main and differ by weight
      // and dash, which is what §3.10 requires of a derived series. Two squares
      // could not show that, so they misreported the chart. A `line` and a
      // `derived` rule show it directly.
      //
      // The band has no entry: the subtitle already says what it is, and §3.11
      // drops an entry a reader has already been given.
      legend={
        <GLLegend
          items={[
            { label: 'Daily', tone: 'c-1', mark: 'line', focus: true },
            { label: '30-day mean', tone: 'c-1', mark: 'derived' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={230} ariaLabel="Shipments against trend" />
    </GLFigure>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Interval
// ════════════════════════════════════════════════════════════════════════════

/**
 * `13-interval-timeline` — open-to-close intervals as bars, not points.
 *
 * A candlestick without its wicks, and the same §3.6 rule: colour encodes sign,
 * so every interval follows it including the ones the reader is not looking at.
 * `signColor()` is a chart-level scale, so the marks leave `fill` unset and let
 * the scale paint — setting a fill would bypass the scale for every datum, which
 * is what `paint()` in `marks.ts` exists to prevent.
 */
function IntervalTimeline() {
  const chart = glChart({
    marks: [
      glRuleY([0], { y: (d: number) => d }),
      glLink(candleData, {
        x1: 'day',
        x2: 'day',
        y1: 'open',
        y2: 'close',
        color: (d) => signKey(d.close - d.open),
        strokeWidth: 9,
      }),
      glTickY(candleData, { x: 'day', y: 'close', tone: 'muted' }),
    ],
    x: glAxisX({ label: 'Trading day', nice: false }),
    y: glAxisY({ label: 'Price (index)' }),
    color: signColor({ step: 'main' }),
  });

  return (
    <GLFigure
      title="Eight of the twenty-two sessions closed below their open."
      subtitle="Open-to-close interval by session; the tick marks the close"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={240} ariaLabel="Open to close intervals" />
    </GLFigure>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Ranking
// ════════════════════════════════════════════════════════════════════════════

/**
 * `54-bump-ranking` — position over time rather than value over time.
 *
 * The ranks are computed per year, then the y axis is INVERTED by pinning its
 * domain high-to-low, because rank 1 belongs at the top and a scale left to
 * infer its own direction puts it at the bottom.
 *
 * §3.1 applies here as everywhere: five series would be five hues, so the two
 * that actually change places take `c-1` and `c-2` and the rest carry the shape
 * of the field in `c-muted`.
 */
function BumpRanking() {
  const byYear = new Map<number, typeof sectorData[number][]>();
  for (const row of sectorData) {
    const bucket = byYear.get(row.year) ?? [];
    bucket.push(row);
    byYear.set(row.year, bucket);
  }
  const ranked = [...byYear.values()].flatMap((rows) =>
    [...rows]
      .sort((a, b) => b.value - a.value)
      .map((row, i) => ({ ...row, rank: i + 1 })),
  );

  const { backdrop, focus } = popUp(ranked, {
    by: 'sector',
    highlight: ['Construction', 'Manufacturing'],
  });
  const series = focusSeries(['Construction', 'Manufacturing']);

  const chart = glChart({
    marks: [
      glMutedLine(backdrop, { x: 'year', y: 'rank', z: 'sector' }),
      glMutedPoint(backdrop, { x: 'year', y: 'rank' }),
      ...focus.flatMap((s) => [
        glLine(s.rows, { x: 'year', y: 'rank', z: 'sector', tone: s.tone, focus: true }),
        glPoint(s.rows, { x: 'year', y: 'rank', tone: s.tone }),
      ]),
      ...endLabels(
        series.map((s) => ({ ...s, rows: s.rows.map((r) => ranked.find((d) => d.sector === s.key && d.year === r.year)!) })),
        { x: 'year', y: 'rank' },
      ),
    ],
    // Padded a third of a year either side: every year carries a 6px dot, and the
    // endpoints' dots would otherwise straddle the axis lines.
    x: yearAxisFor(ranked, 'year', { domain: [2003.7, 2024.3], nice: false }),
    // High-to-low, so rank 1 is at the top. `nice: false` because the domain is
    // the rank range exactly — nicening it would invent a rank 0 and a rank 6.
    y: glAxisY({
      label: 'Rank by employment',
      domain: [SECTORS.length + 0.4, 0.6],
      values: SECTORS.map((_, i) => i + 1),
      nice: false,
    }),
    endLabels: true,
  });

  return (
    <GLFigure
      title="Construction took second place for six years and then lost it."
      subtitle="Sector rank by employment, 2004–2024"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={250} ariaLabel="Sector rank by employment" />
    </GLFigure>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Multivariate
// ════════════════════════════════════════════════════════════════════════════

/**
 * `27-parallel-coordinates` — five dimensions in five different unit systems.
 *
 * Normalizing each dimension to its own 0–1 range is what makes the form
 * correct, and it happens in the plate because it is data preparation. The
 * `popUp` treatment then does the rest: six polylines in six hues is a plate of
 * spaghetti, and the whole point of the chart is one profile read against the
 * field.
 *
 * Recorded `partial`: the per-dimension axes each want their own tick labels in
 * their own units, and a GL chart has one y axis. The dimension names are drawn
 * on the categorical x axis and the values are unlabelled, so the reader gets the
 * shape and not the magnitudes — which the subtitle says.
 */
function ParallelCoordinates() {
  const extents = new Map<string, readonly [number, number]>(
    PARALLEL_DIMENSIONS.map((dimension) => {
      const values = parallelData.filter((d) => d.dimension === dimension).map((d) => d.value);
      return [dimension, [Math.min(...values), Math.max(...values)] as const];
    }),
  );
  const rows = parallelData.map((d) => {
    const [lo, hi] = extents.get(d.dimension)!;
    return { ...d, normalized: hi === lo ? 0.5 : (d.value - lo) / (hi - lo) };
  });

  const { backdrop, focus } = popUp(rows, { by: 'country', highlight: ['Korea, Rep.', 'Nigeria'] });

  const chart = glChart({
    marks: [
      glMutedLine(backdrop, { x: 'dimension', y: 'normalized', z: 'country' }),
      ...focus.map((s) =>
        glLine(s.rows, { x: 'dimension', y: 'normalized', z: 'country', tone: s.tone, focus: true }),
      ),
      ...endLabels(focus, { x: 'dimension', y: 'normalized' }),
    ],
    x: glAxisPoint({ domain: [...PARALLEL_DIMENSIONS] }),
    y: glAxisPercent({ scale: 'fraction', label: 'Position within the range' }),
    endLabels: true,
    margin: { bottom: 60 },
  });

  return (
    <GLFigure
      title="Korea leads on complexity and trails on openness."
      subtitle="Six economies across five dimensions, each rescaled to its own observed range"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={250} ariaLabel="Parallel coordinates across five dimensions" />
    </GLFigure>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Survey
// ════════════════════════════════════════════════════════════════════════════

/**
 * `26-diverging-likert` — the one place a diverging ramp is unambiguously right.
 *
 * Decision Rule 9 allows a diverging scale only where a midpoint genuinely
 * exists, and a Likert scale has one by construction: the boundary between
 * disagreement and agreement is a real threshold, not a domain midpoint that
 * happens to fall there. So the four responses walk `glDivergingColor` over a
 * signed rank, and the zero rule is promoted to axis weight because respondents
 * are counted from it in both directions.
 */
function DivergingLikert() {
  const rank: Record<string, number> = {
    'Strongly disagree': -2,
    Disagree: -1,
    Agree: 1,
    'Strongly agree': 2,
  };
  // Stack order is INSIDE-OUT from the zero line, not left-to-right along the
  // scale. `offset: 'diverging'` lays each side out in list order starting at
  // zero, so the mild responses have to come first or the chart reads backwards:
  // sorting by the signed rank puts "Strongly disagree" against the baseline and
  // the reader decodes intensity as decreasing outward, which is the opposite of
  // what a Likert scale means.
  const order = ['Disagree', 'Strongly disagree', 'Agree', 'Strongly agree'];
  const rows = [...likertData].sort(
    (a, b) => order.indexOf(a.response) - order.indexOf(b.response),
  );
  // The legend reads along the scale, worst to best, which is the order a reader
  // expects to see the categories named in — deliberately not the stack order.
  const legendOrder = [...LIKERT_RESPONSES].sort((a, b) => rank[a] - rank[b]);

  const ramp = glDivergingColor({ domain: [-2, 2], steps: 4 });

  const chart = glChart({
    marks: [
      glBarX(rows, {
        y: 'question',
        x: 'share',
        z: 'response',
        color: (d) => rank[d.response],
        layout: stack({ offset: 'diverging', order }),
      }),
    ],
    x: glAxisPercent({
      scale: 'fraction',
      label: 'Share of respondents',
      domain: [-0.75, 0.75],
      values: [-0.6, -0.3, 0, 0.3, 0.6],
      format: (v) => `${Math.abs(Math.round(v * 100))}%`,
    }),
    y: glAxisBand({ domain: [...new Set(likertData.map((d) => d.question))] }),
    color: { scale: ramp },
    variant: { stacked: true, zeroBaseline: true },
    margin: { left: 200 },
  });

  return (
    <GLFigure
      title="Only contract enforcement draws net disagreement."
      subtitle="Firm responses to six statements on the business environment, n = 1,240"
      source={SYNTHETIC}
      // Squares, and below the plot: the bands stack HORIZONTALLY here, so a
      // right-hand column would have no vertical order to mirror, and reading
      // the row left-to-right is already the scale's own order (§3.11).
      //
      // Marks come from the RAMP, and the label takes `ink-2` rather than a
      // series dark tone. A ramp step is not a series colour — there is no
      // "this mark's dark tone" to reach for, the same reason `glGeoShape`
      // strokes at `ink-3` and `glLabelInkOn` follows a fill's luminance. The
      // shortcut of spending c-1/c-2's light and main instead puts four tones
      // against four DIFFERENT fills and the legend stops matching the chart.
      legend={
        <GLLegend
          items={legendOrder.map((response) => {
            const fill = ramp(rank[response]);
            return { label: response, tone: { light: fill, main: fill, dark: ink[2] } };
          })}
        />
      }
    >
      <Chart {...chart.props} height={250} ariaLabel="Likert responses by statement" />
    </GLFigure>
  );
}

// ── Bonus: the histogram's cumulative twin, which lives with the bars ────────

/**
 * `18-cumulative-histogram` — the same bins, read as "at or below".
 *
 * Drawn on `glAxisBin` so the bands abut: bins partition a continuum, and the
 * 0.28 gap `glAxisBand` would put between them invents a discreteness the data
 * does not have. Six categories where the analyst measured one distribution.
 * `glBinBar` then lays the 1px paper channel of §3.4.3 over the boundaries,
 * which separates the bins without taking width away from any of them.
 */
function CumulativeHistogram() {
  const sample = carRows.map((d) => d.economy);
  const bins = binValues(sample, { count: 14 });
  let running = 0;
  const rows = bins.map((b) => {
    running += b.count;
    return {
      bin: String(Math.round(b.x1)),
      cumulative: running / sample.length,
    };
  });

  // Every third bin edge, by index — see the histogram in `specimens.tsx` for
  // why a `% 10 === 0` test on the edge is the wrong instrument. Here it did
  // match twice by luck, which is worse than never: two labels under fourteen
  // ticks reads as a broken axis rather than an obviously empty one.
  const ticks = rows.filter((_, i) => i % 3 === 0).map((r) => r.bin);

  const chart = glChart({
    marks: [glBinBar(rows, { x: 'bin', y: 'cumulative' })],
    x: glAxisBin({
      label: 'Fuel economy (mpg)',
      values: ticks,
      format: (v) => String(Math.round(Number(v))),
    }),
    y: glAxisPercent({ scale: 'fraction', label: 'Share at or below' }),
  });

  return (
    <GLFigure
      title="Nine in ten vehicles fall below 35 mpg."
      subtitle={`Cumulative distribution of fuel economy, ${sample.length} vehicles, ${bins.length} bins`}
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={230} ariaLabel="Cumulative fuel economy distribution" />
    </GLFigure>
  );
}

// ── Renderers ───────────────────────────────────────────────────────────────

export const CARTESIAN_RENDERERS: Record<string, () => ReactNode> = {
  'ts-01-line-gaps': LineGaps,
  'ts-02-multi-line-end-labels': MultiLineEndLabels,
  'ts-55-indexed-multi-line': IndexedMultiLine,
  'ts-58-select-extrema': SelectExtrema,
  'ts-03-temperature-range-band': RangeBand,
  'ts-04-stacked-time-area': StackedArea,
  'ts-21-streamgraph': Streamgraph,
  'ts-70-composed-chart': ComposedChart,
  'ts-bar-horizontal-ranking': HorizontalRanking,
  'ts-bar-grouped': GroupedBars,
  'ts-bar-stacked': StackedBars,
  'ts-59-grouped-reducer-bars': ReducerBars,
  'ts-71-population-pyramid': PopulationPyramid,
  'ts-72-mixed-bars': MixedBars,
  'ts-scatter-bubble': BubbleScatter,
  'ts-53-log-scale-scatter': LogScatter,
  'ts-56-connected-scatter': ConnectedScatter,
  'ts-60-lag-autocorrelation': LagPlot,
  'ts-73-many-point-scatter': ManyPointScatter,
  'ts-44-framed-scatter': FramedScatter,
  'ts-30-slopegraph': Slopegraph,
  'ts-33-difference-chart': DifferenceChart,
  'ts-13-interval-timeline': IntervalTimeline,
  'ts-54-bump-ranking': BumpRanking,
  'ts-27-parallel-coordinates': ParallelCoordinates,
  'ts-26-diverging-likert': DivergingLikert,
  'ts-18-cumulative-histogram': CumulativeHistogram,
};
