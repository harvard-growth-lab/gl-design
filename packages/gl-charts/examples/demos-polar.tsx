/**
 * Polar and Radar — fifteen radial forms, drawn from the Atlas.
 *
 * This is the family where real data pushes back hardest, and it does it in
 * three ways that are worth stating once here rather than fifteen times below.
 *
 * 1. **The Atlas has no cyclic domain. Not one.** Every polar specimen in the
 *    catalog is built on a domain that closes — hour of day, compass bearing,
 *    month of year — and the wrap *is* the argument for the form: December has
 *    to sit next to January or the peak is cut in half. The Atlas is a
 *    country × product × year panel. Years do not wrap, sectors do not wrap,
 *    destination markets do not wrap. So the polar line and the rose here are
 *    drawn over a categorical ring whose join is a property of the *drawing*,
 *    and every one of them says so in its gaps. The alternative was to invent a
 *    month column, which is the one thing this page may not do.
 *
 * 2. **Nine sectors against a four-slice cap.** §3.8 caps a part-to-whole at
 *    four slices; the Atlas classification has nine sectors and Vietnam has 1,199
 *    products. Every donut below therefore has to *decide* what its residual is,
 *    in the demo's own code, in the open — which is exactly what the rule asks an
 *    author to do, and what `ts-93-labeled-pie` shows the cost of skipping.
 *
 * 3. **Radial charts have nowhere to put a long name.** A Cartesian chart grows
 *    its left margin until the tick labels fit. A polar chart has one `inset`
 *    for the whole ring, so the gutter is sized by the longest label whether or
 *    not that label points sideways — and Atlas labels are
 *    "Textiles, garments, footwear and furniture" and "United States of
 *    America". Several plates below are illegible for that reason and are
 *    supposed to be.
 *
 * Contract, unchanged: no hex, no font size, no stroke width, no opacity. What
 * is authored here is the arithmetic that decides where an arc starts and stops.
 */

import type { ReactNode } from 'react';
import { Chart } from '@tanstack/react-charts';
import { scaleLinear } from '@tanstack/charts-scales/linear';
import { hierarchy, partition } from 'd3-hierarchy';

import { resolveTone, seriesKeyAt } from '../src/index.js';
import {
  arcAngles,
  glAngleGrid,
  glDonutChart,
  glPolarChart,
  glRadarChart,
  glRadialAnnotation,
  glRadialArc,
  glRadialDot,
  glRadialGrid,
  glRadialLabel,
  glRadialLine,
  glRadialRule,
} from '../src/shapes.js';
import { GLFigure, GLLegend } from '../src/figure.js';

import {
  COHORT,
  FIRST_YEAR,
  LATEST_YEAR,
  LEAD,
  SECTOR_ORDER,
  type LeadProduct,
  countryName,
  countrySectorYearTable,
  countryYearTable,
  crossSection,
  defined,
  index,
  leadProducts,
  leadProductYearTable,
  leadPartnersTable,
  leadSectorsIn,
  partnersIn,
  pct,
  rank,
  sectorRank,
  sourceOf,
  usd,
  withNote,
  worldSectorYear,
  worldSectorYearTable,
} from './atlas-data.js';
import type { Demo, Family } from './demo.js';

const PANEL = sourceOf(countryYearTable);
const SECTORS = sourceOf(countrySectorYearTable);
const WORLD = sourceOf(worldSectorYearTable);
const PARTNERS = sourceOf(leadPartnersTable);
const PRODUCTS = sourceOf(leadProductYearTable);

/**
 * The sector tables drop the Atlas's unclassified "Other" bucket — trade
 * discrepancies and uncoded commodities — so a share taken off them is a share
 * of *classified* exports. Every part-to-whole below that reads them says so,
 * because a pie whose whole is not the whole is the oldest chart lie there is.
 */
const CLASSIFIED = 'Shares are of classified exports; the Atlas “Other” bucket is excluded';

// ════════════════════════════════════════════════════════════════════════════
// Part-to-whole — the four-slice cap and what it costs
// ════════════════════════════════════════════════════════════════════════════

// #region demo:spec-21-donut
/**
 * Vietnam's export basket, capped at the four slices §3.8 allows.
 *
 * The Atlas classification has nine sectors and the rule allows four, so the
 * demo has to choose the residual and choose it visibly: the three largest
 * sectors keep their names and the remaining six become one slice that says how
 * many it is standing for. Grouping the tail is what §3.8 asks for, and doing it
 * in the demo rather than inside the chart is deliberate — which sectors are
 * worth naming is an editorial judgment, and a library that made it silently
 * would be making it for every reader.
 *
 * The hole holds the total. That is the whole argument for a donut over a pie:
 * a reader who wants the level as well as the split does not have to leave the
 * figure to get it.
 */
/**
 * Every part-to-whole plate below folds a tail, and a folded tail is not a
 * category — it is the absence of several. Two rules follow, and `arcAngles`
 * enforces neither, so they are applied here:
 *
 * 1. **The residual takes `c-muted`.** Left to the default it takes the next
 *    categorical hue, and on this data that is `c-2` — the lead-finding red the
 *    candlestick and the waterfall use for "worse", two families up the page.
 *    The one arc that is definitionally not a finding was getting the finding
 *    colour. It also un-wraps the seven-slice pie: past six slices the palette
 *    repeats, and the seventh arc landed in Electronics' blue *adjacent to
 *    Electronics*, so the two read as one 39% wedge with a hairline in it.
 * 2. **It goes last** (`sort: false` over slices already built tail-last).
 *    `arcAngles` ranks by value, and the tail out-values a named category on
 *    three of these four plates, so it was landing second clockwise from twelve —
 *    the most prominent position on the chart.
 *
 * `SPEC.md` §3.11 states both for legends ("a muted 'everything else' entry
 * always goes last"); nothing states them for arcs, which is why four plates
 * disagreed with the legend rule and with each other.
 */
const RESIDUAL = /^\d+ smaller |^Everything else$|^Rest of the branch$/;
const sliceTone = (key: string, i: number) => (RESIDUAL.test(key) ? 'muted' : seriesKeyAt(i));

