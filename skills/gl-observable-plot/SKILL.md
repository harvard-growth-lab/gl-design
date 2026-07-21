---
name: gl-observable-plot
description: Apply the Growth Lab design system to Observable Plot charts. Use this skill when building JavaScript/TypeScript visualizations with @observablehq/plot (Observable notebooks, Framework, or ESM/Vite apps) so they follow GL visual standards — colors, typography, sizing, and the mute-then-highlight pattern.
compatibility: Requires @observablehq/plot >= 0.6 and a browser (or jsdom for Node SSR). The bundled fonts are woff2; load gl-fonts.css so "Inter" / "Source Serif 4" resolve. The assets are authored in TypeScript — use them in any TS-aware runtime or bundler (Observable, Vite, Deno, esbuild); for a plain-JS project, transpile gl-plot.ts to .js first (gl-plot.d.ts is types only, not a runtime import).
metadata:
  author: taimur-shah
  version: "1.0"
---

# GL Observable Plot Design System

This skill tells you how to produce [Observable Plot](https://observablehq.com/plot/)
charts that follow the Growth Lab visual grammar (Source Serif 4 + Inter; the
4-layer warm ink ramp; the categorical palette with light/main/dark tones;
mute-then-highlight). It is the Plot analogue of `gl-ggplot`.

**Why Plot is the most literal encoding in the kit.** Nil's grammar is specified
in CSS px, and Observable Plot is px-native at render size: `strokeWidth: 2`
*is* 2px, `fontSize: "12px"` *is* Nil's 12px chart text. Unlike the ggplot theme
(which converts px → pt → linewidth), nothing here is rescaled. Keep every value
identical to `grammar.md`.

## Setup

Import the theme alongside Plot, and load the fonts once per page:

```ts
import * as Plot from "@observablehq/plot";
import { glPlot, glLine, glDot, glBarY, GL, highlight, glColorSequential } from "./assets/gl-plot.ts";
import "./assets/gl-fonts.css";   // registers Inter + Source Serif 4 as web fonts
```

- **Path:** under the installed plugin the assets live at
  `${CLAUDE_PLUGIN_ROOT}/skills/gl-observable-plot/assets/`. Copy `gl-plot.ts`
  and `gl-fonts.css` into your app, or import them directly from that path if
  your bundler can reach it. `gl-plot.d.ts` ships the type surface only (no
  runtime exports) — a plain-JS project transpiles `gl-plot.ts` to `.js`; it
  never imports the `.d.ts`.
- **Fonts:** `gl-fonts.css` points at the woff2 files under `assets/fonts/`.
  Rewrite the `url()`s to wherever your app serves them — the family *names*
  (`"Inter"`, `"Source Serif 4"`) are what must stay exact.
- **Observable notebooks:** paste `gl-plot.ts`'s contents into a cell (or import
  it as a notebook file), and put the `@font-face` rules in an `html\`<style>…\``
  cell.
- **Node / server-side rendering:** pass a `document` (jsdom) through
  `glPlot({ document, … })` — the option passes straight to `Plot.plot`.

Then render with `glPlot(...)` instead of `Plot.plot(...)`. It applies the GL
root style (paper background, ink_2 text, Inter, 12px, tabular figures) and GL
gridlines — everything else you'd pass to `Plot.plot` (including the `color`
scale) passes straight through. For GL colors, pass a scale helper: `glColor()`
for categorical, `glColorSequential()` / `glColorDiverging()` for continuous.

```ts
glPlot({
  marks: [
    glLine(data, { x: "year", y: "value", z: "country" }),                        // muted backdrop
    glLine(focus, { x: "year", y: "value", stroke: highlight, strokeWidth: 2.4 }), // focus, painted last
  ],
});
```

## What the theme provides

After importing from `gl-plot.ts`:

| Export | What it is |
|--------|-----------|
| `GL` | Full token table (`GL.c_1`, `GL.ink_2`, `GL.gridline`, …) — see below |
| `highlight` | `GL.c_1` (`#2F87C8`) — main blue, the default data focus (fills, highlighted lines) |
| `highlight_dark` | `GL.c_1_dark` (`#1A5A8E`) — the **stroke** on a highlighted dot and the **label** tied to it (WCAG AA) |
| `lead_finding` | `GL.c_2` (`#CC4948`) — main red, stark / lead-finding emphasis (sparingly) |
| `lead_finding_dark` | `GL.c_2_dark` (`#8A2C2B`) — stroke/label for the lead-finding mark |
| `accent` | `GL.accent` (`#1A5A8E`) — **non-data UI chrome only** (eyebrows, links). Never a data fill |
| `c_muted` | `GL.c_muted` (`#AFB5BE`) — the "everyone-else" grey |
| `GL_STROKE` | Line widths in px: `axis` 1, `line` 2, `lineFocus` 2.4, `mapBorder` 0.5 |
| `GL_FONT` | `size` 12, `titleSize` 14, and the `sans` / `serif` family stacks |
| `GL_SIZE` | Named figure sizes in px (`full`, `full_tall`, `full_square`, `half`, `slide`) — mirror the ggplot recipe; spread into `glPlot` |
| `glDark()` | Maps any main/light tone to its dark partner — for label/stroke color |
| `glStyle` | The root `style` object `glPlot` applies (paper bg, ink_2 text, Inter, 12px, tabular) |
| `glColor()` | Discrete categorical color scale (`{ range: […] }`) |
| `glColorSequential()` | Continuous sequential scale (ordered, darker = higher) |
| `glColorDiverging()` | Continuous diverging scale, hue boundary at `pivot` (default 0) |
| `glLine` / `glDot` / `glBarY` / `glBarX` / `glAreaY` | Mark helpers pre-filled with GL geom defaults |
| `glRectY` / `glRectX` | Histogram bars (pair with `Plot.binX`/`binY`) |
| `glCell` | Heatmap cells (tiles abut, no stroke/inset per §3.4; pair with a sequential scale) |
| `glGeo` | Choropleth / geo polygons (0.5px `ink_3` borders) |
| `glBoxY` / `glBoxX` | Box plots that recede (background-distribution pattern, Nil §11b) |
| `glText` | Text annotation with the paper halo; dark-tones a series label automatically |
| `glZeroLine` / `glThreshold` / `glTrend` | Zero baseline / dashed reference / ink_4 trend |
| `glGridY` / `glGridX` | GL gridlines (`#D8D4CC`, 1px) |
| `glAxisLines` | Bottom + left axis lines (1px `ink_2`) — drawn by `glPlot` by default; call directly only if you set `axisLines: false` |
| `glPlot()` | GL-themed `Plot.plot()` — the wrapper you call |
| `glSerialize()` | Serialize a glPlot element to a valid standalone SVG string (injects `xmlns` + a paper `<rect>` for SSR/raster; rule 11) |
| `glColorbar()` | SSR-safe continuous colorbar (inline `<linearGradient>`) — the `legend:true` replacement for a sequential/diverging scale, which crashes under jsdom (§14) |
| `glPalettes` | Named palette table (categorical, sequential_*, diverging_*, sector palettes) |

