---
name: gl-flint
description: Apply the Growth Lab design system to Microsoft Flint (flint-chart) charts. Use this skill when producing visualizations through Flint — the visualization intermediate language that compiles a compact, semantic ChartAssemblyInput into a native Vega-Lite spec — so the output follows GL visual standards: the categorical palette, warm ink + paper, Inter/Source Serif typography, the 12px floor, tabular figures, and mute-then-highlight. It is the Flint analogue of gl-ggplot and gl-observable-plot.
compatibility: Requires flint-chart >= 0.2, and (to render) vega + vega-lite. Node 18+. Wraps Flint's Vega-Lite backend; ECharts/Chart.js backends are a follow-up. Fonts are the canonical faces in the plugin's /assets/fonts — load them wherever you rasterize so "Inter" / "Source Serif 4" resolve.
metadata:
  version: "0.1"
---

# GL Flint design system

This skill produces [Flint](https://github.com/microsoft/flint-chart) charts that follow the
Growth Lab visual grammar. Its canonical sources are, in authority order,
[`grammar.md`](../../grammar.md) (source of truth), the upstream spec in
[`docs/nil/`](../../docs/nil/), and the `/assets` design library + fonts — **not** any sibling
skill. If a value here disagrees with `grammar.md`, `grammar.md` wins and this file is the bug.

**What Flint is, and why it fits GL.** Flint is a *compiler*, not a renderer. You write a
compact, semantic `ChartAssemblyInput` — pick a chart type, map fields to channels, and
annotate each field with a **semantic type** (`Country`, `Quantity`, `Year`, `Price`, …) —
and Flint derives the low-level chart (scales, zero baselines, number formats, sort order)
and emits a native Vega-Lite spec. That is exactly GL's model: the agent authors intent; the
tool supplies the opinionated defaults. Flint decides *what kind* of color scale to use
(categorical / sequential / diverging) but leaves the concrete palette and chrome to a
backend layer — **this skill is that layer for GL.**

## Setup

```bash
npm install flint-chart vega vega-lite      # peer deps in your project
```

```js
import {
  glAssembleVegaLite, glRenderSVG, glColorCountCheck, GL, glPalettes,
} from "./assets/gl-flint.mjs";   // under the plugin: ${CLAUDE_PLUGIN_ROOT}/skills/gl-flint/assets/
```

Then author a Flint input and render it through `glAssembleVegaLite` instead of Flint's raw
`assembleVegaLite`. The wrapper (1) deep-merges the GL Vega-Lite config, (2) rewrites the
color scale to the GL palette, and (3) applies GL emphasis semantics.

```js
const { spec, warning } = await glAssembleVegaLite({
  data: { values: trade },
  semantic_types: { country: "Country", year: "Year", value: "Quantity" },
  chart_spec: {
    chartType: "Line Chart",
    encodings: { x: { field: "year" }, y: { field: "value" }, color: { field: "country" } },
    baseSize: { width: 624, height: 384 },
  },
}, { focus: "Mongolia" });          // ← GL emphasis: mute everyone else, highlight Mongolia

const svg = await glRenderSVG(spec); // standalone, GL-serialized SVG (paper, Inter, tabular)
```

## What the wrap provides

| Export | What it is |
|--------|-----------|
| `glAssembleVegaLite(input, glOpts)` | The entry point: Flint assemble → GL theme → GL focus. Returns `{ spec, meta, warning }` |
| `applyGlTheme(spec)` | Merge GL config + rewrite the color scale to the GL palette (called for you) |
| `applyFocus(spec, {focus, valence})` | Mute-then-highlight as a spec transform (called when `glOpts.focus` is set) |
| `glColorCountCheck(input)` | The 5+/6-ceiling color guard (grammar §3) — call before rendering a many-category chart |
| `glRenderSVG(spec)` | Compile VL→Vega→standalone SVG with the GL root style injected |
| `GL`, `glPalettes`, `highlight`, `lead_finding`, `glDark()` | The GL token table + palettes (downstream copy of `grammar.md` §1) |
| `glVegaConfig` | The GL Vega-Lite `config` object (fonts, sizes, ink, paper, gridlines, stroke widths) |

## Core rules

### 1. Author the semantic spec; let Flint derive the knobs

Give every field its **semantic type** — that is how Flint derives zero baselines, log
scales, number formats, and sort order (the GL charting conventions we otherwise enforce by
hand). Pick the chart type by its display name: `"Line Chart"`, `"Bar Chart"`,
`"Scatter Plot"`, `"Stacked Bar Chart"`, `"Radar Chart"`, `"Slope Chart"`, `"Area Chart"`,
`"Waterfall Chart"`, … Don't hand-set scales or formats the compiler will derive.

The Vega-Lite backend covers line, bar, area, scatter, radar, violin, bump, slope, waterfall,
candlestick, lollipop, range-area, rose, density, ecdf, gantt, pie, map. **Hierarchy/flow
types — treemap, sankey, sunburst, heatmap, funnel, gauge — are ECharts-only** and not yet
themed for GL; use `gl-ggplot` / `gl-observable-plot` for those until the ECharts backend lands.

**Scatter x/y must be measures.** Give a scatter's positional fields a measure semantic
type (`Quantity`, `Score`, `Price`, `Correlation`, …), never `Country`/`Category`. Flint
otherwise compiles a numeric axis to *ordinal*, collapsing the scatter into a 1-D strip and
overflow-dropping rows. `glAssembleVegaLite` now guards against this — it forces a numeric
scatter axis back to `quantitative` and clears Flint's ordinal domain — but clean semantic
types avoid the row-dropping in the first place. A single malformed value in a numeric column
(e.g. a stray string from a bad CSV parse) can still trip Flint's inference; parse data properly.

**These GL behaviors are now automatic** in `glAssembleVegaLite` — you don't set them by hand:

- **Ranked bars** sort descending by the measure (grammar §9); largest at top. (Flint leaves
  bars unsorted / name-sorted, which silently inverts the finding.)
- **Zero baseline** — a solid `ink_2` rule at 0 is added whenever a bar/area value axis spans
  zero (mandatory on sign/diverging bars, grammar §7).
- **Gridlines** follow orientation: horizontal (Y) for lines/scatters/vertical bars, vertical
  (X) for horizontal bars.
- **Clean labels** — a measure axis with no title gets a human label (`eci`→"ECI"); a category
  axis and a `year` axis get no redundant title; a raw column name never leaks into a title.
- **Mute-then-highlight is mark-aware.** With `focus`, a **line** is rebuilt as a continuous
  muted backdrop + an overpainted focus that shares the boundary vertex (no gap) plus a direct
  end-label; a **scatter** gets a muted cloud + the focus dot painted once, larger, dark-stroked,
  with a direct label; a **bar** remaps the color scale and drops the legend. If the requested
  `focus` matches no row, the series is treated as single (institutional blue), never all-grey.

**`labelField`** (line/scatter focus): pass `glOpts.labelField` to name the column used for the
direct end-label (e.g. `{ focus: 'CYP', labelField: 'name' }` labels the focus point "Cyprus").

### 2. Highlight with `focus` — mute-then-highlight is the GL move

Flint colors every category equally. GL does the opposite: **paint everything else in
`c_muted`, then re-paint the one series that carries the story** (grammar §3.1). Express it
with the `focus` option — name the category value(s) that carry the finding:

```js
await glAssembleVegaLite(input, { focus: "Mongolia" });               // focus → institutional blue
await glAssembleVegaLite(input, { focus: ["Greece"], valence: "negative" }); // → lead-finding red
```

`focus` maps the color scale so the focus keeps a saturated hue (`c_1`) and everyone else
recedes to `c_muted`, and lifts the focus line to 2.4px over the 2px backdrop. Use the
default **blue** for the institutional voice; use **red only for a negative/alarming
finding** — red signals valence, not emphasis strength. A single-series chart needs no
`focus`: it *is* the focus and renders in `c_1` automatically.

### 3. Color conveys meaning, not sequence — cap at 6

Before rendering a chart whose color field has many values, run the guard:

```js
const w = glColorCountCheck(input);
if (w) console.warn(w.message);   // warns at 5+, errors past the 6-color ceiling
```

When you hit the warning, prefer **mute-then-highlight** (a `focus`), **group** categories,
or **tones of one hue** before spending a fifth color (grammar §3). Colors bind in palette
order: `c_1` blue, `c_2` red, `c_3` teal, `c_4` purple, `c_5` orange, `c_6` yellow.

### 4. Sequential vs. diverging

Flint infers the scale *family* from the field's semantic type and data (a ±-spanning
measure → diverging; an ordered measure → sequential). The wrap maps that family to the GL
ramp: sequential → `sequential_1` (blue) unless the data has a hue convention; diverging →
`diverging_2_1` (red↔blue), centered at the real midpoint. **Never** a diverging ramp on a
purely positive scale (grammar §3.6).

