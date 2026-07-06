# Growth Lab Visual Grammar

The grammar is the medium-agnostic foundation of the Growth Lab design system:
the color, type, and chart conventions that hold true whether an output is a
50-page report, a presentation slide, a one-page brief, a standalone chart, or
a web page. Specific outputs ("recipes") apply the grammar to a medium —
picking page geometry, anchor sizes, and density to suit the artifact. See
[`recipes/`](recipes/) for those applications.

The system is small on purpose. Before introducing a new style, work through
the rules in §4.

## 1. Color

### Ink — a four-layer warm ramp

Text is layered. Black for emphasis, near-black for body, warm grey for
secondary copy, paler grey for hairlines. The ramp is **warm** (browns,
not neutral greys) — it sits on paper, not on a screen.

| Token   | Hex       | Use                                                              |
|---------|-----------|------------------------------------------------------------------|
| `ink`   | `#1A1714` | Cover title, all headings, strong emphasis, table emphasis cells |
| `ink-2` | `#2C2823` | Body copy, axis text, table cells                                |
| `ink-3` | `#4F4A42` | Captions, eyebrows, page chrome, secondary copy, chart subtitles |
| `ink-4` | `#9A9389` | Trendlines, deep-background markers (rarely used outside charts) |

For hairline borders between blocks, use `rule` (below), not `ink-4`. `ink-4`
is reserved for *inside* the chart panel — the trendline behind the data
(the `geom_smooth` default). (A radar's outermost grid ring is `ink-3`, per
Nil §9 — not `ink-4`.)

### Accent

| Token         | Hex       | Use                                                                |
|---------------|-----------|--------------------------------------------------------------------|
| `accent`      | `#1A5A8E` | Cover date, eyebrows, figure labels, footnote anchor, accent text  |
| `accent-deep` | `#003E6B` | Reserved — strong emphasis variant                                 |
| `accent-soft` | `#3A85B8` | Reserved — softer variant                                          |
| `accent-tint` | `#E1F0FA` | Background tint for accent panels                                  |

`accent` and `c-1-dark` are intentionally the same hex: when the c-1 series
needs a direct label or legend mark, it uses the dark tone (`accent`) for
WCAG AA contrast against paper.

### Paper & chrome

| Token        | Hex       | Use                                                |
|--------------|-----------|----------------------------------------------------|
| `paper`       | `#FFFFFF` | Content page paper (pure white)                    |
| `cover-bg`    | `#F3F2EA` | Cover page paper — do not use on content pages     |
| `cover-disk`  | `#ECEBE0` | Report-cover medallion disk — one tone darker than `cover-bg` |
| `paper-warm`  | `#F4F1EA` | Warm surface — accent panels, code / quote tint    |
| `rule`        | `#DDDDDD` | Hairline borders between content blocks            |
| `gridline`    | `#D8D4CC` | In-chart gridlines (see §3)                        |

> **[revised — Nil, 2026-06-16]** `gridline` was `#ECE9E2` in the original
> data-vis spec; Nil darkened it to `#D8D4CC` (commit `182ea68`). This value
> is current — do not "correct" it back against `docs/nil/data-vis-rules.md`.

The split is deliberate: content pages are pure white so figures land
on a neutral background and color reads true; the cover is warmer (`cover-bg`)
to mark the threshold into the document.

### Categorical chart palette — six hues, three tones each

Each categorical color comes in **light / main / dark**. The main tone fills
geoms (bars, lines, treemap tiles). The dark tone strokes overlapping shapes
and renders every label, legend mark, or text annotation associated with the
series — it carries the WCAG AA contrast against paper. The light tone is
for backgrounds, faded states, and sequential ramps.

|       | Light       | Main      | Dark        | Role                              |
|-------|-------------|-----------|-------------|-----------------------------------|
| `c-1` | `#B5D5EA`   | `#2F87C8` | `#1A5A8E`   | Primary — single-series default; institutional voice (same as `accent`) |
| `c-2` | `#E89C9C`   | `#CC4948` | `#8A2C2B`   | Contrast / lead-finding red       |
| `c-3` | `#92D6BF`   | `#2AA584` | `#1A6B53`   | Third series                      |
| `c-4` | `#B5A0CC`   | `#7554A3` | `#4A3470`   | Fourth series                     |
| `c-5` | `#F4BC8A`   | `#EA822D` | `#A8580F`   | Fifth series                      |
| `c-6` | `#E6E2A8`   | `#CDC86B` | `#8A8638`   | Sixth series                      |

