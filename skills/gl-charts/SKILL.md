---
name: gl-charts
description: Build web charts that follow the Growth Lab data-visualization spec, using the GL themed layer over TanStack Charts v0. Use this skill when the user asks for a chart, plot, dashboard, or visualization for the web, React, a site, or an app — anything rendered in a browser rather than through R/ggplot.
compatibility: Requires Node and a TS-aware bundler. Peers pinned to @tanstack/charts 0.6.5 (pre-alpha) + @tanstack/charts-scales; the React figure chrome additionally needs @tanstack/react-charts and React 19. The shapes entry owns the layout dependencies — d3-hierarchy (treemap, tree, sunburst), d3-sankey, d3-force, d3-delaunay and d3-contour — and a choropleth takes a d3-geo projection you supply. For static charts in R/ggplot, use gl-ggplot or gl-graph-modes instead.
metadata:
  author: growth-lab
  version: "2.0"
---

# GL Charts (web)

You build browser charts that follow the Growth Lab data-visualization spec.
The runtime is [`packages/gl-charts`](../../packages/gl-charts/) — a **thin layer**
over TanStack Charts v0. It carries the palette, typography, axis geometry and
mark defaults; you compose the chart.

There are **no whole-chart presets** for line, scatter, bar or stacked charts, on
purpose. TanStack can express those natively, so the layer only supplies defaults
and you write the chart out in a dozen lines — which keeps the whole TanStack API
available to you instead of whatever an option bag anticipated.

`@growth-lab/gl-charts/shapes` carries what TanStack *cannot* express. Two kinds
of thing live there, and the difference decides how you call them:

- **Whole-chart functions**, where the paint decision is not freely yours —
  `glRadarChart`, `glTreemapChart`, `glBoxplotChart`, `glViolinChart`,
  `glChoroplethChart`, `glSankeyChart`, `glDonutChart`, and `glPolarChart` as
  the polar counterpart to `glChart`.
- **Marks and layouts that return data**, which you then paint yourself under
  the normal rules — the whole `glRadial*` family, plus `glForceLayout`,
  `glDelaunayEdges`, `glVoronoiCells`, `glContourDensity` and `glContourGrid`.
  How you draw a network is editorial; §3.4.2 already decides how each mark is
  painted.

**Which skill:** `gl-charts` for the web. `gl-ggplot` / `gl-graph-modes` for
R/ggplot charts destined for reports, PDFs, and slides. Same grammar, different
medium — don't mix runtimes in one deliverable.

Rules and values: [`docs/data-vis-spec-core.md`](../../docs/data-vis-spec-core.md).
Source of truth for every token: [`grammar.md`](../../grammar.md), encoded
machine-readably in [`packages/gl-charts/tokens.json`](../../packages/gl-charts/tokens.json).

**`§` citations span two files.** The numbering is `grammar.md`'s throughout, but
the sections covering marks it never had to name — §3.4.1–§3.4.3 (treemap
geometry, chrome vs. data, binned bars), §3.8–§3.12 (radial, intervals, derived
series, legends, annotations) and Decision Rules 11–12 — are **proposed, not
ratified**, and live in
[`packages/gl-charts/SPEC.md`](../../packages/gl-charts/SPEC.md). Everything else
(§1, §2, §3.1–§3.7, Rules 1–10) is in `grammar.md` and is binding. When the two
disagree, `grammar.md` wins and `SPEC.md` Part A says so explicitly.

## Setup

`@growth-lab/gl-charts` is **not on npm** — install it from this repo by path. Its
`exports` point at raw TypeScript, so the project needs a TS-aware bundler; there
is no `dist/` to import.

```bash
npm install /path/to/gl-design/packages/gl-charts
npm install @tanstack/charts@0.6.5 @tanstack/charts-scales@0.6.5 @tanstack/react-charts@0.6.5
```

