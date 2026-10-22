/**
 * Interactive — sixteen catalog forms, drawn at rest on real Atlas data.
 *
 * This is the family where the honest answer takes the most explaining, and the
 * explanation is the same one the gallery gives: **the interaction itself is not
 * built and cannot be.** TanStack 0.6.5 exports no interaction API at all — its
 * published docs already use `crosshair()` and `createChartCursor`, neither of
 * which is in `dist/` — and `grammar.md` is silent on the whole layer: no hover
 * state, no tooltip type scale, no focus ring, no rule for a selected mark.
 *
 * So every demo below draws the **resting state** on-spec, plus the *static*
 * half of the interaction, which §3.4.2 and §3.9 already rule on:
 *
 *   - a pointer, crosshair or playhead is a **reference rule** — dashed `ink-3`,
 *     ignoring `tone`, because nothing was measured there;
 *   - a brushed, retained or focused window is a **band** — the light tone at
 *     full opacity, so it survives greyscale;
 *   - a selected mark is the **pop-up effect** — `c-1` against `c-muted`.
 *
 * Nothing here needed a new rule, which is the finding: what is missing is the
 * event plumbing, not the design language.
 *
 * What the real data adds on top of that, and what the synthetic specimens could
 * not show:
 *
 * 1. **The Atlas is annual, so half this family loses a dimension.** Zoom,
 *    streaming and playback were all authored against a 420-day series. There is
 *    no daily anything in the Atlas, so `timeAxisFor` and `dateTicks` are unused
 *    below and `yearAxisFor` stands in. The one piece that survives intact is the
 *    part the zoom demo is actually about — a zoomed axis *does* relabel itself,
 *    from five-year steps to every year — and the part that does not survive
 *    (months stepping down to days) is recorded rather than faked.
 *
 * 2. **A grouped read collides.** The synthetic five-series dataset was spread
 *    evenly; six real economies are not. Vietnam and Indonesia sat one hundredth
 *    of an index point apart in 2010, and the two labels a grouped tooltip would
 *    place there land on top of each other.
 *
 * 3. **Lanes turned out to be an Atlas form.** The synthetic lane chart was a
 *    programme Gantt with invented phases. Vietnam's twelve largest products each
 *    cross into revealed comparative advantage at a different date and hold
 *    different tiers of it afterwards, which is a lane chart with an ordered
 *    phase — exactly what §8c's three-tone ramp is for, and not invented at all.
 *
 * Contract, unchanged: no hex, no font size, no stroke width, no opacity below.
 * Data preparation is authored; appearance never is.
 */

import type { ReactNode } from 'react';
import { Chart } from '@tanstack/react-charts';
import { geoIdentity } from 'd3-geo';

import {
  endLabels,
  glAxisBand,
  glAxisLog,
  glAxisYear,
  glAxisX,
  glAxisY,
  glBand,
  glBarX,
  glChart,
  glLabel,
  glLine,
  glMutedBarX,
  glMutedLine,
  glMutedPoint,
  glPoint,
  glRuleX,
  glRuleY,
  glSequentialColor,
  glTickY,
  popUp,
  toSeries,
  toneRamp,
  yearAxisFor,
} from '../src/index.js';
import { glGeoShape, glVoronoiCells, glVoronoiFeatures } from '../src/shapes.js';
import { GLFigure, GLLegend, GLRampLegend } from '../src/figure.js';

import {
  COHORT,
  FIRST_YEAR,
  LATEST_YEAR,
  LEAD,
  countriesTable,
  country,
  countryName,
  countrySectorYear,
  countrySectorYearTable,
  countryYear,
  countryYearTable,
  crossSection,
  defined,
  index,
  leadPartners,
  leadPartnersTable,
  leadProductPanel,
  leadProductPanelTable,
  leadProducts,
  leadProductYearTable,
  leadSectorsIn,
  pct,
  seriesFor,
  sourceOf,
  usd,
  withNote,
  worldSectorYear,
  worldSectorYearTable,
} from './atlas-data.js';
import type { Demo, Family } from './demo.js';

const PANEL = sourceOf(countryYearTable);
const CATALOG = sourceOf(countryYearTable, countriesTable);
const SECTORS = sourceOf(countrySectorYearTable);
const WORLD_SECTORS = sourceOf(countrySectorYearTable, worldSectorYearTable);
const PRODUCTS = sourceOf(leadProductYearTable);
const PRODUCT_PANEL = sourceOf(leadProductPanelTable);
const PARTNERS = sourceOf(leadPartnersTable);

const VIETNAM = countryName(LEAD);

// ════════════════════════════════════════════════════════════════════════════
// Pointers and tooltips
// ════════════════════════════════════════════════════════════════════════════

// #region demo:ts-34-pointer-tooltip
/**
 * The single-point selection, at rest.
 *
 * The pointer is a `glRuleX`: dashed `ink-3`, and it **ignores `tone`** outright.
 * That is §3.4.2 doing real work rather than being stated — a pointer painted
 * `c-1` would spend the institutional blue on something that is not a finding,
 * and the reader would have to work out why this blue line means something
 * different from the blue series it crosses.
 *
 * What a tooltip would *say* is drawn as a `glLabel` with the paper halo,
 * because a tooltip's own surface, padding, type scale and connector are
 * unruled. That substitution is the largest hole this whole exercise found in
 * `grammar.md`, and it is recorded rather than filled.
 */
