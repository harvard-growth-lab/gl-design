/**
 * Heatmaps and Densities — six catalog forms, drawn on the Atlas panel, the
 * product space, and the country cross-section.
 *
 * Every chart in this family paints a *quantity* into a *cell*, so all six sit
 * on the same two rules: §3.4 makes a cell a TILE (full opacity, never the
 * scatter's 0.8, because tiles cannot overlap and 0.8 would only dilute them
 * against paper), and §12 sends an ordered quantity with no midpoint to one hue
 * in five steps. What the family is really testing is whether those two rules
 * survive Atlas numbers, and three things happen when they meet:
 *
 * 1. **The ramp is equal-width and the Atlas is log-normal.** `glSequentialColor`
 *    cuts its domain into equal slices. Vietnam's exports grew seventy-five-fold, world
 *    trade in an HS92 line runs over six orders of magnitude, and a single
 *    outlier year in the diversity series is enough to leave two of five painted
 *    steps unused. Three of the six demos below hit this, from three different
 *    directions, and none of them works around it — there is no quantile or log
 *    option on the scale and inventing one at the call site would be styling.
 *
 * 2. **Atlas labels do not fit their cells.** The nine sector names run to
 *    forty-one characters; the label-fit routine that would shorten them
 *    (`estimateTextWidth` plus the shorten ladder) is private to
 *    `shapes/treemap.ts`. The heatmaps carry that gap on the axis, the labelled
 *    heatmap carries it inside the tile, and it is the same missing export.
 *
 * 3. **The Atlas has no days, so the calendar has to be refolded.** A calendar
 *    heatmap is a long one-dimensional sequence wrapped onto a lattice of two
 *    nested time units. The Atlas's only sequence is twenty-nine years, so the
 *    two calendar plates below wrap it decade × year-within-decade. The form is
 *    exercised honestly; the grain is not, and neither is the periodicity a
 *    calendar exists to reveal. That is recorded, not papered over.
 *
 * Contract, unchanged from the gallery: no hex, no font size, no stroke width,
 * no opacity below. Data preparation is authored; appearance never is.
 */

import type { ReactNode } from 'react';
import { Chart } from '@tanstack/react-charts';
import { geoIdentity } from 'd3-geo';

import {
  glAxisBin,
  glAxisX,
  glAxisY,
  glCell,
  glChart,
  glHexbin,
  glHexbinLattice,
  glLabel,
  glSequentialColor,
} from '../src/index.js';
import {
  glContourDensity,
  type GLContourFeature,
  glGeoShape,
  glLabelInkOn,
} from '../src/shapes.js';
import { GLFigure, GLRampLegend } from '../src/figure.js';

import {
  FIRST_YEAR,
  LATEST_YEAR,
  LEAD,
  SECTOR_ORDER,
  countrySectorYear,
  countrySectorYearTable,
  countryYearTable,
  crossSection,
  defined,
  pct,
  productNodes,
  productSpaceNodesTable,
  seriesFor,
  sourceOf,
  usd,
  withNote,
} from './atlas-data.js';
import type { Demo, Family } from './demo.js';

const PANEL = sourceOf(countryYearTable);
const SECTORS = sourceOf(countrySectorYearTable);
const NODES = sourceOf(productSpaceNodesTable);

/**
 * The decade lattice both calendar demos fold onto.
 *
 * A calendar heatmap wraps a long sequence onto two nested time units — weeks
 * across, weekdays down. The Atlas's only sequence is 1995–2023, so the nesting
 * that exists here is decade × year-within-decade: four rows, ten columns, and
 * eleven of the forty slots genuinely empty because the panel starts in 1995 and
 * stops in 2023. The empty corners are the one thing this shares with a real
 * calendar year, whose first and last weeks are also part-empty.
 */
const DECADES = ['1990s', '2000s', '2010s', '2020s'];
const SLOTS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// ════════════════════════════════════════════════════════════════════════════