```tsx
import {
  glChart, glLine, glMutedLine, glAxisY, popUp, endLabels, yearAxisFor,
} from '@growth-lab/gl-charts';
import { GLFigure, GLLegend } from '@growth-lab/gl-charts/react';
import { Chart } from '@tanstack/react-charts';
import '@growth-lab/gl-charts/theme.css';   // ← REQUIRED, see below
```

**The stylesheet is not optional.** TanStack bakes gridline opacity (0.11), axis
opacity (0.28) and tick-label size (10–11px) into presentation attributes with no
API to change them; `theme.css` overrides them in CSS. Without it, charts render
with washed-out axes and undersized type, off-spec on three counts. It also means
**GL charts stay on the SVG renderer** — the Canvas renderer rasterizes and no
selector can reach it.

## Before writing any chart code

Work these in order. The first two are where GL charts are usually won or lost.

### 1. What is the finding?

The title is a **sentence stating the finding, ending in a period** — "Copper and
coal carried the Mongolian boom." Not a label, not "Exports by category". If you
can't state the finding, you don't yet know what the chart is for. Ask.

### 2. Can a pop-up carry it?

> Color should only be used when it is necessary. When you have categorical data,
> you do not have to color every category differently.

**Ask this before reaching for a categorical palette, every time.** Paint the
supporting data in `c-muted` as one mark and reserve a saturated hue for the one
or two series the reader actually needs to track. The muted layer carries the
trend; the highlight carries the finding.

```tsx
const { backdrop, focus } = popUp(rows, { by: 'country', highlight: ['Mongolia', 'Chile'] });

const chart = glChart({
  marks: [
    glMutedLine(backdrop, { x: 'year', y: 'index', z: 'country' }),
    ...focus.map((s) =>
      glLine(s.rows, { x: 'year', y: 'index', z: 'country', tone: s.tone, focus: true }),
    ),
    ...endLabels(focus, { x: 'year', y: 'index' }),   // dark tone, automatically
  ],
  x: yearAxisFor(rows, 'year'),
  y: glAxisY({ label: 'Index (2010 = 100)' }),
  endLabels: true,                                    // widens the right margin
});

<Chart {...chart.props} height={300} ariaLabel="Copper export index" />
```

`popUp` takes at most two highlighted series and warns past that. Each focus
series carries its own tone, so a label cannot land on the wrong hue.

The backdrop mark matches the geom: **`glMutedLine`, `glMutedPoint`, `glMutedBar`,
`glMutedBarX`.** They are `gl*` + `tone: 'muted'` and nothing else, so reach for
the one that matches what you are drawing rather than muting by hand.

### 3. Then pick the chart type

