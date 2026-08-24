/**
 * The specimens — one worked plate per chart type the spec PDF never drew.
 *
 * `catalog.tsx` reproduces the eleven figures in the PDF and is diffed against
 * them. These have no figure to diff against: they exist because `grammar.md`
 * §3.4.2, §3.8, §3.9 and §3.10 now rule on marks the PDF never used, and a rule
 * with no rendered, audited example is a rule nobody can check.
 *
 * **The contract, which is the whole point: nothing may be styled by hand.** No
 * hex, no font size, no stroke width, no opacity appears below. Every value on
 * screen comes from `tokens.json` by way of a `gl*` mark or a shape function.
 * A specimen that reached for a style attribute would prove the opposite of what
 * it is here to prove, so anything the library cannot express is recorded in
 * `gaps` in `specimens-meta.mjs` instead.
 *
 * The one thing these DO author is layout arithmetic — a Marimekko's column
 * boundaries, a dodge offset. That is data preparation, not styling: it decides
 * *where* a mark goes, never what it looks like. Where the preparation is
 * general enough to be reusable it lives in the library (`waterfall`,
 * `binValues`, `arcAngles`, `glHexbinLattice`) and is imported here rather than
 * repeated — the hexbin below used to roll its own lattice, and rolling it was
 * how it came to disagree with the mark that drew it.
 */

import type { ReactNode } from 'react';
import { Chart } from '@tanstack/react-charts';
import { stack } from '@tanstack/charts';
import { scaleLinear } from '@tanstack/charts-scales/linear';

import {
  LABEL_GAP,
  binValues,
  ecdf,
  endLabels,
  fanTones,
  geometry,
  glAnnotation,
  glArrow,
  glAxisBand,
  glAxisBin,
  glAxisPercent,
  glAxisX,
  glAxisY,
  glBand,
  glBar,
  glBarX,
  glBinBar,
  glCell,
  glChart,
  glHexbin,
  glHexbinLattice,
  glLabel,
  glLine,
  glLink,
  glMutedBarX,
  glPoint,
  glRuleY,
  glSequentialColor,
  glStemX,
  glTickY,
  glTile,
  glVector,
  linearFit,
  movingAverage,
  popUp,
  signColor,
  signKey,
  stepPoints,
  stackOrder,
  timeAxisFor,
  toEpoch,
  toneRamp,
  waterfall,
} from '../src/index.js';
import {
  arcAngles,
  glAngleGrid,
  glDonutChart,
  glPolarChart,
  glRadialAnnotation,
  glRadialArc,
  glRadialDot,
  glRadialGrid,
  glRadialLine,
} from '../src/shapes.js';
import { GLFigure, GLLegend } from '../src/figure.js';

import { SPECIMENS } from './specimens-meta.mjs';
import { CARTESIAN_RENDERERS } from './specimens-cartesian.js';
import { DISTRIBUTION_RENDERERS } from './specimens-distribution.js';
import { GEO_RENDERERS } from './specimens-geo.js';
import { INTERACTION_RENDERERS } from './specimens-interaction.js';
import { NETWORK_RENDERERS } from './specimens-network.js';
import { RADIAL_RENDERERS } from './specimens-radial.js';
import {
  COMPOSITION_ORDER,
  MATRIX_SECTORS,
  MEKKO_SEGMENTS,
  bridgeData,
  candleData,
  cloudData,
  compositionData,
  cyclicData,
  dailyData,
  donutData,
  donutTotal,
  estimateData,
  fitData,
  forecastData,
  gapData,
  gaugeValue,
  incomeSample,
  matrixData,
  mekkoData,
  moveData,
  observationData,
  rankData,
  roseData,
  vectorData,
} from './specimen-data.js';

export const SPECIMEN_WIDTH = 596;

export interface GallerySpecimen {
  id: string;
  kind: string;
  family: string;
  rule: string;
  built: string;
  status: string;
  gaps: string[];
  render?: () => ReactNode;
}

const SYNTHETIC = 'Source: Synthetic data for illustration. Not a Growth Lab estimate.';

// ════════════════════════════════════════════════════════════════════════════
// §3.4.2 — the chrome / data split
// ════════════════════════════════════════════════════════════════════════════

/**
 * A lollipop is a bar chart that spends less ink on the same value. The stem is
 * DATA — it encodes the magnitude — so it takes the series tone at line weight,
 * and `glStemX` is built on `link` rather than `ruleX` because TanStack rules
 * ignore their endpoint channels and span the whole plot.
 */