### 5. Everything else is the config — don't restyle per chart

`glVegaConfig` already sets Inter/Source Serif 4, the 12px floor (it corrects Flint's
sub-floor `labelFontSize:10`), 14px/500 title, warm ink text, paper background, `#D8D4CC`
horizontal gridlines, a 1px ink_2 axis line, 4px outward ticks, and 2px round-join lines. Don't
re-set these per chart. Chart text is **12px — the target and the floor**; if labels crowd,
reduce ticks or resize, never shrink the type.

### 6. Report vs. standalone mode

Like `gl-ggplot`: in **report mode** (the chart goes into a GL document) omit the in-chart
title/subtitle/source — the document's figure block supplies them. In **standalone mode**
(a shared SVG/PNG) pass `title` (ending in a period), `subtitle`, and a `caption` source
line on the Flint input so the render carries them. There is no mode flag — it is just
whether you author the title block.

### 7. Getting a Flint chart into a GL document

The md pipelines (`md2pdf`, `md2html`, `md2slides`, `md2docx`) have **no live renderer** —
they embed charts as pre-rendered images. So render to SVG (or rasterize to PNG at 2–3×) and
embed it in the figure block exactly like a ggplot PNG:

```markdown
![Mongolia's exports outpaced its peers after 2016.](imgs/mongolia-exports.svg){#fig:exports}
```