| The story is… | Build from | Notes |
|---|---|---|
| Relationship between two continuous variables | `glPoint` | Overlap is desirable — it shows clustering |
| Change over a continuous variable, usually time | `glLine` | ≤4 colored series; beyond that, mute and highlight |
| How a total composes | `glBar` + `stackOrder` + `variant: { stacked: true }` | ≤6 categories, largest mean share at the bottom |
| Composition flowing over time | `glArea` + `stackOrder` | Natural home for a three-tone ramp; **no** `stacked` variant |
| Ranked comparison across entities | `glBar` + `popUp` | The ranked-list pop-up |
| Composition across many very uneven shares | `glTreemapChart` | shapes entry; flat or two-level |
| One entity profiled across 4–8 dimensions | `glRadarChart` | shapes entry; shared normalized scale |
| The **spread** of a distribution, not a point | `glBoxplotChart` | shapes entry; IQR box, 10th/90th whiskers |
| Spread where the shape itself is the story | `glViolinChart` | shapes entry; needs raw observations |
| A value mapped over regions | `glChoroplethChart` | shapes entry; `kind: 'diverging'` only with a real midpoint |
| Rank where the labels are long | `glStemX` + `glPoint`, or `glBarX` | A lollipop carries the same value with less ink; horizontal keeps labels upright |
| A gap between two states per entity | `glLink` + `glPoint` ×2 | Dumbbell — the connector is the finding, so it takes the dark tone |
| A total decomposed into signed steps | `waterfall` + `glBar` + `signColor` | Every bar follows the sign encoding, the total included (§3.6) |
| The **shape** of one distribution | `binValues` + `glBar` + `glAxisBin` | Histogram. `glAxisBin`, never `glAxisBand` — bins must abut |
| Where values concentrate on a plane | `glCell`, or `glHexbinLattice` → `glHexbin`, + `glSequentialColor` | Cells are tiles, not points: full opacity, never 0.8. Hand the lattice itself to `glHexbin` — passing bins with a pixel radius is how a hexbin ends up with gaps in it |
| A value plus its uncertainty | `glBand` **then** `glLine` | Light tone behind, in that order — marks paint in array order |
| A cyclic dimension (hour, month, bearing) | `glRadialLine` / `glRadialDot` + `glPolarChart` | Wrapping is the point: December sits next to January |
| One part-to-whole split, ≤4 parts | `glDonutChart` | Above four, it is a ranked bar chart drawn badly — see below |
| A quantity flowing between stages | `glSankeyChart` | shapes entry; columns default to **one hue** — they are stages, not competing subjects. Ribbons take the source node's *light* tone (see below) |
| Which entities relate to which | `glForceLayout` → `glLink` + `glPoint` | shapes entry; returns positions, you paint. Deterministic by construction — same input, same layout |
| A hierarchy with a parent-child shape worth seeing | `d3-hierarchy` `tree()` → `glLink` + `glPoint` + `glLabel` | A tree edge is a **connector** (§3.4.2): dark tone, line weight, butt cap |
| Where a cloud of points is dense | `glContourDensity` → `glGeoShape` | shapes entry; levels walk a sequential ramp (§12). Emits GeoJSON, so it travels a coastline's route |
| A measured surface, not a point cloud | `glContourGrid` → `glGeoShape` | shapes entry; marching squares over a grid you supply |
| Nearest-neighbour regions on a plane | `glVoronoiCells` / `glDelaunayEdges` | shapes entry; returns geometry. Usually hit-testing rather than the finding itself |

**Two rules that decide a mark's colour before its shape does.**

*Chrome or data?* (§3.4.2) The same geometry does two jobs. A line across the
plot is a **reference rule** when it marks a threshold you brought to the chart —
`glRuleX` / `glRuleY`, dashed `ink-3`, and it deliberately **ignores `tone`** — and
a **stem** when it is the chart's own encoding — `glStemX` / `glStemY`, series
tone, solid. Never paint a threshold in `c-1`: it spends the institutional blue on
something that is not a finding, and the reader then has to work out that this
blue line means something different from the other blue line.

*Derived or measured?* (§3.10) A moving average or a fit keeps its **parent's
hue** and separates by weight and dash. A new hue claims a new subject.

```tsx
glLine(rows, { x: 'date', y: 'v', tone: 'c-1' }),
glLine(movingAverage(rows, { x: 'date', y: 'v', window: 12 }),
       { x: 'date', y: 'v', tone: 'c-1', strokeDasharray: '6 4' }),
```

### 3b. Radial charts — when they earn it

§3.8 admits a narrow set, and the test is whether the dimension is genuinely
cyclic or the *profile* matters more than any single value:

- **Radar** — 4–8 normalised dimensions, ≤3 series. The polygon shape is the finding.
- **Polar line / scatter** — a real cycle. Hour of day, day of year, compass bearing.
- **Donut** — one part-to-whole, **≤4 slices**, directly labelled. The hole holds the total.
- **Gauge, rose, radial bars** — one value against a range, or cyclic magnitude.

Prefer a **donut to a pie** (the hole costs nothing) and a **treemap to a
sunburst** (outer rings inflate with radius, so equal areas read as unequal).
Above four slices, group the tail into "Everything else" or switch form —
`glDonutChart` warns and still draws, so you get the chart *and* the reason it is
the wrong one.

### 3c. A ribbon is not a hairline connector