function Lollipop() {
  const { backdrop, focus } = popUp(rankData, { by: 'country', highlight: ['Mongolia'] });
  const chart = glChart({
    marks: [
      glStemX(backdrop, { x: 'country', y: 'share', tone: 'muted' }),
      glPoint(backdrop, { x: 'country', y: 'share', tone: 'muted' }),
      ...focus.flatMap((s) => [
        glStemX(s.rows, { x: 'country', y: 'share', tone: s.tone }),
        glPoint(s.rows, { x: 'country', y: 'share', tone: s.tone }),
      ]),
    ],
    // Pinned, because `popUp` emits the backdrop before the focus series and a
    // band scale takes its domain from the order it meets each category — which
    // would put the highlighted bar last on a chart whose whole point is rank.
    x: glAxisBand({ domain: rankData.map((d) => d.country) }),
    y: glAxisY({ label: 'Share of goods exports (%)' }),
  });

  return (
    <GLFigure
      title="Mongolia's export basket is the most mineral-concentrated of the six."
      subtitle="Minerals as a share of goods exports, 2024"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={240} ariaLabel="Mineral concentration by country" />
    </GLFigure>
  );
}

/**
 * The dumbbell's connector is the finding — the *distance* is what the reader
 * measures — but it is still a stroke on an assembled glyph rather than a series
 * line, so §3.3 gives it the dark tone. Two entities move backwards, which is
 * why the endpoints need different tones rather than an arrowhead.
 */
function Dumbbell() {
  const chart = glChart({
    marks: [
      glLink(gapData, { x1: 'then', x2: 'now', y1: 'country', y2: 'country', tone: 'muted' }),
      glPoint(gapData, { x: 'then', y: 'country', tone: 'muted' }),
      glPoint(gapData, { x: 'now', y: 'country', tone: 'c-1' }),
    ],
    x: glAxisY({ label: 'Complexity percentile' }),
    y: glAxisBand({ domain: [...gapData].sort((a, b) => b.now - b.then - (a.now - a.then)).map((d) => d.country) }),
    margin: { left: 96 },
  });

  return (
    <GLFigure
      title="Two of the five gave back a decade of complexity gains."
      subtitle="Economic complexity percentile, 2014 (grey) versus 2024 (blue)"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={220} ariaLabel="Complexity change by country" />
    </GLFigure>
  );
}

/**
 * The specimen for §3.4.2. Two horizontal lines, one dashed `ink-3` and one
 * solid `c-1`, and the reader can tell instantly which one is a measurement.
 * `glRuleY` deliberately **ignores `tone`** — passing `c-2` here changes nothing,
 * which is the rule made unbreakable rather than merely documented.
 */
function Threshold() {
  const target = 130;
  const chart = glChart({
    marks: [
      glRuleY([target], { y: (d: number) => d }),
      glLine(forecastData, { x: 'year', y: 'value' }),
      glAnnotation([{ year: forecastData[2].year, y: target }], {
        x: 'year',
        y: 'y',
        text: () => 'Target',
        anchor: 'start',
        dy: -8,
      }),
    ],
    x: glAxisX({ nice: false }),
    y: glAxisY({ label: 'Index (2000 = 100)' }),
    variant: { labelHalo: true },
  });

  return (
    <GLFigure
      title="Output passed the 2030 target six years early."
      subtitle="Manufacturing output index, 2000–2024, against the published target"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={230} ariaLabel="Output against target" />
    </GLFigure>
  );
}

/**
 * An error bar is three marks: a connector for the interval, two data ticks for
 * the ends, and the estimate itself. The ticks are 8px — twice the axis tick —
 * so the reader never reads them as chrome.
 */
function ErrorBars() {
  const chart = glChart({
    marks: [
      glRuleY([0], { y: (d: number) => d }),
      glLink(estimateData, { x1: 'sector', x2: 'sector', y1: 'low', y2: 'high' }),
      glTickY(estimateData, { x: 'sector', y: 'low' }),
      glTickY(estimateData, { x: 'sector', y: 'high' }),
      glPoint(estimateData, { x: 'sector', y: 'estimate' }),
    ],
    x: glAxisBand(),
    y: glAxisY({ label: 'Employment elasticity' }),
  });

  return (
    <GLFigure
      title="Only electronics has an elasticity distinguishable from the rest."
      subtitle="Estimated employment elasticity with 95% confidence intervals"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={240} ariaLabel="Employment elasticity by sector" />
    </GLFigure>
  );
}

/**
 * The wick is a connector, the body a tile, and the sign encoding of §3.6 runs
 * through both — a day that closed down is red whether or not it is the day the
 * reader is looking at. `signColor()` is a chart-level scale, so the bodies get
 * their paint from the scale and the mark leaves `fill` unset.
 */
function Candlestick() {
  const HALF = 0.32;
  const chart = glChart({
    marks: [
      glLink(candleData, { x1: 'day', x2: 'day', y1: 'low', y2: 'high', tone: 'muted' }),
      glTile(candleData, {
        x1: (d) => d.day - HALF,
        x2: (d) => d.day + HALF,
        y1: 'open',
        y2: 'close',
        color: (d) => signKey(d.close - d.open),
      }),
    ],
    x: glAxisX({ label: 'Trading day', nice: false }),
    y: glAxisY({ label: 'Close (index)' }),
    color: signColor(),
  });

  return (
    <GLFigure
      title="The rally stalled in the third week."
      subtitle="Daily open–close range, 22 trading days"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={240} ariaLabel="Daily price range" />
    </GLFigure>
  );
}

