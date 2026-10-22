/**
 * Catalog specimens — the Interaction family.
 *
 * Sixteen catalog entries, the largest category TanStack publishes, and the one
 * where the honest answer takes the most explaining.
 *
 * ## What these plates are, and what they are not
 *
 * They are **the resting state**, drawn on-spec. Every entry below is a real
 * chart that happens to have a behaviour attached — a line chart with a tooltip,
 * a scatter with a cursor, a timeline with draggable handles — and the chart
 * half is expressible today. What the reader is looking at is the frame a user
 * would see before touching anything, plus the *static* half of the interaction:
 * the pointer rule, the selected mark, the brushed window, the retained
 * viewport. Those are marks, and §3.4.2 already rules on them.
 *
 * They are not a claim that `gl-charts` does interaction. Every one is recorded
 * `partial` and every one names the same two shortfalls:
 *
 * 1. **TanStack 0.6.5 has no interaction API.** The published docs run ahead of
 *    the pinned release and their interactive examples already use `crosshair()`
 *    and `createChartCursor`, neither of which exists in `dist/`.
 *    `constraints.test.ts` §10 fails the day they land — which is the moment to
 *    write the rules below, not before.
 * 2. **`grammar.md` does not rule on interaction at all.** There is no section
 *    on hover states, no tooltip type scale, no focus ring, no rule for what a
 *    selected mark looks like. A plate that invented one would be inventing
 *    spec, which is the one thing this gallery exists not to do.
 *
 * So the interaction-specific marks below use only what §3.4.2 already decides:
 * a pointer or playhead is a **reference rule** (`ink-3`, dashed, ignores tone —
 * nothing was measured there, the reader brought it), a retained or brushed
 * window is a **band** (§3.9 light tone at full opacity), and a selected datum
 * is the **pop-up effect** (§3.1). Nothing here needed a new rule, which is
 * itself the finding: most of what an interaction draws is already ruled on, and
 * what is missing is the event plumbing rather than the design language.
 *
 * Same contract as every specimen file: nothing is styled by hand.
 */

import type { ReactNode } from 'react';
import { Chart } from '@tanstack/react-charts';

import {
  endLabels,
  glAxisBand,
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
  glTickY,
  popUp,
  timeAxisFor,
  toEpoch,
  toneRamp,
  toSeries,
} from '../src/index.js';
import { GLFigure, GLLegend } from '../src/figure.js';

import { dailyData } from './specimen-data.js';
import {
  SECTORS,
  carRows,
  groupedObservations,
  laneEvents,
  longRankData,
  sectorData,
} from './tanstack-data.js';

const SYNTHETIC = 'Source: Synthetic data for illustration. Not a Growth Lab estimate.';

/** The shared daily series, as epoch ms. */
const daily = dailyData.map((d) => ({ t: toEpoch(d.date), value: d.value }));

/**
 * A time domain padded by half a scatter circle, in milliseconds.
 *
 * Several of these plates mark a point at the very start or end of their span,
 * and a 6px circle centred on the domain edge renders half outside the plot —
 * across the axis line and into the tick labels. `nice` does not help: nicening
 * rounds to a tick and the extreme datum can land exactly on it.
 */
function paddedTimeDomain(rows: readonly { t: number }[]): [number, number] {
  const lo = Math.min(...rows.map((d) => d.t));
  const hi = Math.max(...rows.map((d) => d.t));
  const pad = (hi - lo) * 0.015;
  return [lo - pad, hi + pad];
}

/** Two sectors highlighted, three muted — the pop-up split these plates share. */
function sectorSplit(highlight: readonly string[]) {
  const { backdrop, focus } = popUp(sectorData, { by: 'sector', highlight });
  const labelled = toSeries(
    sectorData,
    'sector',
    SECTORS.map((s) => {
      const rank = highlight.indexOf(s);
      return rank === 0 ? ('c-1' as const) : rank === 1 ? ('c-2' as const) : ('muted' as const);
    }),
  );
  return { backdrop, focus, labelled };
}