function ExportBasketDonut() {
  const ranked = defined(leadSectorsIn(LATEST_YEAR), 'exportValueM').sort(
    (a, b) => b.exportValueM - a.exportValueM,
  );
  const total = ranked.reduce((sum, d) => sum + d.exportValueM, 0);
  const tail = ranked.slice(3);

  const slices = [
    ...ranked.slice(0, 3).map((d) => ({ label: d.sector, value: d.exportValueM })),
    { label: `${tail.length} smaller sectors`, value: tail.reduce((s, d) => s + d.exportValueM, 0) },
  ];

  const chart = glDonutChart(slices, {
    key: (d) => d.label,
    value: (d) => d.value,
    labelFormat: (s) => `${s.key} · ${pct(s.share)}`,
    centerValue: usd(total),
    centerLabel: `Exports, ${LATEST_YEAR}`,
    tones: sliceTone,
    sort: false,
  });

  return (
    <GLFigure
      title="One sector is now a third of everything Vietnam sells abroad."
      subtitle={`Export value by sector, ${LATEST_YEAR}; the six smallest sectors grouped`}
      source={withNote(SECTORS, CLASSIFIED)}
    >
      <Chart {...chart.props} height={300} ariaLabel="Vietnam export composition by sector" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-76-pie
/**
 * The form §3.8 allows and does not prefer, over Vietnam's destination markets.
 *
 * `pie: true` is opt-in because the hole costs nothing: it removes the centre,
 * where a pie's slices are least distinguishable, and gives the total somewhere
 * to live. Read this against `ts-77-donut` immediately below — identical data,
 * one option different — and the donut is the one a share can be read off.
 *
 * The whole here is *exports to the twelve largest markets*, not exports. The
 * Atlas partner extract carries twelve destinations and they are three-quarters
 * of the total, so the subtitle states the denominator rather than letting the
 * circle imply one it does not have.
 */
function DestinationPie() {
  const markets = defined(partnersIn(LATEST_YEAR), 'exportValueM');
  const tail = markets.slice(3);

  const slices = [
    ...markets.slice(0, 3).map((d) => ({ label: d.partnerShort, value: d.exportValueM })),
    { label: `${tail.length} smaller markets`, value: tail.reduce((s, d) => s + d.exportValueM, 0) },
  ];

  const chart = glDonutChart(slices, {
    key: (d) => d.label,
    value: (d) => d.value,
    pie: true,
    labelFormat: (s) => `${s.key} · ${pct(s.share)}`,
    tones: sliceTone,
    sort: false,
  });

  return (
    <GLFigure
      title="Two markets take more of Vietnam's exports than the other ten together."
      subtitle={`Exports to the twelve largest destination markets, ${LATEST_YEAR}; those twelve are 75% of the total`}
      source={PARTNERS}
    >
      <Chart {...chart.props} height={300} ariaLabel="Vietnam exports by destination, pie" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-77-donut
/**
 * The same four shares with the hole §3.8 prefers.
 *
 * One option different from the pie above, and the difference is not aesthetic.
 * The hole removes the least readable part of a pie and gives the total a place
 * to sit — so this figure answers "what share" and "how much" at once, where the
 * pie answers only the first and asks the reader to take the second on trust.
 */
function DestinationDonut() {
  const markets = defined(partnersIn(LATEST_YEAR), 'exportValueM');
  const tail = markets.slice(3);
  const total = markets.reduce((sum, d) => sum + d.exportValueM, 0);

  const slices = [
    ...markets.slice(0, 3).map((d) => ({ label: d.partnerShort, value: d.exportValueM })),
    { label: `${tail.length} smaller markets`, value: tail.reduce((s, d) => s + d.exportValueM, 0) },
  ];

  const chart = glDonutChart(slices, {
    key: (d) => d.label,
    value: (d) => d.value,
    labelFormat: (s) => `${s.key} · ${pct(s.share)}`,
    centerValue: usd(total),
    centerLabel: 'To the top twelve',
    tones: sliceTone,
    sort: false,
  });

  return (
    <GLFigure
      title="The same four shares, read off the arc rather than the wedge."
      subtitle={`Exports to the twelve largest destination markets, ${LATEST_YEAR}`}
      source={PARTNERS}
    >
      <Chart {...chart.props} height={300} ariaLabel="Vietnam exports by destination, donut" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-93-labeled-pie
/**
 * Seven slices, drawn as asked, warning and all.
 *
 * This plate deliberately breaks the four-slice cap, and it is the most useful
 * one in the family: `glDonutChart` warns and draws anyway, which is the right
 * behaviour — refusing would hand a caller an exception and no way to see their
 * data — and is invisible unless something exercises it.
 *
 * The Atlas makes the case better than the synthetic seven did. Vietnam's three
 * smallest sectors are 2.0%, 1.6% and 1.0% of the basket: three wedges of seven,
 * five and four degrees, each carrying a direct label longer than the wedge is
 * wide. Nobody is comparing those angles. Read the same nine sectors on
 * `spec-21-donut`, where six of them are one honest slice.
 */
function SevenSectors() {
  const ranked = defined(leadSectorsIn(LATEST_YEAR), 'exportValueM').sort(
    (a, b) => b.exportValueM - a.exportValueM,
  );
  const tail = ranked.slice(6);

  const slices = [
    ...ranked.slice(0, 6).map((d) => ({ label: d.sector, value: d.exportValueM })),
    { label: `${tail.length} smaller sectors`, value: tail.reduce((s, d) => s + d.exportValueM, 0) },
  ];

  const chart = glDonutChart(slices, {
    key: (d) => d.label,
    value: (d) => d.value,
    pie: true,
    labelFormat: (s) => `${s.key} · ${pct(s.share)}`,
    tones: sliceTone,
    sort: false,
  });

  return (
    <GLFigure
      title="Past four slices the angles stop being comparable, and Vietnam has nine sectors."
      subtitle={`Export value by sector, ${LATEST_YEAR}, uncapped at seven — the case §3.8 exists to refuse`}
      source={withNote(SECTORS, CLASSIFIED)}
    >
      <Chart {...chart.props} height={330} ariaLabel="Vietnam export composition, seven slices" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-95-rounded-donut
/**
 * The world's basket, with rounded arc ends.
 *
 * `cornerRadius` is a real TanStack option and reaches through `glRadialArc`
 * untouched, which is the point of the plate: the spec rules on fill, opacity,
 * gap and slice count and says nothing about corner geometry, so the option
 * stays open. A design system that only permits what it has ruled on is a
 * straitjacket.
 *
 * The rounding costs something and the plate shows it — a rounded arc no longer
 * meets its neighbour, so the 1px paper gap of §3.8 reads wider at the ends than
 * in the middle. The data is the backdrop for `spec-21-donut`: the world's
 * largest sector is 16% of world trade, where Vietnam's is 34% of Vietnam's.
 */
function WorldBasketRounded() {
  const ranked = defined(
    worldSectorYear.filter((d) => d.year === LATEST_YEAR),
    'exportValueM',
  ).sort((a, b) => b.exportValueM - a.exportValueM);
  const tail = ranked.slice(3);

  const slices = arcAngles(
    [
      ...ranked.slice(0, 3).map((d) => ({ label: d.sector, value: d.exportValueM })),
      {
        label: `${tail.length} smaller sectors`,
        value: tail.reduce((s, d) => s + d.exportValueM, 0),
      },
    ],
    { key: (d) => d.label, value: (d) => d.value },
  );

  const chart = glPolarChart({
    marks: [
      ...slices.map((s) =>
        glRadialArc([s], {
          startAngle: () => s.startAngle,
          endAngle: () => s.endAngle,
          padAngle: () => 1,
          padRadius: 1,
          cornerRadius: 6,
          tone: s.tone,
          innerRadius: (ctx) => ctx.radius * 0.46,
          outerRadius: (ctx) => ctx.radius * 0.78,
        }),
      ),
      glRadialLabel(slices, {
        angle: (s: (typeof slices)[number]) => s.midAngle,
        radius: () => 1,
        text: (s: (typeof slices)[number]) => `${s.key} · ${pct(s.share)}`,
        fill: (s: (typeof slices)[number]) => resolveTone(s.tone).dark,
        anchor: (s: (typeof slices)[number]) => (Math.sin(s.midAngle) < 0 ? 'end' : 'start'),
        baseline: 'middle',
      } as never),
      glRadialAnnotation([{ label: `World exports, ${LATEST_YEAR}` }], {
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
      title="World trade has no dominant sector; Vietnam's basket has one."
      subtitle={`World export value by sector, ${LATEST_YEAR}, with rounded arc ends; the six smallest sectors grouped`}
      source={withNote(WORLD, CLASSIFIED)}
    >
      <Chart {...chart.props} height={300} ariaLabel="World export composition, rounded donut" />
    </GLFigure>
  );
}
// #endregion

// ════════════════════════════════════════════════════════════════════════════
// Hierarchy on rings
// ════════════════════════════════════════════════════════════════════════════

// #region demo:ts-96-nested-donut
/**
 * Two levels of Vietnam's basket on two rings.
 *
 * `partition()` from `d3-hierarchy` does the angular layout — the dependency is
 * already declared for the treemap, so the arcs compose rather than needing a
 * layout of their own. Each ring is `glRadialArc` at a different radius band.
 *
 * The colour rule is the interesting part and it is §8b: a child takes its
 * PARENT's hue at the light step rather than a hue of its own. A second palette
 * pass would claim the products are a second set of categories when they are a
 * decomposition of the first — the same reasoning a two-tone stack applies.
 *
 * The residual is doing real work at both levels. Three sectors are named and
 * six are folded; inside each branch three products are named and the rest of
 * the branch is folded. Every arc therefore sums to its parent, which is the one
 * property a nested donut has to have and the one a "top N" filter destroys.
 */
function NestedBasket() {
  const value = (rows: readonly LeadProduct[]) =>
    rows.reduce((sum, d) => sum + (d.exportValueM ?? 0), 0);

  /** Rank the members of one level by value, largest first. */
  const groupBy = (rows: readonly LeadProduct[], key: (d: LeadProduct) => string) => {
    const groups = new Map<string, LeadProduct[]>();
    for (const row of rows) {
      const bucket = groups.get(key(row));
      if (bucket) bucket.push(row);
      else groups.set(key(row), [row]);
    }
    return [...groups]
      .map(([name, members]) => ({ name, members }))
      .sort((a, b) => value(b.members) - value(a.members));
  };

  interface Branch {
    name: string;
    value?: number;
    children?: Branch[];
  }

  const products = defined(leadProducts, 'exportValueM');
  const sectors = groupBy(products, (d) => d.sector);
  const folded = sectors.slice(3);

  const tree: Branch = {
    name: countryName(LEAD),
    children: [
      ...sectors.slice(0, 3).map((sector) => ({ name: sector.name, members: sector.members })),
      { name: `${folded.length} smaller sectors`, members: folded.flatMap((s) => s.members) },
    ].map((sector) => {
      const inside = groupBy(sector.members, (d) => d.nameShort);
      const rest = inside.slice(3);
      return {
        name: sector.name,
        children: [
          ...inside.slice(0, 3).map((p) => ({ name: p.name, value: value(p.members) })),
          { name: 'Rest of the branch', value: value(rest.flatMap((p) => p.members)) },
        ],
      };
    }),
  };

  const root = partition<Branch>().size([Math.PI * 2, 1])(
    hierarchy(tree)
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
  );

  const rings = root
    .descendants()
    .filter((node) => node.depth >= 1 && node.depth <= 2)
    .map((node) => {
      // Depth 1 owns a palette hue; depth 2 borrows its parent's at `light`.
      const branch = node.depth === 1 ? node : node.parent!;
      const i = (root.children ?? []).indexOf(branch);
      return {
        name: node.data.name,
        depth: node.depth,
        startAngle: node.x0,
        endAngle: node.x1,
        share: (node.value ?? 0) / (root.value ?? 1),
        tone: seriesKeyAt(Math.max(0, i)),
      };
    });

  const chart = glPolarChart({
    marks: [
      ...rings.map((ring) =>
        glRadialArc([ring], {
          startAngle: () => ring.startAngle,
          endAngle: () => ring.endAngle,
          padAngle: () => 1,
          padRadius: 1,
          tone: ring.tone,
          step: ring.depth === 1 ? 'main' : 'light',
          innerRadius: (ctx) => ctx.radius * (ring.depth === 1 ? 0.3 : 0.56),
          outerRadius: (ctx) => ctx.radius * (ring.depth === 1 ? 0.54 : 0.78),
        }),
      ),
      // Outside both rings, in each branch's own dark tone. On the plate the
      // labels have to sit in the gutter rather than on the arcs: an Atlas
      // sector name is forty characters and the widest arc here is a third of a
      // turn, which is not enough at any radius the figure can afford.
      glRadialLabel(
        rings.filter((ring) => ring.depth === 1),
        {
          angle: (r: (typeof rings)[number]) => (r.startAngle + r.endAngle) / 2,
          radius: () => 1,
          text: (r: (typeof rings)[number]) => `${r.name} · ${pct(r.share)}`,
          fill: (r: (typeof rings)[number]) => resolveTone(r.tone).dark,
          anchor: (r: (typeof rings)[number]) =>
            Math.sin((r.startAngle + r.endAngle) / 2) < 0 ? 'end' : 'start',
          baseline: 'middle',
        } as never,
      ),
      glRadialAnnotation([{ label: countryName(LEAD) }], {
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
      title="Electronics is a third of the basket, and one product is a third of electronics."
      subtitle={`Export value by sector and product, ${LATEST_YEAR}; the outer ring decomposes the inner`}
      source={withNote(PRODUCTS, 'Three sectors and three products per sector named; the rest folded')}
    >
      <Chart {...chart.props} height={340} ariaLabel="Vietnam export composition, two rings" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-101-sunburst
/**
 * The same partition taken to full depth — and the Atlas has to be asked for a
 * third level, because the extract only carries two.
 *
 * A product row knows its sector and its HS92 4-digit code and nothing in
 * between. The middle ring here is the 2-digit HS *chapter*, taken from the
 * first two characters of the product's own code. That is a real property of the
 * classification and not a fabricated column — HS92 is nested by construction —
 * but the extract carries no chapter *name*, so the ring can only be numbered.
 *
 * What the third ring shows is the form failing. An arc two levels down subtends
 * a few degrees, cannot be labelled and cannot be compared to its neighbour
 * across a quarter turn of separation. §3.8's cap is written about a single
 * ring; the same arithmetic applies outward, which is why §9 makes the treemap
 * the spec's composition chart. Read this against `ts-74-treemap`, which draws
 * the identical hierarchy and labels ten tiles where this labels four.
 */
function BasketSunburst() {
  const value = (rows: readonly LeadProduct[]) =>
    rows.reduce((sum, d) => sum + (d.exportValueM ?? 0), 0);

  const groupBy = (rows: readonly LeadProduct[], key: (d: LeadProduct) => string) => {
    const groups = new Map<string, LeadProduct[]>();
    for (const row of rows) {
      const bucket = groups.get(key(row));
      if (bucket) bucket.push(row);
      else groups.set(key(row), [row]);
    }
    return [...groups]
      .map(([name, members]) => ({ name, members }))
      .sort((a, b) => value(b.members) - value(a.members));
  };

  interface Branch {
    name: string;
    value?: number;
    children?: Branch[];
  }

  /**
   * Keep the two largest groups at a level and fold the tail into one residual
   * leaf. Folding rather than filtering is what keeps every arc summing to its
   * parent — a "top two" filter would leave each ring narrower than the ring
   * inside it, and a sunburst whose rings do not agree is unreadable in a way
   * that looks like a rendering bug.
   */
  const CAP = 2;
  const fold = (
    groups: { name: string; members: LeadProduct[] }[],
    residual: string,
    build: (g: { name: string; members: LeadProduct[] }) => Branch,
  ): Branch[] => {
    const tail = groups.slice(CAP);
    const kept = groups.slice(0, CAP).map(build);
    return tail.length
      ? [...kept, { name: residual, value: value(tail.flatMap((g) => g.members)) }]
      : kept;
  };

  const products = defined(leadProducts, 'exportValueM');
  const tree: Branch = {
    name: countryName(LEAD),
    // All nine sectors at depth 1: the whole is the whole, and the two smallest
    // sectors coming out as four-degree slivers is the finding, not a defect.
    children: groupBy(products, (d) => d.sector).map((sector) => ({
      name: sector.name,
      children: fold(
        groupBy(sector.members, (d) => `HS ${d.code.slice(0, 2)}`),
        'Other chapters',
        (chapter) => ({
          name: chapter.name,
          children: fold(
            groupBy(chapter.members, (d) => d.nameShort),
            'Other products',
            (product) => ({ name: product.name, value: value(product.members) }),
          ),
        }),
      ),
    })),
  };

  const root = partition<Branch>().size([Math.PI * 2, 1])(
    hierarchy(tree)
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
  );

  const branches = root.children ?? [];
  const arcs = root
    .descendants()
    .filter((node) => node.depth >= 1)
    .map((node) => {
      const branch = node.ancestors().find((a) => a.depth === 1)!;
      const i = branches.indexOf(branch);
      return {
        name: node.data.name,
        depth: node.depth,
        startAngle: node.x0,
        endAngle: node.x1,
        share: (node.value ?? 0) / (root.value ?? 1),
        // Nine sectors, six hues. The four largest take the palette and the five
        // smaller share c-muted — §3.1's answer, and the same call the treemap
        // makes when it paints ten leaves in one hue. Wrapping `seriesKeyAt`
        // past six would give sector seven the same blue as sector one.
        tone: i >= 0 && i < 4 ? seriesKeyAt(i) : ('muted' as const),
      };
    });

  // Three rings inside 0.78 of the radius, leaving the outer fifth as the label
  // gutter — the split `glDonutChart` makes with `ARC_EXTENT`.
  const BAND = 0.2;
  const chart = glPolarChart({
    marks: [
      ...arcs.map((arc) =>
        glRadialArc([arc], {
          startAngle: () => arc.startAngle,
          endAngle: () => arc.endAngle,
          padAngle: () => 1,
          padRadius: 1,
          tone: arc.tone,
          // Depth carries the lightness — as far as it can. A triple has three
          // steps and `dark` is reserved for text and for strokes on
          // overlapping marks, so the second and third rings share `light` and
          // the third level is separated by the paper gap alone.
          step: arc.depth === 1 ? 'main' : 'light',
          innerRadius: (ctx) => ctx.radius * (0.18 + (arc.depth - 1) * BAND),
          outerRadius: (ctx) => ctx.radius * (0.18 + arc.depth * BAND - 0.012),
        }),
      ),
      glRadialLabel(
        arcs.filter((arc) => arc.depth === 1 && arc.share > 0.08),
        {
          angle: (a: (typeof arcs)[number]) => (a.startAngle + a.endAngle) / 2,
          radius: () => 1,
          text: (a: (typeof arcs)[number]) => `${a.name} · ${pct(a.share)}`,
          fill: (a: (typeof arcs)[number]) => resolveTone(a.tone).dark,
          anchor: (a: (typeof arcs)[number]) =>
            Math.sin((a.startAngle + a.endAngle) / 2) < 0 ? 'end' : 'start',
          baseline: 'middle',
        } as never,
      ),
      glRadialAnnotation([{ label: 'Exports' }], {
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
      title="Three rings out, the arcs are thinner than the gaps between them."
      subtitle={`Export value by sector, HS92 chapter and product, ${LATEST_YEAR}; four of nine branches labelled`}
      source={withNote(PRODUCTS, 'Chapter is the first two digits of the product code')}
    >
      <Chart {...chart.props} height={340} ariaLabel="Vietnam export hierarchy sunburst" />
    </GLFigure>
  );
}
// #endregion

// ════════════════════════════════════════════════════════════════════════════
// Magnitude bent round a centre
// ════════════════════════════════════════════════════════════════════════════

// #region demo:ts-100-radial-bars
/**
 * Six economies on six concentric tracks, ranked by how many products they
 * export competitively.
 *
 * Each row gets its own ring and each ring is an arc swept in proportion to the
 * value, so length is the encoding. It is a bar chart bent around a centre, and
 * bending it costs the reader the one thing bars are best at: a common baseline.
 * The outer rings are physically longer at equal value, so the form
 * systematically overstates whatever is drawn outermost.
 *
 * The plate answers that the only way available — it sorts descending, so the
 * largest value takes the longest track and the distortion reinforces the
 * ranking instead of fighting it. That is a plate decision where it ought to be
 * a preset's.
 *
 * The cohort is used here rather than the sectors because a radial bar's label
 * has one place to go — a horizontal run at the twelve o'clock gap — and
 * "Philippines" fits there where "Textiles, garments, footwear and furniture"
 * does not.
 */
function DiversityTracks() {
  const rows = defined(
    crossSection(LATEST_YEAR).filter((d) => COHORT.includes(d.iso3)),
    'diversity',
  )
    .map((d) => ({ country: countryName(d.iso3), diversity: d.diversity }))
    .sort((a, b) => b.diversity - a.diversity);

  const max = Math.max(...rows.map((d) => d.diversity));
  const TRACK = 0.86 / rows.length;
  const radiusOf = (i: number) => 0.2 + (rows.length - 1 - i) * TRACK;

  const chart = glPolarChart({
    marks: [
      ...rows.flatMap((row, i) => {
        const inner = radiusOf(i);
        const outer = inner + TRACK * 0.68;
        return [
          // The track: how far the bar could have gone. Chrome, so c-muted-light.
          glRadialArc([row], {
            startAngle: () => 0,
            endAngle: () => Math.PI * 2,
            tone: 'muted',
            step: 'light',
            innerRadius: (ctx) => ctx.radius * inner,
            outerRadius: (ctx) => ctx.radius * outer,
          }),
          glRadialArc([row], {
            startAngle: () => 0,
            endAngle: () => (row.diversity / max) * Math.PI * 1.75,
            tone: 'c-1',
            innerRadius: (ctx) => ctx.radius * inner,
            outerRadius: (ctx) => ctx.radius * outer,
          }),
        ];
      }),
      glRadialLabel(
        rows.map((row, i) => ({ ...row, radius: radiusOf(i) + TRACK * 0.34 })),
        {
          angle: () => Math.PI * 1.97,
          radius: (d: { radius: number }) => d.radius,
          text: (d: { country: string; diversity: number }) => `${d.country} · ${d.diversity}`,
          anchor: 'end',
          baseline: 'middle',
        } as never,
      ),
    ],
    angle: { scale: scaleLinear().domain([0, Math.PI * 2]) as never, wrap: false },
    radius: { scale: scaleLinear().domain([0, 1]) as never },
    margin: { left: 96 },
  });

  return (
    <GLFigure
      title="Thailand exports more distinct products competitively than Korea does."
      subtitle={`Products exported with revealed comparative advantage, six Southeast Asian economies, ${LATEST_YEAR}`}
      source={PANEL}
    >
      <Chart {...chart.props} height={330} ariaLabel="Export diversity on concentric tracks" />
    </GLFigure>
  );
}
// #endregion

// #region demo:spec-24-rose
/**
 * Equal angles, variable radii, over Vietnam's twelve destination markets.
 *
 * A rose is a bar chart on a cyclic domain, and the arcs take the same
 * full-opacity fill a bar does — bending a mark round a centre does not change
 * what it is. `arcAngles` with a constant value gives the equal angles; the
 * radius is the magnitude.
 *
 * The radial grid is formatted back into dollars, which is the only thing that
 * makes the petals readable: the arcs are positioned by an `outerRadius`
 * callback in fractions of the layout radius, so without a formatted ring set
 * the reader has fractions and no scale.
 */
function DestinationRose() {
  const markets = defined(partnersIn(LATEST_YEAR), 'exportValueM');
  const max = Math.max(...markets.map((d) => d.exportValueM));

  const petals = arcAngles(markets, {
    key: (d) => d.partnerShort,
    value: () => 1,
    sort: false,
    tones: markets.map(() => 'c-1' as const),
  });

  const chart = glPolarChart({
    marks: petals.map((petal, i) =>
      glRadialArc([petal], {
        startAngle: () => petal.startAngle,
        endAngle: () => petal.endAngle,
        padAngle: () => 1,
        padRadius: 1,
        tone: 'c-1',
        innerRadius: 0,
        outerRadius: (ctx) => ctx.radius * (markets[i].exportValueM / max),
      }),
    ),
    guides: [
      // `labels: true` is not the default and has to be asked for — see the
      // recorded gap. The ring values are quarters of the largest petal,
      // formatted back into dollars, because the arcs are positioned by an
      // `outerRadius` callback in fractions of the layout radius and without a
      // formatted ring set the reader has fractions and no scale.
      glRadialGrid({
        values: [0.25, 0.5, 0.75, 1],
        labels: true,
        format: (v) => usd(Number(v) * max),
      }),
      // Half a step round, so the label sits on the petal rather than on the
      // seam between two of them.
      glAngleGrid({
        values: markets.map((_, i) => i + 0.5),
        format: (v) => markets[Math.floor(Number(v))]?.partnerShort ?? '',
      }),
    ],
    angle: { scale: scaleLinear().domain([0, markets.length]) as never, wrap: false },
    radius: { scale: scaleLinear().domain([0, 1]) as never },
    inset: 84,
  });

  return (
    <GLFigure
      title="Vietnam's two largest markets dwarf the other ten, and the rose exaggerates by how much."
      subtitle={`Exports to the twelve largest destination markets, ${LATEST_YEAR}; equal angles, radius is value`}
      source={PARTNERS}
    >
      <Chart {...chart.props} height={340} ariaLabel="Vietnam exports by destination, rose" />
    </GLFigure>
  );
}
// #endregion

// ════════════════════════════════════════════════════════════════════════════
// Cyclic forms on a panel that does not cycle
// ════════════════════════════════════════════════════════════════════════════

// #region demo:spec-23-polar-line
/**
 * A closed loop over the nine sectors, for the first and last year of the panel.
 *
 * The specimen this ports exists to show the case a Cartesian axis cannot draw:
 * a peak that straddles midnight, where only a polar layout puts hour 23 next to
 * hour 0. The Atlas has no such domain — no hour, no month, no bearing — so what
 * is drawn here is a categorical ring, and its join is a property of the drawing
 * rather than of the data. That is recorded in the gaps and not papered over.
 *
 * What the ring does buy, honestly, is the comparison: two years as two closed
 * paths on one set of spokes, and the shape rotates. The 1995 loop points at
 * food, fibre and fuel; the 2023 loop points at electronics.
 *
 * The spoke index comes from `sectorRank`, not from the row's position in the
 * array — a sector absent in one year would otherwise shift every spoke after it
 * and the two loops would be drawn on different axes.
 */
function SectorRing() {
  const loopFor = (year: number) => {
    const rows = defined(leadSectorsIn(year), 'exportValueM');
    const total = rows.reduce((sum, d) => sum + d.exportValueM, 0);
    const points = rows
      .map((d) => ({ spoke: sectorRank(d.sector), share: d.exportValueM / total }))
      .sort((a, b) => a.spoke - b.spoke);
    // Repeat the first vertex one full turn on, so the path closes. `radialLine`
    // joins points in data order and has no notion of a closed ring.
    return [...points, { spoke: SECTOR_ORDER.length, share: points[0].share }];
  };

  const first = loopFor(FIRST_YEAR);
  const last = loopFor(LATEST_YEAR);
  const ceiling = Math.max(...[...first, ...last].map((d) => d.share));

  const chart = glPolarChart({
    marks: [
      glRadialLine(first, { angle: 'spoke', radius: 'share', tone: 'muted' }),
      glRadialLine(last, { angle: 'spoke', radius: 'share', focus: true }),
    ],
    guides: [
      glRadialGrid({ ticks: 4, format: (v) => pct(Number(v)) }),
      glAngleGrid({
        values: SECTOR_ORDER.map((_, i) => i),
        format: (v) => SECTOR_ORDER[Number(v)] ?? '',
      }),
    ],
    angle: { scale: scaleLinear().domain([0, SECTOR_ORDER.length]) as never, wrap: false },
    radius: { scale: scaleLinear().domain([0, ceiling]) as never },
    inset: 96,
  });

  return (
    <GLFigure
      title="In 1995 the loop pointed at food and fibre; by 2023 it points at electronics."
      subtitle={`Share of classified exports by sector, ${FIRST_YEAR} and ${LATEST_YEAR}`}
      source={withNote(SECTORS, CLASSIFIED)}
      legend={
        <GLLegend
          items={[
            { label: `${LATEST_YEAR}`, tone: 'c-1', mark: 'line', focus: true },
            { label: `${FIRST_YEAR}`, tone: 'muted', mark: 'line' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={340} ariaLabel="Vietnam sector shares, 1995 and 2023" />
    </GLFigure>
  );
}
// #endregion

// #region demo:spec-25-wind-rose
/**
 * A polar scatter: every product Vietnam exports, on its sector's spoke, at the
 * radius the Atlas says it sits from Vietnam's current capabilities.
 *
 * This is the specimen that shows a radial dot is genuinely a scatter circle —
 * the 0.8 fill-and-stroke rule of §3.4 applies here exactly as it does on a
 * Cartesian plot, because these marks DO overlap and the darkening is the
 * density signal. With 1,199 products on nine spokes there is a great deal of
 * overlap to signal.
 *
 * The angle is the sector, not a bearing, and the points are not jittered. A
 * synthetic wind rose spreads its observations continuously round the circle;
 * spreading these would mean inventing an angular coordinate the Atlas does not
 * measure, so the plate accepts nine dense strips instead.
 */
function ProductDistanceScatter() {
  const rows = defined(leadProducts, 'distance').map((d) => ({
    ...d,
    spoke: sectorRank(d.sector),
  }));

  // The radial domain is the observed range, not [0, 1]. Every product in the
  // basket sits between roughly 0.55 and 0.88, so a zero-based radius would
  // leave the inner three-fifths of the plot empty and compress the whole
  // distribution into a rim.
  const near = Math.min(...rows.map((d) => d.distance));
  const far = Math.max(...rows.map((d) => d.distance));

  const chart = glPolarChart({
    marks: [glRadialDot(rows, { angle: 'spoke', radius: 'distance' })],
    guides: [
      glRadialGrid({ ticks: 4, format: (v) => Number(v).toFixed(2) }),
      glAngleGrid({
        values: SECTOR_ORDER.map((_, i) => i),
        format: (v) => SECTOR_ORDER[Number(v)] ?? '',
      }),
    ],
    angle: { scale: scaleLinear().domain([0, SECTOR_ORDER.length]) as never, wrap: false },
    radius: { scale: scaleLinear().domain([near, far]) as never },
    inset: 96,
  });

  return (
    <GLFigure
      title="Nothing in Vietnam's basket is close: every product sits in a narrow outer band."
      subtitle={`${rows.length} HS92 4-digit products, ${LATEST_YEAR}; radius is distance from Vietnam's current capabilities`}
      source={PRODUCTS}
    >
      <Chart {...chart.props} height={340} ariaLabel="Vietnam product distance by sector" />
    </GLFigure>
  );
}
// #endregion

// ════════════════════════════════════════════════════════════════════════════
// Gauges
// ════════════════════════════════════════════════════════════════════════════

// #region demo:spec-22-gauge
/**
 * One value against its range — Vietnam's complexity against the whole world's.
 *
 * A gauge is `arcAngles` over a PARTIAL turn, which is the reason that function
 * takes `startAngle` and `endAngle` rather than assuming a full circle. The
 * track is a muted arc across the full range; the value is a `c-1` arc drawn
 * over the same span.
 *
 * The range here is a real one and not a convention: the arc spans the lowest
 * and highest Economic Complexity Index in the 2023 cross-section, so the two
 * ends are two countries rather than two round numbers. That is what makes the
 * gauge worth drawing at all — a gauge whose range is 0 to 100 tells the reader
 * nothing they did not already have from the number.
 */
function ComplexityGauge() {
  const rows = defined(crossSection(LATEST_YEAR), 'eci');
  const ordered = [...rows].sort((a, b) => a.eci - b.eci);
  const low = ordered[0];
  const high = ordered[ordered.length - 1];
  const lead = rows.find((d) => d.iso3 === LEAD)!;
  const position = (lead.eci - low.eci) / (high.eci - low.eci);

  const START = -Math.PI * 0.62;
  const END = Math.PI * 0.62;

  const [track] = arcAngles([{ k: 'range', v: 1 }], {
    key: (d) => d.k,
    value: (d) => d.v,
    startAngle: START,
    endAngle: END,
    tones: ['muted'],
  });
  const [value] = arcAngles([{ k: countryName(LEAD), v: 1 }], {
    key: (d) => d.k,
    value: (d) => d.v,
    startAngle: START,
    endAngle: START + (END - START) * position,
  });

  const arc = (slice: typeof track, tone: 'muted' | 'c-1') =>
    glRadialArc([slice], {
      startAngle: () => slice.startAngle,
      endAngle: () => slice.endAngle,
      tone,
      step: tone === 'muted' ? 'light' : 'main',
      innerRadius: (ctx) => ctx.radius * 0.62,
      outerRadius: (ctx) => ctx.radius * 0.92,
    });

  // Quarter marks across the range, so the arc carries a scale rather than a
  // vibe. They are chrome — reference rules, dashed ink-3 — because nothing was
  // measured at a quarter of the range; the reader brought the division.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    angle: START + (END - START) * f,
    eci: low.eci + (high.eci - low.eci) * f,
  }));

  const chart = glPolarChart({
    marks: [
      arc(track, 'muted'),
      arc(value, 'c-1'),
      glRadialRule(ticks, {
        angle: (d: (typeof ticks)[number]) => d.angle,
        radius1: 0.62,
        radius2: 0.96,
      }),
      glRadialAnnotation(ticks, {
        angle: (d: (typeof ticks)[number]) => d.angle,
        radius: () => 1.04,
        text: (d: (typeof ticks)[number]) => index(d.eci),
        anchor: (d: (typeof ticks)[number]) =>
          Math.abs(Math.sin(d.angle)) < 0.1 ? 'middle' : Math.sin(d.angle) < 0 ? 'end' : 'start',
        baseline: 'middle',
      } as never),
      glRadialAnnotation([{ label: index(lead.eci) }], {
        angle: () => 0,
        radius: () => 0,
        text: (d: { label: string }) => d.label,
        anchor: 'middle',
        baseline: 'middle',
      } as never),
      glRadialAnnotation(
        [{ label: `${countryName(LEAD)} · ${rank(lead.eciRank)} of ${rows.length}` }],
        {
          angle: () => 0,
          radius: () => 0,
          text: (d: { label: string }) => d.label,
          anchor: 'middle',
          baseline: 'middle',
          dy: 18,
        } as never,
      ),
    ],
    angle: { scale: scaleLinear().domain([0, Math.PI * 2]) as never, wrap: false },
    radius: { scale: scaleLinear().domain([0, 1]) as never },
    inset: 40,
  });

  return (
    <GLFigure
      title="Vietnam sits seven-tenths of the way up the world's complexity range."
      subtitle={`Economic Complexity Index, ${LATEST_YEAR}; the arc spans ${countryName(low.iso3)} to ${countryName(high.iso3)} across ${rows.length} ranked economies`}
      source={PANEL}
    >
      <Chart {...chart.props} height={260} ariaLabel="Vietnam complexity against the world range" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-78-gauge
/**
 * The arc form of the gauge rather than the needle, and the one §3.8 prefers.
 *
 * The catalog has two gauges and they differ in exactly one thing: whether the
 * value is shown by a needle or by the arc itself. A filled arc encodes the
 * value as a LENGTH the reader can compare against the track; a needle encodes
 * it as an angle they have to estimate against ticks. `cornerRadius` rounds both
 * ends, which is the one decorative option the spec has not ruled on.
 *
 * The world's own share of the same sector is on the track as a reference mark,
 * which is what turns "34%" into a finding: it is two and a half times the world
 * average, and the gauge can say so without a second figure.
 */
function ElectronicsGauge() {
  const rows = defined(leadSectorsIn(LATEST_YEAR), 'exportValueM');
  const total = rows.reduce((sum, d) => sum + d.exportValueM, 0);
  const share = (rows.find((d) => d.sector === 'Electronics')?.exportValueM ?? 0) / total;

  const world = defined(
    worldSectorYear.filter((d) => d.year === LATEST_YEAR),
    'exportValueM',
  );
  const worldTotal = world.reduce((sum, d) => sum + d.exportValueM, 0);
  const worldShare =
    (world.find((d) => d.sector === 'Electronics')?.exportValueM ?? 0) / worldTotal;

  const START = -Math.PI * 0.62;
  const END = Math.PI * 0.62;
  const at = (fraction: number) => START + (END - START) * fraction;

  const arc = (fraction: number, tone: 'muted' | 'c-1') =>
    glRadialArc([{ fraction }], {
      startAngle: () => START,
      endAngle: () => at(fraction),
      tone,
      step: tone === 'muted' ? 'light' : 'main',
      cornerRadius: 4,
      innerRadius: (ctx) => ctx.radius * 0.6,
      outerRadius: (ctx) => ctx.radius * 0.86,
    });

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ angle: at(f), share: f }));

  const chart = glPolarChart({
    marks: [
      arc(1, 'muted'),
      arc(share, 'c-1'),
      glRadialRule(ticks, {
        angle: (d: (typeof ticks)[number]) => d.angle,
        radius1: 0.6,
        radius2: 0.9,
      }),
      glRadialAnnotation(ticks, {
        angle: (d: (typeof ticks)[number]) => d.angle,
        radius: () => 1.02,
        text: (d: (typeof ticks)[number]) => pct(d.share),
        anchor: (d: (typeof ticks)[number]) =>
          Math.abs(Math.sin(d.angle)) < 0.1 ? 'middle' : Math.sin(d.angle) < 0 ? 'end' : 'start',
        baseline: 'middle',
      } as never),
      // The world's share, as a reference on the same track. §3.4.2 keeps it
      // chrome: nothing about Vietnam was measured there.
      glRadialRule([{ angle: at(worldShare) }], {
        angle: (d: { angle: number }) => d.angle,
        radius1: 0.56,
        radius2: 0.9,
      }),
      glRadialAnnotation([{ label: `World ${pct(worldShare)}`, angle: at(worldShare) }], {
        angle: (d: { angle: number }) => d.angle,
        radius: () => 0.44,
        text: (d: { label: string }) => d.label,
        anchor: 'middle',
        baseline: 'middle',
      } as never),
      glRadialAnnotation([{ label: pct(share) }], {
        angle: () => 0,
        radius: () => 0,
        text: (d: { label: string }) => d.label,
        anchor: 'middle',
        baseline: 'middle',
      } as never),
      glRadialAnnotation([{ label: 'of exports are electronics' }], {
        angle: () => 0,
        radius: () => 0,
        text: (d: { label: string }) => d.label,
        anchor: 'middle',
        baseline: 'middle',
        dy: 18,
      } as never),
    ],
    angle: { scale: scaleLinear().domain([0, Math.PI * 2]) as never, wrap: false },
    radius: { scale: scaleLinear().domain([0, 1]) as never },
    inset: 40,
  });

  return (
    <GLFigure
      title="Electronics is a third of Vietnam's basket and a seventh of the world's."
      subtitle={`Electronics as a share of classified export value, ${LATEST_YEAR}`}
      source={withNote(`${SECTORS} ${WORLD}`, CLASSIFIED)}
    >
      <Chart {...chart.props} height={260} ariaLabel="Electronics share of Vietnam's exports" />
    </GLFigure>
  );
}
// #endregion

// ════════════════════════════════════════════════════════════════════════════
// Radar
// ════════════════════════════════════════════════════════════════════════════

/**
 * The six Atlas variables a capability profile is built from, with the names
 * short enough to fit a radar's label gutter.
 *
 * Shared by the two radar demos because they have to agree: a comparative radar
 * whose spokes are in a different order from the single-profile radar above it
 * is two charts that cannot be read against each other.
 */
const RADAR_DIMENSIONS = [
  { key: 'eci', label: 'Complexity' },
  { key: 'coi', label: 'Opportunity' },
  { key: 'diversity', label: 'Diversity' },
  { key: 'gdpPerCapita', label: 'Income' },
  { key: 'exportValueM', label: 'Export size' },
  { key: 'growthProjection', label: 'Growth' },
] as const;

type RadarKey = (typeof RADAR_DIMENSIONS)[number]['key'];

// #region demo:ts-75-radar
/**
 * One economy across six dimensions, every dimension on one normalized scale.
 *
 * The normalization is the whole problem and it is a data problem, not a library
 * one. A radar's read is the shape of the polygon, so every spoke has to be on
 * the SAME scale — and the Atlas gives these six in six units: an index that runs
 * negative, a count of products, dollars per head, millions of dollars, a
 * projected growth rate. Nothing about them is commensurable.
 *
 * Percentile rank inside the 2023 cross-section is the one normalization that
 * does not smuggle in a judgment: it says "this share of the economies the Atlas
 * ranks sit below Vietnam on this variable", which is a claim about the data
 * rather than about how many dollars a point of ECI is worth. `max: 1` then pins
 * the outer ring at the top of the scale by construction rather than at whatever
 * the largest observation happened to be.
 */
function CapabilityProfile() {
  const rows = crossSection(LATEST_YEAR);

  /** Share of ranked economies sitting below this one on a variable. */
  const percentile = (key: RadarKey, iso3: string): number | null => {
    const values = defined(rows, key)
      .map((d) => d[key])
      .sort((a, b) => a - b);
    const mine = rows.find((d) => d.iso3 === iso3)?.[key];
    if (mine == null || values.length < 2) return null;
    return values.filter((v) => v < mine).length / (values.length - 1);
  };

  const profile = RADAR_DIMENSIONS.map((d) => ({
    dimension: d.label as string,
    value: percentile(d.key, LEAD),
  })).filter((d): d is { dimension: string; value: number } => d.value != null);

  const chart = glRadarChart(profile, {
    dimension: 'dimension',
    value: 'value',
    max: 1,
    format: (v) => pct(v),
  });

  return (
    <GLFigure
      title="Vietnam is near the top of the world on opportunity and growth, and below its middle on income."
      subtitle={`Percentile rank among the ${rows.length} economies the Atlas ranks, ${LATEST_YEAR}`}
      source={PANEL}
      // A radar polygon is a fill AND a stroke (§3.4), so `band` — a pale square
      // with a dark border — is its miniature. A solid square would claim an
      // opacity the polygon does not have.
      legendPlacement="right"
      legend={<GLLegend items={[{ label: countryName(LEAD), tone: 'c-1', mark: 'polygon' }]} />}
    >
      <Chart {...chart.props} height={330} ariaLabel="Vietnam capability profile" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-99-comparative-radar
/**
 * The same profile against its neighbours, and the pop-up effect in radar form.
 *
 * §11 states this outright for this chart type: the comparison is painted
 * `c-muted` and stacked UNDER the focus polygon, because the second series is a
 * *peer* and not a co-finding. It is the one place the radar and distribution
 * rules depart from `FOCUS_TONES`, where a second highlighted series would take
 * `c-2`.
 *
 * The peer is the median of the five other economies in the Atlas cohort, taken
 * spoke by spoke. A median of percentiles is not any one country's profile and
 * the legend says so — it is the shape a typical neighbour would have, which is
 * the comparison worth drawing when the question is whether Vietnam is unusual.
 */
function CapabilityAgainstPeers() {
  const rows = crossSection(LATEST_YEAR);
  const peers = COHORT.filter((iso3) => iso3 !== LEAD);

  const percentile = (key: RadarKey, iso3: string): number | null => {
    const values = defined(rows, key)
      .map((d) => d[key])
      .sort((a, b) => a - b);
    const mine = rows.find((d) => d.iso3 === iso3)?.[key];
    if (mine == null || values.length < 2) return null;
    return values.filter((v) => v < mine).length / (values.length - 1);
  };

  const median = (values: number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = sorted.length >> 1;
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };

  const PEER_LABEL = `Median of ${peers.length} regional peers`;
  const profile = RADAR_DIMENSIONS.flatMap((d) => {
    const mine = percentile(d.key, LEAD);
    const theirs = peers
      .map((iso3) => percentile(d.key, iso3))
      .filter((v): v is number => v != null);
    return mine == null || !theirs.length
      ? []
      : [
          { dimension: d.label, country: countryName(LEAD), value: mine },
          { dimension: d.label, country: PEER_LABEL, value: median(theirs) },
        ];
  });

  const chart = glRadarChart(profile, {
    dimension: 'dimension',
    value: 'value',
    series: 'country',
    focus: countryName(LEAD),
    max: 1,
    format: (v) => pct(v),
  });

  return (
    <GLFigure
      title="Vietnam beats its neighbours on four of six, and trails on the two that take longest to change."
      subtitle={`Percentile rank among the ${rows.length} ranked economies, ${LATEST_YEAR}; peers are the other five Southeast Asian economies`}
      source={PANEL}
      legendPlacement="right"
      legend={
        <GLLegend
          items={[
            { label: countryName(LEAD), tone: 'c-1', mark: 'polygon' },
            { label: PEER_LABEL, tone: 'muted', mark: 'polygon' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={330} ariaLabel="Vietnam capability profile against peers" />
    </GLFigure>
  );
}
// #endregion

// ════════════════════════════════════════════════════════════════════════════

const NO_CYCLE =
  'The Atlas has no cyclic domain — no month, no hour, no compass bearing — so the wrapping this ' +
  'form exists to demonstrate has nothing honest to demonstrate on. The ring here is categorical ' +
  'and its join is a property of the drawing, not of the data. Recorded rather than faked with a ' +
  'synthetic period column.';

const ANGLE_GRID_LABELS =
  '`glAngleGrid` places one label per spoke with no collision test and no fit test, and `polar` ' +
  'reserves the gutter with a single `inset` for the whole ring — so the gutter has to be sized ' +
  'by the longest label whether or not that label points sideways. A Cartesian chart grows its ' +
  'left margin until the ticks fit; a polar chart cannot.';

const demos: Demo[] = [
  {
    id: 'spec-21-donut',
    family: 'Polar and Radar',
    name: 'Donut with the total in the hole',
    question: 'What does Vietnam actually sell, and how much of it?',
    rule: '§3.8 — at most four slices, directly labelled, each label in its own dark tone.',
    render: ExportBasketDonut,
    gaps: [
      'The direct labels are Atlas sector names: "Textiles, garments, footwear and furniture · 21%" is a 47-character run placed at the arc mid-angle with no fit test. §3.8 asks for direct labels over a legend and `glDonutChart` obliges, but nothing measures whether the label clears the figure — `estimateTextWidth` is private to `shapes/treemap.ts`, the same gap the labelled heatmap and the sunburst record.',
      'Which sectors are named and which are folded is a decision the demo makes and the library cannot see. `glDonutChart` warns past four slices but has no "cap at four and fold the tail" option, so every caller writes the same four lines of grouping arithmetic and each one is free to get the residual label wrong.',
    ],
  },
  {
    id: 'ts-76-pie',
    family: 'Polar and Radar',
    name: 'Pie',
    question: 'Where do Vietnam’s exports go?',
    rule: '§3.8 — the donut is the default; a pie has to be asked for.',
    render: DestinationPie,
    gaps: [
      'The whole is exports to the twelve largest destination markets, not exports — that is all the Atlas partner extract carries, and those twelve are 75% of the total. The denominator is stated in the subtitle because the circle cannot state it; a part-to-whole whose whole is a subset is only honest if the figure says which subset.',
    ],
  },
  {
    id: 'ts-77-donut',
    family: 'Polar and Radar',
    name: 'Donut',
    question: 'Where do Vietnam’s exports go, and how much is that in dollars?',
    rule: '§3.8 — the hole costs nothing and removes the least readable part of a pie.',
    render: DestinationDonut,
    gaps: [
      'Same partial denominator as the pie above: the twelve largest markets, and the hole holds their total rather than Vietnam’s.',
    ],
  },
  {
    id: 'ts-93-labeled-pie',
    family: 'Polar and Radar',
    name: 'Seven slices — the case §3.8 refuses',
    question: 'What happens when a nine-sector basket is drawn without a residual?',
    rule: '§3.8 — past four slices, comparing angles stops being safe.',
    render: SevenSectors,
    gaps: [
      'This plate deliberately BREAKS the four-slice cap so the enforcement is visible: `glDonutChart` warns and draws anyway, which is the right behaviour — refusing would leave a caller with an exception and no way to see their data — but it is invisible unless something exercises it. The warning text is "A donut holds at most 4 slices; 7 were passed (SPEC.md §3.8) … Group the tail into \'Everything else\', or switch form." The three smallest slices\' labels are what the rule is arguing about, and they are on the plate.',
      'The real data makes the case harder than the synthetic seven did. Vietnam’s three smallest slices are 5.8%, 5.2% and a 4.6% residual — wedges of 21, 19 and 17 degrees — and each carries a direct label two to four times longer than its wedge is wide. Nobody compares those angles; they read the percentages, which is a ranked bar chart with extra steps.',
    ],
  },
  {
    id: 'ts-95-rounded-donut',
    family: 'Polar and Radar',
    name: 'Donut with rounded arc ends',
    question: 'Is the world’s export basket as concentrated as Vietnam’s?',
    rule: 'The spec rules on fill, opacity, gap and slice count — and not on corners.',
    render: WorldBasketRounded,
    gaps: [
      'Rounding costs the even gap: a rounded arc no longer meets its neighbour, so the 1px paper gap of §3.8 reads wider at the ends of each arc than in the middle. `cornerRadius` and `padAngle` are independent options and nothing reconciles them.',
      'The four slices are close in size here — 16%, 15%, 14% and 55% — which is the case a donut is worst at, and rounding makes it worse by shortening every arc by the same absolute amount regardless of its length.',
    ],
  },
  {
    id: 'ts-96-nested-donut',
    family: 'Polar and Radar',
    name: 'Nested donut',
    question: 'Which products carry the sectors Vietnam’s basket is built on?',
    rule: '§8b — a child takes its PARENT’s hue at the light step, not a hue of its own.',
    render: NestedBasket,
    gaps: [
      'Only the inner ring is labelled, and it is labelled in the outer gutter rather than on the arc. An Atlas sector name is forty characters and the widest arc is a third of a turn, so nothing fits inside; product names on the outer ring are longer still and there is no second gutter to put them in. `glLabelInkOn` exists for in-tile labels and the treemap uses it — here there is no tile wide enough to earn it.',
      'The two-level fold (three sectors named, three products per branch) is arithmetic the demo does and the library cannot check. A nested donut whose rings do not sum is unreadable in a way that looks like a rendering bug, and nothing in `glRadialArc` would notice.',
    ],
  },
  {
    id: 'ts-101-sunburst',
    family: 'Polar and Radar',
    name: 'Sunburst',
    question: 'How deep can a decomposition of Vietnam’s exports usefully go?',
    rule: '§3.8 — the angular cap applies outward too; depth carries the lightness.',
    render: BasketSunburst,
    gaps: [
      'Labels stop at depth 1. A label that does not fit has to be dropped, and unlike the treemap nothing here can measure whether it fits — `estimateTextWidth` is private to `shapes/treemap.ts`, and an arc needs a harder test than a rectangle anyway (the available width varies along the arc). The same private-fit-routine gap the labelled heatmap records.',
      'Read against `ts-74-treemap`, which draws the identical hierarchy and labels ten tiles where this labels four. That is the honest comparison and the reason §9 makes the treemap the spec’s composition chart.',
      'Depth cannot carry the lightness past two levels. A tone triple has three steps and `dark` is reserved for text and for strokes on overlapping marks, so rings two and three both take `light` and are separated by the paper gap alone. A four-level hierarchy has nowhere left to go.',
      'The Atlas extract is two levels deep — sector and HS92 4-digit product — so the middle ring is the 2-digit chapter taken from the product code’s own prefix. That is a real property of the classification and not an invented column, but the extract carries no chapter name, so the ring can only be numbered ("HS 85"). It also exposes a genuine quirk: the Atlas sector "Electronics" is exactly HS chapter 85, so that branch’s middle ring is a single arc that repeats its parent and carries no information at all.',
    ],
  },
  {
    id: 'ts-100-radial-bars',
    family: 'Polar and Radar',
    name: 'Concentric radial bars',
    question: 'How many products does each Southeast Asian economy export competitively?',
    rule: '§3.8 — bending bars round a centre costs them their common baseline.',
    render: DiversityTracks,
    gaps: [
      'The form is systematically distorting and the library cannot fix it: outer tracks are physically longer at equal value, so whatever is drawn outermost is overstated. The plate answers it the only way available — it sorts descending so the distortion reinforces the ranking instead of fighting it — and that is a plate decision where it should be a preset’s. A `glRadialBarChart` that sorted by construction, the way `glDonutChart` caps slices by construction, is the missing piece.',
      'The labels are country names because nothing longer fits. A radial bar’s label has exactly one place to go — a horizontal run at the gap in the track — so this form silently rules out every Atlas dimension whose members have long names, which is most of them. The left margin is widened by hand to make even eleven characters clear; there is no `inset`-style gutter that grows with the labels.',
    ],
  },
  {
    id: 'spec-24-rose',
    family: 'Polar and Radar',
    name: 'Rose',
    question: 'How lopsided is Vietnam’s set of destination markets?',
    rule: '§3.8 — equal angles, variable radii; arcs are single-layer like bars.',
    render: DestinationRose,
    gaps: [
      NO_CYCLE,
      'Radius is the encoding and area is what the eye reads, so a rose squares its own distortion: the United States is 14× Mexico by value and its petal is roughly 200× the area. Bending a bar chart round a centre costs the common baseline; making the radius the value costs linearity as well. Nothing in `glRadialArc` warns about it, and a square-root radius would be the fix — which is a decision `grammar.md` has not made.',
      ANGLE_GRID_LABELS +
        ' Here the labels are destination names and "United States of America" is 24 characters on a spoke 30° from its neighbours.',
      'A rose cannot carry a residual: an "everything else" petal would need a magnitude and there is no meaningful angle to give it. So the twelve largest markets are drawn and the remaining 25% of Vietnam’s exports are named in the subtitle instead. Where a donut can fold a tail, a rose can only omit it and say so.',
    ],
  },
  {
    id: 'spec-23-polar-line',
    family: 'Polar and Radar',
    name: 'Polar line over a closed ring',
    question: 'How far has the shape of Vietnam’s export basket rotated since 1995?',
    rule: '§3.8 — wrapping is the point: December sits next to January.',
    render: SectorRing,
    gaps: [
      NO_CYCLE +
        ' Electronics sits next to Textiles here only because the HS92 sector list orders them that way, and the segment joining them means nothing.',
      ANGLE_GRID_LABELS +
        ' Here the labels are full sector names — "Textiles, garments, footwear and furniture" is 41 characters on a spoke 40° from its neighbour — and the figure is illegible for that reason. Shortening them in the demo would hide the gap; the Atlas has no shorter form of these names to offer.',
      'The ring has to be closed by hand: the first vertex is repeated one full turn on, because `glRadialLine` joins points in data order and has no notion of a closed path. `glRadarChart` already does exactly this internally (`closeRing`), and it is private — so every polar line outside the radar preset re-implements it, and any that forgets draws a loop with a bite out of it.',
    ],
  },
  {
    id: 'spec-25-wind-rose',
    family: 'Polar and Radar',
    name: 'Polar scatter',
    question: 'Which sectors hold the products Vietnam is closest to making?',
    rule: '§3.4 — a radial dot is a scatter circle: the 0.8 overlap rule applies.',
    render: ProductDistanceScatter,
    gaps: [
      'The angle is a sector, not a bearing, and the points are NOT jittered — so 1,199 products land on nine exact spokes and the plate is nine dense strips rather than a cloud. The synthetic wind rose spread its observations continuously round the circle; doing that here would mean inventing an angular coordinate the Atlas does not measure. The 0.8 overlap rule is exercised hard by the collapse, which is the one thing the reframing improves.',
      'Vietnam’s whole basket sits between 0.55 and 0.88 on the distance scale, so the radial domain is the observed range rather than [0, 1] and the plot has no meaningful centre. A polar scatter reads radius as magnitude from a centre; when the centre is an arbitrary floor the form is making a claim the data does not support.',
      ANGLE_GRID_LABELS + ' Nine full sector names, same as the polar line.',
    ],
  },
  {
    id: 'spec-22-gauge',
    family: 'Polar and Radar',
    name: 'Gauge — one value against its range',
    question: 'How complex is Vietnam’s economy, measured against every economy the Atlas ranks?',
    rule: '§3.8 — a partial angular range; the arc carries the range.',
    render: ComplexityGauge,
    gaps: [
      '`arcAngles` is doing almost nothing here and the plate shows why. A gauge has one value, not a part-to-whole, so both calls pass a dummy value of 1 and the caller computes the angle anyway; what the helper contributes is a tone and a `GLSlice` shape. A `glGaugeChart(value, [low, high])` that drew track, fill, quarter ticks and centre text is the missing preset — the forty lines below are what every gauge will otherwise repeat, and the quarter ticks are the part most callers will skip.',
      'The tick spokes are drawn with `glRadialRule` in its reference form, which is dashed `ink-3` per §3.4.2. At a length of a third of the radius the dash pattern reads as a solid stub — correct by the rule and wrong to the eye, and there is no "tick" role in the marks table between `rule` and `stem`.',
    ],
  },
  {
    id: 'ts-78-gauge',
    family: 'Polar and Radar',
    name: 'Gauge — the arc form',
    question: 'How concentrated is Vietnam’s basket in one sector, against the world’s?',
    rule: '§3.8 — a filled arc is a LENGTH against a track; a needle is an angle.',
    render: ElectronicsGauge,
    gaps: [
      'Same missing preset as `spec-22-gauge`: the track, the fill, the ticks and the centre text are four separate compositions and every gauge rebuilds them.',
      'The world reference mark is a `glRadialRule` with a label placed inside the arc, and nothing keeps that label off the value arc when the two shares are close. Vietnam at 34% and the world at 14% happen to clear each other; a country whose share sat near the world’s would collide, and the demo would have to move the label by hand — which is the styling this page is not allowed to do.',
      'The source line concatenates two `sourceOf` calls because the figure reads two tables with different scopes, and `sourceOf` merges metadata into ONE line only when the tables share a classification and span. Two sentences of provenance is the honest output and it is ugly; a `sourceOf` that grouped by scope would fix it.',
    ],
  },
  {
    id: 'ts-75-radar',
    family: 'Polar and Radar',
    name: 'Radar — one profile',
    question: 'What kind of economy is Vietnam, across six Atlas measures at once?',
    rule: '§3.8 — every dimension on ONE normalized scale, or the shape means nothing.',
    render: CapabilityProfile,
    gaps: [
      'The spokes are percentile ranks, not the Atlas variables. Six variables in six units cannot share a radial scale, and percentile is the only normalization available that does not smuggle in an exchange rate between them — but it flattens distance. Vietnam’s income percentile of 38 and Korea’s of 83 are $4,300 and $35,700, and no polygon can say so.',
      'The dimension names had to be shortened to one word each: "Economic Complexity Index" does not fit the label gutter and "Complexity" does. That gutter is `DEFAULT_LABEL_GUTTER`, a raw 64 in `shapes/radar.ts` with no `tokens.json` entry — the module records the token request itself. Every Atlas variable has a long official name and none of them fit.',
    ],
  },
  {
    id: 'ts-99-comparative-radar',
    family: 'Polar and Radar',
    name: 'Comparative radar',
    question: 'Is Vietnam unusual among its neighbours, or typical of them?',
    rule: '§11 — the second series is a PEER (c-muted, stacked under), not a co-finding.',
    render: CapabilityAgainstPeers,
    gaps: [
      'The peer is a median of five percentile ranks, which is nobody’s profile. It is the right comparison for the question and it is a derived series the figure has to explain in a legend, because the polygon cannot: a reader who takes the muted shape for a country will read it wrong, and §3.11 gives a radar no way to label a series on the plot.',
      'Same percentile-rank normalization and the same shortened dimension names as `ts-75-radar`, for the same reasons.',
      'Two polygons is the limit and the library enforces it — `glRadarChart` warns past two entities and drops the rest, recommending small multiples. Six cohort economies would be the more interesting figure and this form cannot draw it.',
    ],
  },
];

export const polarFamily: Family = {
  slug: 'polar-and-radar',
  title: 'Polar and Radar',
  blurb:
    'Angle, radius and the forms built on them. Nothing in the Atlas repeats on a cycle, so the ring is always a set of categories — and since a circle can only carry a few slices honestly, the real work in every part-to-whole here is choosing what goes in the remainder.',
  demos,
};

export function renderPolar(): Record<string, () => ReactNode> {
  return Object.fromEntries(demos.map((d) => [d.id, d.render]));
}