Use in order: `c-1` first, then `c-2`, etc. The palette is deliberately
small — six categories is a working-memory limit. If a chart truly needs
more, re-think the encoding or use the muted base in §3.

### Muted — for de-emphasis

| Token     | Hex         | Use                                                |
|-----------|-------------|----------------------------------------------------|
| `c-muted-light` | `#CDD2D9` | Faded fills, background panels                 |
| `c-muted` | `#AFB5BE`   | "Everyone-else" series in the highlight pattern    |
| `c-muted-dark`  | `#5F6773` | Dark stroke or label for a muted series        |

> **[revised — Nil, 2026-06-16]** The main muted tone was `#999FA8` in the
> original data-vis spec; Nil lightened it to `#AFB5BE` (commit `182ea68`).
> This value is current — do not "correct" it back against
> `docs/nil/data-vis-rules.md`.

A cool grey that visually recedes behind the warm ink and the categorical
hues. Used in the highlight pattern (§3.1).

### Sequential ramps — for ordered encodings

For choropleths and any ordered encoding from low to high, use a single-hue
ramp built from the same c-N family. Darker = higher value. Default to five
steps; coarse signals can use three, fine gradients seven or more.

| Palette         | 5-step ramp (low → high)                                          |
|-----------------|-------------------------------------------------------------------|
| `sequential-1`  | `#E5F0F9` · `#B5D5EA` · `#6FA5CE` · `#2F87C8` · `#1A5A8E`         |
| `sequential-2`  | `#F4D5D5` · `#E89C9C` · `#DC6F6E` · `#CC4948` · `#8A2C2B`         |
| `sequential-3`  | `#D5EFE7` · `#92D6BF` · `#5BC0A0` · `#2AA584` · `#1A6B53`         |
| `sequential-4`  | `#E5DDF0` · `#B5A0CC` · `#9276BA` · `#7554A3` · `#4A3470`         |
| `sequential-5`  | `#FBE5D5` · `#F4BC8A` · `#EE9A52` · `#EA822D` · `#A8580F`         |
| `sequential-6`  | `#FBF8DC` · `#E6E2A8` · `#DCD68E` · `#CDC86B` · `#8A8638`         |

Default to `sequential-1` (blue) unless the data has a hue convention
(e.g., heat / fire / vegetation).

### Diverging palettes — for meaningful midpoints

Use only when the data has a real reference point: gains vs. losses, above
vs. below baseline, positive vs. negative deviation. The boundary between
hues marks the midpoint; the lightest tones flank it.

| Palette  | 6-step (negative tail → midpoint → positive tail)                                                                  |
|----------|--------------------------------------------------------------------------------------------------------------------|
| `div-2-1` | `#8A2C2B` · `#DC6F6E` · `#EFC7C0` · `#C5DCEC` · `#6FA5CE` · `#1A5A8E` — red to blue (default)                       |
| `div-3-1` | `#1A6B53` · `#5BC0A0` · `#BDE5D8` · `#C5DCEC` · `#6FA5CE` · `#1A5A8E` — teal to blue (loss vs. gain in same family) |
| `div-5-1` | `#A8580F` · `#EE9A52` · `#F4BC8A` · `#C5DCEC` · `#6FA5CE` · `#1A5A8E` — orange to blue                              |
| `div-6-1` | `#8A8638` · `#DCD68E` · `#E6E2A8` · `#C5DCEC` · `#6FA5CE` · `#1A5A8E` — yellow to blue                              |

Never use a diverging palette for a purely positive scale — readers will
read midpoint meaning into the boundary.

### Sector-specific palettes

For trade/product data, use the official Atlas HS sector colors defined in
[`assets/design-library/visualization_colors/atlas/hs_product_sectors.csv`](assets/design-library/visualization_colors/atlas/hs_product_sectors.csv).
These are an external standard and override the categorical palette when
charting product data.

### Cover pattern colors

The decorative patterns on the cover (see [`recipes/report.md`](recipes/report.md))
use their own fixed palette — not the categorical or accent colors. Treat
these as artwork, not as a chart palette.

| Token          | Hex       |
|----------------|-----------|
| `pattern-blue`   | `#578CC9` |
| `pattern-cyan`   | `#5DC4E2` |
| `pattern-red`    | `#E55D5C` |
| `pattern-yellow` | `#F2C32F` |
| `pattern-green`  | `#5CA75B` |
| `pattern-dark`   | `#2D2D2C` |

## 2. Typography

### Two families, two jobs

Every text element uses one of two families. Which one is a function of what
the text *does* — serif for voice, sans for function.

**Source Serif 4** — long-form and display. Variable font (uses the `opsz`
optical-size axis). Carries the lab's voice. Weights used: 300, 400, 500, 600.

