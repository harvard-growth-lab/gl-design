# GL Data Visualization Spec — core content

Condensed from [`assets/design-library/GL_data_visualization_spec.pdf`](../assets/design-library/GL_data_visualization_spec.pdf)
(26 pp, *Growth Lab Design Spec Series*, rev. 2026-06-23). This is the dense,
implementable form of that document — every rule and every value, none of the
worked-example prose.

> **Authority.** This file is **downstream of [`grammar.md`](../grammar.md)**, not a
> second source of truth. It exists so an implementation (the R theme, the web chart
> library, an audit checklist) can read the chart rules in one place without
> re-reading a 26-page PDF. Where this file and `grammar.md` disagree, `grammar.md`
> wins and this file is the bug. §0 records every place the PDF itself diverges from
> `grammar.md` and how it was resolved.

---

## 0. Reconciliation with `grammar.md`

The PDF and `grammar.md` agree on every hex, size, and weight, with three exceptions.
All three are already adjudicated — do not "fix" them back toward the PDF.

| # | Topic | PDF says | `grammar.md` says | Resolution |
|---|---|---|---|---|
| 1 | Treemap tile opacity / stroke | §9 (p. 17): "category fill at 0.8 opacity and the matching darker stroke at full opacity" | §3.4: treemap = main tone, **full opacity, no stroke** | **`grammar.md` wins.** The PDF contradicts *itself* — its own §5 Marks (p. 10) lists treemap under "full opacity, no stroke", and its own Decision Rule 3 (p. 26) says "Single-layer marks (bars, treemap tiles, choropleth polygons) stay at full opacity." §9 is the outlier. Tiles are separated by a **paper gutter**, never by a stroke — see §3.4.1 and §9 below. |
| 2 | Gridline hex | `#D8D4CC` | `#D8D4CC` | Agree. Noted only because `docs/nil/data-vis-rules.md` still carries the retired `#ECE9E2` — that upstream file is **not** authoritative. |
| 3 | Muted main tone | `#AFB5BE` | `#AFB5BE` | Agree. Same note: `docs/nil/` still carries the retired `#999FA8`. |

### Open question — does the subtitle take a terminal period?

**Unresolved; needs a ruling.** Decision Rule 10 (p. 26) states: "Chart title ends with
a period. It reads as a finding statement. **Subtitle does not.**" But *every* worked
subtitle in the PDF ends with one — "GDP per capita vs. economic complexity, 2022.",
"Share of merchandise exports by category, 2003–2024, percent.", and nine others.
`grammar.md` is silent on the question.

Rules normally outrank illustrations, so this file follows Rule 10 (no period). But the
examples are unanimous against it, which is enough doubt that the implementation
**warns on a title missing its period and says nothing about the subtitle** rather than
enforcing a guess. Worth confirming with Nil.

The PDF also says "**Seven** categorical hues" (p. 4). That count includes `c-muted`.
There are **six** chromatic hues (`c-1`…`c-6`) plus the muted grey — matching
`grammar.md`'s "six hues" phrasing and Decision Rule 1's "seven-color palette
including a muted color". Not a conflict, just two ways of counting.

### Open question — do flat treemap tiles need separators in the pop-up case?