// ════════════════════════════════════════════════════════════════════════════
// Pointers and tooltips
// ════════════════════════════════════════════════════════════════════════════

/**
 * `34-pointer-tooltip` — the single-point selection, at rest.
 *
 * The pointer is a `glRuleX`: dashed `ink-3`, and it **ignores `tone`** outright.
 * That is the rule doing real work rather than being stated — a pointer painted
 * `c-1` would spend the institutional blue on something that is not a finding,
 * and the reader would have to work out why this blue line means something
 * different from the blue series it crosses.
 *
 * What a tooltip would say is drawn as a label instead, because a tooltip's own
 * type, padding and surface are unruled.
 */
function PointerTooltip() {
  const at = daily[Math.floor(daily.length * 0.62)];

  const chart = glChart({
    marks: [
      glRuleX([at.t], { x: (d: number) => d }),
      glLine(daily, { x: 't', y: 'value', focus: true }),
      glPoint([at], { x: 't', y: 'value' }),
      glLabel([at], {
        x: 't',
        y: 'value',
        text: (d) => `${d.value.toFixed(1)}`,
        anchor: 'end',
        dx: -10,
        dy: -8,
      }),
    ],
    x: timeAxisFor(daily, 't'),
    y: glAxisY({ label: 'Shipments (index)' }),
    variant: { labelHalo: true },
  });

  return (
    <GLFigure
      title="A pointer is chrome, so it is dashed ink and never a series hue."
      subtitle="Daily shipment index with the pointer at one observation"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={230} ariaLabel="Shipment index with a pointer" />
    </GLFigure>
  );
}

/**
 * `35-grouped-tooltip` — one x position, every series at once.
 *
 * The grouped read is what the vertical rule is FOR: it names a shared x, and
 * the marks it crosses are the group. Each value gets a direct label in its own
 * series' dark tone, which is Decision Rule 2 — a text element tied to a
 * coloured mark takes that mark's dark tone, never its main, which fails WCAG AA
 * against paper.
 */
function GroupedTooltip() {
  const YEAR = 2016;
  const { backdrop, focus, labelled } = sectorSplit(['Services', 'Manufacturing']);
  const at = sectorData.filter((d) => d.year === YEAR);

  const chart = glChart({
    marks: [
      glRuleX([YEAR], { x: (d: number) => d }),
      glMutedLine(backdrop, { x: 'year', y: 'value', z: 'sector' }),
      ...focus.map((s) =>
        glLine(s.rows, { x: 'year', y: 'value', z: 'sector', tone: s.tone, focus: true }),
      ),
      glPoint(at, { x: 'year', y: 'value', tone: 'muted' }),
      ...labelled.map((s) =>
        glLabel(
          at.filter((d) => d.sector === s.key),
          {
            x: 'year',
            y: 'value',
            text: (d) => `${s.key} ${Math.round(d.value)}`,
            tone: s.tone,
            anchor: 'start',
            dx: 10,
          },
        ),
      ),
    ],
    x: glAxisX({ nice: false }),
    y: glAxisY({ label: 'Employment (thousands)' }),
    variant: { labelHalo: true },
    margin: { right: 40 },
  });

  return (
    <GLFigure
      title="Every series is read at one shared x position."
      subtitle={`Employment by sector with all five values at ${YEAR}`}
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={250} ariaLabel="Employment by sector, grouped read" />
    </GLFigure>
  );
}

/**
 * `80-echarts-axis-pointer` — the pointer snapped to a datum rather than free.
 *
 * Snapping is an interaction property and the chart at rest cannot show it, so
 * what this plate contributes is the axis-side half: the pointer carries its own
 * value on the axis, which is the one piece of tooltip chrome that has a home in
 * the existing rules. It is an axis tick that happens to be placed by the
 * pointer, so it takes axis ink.
 */
