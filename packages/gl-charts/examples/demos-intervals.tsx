/**
 * Intervals and Financial — four forms that draw a RANGE rather than a point.
 *
 * This is the family the Atlas is least shaped for, and the family where saying
 * so is most of the work. Three things had to be settled before any of it could
 * be drawn honestly:
 *
 * 1. **The Atlas publishes no standard errors.** Not on ECI, not on PCI, not on
 *    a growth projection. So an "error bar" here cannot be a confidence
 *    interval — it is the observed *spread* of a population, and the demo says
 *    which one it is in the subtitle rather than letting the form imply
 *    inference that nobody performed.
 *
 * 2. **There is no open, high, low or close.** A candlestick assumes a trading
 *    day. The Atlas has one number per country-year. The nearest honest framing
 *    keeps all four values real by widening the period instead of inventing
 *    grain: the candle's period becomes the whole 1995–2023 panel, open is the
 *    first year, close is the last, and the wick is the highest and lowest year
 *    in between. Nothing is interpolated; what is lost is the form's cadence,
 *    and that is recorded rather than faked.
 *
 * 3. **Percentiles come from the Atlas, not from us.** `lead-thresholds`
 *    carries p10/p25/p50/p75/p90 of Vietnam's product-level distributions per
 *    year, so the fan and the Atlas cannot disagree about what the tenth
 *    percentile is. The one chart that *does* derive quantiles — the sector
 *    error bars — says so on the figure, because the Atlas has no per-sector
 *    thresholds to read instead.
 *
 * Contract, unchanged: no hex, no font size, no stroke width, no opacity below.
 * One of these four demos comes out visibly weaker than its synthetic specimen
 * *because* of that rule, and the gap entry is the deliverable.
 */

import type { ReactNode } from 'react';
import { Chart } from '@tanstack/react-charts';

import {
  fanTones,
  glAxisBand,
  glAxisY,
  glBand,
  glChart,
  glLine,
  glLink,
  glPoint,
  glRuleY,
  glTickY,
  glTile,
  signColor,
  signKey,
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
  leadProductYearTable,
  leadProducts,
  leadThresholdsTable,
  seriesFor,
  sourceOf,
  thresholdsFor,
  withNote,
  worldSectorYear,
  worldSectorYearTable,
} from './atlas-data.js';
import type { Demo, Family } from './demo.js';

const BASKET = sourceOf(leadProductYearTable);
const PANEL = sourceOf(countryYearTable);
const SHARES = sourceOf(countrySectorYearTable, worldSectorYearTable);
const THRESHOLDS = sourceOf(leadThresholdsTable);

// ════════════════════════════════════════════════════════════════════════════

// #region demo:spec-04-errorbar
/**
 * A point estimate with an interval, per sector.
 *
 * §3.4.2: an error bar is three marks — a connector for the interval, two data
 * ticks capping it, and the estimate itself. The caps are 8px, twice the axis
 * tick, so a tick that carries a value can never be read as chrome.
 *
 * **What the interval is, and what it is not.** The Atlas publishes no standard
 * errors, anywhere. There is no sampling distribution behind PCI to draw a 95%
 * interval from, so drawing one would be the exact fabrication this page exists
 * to refuse. What the data *does* support is dispersion: the middle half of the
 * complexity of the products a sector actually contains. So the point is the
 * median product and the bar is the interquartile range, and the subtitle says
 * so in those words rather than "confidence interval".
 *
 * Quantiles are derived here, which every other chart on this page avoids —
 * `lead-thresholds` gives Atlas-computed percentiles for the basket as a whole,
 * by year, but not by sector. The derivation is linear interpolation between
 * order statistics over the 1,129 four-digit products Vietnam exported in 2023;
 * the 70 with zero exports are dropped, because a product the country does not
 * ship tells you about the world's product space, not about Vietnam's basket.
 *
 * The axis is ordered by the estimate rather than by `SECTOR_ORDER`. That key
 * fixes a sector's *tone* across the page, and nothing here is tone-encoded —
 * an error bar is one series — so position is free to carry the ranking, which
 * is the finding.
 */