### Tokens in `GL`

| Token | Hex | Use |
|-------|-----|-----|
| `GL.ink` | `#1A1714` | Headings, strong emphasis |
| `GL.ink_2` | `#2C2823` | Body, axis text, ticks, axis lines |
| `GL.ink_3` | `#4F4A42` | Subtitles, captions, reference thresholds, map borders |
| `GL.ink_4` | `#9A9389` | Faint markers, trendlines |
| `GL.accent` | `#1A5A8E` | Eyebrows, figure labels, links — = `GL.c_1_dark` |
| `GL.gridline` | `#D8D4CC` | In-chart gridlines |
| `GL.c_1`..`GL.c_6` | (palette) | Categorical **main** tones (fills) |
| `GL.c_1_dark`..`GL.c_6_dark` | (palette) | **Dark** tones — strokes + all text |
| `GL.c_1_light`..`GL.c_6_light` | (palette) | **Light** tones — backgrounds, faded, ramp tail |
| `GL.c_muted` | `#AFB5BE` | "Everyone else" grey |
| `GL.c_muted_dark` | `#5F6773` | Strokes / labels for muted series |

> **`GL` is a downstream copy of `grammar.md`.** If a hex here ever disagrees
> with `grammar.md`, `grammar.md` wins and this file is the bug. When you change
> a token, change it in `grammar.md` first, then here (and in every other
> downstream encoding).

## How GL maps onto Plot's styling surface

Observable Plot exposes styling at three levels; the theme wires GL into each:

| Plot surface | What it controls | GL wiring |
|--------------|------------------|-----------|
| Root `style` (string or object) | `background`, text `color` (marks default to `currentColor`), `fontFamily`, `fontSize`, `fontVariantNumeric` | `glStyle` — paper bg, ink_2 text, Inter, 12px, tabular figures |
| `color` scale (`{ type, scheme, range, domain, interpolate, pivot }`) | How a `fill`/`stroke` channel maps values → colors | `glColor` / `glColorSequential` / `glColorDiverging` build the `range`/`pivot` |
| Mark options (`fill`, `stroke`, `strokeWidth`, `fillOpacity`, `strokeLinejoin`, `textStroke`, …) | Per-mark appearance | `glLine` / `glDot` / `glBarY` / … pre-fill the GL geom defaults |

Two Plot conveniences line up with the grammar for free:

- **Marks default to `currentColor`.** Setting `color` once on the root style
  (which `glStyle` does → `ink_2`) paints every tick label and axis text in the
  right ink. You rarely touch axis text color.
- **`fontVariant` defaults to `"tabular-nums"` on quantitative axes.** Numeric
  tick labels are already tabular (grammar §3.7); `gl-fonts.css` extends tabular
  figures to every other text mark via the `.gl-plot text` rule.
- **The paper halo** (grammar §3.5) comes from two different options depending
  on the mark: a **data text mark** (`Plot.text`) haloes via `stroke` +
  `strokeWidth` (Plot auto-sets `paint-order: stroke` so it sits behind the
  glyphs) — `glText` does this; an **axis mark** haloes its tick labels via
  `textStroke` + `textStrokeWidth`. Don't cross them: `Plot.text` ignores
  `textStroke`.

**Why this shape is the principled one.** Plot has **no global mark-defaults
registry** (there's no Plot equivalent of ggplot's `update_geom_defaults` or
`ggplot2.discrete.colour`), so a GL default that must be *data-driven* — "an
untyped line is muted; the focus opts in" — can only live in a **mark wrapper**;
that's why `glLine`/`glDot`/… exist rather than a stylesheet. Conversely, chrome
that Plot styles by default (background, text ink, font) is set on the root and
scoped by `:where(.className)` at **zero CSS specificity** — Plot *designed* that
to be overridden — so GL wires it through the root `style` object and the
`.gl-plot` stylesheet (`gl-fonts.css`) instead of re-implementing it in marks.
And `glPlot` injects **no color scale**, because forcing a discrete `range` would
corrupt Plot's scale-type inference for continuous encodings (rule 3). The rule of
thumb: **wrappers for data-driven mark defaults, `style` + class CSS for chrome,
explicit scale helpers for color** — each GL value enters through the Plot surface
built to carry it, and nothing fights Plot's own inference.

## Transforms first — let Plot shape the data

**Prefer an Observable Plot transform over an imperative data-wrangling script.**
Plot's transforms (`bin`, `group`, `stack`, `window`, `map`, `normalize`,
`select`, `dodge`, `sort`, …) derive data *as part of the plot spec* — they run
inside the mark rather than in a separate pass you have to write, name, and keep
in sync. This is Plot's headline feature and the single biggest reason to reach
for it over hand-rolled D3.

A transform is passed **as the mark's options argument** — usually as the second
argument, wrapping the channel options: `mark(data, transform(outputs, options))`.
**Every GL mark helper is transform-compatible** (they shallow-merge whatever
options object you pass, so a transform's baked-in `transform` function and
derived channels survive) — pass the transform exactly where you'd pass options:

```ts
glBarY(data, Plot.groupX({ y: "sum" }, { x: "sector", y: "value", fill: highlight }))
```

Map the common data tasks to a transform instead of a script:

