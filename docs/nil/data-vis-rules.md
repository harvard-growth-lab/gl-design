# Growth Lab — Data Visualization Spec

> Markdown transcription of `docs/nil/data vis.html` (Nil's data-viz spec & sample
> charts). This is the source of truth for chart rules. Where the HTML
> contradicts itself, the contradiction is flagged inline as **[spec
> conflict]**.

---

## 1. Foundations — type & ink

Every chart is built from **two type families** and a **small set of ink
colors**. Resist adding a third family or new neutrals; reach for existing
tokens first.

**Type families**

| Family | Role | Weights | Notes |
|--------|------|---------|-------|
| **Source Serif 4** (serif) | Chart **title** and chart **source** only | 400, 500; italic for sources | Nothing else inside the figure block uses serif. Title = 14px / 500; source = 12px italic. |
| **Inter** (sans) | Everything else: subtitles, axis labels, axis ticks, series labels, annotations, legends | 400, 500, 600 | Always `font-variant-numeric: tabular-nums` on numeric ticks and any numeric tabular data. |

**Ink palette**

| Token | Hex | Use |
|-------|-----|-----|
| `--ink` | `#1A1714` | Chart title, strong emphasis |
| `--ink-2` | `#2C2823` | Axis line, axis labels, tick labels, annotations |
| `--ink-3` | `#4F4A42` | Subtitles, secondary captions |
| `--gridline` | `#ECE9E2` | Horizontal/vertical gridlines inside the plot |
| `--accent` | `#1A5A8E` | Figure label, primary single-series default |