/**
 * The arrowhead is the only thing distinguishing a rise from a fall here, which
 * is exactly why §3.4.2 pins its length in pixels: a head that scaled with the
 * magnitude would encode the value twice, and the reader would have to guess
 * which encoding to trust.
 *
 * And it is why the LABEL has to know the direction too (§3.12). Anchoring every
 * country's name at `start` put Venezuela's — the one arrow that runs
 * right-to-left — back across its own head and shaft, which is the reading the
 * whole plate is about. A label on a mark that points goes at the pointing end
 * and continues in that direction, so the side is `x2 > x1 ? 'right' : 'left'`
 * and the anchor follows it.
 *
 * The clearance is measured from the HEAD, not from `x2`: `arrowHeadLength` is
 * the mark's real rendered edge here, exactly as a bubble's radius is on a
 * scatter.
 */
function ChangeArrows() {
  const pointsRight = (d: (typeof moveData)[number]) => d.x2 > d.x1;
  const headClearance = geometry.arrowHeadLength + LABEL_GAP;

  const chart = glChart({
    marks: [
      glArrow(moveData, { x1: 'x1', y1: 'y1', x2: 'x2', y2: 'y2' }),
      glLabel(moveData, {
        x: 'x2',
        y: 'y2',
        text: (d) => d.country,
        anchor: (d) => (pointsRight(d) ? 'start' : 'end'),
        dx: (d) => (pointsRight(d) ? headClearance : -headClearance),
      }),
    ],
    // Room on the LEFT, explicitly. `endLabels: true` widens the right margin
    // for a label at a line's end, and that is the only end it knows about — on
    // a chart where an arrow can point either way, the leftward label needs the
    // same allowance and there is no flag for it. Niced to the data the domain
    // starts at 1.0, Venezuela's head sits at 1.1, and "Venezuela" then reads
    // straight out through the Y axis. This is §3.12's constraint winning over
    // its preference: the direction rule still picks the side, but a label
    // outside the frame has been placed wrongly whatever rule sent it there.
    x: glAxisX({ label: 'Log GDP per capita (z)', domain: [0.7, 3.5], nice: false }),
    y: glAxisY({ label: 'Economic complexity index' }),
    variant: { labelHalo: true },
    endLabels: true,
  });

  return (
    <GLFigure
      title="Venezuela moved backwards on both dimensions at once."
      subtitle="Change in income and complexity, 2014 → 2024"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={250} ariaLabel="Income and complexity change" />
    </GLFigure>
  );
}

/**
 * Sixty-three marks on a 9×7 lattice. This is the specimen that justifies the
 * vector kind taking chrome WEIGHT with a data TONE — at the 2px an arrow uses,
 * a field this dense merges into a solid mass.
 */