function PointerAtOneYear() {
  const AT = 2009;
  const rows = defined(seriesFor(LEAD), 'exportValueM');
  const at = rows.filter((d) => d.year === AT);

  const chart = glChart({
    marks: [
      glRuleX([AT], { x: (d: number) => d }),
      glLine(rows, { x: 'year', y: 'exportValueM', focus: true }),
      glPoint(at, { x: 'year', y: 'exportValueM' }),
      glLabel(at, {
        x: 'year',
        y: 'exportValueM',
        text: (d) => `${d.year} · ${usd(d.exportValueM)}`,
        anchor: 'end',
        dx: -10,
        dy: -8,
      }),
    ],
    x: yearAxisFor(rows, 'year'),
    y: glAxisY({ label: 'Total exports ($m)' }),
    variant: { labelHalo: true },
  });

  return (
    <GLFigure
      title="Vietnam's exports have fallen in only three years since 1995, and 2009 was the deepest."
      subtitle={`Total goods exports, millions of current USD, ${FIRST_YEAR}–${LATEST_YEAR}; the pointer rests on ${AT}`}
      source={PANEL}
    >
      <Chart {...chart.props} height={230} ariaLabel="Vietnam total exports with a pointer at 2009" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-35-grouped-tooltip
/**
 * One x position, every series at once.
 *
 * The grouped read is what a vertical rule is *for*: it names a shared x, and the
 * marks it crosses are the group. Each value takes a direct label in its own
 * series' DARK tone, which is Decision Rule 2 — text tied to a coloured mark
 * never takes that mark's main tone, which fails WCAG AA against paper.
 *
 * Tones are assigned through the series list rather than by cohort position.
 * `toSeries` spends its tone array in order of **first appearance in the rows**,
 * and `countryYear` is sorted by ISO3, so indexing the array by cohort rank hands
 * Vietnam's hue to Indonesia. Naming the tone from the key cannot get that wrong.
 */
function GroupedReadAtOneYear() {
  const AT = 2010;
  const rows = defined(
    countryYear.filter((d) => COHORT.includes(d.iso3)),
    'eci',
  ).map((d) => ({ ...d, country: countryName(d.iso3) }));

  const highlight = [VIETNAM, countryName('IDN')];
  const { backdrop, focus } = popUp(rows, { by: 'country', highlight });
  const toneFor = (name: string) =>
    name === highlight[0] ? ('c-1' as const) : name === highlight[1] ? ('c-2' as const) : ('muted' as const);
  const labelled = toSeries(rows, 'country').map((s) => ({ ...s, tone: toneFor(s.key) }));

  const at = rows.filter((d) => d.year === AT);

  const chart = glChart({
    marks: [
      glRuleX([AT], { x: (d: number) => d }),
      glMutedLine(backdrop, { x: 'year', y: 'eci', z: 'country' }),
      ...focus.map((s) =>
        glLine(s.rows, { x: 'year', y: 'eci', z: 'country', tone: s.tone, focus: true }),
      ),
      glPoint(at, { x: 'year', y: 'eci', tone: 'muted' }),
      ...labelled.map((s) =>
        glLabel(
          at.filter((d) => d.country === s.key),
          {
            x: 'year',
            y: 'eci',
            text: (d) => `${s.key} ${index(d.eci)}`,
            tone: s.tone,
            anchor: 'start',
            dx: 10,
          },
        ),
      ),
    ],
    x: yearAxisFor(rows, 'year'),
    y: glAxisY({ label: 'Economic Complexity Index' }),
    variant: { labelHalo: true },
    margin: { right: 40 },
  });

  return (
    <GLFigure
      title="Read across 2010 and Vietnam and Indonesia are the same economy."
      subtitle={`Economic Complexity Index, six Southeast Asian economies, with all six values at ${AT}`}
      source={PANEL}
    >
      <Chart {...chart.props} height={260} ariaLabel="Cohort complexity, grouped read at 2010" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-80-echarts-axis-pointer
/**
 * The pointer snapped to a datum, labelling its own axis position.
 *
 * Snapping is an interaction property and a chart at rest cannot show it, so what
 * this demo contributes is the axis-side half: the pointer carries its own value
 * among the ordinary ticks. §3.5 makes that an axis tick that happens to be
 * placed by the pointer, so it takes axis ink and needs no new rule.
 *
 * The tick set is pinned by hand rather than generated, because the whole point
 * is that one of the ticks is not a round number the generator would have chosen.
 * 1995 / 2002 / **2009** / 2016 / 2023 happens to be evenly spaced, which is luck
 * rather than design — a pointer at 2011 would sit between two ticks and the axis
 * would look exactly as it should.
 *
 * Log y: the cohort spans 82bn (Philippines) to 644bn (Korea) in 2023 and eight
 * times that range over the period. A linear axis would put four of the six
 * series in the bottom fifth of the plot.
 */
function AxisPointer() {
  const AT = 2009;
  const rows = defined(
    countryYear.filter((d) => COHORT.includes(d.iso3)),
    'exportValueM',
  ).map((d) => ({ ...d, country: countryName(d.iso3) }));

  const { backdrop, focus } = popUp(rows, { by: 'country', highlight: [VIETNAM] });
  const at = rows.filter((d) => d.year === AT && d.iso3 === LEAD);

  const chart = glChart({
    marks: [
      glRuleX([AT], { x: (d: number) => d }),
      glMutedLine(backdrop, { x: 'year', y: 'exportValueM', z: 'country' }),
      ...focus.map((s) =>
        glLine(s.rows, { x: 'year', y: 'exportValueM', z: 'country', tone: s.tone, focus: true }),
      ),
      glPoint(at, { x: 'year', y: 'exportValueM' }),
    ],
    // The pointer's own year is labelled on the axis alongside the ordinary
    // ticks, which is what "axis pointer" means and needs no new ink.
    //
    // `glAxisYear`, not `yearAxisFor`: the latter derives its ticks from the
    // data and refuses a `values` override by type, which is right for every
    // other demo in this file — the point of a pinned tick set here is that one
    // of the ticks is NOT a year the generator would have chosen.
    x: glAxisYear({ values: [FIRST_YEAR, 2002, AT, 2016, LATEST_YEAR] }),
    y: glAxisLog({ label: 'Total exports ($m)', grid: true }),
  });

  return (
    <GLFigure
      title="2009 and 2023 are the only years every economy in the cohort exported less than the year before."
      subtitle={`Total goods exports, six Southeast Asian economies, ${FIRST_YEAR}–${LATEST_YEAR}; the pointer is snapped to ${AT}`}
      source={PANEL}
    >
      <Chart {...chart.props} height={250} ariaLabel="Cohort exports with an axis pointer at 2009" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-88-echarts-free-cursor
/**
 * A crosshair over a dense scatter.
 *
 * Two rules rather than one, and both are chrome. This is where painting a
 * pointer in a series hue is most tempting and most wrong: the crosshair crosses
 * 1,199 marks, and any saturated colour would read as a second series running
 * through the cloud.
 *
 * The cloud is Vietnam's entire 2023 export basket in the Atlas's own opportunity
 * space — complexity against distance, the two numbers the Atlas uses to argue
 * about what a country should try to make next. The cursor rests on electronic
 * integrated circuits, which is where that argument currently is.
 */
function FreeCursor() {
  const FOCUS = '8542'; // Electronic integrated circuits
  const rows = defined(defined(leadProducts, 'pci'), 'distance');
  const at = rows.filter((d) => d.code === FOCUS);

  const chart = glChart({
    marks: [
      glRuleX(at.map((d) => d.distance), { x: (d: number) => d }),
      glRuleY(at.map((d) => d.pci), { y: (d: number) => d }),
      glMutedPoint(rows, { x: 'distance', y: 'pci' }),
      glPoint(at, { x: 'distance', y: 'pci', tone: 'c-1' }),
    ],
    x: glAxisX({ label: 'Distance from Vietnam’s current capabilities' }),
    y: glAxisY({ label: 'Product complexity (PCI)' }),
  });

  return (
    <GLFigure
      title="Vietnam's most complex products are also its most distant ones."
      subtitle={`Complexity against distance for all ${rows.length} products Vietnam exported in ${LATEST_YEAR}; the cursor rests on ${at[0]?.nameShort}`}
      source={PRODUCTS}
    >
      <Chart {...chart.props} height={260} ariaLabel="Product complexity against distance with a free cursor" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-84-pinned-nested-chart-tooltip
/**
 * A tooltip that contains a chart.
 *
 * The nested chart is the interesting half and it is expressible: it is a second
 * small chart over the selected group's own rows. What is not expressible is the
 * *pinning* — the surface it sits on, its shadow, its connector back to the mark
 * — none of which `grammar.md` rules on.
 *
 * The dodge is data preparation, not styling: each economy is placed at its
 * region's slot plus a small offset cycling through seven columns, so 146 points
 * on five slots stay countable instead of stacking into a line.
 */
function NestedDetail() {
  const REGION = 'Americas';
  const rows = defined(crossSection(LATEST_YEAR), 'eci').map((d) => ({
    iso3: d.iso3,
    name: countryName(d.iso3),
    region: country(d.iso3)?.region ?? 'Unclassified',
    eci: d.eci,
  }));

  const REGIONS = [...new Set(rows.map((d) => d.region))];
  const slot = new Map(REGIONS.map((r, i) => [r, i]));
  const place = <T extends { region: string }>(group: readonly T[]) =>
    group.map((d, i) => ({ ...d, x: (slot.get(d.region) ?? 0) + ((i % 7) - 3) * 0.055 }));

  const { backdrop, focus } = popUp(rows, { by: 'region', highlight: [REGION] });

  const values = rows.map((d) => d.eci);
  const pad = (Math.max(...values) - Math.min(...values)) * 0.06;

  const main = glChart({
    marks: [
      glMutedPoint(place(backdrop), { x: 'x', y: 'eci' }),
      ...focus.map((s) => glPoint(place(s.rows), { x: 'x', y: 'eci', tone: s.tone })),
    ],
    x: glAxisX({
      domain: [-0.62, slot.size - 0.38],
      values: [...slot.values()],
      format: (v) => REGIONS[v] ?? '',
      nice: false,
    }),
    y: glAxisY({
      label: 'Economic Complexity Index',
      domain: [Math.min(...values) - pad, Math.max(...values) + pad],
    }),
  });

  // The nested panel: the selected region's own economies, ranked, so the
  // reader gets the distribution the single dodged column can only hint at.
  const detail = rows
    .filter((d) => d.region === REGION)
    .sort((a, b) => b.eci - a.eci)
    .map((d, i) => ({ ...d, i }));
  const detailValues = detail.map((d) => d.eci);
  const detailPad = (Math.max(...detailValues) - Math.min(...detailValues)) * 0.12;

  const nested = glChart({
    marks: [glPoint(detail, { x: 'i', y: 'eci' })],
    x: glAxisX({
      label: `${REGION} — ${detail.length} economies, most complex first`,
      values: [],
      domain: [-0.6, detail.length - 0.4],
      nice: false,
    }),
    y: glAxisY({
      tickCount: 3,
      domain: [Math.min(...detailValues) - detailPad, Math.max(...detailValues) + detailPad],
    }),
    margin: { left: 60, bottom: 40, top: 4 },
  });

  return (
    <GLFigure
      title="Twenty-three economies in the Americas span more than half the world's complexity range."
      subtitle={`Economic Complexity Index by region, ${LATEST_YEAR}; the pinned panel expands the highlighted group`}
      source={CATALOG}
    >
      <Chart {...nested.props} height={110} ariaLabel="Complexity of the Americas, ranked" />
      <Chart {...main.props} height={250} ariaLabel="Economic complexity by region" />
    </GLFigure>
  );
}
// #endregion

// ════════════════════════════════════════════════════════════════════════════
// Selection
// ════════════════════════════════════════════════════════════════════════════

// #region demo:ts-81-recharts-interactive-legend
/**
 * A legend that toggles series.
 *
 * The static artifact is the legend itself, and the GL position on it is
 * unusual: the spec prefers a *direct label* to a legend wherever the chart
 * allows it, because a label at the end of the line costs the reader nothing and
 * a legend costs them a lookup. So this demo carries both — the legend the
 * catalog entry is about, and the end labels that make it redundant.
 *
 * That redundancy is the finding. An interactive legend is a **control**, and
 * once it is only a control the chart still has to be readable without touching
 * it. The legend marks are rules rather than swatches because the series are
 * lines, and because on this chart the legend mark is also the affordance the
 * reader clicks: a control that does not look like the thing it toggles is a
 * worse control, not just a worse legend.
 */
function InteractiveLegend() {
  const rows = defined(
    countryYear.filter((d) => COHORT.includes(d.iso3)),
    'eci',
  ).map((d) => ({ ...d, country: countryName(d.iso3) }));

  const highlight = [VIETNAM, countryName('KOR')];
  const { backdrop, focus } = popUp(rows, { by: 'country', highlight });
  const toneFor = (name: string) =>
    name === highlight[0] ? ('c-1' as const) : name === highlight[1] ? ('c-2' as const) : ('muted' as const);
  const labelled = toSeries(rows, 'country').map((s) => ({ ...s, tone: toneFor(s.key) }));

  const chart = glChart({
    marks: [
      glMutedLine(backdrop, { x: 'year', y: 'eci', z: 'country' }),
      ...focus.map((s) =>
        glLine(s.rows, { x: 'year', y: 'eci', z: 'country', tone: s.tone, focus: true }),
      ),
      ...endLabels(labelled, { x: 'year', y: 'eci' }),
    ],
    x: yearAxisFor(rows, 'year'),
    y: glAxisY({ label: 'Economic Complexity Index' }),
    endLabels: true,
  });

  return (
    <GLFigure
      title="Korea pulled away from the region; Vietnam is the only economy that closed any of the gap."
      subtitle={`Economic Complexity Index, six Southeast Asian economies, ${FIRST_YEAR}–${LATEST_YEAR}`}
      source={PANEL}
      legend={
        <GLLegend
          items={labelled.map((s) => ({
            label: s.key,
            tone: s.tone,
            mark: 'line' as const,
            focus: s.tone !== 'muted',
          }))}
        />
      }
    >
      <Chart {...chart.props} height={260} ariaLabel="Cohort complexity with a legend and end labels" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-82-chart-table-selection
/**
 * A chart and a table selecting each other.
 *
 * The chart half of the link is the pop-up effect, unchanged: the selected row
 * takes `c-1` and everything else goes `c-muted`. That §3.1 already answers "what
 * does a selected bar look like" is the useful result — selection is emphasis,
 * and the spec has a rule for emphasis.
 *
 * The band domain is pinned to the ranked order on purpose. `popUp` emits the
 * muted backdrop before the focus rows, and a band scale takes its domain from
 * the order it *meets* each category — so without the pin, selecting a bar would
 * silently move it to the bottom of the ranking.
 */
function SelectedSector() {
  const SELECTED = 'Electronics';
  const sectors = defined(leadSectorsIn(LATEST_YEAR), 'exportValueM');
  const total = sectors.reduce((sum, d) => sum + d.exportValueM, 0);
  const rows = sectors
    .map((d) => ({ sector: d.sector, share: d.exportValueM / total }))
    .sort((a, b) => b.share - a.share);

  const { backdrop, focus } = popUp(rows, { by: 'sector', highlight: [SELECTED] });

  const chart = glChart({
    marks: [
      glMutedBarX(backdrop, { y: 'sector', x: 'share' }),
      ...focus.map((s) => glBarX(s.rows, { y: 'sector', x: 'share', tone: s.tone })),
      ...focus.map((s) =>
        glLabel(s.rows, {
          x: 'share',
          y: 'sector',
          text: (d) => pct(d.share),
          tone: s.tone,
          anchor: 'start',
          dx: 8,
        }),
      ),
    ],
    x: glAxisY({ label: 'Share of classified exports', format: pct }),
    y: glAxisBand({ domain: rows.map((d) => d.sector) }),
    margin: { left: 260, right: 48 },
  });

  return (
    <GLFigure
      title="A third of everything Vietnam sells abroad is electronics."
      subtitle={`Share of classified goods exports by sector, ${LATEST_YEAR}; ${SELECTED} selected`}
      source={SECTORS}
    >
      <Chart {...chart.props} height={260} ariaLabel="Vietnam export shares by sector, one selected" />
    </GLFigure>
  );
}
// #endregion

// ════════════════════════════════════════════════════════════════════════════
// Windows and ranges
// ════════════════════════════════════════════════════════════════════════════

/**
 * The y extent a full-height window band has to cover.
 *
 * A band is an area with two data-driven edges, so a window that should span the
 * whole plot needs a y range wide enough to reach both axis bounds — and the band
 * itself then participates in domain inference, which is what makes it land
 * exactly on them. Series that never go negative get a zero floor, because that
 * is where the axis will start anyway.
 */
function plotExtent(values: readonly number[]): [number, number] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.05;
  return [lo >= 0 ? 0 : lo - pad, hi + pad];
}

/**
 * A shaded span over a CONTINUOUS x axis.
 *
 * Not `glBandX`, which is `bandX` and takes a single `x` on a BAND scale — it
 * shades one categorical slot, not an interval on a continuum. That `glBandX`'s
 * own doc comment promises "a shaded vertical region spanning x1–x2" and its
 * underlying mark cannot express one is a real library defect, recorded in the
 * gaps of every range demo below.
 */
function windowBand(from: number, to: number, extent: readonly [number, number]) {
  return glBand(
    [
      { year: from, lo: extent[0], hi: extent[1] },
      { year: to, lo: extent[0], hi: extent[1] },
    ],
    { x: 'year', y1: 'lo', y2: 'hi' },
  );
}

// #region demo:ts-89-brush-range-selection
/**
 * The brushed span as a band.
 *
 * §3.9 already decides this: a band is the LIGHT tone at full opacity, never a
 * translucent main. Both consequences matter for a brush specifically — the
 * selection is the same colour wherever the reader drags it, rather than changing
 * over every mark it crosses, and it survives greyscale, because a lightness step
 * does and an alpha does not.
 */
function BrushedRange() {
  const [FROM, TO] = [2007, 2012];
  const rows = defined(seriesFor(LEAD), 'exportValueM');
  const extent = plotExtent(rows.map((d) => d.exportValueM));

  const chart = glChart({
    marks: [
      windowBand(FROM, TO, extent),
      glLine(rows, { x: 'year', y: 'exportValueM', focus: true }),
    ],
    x: yearAxisFor(rows, 'year'),
    y: glAxisY({ label: 'Total exports ($m)' }),
  });

  return (
    <GLFigure
      title="Vietnam's exports doubled inside the brushed window and doubled again after it."
      subtitle={`Total goods exports, millions of current USD, ${FIRST_YEAR}–${LATEST_YEAR}; ${FROM}–${TO} selected`}
      source={PANEL}
      legend={
        <GLLegend
          // `band`: the brushed window is a focus region, which §3.4 draws as
          // the light tone at full opacity with no stroke.
          items={[{ label: `Selected range (${FROM}–${TO})`, tone: 'c-1', mark: 'band' }]}
        />
      }
    >
      <Chart {...chart.props} height={230} ariaLabel="Vietnam exports with a brushed range" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-83-focus-context-window
/**
 * The selected window, plus the whole series beneath it.
 *
 * Two charts on two domains, which is the form's whole idea: the focus chart
 * spends the full width on the window, and the context strip keeps the reader
 * oriented in the series it came from. §3.9 gives the context strip the muted
 * tone and makes the window it names a band.
 *
 * The series is a ratio of two Atlas tables — Vietnam's electronics exports over
 * the world's — so the source line has to cite both, which `sourceOf` does by
 * taking the union of their scopes rather than by being told.
 */
function FocusAndContext() {
  const [FROM, TO] = [2010, LATEST_YEAR];

  const world = new Map(
    defined(
      worldSectorYear.filter((d) => d.sector === 'Electronics'),
      'exportValueM',
    ).map((d) => [d.year, d.exportValueM]),
  );
  const rows = defined(
    countrySectorYear.filter((d) => d.iso3 === LEAD && d.sector === 'Electronics'),
    'exportValueM',
  )
    .filter((d) => world.has(d.year))
    .map((d) => ({ year: d.year, share: d.exportValueM / world.get(d.year)! }))
    .sort((a, b) => a.year - b.year);

  const windowed = rows.filter((d) => d.year >= FROM && d.year <= TO);
  const extent = plotExtent(rows.map((d) => d.share));

  const focus = glChart({
    marks: [glLine(windowed, { x: 'year', y: 'share', focus: true })],
    x: yearAxisFor(windowed, 'year'),
    y: glAxisY({ label: 'Share of world electronics exports', format: pct }),
  });

  const context = glChart({
    marks: [
      windowBand(FROM, TO, extent),
      glLine(rows, { x: 'year', y: 'share', tone: 'muted' }),
    ],
    x: yearAxisFor(rows, 'year'),
    y: glAxisY({ grid: false, tickCount: 2, format: pct }),
    margin: { bottom: 34, top: 4 },
  });

  return (
    <GLFigure
      title="Vietnam took four per cent of world electronics trade, and almost all of it after 2010."
      subtitle={`Vietnam's share of world electronics exports; ${FROM}–${TO} in focus over the full ${FIRST_YEAR}–${LATEST_YEAR}`}
      source={WORLD_SECTORS}
    >
      <Chart {...focus.props} height={200} ariaLabel="Vietnam's electronics share, focused window" />
      <Chart {...context.props} height={86} ariaLabel="Vietnam's electronics share, full series" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-90-zoomable-time-window
/**
 * The same series after a wheel zoom.
 *
 * Kept separate from the focus/context demo because the design question is
 * genuinely different: a zoom changes the *domain* while a brush changes a
 * *selection*, and the tell is the axis. A zoomed axis relabels itself, and
 * `yearAxisFor` does it without being asked — over twenty-nine years it picks a
 * five-year step, over eight it labels every year.
 *
 * The domain is padded by a fraction of a year because the zoomed chart marks
 * every observation with a dot, and a 6px circle centred on the domain edge
 * renders half outside the plot. `nice` does not help: nicening rounds to a tick
 * and the extreme datum can land exactly on it.
 */
function ZoomedWindow() {
  const FROM = 2016;
  const rows = defined(seriesFor(LEAD), 'exportValueM');
  const zoomed = rows.filter((d) => d.year >= FROM);

  const chart = glChart({
    marks: [
      glLine(zoomed, { x: 'year', y: 'exportValueM', focus: true }),
      glPoint(zoomed, { x: 'year', y: 'exportValueM' }),
    ],
    x: yearAxisFor(zoomed, 'year', { domain: [FROM - 0.3, LATEST_YEAR + 0.3] }),
    y: glAxisY({ label: 'Total exports ($m)' }),
  });

  return (
    <GLFigure
      title="Zoomed in, the axis steps down from five-year ticks to every year."
      subtitle={`Total goods exports, millions of current USD, ${FROM}–${LATEST_YEAR}`}
      source={PANEL}
    >
      <Chart {...chart.props} height={230} ariaLabel="Vietnam exports, zoomed to 2016 onward" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-86-streaming-window-preservation
/**
 * A live series holding a fixed window.
 *
 * The static tell is that the *retained* span is shaded and the discarded one is
 * not, so a reader can see the window is fixed rather than growing. Same band
 * rule as the brush; the difference is what the band means, which the subtitle
 * has to carry because the chart cannot.
 *
 * Drawn on a genuinely appended series — the Atlas adds one year of partner trade
 * per release, so "the last ten observations" is a window that really does slide.
 */
function StreamingWindow() {
  const KEEP = 10;
  const rows = defined(
    leadPartners.filter((d) => d.partner === 'USA'),
    'exportValueM',
  ).sort((a, b) => a.year - b.year);

  const retained = rows.slice(-KEEP);
  const head = retained.slice(-1);
  const extent = plotExtent(rows.map((d) => d.exportValueM));

  const chart = glChart({
    marks: [
      windowBand(retained[0].year, head[0].year, extent),
      glMutedLine(rows, { x: 'year', y: 'exportValueM' }),
      glLine(retained, { x: 'year', y: 'exportValueM', focus: true }),
      glPoint(head, { x: 'year', y: 'exportValueM' }),
    ],
    x: yearAxisFor(rows, 'year', { domain: [FIRST_YEAR - 0.3, LATEST_YEAR + 0.3] }),
    y: glAxisY({ label: 'Exports to the United States ($m)' }),
  });

  return (
    <GLFigure
      title={`Everything ${VIETNAM} sells to the United States, it started selling in the retained window.`}
      subtitle={`Exports to the United States, millions of current USD; the last ${KEEP} releases are held`}
      source={PARTNERS}
      legend={
        <GLLegend
          items={[
            { label: `Retained window (${retained[0].year}–${head[0].year})`, tone: 'c-1', step: 'light' },
            { label: 'Discarded', tone: 'muted', mark: 'line' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={230} ariaLabel="Vietnam's exports to the United States with a retained window" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-91-timeline-playback-scrubber
/**
 * The playhead.
 *
 * A playhead is a reference rule that happens to move, so §3.4.2 answers it
 * unchanged: dashed `ink-3`, and the series it crosses stays solid. The part
 * ahead of the playhead is muted and the part behind it saturated, which is the
 * pop-up effect used as a **progress encoding** rather than as emphasis — the
 * one place in this family where a §3.1 pattern is doing a job §3.1 never named.
 *
 * The two slices overlap by one year on purpose: split at the playhead with no
 * shared point and the line breaks visibly at the very position the playhead is
 * supposed to mark.
 */
function PlaybackScrubber() {
  const AT = 2013;
  const rows = defined(seriesFor(LEAD), 'eci');
  const played = rows.filter((d) => d.year <= AT);
  const remaining = rows.filter((d) => d.year >= AT);

  const chart = glChart({
    marks: [
      glRuleX([AT], { x: (d: number) => d }),
      glMutedLine(remaining, { x: 'year', y: 'eci' }),
      glLine(played, { x: 'year', y: 'eci', focus: true }),
      glPoint(rows.filter((d) => d.year === AT), { x: 'year', y: 'eci' }),
    ],
    x: yearAxisFor(rows, 'year'),
    y: glAxisY({ label: 'Economic Complexity Index' }),
  });

  return (
    <GLFigure
      title={`${VIETNAM} first crossed zero on the complexity index in 2006, slipped back once, and has stayed above it since 2008.`}
      subtitle={`Economic Complexity Index, ${FIRST_YEAR}–${LATEST_YEAR}; the playhead rests at ${AT}`}
      source={PANEL}
      legend={
        <GLLegend
          items={[
            { label: `Played (${FIRST_YEAR}–${AT})`, tone: 'c-1', mark: 'line', focus: true },
            { label: `Remaining (${AT}–${LATEST_YEAR})`, tone: 'muted', mark: 'line' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={230} ariaLabel="Vietnam's complexity index with a playhead at 2013" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-87-echarts-synchronized-cursors
/**
 * Two views, one cursor position.
 *
 * Synchronising is the behaviour; the design question the resting state *can*
 * answer is whether the cursor should look the same in both views, and it must —
 * a reader linking two panels by a shared position needs the two marks to be
 * identifiably one mark. Both rules here are the same `glRuleX` at the same x.
 *
 * The pairing is the level and the share of the same flow, which is the case a
 * synchronised cursor is actually for: the two panels disagree about what
 * happened, and the cursor is what makes them disagree at a specific date.
 */
function SynchronizedCursors() {
  const AT = 2018;
  const totals = new Map(
    defined(seriesFor(LEAD), 'exportValueM').map((d) => [d.year, d.exportValueM]),
  );
  const rows = defined(
    leadPartners.filter((d) => d.partner === 'USA'),
    'exportValueM',
  )
    .filter((d) => totals.has(d.year))
    .map((d) => ({
      year: d.year,
      value: d.exportValueM,
      share: d.exportValueM / totals.get(d.year)!,
    }))
    .sort((a, b) => a.year - b.year);

  const top = glChart({
    marks: [
      glRuleX([AT], { x: (d: number) => d }),
      glLine(rows, { x: 'year', y: 'value', focus: true }),
    ],
    // Tick positions identical to the panel below, labels suppressed: the two
    // charts are one axis read twice, and printing the years on both says they
    // are two.
    x: yearAxisFor(rows, 'year', { format: () => '' }),
    y: glAxisY({ label: 'Exports ($m)', tickCount: 3 }),
    margin: { bottom: 16 },
  });

  const bottom = glChart({
    marks: [
      glRuleX([AT], { x: (d: number) => d }),
      glLine(rows, { x: 'year', y: 'share', tone: 'c-2', focus: true }),
      glRuleY([0], { y: (d: number) => d }),
    ],
    x: yearAxisFor(rows, 'year'),
    y: glAxisY({ label: 'Share of all exports', tickCount: 3, format: pct }),
    margin: { top: 4 },
  });

  return (
    <GLFigure
      title="Exports to the United States rose all decade; their share of Vietnam's total only turned in 2019."
      subtitle={`Exports to the United States and their share of all Vietnamese exports, cursors synchronised at ${AT}`}
      source={PARTNERS}
    >
      <Chart {...top.props} height={150} ariaLabel="Vietnam's exports to the United States" />
      <Chart {...bottom.props} height={150} ariaLabel="The United States' share of Vietnam's exports" />
    </GLFigure>
  );
}
// #endregion

// ════════════════════════════════════════════════════════════════════════════
// Lanes
// ════════════════════════════════════════════════════════════════════════════

// #region demo:ts-85-scrollable-resource-lanes
/**
 * Overlapping events on named tracks — and, unexpectedly, an Atlas form.
 *
 * Scrolling is the interaction; the chart underneath is a ranged bar per event on
 * a band scale of lanes, and the gallery could only draw it from an invented
 * programme Gantt. The Atlas has a genuine version: each of Vietnam's twelve
 * largest 2023 products has a revealed-comparative-advantage history, and
 * splitting each history into its runs of one RCA tier gives thirty events on
 * twelve lanes, most lanes carrying more than one. The collisions are the reason
 * the tracks exist.
 *
 * Two data decisions worth reading:
 *
 *   - **A run ends at `last + 1`, not `last`.** An Atlas year is an interval, not
 *     an instant: 2010 is the whole of 2010. Ending a one-year run at its own
 *     start would give it zero width and the bar would not draw at all.
 *   - **Lanes are ordered by the year the product first reached RCA ≥ 1**, which
 *     is what turns twelve unordered histories into the staircase that is the
 *     finding.
 *
 * Tier is an ORDERED variable, so §8c sends it down one hue's three-tone ramp
 * light → main → dark rather than to three unrelated colours: the lightness
 * carries the ordering and a reader gets it without the legend.
 */
const RCA_TIERS = ['No advantage', 'Advantage', 'Strong advantage'] as const;

interface LaneEvent {
  key: string;
  lane: string;
  tier: string;
  start: number;
  end: number;
}

/** Contiguous runs of one RCA tier, per product. */
function rcaRuns(): LaneEvent[] {
  const tierOf = (rca: number) =>
    rca < 1 ? RCA_TIERS[0] : rca < 5 ? RCA_TIERS[1] : RCA_TIERS[2];

  const codes = [...new Set(leadProductPanel.map((d) => d.code))];
  return codes.flatMap((code) => {
    const history = defined(
      leadProductPanel.filter((d) => d.code === code),
      'rca',
    ).sort((a, b) => a.year - b.year);

    const runs: LaneEvent[] = [];
    for (const row of history) {
      const tier = tierOf(row.rca);
      const open = runs[runs.length - 1];
      // `end` is exclusive: the year 2010 covers 2010–2011 on the axis.
      if (open && open.tier === tier) open.end = row.year + 1;
      else
        runs.push({
          key: `${code}-${row.year}`,
          lane: row.nameShort,
          tier,
          start: row.year,
          end: row.year + 1,
        });
    }
    return runs;
  });
}

/**
 * Which runs can carry their own label.
 *
 * `glLabel` has no fit, no clip and no collision pass, so a label is drawn at
 * full width whether or not the bar under it is wide enough to hold it. On the
 * synthetic specimen every event was comfortably long; on the Atlas, a product
 * that spends a single year at one RCA tier gets a bar about eleven pixels wide
 * and a fifteen-character label centred on it, which lands on both neighbours.
 *
 * So the demo decides *which rows to label* — data preparation, which a demo is
 * allowed to author — rather than restyling the label, which it is not. A run is
 * labelled only when its own span is wide enough for its own text.
 *
 * The width estimate is derived, not tuned: Inter at the chart text size
 * averages ~6.9px per character, the plot spans `LATEST_YEAR + 1 - FIRST_YEAR`
 * years across roughly 330px once the 290px name gutter is taken, and a label
 * needs a little air at each end. Unlabelled runs stay decodable — the legend
 * carries all three tiers — which is the trade §3.12 asks for: prefer a direct
 * label *where the chart allows it*.
 */
const CHAR_PX = 6.9;
const LABEL_AIR_PX = 8;
const PLOT_PX = 330;
const YEARS_SPANNED = LATEST_YEAR + 1 - FIRST_YEAR;

const labelFits = (d: LaneEvent): boolean =>
  (d.end - d.start) * (PLOT_PX / YEARS_SPANNED) >= d.tier.length * CHAR_PX + LABEL_AIR_PX;

/** The lane chart both demos draw; `handles` is the only difference. */
function laneChart(events: readonly LaneEvent[], lanes: readonly string[], handles: readonly LaneEvent[]) {
  return glChart({
    marks: [
      glBarX(events, { x1: 'start', x2: 'end', y: 'lane', z: 'key', color: 'tier' }),
      glLabel(events.filter(labelFits), {
        x: (d) => (d.start + d.end) / 2,
        y: 'lane',
        text: (d) => d.tier,
        anchor: 'middle',
      }),
      // An edit handle is a DATA tick — 8px, twice the axis tick — so a tick
      // carrying a value cannot be mistaken for axis chrome (§3.4.2).
      ...(handles.length
        ? [
            glTickY(handles, { y: 'lane', x: 'start', tone: 'c-2' }),
            glTickY(handles, { y: 'lane', x: 'end', tone: 'c-2' }),
          ]
        : []),
    ],
    x: yearAxisFor([{ year: FIRST_YEAR }, { year: LATEST_YEAR + 1 }], 'year'),
    y: glAxisBand({ domain: [...lanes] }),
    color: toneRamp({ tones: 'three', order: [...RCA_TIERS], tone: 'c-1' }),
    variant: { labelHalo: true },
    margin: { left: 290, right: 16 },
  });
}

/** Lanes ranked by when the product first reached comparative advantage. */
function laneOrder(events: readonly LaneEvent[]): string[] {
  const crossed = new Map<string, number>();
  for (const e of events) {
    if (e.tier === RCA_TIERS[0]) continue;
    const seen = crossed.get(e.lane);
    if (seen == null || e.start < seen) crossed.set(e.lane, e.start);
  }
  return [...new Set(events.map((e) => e.lane))].sort(
    (a, b) => (crossed.get(a) ?? LATEST_YEAR) - (crossed.get(b) ?? LATEST_YEAR),
  );
}

const TIER_LEGEND = [
  { label: 'Strong advantage (RCA ≥ 5)', tone: 'c-1' as const, step: 'dark' as const },
  { label: 'Advantage (RCA 1–5)', tone: 'c-1' as const },
  { label: 'No advantage (RCA < 1)', tone: 'c-1' as const, step: 'light' as const },
];

function ResourceLanes() {
  const events = rcaRuns();
  const chart = laneChart(events, laneOrder(events), []);

  return (
    <GLFigure
      title="Vietnam's electronics products crossed into comparative advantage one after another, from 2008 on."
      subtitle={`Revealed comparative advantage tier by year for Vietnam's twelve largest ${LATEST_YEAR} products, ${FIRST_YEAR}–${LATEST_YEAR}`}
      source={PRODUCT_PANEL}
      legend={<GLLegend items={TIER_LEGEND} />}
    >
      <Chart {...chart.props} height={330} ariaLabel="Comparative advantage tiers by product and year" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-92-editable-event-range
/**
 * The same lanes with one range under edit.
 *
 * The handles are the whole specimen and they needed no new rule, which is the
 * useful result: §3.4.2 already sizes a data tick at 8px — twice the axis tick —
 * precisely so a tick carrying a value cannot be mistaken for chrome, and a drag
 * handle is a value the reader can move.
 *
 * The range under edit is Telephones' thirteen years at ordinary comparative
 * advantage, chosen because it is the longest run that is neither the first nor
 * the last in its lane: both handles have a neighbour to collide with, which is
 * what makes a range editable rather than merely extendable.
 */
function EditableRange() {
  const events = rcaRuns();
  const editable = events.filter(
    (e) => e.lane === 'Telephones' && e.tier === RCA_TIERS[1],
  );
  const chart = laneChart(events, laneOrder(events), editable);

  return (
    <GLFigure
      title="An edit handle is a data tick, at twice the axis tick's length."
      subtitle={`Revealed comparative advantage tier by product; Telephones' ${editable[0]?.start}–${(editable[0]?.end ?? 1) - 1} run is under edit`}
      source={PRODUCT_PANEL}
      legend={<GLLegend items={[...TIER_LEGEND, { label: 'Under edit', tone: 'c-2' as const }]} />}
    >
      <Chart {...chart.props} height={330} ariaLabel="Comparative advantage tiers with one range editable" />
    </GLFigure>
  );
}
// #endregion

// ════════════════════════════════════════════════════════════════════════════
// Hit testing
// ════════════════════════════════════════════════════════════════════════════

// #region demo:ts-65-voronoi-nearest-tooltip
/**
 * The nearest-point partition — the region a cursor actually resolves to.
 *
 * The cells exist in the catalog to route pointer events, and drawing them is
 * more informative than describing them: each cell *is* the area of the plot in
 * which a free cursor would select that economy. §3.4 makes them opaque tiles —
 * they partition the plane and cannot overlap, so the scatter's 0.8 would only
 * dilute them.
 *
 * **The partition is computed in the plot box, not in data units, and that is not
 * a shortcut.** Hit testing is nearest-in-pixels; a Voronoi diagram built on raw
 * income and complexity would be nearest-in-(dollars, index points), which is a
 * different partition and not the one a cursor would produce. So both variables
 * are mapped onto the box first — income through log10, because the Atlas plots
 * income on a log axis and the cursor would land on that axis.
 *
 * Cells are shaded by a THIRD variable, the Atlas growth projection, so the
 * colour says something the two positions do not.
 */
function NearestPointPartition() {
  const BOX = { width: 100, height: 68 };
  const region = 'Asia';

  const rows = defined(
    defined(
      defined(
        crossSection(LATEST_YEAR).filter((d) => country(d.iso3)?.region === region),
        'eci',
      ),
      'gdpPerCapita',
    ),
    'growthProjection',
  );

  // Data → plot box. Both extents come from the rows being drawn, because the
  // partition only means anything relative to the frame it is drawn in.
  const spanOf = (values: readonly number[]) => {
    const lo = Math.min(...values);
    return { lo, span: Math.max(...values) - lo || 1 };
  };
  const incomes = spanOf(rows.map((d) => Math.log10(d.gdpPerCapita)));
  const complexity = spanOf(rows.map((d) => d.eci));
  const points = rows.map((d) => ({
    name: countryName(d.iso3),
    growth: d.growthProjection,
    px: ((Math.log10(d.gdpPerCapita) - incomes.lo) / incomes.span) * BOX.width,
    py: ((d.eci - complexity.lo) / complexity.span) * BOX.height,
  }));

  const cells = glVoronoiCells(points, {
    x: (d) => d.px,
    y: (d) => d.py,
    bounds: [0, 0, BOX.width, BOX.height],
  });
  const features = glVoronoiFeatures(cells);

  const growth = points.map((d) => d.growth);
  // Hoisted so the ramp legend reads its bins and cut points off the SAME scale
  // the cells are painted from — a second copy is a second thing to drift.
  const growthColor = glSequentialColor({
    domain: [Math.min(...growth), Math.max(...growth)],
    steps: 5,
  });

  const chart = glChart({
    marks: [
      glGeoShape(features as never, {
        // `geoIdentity` because the coordinates are already in the plane. The
        // reflect is the one thing that always differs: screen y counts down and
        // the data counts up.
        projection: { type: () => geoIdentity().reflectY(true), fit: 'data', inset: 2 } as never,
        // `as never` for the same reason `projection` takes one: `glGeoShape` is
        // typed against d3-geo's permissible-object union, which has no `id` — a
        // Voronoi cell is GeoJSON the mark can draw and not a shape it was
        // declared for. The cast is at the boundary, once.
        color: ((f: { id: number }) => points[f.id].growth) as never,
      }),
    ],
    guides: false,
    color: { scale: growthColor },
    margin: { left: 8, right: 8, top: 8, bottom: 8 },
  });

  return (
    <GLFigure
      title="The poorest economies carry the highest projected growth, wherever their complexity sits."
      subtitle={`Nearest-point partition of ${points.length} Asian economies on income and complexity, ${LATEST_YEAR}; each cell is the region a cursor would resolve to`}
      source={withNote(
        CATALOG,
        'Cells are computed in the plot box — income on a log scale — because pointer hit-testing is nearest-in-pixels',
      )}
      legend={
        <GLRampLegend
          scale={growthColor}
          label="Projected annual growth (%)"
          format={(v) => v.toFixed(1)}
        />
      }
    >
      <Chart {...chart.props} height={300} ariaLabel="Voronoi partition of Asian economies" />
    </GLFigure>
  );
}
// #endregion

// ════════════════════════════════════════════════════════════════════════════

/** The shortfall every demo in this family carries, verbatim from the specimens. */
const NO_INTERACTION_API =
  'The interaction itself is not built, and the reason is the SPEC, not the library. TanStack 0.6.5 ships a full interaction layer — `focus`, `focusRing`, `tooltip`, `keyboard` and `spatialIndex` on `ChartDefinitionOptions` (dist/types.d.ts), `whenFocused` on the package root, per-mark `states` on dot/line/bar/rect, and `onFocusChange`/`onSelect` on the React adapter — and `glChart` spreads unknown options straight into `defineChart`, so `focus: \'group-x\'` already compiles today. What does not exist is anywhere on-spec to route it: `grammar.md` rules on no hover state, no tooltip surface or type scale, no focus ring, no selected-mark treatment, so gl-charts has no token to give any of them and every interactive chart built on it is off-spec by omission. Wiring the API without the rulings would be inventing spec. So the plate draws the RESTING state, which §3.4.2 and §3.9 do cover, and the shortfall is the missing §: see constraints.test.ts §10, which now fails against the shipped surface rather than against two names that were never in it.';

/** The `glBandX` defect the range demos all run into. */
const BAND_X_DEFECT =
  '`glBandX` cannot draw this window. Its doc comment promises "a shaded vertical region spanning x1–x2" and its underlying mark is `bandX`, which takes a single `x` on a BAND scale — it shades one categorical slot, not an interval on a continuum. Every windowed demo here builds the span out of `glBand` and two rows carrying the same y extent instead, which is correct under §3.9 and is not what the vocabulary says it is.';

const demos: Demo[] = [
  {
    id: 'ts-34-pointer-tooltip',
    family: 'Interactive',
    name: 'Pointer-selected tooltip, at rest',
    question: 'What did Vietnam export in the one year its exports collapsed?',
    rule: '§3.4.2 — a pointer is chrome: dashed ink-3, and it ignores tone.',
    render: PointerAtOneYear,
    gaps: [
      NO_INTERACTION_API,
      "What a tooltip would SAY is drawn as a label, because a tooltip's own surface, padding, type scale and connector are unruled. That is the largest single hole this exercise found in `grammar.md`.",
      'The Atlas is annual, so the pointer rests on a year rather than on an observation inside one. A tooltip on a daily series selects one of hundreds of points and the rule reads as a cursor; on twenty-nine annual points it reads as an annotation, which is a different design problem the catalog entry does not distinguish.',
    ],
  },
  {
    id: 'ts-35-grouped-tooltip',
    family: 'Interactive',
    name: 'Grouped read at one x position',
    question: 'Where did each Southeast Asian economy stand on complexity in 2010?',
    rule: "Decision Rule 2 — each value is labelled in its own series' DARK tone.",
    render: GroupedReadAtOneYear,
    gaps: [
      NO_INTERACTION_API,
      'The two labels a grouped read places for Vietnam (0.12) and Indonesia (0.13) overlap outright: real series converge and `glLabel` has no collision handling, so a grouped tooltip over six economies cannot be read at any year where two of them are level. The synthetic specimen never showed this because its five series were spread evenly by construction. A dodge pass over placed labels belongs in `compose.ts`; hand-tuning `dy` per series here would hide the gap instead of recording it.',
      'The cohort is six, not five. Six labels at one x is already past what a stacked tooltip surface would hold, and nothing in `grammar.md` says what to drop.',
    ],
  },
  {
    id: 'ts-80-echarts-axis-pointer',
    family: 'Interactive',
    name: 'Pointer that labels its own axis position',
    question: 'Was 2009 a bad year for one exporter or for the whole region?',
    rule: "§3.5 — the pointer's axis label is a tick, so it takes axis ink.",
    render: AxisPointer,
    gaps: [
      NO_INTERACTION_API,
      'Snapping is invisible at rest. The plate shows the axis-side half — the pointer carrying its own value among the ordinary ticks — which is the one piece of pointer chrome that already has a home in the rules.',
      'The pointer year has to be spliced into `values` by hand, so the axis carries a tick set that no longer matches what `yearTicks` would generate for the data. There is no way to say "these ticks, plus this one" — a `pointerAt` option on the axis presets is the missing piece.',
    ],
  },
  {
    id: 'ts-88-echarts-free-cursor',
    family: 'Interactive',
    name: 'Crosshair over a dense scatter',
    question: 'How far from Vietnam’s current capabilities do its complex products sit?',
    rule: '§3.4.2 — two rules, both chrome; a saturated crosshair reads as a series.',
    render: FreeCursor,
    gaps: [
      NO_INTERACTION_API,
      'At 1,199 marks the muted cloud is dense enough that the crosshair is legible only where it crosses open paper — which is the correct outcome under §3.4.2 (chrome must not compete) and still means the reader loses the cursor inside the cluster. The catalog specimen had 400 points and never reached that density. A halo on the rule would fix it and `grammar.md` rules on halos for labels only.',
    ],
  },
  {
    id: 'ts-84-pinned-nested-chart-tooltip',
    family: 'Interactive',
    name: 'A tooltip containing a chart',
    question: 'How wide is the complexity spread inside a single world region?',
    rule: '§3.1 — the selected group is the pop-up effect; the detail is a second chart.',
    render: NestedDetail,
    gaps: [
      NO_INTERACTION_API,
      "The nested chart is placed above the main one rather than ANCHORED to the selected mark. Anchoring needs the mark's resolved pixel position, and a chart definition cannot see it — the same reason the treemap has to be a build function rather than a spec.",
      'Real region sizes are lopsided: Asia has 43 economies and Oceania 3, so the dodge that keeps Asia countable spreads Oceania into a line of three. The dodge width is a single constant with no knowledge of how many points share a slot.',
    ],
  },
  {
    id: 'ts-81-recharts-interactive-legend',
    family: 'Interactive',
    name: 'Interactive series legend',
    question: 'Which Southeast Asian economies gained on Korea, and which did not?',
    rule: 'The spec prefers a DIRECT LABEL to a legend wherever the chart allows it.',
    render: InteractiveLegend,
    gaps: [
      NO_INTERACTION_API,
      'The plate deliberately carries both a legend and the end labels that make it redundant. That redundancy is the finding: an interactive legend is a CONTROL, and once it is only a control the chart still has to be readable without touching it.',
      'Same `endLabels` collision already recorded on the Lines family: Malaysia and Thailand end the period within a few hundredths of each other and their direct labels overlap. Here it compounds the point — the legend is the only thing that disambiguates them, so the control the chart was supposed to be readable without becomes load-bearing.',
    ],
  },
  {
    id: 'ts-82-chart-table-selection',
    family: 'Interactive',
    name: 'Chart and table selecting each other',
    question: 'How concentrated is Vietnam’s export basket by sector?',
    rule: '§3.1 — a selected mark is the pop-up effect, not a new visual state.',
    render: SelectedSector,
    gaps: [
      NO_INTERACTION_API,
      'Only one side of the link is here: a table is not a chart and the library draws no tables. Worth recording as a positive result too — §3.1 already answers "what does a selected bar look like", so selection needed no new rule at all.',
      'Atlas sector names run to 42 characters, so the band axis takes 260px of a roughly 850px figure — nearly a third of the width spent on the category labels the table half of this pairing would have carried. No axis preset can wrap, truncate or two-line them.',
    ],
  },
  {
    id: 'ts-89-brush-range-selection',
    family: 'Interactive',
    name: 'Brushed range selection',
    question: 'How much of Vietnam’s export growth happened in any given six years?',
    rule: '§3.9 — a band is the light tone at full opacity, so a brush is greyscale-safe.',
    render: BrushedRange,
    gaps: [NO_INTERACTION_API, BAND_X_DEFECT],
  },
  {
    id: 'ts-83-focus-context-window',
    family: 'Interactive',
    name: 'Focus window over a context strip',
    question: 'When did Vietnam become a significant share of world electronics trade?',
    rule: '§3.9 — the context strip is muted and the window it names is a band.',
    render: FocusAndContext,
    gaps: [
      NO_INTERACTION_API,
      BAND_X_DEFECT,
      "The two charts are independent and placed by the demo. A linked-panel layout would guarantee the context strip's domain contains the focus chart's; here that is true only because both were pinned by hand.",
    ],
  },
  {
    id: 'ts-90-zoomable-time-window',
    family: 'Interactive',
    name: 'Wheel zoom over a time window',
    question: 'What has happened to Vietnam’s exports since 2016?',
    rule: '§3.5 — a zoomed axis relabels itself; the tick generator picks the step from the span.',
    render: ZoomedWindow,
    gaps: [
      NO_INTERACTION_API,
      'The catalog entry is about `dateTicks` stepping the unit down from years to months to days as the span shrinks. The Atlas has exactly one grain, so only the tick STEP can change — five years to one — and the unit never does. `timeAxisFor` and `toEpoch` go untested on this page for the same reason.',
    ],
  },
  {
    id: 'ts-86-streaming-window-preservation',
    family: 'Interactive',
    name: 'Streaming series with a preserved window',
    question: 'How much of Vietnam’s trade with the United States is recent?',
    rule: '§3.9 — shading the RETAINED span is what shows the window is fixed.',
    render: StreamingWindow,
    gaps: [
      NO_INTERACTION_API,
      BAND_X_DEFECT,
      'The catalog specimen streams a 420-point daily series and retains 90 points. The Atlas appends one observation per release, so the honest analogue is a ten-YEAR window on a twenty-nine-year series. The form is exercised; the density that makes a streaming window a performance decision rather than an editorial one is not.',
    ],
  },
  {
    id: 'ts-91-timeline-playback-scrubber',
    family: 'Interactive',
    name: 'Playback scrubber',
    question: 'How steadily did Vietnam’s complexity climb?',
    rule: '§3.1 — played and unplayed are the pop-up effect, used as progress.',
    render: PlaybackScrubber,
    gaps: [
      NO_INTERACTION_API,
      'Using the pop-up effect as a PROGRESS encoding is a reading `grammar.md` does not authorise: §3.1 makes the saturated tone mean "this is the finding", and here it means "this has been played". Nothing else in the vocabulary can say it, and a reader who knows §3.1 will read the played half as the emphasised half. Recorded rather than resolved — a progress tone is a rule the spec has not made.',
    ],
  },
  {
    id: 'ts-87-echarts-synchronized-cursors',
    family: 'Interactive',
    name: 'Synchronized cursors across two views',
    question: 'Did the United States take a larger share of Vietnam’s exports as it bought more?',
    rule: 'A shared position must be identifiably ONE mark in both panels.',
    render: SynchronizedCursors,
    gaps: [
      NO_INTERACTION_API,
      'Same linked-panel shortfall: the two charts share an x domain only because both were pinned, and nothing checks that they still do. Here the top axis also has to suppress its own labels with `format: () => \'\'`, which is a formatter doing a layout job — there is no "this axis is shared with the panel below" option.',
    ],
  },
  {
    id: 'ts-85-scrollable-resource-lanes',
    family: 'Interactive',
    name: 'Resource timeline lanes',
    question: 'When did each of Vietnam’s biggest products become something it specialises in?',
    rule: '§8c — an ordered phase walks one hue light → main → dark.',
    render: ResourceLanes,
    gaps: [
      NO_INTERACTION_API,
      'Scrolling is the interaction and the chart under it is an ordinary ranged bar per event. Worth noting as a form the spec PDF had no plate for and that needed no new rule to draw.',
      '`glLabel` has no fit, no clip and no collision pass, so a label is drawn at full width over a bar that may be a fraction of it — a product spending one year at a tier gets an ~11px bar under a 15-character label. The demo works around it by labelling only runs whose own span fits their own text, which is a decision about WHICH ROWS to label (data preparation, allowed) rather than about how a label looks (styling, not allowed). The workaround costs real information: short runs now carry no direct label and fall back to the legend. The library-level fix is a measured label with a fit or collision pass, and `grammar.md` has not ruled on what a label should do when it cannot fit.',
      "Twelve Atlas product names take a 290px left margin, a third of the figure. Two of them ('Transmission apparatus for radio, telephone and TV', 'Parts and accessories for office machines') still run to the edge of it.",
    ],
  },
  {
    id: 'ts-92-editable-event-range',
    family: 'Interactive',
    name: 'Editable event range',
    question: 'How long did Vietnam hold ordinary comparative advantage in telephones?',
    rule: '§3.4.2 — a drag handle is a DATA tick: 8px, twice the axis tick.',
    render: EditableRange,
    gaps: [
      NO_INTERACTION_API,
      'The handles needed no new rule, which is the useful result: §3.4.2 sizes a data tick at twice the axis tick precisely so a tick carrying a value cannot be mistaken for chrome, and a handle is a value the reader can move.',
      'Both lane-chart gaps above apply unchanged — the one-year label overflow and the 290px name margin.',
    ],
  },
  {
    id: 'ts-65-voronoi-nearest-tooltip',
    family: 'Interactive',
    name: 'Voronoi nearest-point partition',
    question: 'Which economy does a cursor over the income–complexity plane actually select?',
    rule: '§3.4 — cells tile the plane and cannot overlap, so they are opaque tiles.',
    render: NearestPointPartition,
    gaps: [
      NO_INTERACTION_API,
      'The geometry is now built, which changes what this plate shows: the cells exist in the catalog entry to route POINTER EVENTS, and drawing them is more informative than describing them — each cell IS the region a cursor would resolve to, so the plate renders the hit-testing rather than asserting it. What is still absent is only the routing.',
      'The cells cannot be labelled. A `geoShape` chart runs `guides: false` because the mark declares its scale value types as `never`, and a text mark placed on the same identity projection has no scale to resolve against — so a partition of 43 named economies carries no names at all. On the synthetic 22-station plate that was a smaller loss.',
      'The partition is computed in the plot box rather than in data units, because hit-testing is nearest-in-pixels. That is the correct construction and it means the picture changes shape with the figure: the same 43 economies on a taller plot give different cells. Nothing in the library ties the bounds to the rendered size.',
    ],
  },
];

export const interactionFamily: Family = {
  slug: 'interactive',
  title: 'Interactive',
  blurb:
    'Sixteen resting states. These charts are not interactive here: each draws the frame a reader sees before touching anything, together with the static half of the behaviour — the pointer rule, the brushed band, the selected mark — so the look of an interactive chart can be judged on the page.',
  demos,
};

export function renderInteraction(): Record<string, () => ReactNode> {
  return Object.fromEntries(demos.map((d) => [d.id, d.render]));
}