function AxisPointer() {
  const YEAR = 2019;
  const { backdrop, focus } = sectorSplit(['Construction']);

  const chart = glChart({
    marks: [
      glRuleX([YEAR], { x: (d: number) => d }),
      glMutedLine(backdrop, { x: 'year', y: 'value', z: 'sector' }),
      ...focus.map((s) =>
        glLine(s.rows, { x: 'year', y: 'value', z: 'sector', tone: s.tone, focus: true }),
      ),
      glPoint(
        sectorData.filter((d) => d.year === YEAR && d.sector === 'Construction'),
        { x: 'year', y: 'value' },
      ),
    ],
    // The pointer's own position is labelled on the axis alongside the ordinary
    // ticks, which is what "axis pointer" means and needs no new ink.
    x: glAxisX({ nice: false, values: [2004, 2009, 2014, YEAR, 2024] }),
    y: glAxisY({ label: 'Employment (thousands)' }),
  });

  return (
    <GLFigure
      title="A snapped pointer labels its own position on the axis."
      subtitle={`Employment by sector, pointer snapped to ${YEAR}`}
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={240} ariaLabel="Employment with an axis pointer" />
    </GLFigure>
  );
}

/**
 * `88-echarts-free-cursor` — a crosshair over a dense scatter.
 *
 * Two rules rather than one, and both are chrome. Worth a plate of its own
 * because a crosshair is where painting a pointer in a series hue is most
 * tempting and most wrong: it crosses four hundred marks, and any saturated
 * colour would read as a fifth series running diagonally through the cloud.
 */
function FreeCursor() {
  const at = carRows[Math.floor(carRows.length * 0.4)];

  const chart = glChart({
    marks: [
      glRuleX([at.weight], { x: (d: number) => d }),
      glRuleY([at.economy], { y: (d: number) => d }),
      glPoint(carRows, { x: 'weight', y: 'economy', tone: 'muted' }),
      glPoint([at], { x: 'weight', y: 'economy', tone: 'c-1' }),
    ],
    x: glAxisX({ label: 'Kerb weight (kg)' }),
    y: glAxisY({ label: 'Fuel economy (mpg)' }),
  });

  return (
    <GLFigure
      title="A crosshair over four hundred marks has to be chrome."
      subtitle="Fuel economy against weight with a free cursor at one observation"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={250} ariaLabel="Fuel economy with a cursor" />
    </GLFigure>
  );
}

/**
 * `84-pinned-nested-chart-tooltip` — a tooltip that contains a chart.
 *
 * The nested chart is the interesting half and it is expressible: it is just a
 * second small chart over the selected group's rows. What is not expressible is
 * the *pinning* — the surface it sits on, its shadow, its pointer connector —
 * none of which `grammar.md` rules on.
 *
 * Recorded `partial` for that, plus the layout: the nested chart is placed by the
 * plate above the main one rather than anchored to the selected mark, because
 * anchoring needs the mark's resolved pixel position and a chart definition
 * cannot see it.
 */