function VectorField() {
  const chart = glChart({
    marks: [
      glVector(vectorData, {
        x: 'lon',
        y: 'lat',
        length: (d) => d.speed * 1.6,
        rotate: 'bearing',
        anchor: 'start',
      }),
    ],
    x: glAxisX({ label: 'Longitude', domain: [-5.4, 5.4] }),
    y: glAxisY({ label: 'Latitude', domain: [-4.4, 4.4] }),
  });

  return (
    <GLFigure
      title="Surface winds rotate about a low centred on the origin."
      subtitle="Direction and speed derived from u/v components; arrow length scales with speed"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={260} ariaLabel="Surface wind vector field" />
    </GLFigure>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// §3.9 — intervals and uncertainty
// ════════════════════════════════════════════════════════════════════════════

/**
 * The band is `c-1-light` at FULL opacity, not a translucent `c-1`. Two things
 * follow that a translucent fill would lose: the band is the same colour
 * everywhere regardless of what it crosses, and it survives greyscale, because a
 * lightness step does and an alpha does not.
 *
 * Listed before the line, because marks paint in array order.
 */
function Band() {
  const chart = glChart({
    marks: [
      glBand(forecastData, { x: 'year', y1: 'lo50', y2: 'hi50' }),
      glLine(forecastData, { x: 'year', y: 'value' }),
    ],
    x: glAxisX({ nice: false }),
    y: glAxisY({ label: 'Index (2000 = 100)' }),
  });

  return (
    <GLFigure
      title="The confidence interval widens faster than the trend rises."
      subtitle="Output index with a 50% interval, 2000–2024"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={230} ariaLabel="Output index with confidence interval" />
    </GLFigure>
  );
}

/**
 * Two confidence levels, ONE hue. §3.9 is explicit that a second level does not
 * earn a second colour: the same light tone drawn twice lets the overlap do the
 * darkening, so the inner band reads as more-certain without the reader having
 * to learn a second colour's meaning.
 */
function PercentileFan() {
  const [outer, inner] = fanTones(2);
  const chart = glChart({
    marks: [
      glBand(forecastData, { x: 'year', y1: 'lo90', y2: 'hi90', tone: outer }),
      glBand(forecastData, { x: 'year', y1: 'lo50', y2: 'hi50', tone: inner }),
      glLine(forecastData, { x: 'year', y: 'value' }),
    ],
    x: glAxisX({ nice: false }),
    y: glAxisY({ label: 'Index (2000 = 100)' }),
  });

  return (
    <GLFigure
      title="Half the probability mass sits inside a band that doubles by 2024."
      subtitle="Output index with 50% and 90% intervals, 2000–2024"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={230} ariaLabel="Output index with nested intervals" />
    </GLFigure>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// §3.10 — derived series
// ════════════════════════════════════════════════════════════════════════════

/**
 * The moving average keeps `c-1` — its parent's hue — and separates by dash. A
 * second hue would claim a second subject, and a reader would reasonably ask
 * what the red series *is*.
 *
 * Also the date-axis specimen's twin: 430 daily observations, so the axis has to
 * pick `Mon YYYY` rather than repeat a year on every tick.
 */
function MovingAverage() {
  const rows = dailyData.map((d) => ({ t: toEpoch(d.date), value: d.value }));
  const trend = movingAverage(rows, { x: 't', y: 'value', window: 30 });

  const chart = glChart({
    marks: [
      glLine(rows, { x: 't', y: 'value', tone: 'muted' }),
      glLine(trend, { x: 't', y: 'value', tone: 'c-1', focus: true }),
    ],
    x: timeAxisFor(rows, 't'),
    y: glAxisY({ label: 'Weekly shipments (index)' }),
  });

  return (
    <GLFigure
      title="The 30-day trend rose through the noise from mid-2022."
      subtitle="Daily shipment index with a 30-day trailing mean, Mar 2022 – May 2023"
      source={SYNTHETIC}
      // Rules, not squares. Both series are lines, and the thing that separates
      // them on the plot is weight as much as tone: the daily series is muted
      // context at 2px and the trend is the finding at 2.4px. Two 10px squares
      // threw the weight away and told the reader the series were areas.
      legend={
        <GLLegend
          items={[
            { label: 'Daily', tone: 'muted', mark: 'line' },
            { label: '30-day mean', tone: 'c-1', mark: 'line', focus: true },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={230} ariaLabel="Daily shipments and trend" />
    </GLFigure>
  );
}

/**
 * The fit is the estimate the chart is about, so §3.10 makes it data rather than
 * chrome — `glLine` in the series hue, not a dashed `ink-3` rule. `linearFit`
 * hands back the two endpoints already computed; drawing it is one mark.
 */
function Regression() {
  const fit = linearFit(fitData, { x: 'x', y: 'y' });
  const chart = glChart({
    marks: [
      glMutedPointCloud(),
      ...(fit ? [glLine(fit.endpoints, { x: 'x', y: 'y', tone: 'c-1', focus: true })] : []),
    ],
    x: glAxisX({ label: 'Log GDP per capita', domain: [5.7, 11.5] }),
    y: glAxisY({ label: 'Economic complexity index' }),
  });

  return (
    <GLFigure
      title={`Complexity rises with income, but income explains only ${Math.round(
        (fit?.r2 ?? 0) * 100,
      )}% of it.`}
      subtitle="90 economies, ordinary least squares"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={250} ariaLabel="Complexity against income with fit" />
    </GLFigure>
  );
}

/** The observations behind the fit — muted, because the line carries the finding. */
function glMutedPointCloud() {
  return glPoint(fitData, { x: 'x', y: 'y', tone: 'muted' });
}

// ════════════════════════════════════════════════════════════════════════════
// Binned marks — a cell is a tile, not a point
// ════════════════════════════════════════════════════════════════════════════

/**
 * The specimen for `glAxisBin`. GLBin count comes from Freedman–Diaconis, which is
 * robust to the long right tail this sample has; Sturges would under-bin it
 * badly.
 *
 * Drawn on `glAxisBin`, so the bands abut. On `glAxisBand` they would carry the
 * 0.28 bar gap and the reader would see six categories where the analyst
 * measured one distribution.
 *
 * `glBinBar`, not `glBar`: the band spans the full bin either way, and the mark
 * adds the 1px paper channel of §3.4.3 on top of it. Without the channel, 22
 * bins of one hue read as a single blue mass.
 */
function Histogram() {
  const bins = binValues(incomeSample);
  const rows = bins.map((b) => ({
    bin: String(Math.round(b.x1)),
    count: b.count,
  }));

  // Every fourth bin edge, PICKED BY INDEX and passed as `values`.
  //
  // Not a divisibility test on the edge. Freedman–Diaconis puts the edges at
  // 695, 1383, 2071 … — arbitrary reals, none of them round — so `v % 4000 === 0`
  // matches nothing and every label comes out empty. And blanking a label in
  // `format` leaves its TICK behind, so the axis ends up a comb of 22 unlabelled
  // teeth at bin centres, half a bar off from every boundary. `values` drops the
  // tick and the label together.
  const ticks = rows.filter((_, i) => i % 4 === 0).map((r) => r.bin);

  const chart = glChart({
    marks: [glBinBar(rows, { x: 'bin', y: 'count' })],
    x: glAxisBin({
      label: 'GDP per capita',
      values: ticks,
      // The real edge, rounded to hundreds. A round 4k/8k/12k axis would read
      // better and would be a lie: no bin starts there.
      format: (v) => `${(Number(v) / 1000).toFixed(1)}k`,
    }),
    y: glAxisY({ label: 'Economies' }),
  });

  return (
    <GLFigure
      title="Income per capita is right-skewed: the mean sits above the mode."
      subtitle={`GDP per capita, ${incomeSample.length} economies, ${bins.length} equal-width bins`}
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={230} ariaLabel="Income distribution" />
    </GLFigure>
  );
}

/**
 * A matrix heatmap: `glCell` on `glAxisBin` for BOTH axes. The cell routes
 * through the `tile` defaults, so it renders at full opacity — the scatter's 0.8
 * exists for overlapping marks and a cell grid cannot overlap.
 */
function Heatmap() {
  const values = matrixData.map((d) => d.value);
  const chart = glChart({
    marks: [glCell(matrixData, { x: 'year', y: 'sector', color: 'value' })],
    x: glAxisBin(),
    y: glAxisBin(),
    color: {
      scale: glSequentialColor({
        domain: [Math.min(...values), Math.max(...values)],
        steps: 5,
      }),
    },
    margin: { left: 96 },
  });

  return (
    <GLFigure
      title="Machinery and services carried the growth; minerals flattened after 2019."
      subtitle="Export value by sector and year, index"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={230} ariaLabel="Export value by sector and year" />
    </GLFigure>
  );
}

/**
 * Hexagonal binning, from `glHexbinLattice` into `glHexbin`.
 *
 * The two travel together for a reason. This specimen used to roll its own
 * lattice and hand the centres to a hexagon of a guessed pixel radius, and it
 * drew a field of separated stars: the lattice was laid out flat-topped, the
 * mark drew pointy-topped, and the radius answered to neither. Handing the
 * lattice itself to the mark is what makes that unrepresentable — it reads the
 * pitch off the object it is drawing.
 *
 * The other point the specimen makes is the paint: `glHexbin` routes to `tile`,
 * not to `point`. Reaching for the point defaults here would put 0.8 on marks
 * that tile the plane and cannot overlap, diluting every bin against paper.
 */
function Hexbin() {
  // The 596px plate at 250px tall leaves a plot near 490 × 205 inside the axes.
  const lattice = glHexbinLattice(cloudData, { x: 'x', y: 'y', rows: 9, aspect: 2.4 });

  const chart = glChart({
    marks: [glHexbin(lattice, { color: 'count' })],
    x: glAxisX({ label: 'Log exports' }),
    y: glAxisY({ label: 'Log imports' }),
    color: { scale: glSequentialColor({ domain: [1, lattice.max], steps: 5 }) },
  });

  return (
    <GLFigure
      title="Trade pairs cluster in two distinct regimes, not one."
      subtitle={`${cloudData.length} country pairs aggregated into ${lattice.bins.length} hexagonal bins`}
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={250} ariaLabel="Trade density" />
    </GLFigure>
  );
}

/**
 * An ECDF is a step function and must be drawn as one: the distribution is
 * genuinely flat between observations, so an interpolated line would claim data
 * at values nobody measured.
 */
function Ecdf() {
  const points = stepPoints(ecdf(incomeSample), { x: 'value', y: 'p' });
  const chart = glChart({
    marks: [glLine(points, { x: 'value', y: 'p' })],
    x: glAxisX({ label: 'GDP per capita (USD)', format: (v) => `${Math.round(v / 1000)}k` }),
    y: glAxisPercent({ scale: 'fraction', label: 'Share at or below' }),
  });

  return (
    <GLFigure
      title="Half the sample sits below USD 3,300 per capita."
      subtitle={`Empirical cumulative distribution, ${incomeSample.length} economies`}
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={230} ariaLabel="Cumulative income distribution" />
    </GLFigure>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Composition
// ════════════════════════════════════════════════════════════════════════════

/**
 * The waterfall specimen, and the §3.6 one. `waterfall` computes the staircase;
 * `signColor` paints every bar by its sign **including the total**, which is the
 * part §3.6 singles out: a residual pulled out into grey reads as a third
 * category and breaks the encoding.
 *
 * `zeroBaseline` promotes the zero gridline to axis weight, because here zero is
 * a real baseline the reader measures gains and losses from.
 */
function Waterfall() {
  const steps = waterfall(bridgeData, { key: 'step', value: 'delta', total: 'Net change' });
  const chart = glChart({
    marks: [
      glBar(steps, {
        x: 'key',
        y1: 'y1',
        y2: 'y2',
        color: (d) => signKey(d.delta),
      }),
    ],
    x: glAxisBand(),
    y: glAxisY({ label: 'Contribution (USD bn)' }),
    color: signColor(),
    variant: { stacked: true, zeroBaseline: true },
  });

  return (
    <GLFigure
      title="Machinery and minerals more than offset the textile decline."
      subtitle="Contribution to the change in export value, 2019–2024"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={240} ariaLabel="Export change decomposition" />
    </GLFigure>
  );
}

/**
 * Normalized to 100%, so the axis is pinned to 0–100 rather than niced off the
 * data: "the parts sum to the whole" is the one thing this chart exists to say,
 * and an axis stopping at 97% would contradict it.
 *
 * Three tiers of one ordered variable, so §8c's light → main → dark ramp applies
 * — the lightness itself carries the ordering.
 */
function Normalized() {
  const rows = stackOrder(compositionData, 'tier', COMPOSITION_ORDER);
  const chart = glChart({
    marks: [
      glBar(rows, {
        x: 'year',
        y: 'value',
        z: 'tier',
        color: 'tier',
        layout: stack({ offset: 'normalize' }),
      }),
    ],
    x: glAxisBand(),
    y: glAxisPercent({ scale: 'fraction', label: 'Share of exports' }),
    color: toneRamp({ tones: 'three', order: COMPOSITION_ORDER, tone: 'c-1' }),
    variant: { stacked: true },
  });

  return (
    <GLFigure
      title="High-complexity exports took ten points of share in seven years."
      subtitle="Share of export value by complexity tier, 2017–2024"
      source={SYNTHETIC}
      // Stacked bands, so the legend goes right and vertical, reversed into the
      // stack's own top-to-bottom order (§3.11). `COMPOSITION_ORDER` is the
      // BOTTOM-up order the stack is built in, which is the opposite of the
      // order the reader's eye takes down the column.
      legendPlacement="right"
      legend={
        <GLLegend
          items={COMPOSITION_ORDER.map((tier, i) => ({
            label: tier,
            tone: 'c-1' as const,
            step: (['light', 'main', 'dark'] as const)[i],
          })).reverse()}
        />
      }
    >
      <Chart {...chart.props} height={240} ariaLabel="Export composition by complexity tier" />
    </GLFigure>
  );
}

/**
 * A Marimekko encodes on both axes at once — column width is the market's size,
 * segment height its share — so both axes are binned and every rectangle abuts
 * its neighbours.
 *
 * The column boundaries are computed here. That is data preparation, not
 * styling, but it is general enough to belong in `compose.ts`, which is why the
 * specimen records it as a gap.
 */
function Marimekko() {
  const markets = [...new Set(mekkoData.map((d) => d.market))];
  const total = markets.reduce(
    (sum, m) => sum + (mekkoData.find((d) => d.market === m)?.weight ?? 0),
    0,
  );

  let x = 0;
  const tiles: {
    market: string;
    segment: string;
    x1: number;
    x2: number;
    y1: number;
    y2: number;
  }[] = [];
  for (const market of markets) {
    const weight = mekkoData.find((d) => d.market === market)!.weight;
    const x1 = x;
    const x2 = x + weight / total;
    x = x2;
    let y = 0;
    for (const segment of MEKKO_SEGMENTS) {
      const share = mekkoData.find((d) => d.market === market && d.segment === segment)!.share;
      tiles.push({ market, segment, x1, x2, y1: y, y2: y + share });
      y += share;
    }
  }

  const chart = glChart({
    marks: [
      glTile(tiles, { x1: 'x1', x2: 'x2', y1: 'y1', y2: 'y2', color: 'segment' }),
      glLabel(
        tiles.filter((t) => t.segment === MEKKO_SEGMENTS[0]),
        {
          x: (d) => (d.x1 + d.x2) / 2,
          y: () => 1,
          text: (d) => d.market,
          anchor: 'middle',
          dy: -8,
          tone: 'c-1',
        },
      ),
    ],
    x: glAxisX({ nice: false, format: (v) => `${Math.round(v * 100)}%` }),
    y: glAxisPercent({ scale: 'fraction', label: 'Share of respondents' }),
    color: toneRamp({ tones: 'three', order: MEKKO_SEGMENTS, tone: 'c-1' }),
    variant: { labelHalo: true },
  });

  return (
    <GLFigure
      title="Agreement is highest in Africa and lowest in the Andes."
      subtitle="Survey response by market; column width is the market's share of respondents"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={250} ariaLabel="Survey responses by market" />
    </GLFigure>
  );
}

/**
 * The horizontal orientation of the ranked pop-up. Long country names read
 * left-to-right instead of rotated 90°, which is the whole argument for `barX` —
 * and the defaults table needs no orientation-specific entry, because fill and
 * opacity do not care which way a bar points.
 */
function RankedBarX() {
  const { backdrop, focus } = popUp(rankData, { by: 'country', highlight: ['Zambia'] });
  const chart = glChart({
    marks: [
      glMutedBarX(backdrop, { y: 'country', x: 'share' }),
      ...focus.map((s) => glBarX(s.rows, { y: 'country', x: 'share', tone: s.tone })),
    ],
    x: glAxisY({ label: 'Share of goods exports (%)' }),
    y: glAxisBand({ domain: rankData.map((d) => d.country) }),
    margin: { left: 104 },
  });

  return (
    <GLFigure
      title="Zambia is third by concentration but first by dependence on one metal."
      subtitle="Minerals as a share of goods exports, 2024"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={230} ariaLabel="Mineral concentration, ranked" />
    </GLFigure>
  );
}

/**
 * The date-axis specimen. 430 daily observations spanning 14 months, so
 * `dateTicks` picks the month unit, labels every tick the same way, and pins
 * both endpoints — the rule `yearTicks` follows, for the same reason.
 */
function DateAxis() {
  const rows = dailyData.map((d) => ({ t: toEpoch(d.date), value: d.value }));
  const series = [{ key: 'Shipments', rows, tone: 'c-1' as const }];
  const chart = glChart({
    marks: [
      glLine(rows, { x: 't', y: 'value', focus: true }),
      ...endLabels(series, { x: 't', y: 'value' }),
    ],
    x: timeAxisFor(rows, 't'),
    y: glAxisY({ label: 'Shipments (index)' }),
    endLabels: true,
  });

  return (
    <GLFigure
      title="Shipments recovered to their pre-disruption level by April 2023."
      subtitle="Daily shipment index, 14 March 2022 – 17 May 2023"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={230} ariaLabel="Daily shipment index" />
    </GLFigure>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// §3.8 — radial
// ════════════════════════════════════════════════════════════════════════════

/**
 * Exactly four slices — the §3.8 cap — so the specimen sits on the boundary
 * rather than safely inside it. A fifth would warn.
 *
 * Every label is in its own slice's DARK tone, which is why `arcAngles` carries
 * a tone per slice rather than letting a chart-level colour scale assign them: a
 * text mark cannot read a colour scale.
 */
function Donut() {
  const chart = glDonutChart(donutData, {
    key: (d) => d.part,
    value: (d) => d.value,
    centerValue: `USD ${(donutTotal / 1000).toFixed(1)}B`,
    centerLabel: 'Total exports',
  });

  return (
    <GLFigure
      title="Minerals are just under half the export basket."
      subtitle="Export value by broad sector, 2024"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={300} ariaLabel="Export composition" />
    </GLFigure>
  );
}

/**
 * A gauge is `arcAngles` over a PARTIAL turn — the reason that function takes
 * `startAngle` and `endAngle` rather than assuming a full circle. The track is a
 * muted arc, the value a `c-1` arc drawn over the same range.
 */
function Gauge() {
  const START = -Math.PI * 0.6;
  const END = Math.PI * 0.6;

  const [track] = arcAngles([{ k: 'track', v: 1 }], {
    key: (d) => d.k,
    value: (d) => d.v,
    startAngle: START,
    endAngle: END,
    tones: ['muted'],
  });
  const [value] = arcAngles([{ k: 'value', v: 1 }], {
    key: (d) => d.k,
    value: (d) => d.v,
    startAngle: START,
    endAngle: START + (END - START) * gaugeValue,
  });

  const arc = (slice: typeof track, tone: 'muted' | 'c-1') =>
    glRadialArc([slice], {
      startAngle: () => slice.startAngle,
      endAngle: () => slice.endAngle,
      tone,
      innerRadius: (ctx) => ctx.radius * 0.62,
      outerRadius: (ctx) => ctx.radius * 0.92,
    });

  const chart = glPolarChart({
    marks: [
      arc(track, 'muted'),
      arc(value, 'c-1'),
      glRadialAnnotation([{ label: `${Math.round(gaugeValue * 100)}%` }], {
        angle: () => 0,
        radius: () => 0,
        text: (d: { label: string }) => d.label,
        anchor: 'middle',
        baseline: 'middle',
      } as never),
    ],
    angle: { scale: scaleLinear().domain([0, Math.PI * 2]) as never, wrap: false },
    radius: { scale: scaleLinear().domain([0, 1]) as never },
  });

  return (
    <GLFigure
      title="Sixty-eight per cent of firms report a binding credit constraint."
      subtitle="Share of surveyed firms, 2024"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={220} ariaLabel="Firms reporting credit constraints" />
    </GLFigure>
  );
}

/**
 * The case a Cartesian axis cannot draw. The peak straddles midnight, and only a
 * polar layout puts hour 23 next to hour 0 — on a linear axis the peak is cut in
 * half and thrown to opposite ends of the plot.
 */
function PolarLine() {
  const closed = [...cyclicData, { ...cyclicData[0], hour: 24 }];
  const chart = glPolarChart({
    marks: [glRadialLine(closed, { angle: 'hour', radius: 'value', focus: true })],
    guides: [
      glRadialGrid({ ticks: 4 }),
      glAngleGrid({ values: [0, 3, 6, 9, 12, 15, 18, 21], format: (v) => `${v}:00` }),
    ],
    angle: { scale: scaleLinear().domain([0, 24]) as never, wrap: false },
    radius: { scale: scaleLinear().domain([0, 32]) as never },
  });

  return (
    <GLFigure
      title="Demand peaks just after midnight, which no linear axis can show."
      subtitle="Mean load by hour of day, MW"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={280} ariaLabel="Load by hour of day" />
    </GLFigure>
  );
}

/**
 * Equal angles, variable radii. A rose is a bar chart on a cyclic domain, and
 * the arcs take the same full-opacity fill a bar does — bending a mark round a
 * centre does not change what it is.
 */
function Rose() {
  const petals = arcAngles(roseData, {
    key: (d) => d.bearing,
    value: () => 1,
    sort: false,
    tones: roseData.map(() => 'c-1' as const),
  });
  const maxFreq = Math.max(...roseData.map((d) => d.frequency));

  const chart = glPolarChart({
    marks: [
      ...petals.map((slice, i) =>
        glRadialArc([slice], {
          startAngle: () => slice.startAngle,
          endAngle: () => slice.endAngle,
          padAngle: () => 1,
          padRadius: 1,
          tone: 'c-1',
          innerRadius: 0,
          outerRadius: (ctx) => ctx.radius * (roseData[i].frequency / maxFreq),
        }),
      ),
    ],
    guides: [
      glAngleGrid({
        values: roseData.map((_, i) => i),
        format: (v) => roseData[Number(v)]?.bearing ?? '',
      }),
    ],
    angle: { scale: scaleLinear().domain([0, roseData.length]) as never, wrap: false },
    radius: { scale: scaleLinear().domain([0, 1]) as never },
  });

  return (
    <GLFigure
      title="The prevailing wind is south-westerly."
      subtitle="Frequency of observations by compass bearing, %"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={280} ariaLabel="Wind frequency by bearing" />
    </GLFigure>
  );
}

/**
 * A polar scatter, and the specimen showing the radial dot is genuinely a
 * scatter circle: the 0.8 fill-and-stroke rule applies here exactly as it does
 * on a Cartesian plot, because these marks DO overlap and the darkening is the
 * density signal.
 */
function WindRose() {
  const chart = glPolarChart({
    marks: [glRadialDot(observationData, { angle: 'bearing', radius: 'speed' })],
    guides: [
      glRadialGrid({ ticks: 3 }),
      glAngleGrid({
        values: [0, 45, 90, 135, 180, 225, 270, 315],
        format: (v) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Number(v) / 45] ?? '',
      }),
    ],
    angle: { scale: scaleLinear().domain([0, 360]) as never, wrap: false },
    radius: { scale: scaleLinear().domain([0, 18]) as never },
  });

  return (
    <GLFigure
      title="Fast winds come almost exclusively from the south-west."
      subtitle={`${observationData.length} hourly observations; radius is speed in m/s`}
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={280} ariaLabel="Wind speed by bearing" />
    </GLFigure>
  );
}

// ── Catalog ─────────────────────────────────────────────────────────────────

const RENDERERS: Record<string, () => ReactNode> = {
  'spec-01-lollipop': Lollipop,
  'spec-02-dumbbell': Dumbbell,
  'spec-03-threshold': Threshold,
  'spec-04-errorbar': ErrorBars,
  'spec-05-candlestick': Candlestick,
  'spec-06-change-arrows': ChangeArrows,
  'spec-07-vector-field': VectorField,
  'spec-08-band': Band,
  'spec-09-percentile-fan': PercentileFan,
  'spec-10-moving-average': MovingAverage,
  'spec-11-regression': Regression,
  'spec-12-histogram': Histogram,
  'spec-13-heatmap': Heatmap,
  'spec-14-hexbin': Hexbin,
  'spec-15-ecdf': Ecdf,
  'spec-16-waterfall': Waterfall,
  'spec-17-normalized': Normalized,
  'spec-18-marimekko': Marimekko,
  'spec-19-ranked-barx': RankedBarX,
  'spec-20-date-axis': DateAxis,
  'spec-21-donut': Donut,
  'spec-22-gauge': Gauge,
  'spec-23-polar-line': PolarLine,
  'spec-24-rose': Rose,
  'spec-25-wind-rose': WindRose,
};

/**
 * Every renderer in the gallery's specimen track.
 *
 * The twenty-five above are rule-first — written to make a `grammar.md` section
 * checkable. The four imported maps are catalog-first: one plate per entry in
 * TanStack's published catalog, split by family because a single file holding
 * all hundred-odd would be unreadable and because the families genuinely differ
 * in what they are testing (see each file's header).
 *
 * A `missing` specimen has no entry here on purpose. `RENDERABLE_SPECIMENS`
 * filters them out before `render.mjs` looks for a plate, so the absence is
 * declared in one place rather than discovered as a render failure.
 */
const ALL_RENDERERS: Record<string, () => ReactNode> = {
  ...RENDERERS,
  ...CARTESIAN_RENDERERS,
  ...DISTRIBUTION_RENDERERS,
  ...RADIAL_RENDERERS,
  ...GEO_RENDERERS,
  ...INTERACTION_RENDERERS,
  ...NETWORK_RENDERERS,
};

export const specimens: GallerySpecimen[] = (SPECIMENS as GallerySpecimen[]).map((s) => ({
  ...s,
  render: ALL_RENDERERS[s.id],
}));