> Cover title, all section and subsection headings, the lead paragraph,
> chart titles, chart sources (italic), colophon body text, footnote markers,
> TOC major entries, reference titles.

**Inter** — UI, labels, and reading body. Variable font. Carries information
without inflection. Weights used: 400, 500, 600, 700.

> Body copy, chart labels, axis text and ticks, annotations, table headers
> and cells, TOC sub-entries, page chrome (running head, folio, footnotes),
> eyebrows, figure labels, any small uppercase label.

Both ship locally in [`assets/fonts/`](assets/fonts/); the in-chart theme
registers the bundled variable fonts via systemfonts, falling back to
system-installed copies when the bundle isn't present.

### Optical sizing (Source Serif 4)

Source Serif 4 carries a true optical-size axis. The same family rendered at
`opsz 60` and `opsz 14` produces different shapes — the display cut has finer
strokes and tighter spacing; the text cut has more ink and looser metrics.
Honor the axis when picking a face:

| Use            | opsz | Why                                       |
|----------------|------|-------------------------------------------|
| Cover display  | 60   | Maximum contrast, tight spacing, refined  |
| Section heads  | 36   | Display-leaning but readable              |
| Subsection     | 22   | Mid-range                                 |
| Lead paragraph | 18   | Slightly display, opens the section       |
| Body / caption | 14   | Maximum legibility at small sizes         |

The opsz values above are anchored to Nil's source px sizes (display 56px,
section 34px, etc.). The report recipe renders at exactly these sizes (it ships
as HTML → PDF, where CSS px is an absolute print unit), so it uses these opsz
values as-is. A recipe that renders type at a *different* scale — a smaller
medium, or a pt-native export like `.docx` — should **rescale opsz to its own
sizes** rather than copy these literal numbers.