§3.4.2 lists a Sankey link among its CONNECTORS, which take the series **dark**
tone. That ruling was written for marks two pixels wide — a dumbbell, a
candlestick wick, a boxplot whisker — and it does not scale to forty: overlapping
dark ribbons at full opacity bury the node rectangles they connect.

`glSankeyChart` therefore paints a ribbon in its source node's **light** tone,
following §3.3. This is **the one place in this package that knowingly departs
from `grammar.md`**, the fix belongs upstream in §3.4.2, and `linkTone` takes the
literal reading back if you need it. Don't generalise the exception: a `glLink`
dumbbell connector is still the dark tone.

### 4. Two or three categories sharing a parent?

Goods vs. services, low/medium/high — **one hue at two or three tones**, not
unrelated colors. `toneRamp` builds it as a chart-level color scale, which is
load-bearing: TanStack stacks *within* a mark, so one mark per tone would draw
every band from the baseline instead of stacking.

```tsx
const rows = stackOrder(data, 'tier', order);   // order is bottom-to-top
glChart({
  marks: [glArea(rows, { x: 'year', y: 'share', z: 'tier', color: 'tier' })],
  color: toneRamp({ tones: 'three', order, tone: 'c-1' }),   // light → main → dark
  x: yearAxisFor(rows, 'year'),
  y: glAxisY({ label: 'Share of exports (%)' }),
});
```

`two` runs `main → light` (§8b — the primary category anchors the bottom in the
full hue); `three` runs `light → main → dark` (§8c — an ordered variable needs a
monotonic ramp). The three-tone stack is the **only** place in the spec where a
dark tone is used as a fill.

## Rendering a figure

A chart is five elements, not one. `<GLFigure>` carries the four the chart itself
can't: figure label, serif title, subtitle, source line.

```tsx
<GLFigure
  number={2}
  title="Mongolia and Chile broke from the pack on copper exports."
  subtitle="Index of copper export value (2010 = 100), twelve mineral economies"
  source="Source: Growth Lab analysis of UN Comtrade. HS 2603, 7402."
>
  <Chart {...chart.props} height={300} ariaLabel="Copper export index" />
</GLFigure>
```

- `source` is **required on every figure**. There is no source-less GL chart.
- `ariaLabel` is required by TanStack.
- Spread `chart.props` — it carries the definition *and* the class the CSS-only
  rules need. Never hand-write that class; `glChart({ variant: … })` sets it, and
  the shape functions set their own.
- Reach for `<GLLegend>` only when direct labels would collide.
- **Pass the legend to `GLFigure`, not into `children`.** `legend={…}` puts it
  below the plot and flush left; `legendPlacement="right"` moves it beside the plot
  for stacked bands, where the entries then have to run top-to-bottom in the
  stack's order. Dropping a `<GLLegend>` into `children` puts it wherever the
  JSX happened to sit it, which is how this package once had legends in three
  different places across one gallery.
- **Every item declares the mark it names.** `mark` defaults to `'fill'` — right
  for bars, stacks and tiles, wrong for everything else:

  | Series | `mark` |
  |---|---|
  | bar, stacked band, area, treemap tile, choropleth bin, arc | `'fill'` (default) |
  | scatter point or bubble | `'point'` |
  | line | `'line'` (add `focus` for a 2.4px key, `dot` for point markers) |
  | moving average, fit, forecast | `'derived'` — the same rule, dashed |
  | band, interval, fan, radar polygon | `'band'` — light fill *with* a dark stroke |
  | threshold, target, identity line | `'reference'` — dashed `ink-3`, `ink-2` label |

  Tone still comes from `tone` (+ `step` for a one-hue stack); the label text is
  always the dark tone.
- **A binned or continuous encoding takes `<GLRampLegend scale={…}>`**, not a set
  of swatches — a heatmap, hexbin, calendar or contour set. Hand it the *same*
  scale object the marks are painted from and it reads the bins and cut points
  back off it, so the legend cannot disagree with the plot.