| Instead of writing… | Use the transform | GL usage |
|---------------------|-------------------|----------|
| a `reduce`/`d3.rollup` to sum/mean/count per category | `Plot.groupX` / `groupY` / `groupZ` | `glBarY(d, Plot.groupX({y:"sum"}, {x,y}))` |
| a manual histogram (bucket + count) | `Plot.binX` / `binY` / `bin` | `glRectY(d, Plot.binX({y:"count"}, {x:"value"}))` |
| a rolling-average loop | `Plot.windowY` / `windowX` (`k`, `anchor`) | `glLine(d, Plot.windowY({k:5}, {x,y}))` |
| a cumulative-sum accumulator | `Plot.mapY({ y: "cumsum" })` | `glLine(d, Plot.mapY({y:"cumsum"}, {x,y}))` |
| dividing by a baseline for an index/share | `Plot.normalizeY` / `normalizeX` (`basis`) | `glLine(d, Plot.normalizeY("first", {x,y,stroke}))` |
| a stacked total + manual segment order | implicit `stackY`/`stackX` via `glBarY`/`glAreaY` + `order`/`offset` | `glBarY(d, {x,y,fill,order:"sum",reverse:true})` |
| `.filter(d => d.year === maxYear)` for end labels | `Plot.selectLast` (with `z`) | `glText(d, Plot.selectLast({x,y,z,text,fill}))` |
| min/max/first-per-series extraction | `Plot.selectMinY` / `selectMaxY` / `selectFirst` | annotate extremes without a groupby |
| a beeswarm / jitter layout | `Plot.dodgeX` / `dodgeY` | `glDot(d, Plot.dodgeY({x, fill}))` |
| sorting bars by value | the `sort` option or `Plot.sort` | `glBarX(d, {x,y:{value:"x",order:"descending"}})` |

**Two verified idioms worth committing to memory:**

```ts
// End labels — one label at each series' LAST point, no hardcoded max year.
// selectLast picks the final point per `z` group; glText dark-tones + haloes it.
glText(trade, Plot.selectLast({ x: "year", y: "value", z: "country", text: "country",
                                fill: highlight, textAnchor: "start", dx: 6 }))

// Aggregate + highlight — sum per sector, then the pop-out fill in one mark.
glBarY(trade, Plot.groupX({ y: "sum" }, { x: "sector", y: "value", fill: highlight }))
```

**When a plain `.filter()` is still right:** genuine *row subsetting* — the
mute-then-highlight focus split (`data.filter(d => d.focus)` for the muted
backdrop vs. the painted-once focus) is a filter, not an aggregation, and stays a
filter. Use transforms for anything that *derives* values (counts, means, rolling
windows, cumulative sums, normalization, stacking); use `.filter()` only to
choose which rows a layer draws.

## Mark coverage — what has a helper, what to reach for raw

The helpers cover the GL chart vocabulary. For marks without a helper, use the
raw `Plot.*` mark and apply tokens by hand (fills = main tone, strokes/labels =
dark tone, `GL.gridline`/`GL.ink_*` for chrome). Coverage at a glance:

| GL chart type | Plot mark | Helper |
|---------------|-----------|--------|
| Line / time series | `line` | `glLine` |
| Scatter | `dot` | `glDot` |
| Bar / column (incl. stacked) | `barY` / `barX` | `glBarY` / `glBarX` |
| Stacked area | `areaY` | `glAreaY` |
| Histogram | `rectY` + `binX` | `glRectY` |
| Heatmap | `cell` | `glCell` |
| Choropleth / map | `geo` | `glGeo` |
| Box-plot background distribution | `boxY` / `boxX` | `glBoxY` / `glBoxX` |
| Direct labels / annotations | `text` | `glText` |
| Zero baseline / threshold / trend | `ruleY` / `linearRegressionY` | `glZeroLine` / `glThreshold` / `glTrend` |
| Gridlines / axis lines | `gridY` / `frame` | `glGridY` / `glGridX` / `glAxisLines` |
| **Density / hexbin / contour** | `density` / `hexbin` / `contour` | raw — 0.8 opacity, `c_muted`→`c_1` pop-out |
| **Network / links / arrows** | `link` / `arrow` / `vector` | raw — dark tone for strokes |
| **Difference band, bollinger, waffle** | `differenceY` / `bollinger` / `waffle` | raw — apply tokens by hand |

**Two GL chart types have NO native Plot mark — use a d3 escape hatch:**

- **Treemap** (grammar §3.4; Nil §8). Plot has no treemap. Compute the layout with
  `d3-hierarchy` (`d3.treemap()`), then draw the tiles with `glRectY`-style
  `Plot.rect` (`x1/y1/x2/y2` from the layout) + `glText` labels. Apply the GL
  treemap rules directly: main-tone tiles at full opacity; **flat** single-level
  treemaps abut with no stroke, **two-level** treemaps take thin `GL.paper`
  separators between child tiles and a thicker `GL.paper` border around each
  parent block; in-tile labels that don't fit at the 12px floor are **dropped,
  never shrunk**. For trade/product data use the sector palettes.
- **Radar / spider** (grammar §3.4; Nil §9). Plot has no polar/radar mark. Build it with
  raw SVG or d3 line/area in polar coordinates and apply Nil §9 by hand: series
  polygon `GL.c_1` at `fillOpacity: 0.25` (gridlines must read through), stroke
  `GL.c_1` 2px round join; grid rings 1px `GL.gridline` with the **outermost
  ring `GL.ink_3`**; a second entity is `GL.c_muted`, drawn *under* the focus.

## Core rules

### 1. Render through `glPlot`, don't restyle per chart

`glPlot` is the single entry point — it merges the root style and the gridlines,
and passes everything else (marks, scales, `color`, margins, `document`) straight
through so Plot's own inference is preserved. Do **not** re-pass `style`/
`className` per chart except to override deliberately; **do** pass a `color` scale
(`glColor()` / `glColorSequential()` / `glColorDiverging()`) whenever a chart maps
a color channel — `glPlot` intentionally sets none (rule 3). Use `grid: "x"` for
horizontal-bar charts.

```ts
glPlot({
  x: { label: null },                    // year axis — omit the label (rule 9)
  y: { label: "Export value" },
  marks: [ /* … */ ],
});
```

`glPlot({ grid })` controls the GL gridlines: `"y"` (default), `"x"`, `"xy"`, or
`false`. Grammar §3.5: horizontal (Y) only by default; never both X and Y unless
the chart is dense.