function NestedTooltip() {
  const REGION = 'Latin America';
  const { backdrop, focus } = popUp(groupedObservations, { by: 'region', highlight: [REGION] });
  const slot = new Map([...new Set(groupedObservations.map((d) => d.region))].map((r, i) => [r, i]));
  const place = <T extends { region: string }>(rows: readonly T[]) =>
    rows.map((d, i) => ({ ...d, x: (slot.get(d.region) ?? 0) + ((i % 7) - 3) * 0.055 }));

  const main = glChart({
    marks: [
      glMutedPoint(place(backdrop), { x: 'x', y: 'complexity' }),
      ...focus.map((s) => glPoint(place(s.rows), { x: 'x', y: 'complexity', tone: s.tone })),
    ],
    x: glAxisX({
      domain: [-0.62, slot.size - 0.38],
      values: [...slot.values()],
      format: (v) => [...slot.keys()][v] ?? '',
      nice: false,
    }),
    y: glAxisY({ label: 'Complexity index', domain: [-2.7, 1.8] }),
    margin: { bottom: 74 },
  });

  const detail = groupedObservations
    .filter((d) => d.region === REGION)
    .map((d, i) => ({ ...d, i }));
  const detailValues = detail.map((d) => d.complexity);
  const detailPad = (Math.max(...detailValues) - Math.min(...detailValues)) * 0.12;

  const nested = glChart({
    marks: [glPoint(detail, { x: 'i', y: 'complexity' })],
    x: glAxisX({
      label: `${REGION} — ${detail.length} economies`,
      values: [],
      domain: [-0.6, detail.length - 0.4],
      nice: false,
    }),
    y: glAxisY({
      tickCount: 3,
      domain: [Math.min(...detailValues) - detailPad, Math.max(...detailValues) + detailPad],
    }),
    margin: { left: 48, bottom: 40, top: 4 },
  });

  return (
    <GLFigure
      title="The selected group's own observations, drawn rather than listed."
      subtitle="Complexity by region; the pinned panel expands the highlighted group"
      source={SYNTHETIC}
    >
      <Chart {...nested.props} height={110} ariaLabel="Selected group detail" />
      <Chart {...main.props} height={240} ariaLabel="Complexity by region" />
    </GLFigure>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Selection
// ════════════════════════════════════════════════════════════════════════════

/**
 * `81-recharts-interactive-legend` — a legend that toggles series.
 *
 * The static artifact is the legend itself, and the GL position on it is
 * unusual: the spec prefers a *direct label* to a legend wherever the chart
 * allows it, because a label at the end of the line costs the reader nothing and
 * a legend costs them a lookup. So this plate carries both — the legend the
 * entry is about, and the end labels that make it redundant.
 *
 * That redundancy is the finding rather than an oversight. An interactive legend
 * is a control, and once it is only a control the chart still has to be readable
 * without touching it.
 */
function InteractiveLegend() {
  const { backdrop, focus, labelled } = sectorSplit(['Services', 'Agriculture']);

  const chart = glChart({
    marks: [
      glMutedLine(backdrop, { x: 'year', y: 'value', z: 'sector' }),
      ...focus.map((s) =>
        glLine(s.rows, { x: 'year', y: 'value', z: 'sector', tone: s.tone, focus: true }),
      ),
      // `dodge` because three of these five converge in the last decade —
      // Manufacturing and Retail end 7 thousand apart on an axis that runs to
      // 1500, so their labels landed on top of each other. §3.12 does not let
      // one annotation cover another, and this is the case where nothing at the
      // call site can prevent it: it is a property of the data, not of the
      // placement. 90 units is a 14px line at this figure's scale.
      ...endLabels(labelled, { x: 'year', y: 'value', dodge: 90 }),
    ],
    x: glAxisX({ nice: false }),
    y: glAxisY({ label: 'Employment (thousands)' }),
    endLabels: true,
  });

  return (
    <GLFigure
      title="A legend is a control here; the direct labels are what makes it readable."
      subtitle="Employment by sector, with both a legend and end labels"
      source={SYNTHETIC}
      // Rules, because the series are lines — and on this plate the legend mark
      // is doing double duty: it is also the affordance a reader clicks. A
      // control that does not look like the thing it toggles is a worse control,
      // not just a worse legend.
      legend={
        <GLLegend
          items={labelled.map((s) => ({
            label: s.key,
            tone: s.tone,
            mark: 'line' as const,
            focus: true,
          }))}
        />
      }
    >
      <Chart {...chart.props} height={250} ariaLabel="Employment by sector" />
    </GLFigure>
  );
}

/**
 * `82-chart-table-selection` — a chart and a table selecting each other.
 *
 * The chart half of the link is the pop-up effect, unchanged: the selected row
 * takes `c-1` and everything else goes `c-muted`. That §3.1 already answers
 * "what does a selected bar look like" is the useful finding here — selection is
 * emphasis, and the spec has a rule for emphasis.
 *
 * Recorded `partial`: the table is not a chart and the library draws no tables,
 * so only one side of the link is here.
 */
function TableSelection() {
  const SELECTED = 'Crude materials, inedible';
  const { backdrop, focus } = popUp(longRankData, { by: 'name', highlight: [SELECTED] });

  const chart = glChart({
    marks: [
      glMutedBarX(backdrop, { y: 'name', x: 'value' }),
      ...focus.map((s) => glBarX(s.rows, { y: 'name', x: 'value', tone: s.tone })),
      ...focus.map((s) =>
        glLabel(s.rows, {
          x: 'value',
          y: 'name',
          text: (d) => `${d.value}%`,
          tone: s.tone,
          anchor: 'start',
          dx: 8,
        }),
      ),
    ],
    x: glAxisY({ label: 'Share of goods exports (%)' }),
    y: glAxisBand({ domain: longRankData.map((d) => d.name) }),
    margin: { left: 232, right: 48 },
  });

  return (
    <GLFigure
      title="A selected bar is the pop-up effect, not a new visual state."
      subtitle="Share of goods exports by SITC section, one section selected"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={250} ariaLabel="Exports by section, one selected" />
    </GLFigure>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Windows and ranges
// ════════════════════════════════════════════════════════════════════════════

/** The window every range plate shades — one shared span, so they compare. */
const WINDOW_START = daily[Math.floor(daily.length * 0.42)].t;
const WINDOW_END = daily[Math.floor(daily.length * 0.68)].t;

const DAILY_LO = Math.min(...daily.map((d) => d.value)) - 2;
const DAILY_HI = Math.max(...daily.map((d) => d.value)) + 2;

/**
 * A shaded span over a CONTINUOUS x axis.
 *
 * Not `glBandX`, which is `bandX` and takes a single `x` on a BAND scale — it
 * shades one categorical slot, not an interval on a continuum. A span over a
 * continuous axis is an area with two data-driven edges, which is exactly what
 * `glBand` is, so the region is two rows carrying the same constant y extent.
 *
 * That `glBandX`'s doc comment promises "a shaded vertical region spanning
 * x1–x2" and its underlying mark cannot express one is a real defect in the
 * library, and it is recorded in the range specimens' gaps.
 */
function windowBand(x1: number, x2: number) {
  return glBand(
    [
      { t: x1, lo: DAILY_LO, hi: DAILY_HI },
      { t: x2, lo: DAILY_LO, hi: DAILY_HI },
    ],
    { x: 't', y1: 'lo', y2: 'hi' },
  );
}

/**
 * `89-brush-range-selection` — the brushed span as a band.
 *
 * §3.9 already decides this: a band is the LIGHT tone at full opacity, never a
 * translucent main. Both consequences matter for a brush specifically — the
 * selection is the same colour wherever the user drags it, rather than changing
 * over every mark it crosses, and it survives greyscale, because a lightness
 * step does and an alpha does not.
 */
function BrushSelection() {
  const chart = glChart({
    marks: [
      windowBand(WINDOW_START, WINDOW_END),
      glLine(daily, { x: 't', y: 'value', focus: true }),
    ],
    x: timeAxisFor(daily, 't'),
    y: glAxisY({ label: 'Shipments (index)' }),
  });

  return (
    <GLFigure
      title="A brushed range is a band, which makes it greyscale-safe."
      subtitle="Daily shipment index with a selected range"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={230} ariaLabel="Shipment index with a brushed range" />
    </GLFigure>
  );
}

/**
 * `83-focus-context-window` — the selected window, plus the whole series beneath.
 *
 * Two charts on two domains, which is the form's whole idea: the focus chart
 * spends the full width on the window, and the context strip keeps the reader
 * oriented in the series it came from.
 *
 * Recorded `partial`: they are two independent charts placed by the plate. A
 * linked-panel layout would guarantee the context strip's domain contains the
 * focus chart's, which here is only true because the plate pinned both.
 */
function FocusContext() {
  const windowed = daily.filter((d) => d.t >= WINDOW_START && d.t <= WINDOW_END);

  const focus = glChart({
    marks: [glLine(windowed, { x: 't', y: 'value', focus: true })],
    x: timeAxisFor(windowed, 't'),
    y: glAxisY({ label: 'Shipments (index)' }),
  });

  const context = glChart({
    marks: [
      windowBand(WINDOW_START, WINDOW_END),
      glLine(daily, { x: 't', y: 'value', tone: 'muted' }),
    ],
    x: timeAxisFor(daily, 't'),
    y: glAxisY({ grid: false, tickCount: 2 }),
    margin: { bottom: 34, top: 4 },
  });

  return (
    <GLFigure
      title="The focus spends the full width; the context says where it came from."
      subtitle="Daily shipment index, four months in focus over the full fourteen"
      source={SYNTHETIC}
    >
      <Chart {...focus.props} height={200} ariaLabel="Shipment index, focused window" />
      <Chart {...context.props} height={86} ariaLabel="Shipment index, full series" />
    </GLFigure>
  );
}

/**
 * `90-zoomable-time-window` — the same pair after a wheel zoom.
 *
 * Kept separate from the focus/context plate because the design question is
 * genuinely different: a zoom changes the *domain* while a brush changes a
 * *selection*, and the tell is the axis. A zoomed axis relabels itself — the
 * date ticks step down from months to days — where a brushed one does not. That
 * relabelling is `dateTicks` picking the unit from the span, and it happens
 * without the plate asking.
 */
function ZoomableWindow() {
  const zoomed = daily.slice(Math.floor(daily.length * 0.55), Math.floor(daily.length * 0.62));

  const chart = glChart({
    marks: [
      glLine(zoomed, { x: 't', y: 'value', focus: true }),
      glPoint(zoomed, { x: 't', y: 'value' }),
    ],
    x: timeAxisFor(zoomed, 't', { domain: paddedTimeDomain(zoomed) }),
    y: glAxisY({ label: 'Shipments (index)' }),
  });

  return (
    <GLFigure
      title="Zooming past a month makes the axis relabel itself in days."
      subtitle="Daily shipment index over a thirty-day window"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={230} ariaLabel="Shipment index, zoomed" />
    </GLFigure>
  );
}

/**
 * `86-streaming-window-preservation` — a live series holding a fixed window.
 *
 * The static tell is that the *retained* span is shaded and the discarded one is
 * not, so a reader can see the window is fixed rather than growing. Same band
 * rule as the brush; the difference is what the band means, which the subtitle
 * carries because the chart cannot.
 */
function StreamingWindow() {
  const RETAINED = daily.slice(-90);

  const chart = glChart({
    marks: [
      windowBand(RETAINED[0].t, RETAINED[RETAINED.length - 1].t),
      glLine(daily, { x: 't', y: 'value', tone: 'muted' }),
      glLine(RETAINED, { x: 't', y: 'value', focus: true }),
      glPoint([RETAINED[RETAINED.length - 1]], { x: 't', y: 'value' }),
    ],
    x: timeAxisFor(daily, 't', { domain: paddedTimeDomain(daily) }),
    y: glAxisY({ label: 'Shipments (index)' }),
  });

  return (
    <GLFigure
      title="The retained window is shaded, so a reader can see it is fixed."
      subtitle="Daily shipment index; the last ninety days are held in memory"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={230} ariaLabel="Shipment index, streaming window" />
    </GLFigure>
  );
}

/**
 * `91-timeline-playback-scrubber` — the playhead.
 *
 * A playhead is a reference rule that happens to move, so §3.4.2 answers it
 * unchanged: dashed `ink-3`, and the series it crosses stays solid. The part
 * ahead of the playhead is muted and the part behind it saturated, which is the
 * pop-up effect used as a progress encoding rather than as emphasis.
 */
function PlaybackScrubber() {
  const HEAD = Math.floor(daily.length * 0.58);
  const played = daily.slice(0, HEAD + 1);
  const remaining = daily.slice(HEAD);

  const chart = glChart({
    marks: [
      glRuleX([daily[HEAD].t], { x: (d: number) => d }),
      glLine(remaining, { x: 't', y: 'value', tone: 'muted' }),
      glLine(played, { x: 't', y: 'value', focus: true }),
      glPoint([daily[HEAD]], { x: 't', y: 'value' }),
    ],
    x: timeAxisFor(daily, 't'),
    y: glAxisY({ label: 'Shipments (index)' }),
  });

  return (
    <GLFigure
      title="Played and unplayed are the pop-up effect, used as progress."
      subtitle="Daily shipment index with the playhead at 58% of the span"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={230} ariaLabel="Shipment index with a playhead" />
    </GLFigure>
  );
}

/**
 * `87-echarts-synchronized-cursors` — two views, one cursor position.
 *
 * Synchronising is the behaviour; the design question the static plate can
 * answer is whether the cursor should look the same in both views, and it must —
 * a reader linking two panels by a shared position needs the two marks to be
 * identifiably one mark. Both rules here are the same `glRuleX` at the same x.
 */
function SynchronizedCursors() {
  const YEAR = 2013;
  const { backdrop, focus } = sectorSplit(['Services']);

  const top = glChart({
    marks: [
      glRuleX([YEAR], { x: (d: number) => d }),
      glMutedLine(backdrop, { x: 'year', y: 'value', z: 'sector' }),
      ...focus.map((s) =>
        glLine(s.rows, { x: 'year', y: 'value', z: 'sector', tone: s.tone, focus: true }),
      ),
    ],
    x: glAxisX({ nice: false, format: () => '' }),
    y: glAxisY({ label: 'Employment', tickCount: 3 }),
    margin: { bottom: 16 },
  });

  const bottom = glChart({
    marks: [
      glRuleX([YEAR], { x: (d: number) => d }),
      glLine(
        sectorData
          .filter((d) => d.sector === 'Services')
          .map((d, i, all) => ({
            year: d.year,
            growth: i === 0 ? 0 : ((d.value - all[i - 1].value) / all[i - 1].value) * 100,
          }))
          .slice(1),
        { x: 'year', y: 'growth', focus: true },
      ),
      glRuleY([0], { y: (d: number) => d }),
    ],
    x: glAxisX({ nice: false }),
    y: glAxisY({ label: 'Growth (%)', tickCount: 3 }),
    margin: { top: 4 },
  });

  return (
    <GLFigure
      title="One cursor, two views, and it has to be the same mark in both."
      subtitle={`Employment and its growth rate, cursors synchronised at ${YEAR}`}
      source={SYNTHETIC}
    >
      <Chart {...top.props} height={150} ariaLabel="Employment by sector" />
      <Chart {...bottom.props} height={150} ariaLabel="Services employment growth" />
    </GLFigure>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Lanes
// ════════════════════════════════════════════════════════════════════════════

/**
 * Lanes are a ranged bar per event; both lane plates share the geometry.
 *
 * Phase is an ORDERED variable, so `toneRamp` runs it light → main → dark and
 * the ramp order is planned-first: §8c puts the lightest tier at the start so
 * the lightness itself carries the ordering.
 */
const LANE_PHASES = ['Planned', 'In progress', 'Delivered'] as const;

function laneChart(options: { handles: boolean }) {
  const lanes = [...new Set(laneEvents.map((d) => d.lane))];
  const editable = laneEvents.filter((d) => d.label === 'Scenarios');

  return glChart({
    marks: [
      glBarX(laneEvents, { x1: 'start', x2: 'end', y: 'lane', z: 'label', color: 'phase' }),
      glLabel(laneEvents, {
        x: (d) => (d.start + d.end) / 2,
        y: 'lane',
        text: (d) => d.label,
        anchor: 'middle',
      }),
      // The editable range's handles are two data ticks — 8px, twice the axis
      // tick, so they cannot be misread as chrome (§3.4.2).
      ...(options.handles
        ? [
            glTickY(editable, { y: 'lane', x: 'start', tone: 'c-2' }),
            glTickY(editable, { y: 'lane', x: 'end', tone: 'c-2' }),
          ]
        : []),
    ],
    x: glAxisY({ label: 'Days from programme start' }),
    y: glAxisBand({ domain: lanes }),
    color: toneRamp({ tones: 'three', order: [...LANE_PHASES], tone: 'c-1' }),
    variant: { labelHalo: true },
    margin: { left: 116 },
  });
}

/**
 * `85-scrollable-resource-lanes` — overlapping events on named tracks.
 *
 * Scrolling is the interaction; the chart is a ranged bar per event on a point
 * scale of lanes, and it is a genuinely useful form the spec had no plate for.
 * Two lanes carry more than one event, which is what makes it a lane chart
 * rather than a ranged bar chart — the collisions are the reason the tracks
 * exist.
 *
 * Phase is an ORDERED variable (delivered → in progress → planned), so it takes
 * one hue's three-tone ramp rather than three unrelated colours: the lightness
 * carries the ordering and a reader gets it without the legend.
 */
function ResourceLanes() {
  const chart = laneChart({ handles: false });

  return (
    <GLFigure
      title="Two workstreams overlap for a full quarter."
      subtitle="Programme events by workstream, days from start"
      source={SYNTHETIC}
      legend={
        <GLLegend
          items={[
            { label: 'Delivered', tone: 'c-1', step: 'dark' },
            { label: 'In progress', tone: 'c-1' },
            { label: 'Planned', tone: 'c-1', step: 'light' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={250} ariaLabel="Programme events by workstream" />
    </GLFigure>
  );
}

/**
 * `92-editable-event-range` — the same lanes with one range under edit.
 *
 * The handles are the whole specimen and they need no new rule: §3.4.2 already
 * makes a data tick 8px — twice the axis tick — precisely so a tick carrying a
 * value cannot be mistaken for axis chrome. A drag handle is a value the reader
 * can move, which is the same claim.
 */
function EditableRange() {
  const chart = laneChart({ handles: true });

  return (
    <GLFigure
      title="An edit handle is a data tick, at twice the axis tick's length."
      subtitle="Programme events by workstream; the scenarios range is under edit"
      source={SYNTHETIC}
      legend={
        <GLLegend
          items={[
            { label: 'Delivered', tone: 'c-1', step: 'dark' },
            { label: 'In progress', tone: 'c-1' },
            { label: 'Planned', tone: 'c-1', step: 'light' },
            { label: 'Under edit', tone: 'c-2' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={250} ariaLabel="Programme events, one range editable" />
    </GLFigure>
  );
}

// ── Renderers ───────────────────────────────────────────────────────────────

export const INTERACTION_RENDERERS: Record<string, () => ReactNode> = {
  'ts-34-pointer-tooltip': PointerTooltip,
  'ts-35-grouped-tooltip': GroupedTooltip,
  'ts-80-echarts-axis-pointer': AxisPointer,
  'ts-88-echarts-free-cursor': FreeCursor,
  'ts-84-pinned-nested-chart-tooltip': NestedTooltip,
  'ts-81-recharts-interactive-legend': InteractiveLegend,
  'ts-82-chart-table-selection': TableSelection,
  'ts-89-brush-range-selection': BrushSelection,
  'ts-83-focus-context-window': FocusContext,
  'ts-90-zoomable-time-window': ZoomableWindow,
  'ts-86-streaming-window-preservation': StreamingWindow,
  'ts-91-timeline-playback-scrubber': PlaybackScrubber,
  'ts-87-echarts-synchronized-cursors': SynchronizedCursors,
  'ts-85-scrollable-resource-lanes': ResourceLanes,
  'ts-92-editable-event-range': EditableRange,
};