// #region demo:spec-13-heatmap
/**
 * The matrix heatmap: sector × year, coloured by share of the year's exports.
 *
 * Share rather than value, because the cell has to mean the same thing in 1995
 * and 2023 and Vietnam's exports grew seventy-five-fold between them. Normalising
 * within the year is what makes the column comparable to its neighbour, which is
 * the only reason to put a panel on a grid rather than on nine lines.
 *
 * §3.4: the cell routes through the `tile` defaults, so it renders at full
 * opacity. The scatter's 0.8 exists so overlapping points darken into a density
 * signal; a cell grid cannot overlap and 0.8 would only dilute it.
 *
 * Both axes take `glAxisBin` — zero padding — because a year abuts the next year
 * and a sector abuts the next sector. `glAxisBand`'s 28% gap would invent a
 * discreteness the matrix does not have (§3.5).
 */
function SectorShareMatrix() {
  const rows = defined(
    countrySectorYear.filter((d) => d.iso3 === LEAD),
    'exportValueM',
  );

  // Year totals first, so each cell is a share of its own column. The `?? 0` is
  // an accumulator seed, not a coalesced measurement — `defined` already dropped
  // every null above, so nothing missing is being counted as zero.
  const totals = new Map<number, number>();
  for (const d of rows) totals.set(d.year, (totals.get(d.year) ?? 0) + d.exportValueM);

  const cells = rows.map((d) => ({
    year: String(d.year),
    sector: d.sector,
    share: d.exportValueM / totals.get(d.year)!,
  }));

  const years = [...totals.keys()].sort((a, b) => a - b).map(String);
  const ramp = glSequentialColor({
    domain: [0, Math.max(...cells.map((c) => c.share))],
    steps: 5,
  });

  const chart = glChart({
    marks: [glCell(cells, { x: 'year', y: 'sector', color: 'share' })],
    x: glAxisBin({
      domain: years,
      // One label every five years. Twenty-nine year labels on a band axis is
      // not a legibility problem the axis can solve for itself.
      format: (v) => (Number(v) % 5 === 0 ? v : ''),
    }),
    y: glAxisBin({ domain: [...SECTOR_ORDER] }),
    color: { scale: ramp },
    // The Atlas sector names run to 41 characters and the axis prints a tick
    // label whole or not at all, so the only lever is the gutter.
    margin: { left: 250 },
  });

  return (
    <GLFigure
      title="Electronics went from a rounding error to a third of everything Vietnam sells."
      subtitle={`Each sector's share of Vietnam's classified goods exports, ${FIRST_YEAR}–${LATEST_YEAR}`}
      source={SECTORS}
      legend={<GLRampLegend scale={ramp} label="Share of the year's exports" format={pct} />}
    >
      <Chart {...chart.props} height={260} ariaLabel="Vietnam export share by sector and year" />
    </GLFigure>
  );
}
// #endregion

// #region demo:spec-14-hexbin
/**
 * Hexagonally binned density over the product space.
 *
 * 1,240 HS92 product lines, world trade against complexity. A scatter of that
 * many points saturates its own core — §3.4's 0.8 was calibrated on a few
 * hundred — so the honest instrument is a bin: a hexbin cannot claim density
 * anywhere it has no observations, which is precisely what the contour beside it
 * can and does.
 *
 * The lattice and the mark come as a pair: `glHexbinLattice` bins in data space
 * and `glHexbin` draws every vertex back through the scales, so the tiles abut
 * at whatever width the page gives them. An earlier version of this plate rolled
 * the lattice by hand and drew it with a guessed 16px radius, which tiled at no
 * width at all — the hexagons stood apart with paper between them, and a hexbin
 * with gaps claims emptiness the lattice never measured.
 *
 * Two numbers are still authored, and neither is an appearance quantity. `rows`
 * is the resolution — how much evidence one tile pools. `aspect` is the plot's
 * proportions, which decide only whether the tiles come out regular; the library
 * warns in development when it is far off, and nothing about the tiling depends
 * on it. The pinned axis domains are passed to the lattice as well, so both are
 * laid over the same extent.
 *
 * §3.4 again: `glHexbin` routes to `tile`, not to `point`. These tile the plane
 * and cannot overlap.
 */