## Hard rules

1. **The dark tone is for strokes and text — never a fill** (except the three-tone
   stack). Every label, legend entry, callout and annotation tied to a colored
   mark uses that mark's **dark** tone, muted series included. WCAG AA, not taste.
   **The exception is a label sitting *on* a fill** — a treemap tile, a heatmap
   cell, a choropleth region. That rule is about text on *paper*; `c-1-dark` on
   `c-1` measures 2.5:1. Call `glLabelInkOn(fill)` and it follows the fill's
   luminance instead. Never hand-pick white or ink for an on-fill label.
2. **0.8 opacity is for overlap only** — scatter circles, on fill *and* stroke
   together, matched. Bars, areas, tiles and choropleths stay at full opacity.
3. **Never both X and Y gridlines** unless the chart is genuinely dense. The axis
   presets put them on Y, where readers estimate values.
4. **Year axis takes no label** — the ticks already say what it is. Use
   `yearAxisFor(rows, x)`; it has no label parameter to misuse.
5. **Colors are spent in order** — c-1, then c-2, then c-3. Needing more than six
   means the chart type is wrong.
6. **No monospace anywhere.** Numerals are Inter with `tabular-nums`.
7. **12px is the floor** for in-chart text. Labels that don't fit are dropped,
   never shrunk.
8. **Never hard-code a value.** Import it (`categorical['c-1'].dark`, `muted.main`,
   `series(i)`, `geometry.lineWidth`, `typeRoles.axisLabel.size`). Every value is
   generated from `tokens.json`; a literal in chart code is a bug.
9. **A legend mark is a miniature of the mark it names** (§3.11). A line gets a
   rule, a scatter a stroked dot, a band a light square with a dark stroke. One
   square for everything tells the reader the wrong geom — and on a composed
   chart it makes the figure unreadable.
10. **An annotation never covers what it names** (§3.12). Clear the mark's
    *rendered* edge by `geometry.annotationClearance`, measured off the real
    radius — `clearance(side, r)` returns the matching `anchor` and offset
    together so the two cannot disagree. On the side with open plot space; on a
    mark that points, the side it points. Use `anchorWithin(x, rows)` near a
    panel edge so a label reads inwards instead of out through the axis, and
    `glLeader` when nothing is clear.

## Going off the beaten path

`glDefaults(kind, options)` merges the spec's defaults into **any** TanStack mark,
including ones the package never wrapped:

```tsx
import { dot } from '@tanstack/charts';
dot(data, glDefaults('point', { x: 'gdp', y: 'eci', tone: 'c-3' }));
```

The sixteen kinds: `line`, `point`, `area`, `bar`, `tile`, `region`, `label`,
`annotation`, `rule`, `stem`, `connector`, `tick`, `arrow`, `vector`, `leader`,
`band`. That union **is** the documented coverage boundary — `glDefaults` on a
mark whose question isn't "what fill, stroke, opacity and size?" returns a
confidently wrong answer, so if your mark isn't one of these sixteen, don't route
it through the table.

Everything else composes. This is the shape of the surface, not the whole of it —
`npm run docs` builds the exhaustive reference, with every signature, option and
measured default:

| For | Reach for |
|---|---|
| Axis presets | `glAxisY` `glAxisX` `glAxisYear` `glAxisYearBand` `glAxisBand` `glAxisBin` `glAxisPoint` `glAxisPercent` `glAxisLog` `glAxisTime` |
| Series and highlighting | `popUp` `toSeries` `seriesKeys` `stackOrder` `toneRamp` `fanTones` `series(i)` `resolveTone` |
| Direct labels and annotation | `endLabels` `clearOf` `clearance` `anchorWithin` `dodgeAnchors` `glLeader` |
| Ticks and time | `yearAxisFor` `timeAxisFor` `yearTicks` `dateTicks` `toEpoch` `scaleLog` |
| Colour scales | `glSequentialColor` `glDivergingColor` `glOrdinalColor` `scaleSequential` `scaleDiverging` |
| Deriving data before you draw | `movingAverage` `linearFit` `binValues` `ecdf` `stepPoints` `waterfall` `lagPairs` `signColor` `glQuantile` `glSummarize` `glDensity` |
| Margins | `glMargin` `glMarginEndLabels` `glPolarMargin` `glRadarMargin` |

