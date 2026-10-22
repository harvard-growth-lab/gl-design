/**
 * Annotations and Overlays — four forms whose subject is a *second* thing on the
 * plot: a threshold the reader brought with them, an arrow that says which way a
 * country moved, a slope that joins two years, a trend a series is measured
 * against.
 *
 * §3.4.2 draws the line all four sit on, and it is the line real Atlas data
 * keeps testing:
 *
 * 1. **A reference is chrome; a change is a measurement.** The RCA = 1 rule
 *    below is dashed `ink-3` and takes no hue, because nobody observed it — it
 *    is the Atlas's *definition* of comparative advantage. The arrows on the
 *    next demo are the same geometry doing the opposite job, so they carry the
 *    series tone at line weight and an 8px head that never scales.
 *
 * 2. **Annotations need a position the definition does not have.** The threshold
 *    label, the arrow labels and the slopegraph's end labels are all placed from
 *    data with a fixed pixel offset, because nothing in the library measures
 *    rendered text. Where two of them land on top of each other — and with real
 *    countries two of them do — that is recorded rather than nudged.
 *
 * 3. **The overlay is often the honest part of the chart.** Vietnam exported
 *    essentially no telephones for thirteen years; a linear axis squashes those
 *    years against the reference rule, and that squashing is the finding, not a
 *    rendering fault.
 *
 * Contract, unchanged: no hex, no font size, no stroke width, no opacity below.
 * Every offset that appears is `LABEL_GAP` or `geometry.*`. Data preparation is
 * authored; appearance never is.
 */

import type { ReactNode } from 'react';
import { Chart } from '@tanstack/react-charts';

import {
  LABEL_GAP,
  endLabels,
  geometry,
  glAnnotation,
  glArrow,
  glAxisLog,
  glAxisPoint,
  glAxisY,
  glBand,
  glChart,
  glLabel,
  glLine,
  glMutedLine,
  glMutedPoint,
  glPoint,
  glRuleY,
  movingAverage,
  popUp,
  yearAxisFor,
} from '../src/index.js';
import { GLFigure, GLLegend } from '../src/figure.js';

import {
  FIRST_YEAR,
  LATEST_YEAR,
  LEAD,
  countryName,
  countryYear,
  countryYearTable,
  defined,
  leadPartners,
  leadPartnersTable,
  leadProductPanel,
  leadProductPanelTable,
  seriesFor,
  sourceOf,
  withNote,
} from './atlas-data.js';
import type { Demo, Family } from './demo.js';

const PANEL = sourceOf(countryYearTable);
const PRODUCT_PANEL = sourceOf(leadProductPanelTable);
const PARTNERS = sourceOf(leadPartnersTable, countryYearTable);

// ════════════════════════════════════════════════════════════════════════════

// #region demo:spec-03-threshold
/**
 * A series against a threshold the Atlas itself defines.
 *
 * The synthetic plate used a made-up policy target, which is the easy case: any
 * number will do. The Atlas has a *real* one. Revealed comparative advantage is
 * a country's share of world exports of a product divided by its share of world
 * exports overall, so **RCA = 1 is the point at which a country exports its fair
 * share** — the Atlas's own definition of specialising in something. Nobody
 * measured that line; it is arithmetic the reader brings to the chart.
 *
 * Which is exactly §3.4.2's test, and why `glRuleY` **ignores `tone`**: passing
 * `c-2` here changes nothing. Dashed `ink-3` at gridline weight, and the series
 * stays solid, so the reader can tell at a glance which of the two lines is a
 * measurement.
 */
const TELEPHONES = '8517';
const RCA_THRESHOLD = 1;