function ProductSpaceDensity() {
  // `defined` twice, then drop the zero-trade lines: a log takes neither a null
  // nor a zero, and a product the world does not trade is not a low value.
  const cloud = defined(defined(productNodes, 'pci'), 'exportValueM')
    .filter((d) => d.exportValueM > 0)
    .map((d) => ({ x: Math.log10(d.exportValueM), y: d.pci }));

  const TRADE = [0, 6.5] as const;
  const PCI = [-5, 3] as const;

  const lattice = glHexbinLattice(cloud, {
    x: 'x',
    y: 'y',
    rows: 8,
    // width ÷ height of the plot area: this page's column gives the chart 770px
    // at 260px tall, which leaves 680 × 200 inside the axes.
    aspect: 3.4,
    domain: { x: TRADE, y: PCI },
  });

  // The domain starts at one, not zero: a drawn hexagon holds at least one
  // product, and a palest step reading "0 to 9" would name a bin the chart never
  // paints.
  const ramp = glSequentialColor({ domain: [1, lattice.max], steps: 5 });

  const chart = glChart({
    marks: [glHexbin(lattice, { color: 'count' })],
    x: glAxisX({
      label: `World trade in the product, ${LATEST_YEAR} (log scale)`,
      domain: [...TRADE],
      values: [0, 1, 2, 3, 4, 5, 6],
      format: (v) => usd(10 ** v),
    }),
    y: glAxisY({ label: 'Product complexity (PCI)', domain: [...PCI] }),
    color: { scale: ramp },
  });

  return (
    <GLFigure
      title="How much the world trades of a product tells you nothing about how complex it is."
      subtitle={`${cloud.length.toLocaleString('en')} HS92 product lines in ${lattice.bins.length} hexagonal bins; complexity is centred just above zero at every trade value`}
      source={NODES}
      legend={<GLRampLegend scale={ramp} label="Products per bin" format={(v) => String(Math.round(v))} />}
    >
      <Chart {...chart.props} height={260} ariaLabel="Product complexity against world trade, hexagonally binned" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-39-density-contours
/**
 * The same 1,240 products, estimated rather than counted.
 *
 * Read this against the hexbin above — they are drawn from one cloud and they
 * disagree, which is the entire reason the pair exists. The hexbin resolves a
 * ridge made of a hundred separately-occupied bins with paper between them; the
 * kernel smooths that into one continuous mound and paints density into corners
 * where no product sits. Neither is a bug. A kernel estimate is a MODEL, and an
 * iso-line drawn where nothing was observed reads as evidence rather than as
 * smoothing.
 *
 * `glContourDensity` answers that by dropping the lowest level — the ring that
 * balloons furthest past the data. It is a blunter instrument than `glDensity`'s
 * trim-to-observed-range, because a two-dimensional hull is not an interval, and
 * it is why this specimen is recorded `partial`.
 *
 * §12: a contour level is ORDERED with no midpoint, so it walks one hue in five
 * steps — the identical ruling the hexbin gets, so everything different on
 * screen is the estimator. Almost: the aspect ratio is different too, and that
 * one is the drawing route rather than the estimator. `geoShape` fits the rings
 * to their own coordinate box, which here is 5.6 log-dollars by 6.7 PCI points —
 * two quantities with no common unit — so the mound comes out taller than wide
 * while the same cloud on the hexbin is four times wider than tall. Left as it
 * falls, and recorded.
 */
function ProductSpaceContours() {
  const cloud = defined(defined(productNodes, 'pci'), 'exportValueM')
    .filter((d) => d.exportValueM > 0)
    .map((d) => ({ x: Math.log10(d.exportValueM), y: d.pci }));

  const { features, domain } = glContourDensity(cloud, {
    x: 'x',
    y: 'y',
    resolution: 72,
    // Bandwidth is the one knob a density plot cannot pick for you, and it is
    // measured in GRID CELLS. Five keeps the ridge's length legible; at twelve
    // the estimate rounds the whole cloud into a single circular blob and the
    // chart stops saying anything the mean did not already say.
    bandwidth: 5,
    levels: 5,
  });

  const ramp = glSequentialColor({ domain, steps: 5 });

  const chart = glChart({
    marks: [
      // Marching squares emits rings with holes and `geoShape` is the only
      // polygon-capable mark in the stack, so a contour reaches the chart the
      // way a coastline does — through a projection, with `geoIdentity`.
      glGeoShape(features as never, {
        projection: { type: () => geoIdentity().reflectY(true), fit: 'data', inset: 2 } as never,
        color: ((f: GLContourFeature) => f.properties.value) as never,
      }),
    ],
    guides: false,
    color: { scale: ramp },
    margin: { left: 8, right: 8, top: 8, bottom: 8 },
  });

  return (
    <GLFigure
      title="The kernel smooths a hundred separately-occupied bins into one continuous mound."
      subtitle={`Kernel density over ${cloud.length.toLocaleString('en')} HS92 product lines, bandwidth 5 cells, outermost level dropped; world trade (log) runs across and complexity up, but the projection fits the rings to their own coordinate aspect, so the proportions are not the hexbin's`}
      source={withNote(NODES, 'A kernel estimate is a model, not an observation')}
      legend={
        <GLRampLegend
          scale={ramp}
          label="Products per grid cell (estimated)"
          format={(v) => v.toFixed(2)}
        />
      }
    >
      <Chart {...chart.props} height={280} ariaLabel="Density contours over the product space" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-heatmap-labeled
/**
 * A labelled ordinal heatmap: the Atlas's own mobility matrix.
 *
 * Rank every economy by complexity in 1995 and again in 2023, cut each year into
 * fifths, and count how the 1995 fifths redistributed. Row percentages, so each
 * row sums to 100% and the diagonal reads as "stayed put". The Atlas ships
 * `eciRank` but no quintile, so the cut is made here — which is data preparation
 * and belongs in the demo where the reader can see it.
 *
 * §3.4.1 is the rule this plate exists for: a label placed ON a fill follows that
 * fill's luminance, not Decision Rule 6. `glLabelInkOn` takes the RESOLVED fill
 * rather than a tone reference, which is what makes it usable here at all — a
 * sequential ramp's fourth bin has no tone triple to ask about. The ramp is held
 * in a variable so the cells, the labels and the legend all read the same object;
 * two copies of a ramp is two things that can drift apart.
 */
function ComplexityMobility() {
  const QUINTILES = ['Most complex', '2nd', '3rd', '4th', 'Least complex'];

  // A fifth of the ranked cross-section, by ECI. `defined` first: an economy the
  // Atlas has not ranked has no quintile, and 0 is not "least complex".
  const quintiles = (year: number) => {
    const ranked = defined(crossSection(year), 'eci').sort((a, b) => b.eci - a.eci);
    return new Map(
      ranked.map((d, i) => [d.iso3, Math.min(4, Math.floor((i * 5) / ranked.length))]),
    );
  };

  const start = quintiles(FIRST_YEAR);
  const end = quintiles(LATEST_YEAR);

  const counts = QUINTILES.map(() => QUINTILES.map(() => 0));
  let tracked = 0;
  for (const [iso3, from] of start) {
    const to = end.get(iso3);
    // Ranked in one year and not the other: no transition to count, and no
    // defensible cell to put it in.
    if (to === undefined) continue;
    counts[from][to] += 1;
    tracked += 1;
  }

  const cells = counts.flatMap((row, i) => {
    const total = row.reduce((a, b) => a + b, 0);
    return row.map((n, j) => ({ from: QUINTILES[i], to: QUINTILES[j], share: n / total }));
  });

  const ramp = glSequentialColor({
    domain: [0, Math.max(...cells.map((c) => c.share))],
    steps: 5,
  });

  const chart = glChart({
    marks: [
      glCell(cells, { x: 'to', y: 'from', color: 'share' }),
      glLabel(cells, {
        x: 'to',
        y: 'from',
        text: (d) => `${Math.round(d.share * 100)}%`,
        anchor: 'middle',
        fill: (d) => glLabelInkOn(ramp(d.share)),
      }),
    ],
    x: glAxisBin({ label: `Complexity fifth in ${LATEST_YEAR}`, domain: QUINTILES }),
    y: glAxisBin({ label: `Complexity fifth in ${FIRST_YEAR}`, domain: QUINTILES }),
    color: { scale: ramp },
    margin: { left: 120 },
  });

  return (
    <GLFigure
      title="Complexity is stickiest at the top: five in six of the most complex economies stayed there."
      subtitle={`Where ${tracked} economies ranked in ${FIRST_YEAR} had moved to by ${LATEST_YEAR}; each row sums to 100%`}
      source={PANEL}
      legend={<GLRampLegend scale={ramp} label="Share of the row" format={pct} />}
    >
      <Chart {...chart.props} height={280} ariaLabel="Complexity quintile transition matrix" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-25-calendar-heatmap
/**
 * The calendar heatmap, at the only grain the Atlas has.
 *
 * A calendar wraps a long sequence onto a lattice of two nested time units so
 * that a whole span fits in one block and its periodicity becomes readable. The
 * Atlas has no days, weeks or months — the panel is annual — so the nesting that
 * genuinely exists is decade × year-within-decade. Twenty-nine years wrap onto
 * four rows of ten, and eleven of the forty slots are empty because the record
 * starts in 1995 and stops in 2023.
 *
 * §3.5: a calendar is binned on BOTH axes — a year abuts the next year, a decade
 * abuts the next decade — so both take `glAxisBin` and its zero padding.
 * `glAxisBand`'s 28% gap would invent a discreteness time does not have.
 *
 * The count on the cells is diversity: how many products Vietnam exports with
 * revealed comparative advantage. A count is the calendar's canonical payload,
 * and §12 sends it to five steps of one hue.
 */
function DiversityCalendar() {
  const cells = defined(seriesFor(LEAD), 'diversity').map((d) => ({
    decade: `${Math.floor(d.year / 10) * 10}s`,
    slot: String(d.year % 10),
    year: d.year,
    diversity: d.diversity,
  }));

  const counts = cells.map((c) => c.diversity);
  const ramp = glSequentialColor({
    domain: [Math.min(...counts), Math.max(...counts)],
    steps: 5,
  });

  const chart = glChart({
    marks: [glCell(cells, { x: 'slot', y: 'decade', color: 'diversity' })],
    x: glAxisBin({ label: 'Year within the decade', domain: SLOTS }),
    y: glAxisBin({ domain: DECADES }),
    color: { scale: ramp },
    margin: { left: 74 },
  });

  return (
    <GLFigure
      title="Vietnam's competitive basket widened once, through the 2000s, and has been flat since."
      subtitle={`Products exported with revealed comparative advantage, ${FIRST_YEAR}–${LATEST_YEAR}, wrapped decade by year`}
      source={withNote(PANEL, '2004 is a single outlier in the diversity series and is shown as measured')}
      legend={
        <GLRampLegend
          scale={ramp}
          label="Products with RCA ≥ 1"
          format={(v) => String(Math.round(v))}
        />
      }
    >
      <Chart {...chart.props} height={220} ariaLabel="Vietnam product diversity by decade and year" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-118-token-usage-calendar
/**
 * The same lattice, read as consumption rather than as a count.
 *
 * Kept as its own demo rather than folded into the one above because the two
 * differ in the only way that matters to a design system: what the colour means.
 * A count ramp and a volume ramp are both ordered with no midpoint, so §12 sends
 * both to the same five steps of one hue — and the point of drawing them side by
 * side is to show the answer really is the same rather than to assert it.
 *
 * Where the real data does change the picture is the BINNING. Vietnam's exports
 * grew from $5.1bn to $395bn, and `glSequentialColor` cuts its domain into five
 * equal slices — so the whole of the nineties and most of the 2000s land in the
 * palest step. That is the growth story told honestly by a scale that cannot
 * bin any other way; it is recorded as a gap rather than worked around.
 */
function ExportVolumeCalendar() {
  const cells = defined(seriesFor(LEAD), 'exportValueM').map((d) => ({
    decade: `${Math.floor(d.year / 10) * 10}s`,
    slot: String(d.year % 10),
    year: d.year,
    exports: d.exportValueM,
  }));

  const values = cells.map((c) => c.exports);
  const ramp = glSequentialColor({
    domain: [Math.min(...values), Math.max(...values)],
    steps: 5,
  });

  const chart = glChart({
    marks: [glCell(cells, { x: 'slot', y: 'decade', color: 'exports' })],
    x: glAxisBin({ label: 'Year within the decade', domain: SLOTS }),
    y: glAxisBin({ domain: DECADES }),
    color: { scale: ramp },
    margin: { left: 74 },
  });

  const total = values.reduce((a, b) => a + b, 0);

  return (
    <GLFigure
      title="Seven eighths of everything Vietnam has ever exported was shipped after 2010."
      subtitle={`Total goods exports, ${FIRST_YEAR}–${LATEST_YEAR}, on the same lattice; ${usd(total)} in all, and the first sixteen years share one step of the ramp`}
      source={PANEL}
      legend={<GLRampLegend scale={ramp} label="Exports in the year" format={usd} />}
    >
      <Chart {...chart.props} height={220} ariaLabel="Vietnam export value by decade and year" />
    </GLFigure>
  );
}
// #endregion

// ════════════════════════════════════════════════════════════════════════════

const demos: Demo[] = [
  {
    id: 'spec-13-heatmap',
    family: 'Heatmaps and Densities',
    name: 'Matrix heatmap',
    question: 'Which sectors did Vietnam move into, and which did it move out of?',
    rule: '§3.4 — a cell is a TILE: full opacity, never the scatter 0.8.',
    render: SectorShareMatrix,
    gaps: [
      'Cell values are not labelled. The treemap has a label-fit routine (estimateTextWidth + the shorten ladder) and it is private to shapes/treemap.ts; a heatmap needs the same "does it fit, else drop" test and cannot reach it. At 29 columns nothing would fit anyway, which is the answer the routine would have given — but the plate cannot ask.',
      'The same missing export bites on the axis. Atlas sector names run to 41 characters ("Textiles, garments, footwear and furniture") and glAxisBin prints a tick label whole or not at all, so the only lever is the gutter: 250px of the figure goes to the y axis before a single cell is drawn. A truncate-with-ellipsis or wrap option on the axis preset would be the honest fix, and there is none.',
      'Twenty-nine year labels do not fit either, and the axis has no tick-thinning. The demo blanks four years in five through `format`, which is the calendar plate’s trick and works, but it means the axis is thinned by the caller counting rather than by the axis measuring.',
    ],
  },
  {
    id: 'spec-14-hexbin',
    family: 'Heatmaps and Densities',
    name: 'Hexagonally binned density',
    question: 'Does the world trade more of the products that are harder to make?',
    rule: '§3.4 — hexbins tile the plane and cannot overlap, so 0.8 would only dilute.',
    render: ProductSpaceDensity,
    gaps: [
      'The binning is done in DATA space, by `glHexbinLattice` rather than by the plate, and that is a deliberate departure from TanStack — its own hexbin example bins in pixel space against the measured inner bounds. Pixel binning gives regular hexagons at every width and moves the bin boundaries when the container changes, so the counts the legend is keyed to are only right at one size. Data binning fixes the counts and pays for it in regularity, which is the direction a chart with a printed legend should err. Neither is free, and the library now only offers the second.',
      '`aspect` is still authored (3.4 here), and it is the plate telling the library something the library could measure for itself. Getting it wrong no longer breaks the tiling — the mark draws its vertices through the scales, so the tiles abut regardless — but the hexagons come out stretched, and the only thing that notices is a development warning. A mark that read the resolved plot bounds could pick the column pitch itself; a custom mark cannot, because the pitch has to be known before the bins are counted.',
      'glSequentialColor bins equal-width and the bin counts are log-normal: most of the hexagons fall in the palest step and a handful carry the top one. There is no quantile or log option on the sequential scale, so a density this skewed can only be painted as mostly-empty.',
    ],
  },
  {
    id: 'ts-39-density-contours',
    family: 'Heatmaps and Densities',
    name: 'Point density contours',
    question: 'What does a kernel estimate claim about the product space that a count cannot?',
    rule: '§12 — a contour level is ORDERED with no midpoint, so it walks one hue.',
    render: ProductSpaceContours,
    gaps: [
      'A kernel estimate is a MODEL, and an iso-line drawn where nothing was observed reads as evidence rather than as smoothing. `glDensity` answers that in one dimension by trimming to the observed range; a two-dimensional hull is not an interval, so `glContourDensity` drops the lowest level instead — the ring that balloons furthest past the data. That is a blunter instrument than trimming and it is the reason this is `partial`. Read the plate against `spec-14-hexbin`, which draws the same cloud and cannot claim density anywhere it has no observations.',
      'Contours reach a chart through `glGeoShape` with `geoIdentity`, because marching squares emits rings with holes and `geoShape` is the only polygon-capable mark in the stack. That works and is arguably the right model — an iso-line and a coastline are the same kind of object — but it means the plate imports `d3-geo` for a chart with no geography in it.',
      'The geoShape route costs the chart its axes. Position comes from a projection fitted to the features, not from a scale, so `guides: false` is not a choice — there is nothing for an axis to read. On synthetic data that only looked austere; on the Atlas it is a real loss, because the hexbin beside it can say "$10bn of world trade, PCI +0.5" and this one can only say "here". Any contour over data with units needs axes, and no mark in the stack can give it them.',
      'Worse than austere: the fitted projection also invents the aspect ratio. `fit: \'data\'` preserves the ratio of the coordinates themselves, and here they are 5.6 log-dollars wide by 6.7 PCI points tall — two quantities with no common unit — so the rings render TALLER than wide while the same cloud on the hexbin is four times wider than tall. The picture therefore reports a shape the data does not have. A Cartesian mark stretches each axis independently to fill the plot and cannot make this mistake; `geoShape` is the only polygon mark there is, and it is a map mark, where preserving the aspect is the whole point.',
      'Every product line in the cloud carries a sector, and the contour cannot show it. A hexbin at least implies where the observations are; a density surface over a mixed population reports a mode that may belong to no sector at all. That is a property of the estimator rather than of the library, but it is the reason the pairing with the hexbin is load-bearing rather than decorative.',
    ],
  },
  {
    id: 'ts-heatmap-labeled',
    family: 'Heatmaps and Densities',
    name: 'Labelled ordinal heatmap',
    question: 'Do economies move between complexity ranks, or stay where they started?',
    rule: "§3.4.1 — a label ON a fill follows that fill's luminance, not Decision Rule 6.",
    render: ComplexityMobility,
    gaps: [
      "Writing this plate closed half of `spec-13-heatmap`'s gap: the in-tile ink rule was private to `shapes/treemap.ts` and now ships as `glLabelInkOn`, because a heatmap cell asks the identical question a treemap tile does. Decision Rule 6's dark tone is wrong on a saturated fill — `c-1-dark` on `c-1` measures 2.5:1 — and every mark that puts text on a fill needs the luminance split instead.",
      'The other half is still open. `estimateTextWidth` and the shorten ladder remain private, so nothing here can test whether a label FITS its cell. This plate only labels safely because a 5×5 matrix of two-digit percentages fits by construction — which the plate knows and the library cannot check.',
      'The real matrix has empty cells and the library labels them anyway. Seven of the twenty-five transitions never happened, and each gets a "0%" in the palest step — ink spent saying nothing, on the cells a reader should weight least. The treemap’s routine decides *whether* to label as well as how to shorten; `glLabel` has neither half, so a suppress-below-threshold rule has to be a data filter at the call site or not exist.',
      'Quintiles are cut here because the Atlas ships `eciRank` and no quantile grouping. That is legitimate data preparation, but it means the boundaries are the demo’s and not the Atlas’s — unlike `leadThresholds`, where the percentiles come down from the release and a chart cannot disagree with the Atlas about them.',
    ],
  },
  {
    id: 'ts-25-calendar-heatmap',
    family: 'Heatmaps and Densities',
    name: 'Calendar heatmap',
    question: 'When did Vietnam actually broaden the range of things it makes competitively?',
    rule: '§3.5 — a calendar is binned on BOTH axes, so both take zero padding.',
    render: DiversityCalendar,
    gaps: [
      'The Atlas is annual and this form needs days. The lattice is refolded at the only nesting the data has — decade × year-within-decade — so §3.5 is exercised honestly on both axes, but a calendar exists to make PERIODICITY visible (the weekend band, the August shutdown) and a decade has no such rhythm. Twenty-nine cells is also two orders of magnitude short of a calendar year, so nothing here tests the form at the density it was designed for.',
      'Eleven of the forty slots are empty (1990–94, 2024–29) and they are correctly absent rather than zero, but the axis still prints their columns. `glAxisBin` takes a pinned domain and has no way to say "this slot has no observation in any row", which on a real calendar is the difference between a blank cell and a cell that means nothing was consumed.',
      'One outlier breaks the ramp. Diversity runs 185–291 across twenty-eight years and 468 in 2004; five equal-width steps over that domain leave two of the five painted steps unused and put twenty-eight of twenty-nine years in the bottom two. glSequentialColor has no quantile, log or clamped-domain option, and choosing a robust domain at the call site would be the plate styling around its own data.',
    ],
  },
  {
    id: 'ts-118-token-usage-calendar',
    family: 'Heatmaps and Densities',
    name: 'Consumption calendar',
    question: 'How much of everything Vietnam has ever exported was exported recently?',
    rule: '§12 — a count ramp and a consumption ramp are the same ramp.',
    render: ExportVolumeCalendar,
    gaps: [
      'The only entry with NO reference column: `catalog/embed/118-token-usage-calendar` returns 404. The slug is embedded by `heatmaps-and-densities.md` in the pinned 0.6.5 docs and the live catalog no longer serves it, which is the exact case `tanstack-catalog.mjs` unions two sources to catch — enumerate from the website alone and this example disappears from the denominator. The plate is built and audited; only the diff is unavailable.',
      'Same annual-grain deviation as the calendar above: the lattice is decade × year, not week × weekday, because the Atlas has no sub-annual observations to put on one.',
      'The equal-width ramp is the finding and the gap at once. Exports run $5.1bn to $395bn, so sixteen of twenty-nine years fall in the palest step and the chart reads as "nothing happened until 2010". That is true in proportion and false in kind — 1995 was not zero — and the fix (quantile or log binning) is not on `glSequentialColor`. The count calendar beside it fails the same way from an outlier rather than from skew, which is what makes this a scale-level gap and not a data quirk.',
    ],
  },
];

export const heatmapsFamily: Family = {
  slug: 'heatmaps-and-densities',
  title: 'Heatmaps and Densities',
  blurb:
    'Six ways of painting a quantity into a cell. Each spends a single hue across five steps, so the grid reads as one measure getting larger rather than as a set of unrelated colours.',
  demos,
};

export function renderHeatmaps(): Record<string, () => ReactNode> {
  return Object.fromEntries(demos.map((d) => [d.id, d.render]));
}