### 2. Highlight with the mute-then-paint technique

The canonical GL move. The mark helpers are already muted (`glLine` strokes
`c_muted`, `glDot` fills `c_muted`), so the pattern collapses to *overpainting
the focus* — drawn **last** so it sits on top.

```ts
glPlot({
  marks: [
    glLine(data, { x: "year", y: "value", z: "country" }),                        // 1. muted backdrop
    glLine(focus, { x: "year", y: "value", stroke: highlight, strokeWidth: 2.4 }), // 2. focus, on top
  ],
});
```

Use `highlight` (main blue `#2F87C8` = `c_1`) for the default focus — the
institutional voice. Use `lead_finding` (main red `#CC4948` = `c_2`) only when
the finding itself is negative or alarming (a loss, a crisis, a breached
threshold) — **red signals valence, not emphasis strength**. A focus series that
merely stands out against peers is still the default-blue case. Use red
sparingly. Never use `"red"`, `accent`, or an arbitrary hex for emphasis.

**Points are the exception to the simple overpaint.** `glDot`'s default carries
`fillOpacity/strokeOpacity: 0.8` (so dense clouds darken on overlap instead of
washing out). That opacity muddies a highlight two ways — the dot shows the panel
through its own alpha and sits on a grey dot beneath. So a highlighted dot is
**painted once at full opacity, with the focus rows excluded from the backdrop**:

```ts
glPlot({
  marks: [
    glDot(data.filter(d => !d.focus), { x: "gdp", y: "eci" }),                    // 1. muted cloud, focus excluded
    glTrend(data, { x: "gdp", y: "eci" }),                                        // 2. trend (ink_4)
    glDot(data.filter(d => d.focus), {                                            // 3. focus, painted once
      x: "gdp", y: "eci", fill: highlight, stroke: highlight_dark, opacity: 1 }),
    glText(data.filter(d => d.focus), {                                           // 4. label: dark tone + halo
      x: "gdp", y: "eci", text: "name", fill: highlight, dy: -10 }),
  ],
});
```

(Lines and bars are opaque, so they can stay one-call overpaints — this only
bites dots.)

### 3. Set the GL palette explicitly with `glColor()`

When a `stroke`/`fill` channel maps to a categorical field, pass `color:
glColor()` — one call gives the 6 GL main tones, in order.

```ts
glPlot({
  color: glColor(),                                              // GL categorical palette
  marks: [ glLine(data, { x: "year", y: "exports", stroke: "sector" }) ],
});
```

**Why an explicit call and not an automatic default:** `glPlot` deliberately does
**not** inject a color scale. Plot infers a scale's *type* from its options, and a
forced discrete `range` biases that inference to **ordinal** — so a caller who
later maps `fill` to a *continuous* value without their own scale would get 6
recycled color bands instead of a ramp (worse than raw Plot, which infers a linear
scale). Plot has no "discrete-only default" hook, so the correct, safe move is one
explicit scale call: `glColor()` for categorical, `glColorSequential()` /
`glColorDiverging()` for continuous (rule 4). This keeps every encoding correct.

Colors bind in palette order: `c_1` (blue) first, then `c_2` (red), `c_3`
(teal), `c_4` (purple), `c_5` (orange), `c_6` (yellow). Never skip or reorder
unless a category has an external convention (the sector palettes).

**Color-count check — warn at 5+.** If a chart needs more than 4 distinct
categorical colors, surface this before writing the code:

> ⚠️ **Color count check:** You're about to use 5+ distinct colors. Color should
> convey meaning, not sequence. Before a fifth color, consider: **mute the
> background and highlight the message** (paint lower-priority series in
> `c_muted`, reserve a saturated hue for the 1–2 series that carry the finding);
> **group categories** so fewer colors suffice; or **use tones of one hue**
> (light/main/dark of `c_1`) for categories that share a parent. Six colors is a
> hard ceiling — beyond it, a different chart type (small multiples, ranked bar,
> treemap) almost always communicates better.

Untyped `glLine`/`glDot`/`glBarY` default to **muted**, not a saturated color —
you opt *in* to color for the focus, never out of it (the GL pop-out pattern).

### 4. Named, sequential, and diverging color scales