> **[spec conflict]** The ink-palette row lists `--ink` (#1A1714) for "axis
> line," but the dedicated Axes section and Decision Rule 4 both say the axis
> line is `--axis` (#2C2823 = ink-2). Treat **axis line = #2C2823**.

> **[spec conflict]** The Chart-typography table lists the figure-label color
> as `--accent (#2F87C8)`, but `--accent` is defined as **#1A5A8E** and the
> figure-label CSS uses #1A5A8E. Treat **figure label = #1A5A8E**.

> **[revised — Nil, 2026-06-16]** `--gridline` above (`#ECE9E2`) was later
> darkened by Nil to **`#D8D4CC`** (commit `182ea68`, "styling changes").
> `grammar.md` carries the current value; the table above is the original.

---

## 2. Chart color palettes

### Categorical — main palette

Seven categorical hues (six colors + one muted), each in **three tones**:
light / main / dark. Tokens follow `--c-N-light / --c-N / --c-N-dark`.

- **Main tone** = the default fill for **every** mark (lines, bars, treemap,
  scatter circles).
- **Dark tone** = scatter-circle strokes **and all text** associated with the
  color (direct labels, legend entries, callouts, annotations). Required for
  WCAG AA against white.
- **Light tone** = backgrounds, faded states, highlight bands, the lightest
  steps of sequential ramps.

| Token | light · main · dark | Role |
|-------|---------------------|------|
| `c-1` (blue) | #B5D5EA · **#2F87C8** · #1A5A8E | Primary — single-series default |
| `c-2` (red) | #E89C9C · **#CC4948** · #8A2C2B | Contrast / lead-finding red |
| `c-3` (teal) | #92D6BF · **#2AA584** · #1A6B53 | Third series |
| `c-4` (purple) | #B5A0CC · **#7554A3** · #4A3470 | Fourth series |
| `c-5` (orange) | #F4BC8A · **#EA822D** · #A8580F | Fifth series |
| `c-6` (yellow) | #E6E2A8 · **#CDC86B** · #8A8638 | Sixth series |
| `c-muted` | #CDD2D9 · **#999FA8** · #5F6773 | De-emphasis — "everyone else" |

> **[revised — Nil, 2026-06-16]** The main muted tone (`#999FA8`) was later
> lightened by Nil to **`#AFB5BE`** (commit `182ea68`, "styling changes"); the
> light and dark tones are unchanged. `grammar.md` carries the current value.

### Sequential — single-hue ramps

Choropleths and any ordered low→high encoding. **Darker = higher.** Examples
show five steps, but the **step count should match the data** (three for
coarse, seven+ for fine).

| Hue | Steps (low → high) |
|-----|--------------------|
| c-1 blue | #E5F0F9, #B5D5EA, #6FA5CE, #2F87C8, #1A5A8E |
| c-2 red | #F4D5D5, #E89C9C, #DC6F6E, #CC4948, #8A2C2B |
| c-3 teal | #D5EFE7, #92D6BF, #5BC0A0, #2AA584, #1A6B53 |
| c-4 purple | #E5DDF0, #B5A0CC, #9276BA, #7554A3, #4A3470 |
| c-5 orange | #FBE5D5, #F4BC8A, #EE9A52, #EA822D, #A8580F |
| c-6 yellow | #FBF8DC, #E6E2A8, #DCD68E, #CDC86B, #8A8638 |

### Diverging — two-hue ramps

Use where data has a meaningful midpoint (gains vs. losses, above/below
average). The boundary between hues marks the midpoint. Examples show six
steps; **adjust step count to the data.**

| Pair | Steps (negative → positive) |
|------|------------------------------|
| c-2 ↔ c-1 (red→blue, default) | #8A2C2B, #DC6F6E, #EFC7C0, #C5DCEC, #6FA5CE, #1A5A8E |
| c-3 ↔ c-1 (teal→blue) | #1A6B53, #5BC0A0, #BDE5D8, #C5DCEC, #6FA5CE, #1A5A8E |
| c-5 ↔ c-1 (orange→blue) | #A8580F, #EE9A52, #F4BC8A, #C5DCEC, #6FA5CE, #1A5A8E |
| c-6 ↔ c-1 (yellow→blue) | #8A8638, #DCD68E, #E6E2A8, #C5DCEC, #6FA5CE, #1A5A8E |

---

## 3. Chart typography

| Element | Family | Size | Weight | Color | Notes |
|---------|--------|------|--------|-------|-------|
| Figure label | Inter | 12px | 600 | `--accent` #1A5A8E | Uppercase, 0.14em. Numbered sequentially. |
| Chart title | Source Serif 4 | 14px | 500 | `--ink` | Leading 1.25, tracking −0.005em. **Always ends in a period** — reads as a finding. |
| Chart subtitle | Inter | 12px | 400 | `--ink-3` | Leading 1.4. Gives units/period/unit-of-analysis. Omit if redundant. Does **not** end in a period. |
| Axis label | Inter | 12px | **500** | `--ink-2` | Sentence case, never all caps. X centered below ticks; Y rotated −90°. |
| Axis tick label | Inter | 12px | 400 | `--ink-2` | `tabular-nums` always. |
| Series label | Inter | 12px | 600 | **dark** category color (`--c-N-dark`) | Direct line-end labels or small legend. Dark tone required for WCAG AA. |
| Chart source | Source Serif 4 *italic* | 12px | — | `--ink-2` | Always required, one line below chart. Leading 1.45. |

---

## 4. Axes, ticks, gridlines

Axes carry the frame of reference — present but quiet.

| Element | Spec |
|---------|------|
| Axis line | 1px solid `--axis` #2C2823 |
| Tick mark | 1px, **4px long, outward** (never inward), `--axis` |
| Gridline | 1px solid `--gridline` #ECE9E2 |
| Tick label | Inter 12px / 400 / `--ink-2` / tabular-nums |
| Axis label | Inter 12px / 500 / `--ink-2` |
| Tick offset | Tick label sits 6px outside the axis |
| Label offset | Axis label measured from the **start of the tick label** — 20px left of the leftmost char of the widest Y tick (so wide ticks like "250" don't collide); same 20px on X below the tick baseline |
| **Year axis** | When the X axis is just years, **omit the axis label** — the tick labels already name the dimension |
| Zero baseline | Stroke at ink weight, never gridline weight |

Gridlines: use only where the reader needs to estimate a value off the axis;
**never both X and Y unless the chart is dense.** (Horizontal-bar charts put
gridlines on X.)

---

## 5. Marks — circles, lines, areas

Every category color is a fill / stroke pair.

- **Scatter circles** are the **only** mark with reduced fill opacity:
  `fill-opacity: 0.8` **and** `stroke-opacity: 0.8` (same value, so overlapping
  points darken together to signal density). Fill = main tone; stroke = darker
  tone of the same hue, 1px. Default radius **5–7px**.
- **Bars / areas / treemap tiles** = main tone at **full opacity, no stroke**
  (tiles abut directly).
- **Lines** = main tone at full opacity. **2px standard / 2.4px** for the
  highlighted focus series. `stroke-linejoin: round`. **Solid only** — dashed
  only for projections.

---

## 6. Stacked chart

Stacked bars/areas show how a total composes. Up to six categories, **ordered
largest mean share at the bottom upward.** Fills = main tone, full opacity, no
stroke.

- **1px gap** separates each bar segment from the one above (clean boundary +
  helps low-color-discrimination readers). The gap applies to stacked **bars**
  (incl. two-tone bars). Stacked **areas** sit edge-to-edge with no gap.
- **A marker placed on top of a stacked bar** (e.g. a net-total dot over the
  segments) uses the **lightest muted tone (`--c-muted-light`) with a white
  stroke** — the saturated segment tones are built to contrast strongly with
  white, so a pale dot ringed in white reads cleanly on top of them, where a
  dark-stroked dot would vanish into the darker segments. *[added rule — Nil,
  2026-06]*

---

## 7. Two- or three-tone option

Whenever possible, **prefer different tones of one hue over different colors.**
Works for categorical data when categories share a parent (goods vs. services;
low/med/high; primary/intermediate/final).

- **Two-tone**: one hue at `--c-N` (main) + `--c-N-light`. The shared hue keeps
  the bar reading as one total; lightness carries the split. 1px gap still
  applies (bars).
- **Three-tone**: `--c-N-light` / `--c-N` / `--c-N-dark`, naturally a stacked
  **area** (lightest tier at bottom → darkest at top). This is **the one place
  outside scatter where the dark tone is used as a fill**, because all bands
  belong to one parent variable. Bands sit edge-to-edge, no stroke, no gap.

---

## 8. Tree map

Use for composition of a whole across many uneven-share categories.

> **[spec conflict]** The Tree-map section says each tile uses "category fill
> at 0.8 opacity and the matching darker stroke at full opacity." But the Marks
> section and Decision Rule 3 say treemap tiles are **full opacity, no stroke**,
> and the sample treemaps (Fig 4, Fig 10) render full-opacity fills. Treat
> **treemap tiles = full opacity, no stroke** unless Nil confirms otherwise.

Tile labels: Inter, white text on dark tiles (with a dark-text fallback on
light tiles), value + share on a second line.

---

## 9. Radar chart

Profiles a single entity across 4–8 dimensions on a shared normalized scale.

| Element | Spec |
|---------|------|
| Series fill | `--c-1` #2F87C8 at **`fill-opacity: 0.25`** (gridlines/labels read through) |
| Series stroke | `--c-1` full opacity, 2px, round join |
| Vertex dot | 3px radius, filled `--c-1`, no stroke |
| Grid rings | 1px `--gridline`; **outermost ring** `--ink-3` |
| Axis lines | 1px `--ink-3`, center → each outer vertex |
| Axis labels | Inter 12px / 500 / `--ink-2`, outside the outer ring |
| Scale ticks | Inter 12px / 400 / `--ink-2`, along the top axis only |
| Second series | `--c-muted` at the same opacity, stacked *under* the focus series |

---

## 10. Geomaps

- **Sequential choropleth** — value runs low→high, no midpoint (population,
  GDP, complexity). Single-hue ramp, darker = higher. Polygons full opacity;
  **0.5px `--ink-3` stroke** between regions.
- **Diverging choropleth** — meaningful midpoint (change vs. baseline, gain vs.
  loss). Red = negative tail, blue = positive, near-white midpoint. Full
  opacity; 0.5px `--ink-3` stroke. Never use diverging for purely positive
  scales.

---

## 11. The pop-up effect

**Color only when necessary.** With categorical data you do not have to color
every category. Always ask first whether a **pop-up** tells the story: paint
supporting data in `--c-muted` (#999FA8) and reserve a saturated hue (usually
`--c-1`, sometimes `--c-1` + `--c-2`) for the one or two series the reader must
track. The muted layer carries the trend; the highlight carries the finding.

Applies to scatter (muted bubbles + one highlighted), line (muted lines + 1–2
focus at 2.4px), treemap (only focus tile colored), and horizontal bars (only
focus bar colored). Labels use the matching focus dark tone.

---

## 11b. Background distribution + highlighted reference

> **[added rule — not in the original HTML spec]** Nil, 2026-06.

When a chart shows the **background distribution** of a peer set (box plots, or
violins) with a single entity drawn against it (a country line), the
distribution marks should use the **more muted grey** so they sit clearly in
the background — soft grey fill (`--c-muted-light`) with a medium-grey outline
(`--c-muted`), *not* a dark outline. The reference entity is then the only
saturated mark: a focus line in the main hue (`--c-1`) with a matching dark-tone
point/label on top. The eye goes to the country, the boxes read as context.

---

## 12. Decision rules

1. **Seven-color palette including a muted color.** Colors are added in order —
   c-1, then c-2, c-3, … All six categorical colors only with absolute
   necessity. More than six → re-think the representation.
2. **The darker tone is for strokes and all text.** Scatter strokes use the
   dark version of the fill; every direct label, legend entry, callout, and
   annotation also uses the dark tone. Main tones do all the fill work. (WCAG
   AA.)
3. **Overlapping encodings get 0.8 opacity.** Where marks sit on top of each
   other (scatter circles, area bands, overlaid polygons) apply
   `fill-opacity: 0.8` **and** `stroke-opacity: 0.8` together. Single-layer
   marks (bars, treemap tiles, choropleth polygons) stay full opacity.
4. **Axis line and ticks are 1px `--axis` (#2C2823).** Ticks 4px long, outward,
   never inward.
5. **Gridlines are 1px `--gridline` (#ECE9E2).** Only where the reader needs to
   estimate off the axis; never both X and Y unless the chart is dense.
6. **Axis labels: Inter 12px / 500 / `--ink-2`.** Tick labels: Inter 12px /
   400 / `--ink-2` with `tabular-nums`.
7. **Color encodes meaning, not decoration.** If a color is not earning its
   keep, remove it.
8. **Whenever possible, implement the pop-up effect.**
9. **Sequential ramp for ordered values; diverging only with a meaningful
   midpoint.** Never diverging for purely positive scales.
10. **Chart title ends with a period.** It reads as a finding. Subtitle does
    not.
11. **No monospace.** All numerals use Inter with
    `font-variant-numeric: tabular-nums`.