Three TanStack facts that will otherwise cost you an hour:
`ruleY`/`ruleX` span the whole plot (use `link` for a bounded segment);
`RectOptions.fill` and `DotOptions.fill` are plain strings, not channels (an
ordered per-datum fill routes through the chart-level color scale); and a
definition built by hand still needs `glChartProps(variant)` for its class.

## Before you call it done

Run the gates. The audit measures the rendered DOM against the tokens and exits
non-zero on any finding:

```bash
cd packages/gl-charts
npm run check                                      # tokens, types, unit tests
npm run gallery && open gallery/out/compare.html   # render + audit + PDF diff
```

Then read these against the rendered chart, not the code:

- [ ] Title states a finding and ends in a period; source line present
- [ ] Was a pop-up considered? If the chart is polychrome, can it justify each hue?
- [ ] Every label/legend entry in the **dark** tone of its mark
- [ ] Each legend mark is the geom it names — rule for a line, dot for a
      scatter, light-and-stroked square for a band; ramp for a binned fill
- [ ] Legend below the plot and flush left, or right and in stack order
- [ ] No annotation touches its own mark, another series, an axis, or the frame
- [ ] Ticks outward; gridlines on one axis only; nothing below 12px
- [ ] Sequential ramp for ordered data; diverging **only** with a real midpoint

## Known constraints

TanStack Charts is **pre-alpha** and has shipped API changes in patch releases, so
the peers are pinned exactly. Every workaround this package carries has an
**expiry test** in
[`packages/gl-charts/tests/constraints.test.ts`](../../packages/gl-charts/tests/constraints.test.ts):
each one asserts the TanStack limitation still exists and names the CSS rule or
workaround to delete when it stops existing. Read that file rather than trusting a
prose list — after a version bump, `npm run check` tells you what changed and
`npm run gallery` tells you whether it still looks right.

The one deviation worth knowing up front: the axis-label gap is 8px, not the
spec's 20px. TanStack's numeric `offset` measures from the axis line — the
reference the spec forbids, because wide ticks then collide — and only `'auto'`
measures from the tick label, where it hardcodes 8px. The axis presets use
`'auto'`: correct reference, tighter gap.

Three absences to plan around, because no workaround exists for them:

- **No time scale.** TanStack ships band, linear, ordinal and point — nothing
  temporal — so dates reach a chart as epoch milliseconds. Use `timeAxisFor(rows,
  x)`, which pins the ticks to both endpoints and picks the unit from the span,
  and read your x channel through `toEpoch`.
- **No interaction layer.** Focus states, crosshairs and tooltips are demonstrated
  on the TanStack docs site but do not exist in the pinned release, and the spec
  has no ruling for them either. Every chart this package builds is static.
- **No small multiples.** `facet` / `facetChart` are unwrapped, and `glMargin` is a
  single-chart margin. Build a grid of separate `<GLFigure>`s if you need one.

Coverage against TanStack's full example gallery — what composes today and what
does not — is measured in
[`packages/gl-charts/reference/tanstack-example-coverage.md`](../../packages/gl-charts/reference/tanstack-example-coverage.md).

## Recipes

[`packages/gl-charts/gallery/catalog.tsx`](../../packages/gl-charts/gallery/catalog.tsx)
has one worked example per figure in the spec PDF — composed only from this
package, rendered in Chrome and audited against the tokens on every
`npm run gallery`, then diffed against a crop of the PDF page it mirrors. Copy the
plate closest to what you need. Those plates are the recipes, and because they are
rendered and audited every run, they cannot quietly stop being true.