function SectorComplexitySpread() {
  /** Linear-interpolated order statistic. `sorted` must already be ascending. */
  const quantile = (sorted: readonly number[], p: number): number => {
    const i = (sorted.length - 1) * p;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
  };

  // Products Vietnam actually exported in 2023. `defined` drops the nulls; the
  // `> 0` drops the codes the Atlas carries at zero, which are absences.
  const exported = defined(defined(leadProducts, 'pci'), 'exportValueM').filter(
    (d) => d.exportValueM > 0,
  );

  const rows = SECTOR_ORDER.map((sector) => {
    const pci = exported
      .filter((d) => d.sector === sector)
      .map((d) => d.pci)
      .sort((a, b) => a - b);
    return {
      sector,
      products: pci.length,
      low: quantile(pci, 0.25),
      estimate: quantile(pci, 0.5),
      high: quantile(pci, 0.75),
    };
  })
    .filter((d) => d.products > 0)
    .sort((a, b) => b.estimate - a.estimate);

  const chart = glChart({
    marks: [
      // PCI is standardised on the world's products, so zero is the median
      // traded product — a reference the reader brought, hence chrome.
      glRuleY([0], { y: (d: number) => d }),
      glLink(rows, { x1: 'sector', x2: 'sector', y1: 'low', y2: 'high' }),
      // `glTickY`, not `glTickX`. A tick's name is its AXIS, not its direction:
      // `tickX` draws a vertical stroke, which on a vertical whisker is
      // collinear with it — it lengthens the interval by 4px at each end
      // instead of capping it. The cap has to cross the whisker, so it is the
      // horizontal one.
      glTickY(rows, { x: 'sector', y: 'low' }),
      glTickY(rows, { x: 'sector', y: 'high' }),
      glPoint(rows, { x: 'sector', y: 'estimate' }),
    ],
    x: glAxisBand({ domain: rows.map((d) => d.sector) }),
    y: glAxisY({ label: 'Product complexity (PCI)' }),
  });

  return (
    <GLFigure
      title="Vietnam's most complex sectors are also its most uniform."
      subtitle={`Median product complexity and the interquartile range of the ${exported.length} four-digit products Vietnam exported in ${LATEST_YEAR}`}
      source={withNote(
        BASKET,
        'Quantiles derived from product rows; the Atlas publishes basket-wide thresholds, not per-sector ones',
      )}
    >
      <Chart
        {...chart.props}
        height={260}
        ariaLabel="Product complexity by sector with interquartile ranges"
      />
    </GLFigure>
  );
}
// #endregion

// #region demo:spec-05-candlestick
/**
 * Open, high, low and close — at the only period the Atlas can supply all four
 * for.
 *
 * A candlestick body is open-to-close and its wick is the extreme reached in
 * between, and none of those exist at annual grain: one country-year is a single
 * number. Rather than synthesise a within-year range, the period is widened
 * until the data can fill the form honestly. One candle is one economy over the
 * whole panel — open is its share of world exports in 1995, close its share in
 * 2023, and the wick runs to the highest and lowest year it passed through.
 * Every one of the four is an observed Atlas value.
 *
 * §3.6 does the rest: colour encodes sign, so the body follows it whether or not
 * it is the one the reader is looking at. `signColor()` is a chart-level scale,
 * so `glTile` leaves `fill` unset and lets the scale paint — setting a fill
 * would bypass the scale for every datum, which is what `paint()` in `marks.ts`
 * exists to prevent.
 *
 * **Both ends of the share are classified exports.** The numerator sums the nine
 * sectors of `country-sector-year` rather than taking `country_year.exportValue`,
 * because the sector tables exclude the Atlas's "Other" bucket and the country
 * panel does not. Mixing them would divide an all-in numerator by an
 * Other-excluded denominator and overstate every share — quietly, and by more in
 * the early years.
 *
 * The body's width is the band scale's, not a hand-set half-width: the specimen
 * positions its candles at `day ± 0.32` on a linear axis, and a band axis makes
 * the same shape out of `geometry.bandPadding` instead of a literal.
 */
