# Flint integration — evaluation & architecture

**Status:** evaluated + first cut built. The `gl-flint` skill wraps `flint-chart@0.2.0`'s
Vega-Lite backend with the GL kernel (palettes + config + mute-then-highlight focus) and
renders GL-serialized SVG that passes the grammar-derived render lint. See §6 for what is
built and verified. Canonical values are sourced from `grammar.md` (source of truth),
`docs/nil/` (upstream spec), and `/assets` (design library + fonts) — never from a sibling
downstream encoding.
**Subject:** [microsoft/flint-chart](https://github.com/microsoft/flint-chart) — "a
visualization intermediate language (VIL) that lets AI agents reliably create
expressive, good-looking charts from simple, human-editable specs."
**Question:** can the GL style kernel integrate with the Flint grammar, and what does a
*principled* (not bolted-on) integration look like?

---

## 1. What Flint is

Flint is a **compiler**, not a renderer. An agent writes a compact `ChartAssemblyInput`:

```ts
{
  data: { values: rows },
  semantic_types: { weight: 'Quantity', mpg: 'Quantity', origin: 'Country' },
  chart_spec: {
    chartType: 'Scatter Plot',
    encodings: { x: { field: 'weight' }, y: { field: 'mpg' }, color: { field: 'origin' } },
    baseSize: { width: 400, height: 300 },
  },
}
```

`assembleVegaLite | assembleECharts | assembleChartjs` compile that same input into a
**native spec** for the chosen backend. The agent never touches scales, tick counts, zero
baselines, sort order, or number formats — those are *derived* from the field semantic
types (70+ of them: `Rank`, `Price`, `Country`, `Correlation`, …) and the data.

### Pipeline (VL-free core → per-backend assembly)

```
resolveChannelSemantics()   Phase 0  → ChannelSemantics (type, format, scale, zero, colorScheme hint)
        │
decideColorMaps()           core/color-decisions.ts → abstract ColorDecision
        │                     { schemeType: categorical|sequential|diverging, categoryCount, … }  NO hex
        ├─► vegalite/assemble.ts  → VL spec  (scheme name → encoding.scale.scheme; config for chrome)
        ├─► echarts/assemble.ts   → ECharts option  (colormap.ts picks concrete hex)
        └─► chartjs/assemble.ts   → Chart.js config  (colormap.ts picks concrete hex)
```

The design comment in `core/color-decisions.ts` is explicit: *"This module does NOT know
about Vega-Lite / ECharts syntax. It only returns abstract colormap identifiers and palette
needs. Backends translate these decisions into concrete scale/option config."*

### Delivery model (matches ours)

Flint ships three ways, and the third is exactly how GL ships:
1. **npm lib** — `assemble*()` functions.
2. **`flint-chart-mcp`** — an MCP server that lets an agent validate + render charts.
3. **`agent-skills/`** — a Claude/LLM skill teaching the agent to author `ChartAssemblyInput`.

So GL and Flint already agree on the delivery philosophy: *the agent authors a
high-level, semantic spec; the tool supplies the low-level defaults.*

---

## 2. Where GL and Flint agree, and where they collide

| Dimension | Flint default | GL grammar | Verdict |
|---|---|---|---|
| Agent authors semantic spec, tool derives knobs | ✅ core design | ✅ our whole model | **Aligned** — same philosophy |
| Zero baselines, log scales, number format, sort order from field meaning | ✅ derived | ✅ encoded by hand in skills | **Aligned** — Flint automates what we document |
| Concrete palette is a swappable backend layer | ✅ `colormap.ts` seam | ✅ `grammar.md` palettes | **Aligned** — clean injection point |
| Typography / chrome / stroke widths / backgrounds | backend `config`, no house-theme hook (`background:'light'|'dark'` is *reserved*) | strict: Inter+Source Serif 4, 12px floor, tabular, paper, warm ink, gridline discipline | **Gap** — Flint has no theme-injection surface yet |
| Emphasis model | every category gets a palette color (cat10/cat20) | **mute-then-highlight**: all-but-the-message go `c_muted`; focus opts *in* to color | **Collision** — the core of GL's look is absent from Flint |
| Label color | label follows series color | label uses the **dark** partner of the mark's hue (WCAG AA) | **Collision** — needs a GL label rule |
| Color count | happily uses cat20 | warn at 5+, hard ceiling 6, prefer tones-of-one-hue | **Collision** — Flint won't self-limit |
| Red | just another palette slot | **valence only** (loss/crisis/breach), never "emphasis strength" | **Collision** — needs GL semantics |

**The headline risk.** If GL adopts Flint by only swapping the palette, charts will render
with *every* category saturated, no muted backdrop, labels in the mark hue, and up to 20
colors — i.e. the exact "generic AI chart" aesthetic the GL system exists to prevent. A
palette swap is necessary but **not sufficient**. A principled integration has to carry
GL's *emphasis semantics* (mute-then-highlight, dark-tone labels, red-as-valence) into
Flint's model, not just its hexes.

**What Flint actually buys us** (we can already draw most of these via ggplot/Plot).
The chart-type payoff splits by backend — verified against `flint-chart@0.2.0`:
- **Vega-Lite backend (this cut):** adds **radar/violin, bump, slope, waterfall,
  candlestick, lollipop, range-area, rose, density, ecdf, gantt** over the everyday
  ggplot/Plot vocabulary. `radar` is the standout — today `gl-observable-plot` reaches for
  a **d3 escape hatch** for it; Flint's VL backend renders it directly, GL-clean.
- **ECharts backend (fast-follow):** the *hierarchy/flow* types the VL backend does **not**
  have — **treemap, sankey, sunburst, tree, heatmap, funnel, gauge, streamgraph, parallel,
  boxplot**. Treemap (which GL also escape-hatches today) lives here, so getting it means
  building the GL ECharts colormap + theme, not just the VL one.
- **Semantic-type auto-config** — zero/log/format/sort derived deterministically, so the
  agent can't forget a GL rule we currently rely on prose to enforce.
- **One spec → three renderers** — VL for print/SVG, ECharts/Chart.js for web.

The honest cost: Flint's Vega-Lite output is not px-native the way Observable Plot is
(`gl-observable-plot` is "the most literal encoding in the kit"), so the 12px *floor* and
exact stroke widths must be pinned in a GL config and verified in the render lint, not
assumed.

---

## 3. Proposed architecture — three layers

The integration mirrors the existing `gl-ggplot` / `gl-observable-plot` split: a **kernel**
(tokens + palettes + chrome), the **grammar semantics** that make it look like GL, and a
**skill** that delivers + lints it. `grammar.md` stays the single source of truth; every
Flint artifact below is a *downstream copy that must match it*.

### Layer 1 — the GL theme kernel (palettes + chrome)

The low-risk, most Flint-idiomatic contribution. Two sub-parts:

**1a. GL palettes into the `colormap.ts` seam.** Register a GL palette set keyed by the
abstract `schemeType` Flint already emits:
- `categorical` → `c_1…c_6` **main** tones (in GL order: blue, red, teal, purple, orange, yellow)
- `sequential` → `sequential_1…6` single-hue ramps (darker = higher)
- `diverging` → `diverging_2_1` (red↔blue, pivot 0), and the other named diverging sets
- named external taxonomies (`hs_sectors`, `sitc_sectors`, `product_space`) as explicit `schemeId`s

For ECharts/Chart.js this is a new entry in their `colormap.ts`. For Vega-Lite it's a
custom `scale.range` (VL takes an explicit range, not just a built-in scheme name).

**1b. GL chrome as a backend config.** Everything that isn't the data palette — the part
Flint has no hook for yet:
- **VL `config`**: `font: "Inter"`, title font `"Source Serif 4"` where GL uses serif,
  `labelFontSize:12` / `titleFontSize:14`, `axis.labelColor: ink_2`, `background: paper`,
  gridline `#D8D4CC`, `tickSize:0`, no domain line by default, tabular figures via
  `numberFormat`, stroke widths (line 2, axis 1).
- **ECharts**: `textStyle`, global `color`, `grid`, `axisLine`/`splitLine` equivalents.
- **Chart.js**: `defaults` overrides.

Because Flint exposes no theme-merge point today, Layer 1b lands one of two ways —
see §4 (upstream vs. wrap).

### Layer 2 — GL emphasis semantics (the part that makes it *look* like GL)

This is what turns "Flint with our colors" into "a GL chart." Flint has no concept of a
*focus* series. We add one:

- **A `focus` / `emphasis` annotation** on the encoding or a field (e.g. mark which
  category value(s) or rows carry the message, and an optional valence). A GL decision
  function then: paints non-focus in `c_muted`, focus in `c_1` (main blue) — or `c_2`
  (main red) when valence is negative — and lifts the focus stroke to 2.4px over the muted
  backdrop. This is the `mute-then-highlight` pattern expressed *as a Flint decision*,
  which is the genuinely principled move: it extends the grammar rather than post-painting.
- **Dark-tone label rule.** Any text tied to a colored mark (direct label, legend entry,
  annotation) renders in the **dark** partner of the mark's hue at weight 600. Maps to each
  backend's label/text color.
- **Color-count guard.** Surface the GL 5+ warning at author time (in the skill contract)
  and cap the emitted palette at 6; steer toward tones-of-one-hue for related categories.

Layer 2 is the interesting research question and the strongest argument for "integrate the
*kernel with the grammar*, not just the palette." It is also the most upstreamable —
a `focus`/emphasis concept is generally useful, not GL-specific.

### Layer 3 — the `gl-flint` skill (delivery + conformance)

A new skill, sibling to `gl-observable-plot`, that:
- teaches the agent to author `ChartAssemblyInput` **the GL way** (semantic types, the
  `focus` annotation, ≤6 colors, report-vs-standalone mode);
- ships the Layer-1 theme + Layer-2 decisions as an asset and applies them to the emitted
  spec (`assembleVL(input, { theme: gl })` if upstreamed, else a `applyGlTheme(spec)` wrap);
- **reuses the existing render lint.** `skills/gl-observable-plot/scripts/gl_lint_plot.mjs`
  already inspects *rendered SVG* (`--svg`) for off-palette color, non-Inter fonts, sub-12px
  text, and labels not in the dark tone. VL and ECharts both render to SVG, so the strong
  render-lint drops straight onto Flint output — the single biggest reason this integration
  is cheap to make *verifiable*;
- documents the md-pipeline path: same as Observable today (rule 13) — pre-render to
  SVG/PNG and embed in the figure block; no live renderer in the pandoc pipelines yet.

---

## 4. Delivery: wrap-only (decided)

Flint has the color seam but **no house-theme hook** (`background` is reserved, and chrome
lives inside each backend's `assemble.ts`). GL config + the focus semantics are delivered
by a **GL-side wrap** — no upstream dependency:

- `applyGlTheme(spec, backend)` — deep-merges the GL config (fonts, sizes, ink, paper,
  gridlines, `tickSize:0`, tabular, stroke widths) into Flint's emitted spec and rewrites
  the color `scale.range` to the GL palette.
- `deriveFocus(input | spec, { focus, valence })` — the mute-then-highlight pass: maps
  non-focus categories to `c_muted`, the focus to `c_1` (or `c_2` for negative valence),
  and lifts the focus stroke to 2.4px. Dark-tone label color applied in the same pass.

Rationale for wrap-only: full control, ships now, everything stays inside the `gl-design`
plugin. The cost we accept is tracking Flint's emitted-spec shape over time — mitigated by
pinning the `flint-chart` version and letting the **render lint** (which reads the final
SVG, not the spec) catch any drift that changes the picture. Upstreaming a native `theme`
hook + `focus` annotation is explicitly **out of scope** for this build.

---

## 5. Recommended scope for a first cut

1. **Layer 1 (palettes + VL config)** on the **Vega-Lite** backend only — VL is Flint's
   default and our print/SVG target. Prove the theme kernel end-to-end.
2. **Layer 2 focus + dark-label** as a wrap pass, on VL.
3. **Layer 3 skill** with the render-lint wired to `gl_lint_plot.mjs --svg`, plus 3–4
   playground charts (incl. a treemap or radar — the types we currently escape-hatch) as
   the dogfood battery.
4. ECharts/Chart.js backends as a fast-follow, once VL proves the shape.

This gives a verifiable, GL-looking Flint chart on the default backend, entirely inside the
`gl-design` plugin, and keeps `grammar.md` as the source of truth throughout.

---

## 6. As built (first cut)

Lives in `skills/gl-flint/`, a sibling downstream encoding to `gl-ggplot` /
`gl-observable-plot`. All tokens are a downstream copy of `grammar.md` §1 (cross-checked
against `docs/nil/data-vis-rules.md` and its revisions, and `/assets`).

- **`assets/gl-flint.mjs`** — the wrap runtime:
  - `GL` tokens + `glPalettes` (categorical/sequential/diverging), downstream copy of the spec.
  - `glVegaConfig` — the GL Vega-Lite `config` (Inter/Source Serif 4, 12px label / 14px title
    at weight 500, ink text, paper, `#D8D4CC` Y-grid only, `tickSize:0`, no domain line,
    per-mark default `c_1`, 2px round-join lines). Deep-merged **over** Flint's config so it
    corrects Flint's sub-floor `labelFontSize:10` while preserving Flint's view sizing.
  - `applyGlTheme(spec)` — merges the config and rewrites the color `scale` (Flint's abstract
    `categorical|sequential|diverging` → the GL palette range).
  - `applyFocus(spec, {focus, valence})` — **mute-then-highlight** as a spec transform:
    non-focus categories → `c_muted`, focus → `c_1` (or `c_2` for negative valence), focus
    stroke lifted to 2.4px via a `condition` test (VL ignores a discrete-field size scale).
  - `glColorCountCheck(input)` — the 5+/6-ceiling color guard at author time.
  - `glAssembleVegaLite(input, glOpts)` — Flint assemble → strip `_meta` → theme → focus.
  - `glRenderSVG` / `glSerializeSvg` — VL→Vega→standalone SVG with the GL root style injected
    (paper bg, Inter, 12px, tabular-nums) and a painted paper `<rect>`.
- **`scripts/gl_flint_render.mjs`** — render a themed spec to SVG, `--lint` runs the shared,
  backend-agnostic `checkSvg` (the grammar-derived render check) on the output.
- **`SKILL.md`** — the authoring contract (semantic types, the `focus` annotation, ≤6 colors,
  report-vs-standalone mode, the md-pipeline embed path).

**Verified — and adversarially hardened.** After the first cut, an adversarial multi-agent
review (18 critics → 6 verifiers → synthesis, 21 confirmed findings) compared gl-flint against
the mature `gl-observable-plot` on six real Complexity-Explainer figures, judging rasterized
renders against `grammar.md`. It surfaced five gl-flint **blockers** the SVG lint had passed
clean — all now fixed in `gl-flint.mjs`:
- **Scatter axis-type guard** — a numeric scatter field Flint compiled to *ordinal* (collapsing
  the scatter to a 1-D strip and dropping rows) is forced back to `quantitative`.
- **Mark-aware mute-then-highlight** — a **line** focus is rebuilt as a continuous muted backdrop
  + overpainted focus sharing the boundary vertex (no gap) with a direct end-label; a **scatter**
  focus is a layered muted cloud + a larger, dark-stroked, labelled focus dot; a **bar** remaps
  the scale and drops the legend. An unmatched focus falls back to a single blue series (never all-grey).
- **Zero baseline** auto-added when a bar/area value axis spans zero (grammar §7).
- **Orientation-aware gridlines, ranked-descending bars, human axis/legend labels, and the full
  Inter→sans fallback stack** (a bare `"Inter"` was degrading to serif) — each fixed a
  high-frequency major. The shared root cause is fixed upstream: `grammar.md` §2 now pins the
  canonical font-family token every downstream encoding must copy. gl-observable came out
  near-spec (2 minors). All six charts now render and pass `checkSvg` clean.

**Remaining follow-ups:**
- Per-series **dark-tone legend labels** aren't expressible in a VL legend; direct end-labels
  (now emitted for line/scatter focus) are the GL-preferred substitute.
- **ECharts backend** (treemap/sankey/heatmap/sunburst/funnel/gauge) needs its own GL colormap
  + theme — the next backend once VL proves the shape.
- Sector palettes (`hs_sectors`, …) not yet wired; add as named `schemeId` ranges.
- No live renderer in the md pipelines — pre-render to SVG/PNG and embed (same as Observable).
</content>
</invoke>