Use **report mode** so the document supplies the figure label/title/subtitle/source.

## Measuring conformance

The render lint is the strong check — it inspects the **rendered SVG**, so a computed or
interpolated color a source regex would miss still shows up:

```bash
node skills/gl-flint/scripts/gl_flint_render.mjs chart.mjs out.svg --lint
```

`chart.mjs` exports the themed `spec` (the `.spec` from `glAssembleVegaLite`). The lint reuses
the shared, backend-agnostic `checkSvg` (grammar-derived): every fill/stroke a GL token, text
≥12px in Inter/Source Serif, numerals tabular, background paper, labels in the dark tone. A
clean lint is necessary, not sufficient — also confirm the *right* chart for the ask, the
color count, and that mute-then-highlight carries the finding.

## Checklist before finalizing

- [ ] Rendered through `glAssembleVegaLite` (not raw `assembleVegaLite`); every field has a semantic type
- [ ] Emphasis uses `focus` (mute-then-highlight); red only for a negative/alarming finding
- [ ] Color count checked (`glColorCountCheck`); ≤4 colors typical, 6 the hard ceiling; tones-of-one-hue preferred for related categories
- [ ] Sequential for ordered values; diverging only with a real midpoint
- [ ] No per-chart restyling of the config; chart text 12px (never smaller); numerals tabular
- [ ] Mode matches destination: title/subtitle/caption in-chart only for a standalone deliverable
- [ ] Chart type is on the Vega-Lite backend (treemap/sankey/heatmap etc. are ECharts-only — not yet GL-themed)
- [ ] **Linted clean** — `gl_flint_render.mjs … --lint` (GL tokens only, Inter ≥12px, paper, tabular, dark-tone labels)