**Unresolved; needs a ruling.** `grammar.md` §3.4 gives `paper` separators only to
*two-level* treemaps; flat single-level tiles "abut directly". That reads fine when
tiles carry different hues. It fails in the pop-up treemap (§14, the PDF's Figure 11),
where every supporting tile is the same `c-muted`: with no boundary between them, the
seven muted tiles merge into one grey mass and the composition stops being readable.
The PDF's own plate separates them and is legible.

The rule may need a pop-up exception — separators whenever adjacent tiles share a fill.
Surfaced by the fidelity run in
[`packages/gl-charts/gallery/reports/`](../packages/gl-charts/gallery/reports/).

### Open question — `paper` text on a `c-muted` tile fails WCAG AA

**Unresolved; needs a ruling.** White labels on a `c-muted` (`#AFB5BE`) treemap tile
come out around **2:1** contrast, well under the 4.5:1 AA threshold for body text. The
PDF's plate does the same thing, so this is a question for `grammar.md` rather than a
library bug. Two fixes both work and the spec should pick one: label in
`c-muted-dark` (`#5F6773`), or fill the tile in `c-muted-light` (`#CDD2D9`) and label
in dark. The second keeps the "everything else recedes" reading better.

Note this is the same three-tones-three-jobs rule the spec already states everywhere
else — a label tied to a mark takes that mark's **dark** tone. The treemap plate is
the one place the PDF departs from its own rule.

### CSS variable aliases

The PDF names in-chart ink with `--chart-*` tokens. They are aliases of the grammar
ink ramp, not new colors. Any implementation must resolve them to the same hex:

| PDF token | Grammar token | Hex |
|---|---|---|
| `--chart-title` | `ink` | `#1A1714` |
| `--chart-axis-label`, `--axis` | `ink-2` | `#2C2823` |
| `--chart-subtitle` | `ink-3` | `#4F4A42` |
| `--chart-gridline` | `gridline` | `#D8D4CC` |
| `--chart-accent` | `accent` (= `c-1-dark`) | `#1A5A8E` |

---

## 1. Foundations — type & ink

Two families. No third family, no new neutrals.

- **Source Serif 4** — chart **title** (14 px / 500) and chart **source** (12 px
  italic). *Nothing else inside the figure block is serif.*
- **Inter** — subtitles, axis labels, axis ticks, series labels, annotations,
  legends. Weights 400 / 500 / 600. Always `font-variant-numeric: tabular-nums`
  on numeric ticks and any numeric tabular data.

Ink: see the alias table in §0.

---

## 2. Palettes

### Categorical — six hues × three tones, plus muted

Tokens follow `--c-N-light` / `--c-N` / `--c-N-dark`.

| | Light | Main | Dark | Role |
|---|---|---|---|---|
| `c-1` | `#B5D5EA` | `#2F87C8` | `#1A5A8E` | Primary — single-series default |
| `c-2` | `#E89C9C` | `#CC4948` | `#8A2C2B` | Contrast / lead-finding red |
| `c-3` | `#92D6BF` | `#2AA584` | `#1A6B53` | Third series |
| `c-4` | `#B5A0CC` | `#7554A3` | `#4A3470` | Fourth series |
| `c-5` | `#F4BC8A` | `#EA822D` | `#A8580F` | Fifth series |
| `c-6` | `#E6E2A8` | `#CDC86B` | `#8A8638` | Sixth series |
| `c-muted` | `#CDD2D9` | `#AFB5BE` | `#5F6773` | De-emphasis — "everyone else" |

**Three tones, three jobs** — the single most-violated rule:

- **Main** → every fill and every line. Bars, areas, treemap tiles, choropleth
  polygons, scatter-circle interiors, line strokes.
- **Dark** → strokes on *overlapping* marks, and **every text element tied to the
  color**: direct labels, end-labels, legend entries, callouts, annotations.
  Required for WCAG AA against white paper.
- **Light** → backgrounds, faded states, highlight bands, the pale end of a
  sequential ramp.

> **Test:** if a text element names or points at a colored mark, it uses that mark's
> **dark** tone. There is no case where a label shares the exact hex of its fill.
> This includes muted series — a `c-muted` line gets a `c-muted-dark` label.

Colors are added **in order**: `c-1`, then `c-2`, then `c-3`… Using all six requires
absolute necessity; needing more than six means the chart type is wrong.

The **only** place the dark tone is used as a *fill* is the three-tone stacked area
(§8c).

### Sequential — single-hue ramps

Ordered low→high, no meaningful midpoint. **Darker = higher.** Five steps by
default; three for a coarse classification, seven or more for a fine gradient.

| Ramp | Low → high |
|---|---|
| `sequential-1` · blue | `#E5F0F9` `#B5D5EA` `#6FA5CE` `#2F87C8` `#1A5A8E` |
| `sequential-2` · red | `#F4D5D5` `#E89C9C` `#DC6F6E` `#CC4948` `#8A2C2B` |
| `sequential-3` · teal | `#D5EFE7` `#92D6BF` `#5BC0A0` `#2AA584` `#1A6B53` |
| `sequential-4` · purple | `#E5DDF0` `#B5A0CC` `#9276BA` `#7554A3` `#4A3470` |
| `sequential-5` · orange | `#FBE5D5` `#F4BC8A` `#EE9A52` `#EA822D` `#A8580F` |
| `sequential-6` · yellow | `#FBF8DC` `#E6E2A8` `#DCD68E` `#CDC86B` `#8A8638` |

Default to `sequential-1` unless the variable has a hue convention.

### Diverging — meaningful midpoints only

The boundary between hues **is** the midpoint. Six steps by default. Never on a
purely positive scale.

| Ramp | Negative tail → midpoint → positive tail |
|---|---|
| `div-2-1` · red↔blue *(default)* | `#8A2C2B` `#DC6F6E` `#EFC7C0` │ `#C5DCEC` `#6FA5CE` `#1A5A8E` |
| `div-3-1` · teal↔blue | `#1A6B53` `#5BC0A0` `#BDE5D8` │ `#C5DCEC` `#6FA5CE` `#1A5A8E` |
| `div-5-1` · orange↔blue | `#A8580F` `#EE9A52` `#F4BC8A` │ `#C5DCEC` `#6FA5CE` `#1A5A8E` |
| `div-6-1` · yellow↔blue | `#8A8638` `#DCD68E` `#E6E2A8` │ `#C5DCEC` `#6FA5CE` `#1A5A8E` |

When color encodes **sign**, every mark follows the sign encoding — residual or
"unspecified" buckets are colored by their sign like any other bar, never pulled
out into grey. A lone muted mark among signed marks reads as a third category.

---

## 3. Chart typography — the figure block

Five elements, top to bottom. Sizes are CSS px.

| Element | Family | Size | Weight | Color | Notes |
|---|---|---|---|---|---|
| **Figure label** | Inter | 12 | 600 | `accent` | UPPERCASE, tracking `0.14em`. Numbered sequentially. Class `.figlbl` |
| **Chart title** | Source Serif 4 | 14 | 500 | `ink` | Leading 1.25, tracking `-0.005em`. **Always ends in a period** — it reads as a finding |
| **Chart subtitle** | Inter | 12 | 400 | `ink-3` | Leading 1.4. Units, period, unit of analysis. Omit when redundant. **No period** |
| **Chart source** | Source Serif 4 *italic* | 12 | 400 | `ink-2` | Leading 1.45. **Always required.** One line below the chart |

Inside the panel:

| Element | Family | Size | Weight | Color | Notes |
|---|---|---|---|---|---|
| **Axis label** | Inter | 12 | 500 | `ink-2` | Sentence case, never all caps. X centered below ticks; Y rotated −90°, centered left of ticks |
| **Axis tick label** | Inter | 12 | 400 | `ink-2` | `tabular-nums` always |
| **Series label** | Inter | 12 | 600 | series **dark** tone | Direct label at line end, or small legend below |
| **Annotation** | Inter | 12 | 400 | `ink-2` | Sparingly |

12 px is the **floor** for all in-chart text. Labels that do not fit are dropped,
never shrunk below it.

Direct labels drawn over data carry a thin `paper` halo (radius ≈ `0.1em`) so they
stay legible over marks. The halo never substitutes for the dark-tone rule.

---

## 4. Axes, ticks, gridlines

Present but quiet.

| Property | Value |
|---|---|
| Axis line | 1 px solid `ink-2` (`#2C2823`) |
| Tick mark | 1 px, **4 px long, outward** — never inward |
| Tick label offset | 6 px outside the axis |
| Gridline | 1 px solid `gridline` (`#D8D4CC`) |
| Zero baseline | Stroke at **axis** weight, never gridline weight |

**Axis-label offset** — measure from the *start of the tick label*, not from the
axis line: 20 px left of the leftmost character of the widest Y tick label, and
20 px below the X tick baseline. Measuring from the axis line lets wide ticks like
"250" collide with the rotated Y label.

**Gridlines only where the reader must estimate a value off the axis.** Never both X
and Y unless the chart is dense.

**Year axis** — when X is just years, omit the axis label; the ticks already say
what the dimension is.

**Tick alignment** — Y tick labels right-align (flush to the axis) so variable-width
labels keep a constant gap; X tick labels top-align under the axis.

---

## 5. Marks — fill, stroke, opacity

| Mark | Fill | Stroke | Notes |
|---|---|---|---|
| **Scatter circle** | main, `fill-opacity: 0.8` | dark, `stroke-opacity: 0.8`, 1 px | r 5–7 px. The **only** mark with reduced fill opacity |
| **Line** | — | main, full opacity, **2 px** (2.4 px focus) | `stroke-linejoin: round`. Solid only — dashed reserved for projections |
| **Bar / area** | main, full opacity | none | Stacked: **1 px gap** between segments |
| **Treemap tile** | main, full opacity | none — separation is a gap, not a stroke | **5 px `paper` gutter** between tiles (§9) |
| **Choropleth polygon** | sequential/diverging tone, full opacity | `ink-3`, 0.5 px | Separates regions |
| **Radar polygon** | main, `fill-opacity: 0.25` | main, full opacity, 2 px round join | Lower fill so gridlines/labels read through |

**The 0.8 rule is for overlap.** Scatter circles use the *same* 0.8 on fill and
stroke so overlapping points darken together into a density signal. Single-layer
marks (bars, treemap tiles, choropleths) stay at full opacity — overlap isn't a
risk there and lowering opacity just dilutes the color.

---

## 6–13. Chart type catalog

### 6. Scatter plot
The relationship between two continuous variables. Category-fill circle at 0.8, darker
stroke at 0.8. **Overlap is desirable** — it shows clustering.

### 7. Line chart
Change over a continuous variable, usually time. **Up to four series**; beyond that,
mute the supporting lines in `c-muted` and let the focus series carry the finding.
Prefer direct end-labels over a legend.

### 8. Stacked chart
How a total composes. **Up to six categories**, ordered from largest mean share at
the bottom upward. Main-tone fills at full opacity, no stroke, **1 px gap** between
segments — the gap gives a clean category boundary and helps readers with low color
discrimination separate adjacent bands.

#### 8b. Two-tone option
When two categories share a parent (goods vs. services), use one hue at **main +
light** rather than two unrelated colors. The shared hue keeps the bar reading as one
total; lightness carries the split. 1 px gap still applies.

#### 8c. Three-tone option
Three categories in one parent (low/medium/high, primary/intermediate/final) → **light
/ main / dark of one hue**. Stacked-**area** is the natural form: lightest tier at the
bottom, darkest at the top, so the lightness ramp itself carries the ordering. Bands
sit edge-to-edge — **no stroke and no gap**; the lightness step does the separating.

*This is the one place outside a scatter stroke where the dark tone is used as a fill.*

### 9. Treemap
Composition of a whole across many categories with very uneven shares. Tiles are
main-tone fill at **full opacity, no stroke** (see §0 #1 — the PDF's §9 page is the
known outlier). Label format: name, then value · share.

Tiles are separated by a **`paper` gutter, at every depth** — including a flat
single-level treemap. Measured off the PDF's own plates: Figure 4 (p. 17) and
Figure 11 (p. 24) both use a uniform 4.8 px gutter on both axes, and Figure 11 is
the case that proves the rule — seven `c-muted` tiles with nothing but the gutter
between them.

| Part | Value |
|---|---|
| Gutter between sibling tiles | **5 px** `paper`, same on both axes |
| Gutter between parent blocks | **10 px** `paper` — twice the sibling gutter |
| Outer edge of the plot | flush — no gutter against the plot boundary |
| Tile label padding | **12 px** from the tile's top and left |
| Label line 1 (name) | Inter 12 / 600, baseline **24 px** below the tile top |
| Label line 2 (value · share) | Inter 12 / 400, baseline **40 px** (16 px line step) |
| Label color | `paper` where the fill's relative luminance < **0.4**, else `ink` |

The luminance rule puts `paper` on `c-1` through `c-5` (the lightest of them,
`c-5`, is L 0.34) and `ink` on `c-6` (L 0.55), `muted` (L 0.46), `muted-light`,
and every `light` tone — the fills where paper text falls under 2.5:1.

**Shorten before dropping.** `USD 6.2B · 38%` → `6.2B · 38%` → `6.2B` → no label.
Type never shrinks below the 12 px floor, and a label that still won't fit inside
its padding is dropped rather than clipped or spilled onto the next tile.

**Squarify in plot space.** Computing the layout in the unit square and scaling
the result stretches every tile by the plot's aspect ratio — the one thing the
algorithm exists to prevent.

### 10. Radar chart
Profile one entity across **four to eight** dimensions on a shared normalized scale.

| Part | Value |
|---|---|
| Series fill | `c-1` (`#2F87C8`) at `fill-opacity: 0.25` |
| Series stroke | `c-1` full opacity, 2 px, `stroke-linejoin: round` |
| Vertex dot | r 3 px, filled `c-1`, no stroke |
| Grid rings | 1 px `gridline`; **outermost ring `ink-3`** |
| Axis lines | 1 px `ink-3`, center → each outer vertex |
| Axis labels | Inter 12 / 500 / `ink-2`, just outside the outer ring |
| Scale ticks | Inter 12 / 400 / `ink-2`, along the top |

### 11. Boxplot & violin
The **spread** of a distribution, not a point or a trend. Box = IQR; whiskers = 10th
and 90th percentiles. Keep the supporting distribution muted and draw one focus entity
on top. A violin is the same construction with a density silhouette in place of the box.

| Part | Value |
|---|---|
| Box fill | `c-muted-light` (`#CDD2D9`) |
| Box stroke | `c-muted` (`#AFB5BE`), 1 px |
| Median | `c-muted-dark` (`#5F6773`), 1.5 px |
| Whiskers | 10th–90th pct, short end-caps |
| Focus line | `c-1`, 2.4 px, over the boxes |
| Focus points | fill `c-1` / stroke `c-1-dark`, 0.8 opacity, r 5 px |
| End labels | focus `c-1-dark`; peer `c-muted-dark` |
| Second series | `c-muted` at the same opacity, stacked *under* the focus series |

### 12. Geomap — sequential
Value runs low→high with no natural midpoint. Five steps, single hue, darker = higher.
Polygons full opacity; `ink-3` stroke at 0.5 px. Horizontal step legend under the title.

### 13. Geomap — diverging
Value has a meaningful midpoint (change vs. baseline, above vs. below average). Red
negative tail, blue positive tail, near-white midpoint. Same polygon treatment.

---

## 14. The pop-up effect — the default move

> Color should only be used when it is necessary. When you have categorical data, you
> do not have to color every category differently.

**Always ask first whether the story can be told by a pop-up instead.** Paint the
supporting data in `c-muted` (`#AFB5BE`); reserve a saturated hue — usually `c-1`,
sometimes `c-1` + `c-2` — for the one or two series the reader actually needs to
track. Labels in the matching **dark** focus tone.

The muted layer carries the trend; the highlight carries the finding.

This works on every chart type: line (focus series over muted peers), scatter (focus
points over muted cloud), treemap (only the focus tile colored), bar (one bar colored
in a ranked list), boxplot (focus line over muted boxes).

---

## 15. Decision rules

Work through this list before adding a new chart style.

1. **Seven-color palette including a muted color.** Colors are added in order —
   `c-1`, then `c-2`, `c-3`… All six categorical colors only if absolutely necessary.
   More than six ⇒ re-think the representation mode.
2. **The dark tone is for strokes and all text associated with the visualization.**
   Scatter-circle strokes, every direct label, legend entry, callout, and annotation.
   Main tones do all the fill work. Required for WCAG AA against white.
3. **Overlapping encodings get 0.8 opacity** — `fill-opacity` and `stroke-opacity`
   together, so overlaps darken visibly. Single-layer marks stay at full opacity.
4. **Axis line and ticks are 1 px `--axis` (`#2C2823`)**, ticks 4 px, outward, never
   inward.
5. **Gridlines are 1 px `--gridline` (`#D8D4CC`)** — only where the reader needs to
   estimate a value; never both X and Y unless dense.
6. **Axis labels Inter 12/500/`ink-2`; tick labels Inter 12/400/`ink-2`** with
   tabular-nums.
7. **Color encodes meaning, not decoration.** If a color isn't earning its keep — a
   category, a threshold, a highlight — remove it.
8. **Whenever possible, implement the pop-up effect** (§14).
9. **Sequential for ordered values; diverging only with a meaningful midpoint.** Never
   diverging on a purely positive scale.
10. **Chart title ends with a period** — it reads as a finding statement. Subtitle
    does not.
11. **No monospace.** All numerals use Inter with `font-variant-numeric: tabular-nums`.