function WorldTradeShareCandles() {
  const worldTotal = new Map<number, number>();
  for (const r of defined(worldSectorYear, 'exportValueM')) {
    worldTotal.set(r.year, (worldTotal.get(r.year) ?? 0) + r.exportValueM);
  }

  /** One economy's share of classified world exports, ascending by year. */
  const shareSeries = (iso3: string) => {
    const byYear = new Map<number, number>();
    for (const r of defined(
      countrySectorYear.filter((d) => d.iso3 === iso3),
      'exportValueM',
    )) {
      byYear.set(r.year, (byYear.get(r.year) ?? 0) + r.exportValueM);
    }
    return [...byYear]
      .sort((a, b) => a[0] - b[0])
      .flatMap(([year, exports]) => {
        const world = worldTotal.get(year);
        return world ? [{ year, share: (exports / world) * 100 }] : [];
      });
  };

  const candles = COHORT.flatMap((iso3) => {
    const series = shareSeries(iso3);
    if (!series.length) return [];
    const shares = series.map((d) => d.share);
    const high = Math.max(...shares);
    const low = Math.min(...shares);
    return [
      {
        country: countryName(iso3),
        open: shares[0],
        close: shares[shares.length - 1],
        high,
        low,
        highYear: series[shares.indexOf(high)].year,
        lowYear: series[shares.indexOf(low)].year,
      },
    ];
  }).sort((a, b) => b.close - a.close);

  const chart = glChart({
    marks: [
      glLink(candles, { x1: 'country', x2: 'country', y1: 'low', y2: 'high', tone: 'muted' }),
      glTile(candles, {
        x: 'country',
        y1: 'open',
        y2: 'close',
        color: (d) => signKey(d.close - d.open),
      }),
    ],
    x: glAxisBand({ domain: candles.map((d) => d.country) }),
    y: glAxisY({ label: 'Share of world goods exports (%)' }),
    color: signColor(),
  });

  return (
    <GLFigure
      title="Malaysia is the only one of the six holding less of world trade than it did in 1995."
      subtitle={`Share of classified world goods exports: the body runs ${FIRST_YEAR} to ${LATEST_YEAR}, the wick to the highest and lowest year in between`}
      source={withNote(SHARES, 'Both sides of the share exclude the Atlas “Other” sector')}
      legend={
        <GLLegend
          items={[
            { label: `Higher share than in ${FIRST_YEAR}`, tone: 'c-1' },
            { label: `Lower share than in ${FIRST_YEAR}`, tone: 'c-2' },
            { label: 'Range over the period', tone: 'muted', mark: 'line' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={250} ariaLabel="Share of world exports, open to close by economy" />
    </GLFigure>
  );
}
// #endregion

// #region demo:spec-09-percentile-fan
/**
 * Two confidence levels, one hue.
 *
 * §3.9 is explicit that a second level does not earn a second colour: confidence
 * is an ORDERED variable, so it walks the sequential ramp of the series' own hue.
 * `fanTones(2)` returns steps 1 and 2 of `sequential-1` — step 1 being exactly
 * `c-1.light`, the tone a single band would have taken anyway — which leaves the
 * main tone free for the median line to read over both.
 *
 * The percentiles are the Atlas's own. `lead-thresholds` carries p10 through p90
 * of Vietnam's product-level distributions for every year, so this chart and the
 * Atlas cannot disagree about where the tenth percentile is. Re-deriving them
 * from product rows would put a second, subtly different distribution on a page
 * that also cites the first.
 *
 * The variable is *distance*: how far a product sits from what the country
 * already knows how to make, 0 near and 1 far. Read as a fan it answers a
 * question the median alone cannot — whether the whole basket moved toward
 * Vietnam's capabilities or only the middle of it did.
 */
function CapabilityDistanceFan() {
  // A fan row is only drawable if every percentile it needs is present, and
  // `defined` drops one key at a time — so the chain is the honest spelling of
  // "all five". None are actually missing in this release; the chain is what
  // makes that a fact the code checked rather than one the author assumed.
  const rows = defined(
    defined(defined(defined(defined(thresholdsFor('distance'), 'p10'), 'p25'), 'p50'), 'p75'),
    'p90',
  );

  const [outer, inner] = fanTones(2);

  const chart = glChart({
    marks: [
      glBand(rows, { x: 'year', y1: 'p10', y2: 'p90', tone: outer }),
      glBand(rows, { x: 'year', y1: 'p25', y2: 'p75', tone: inner }),
      glLine(rows, { x: 'year', y: 'p50' }),
    ],
    x: yearAxisFor(rows, 'year'),
    y: glAxisY({ label: 'Distance from Vietnam’s capabilities' }),
  });

  return (
    <GLFigure
      title="The whole of Vietnam's basket moved within reach, not just the median product."
      subtitle={`Distribution of product distance — 0 is near the country's existing capabilities, 1 is far — ${FIRST_YEAR}–${LATEST_YEAR}`}
      source={THRESHOLDS}
      legend={
        <GLLegend
          items={[
            { label: 'Median product', tone: 'c-1', mark: 'line' },
            { label: 'Middle 50% of products', tone: inner, mark: 'band' },
            { label: 'Middle 80% of products', tone: outer, mark: 'band' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={240} ariaLabel="Percentile fan of product distance" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-13-interval-timeline
/**
 * A candlestick without its wicks — and the same §3.6 rule.
 *
 * The Atlas cannot give a year a high and a low, but it can give it an open and
 * a close, because the close of one year *is* the open of the next. So each
 * interval here runs from the previous year's Economic Complexity Index to this
 * year's, and colour encodes the sign of the change — including for the twenty
 * or so years the reader is not looking at, which is the whole point of the rule.
 * The tick marks the close, so the sequence reads as a series and not as a row
 * of unrelated bars.
 *
 * Two details real data supplied that the synthetic specimen could not. Zero on
 * this axis is the world's average product complexity, so the reference rule is
 * a genuine threshold rather than a decoration: Vietnam crosses it in 2006, falls
 * back under in 2007, and crosses again in 2008. And 2018 is exactly flat —
 * identical to 2017 to three decimals — so its interval has zero length and only
 * the close tick marks the year. §3.6 puts a zero change on the positive side of
 * the scale rather than inventing a third colour for it, which is why that year
 * is not grey.
 */
function ComplexityYearIntervals() {
  const series = defined(seriesFor(LEAD), 'eci');
  const years = series.slice(1).map((d, i) => ({
    year: d.year,
    open: series[i].eci,
    close: d.eci,
  }));

  const chart = glChart({
    marks: [
      glRuleY([0], { y: (d: number) => d }),
      glLink(years, {
        x1: 'year',
        x2: 'year',
        y1: 'open',
        y2: 'close',
        color: (d) => signKey(d.close - d.open),
      }),
      // Horizontal, so it crosses the vertical open-to-close rule and reads as
      // a close marker rather than as 4px more of the interval. See the
      // error-bar demo above for why `glTickX` is the wrong one here.
      glTickY(years, { x: 'year', y: 'close', tone: 'muted' }),
    ],
    x: yearAxisFor(years, 'year'),
    y: glAxisY({ label: 'Economic Complexity Index' }),
    color: signColor({ step: 'main' }),
  });

  return (
    <GLFigure
      title="Vietnam's complexity has gone backwards in five years out of twenty-eight, and never twice running."
      subtitle={`Change in the Economic Complexity Index within each year: the interval runs from the previous year's value to that year's, ${FIRST_YEAR + 1}–${LATEST_YEAR}; the tick marks the close`}
      source={PANEL}
      legend={
        <GLLegend
          items={[
            { label: 'Rose over the year', tone: 'c-1', mark: 'line' },
            { label: 'Fell over the year', tone: 'c-2', mark: 'line' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={240} ariaLabel="Year-on-year complexity intervals for Vietnam" />
    </GLFigure>
  );
}
// #endregion

// ════════════════════════════════════════════════════════════════════════════

const demos: Demo[] = [
  {
    id: 'spec-04-errorbar',
    family: 'Intervals and Financial',
    name: 'Point estimates with error bars',
    question: 'Which of Vietnam’s export sectors hold its complex products, and how tightly?',
    rule: '§3.4.2 — a data tick is 8px, twice the axis tick, so it cannot be read as chrome.',
    render: SectorComplexitySpread,
    gaps: [
      'The Atlas publishes no standard errors — not for PCI, ECI, COI or the growth projection — so there is no confidence interval anywhere in this dataset to draw. The bar here is the interquartile range of the products in the sector: dispersion, not inference. The form is fully exercised; its usual SEMANTICS are not, and no amount of chart library would fix that.',
      'Atlas sector names run to 42 characters ("Textiles, garments, footwear and furniture") and nine of them will not fit across a band axis. gl-charts has no axis-text wrap, rotation, truncation or dodge, and glAxisBand offers no way to ask for one, so the tick labels overlap. The honest fix is the horizontal orientation (glLink + glTickY on a y band axis), which is a different specimen; the fix this specimen needs is an axis-text policy in grammar.md and a `wrap` option on the band preset.',
      'Quantiles are derived in the demo rather than read from the Atlas. lead-thresholds carries p10–p90 only for the basket as a whole, by year — there is no per-sector threshold table — so this is the one chart on the page whose percentiles the Atlas did not compute. It is disclosed on the source line.',
    ],
  },
  {
    id: 'spec-05-candlestick',
    family: 'Intervals and Financial',
    name: 'Candlestick — open, high, low, close',
    question: 'Which of these six economies actually gained share of world trade?',
    rule: '§3.6 — colour encodes sign, so every body follows it.',
    render: WorldTradeShareCandles,
    gaps: [
      'The Atlas has no sub-annual grain at all, so there is no trading day with an open, a high, a low and a close. Rather than synthesise one, the candle\'s PERIOD is widened to the whole 1995–2023 panel: open is the first year, close the last, and the wick the highest and lowest year passed through. All four values are observed. What is not exercised is the form\'s cadence — twenty-two candles in a row reading left to right as a time series — because the Atlas can only fill four fields per candle if the candle is decades long.',
      'A candle body is x1/x2 on a linear axis in the specimen, positioned with a hand-set ±0.32 half-width. Here it is a band-scale tile, so the width comes from geometry.bandPadding — better, but it means the two plates are not drawing the same construction, and gl-charts has no candle mark that would make them.',
      'The wick is glLink at the connector\'s default 2px, which on a band-width body reads thin. The specimen had the same proportions only because its bodies were narrower; there is no token relating a wick\'s weight to its body\'s width, and the alternative — passing strokeWidth by hand — is what this page forbids.',
    ],
  },
  {
    id: 'spec-09-percentile-fan',
    family: 'Intervals and Financial',
    name: 'Nested percentile fan',
    question:
      'Did Vietnam’s whole product basket move closer to its capabilities, or only its median product?',
    rule: '§3.9 — confidence level is ORDERED, so it walks the sequential ramp of one hue.',
    render: CapabilityDistanceFan,
    gaps: [
      'GLLegend paints an entry\'s label text in resolveTone(item.tone).dark, and a fanTones level is a flat triple — light, main and dark are all the same ramp step — so a fan\'s legend labels render in the band\'s own pale fill and fail contrast against paper. The band swatch loses its border for the same reason (its stroke is tone.dark too). Naming the levels with c-1 + step instead would be legible and would also be a lie about the inner band, which sits between light and main and has no token. fanTones should return a triple whose dark step is readable, or GLLegend should take the label ink separately.',
      'The Atlas percentiles are of the product distribution, not of a forecast, so the fan does not WIDEN with time — the case the synthetic specimen was built to show. Here it narrows, which is the finding, but a reader who knows the form from forecasting may read the narrowing as growing certainty rather than as a converging basket. That is a labelling problem the library cannot solve and the subtitle has to.',
    ],
  },
  {
    id: 'ts-13-interval-timeline',
    family: 'Intervals and Financial',
    name: 'Open-to-close intervals',
    question: 'How often has Vietnam’s complexity gone backwards?',
    rule: '§3.6 — colour encodes sign, so every interval follows it.',
    render: ComplexityYearIntervals,
    gaps: [
      'The catalog specimen sets strokeWidth: 9 on the link so each interval reads as a BAR rather than a hairline; this page forbids a hand-set stroke width, so the intervals here render at the connector\'s 2px and the chart reads as a rug rather than as a column of intervals. That is the gap, not an oversight: gl-charts has no interval mark and no token for the width of a sign-coloured span, so there is no on-spec way to ask for the specimen\'s appearance. Either glLink needs a width token, or the interval belongs in marks.ts as its own kind.',
      'One interval — 2018 — has zero length, because Vietnam\'s ECI was identical in 2017 and 2018. TanStack draws nothing for a zero-length link, so the year is carried entirely by its close tick. A specimen built on synthetic data never produces an exactly-flat period; a real annual panel does, and no mark in the library is defined for it.',
    ],
  },
];

export const intervalsFamily: Family = {
  slug: 'intervals-and-financial',
  title: 'Intervals and Financial',
  blurb:
    'Forms that draw a range instead of a point. The Atlas is annual, so the charts built for daily market data are reframed until every value on screen is one the Atlas actually measured.',
  demos,
};

export function renderIntervals(): Record<string, () => ReactNode> {
  return Object.fromEntries(demos.map((d) => [d.id, d.render]));
}