For a specific named palette, or continuous data, pass a GL color scale as the
`color` option (overriding `glPlot`'s default):

```ts
// Named categorical — Atlas HS sectors (domain + range derived from the map)
glPlot({ color: glColor("hs_sectors"), marks: [ glBarY(data, { x: "year", y: "rca", fill: "sector" }) ] });

// Sequential choropleth — ordered, darker = higher
glPlot({ color: glColorSequential("sequential_1"), marks: [ Plot.geo(states, { fill: "gdpPerCap", stroke: GL.ink_3, strokeWidth: 0.5 }) ] });

// Diverging — ONLY with a real midpoint; boundary sits at pivot (default 0)
glPlot({ color: glColorDiverging("diverging_2_1", { pivot: 0 }), marks: [ glBarY(data, { x: "country", y: "change", fill: "change" }) ] });
```

Available palettes (in `glPalettes`):

| Name | Colors | Use |
|------|--------|-----|
| `"categorical"` | 6 | Default. Main (fill) tones. Applied automatically. |
| `"categorical_dark"` | 6 | Dark tones — strokes + text tied to a series (WCAG AA). |
| `"categorical_light"` | 6 | Light tones — backgrounds, faded, two/three-tone fills. |
| `"sequential_1"`..`"sequential_6"` | 5 each | Single-hue ramp low → high (one per c-N) |
| `"diverging_2_1"` | 6 | Red ↔ blue, pivot-centered (default diverging) |
| `"diverging_3_1"` / `"5_1"` / `"6_1"` | 6 | Teal / orange / yellow ↔ blue |
| `"hs_sectors"` / `"sitc_sectors"` / `"product_space"` | 11 / 11 / 8 | Atlas taxonomies (named) — external standards |

**Sequential vs. diverging:**
- **Sequential** for any ordered encoding without a natural midpoint (population,
  GDP, complexity, count). Darker = higher.
- **Diverging** *only* when the data has a real reference point (gains vs.
  losses, above vs. below baseline). Never on a purely positive scale — readers
  read midpoint meaning into the boundary. `glColorDiverging` centers the
  boundary at `pivot` (default 0); pass `pivot` for a non-zero reference.
- **When color encodes sign** (a gains/losses chart split at zero), every mark
  follows the sign encoding — color residual or "unspecified" buckets by their
  sign like any other. A lone muted mark among signed marks reads as a third
  category and breaks the encoding.

### 5. Three tones, three jobs — and prefer tones of one hue

Each hue's light / main / dark variants are **not interchangeable**:

- **Main** (`GL.c_1`, …) — fills: bars, lines, dot bodies, treemap tiles,
  choropleth polygons.
- **Dark** (`GL.c_1_dark`, …) — strokes on overlapping marks, and **every text
  element tied to the color**: direct labels, series labels, legend marks,
  callouts, annotations. Required for WCAG AA against paper. **Never a fill**
  (except the three-tone stacked area).
- **Light** (`GL.c_1_light`, …) — backgrounds, faded states, sequential-ramp tail.

This covers **every** color including the muted grey: a `c_muted` line's label is
`c_muted_dark`, never `c_muted`. `glText(data, { fill: someMainTone })` applies
`glDark()` for you, so a series label passed its main tone renders in the dark
partner automatically — **and at weight 600**, the series-/legend-label weight
(grammar §2). A bare `glText` with no `fill` stays `ink_2` at weight 400, the
annotation role.

> **Quick test:** if a text element names or points to a colored mark, it uses
> the dark tone of that mark's color. No label ever shares its mark's fill hex.

**Whenever possible, use tones of one hue instead of more colors** (grammar §3.3; Nil §7).
Two/three categories that share a parent (goods vs. services, low/med/high) take
one hue's light/main(/dark) tones — the shared hue keeps them reading as one
total; lightness carries the split.

```ts
glPlot({
  color: { domain: ["Goods", "Services"], range: [GL.c_1, GL.c_1_light] },
  marks: [ glBarY(data, { x: "year", y: "share", fill: "tier" }) ],
});
```

### 6. Opacity on overlapping marks

`glDot` defaults to `fillOpacity/strokeOpacity: 0.8` (main fill + dark stroke) so
overlapping points darken together. A single-focus dot is drawn **once at
`opacity: 1`** (see rule 2). Single-layer marks — bars, treemap tiles,
choropleths — stay at full opacity; overlap isn't a risk and lowering opacity
just dilutes the color. Radar polygons are the one place fill drops further, to
`fillOpacity: 0.25`, so gridlines read through.

### 7. Lines, bars, areas, baselines — pick by role, not by mark

The same mark is styled differently by the *role* it plays. The helpers cover the
common role; the others are one explicit call:

| Role | Treatment | Helper |
|------|-----------|--------|
| Reference **threshold** (a target, a safety line) | dashed 1px `ink_3` | `glThreshold(value, "y")` |
| **Zero baseline** (frame of reference) | **solid** 1px `ink_2`, never dashed, never gridline weight | `glZeroLine("y")` / `glZeroLine("x")` |
| **Trend** (regression) | `ink_4` line, soft ribbon | `glTrend(data, {x, y})` |
| **Muted backdrop** ("everyone else") | `c_muted`, 2px | bare `glLine` / `glBarY` / `glDot` |
| **Single series** (the chart *is* the focus) | main blue, 2px | `glLine(data, { stroke: highlight })` |
| **Focus over a backdrop** | main blue (or red), 2.4px | `glLine(focus, { stroke: highlight, strokeWidth: 2.4 })` |

Two mistakes this table prevents: a dashed zero baseline (zero is frame, not
annotation — use `glZeroLine`), and a backdrop painted with `accent` or a dark
tone (backdrops are `c_muted`; dark tones are strokes and text).

**`strokeWidth: 2.4` only over a muted backdrop.** A lone or coequal series takes
the standard 2px. The 1.2× lift exists solely to raise a focus line above a muted
backdrop; if nothing is muted, nothing is "highlighted" either.

**Before rendering, scan each value axis for zero.** If 0 falls inside the
plotted range (sparse negatives count), add `glZeroLine("y")` — the gridline at 0
is too light to carry the frame.

### 8. Stacked bars: the 1px paper gap

`glBarY`/`glBarX` carry a 1px `paper` stroke, which gives grammar §3.4/§10's
clean boundary between stacked segments (invisible on a single bar). Order
categories **largest mean share at the bottom**, upward. Stacked **areas**
(`glAreaY`) are the exception — edge-to-edge, no stroke; color carries the split.

A **marker on top of a stacked bar** (e.g. a net-total dot over saturated
segments) takes the **lightest muted tone with a paper stroke** — the bar tones
contrast strongly with white, so a pale dot ringed in `paper` reads cleanly (a
dark stroke would vanish into dark segments):

```ts
glDot(totals, { x: "year", y: "total", fill: GL.c_muted_light, stroke: GL.paper, strokeWidth: 1.5, r: 3 });
```

### 9. Axis & title conventions

`glPlot` now sets these GL axis defaults for you (merged **under** any `x`/`y` you
pass, so an explicit scale always wins): **`labelArrow: "none"`** (strips
Observable's `↑`/`→` axis-title arrows — no arrow convention exists in the
grammar), **x `labelAnchor: "center"`** (centers the x-title under the axis
instead of Plot's right corner, where it collides with the last tick),
**`tickSize: 4`** (4px outward ticks — grammar §3.5, matching the ggplot twin;
pass `tickSize: 0` per axis to suppress), and the bottom+left **axis line**
(`glAxisLines()`, drawn by default — pass `axisLines: false` to drop the frame).
You rarely touch these; the notes below are for when you override.

- **Year axis:** when X is just years, omit the axis label — the ticks already
  name the dimension. Set `x: { label: null }`.
- **Y-axis label.** Plot renders the y-title **horizontal at the top** of the axis
  and does **not** rotate it. With the theme's `labelArrow: "none"` the ugly
  `↑ Export value` becomes a plain top-left `Export value`, which is acceptable
  for a report figure. A truly vertical rotated y-label isn't a Plot built-in — add
  it as custom SVG only if the destination demands it; don't claim Plot rotates it.
- **Rank a categorical axis descending — always.** Plot's default ordinal domain
  ascends, which puts the **largest** category at the **bottom** and silently
  inverts a ranked chart (the biggest bar/row ends up last). For any ranked bar or
  matrix, force descending order: `sort: { y: "x", reverse: true }` on the mark, or
  set the domain explicitly (`y: { domain: namesSortedDesc }` — e.g. a country ×
  product heatmap must list the largest economy at the top). Never ship an
  ascending ranked axis; it is a data-integrity bug, not a style choice.
- **Small multiples share the value scale.** Facets that compare magnitudes
  (rare vs. ubiquitous, nearby vs. distant) must use **one shared value domain**
  so a short bar reads as genuinely shorter. Plot's native faceting shares scales,
  but it also shares the *category* axis — wrong when each panel has its own rows.
  For free-category + shared-value multiples, render one `glPlot` per panel with an
  identical explicit `x`/`y` domain (`domain: [0, globalMax]`) and stack them; show
  the value axis only on the last panel. Independent per-facet scales collapse the
  comparison and are a data-integrity bug.
- **Every color/size encoding needs a legend.** A scale with no key is undecodable.
  For a continuous fill (`glColorSequential`/`glColorDiverging`), `legend: true`
  throws under Node SSR (canvas) — use **`glColorbar`** and composite it beside the
  chart; for categorical, draw an in-SVG swatch legend (Plot's HTML legend can't
  travel inside a standalone SVG). Shipping a colored scatter/heatmap with no
  legend loses the third variable.
- **Long category labels get clipped** by Plot's default left margin. A ranked
  bar with names like "United States of America" needs an explicit
  `marginLeft` (≈ the longest label's width) or the label is cut off — Plot does
  not auto-grow the margin. Same for wide `fy` facet labels (`marginRight`).
- **Chart title ends in a period** — it reads as a finding. Pass it via `glPlot({
  title, subtitle, caption })`: Plot renders `title`/`subtitle`/`caption` as HTML
  above/below the figure. The **subtitle does not** end in a period. The
  **caption is the source line** (Source Serif 4 italic in the document; grammar
  §2). In a GL *document*, omit the in-chart title/subtitle/caption and let the
  figure block supply them — the report vs. slide distinction (see below).
- **Gridlines default to horizontal (Y).** For horizontal-bar charts, flip:
  `glPlot({ grid: "x", … })` so the reader can estimate bar lengths.
- **Axis line & ticks.** `glPlot` draws the bottom+left axis line (1px ink_2) and
  4px outward ticks by default (grammar §3.5), matching the ggplot twin; horizontal
  gridlines carry value estimation off the axis. When zero is in range,
  `glZeroLine("y")` doubles as the x-axis baseline. Want a deliberately frame-less
  chart? Pass `axisLines: false`; suppress ticks per axis with `x: { tickSize: 0 }`.
- **Prefer direct end labels over a legend** for 1–4 tracked series (grammar §3):
  draw a `glText` with the `Plot.selectLast` transform (not a hand-filtered
  `d.year === maxYear` — see "Transforms first") so each series is labeled at its
  final point. Pass the series' main tone as `fill` (it dark-tones automatically),
  with `textAnchor: "start"` and a small `dx`. Give the plot a right margin so
  labels aren't clipped (`glPlot({ marginRight: 80, … })`). `glText` renders
  these at weight 600 (the series-label weight) when passed a series `fill`.
- **Axis-label weight.** Grammar §2 sets the axis label at Inter 500; Plot renders
  it at 400 and exposes no root hook for it. Where it matters, bump it on the axis
  mark itself — `Plot.axisY({ label, fontWeight: 500 })` (or the `x` equivalent).
- **GDP-per-capita (and other multiplicative) axes take a log scale** —
  `x: { type: "log" }` (or `y`) — so proportional differences read evenly. This is
  an Atlas charting convention, not a paper-size rule.

### 10. Report vs. slide mode

Match the destination, like `gl-ggplot`:

- **Report mode** — the chart headed into a GL document. Omit the in-chart
  `title` / `subtitle` / `caption`; the document's figure block supplies the
  figure label, chart title, subtitle, and source. The chart itself is axes +
  marks + legend only.
- **Slide / standalone mode** — the chart *is* the deliverable (a shared PNG/SVG,
  a notebook cell). Pass `title` (ending in a period), `subtitle`, and `caption`
  (the source line) to `glPlot` so the caption block renders with the chart. A
  standalone chart with no title and no source is incomplete.

There is no `mode` flag — it's just whether you pass the title block. Choose by
where the chart is going.

### 11. Export & sizing

`glPlot` returns the rendered SVG/figure element. To size a chart, pass `width` /
`height` (px) — Plot auto-computes height from width when omitted. Use the
**`GL_SIZE`** presets, which mirror the ggplot recipe's `gl_fig` table exactly (at
96px/in) so a Plot chart drops into the same report slot as its ggplot twin;
spread one into `glPlot`:

```ts
import { glPlot, GL_SIZE } from "./gl-plot.ts";
glPlot({ ...GL_SIZE.full, marks: [...] });   // 624 × 384
```

| Preset | width × height (px) | ggplot analogue |
|--------|---------------------|-----------------|
| `GL_SIZE.full` | 624 × 384 | `full` (6.5×4.0") |
| `GL_SIZE.full_tall` | 624 × 576 | `full_tall` |
| `GL_SIZE.full_square` | 624 × 624 | `full_square` |
| `GL_SIZE.half` | 304 × 288 | `half` |
| `GL_SIZE.slide` | 960 × 540 | `slide` |

Locking figure geometry to these presets also keeps a chart from reflowing the
page it lands on (a taller-than-expected figure pushes body text across a page
break in the PDF pipeline).

- **Browser export:** serialize the returned SVG (`new XMLSerializer()`), or use
  the notebook's built-in SVG/PNG download. For a raster at print resolution,
  render at 2–3× and downscale, or rasterize the SVG through a canvas.
- **Node SSR:** pass a jsdom `document` to `glPlot`, then serialize with
  **`glSerialize(element)`** — do **not** use raw `element.outerHTML`. jsdom
  drops the SVG `xmlns` (rasterizers then reject the string as "no root node"),
  and glStyle's paper background is CSS-only so a rasterizer renders it
  transparent/black; `glSerialize` injects the namespaces and prepends a painted
  paper `<rect>`. Embed the fonts (`@font-face` with data-URI woff2, or pass the
  files to your rasterizer) so text renders in Inter / Source Serif 4, and keep
  the `.gl-plot text` tabular-figures rule. If you rasterize with resvg/sharp,
  give it the paper background and the font files explicitly.

### 12. Chart text is 12px — the spec value and the floor

Grammar §3: every text element in a chart is 12px (only the chart title is
larger, at 14px). `glStyle` sets `fontSize: "12px"` and `glText`/the axis inherit
it. 12px is simultaneously the target and the **floor** — never go below it. If
labels crowd, reduce ticks, abbreviate, or resize the figure; do not shrink the
type. Because Plot is px-native, `"12px"` here is Nil's 12px verbatim — no
conversion, no rescaling.

### 13. Getting a chart into a GL document (the md pipelines)

**There is no native Observable renderer in the GL markdown pipelines today.**
`md2pdf`, `md2html`, `md2slides`, and `md2docx` all treat charts as
**pre-rendered images** embedded with markdown image syntax — exactly like the
ggplot PNGs. So the flow for an Observable Plot chart into a GL report is:

1. Render the chart to **SVG** (Node SSR via jsdom, or a browser) — see rule 11.
2. Save it next to the report and embed it in the figure block like any figure:

   ```markdown
   ![Mongolia's exports outpaced its peers after 2016.](imgs/mongolia-exports.svg){#fig:exports}
   ```

   The md pipelines' figure filter styles the caption into the GL eyebrow /
   title / subtitle / source stack — so use **report mode** (no in-chart title;
   the document supplies it). Rasterize to PNG at 2–3× first if a target chokes
   on SVG.

**Why no live code blocks (and what would change it).** The pipelines run pandoc
(and, for PDF/slides, headless Chromium) but none execute ` ```js ` / ` ```{ojs} `
blocks — there's no Observable runtime, D3, or `<script>` figure support
anywhere in the filters or templates. The nearest path to a *native* renderer is
`md2pdf` or `md2slides`, which **already boot headless Chromium** (they execute
MathJax there today); a Lua filter that turned a fenced `js` block into a
`<div>` + `<script>` loading the Plot bundle would render in that existing
Chromium stage. That's a **potential enhancement, not a current feature** — for
now, pre-render to SVG/PNG and embed.

### 14. Legends and dark mode

- **Prefer direct end labels over a legend** (rule 9) — but when a legend is
  right, request it with `color: { ...glColor(), legend: true }`. Plot then wraps
  the output in a `<figure class="gl-plot-figure">` and renders the legend as a
  `<div class="gl-plot-swatches">` **outside** the SVG. The `.gl-plot text` CSS
  rule can't reach those DOM nodes, so **`gl-fonts.css` also styles
  `.gl-plot-swatches`** (Inter, 12px, weight 600 — legend entries are series
  labels, grammar §2). Load `gl-fonts.css` or swatch labels fall back to the
  browser default font. Swatch *colors* come from the color scale, so a GL scale
  gives GL swatches automatically.
- **A legend renders OUTSIDE the `<svg>`.** Both the swatch row and a continuous
  ramp are siblings of the SVG inside the `<figure>` — so a *standalone*
  `.svg`/`.png` (what the md pipeline embeds, rule 13) **loses the legend**. If a
  chart's colors must be decoded from a single image, either draw the legend
  inside the panel as marks (a row of `glDot` + `glText`), or — for a continuous
  scale — use `glColorbar` (below) and place it in the figure block.
- **Continuous `legend: true` THROWS under Node SSR.** Plot rasterizes a
  sequential/diverging legend to a `<canvas>`, which jsdom lacks (`Cannot set
  properties of null (setting 'fillStyle')`), aborting the whole render. Use
  **`glColorbar({ palette, domain, title, ticks, document })`** instead — it
  builds the ramp as an inline `<linearGradient>` (no canvas) and returns a
  self-contained `<svg>` you place beside the chart (or composite into it). Pass
  the same palette you gave `glColorSequential`/`glColorDiverging`. Categorical
  swatch legends (`legend: true`) render fine under SSR — only the continuous
  ramp needs the canvas.
- **Faceting has no free scales.** Plot shares one band scale across facets, so a
  ggplot `facet_wrap(scales = "free_y")` ranked bar (each panel its own
  categories) renders each panel with the *other* facet's rows left blank. Plot
  has no equivalent — render **separate `glPlot` calls** stacked (one per group),
  each with its own sorted domain, rather than one faceted plot.
- **GL is a paper-first, light system** — the grammar defines no dark-mode
  tokens, so the theme renders **light only** by design (paper background, warm
  ink). Do **not** invent dark-mode hexes. If a web chart must sit on a dark
  surface, swap only the *chrome* (background, gridline, axis ink) and keep the
  brand hues, mirroring the D3 dark-mode note in `gl-ggplot` — e.g. pass a
  `style` with a dark `background` and override `glGridY({ stroke: "#302C28" })`.
  Treat that as an explicit, out-of-grammar adaptation, not a GL default.

## Measuring conformance automatically

Conformance is checked at two layers, mirroring the `gl-ggplot` split (mechanical
linter + judgment audit). The Plot linter lives at
[`scripts/gl_lint_plot.mjs`](scripts/gl_lint_plot.mjs) and — because Plot renders
to SVG — it can check the **rendered output**, not just the source. That output
check is stronger than any static linter: a computed or interpolated color a
regex would miss still shows up as an attribute in the SVG.

```bash
# SOURCE lint — regex heuristics over the chart code (no deps, no render):
node skills/gl-observable-plot/scripts/gl_lint_plot.mjs chart.ts

# RENDER lint — inspect a rendered SVG the chart produced (the strong signal):
node skills/gl-observable-plot/scripts/gl_lint_plot.mjs --svg chart.svg
node your-render-step.mjs | node skills/gl-observable-plot/scripts/gl_lint_plot.mjs --svg -
```

To produce the SVG for the render lint, render once via Node SSR (jsdom) or a
browser export (rule 11) and serialize the element's `outerHTML`.

| Layer | Check ids | What it proves |
|-------|-----------|----------------|
| **Source** | `hex` (non-token hex), `literal` (named CSS color), `accent` (accent as data fill), `dark-fill` (dark tone as fill), `text-size` (sub-12px), `mono`, `zero-line` (dashed zero), `raw-plot` (bypassed `glPlot`), `setup` (no theme import), `color-scale` (color channel with no GL scale) | The code *asks* for GL |
| **Render (SVG)** | `svg-color` (any fill/stroke off-palette), `svg-font` (root not Inter/Source Serif), `svg-fontsize` (sub-12px), `svg-tabular` (no tabular figures), `svg-bg` (background not paper), `svg-darktone` (a label in a main/light tone instead of its dark partner) | GL actually *rendered* |

Both exit non-zero if anything is flagged, so they drop into CI or the eval
harness directly. `checkSource(text)` and `checkSvg(text)` are also exported for
programmatic use. A clean lint is **necessary, not sufficient** — pair it with the
judgment checklist below (highlight pattern, right chart for the ask, color count,
mute-then-highlight). Following the `gl-ggplot` eval's "closing the loop" ladder,
prefer to make a violation *impossible by construction* in a helper (layer 1)
before adding a lint check (layer 2) or more SKILL prose (layer 3).

## Complete example

```ts
import * as Plot from "@observablehq/plot";
import { glPlot, glLine, glText, highlight, GL } from "./assets/gl-plot.ts";
import "./assets/gl-fonts.css";

const focusCountry = "Mongolia";
const focus = trade.filter(d => d.country === focusCountry);   // row subset — a filter, correctly

const chart = glPlot({
  width: 624, height: 384,
  marginRight: 90,                                  // room for end labels
  x: { label: null },                               // year axis
  y: { label: "Export value", tickFormat: "~s" },
  marks: [
    glLine(trade, { x: "year", y: "value", z: "country" }),          // muted backdrop
    glLine(focus, { x: "year", y: "value", stroke: highlight, strokeWidth: 2.4 }), // focus, on top
    glText(focus, Plot.selectLast({ x: "year", y: "value", text: "country",        // end label at
      fill: highlight, textAnchor: "start", dx: 6 })),                              // the last point
  ],
});
```

For a standalone deliverable, add the title block:

```ts
glPlot({
  title: "Mongolia's exports outpaced its peers after 2016.",
  subtitle: "Goods exports, constant 2015 USD",
  caption: "Source: Growth Lab, Atlas of Economic Complexity.",
  /* … same marks … */
});
```

## Checklist before finalizing charts

- [ ] Rendered through `glPlot` (not raw `Plot.plot`); `gl-fonts.css` loaded
- [ ] Mode matches destination: title/subtitle/caption in-chart for a standalone
      deliverable; omitted when a GL document supplies the figure block
- [ ] No per-chart restyling except deliberate overrides (continuous color scale,
      `grid: "x"`, margins)
- [ ] No monospace anywhere (Inter + Source Serif 4 only)
- [ ] Highlights use `highlight` (main blue) or `lead_finding` (main red) — never
      `"red"`, `accent`, or arbitrary hex; fills/lines use the **main** tone
- [ ] Highlighted dots: `fill: highlight`, `stroke: highlight_dark`, `opacity: 1`,
      painted **once** with focus rows excluded from the muted backdrop
- [ ] Red used only for negative/alarming findings — valence, not emphasis strength
- [ ] Mute-then-paint used; supporting data is `c_muted`; focus drawn **last**
- [ ] Any color channel has an **explicit** GL scale — `glColor()` (categorical),
      `glColorSequential()` / `glColorDiverging()` (continuous); `glPlot` sets none
- [ ] Colors assigned in palette order (c_1, c_2, …); no skipping/reordering
- [ ] 5+ colors triggered the color-count check; mute-then-highlight or grouping
      considered first; most charts 2–4 colors; 6 is the ceiling
- [ ] **Every label tied to a colored mark uses the dark tone** (`glText` with the
      main tone dark-tones automatically, and sets weight 600 — the series-label
      weight); no label shares its mark's fill hex
- [ ] Overlapping marks (scatter) use 0.8 fill+stroke opacity; single-layer marks
      stay at full opacity
- [ ] Related categories use one hue's tones before reaching for more colors
- [ ] Stacked bars carry the 1px paper gap (the `glBarY` default), largest share
      at bottom; stacked areas stay edge-to-edge
- [ ] Focus line is 2.4px only over a muted backdrop; lone/coequal series stay 2px
- [ ] Zero baselines use `glZeroLine` (solid ink_2), never the dashed threshold
- [ ] Sequential for ordered values; diverging only with a real midpoint, centered
      at `pivot`
- [ ] Gridlines horizontal (Y) by default; horizontal-bar charts flip to `grid: "x"`
- [ ] All in-chart text is 12px (`glStyle` untouched); nothing smaller
- [ ] No non-token color literals — `GL.paper` not `"white"`, `GL.c_muted` not
      `"grey"`, never `"red"`/`"blue"`
- [ ] Year-only X axis omits its label (`x: { label: null }`)
- [ ] Chart title (standalone) ends in a period; subtitle does not; a source line
      exists (in-chart caption, or the document figure block)
- [ ] Choropleths use `glGeo` (0.5px `ink_3` region borders) with a sequential
      (or real-midpoint diverging) color scale
- [ ] Box-plot background distributions use `glBoxY`/`glBoxX` (they recede —
      `c_muted_light` fill, `c_muted` outline); the focus is a `glLine` + `glDot` on top
- [ ] Data derivation (counts, means, rolling windows, cumulative, normalize,
      stacking, last-point-per-series) uses a **Plot transform**, not a hand-rolled
      script; `.filter()` is used only for row subsetting (the focus/backdrop split)
- [ ] Treemap / radar (no native Plot mark) use the d3 escape hatch with GL tokens
      applied by hand (main-tone tiles / 0.25 radar fill / outermost ring `ink_3`)
- [ ] GDP-per-capita axes use a log scale (`x: { type: "log" }`)
- [ ] **Linted clean** — `gl_lint_plot.mjs chart.ts` (source) and, when you can
      render, `--svg` on the output (the stronger check: every color a GL token,
      text ≥ 12px Inter, labels dark-toned)
- [ ] Legend (if any) requested via `legend: true` and `gl-fonts.css` loaded so
      `.gl-plot-swatches` get GL typography; dark surfaces swap only chrome, never
      invent brand hexes
```