Tools render this differently — CSS via `font-variation-settings`, Word via the
docx style (pt approximation — px isn't expressible there), ggplot via the
registered face name. Tooling stubs where opsz isn't reachable should default to
opsz 14 (text optical size).

### Role hierarchy

Every recipe assigns sizes to a common set of text roles. The roles
themselves are part of the grammar.

**Display tier — large, serif:**

| Role           | Family          | Weight | Color | Case      | Notes                       |
|----------------|-----------------|--------|-------|-----------|-----------------------------|
| Display        | Source Serif 4  | 400    | `ink` | Sentence  | Cover title only            |
| H1 (section)   | Source Serif 4  | 500    | `ink` | Sentence  | No trailing period          |
| H2 (subsection)| Source Serif 4  | 500    | `ink` | Sentence  | No trailing period          |

**Body tier:**

| Role              | Family                | Weight | Color    | Notes                          |
|-------------------|-----------------------|--------|----------|--------------------------------|
| Lead paragraph    | Source Serif 4        | 300    | `ink-2`  | One per section; opens it      |
| Body              | Inter                 | 400    | `ink-2`  | Default narrative              |
| Body emphasis     | Inter                 | 600    | `ink`    | `<strong>`                     |
| Colophon body     | Source Serif 4        | 400    | `ink-2`  | Imprint page only              |
| Footnote          | Inter                 | 400    | `ink-3`  | Bottom of page                 |
| Footnote anchor   | Source Serif 4 italic | 400    | `accent` | Super, 0.7em; both in text and at note |
| Reference entry   | Inter                 | 400    | `ink-2`  | Hanging indent; titles in Source Serif 4 italic |

**Chart-adjacent tier (figure block elements that sit outside the plot panel):**

| Role           | Family                | Weight | Color    | Case      | Notes                              |
|----------------|-----------------------|--------|----------|-----------|------------------------------------|
| Eyebrow        | Inter                 | 600    | `accent` | UPPERCASE | Tracking 0.14em                    |
| Figure label   | Inter                 | 600    | `accent` | UPPERCASE | "Figure 4". Tracking 0.14em        |
| Chart title    | Source Serif 4        | 500    | `ink`    | Sentence  | Ends with period (finding)         |
| Chart subtitle | Inter                 | 400    | `ink-3`  | Sentence  | Optional; units / period / unit    |
| Chart source   | Source Serif 4 italic | 400    | `ink-2`  | Sentence  | Required; italic distinguishes provenance |

**Inside the chart panel (theme_gl handles):**

| Role          | Family        | Weight       | Color           | Notes                            |
|---------------|---------------|--------------|------------------|----------------------------------|
| Axis label    | Inter         | 500          | `ink-2`          | Sentence case                    |
| Axis tick     | Inter         | 400          | `ink-2`          | tabular-nums                     |
| Legend / series label | Inter | 600          | series dark tone | Always the dark tone of the series color (WCAG AA) |
| Annotation    | Inter         | 400          | `ink-2`          | Sparingly                        |

**Tables:**

| Role            | Family | Weight | Color   | Notes                       |
|-----------------|--------|--------|---------|------------------------------|
| Table header    | Inter  | 600    | `ink`   | Sentence case (never caps)   |
| Table cell      | Inter  | 400    | `ink-2` | Numeric cols: tabular-nums   |
| Table emphasis  | Inter  | 600    | `ink`   | First-column key, etc.       |
| Table note      | Source Serif 4 italic | 400 | `ink-2` | Same style as chart source |

**Table of contents:**

| Role          | Family        | Weight | Color   | Notes                  |
|---------------|---------------|--------|---------|------------------------|
| TOC major     | Source Serif 4| 600    | `ink`   | Top-level entry        |
| TOC sub       | Inter         | 400    | `ink-2` | Nested, indented       |
| TOC sub-sub   | Inter italic  | 400    | `ink-3` | Deeper nesting         |

**Page chrome:**

| Role         | Family                 | Weight | Color   | Notes                            |
|--------------|------------------------|--------|---------|----------------------------------|
| Running head | Inter                  | 500    | `ink-3` | UPPERCASE, 0.16em tracking       |
| Folio (page #)| Inter                 | 500    | `ink-3` | tabular-nums                     |
| Folio note   | Source Serif 4 italic  | 400    | `ink-3` | Optional, beside the folio       |

**Cover meta (cover only):**

| Role             | Family         | Weight | Color    | Case      | Notes              |
|------------------|----------------|--------|----------|-----------|--------------------|
| Series eyebrow   | Inter          | 600    | `ink-3`  | UPPERCASE | 0.18em tracking    |
| Cover date       | Inter          | 700    | `accent` | UPPERCASE | 0.18em tracking    |
| Cover authors    | Source Serif 4 | 400    | `ink`    | Sentence  | Comma-separated    |

Recipes pin the absolute size of each role. Cover meta is always two lines —
series eyebrow on top, date directly below. Never combine.

## 3. Charts

### 3.1 Highlight by muting

When one series carries the story, paint everything else in `c-muted` first,
then re-paint the focus series on top in `c-1` (the institutional voice) or
`c-2` (the lead-finding red). The muted layer carries the general trend; the
highlight carries the finding.

In ggplot:

```r
data |>
    ggplot(aes(x = x, y = y, group = country)) +
    geom_line() +                                  # backdrop: c_muted, 2px — the default
    geom_line(data = \(d) filter(d, country == "Mongolia"),
              color = highlight, linewidth = highlight_sz)   # focus: 2.4px
```

The `theme_gl()` helper provides `c_muted`, `c_1`..`c_6`, `accent`, and
`highlight` (alias for `c_1`, the institutional blue) as named values, plus
`lead_finding` (alias for `c_2`, the red) for stark emphasis; do not hard-code
hex.

### 3.2 Most charts: two to four colors

A reader can hold only a few categories in working memory. When a chart
truly needs more series, use the muted layer for the rest and let one or
two focus series carry the story.

### 3.3 Three tones, three jobs

Each categorical hue has a light / main / dark variant. They are not
interchangeable:

| Tone  | Job                                                                                      |
|-------|------------------------------------------------------------------------------------------|
| Main  | Fills — bars, lines, treemap tiles, scatter circles, choropleth polygons                 |
| Dark  | Strokes on overlapping marks, and **every text element** associated with the color — direct labels, end-labels, legend marks, callouts, annotations. Required for WCAG AA contrast against paper. |
| Light | Backgrounds, faded states, sequential ramp tail                                          |

**This rule applies to every color in the palette without exception, including
the muted grey.** A muted series whose line or bar is `c-muted` (#AFB5BE) must
have its end-label, legend entry, and any annotation in `c-muted-dark`
(#5F6773) — never in `c-muted` itself, which fails contrast against paper.

> **Simple test:** if a text element names or points to a colored mark, it
> must use the dark tone of that mark's color. There is no case where a label
> shares the exact same hex as its associated fill or line.

Only one chart type uses the dark tone as a *fill*: the three-tone stacked
area (light / main / dark of one hue, when three bands belong to the same
parent variable). Outside that case, dark = stroke and text.

### 3.4 Fill, stroke, opacity

| Geom                 | Fill                          | Stroke                                  | Notes                                  |
|----------------------|-------------------------------|-----------------------------------------|----------------------------------------|
| Scatter circle       | main, `fill-opacity: 0.8`     | dark, `stroke-opacity: 0.8`, 1px        | Same 0.8 so overlapping points darken together |
| Line                 | —                             | main, full opacity, 2px (2.4px focus)   | `stroke-linejoin: round`; solid only   |
| Bar / area / treemap | main, full opacity            | none — tiles abut directly              | Stacked: leave a 1px gap between segments |
| Choropleth polygon   | sequential or diverging tone  | `ink-3`, 0.5px                          | Separates regions                      |
| Radar polygon        | main, `fill-opacity: 0.25`    | main, full opacity, 2px round join      | Lower fill so gridlines/labels read    |

The 0.8 rule is for overlapping marks. Single-layer marks (bars, treemap
tiles, choropleths) stay at full opacity — overlap isn't a risk and lowering
opacity just dilutes the color.

### 3.5 Axes, ticks, gridlines

- **Axis line**: 1px solid `ink-2`
- **Tick mark**: 1px, 4px long, **outward** (never inward)
- **Tick label offset**: 6px outside the axis
- **Axis label offset**: measure from the *start* of the tick label, not from
  the axis line — typically 20px on both X and Y to clear wide numbers
- **Gridline**: 1px solid `gridline` (`#D8D4CC`). Use only where the reader
  needs to estimate values; avoid both X and Y unless the chart is dense
- **Zero baseline**: render with axis weight, not gridline weight
- **Year axis**: when the X axis is just years, omit the axis label — the
  tick labels already say what the dimension is
- **Tick label alignment**: Y-axis tick labels right-align (flush to the
  axis), so variable-width labels keep a constant gap to the axis line;
  X-axis tick labels top-align under the axis
- **Direct labels drawn over data**: series end-labels, callouts, and any
  text placed inside the panel carry a thin `paper` halo (radius ≈ 0.1em)
  so they stay legible over marks. The halo never substitutes for the
  dark-tone rule — the glyphs themselves stay in the series dark tone

### 3.6 Sequential vs. diverging — when

- **Sequential** for any ordered encoding without a natural midpoint
  (population, GDP, complexity, count). Darker = higher.
- **Diverging** *only* when there is a real reference point (positive vs.
  negative, above vs. below baseline). Never on a purely positive scale.

### 3.7 Tabular numerals everywhere numeric

Always set `font-variant-numeric: tabular-nums` (CSS), `\addfontfeatures{Numbers=Monospaced}`
(LaTeX), or the equivalent on:

- Numeric table columns
- Axis tick labels
- Page numbers / folios
- TOC page numbers
- Any column-aligned numeric content

Without tabular figures the numbers visually slide; with them, columns line
up and scanning is faster.

## 4. Rules

The system is small on purpose. Before introducing a new style, work through
this list.

1. **Serif or sans?** Serif for the cover, all headings, the lead, the
   colophon, chart titles, chart sources, and reference titles. Sans for
   everything else.

2. **No monospace.** Numerals use Inter with tabular figures. Avoid mono
   fonts in body, charts, and tables.

3. **Color encodes meaning, not decoration.** Every color in a chart must
   carry a specific function — a category, a series, a threshold, a
   highlight. If a color is not earning its keep, remove it.

4. **Use color to highlight; mute the rest.** Paint the focus series in
   `c-1` or `c-2` and the supporting data in `c-muted`. The muted layer
   carries the trend; the highlight carries the finding.

5. **Keep most charts to two to four colors.** When a chart truly needs more
   series, use the muted color for the rest and let the focus series carry
   the story. Six categorical colors is a hard ceiling.

6. **Dark tone for strokes and text — no exceptions.** Every label, legend
   mark, callout, and annotation associated with a colored mark uses the
   **dark variant** of that mark's color, not the main tone. This applies to
   every color in the palette: `c-1` fills → `c-1-dark` labels; `c-muted`
   fills/lines → `c-muted-dark` labels. The main tone is for fills only.

7. **0.8 opacity on overlapping marks.** Scatter circles, radar polygons,
   any overlaid shape. Single-layer marks (bars, treemap, choropleth) stay
   at full opacity.

8. **Tabular numerals on all numeric content.** Tables, axis ticks, page
   numbers, TOC page numbers.

9. **No all-caps body or headings.** Uppercase is reserved for eyebrows,
   figure labels, running heads, and similar 9–11pt chrome.

10. **No trailing periods on headings.** Section headings, subsection
    headings, and TOC entries end without a period. Chart titles **do** end
    with a period — they read as findings, not labels.

Recipe-specific size and layout rules live in each recipe.