function ComparativeAdvantageThreshold() {
  // One product's whole history. `defined` rather than `?? 0`: an RCA of zero
  // means "exports none of it", which is a real observation, and a null would
  // mean the Atlas has no trade record at all — the two must not merge.
  const rows = defined(
    leadProductPanel.filter((d) => d.code === TELEPHONES),
    'rca',
  ).sort((a, b) => a.year - b.year);

  const product = rows[0];

  const chart = glChart({
    marks: [
      glRuleY([RCA_THRESHOLD], { y: (d: number) => d }),
      glLine(rows, { x: 'year', y: 'rca', focus: true }),
      // The label goes on the rule, a couple of observations in from the axis,
      // where the pre-2008 series leaves the plot open. See the gap: the x is
      // still chosen rather than measured.
      glAnnotation([{ year: rows[2].year, rca: RCA_THRESHOLD }], {
        x: 'year',
        y: 'rca',
        text: () => 'RCA = 1 — the Atlas threshold for comparative advantage',
        anchor: 'start',
        dy: -LABEL_GAP,
      }),
    ],
    x: yearAxisFor(rows, 'year'),
    y: glAxisY({ label: 'Revealed comparative advantage' }),
    variant: { labelHalo: true },
  });

  return (
    <GLFigure
      title="Vietnam crossed into comparative advantage in telephones in 2008 and has not fallen back since."
      subtitle={`Revealed comparative advantage in ${product.nameShort.toLowerCase()} (HS92 ${product.code}), ${FIRST_YEAR}–${LATEST_YEAR}`}
      source={withNote(PRODUCT_PANEL, 'RCA is Vietnam’s share of world exports of the product over its share of world exports overall')}
    >
      <Chart {...chart.props} height={230} ariaLabel="Vietnam revealed comparative advantage in telephones" />
    </GLFigure>
  );
}
// #endregion

// #region demo:spec-06-change-arrows
/**
 * Where an economy started and where it ended, as one mark.
 *
 * The arrowhead is the only thing distinguishing a rise from a fall, which is
 * why §3.4.2 pins its length in pixels: a head that scaled with the magnitude
 * would encode the value twice and the reader would have to guess which
 * encoding to trust.
 *
 * And it is why the LABEL has to know the direction too (§3.12). Anchoring every
 * country's name at `start` puts the one arrow that runs right-to-left — Libya's,
 * whose nominal income is lower than it was in 1995 — back across its own head
 * and shaft. So the side is `x2 > x1 ? 'right' : 'left'` and the anchor follows
 * it, and the clearance is measured from the HEAD rather than from `x2`, because
 * `arrowHeadLength` is the mark's real rendered edge exactly as a bubble's radius
 * is on a scatter.
 *
 * The selection rule is the ten largest movers on complexity in either
 * direction. That is a rule rather than a taste: it cannot quietly drop the
 * economies that went backwards, which is what the chart is for.
 */
const MOVERS = 10;

function ComplexityMoves() {
  const start = new Map(countryYear.filter((d) => d.year === FIRST_YEAR).map((d) => [d.iso3, d]));

  // An arrow needs four measurements. A country missing any one of them has no
  // start or no end — not a shorter arrow — so it is dropped whole.
  const moves = countryYear
    .filter((d) => d.year === LATEST_YEAR)
    .flatMap((end) => {
      const from = start.get(end.iso3);
      if (!from) return [];
      if (from.eci == null || end.eci == null) return [];
      if (from.gdpPerCapita == null || end.gdpPerCapita == null) return [];
      return [
        {
          country: countryName(end.iso3),
          x1: from.gdpPerCapita,
          y1: from.eci,
          x2: end.gdpPerCapita,
          y2: end.eci,
          shift: end.eci - from.eci,
        },
      ];
    })
    .sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift))
    .slice(0, MOVERS);

  const pointsRight = (d: (typeof moves)[number]) => d.x2 > d.x1;
  const headClearance = geometry.arrowHeadLength + LABEL_GAP;

  const chart = glChart({
    marks: [
      glArrow(moves, { x1: 'x1', y1: 'y1', x2: 'x2', y2: 'y2' }),
      glLabel(moves, {
        x: 'x2',
        y: 'y2',
        text: (d) => d.country,
        anchor: (d) => (pointsRight(d) ? 'start' : 'end'),
        dx: (d) => (pointsRight(d) ? headClearance : -headClearance),
      }),
    ],
    // Income on a log axis, in the units the Atlas reports it, rather than a
    // hand-computed z-score: a doubling is the same distance everywhere, which
    // is the only way a $250 economy and a $9,000 one share a chart.
    x: glAxisLog({ label: 'GDP per capita (current USD)' }),
    y: glAxisY({ label: 'Economic Complexity Index' }),
    variant: { labelHalo: true },
    endLabels: true,
  });

  return (
    <GLFigure
      title="Venezuela and Libya gave back nearly two points of complexity while their incomes stood still."
      subtitle={`Change in GDP per capita and the Economic Complexity Index, ${FIRST_YEAR} → ${LATEST_YEAR}; the ten largest movers on complexity`}
      source={withNote(PANEL, 'Ranked by absolute change in ECI; economies missing either endpoint are excluded')}
    >
      <Chart {...chart.props} height={280} ariaLabel="Change in income and complexity, ten largest movers" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-30-slopegraph
/**
 * Two years, eleven destinations, one reordering.
 *
 * TanStack's slopegraph spends a saturated hue on every series and lets the end
 * labels collide. Under §3.1 and Decision Rule 1 the same data is one muted
 * backdrop and two findings, and most of the collision goes away for free
 * because only the labels that carry the finding are drawn at all.
 *
 * The share is taken against Vietnam's TOTAL goods exports, not against the sum
 * of these twelve markets. That matters: the twelve cover 62% of exports in 1995
 * and 75% in 2023, so a within-twelve share would quietly restate a change in
 * coverage as a change in destination. The slopes therefore do not sum to 100 at
 * either end, and they are not supposed to.
 */
function DestinationShares() {
  const ENDPOINTS = [FIRST_YEAR, LATEST_YEAR];

  // The denominator: Vietnam's own total exports in each of the two years.
  const totalIn = new Map(
    defined(
      seriesFor(LEAD).filter((d) => ENDPOINTS.includes(d.year)),
      'exportValueM',
    ).map((d) => [d.year, d.exportValueM] as const),
  );

  const observed = defined(
    leadPartners.filter((d) => ENDPOINTS.includes(d.year)),
    'exportValueM',
  ).flatMap((d) => {
    const total = totalIn.get(d.year);
    return total
      ? [{ partner: d.partnerShort, period: String(d.year), share: (d.exportValueM / total) * 100 }]
      : [];
  });

  // A slope needs two ends. The United Arab Emirates only enters Vietnam's top
  // twelve in 2000, so it has a 2023 point and no 1995 one; drawn, it would be a
  // lone dot the reader would read as a market that held steady.
  const paired = observed.filter(
    (d) => observed.filter((o) => o.partner === d.partner).length === ENDPOINTS.length,
  );

  const nameOf = (iso3: string): string =>
    leadPartners.find((d) => d.partner === iso3)?.partnerShort ?? iso3;

  // c-1 goes to the market that rose, c-2 to the one that fell — §3.6's valence,
  // applied to the only two series that carry a finding.
  const { backdrop, focus } = popUp(paired, {
    by: 'partner',
    highlight: [nameOf('USA'), nameOf('JPN')],
  });

  const chart = glChart({
    marks: [
      glMutedLine(backdrop, { x: 'period', y: 'share', z: 'partner' }),
      glMutedPoint(backdrop, { x: 'period', y: 'share' }),
      ...focus.flatMap((s) => [
        glLine(s.rows, { x: 'period', y: 'share', z: 'partner', tone: s.tone, focus: true }),
        glPoint(s.rows, { x: 'period', y: 'share', tone: s.tone }),
      ]),
      ...endLabels(focus, { x: 'period', y: 'share' }),
    ],
    x: glAxisPoint({ domain: [String(FIRST_YEAR), String(LATEST_YEAR)] }),
    y: glAxisY({ label: 'Share of Vietnam’s goods exports (%)' }),
    endLabels: true,
  });

  return (
    <GLFigure
      title="Japan’s share of Vietnam’s exports fell from three dollars in ten to one in twenty; the United States took its place."
      subtitle={`Share of Vietnam’s total goods exports by destination market, ${FIRST_YEAR} versus ${LATEST_YEAR}`}
      source={withNote(
        PARTNERS,
        'Eleven of the twelve largest markets; the United Arab Emirates has no 1995 observation. The twelve cover 62% of exports in 1995 and 75% in 2023',
      )}
    >
      <Chart {...chart.props} height={280} ariaLabel="Vietnam export shares by destination, 1995 versus 2023" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-33-difference-chart
/**
 * A series measured against its own recent history.
 *
 * §3.10 decides the pair: a moving average is a DERIVED series, so it keeps its
 * parent's hue and separates by weight and dash. A second colour would claim a
 * second subject and the reader would reasonably ask what the red line *is*.
 *
 * The subject is the Complexity Opportunity Index — how much new complexity the
 * products Vietnam does not yet make would open up, given what it already makes.
 * Unlike ECI it is genuinely noisy year to year, which is the condition a
 * difference chart is for: the band is the gap between the observation and the
 * trend, and it flips sign six times in twenty-five years.
 *
 * Recorded `partial` upstream, and the shortfall survives contact with real
 * data: the difference is shaded as ONE band in the series' light tone, not as
 * two sign-coloured regions, because splitting it needs the band clipped at
 * every crossing and nothing in `compose.ts` computes those.
 */
const TREND_WINDOW = 5;

function OpportunityAgainstTrend() {
  const rows = defined(seriesFor(LEAD), 'coi').map((d) => ({ year: d.year, coi: d.coi }));

  // `movingAverage` returns the parent rows with the averaged column added, and
  // drops the years before the window is full — a "five-year mean" whose first
  // point averages one year is not a five-year mean, and the reader cannot see
  // which points are which.
  const paired = movingAverage(rows, {
    x: 'year',
    y: 'coi',
    window: TREND_WINDOW,
    as: 'trend',
  });

  const chart = glChart({
    marks: [
      // The band goes first: marks paint in array order, and a band listed after
      // its lines covers them.
      glBand(paired, { x: 'year', y1: 'coi', y2: 'trend' }),
      glLine(paired, { x: 'year', y: 'trend', tone: 'c-1', strokeDasharray: geometry.ruleDash }),
      glLine(paired, { x: 'year', y: 'coi', tone: 'c-1', focus: true }),
    ],
    x: yearAxisFor(paired, 'year'),
    y: glAxisY({ label: 'Complexity Opportunity Index' }),
  });

  return (
    <GLFigure
      title="Vietnam’s opportunity index ran above its own five-year trend for a decade and a half, then spent five years below it."
      subtitle={`Complexity Opportunity Index against its own ${TREND_WINDOW}-year trailing mean, ${paired[0].year}–${LATEST_YEAR}`}
      source={PANEL}
      legend={
        <GLLegend
          items={[
            { label: 'Complexity Opportunity Index', tone: 'c-1', mark: 'line', focus: true },
            { label: `${TREND_WINDOW}-year trailing mean`, tone: 'c-1', mark: 'derived' },
            { label: 'Difference', tone: 'c-1', mark: 'band' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={230} ariaLabel="Vietnam complexity opportunity against its trend" />
    </GLFigure>
  );
}
// #endregion

// ════════════════════════════════════════════════════════════════════════════

const demos: Demo[] = [
  {
    id: 'spec-03-threshold',
    family: 'Annotations and Overlays',
    name: 'Reference rule over a series',
    question: 'When did Vietnam start exporting telephones competitively?',
    rule: '§3.4.2 — chrome: ink-3, dashed, and it IGNORES tone.',
    render: ComparativeAdvantageThreshold,
    gaps: [
      'The rule is labelled with a margin annotation. A label sitting ON the rule would need the paper halo (variant: { labelHalo: true }) and a measured x position the definition does not have at build time.',
      'The x of the annotation is still picked by hand — `rows[2].year`, chosen because the pre-2008 series leaves that corner of the plot empty. Nothing in the library finds open plot space, so every in-plot annotation on this page is placed by an author looking at a rendering, which is the one thing the rest of the contract forbids.',
      'On a linear axis the thirteen years before the crossing (RCA 0.01–0.41) are compressed into the bottom twentieth of the plot and read as a flat line on the baseline. `glAxisLog` would spread them — but the RCA = 1 threshold then lands exactly on a decade gridline, where a dashed ink-3 rule is indistinguishable from the ink-3 gridline it duplicates. §3.4.2 rules on what a reference looks like and not on what happens when it coincides with a tick, so neither axis is right and the linear one is at least honest about the scale of the change.',
    ],
  },
  {
    id: 'spec-06-change-arrows',
    family: 'Annotations and Overlays',
    name: 'Directed change in two dimensions',
    question: 'Which economies moved furthest on complexity, and did their incomes follow?',
    rule: '§3.4.2 — the 8px head is pinned; a scaled head encodes the value twice.',
    render: ComplexityMoves,
    gaps: [
      'glLabel has no collision handling, and two of the ten heads land within a few pixels of each other: Angola ends at ($3,066, −1.16) and Zimbabwe at ($2,669, −1.12) — a fifth of a decade apart on the log axis and a hundredth of an index point apart on the y — so their names overlap on the same baseline. This is the same shortfall already recorded against endLabels on the Lines family — a dodge pass over placed labels belongs in compose.ts — but it bites glLabel independently, because an arrow chart labels with glLabel and never goes through endLabels at all.',
      'Only one of the ten arrows runs right-to-left. GDP per capita is nominal current USD, and of the 136 economies with both endpoints exactly three ended 2023 below their 1995 figure (Japan, Libya, Yemen), so the directional-anchor rule this specimen exists to demonstrate is exercised here by a single mark. The synthetic plate could put a leftward arrow wherever it wanted; the Atlas cannot.',
    ],
  },
  {
    id: 'ts-30-slopegraph',
    family: 'Annotations and Overlays',
    name: 'Two-period slopegraph',
    question: 'Where did Vietnam’s exports go in 1995, and where do they go now?',
    rule: '§3.1 + Decision Rule 1 — eight hues become one backdrop and two findings.',
    render: DestinationShares,
    gaps: [
      'The Atlas’s own short name for the largest market is "United States of America" — twenty-four characters. `glMarginEndLabels` reserves 72px on the right for direct labels, which holds about ten characters at the series-label size, so the label runs past the plot block. The synthetic specimen labelled "Vietnam" and "Venezuela" and never met this. Either the margin has to be derived from the longest label the chart will draw, or `nameShort` needs a second, shorter form for label use — and the spec has not ruled on which.',
      'One of the twelve markets is dropped rather than drawn: the United Arab Emirates first appears in Vietnam’s top twelve in 2000, so it has no 1995 endpoint. A slopegraph has no way to say "arrived during the period" — the honest options are to omit the series (taken here, and disclosed in the source line) or to draw a single dot the reader will misread as a flat slope.',
      'The smallest markets sit within a share-point of zero, so their dots straddle the x axis — the token audit flags two of them dropping 4–5px below the plot frame. `yearAxisFor` documents the equivalent x-axis fix (pad the domain by 0.3 when endpoints carry dots) but there is no y-axis counterpart and no rule for what a dot at the domain minimum should do. Synthetic data never put an observation exactly on the frame; real shares do.',
    ],
  },
  {
    id: 'ts-33-difference-chart',
    family: 'Annotations and Overlays',
    name: 'Series against its own trend',
    question: 'Is Vietnam still finding new opportunities faster than its own recent record?',
    rule: '§3.10 — a derived series keeps the parent hue and separates by dash.',
    render: OpportunityAgainstTrend,
    gaps: [
      'The difference is shaded as ONE band in the series’ light tone rather than as two sign-coloured regions. Splitting it needs the band clipped at every point where the two curves cross, and nothing in `compose.ts` computes those crossings — `waterfall` does the analogous job for a signed sequence and there is no equivalent for a pair of curves. §3.6 would want the split, so this is a real shortfall rather than a stylistic choice.',
      '§3.10 asks a derived series to separate from its parent by dash, but `tokens.json` carries exactly one dash pattern — `geometry.ruleDash` — and §3.4.2 reserves it for chrome. The gallery specimen hard-coded `6 4`; this page may not, so the trailing mean takes the reference-rule dash and a derived DATA line now looks like a threshold. A `derivedDash` token belongs in SPEC.md §3.10 next to the rule that needs it.',
      'The catalog specimen is a 30-day trailing mean over daily shipments. The Atlas is annual, so the window here is five years and the trend starts in 1999 rather than at the first observation — the form is exercised, the grain is not.',
    ],
  },
];

export const annotationsFamily: Family = {
  slug: 'annotations-and-overlays',
  title: 'Annotations and Overlays',
  blurb:
    'Four charts whose subject is a second thing on the plot — a threshold, a direction, a slope, a trend. The reference marks stay grey and quiet so the data keeps the colour.',
  demos,
};

export function renderAnnotations(): Record<string, () => ReactNode> {
  return Object.fromEntries(demos.map((d) => [d.id, d.render]));
}
