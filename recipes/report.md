# Recipe: Long-Form Report

Applies the Growth Lab visual [grammar](../grammar.md) to long-form research
publications: prose, data visualizations, tables, footnotes, references. The
authoring pipeline is Markdown → Word via pandoc (see
[`skills/md2docx/`](../skills/md2docx/)); the final deliverable is a PDF.

## 1. Page setup

| Property       | US Letter (default) | A4 (international) |
|----------------|---------------------|---------------------|
| Page size      | 8.5 × 11 in         | 8.27 × 11.69 in     |
| Top margin     | 1.0 in              | 1.0 in              |
| Bottom margin  | 1.25 in             | 1.25 in             |
| Left margin    | 1.0 in              | 1.0 in              |
| Right margin   | 1.0 in              | 1.0 in              |
| **Live area**  | **6.5 × 8.75 in**   | **6.27 × 9.44 in**  |
| Paper color    | `paper` (#FFFFFF)   | pure white          |
| Cover paper    | `cover-bg` (#F3F2EA)| reserved for cover  |

The bottom margin is 1.25" — slightly larger than the top — so (1) it hosts
page numbers and footnotes without crowding the body, (2) it optically
centers the text block on the page, and (3) the live height resolves cleanly
into **exactly 7 vertical modules** (8.75" / 1.25" = 7).

## 2. Grid

A **6-column modular grid** governs horizontal placement.

```
┌─────────────────────────────────────────────────────────┐
│ 1.0" │  col  │g│  col  │g│  col  │g│  col  │g│  col  │g│  col  │ 1.0" │
│margin│ 0.944"│ │ 0.944"│ │ 0.944"│ │ 0.944"│ │ 0.944"│ │ 0.944"│margin│
└─────────────────────────────────────────────────────────┘
       gutter (g) = 0.167"  ×  5 gutters = 0.833"
       columns: 6 × 0.944" = 5.667"
       total live width: 5.667" + 0.833" = 6.5"
```

| Span  | Columns | Width   | Use                                    |
|-------|---------|---------|----------------------------------------|
| Full  | 6       | 6.500"  | Hero figures, full-width tables        |
| Major | 4       | 4.278"  | Primary figures with text wrap         |
| Half  | 3       | 3.167"  | Side-by-side figure pairs              |
| Minor | 2       | 2.056"  | Small inset charts, margin figures     |

### Vertical modules

Vertical modules are **1.250" tall**; the 8.75" live height is exactly 7
modules. The figure-size table below snaps to this grid. Body text under
Nil's typography (12px / 19.2px leading) sets its own baseline rhythm at
0.2" per line — independent of the module grid, which exists for figure
and block placement.

| V-modules | Height  | Use                                          |
|-----------|---------|----------------------------------------------|
| 3         | 3.750"  | Compact landscape figure                     |
| 4         | 5.000"  | Standard figure height                       |
| 5         | 6.250"  | Tall figure / stacked panel                  |
| 6         | 7.500"  | Near-full-page figure (leaves 1 mod chrome)  |
| 7         | 8.750"  | Full-bleed figure (rare — no chrome room)    |

## 3. Type sizes

Applies the [grammar's role hierarchy](../grammar.md#role-hierarchy) at
report sizes. Anchor body at **12px / 19.2px leading**, printed as 12pt on
19.2pt.

Sizes are Nil's spec values, written in **px** as she wrote them, and they
**print as points: 1px in these tables = 1pt on the page** (decided
2026-11-16). Body text is 12pt, H1 34pt, H2 20pt, display 56pt, footnotes and
page chrome 9pt, chart text 12pt. The md2pdf stylesheet, the R theme's report
mode (`gl$k`) and the Word template (`gl.docx`) all print these sizes, so the
PDF and the Word copy match.

*History.* Until 2026-11-16 the recipe read the px literally as CSS px
(`96px = 72pt`), so body 12px printed at 9pt and every size at 0.75 of its
number. On real reports (the Morocco Y1 series) that read as too small, so the
numbers now print as points. `gl-print.docx` keeps the old 0.75 reading for
anyone who needs it. See `docs/followups.md` §9.

### Display tier

| Role             | Family         | Size | Weight | Leading | opsz | Tracking  |
|------------------|----------------|------|--------|---------|------|-----------|
| Display          | Source Serif 4 | 56px | 400    | 1.20    | 60   | -0.025em  |
| H1 (section)     | Source Serif 4 | 34px | 500    | 1.08    | 36   | -0.018em  |
| H2 (subsection)  | Source Serif 4 | 20px | 500    | 1.20    | 22   | -0.010em  |
| H3 (sub-subsection) | Source Serif 4 | 16px | 600 | 1.30   | 16   | -0.005em  |

H3 is a recipe extension — Nil's spec has only section (h1) and subsection (h2).

### Body tier

| Role            | Family                | Size  | Weight | Leading |
|-----------------|-----------------------|-------|--------|---------|
| Lead paragraph  | Source Serif 4        | 17px  | 300    | 1.40    |
| Colophon body   | Source Serif 4        | 14px  | 400    | 1.55    |
| Body            | Inter                 | 12px  | 400    | 1.60    |
| Body emphasis   | Inter                 | 12px  | 600    | 1.60    |
| Footnote        | Inter                 | 9px   | 400    | 1.50    |
| Footnote anchor | Source Serif 4 italic | 0.75em | 400   | —       |

### Chart-adjacent tier (figure block)

| Role            | Family                 | Size  | Weight | Case      |
|-----------------|------------------------|-------|--------|-----------|
| Figure label    | Inter                  | 12px  | 600    | UPPERCASE |
| Chart title     | Source Serif 4         | 14px  | 500    | Sentence  |
| Chart subtitle  | Inter                  | 12px  | 400    | Sentence  |
| Chart source    | Source Serif 4 italic  | 12px  | 400    | Sentence  |

Figure label, subtitle, and source all sit at body size (12px). The chart
title's 14px serif is what marks the figure block's top.

### Tables

| Role           | Family                | Size  | Weight |
|----------------|-----------------------|-------|--------|
| Table header   | Inter                 | 12px  | 600    |
| Table cell     | Inter                 | 12px  | 400    |
| Table emphasis | Inter                 | 12px  | 600    |
| Table note     | Source Serif 4 italic | 12px  | 400    |

### TOC

| Role         | Family                | Size  | Weight | Indent |
|--------------|-----------------------|-------|--------|--------|
| TOC major    | Source Serif 4        | 14px  | 600    | 0      |
| TOC sub      | Inter                 | 12px  | 400    | 0.25in |
| TOC sub-sub  | Inter italic          | 12px  | 400    | 0.50in |
| TOC page # (major) | Inter           | 11px  | 700    | — (`ink`)   |
| TOC page # (sub)   | Inter           | 11px  | 500    | — (`ink-2`) |

### Page chrome

| Role         | Family                | Size  | Weight | Case      |
|--------------|-----------------------|-------|--------|-----------|
| Running head | Inter                 | 9px   | 500    | UPPERCASE |
| Folio        | Inter                 | 9px   | 500    | —         |
| Folio note   | Source Serif 4 italic | 10px  | 400    | Sentence  |

### Cover meta (cover only)

| Role             | Family         | Size | Weight | Color    | Case      |
|------------------|----------------|------|--------|----------|-----------|
| Series eyebrow   | Inter          | 11px | 600    | `ink-3`  | UPPERCASE |
| Cover date       | Inter          | 11px | 700    | `accent` | UPPERCASE |
| Cover authors    | Source Serif 4 | 14px | 400    | `ink`    | Sentence  |

Tracking 0.18em for the eyebrow and date.

### References

| Role            | Family                | Size | Weight | Notes                                |
|-----------------|-----------------------|------|--------|--------------------------------------|
| Reference body  | Inter                 | 10px | 400    | Hanging indent 0.25"; authors flush left |
| Reference title | Source Serif 4 italic | 11px | 400    | Italic; one step larger than the body (mirrors Nil) — the one place serif italic appears in body context |

## 4. Spacing

- **Above H1 / display:** generous breathing room — start on its own line,
  leave at least 24px above any prior block.
- **Above H2:** 28px
- **Below all headings:** 8px
- **Paragraph spacing:** 6px after each paragraph; body text is **justified**;
  no first-line indent.
- **Figure block:** 12px above figure label, 6px below chart source.
- **Table block:** 12px above table header, 6px below table note.

Body text is one paragraph per logical idea, separated by 6px of space —
not by a blank line of text.

## 5. Element patterns

### Cover page

Distinct paper color (`cover-bg` `#F3F2EA`), no page chrome (running head
and folio suppressed). Two artwork variants:

- **Working Paper** — uses `rect-pattern.svg` (rectangular network pattern,
  edge-to-edge at the bottom of the cover).
- **Report** — uses `circle-pattern.svg` (circular medallion inside a
  `cover-disk` `#ECEBE0` disk, one tone darker than the cover paper `cover-bg`
  `#F3F2EA`). The circle pattern is the default for full reports.

Both SVGs live in
[`assets/design-library/cover-patterns/`](../assets/design-library/cover-patterns/).

```
┌─────────────────────────────────────┐
│  ──────────────                     │  ← pre-title hairline (1px ink-3 @ 0.3 opacity)
│  GROWTH LAB WORKING PAPER SERIES    │  ← eyebrow, 11px Inter 600 ink-3 UPPER
│  MAY 2026                           │  ← date,    11px Inter 700 accent UPPER
│                                     │
│  (vertical space, ~96px)            │
│                                     │
│  New Mexico's Economy               │  ← display, 56px Source Serif 4 400
│  Over Time and Space                │     opsz 60, leading 1.2, ink
│                                     │
│  ═══════════════════                │  ← title rule: 3px accent, 50% width,
│                                     │     left-anchored
│                                     │
│  Juan Carlos Orrego Zamudio         │  ← authors, 14px Source Serif 4
│  and Tim O'Brien                    │     ink, leading 1.5
│                                     │
│         [ pattern artwork ]         │  ← rect (working paper) or circle (report)
│                                     │     placed bottom of cover
└─────────────────────────────────────┘
```

**Rules:**

- Cover meta is **two lines** — series eyebrow and date — never combined.
- Pre-title hairline (1px ink-3 at 0.3 opacity) sits above the eyebrow to
  separate it from the page edge without competing with the title rule
  below.
- Title rule is **3px solid `accent`, 50% of content width, left-anchored** —
  asymmetric and deliberate. Sits below the display, above the authors.
- Display title never wraps to more than three lines.
- Authors: comma-separated, "and" before the last name. Set in `ink` (full
  title weight, matching Nil's spec) — the byline carries the document's voice,
  not page chrome.
- Pattern artwork sits at the bottom of the cover; never overlaps the
  title block. On the colophon page (page 2), echo the same pattern
  desaturated (`filter: grayscale(1)`) at 35% opacity.

### Colophon page (page 2)

Page 2 of every report — the imprint. Single column (overrides the 6-column
grid for prose width), white paper, no running head; folio shows the page
number only. A small Growth Lab mark sits top-right.

- **Address block** — Inter 10px / 600 / UPPERCASE / 0.18em tracking / `ink-2`,
  leading 1.7, five stacked lines (lab, school, street, city, URL). Reads as a
  fixed nameplate, not body text.
- **Imprint paragraphs** — four of them (partnership note, disclaimer,
  copyright, suggested citation), all Source Serif 4 14px / 400 / leading 1.55 /
  `ink-2`, 16px between paragraphs. Serif sets the colophon apart from the sans
  body used everywhere else.
- **Pattern** — the cover artwork desaturated (`filter: grayscale(1)`) at 35%
  opacity, pinned to the bottom; the `cover-disk` medallion goes through the
  same filter and reads as a faint warm halo.

### Figure block

```
FIGURE 4                                          ← figure label (12px UPPER accent)
Mongolia rode the commodity supercycle.           ← chart title (14px serif, ends in .)
Share of merchandise exports, 2003–2024, percent. ← chart subtitle (12px ink-3, optional)

[ chart image — at a named figure size ]

Source: Growth Lab analysis of UN Comtrade.       ← chart source (12px serif italic)
```

- Caption (chart source) sits **full-width below the figure**. Body prose
  resumes only on a new row — never wraps beside a figure.
- Chart titles **end with a period** (they are findings, not labels).
- Chart subtitle is optional; omit when redundant with the title.
- Chart source is **required** on every figure.

### Table

- Top and bottom rules in `ink` (heavier).
- Row dividers in `rule` (`#DDDDDD`).
- Header row: sentence case (never UPPERCASE), Inter 12px weight 600 `ink`.
- Numeric columns right-aligned with tabular-nums.
- Text columns left-aligned.
- Last row of body has a heavier (`ink`) bottom rule.
- First-column emphasis: Inter 12px weight 600 `ink`.
- Table note below in Source Serif 4 italic 12px `ink-2`.

### Page chrome

```
GROWTH LAB WORKING PAPER NO. 264                                       [ GL ]
─────────────────────────────────────────────────────────────────────────────

  (body content)

─────────────────────────────────────────────────────────────────────────────
¹ Source: Growth Lab analysis. See methodology appendix.                    8
```

- Running head: top of every content page (omitted on cover, TOC,
  colophon, references). Series tag flush left in Inter 9px 500 UPPERCASE
  `ink-3` (0.16em tracking); Growth Lab logo flush right.
- Folio: bottom flush right, Inter 9px 500 `ink-3`, tabular-nums.
- Folio note (optional): Source Serif 4 italic 10px `ink-3`, flush left,
  beside the folio. Footnote anchor (`¹`) in serif italic at 0.7em,
  superscripted, `accent` color — both inline in body text and at the
  note itself.

### References page

Final page of every report. Single column inside `.page-inner`; standard
running head + folio (page number only, no folio note). White paper.

- **Entries** — one per `<p>`, hanging indent (`padding-left: 18px;
  text-indent: -18px`), 8px between entries, alphabetical by author surname
  (institutional authors filed by first significant word). See the References
  type table above for sizes.
- **Closing footer** — below the last reference, a 1px `rule` (`#DDDDDD`)
  hairline, then a single Inter 9px / 500 / UPPERCASE / 0.16em / `ink-3` eyebrow
  ("Growth Lab · Harvard Kennedy School") acting as the document's sign-off.
  32px of space above the rule, 18px from rule to text.

### Named figure sizes

Standard ggplot output dimensions for this recipe, snapped to the grid.
Use via `save_fig("full", "filename.png")` — see
[`skills/gl-ggplot/`](../skills/gl-ggplot/).

| Name          | Width   | Height  | Aspect   | Grid fit            | Use case                          |
|---------------|---------|---------|----------|---------------------|-----------------------------------|
| `full`        | 6.5"    | 4.0"    | ~1.63:1  | 6 col × 3.2 v-mod   | Standard full-width chart         |
| `full_tall`   | 6.5"    | 6.0"    | ~1.08:1  | 6 col × 4.8 v-mod   | Stacked panels, patchwork (2 rows)|
| `full_square` | 6.5"    | 6.5"    | 1:1      | 6 col × 5.2 v-mod   | Heatmaps, correlation matrices    |
| `major`       | 4.278"  | 4.0"    | ~1.07:1  | 4 col × 3.2 v-mod   | Primary chart with text beside it |
| `half`        | 3.167"  | 3.0"    | ~1.06:1  | 3 col × 2.4 v-mod   | Side-by-side pair                 |
| `half_tall`   | 3.167"  | 5.0"    | ~0.63:1  | 3 col × 4 v-mod     | Portrait figure, ranked bar chart |

(`slide` — 10 × 5.625", 16:9 — lives in the gl-ggplot helper for now; will
move to a slide recipe when one exists.)

## 6. Recipe-specific rules

These extend the [grammar's general rules](../grammar.md#4-rules) with values
specific to the report.

1. **Body size is 12px.** Do not push body text below 12px. Footnotes (9px)
   are the only exception, and they live next to the folio.

2. **One lead per section.** A lead paragraph never appears twice on the
   same page; it opens its section and that's it.

3. **Cover meta is two lines.** Series name in `ink-3` weight 600; date in
   `accent` weight 700. Never combine them on one line.

4. **Subtitle is optional, source is required.** Every figure must have a
   chart source. Omit the chart subtitle when redundant with the title.

5. **Captions sit full-width below the figure.** Body prose never wraps
   beside a figure — it only resumes on a new row.

## 7. Quick reference

```
PAGE:   US Letter, margins 1.0/1.0/1.0/1.25 (L/R/T/B) → live 6.5 × 8.75"
        Paper #FFFFFF (content); cover-bg #F3F2EA (cover only)
GRID:   6 columns × 0.944" + 5 gutters × 0.167" = 6.5" live width
        7 modules × 1.25" = 8.75" live height
FONTS:  Source Serif 4 (voice) + Inter (function)
        Sizes are Nil's px values, used as-is (CSS px = 1/96in in print).
BODY:   12px Inter / 19.2px leading
DISPLAY:56 / 34 / 20 / 16 (display / H1 / H2 / H3, Source Serif 4)
LEAD:   17px Source Serif 4 weight 300

CHART BLOCK (top-down):
  Figure label (Inter 12px 600 UPPER accent)
  Chart title  (Source Serif 4 14px 500 ink, ends with period)
  Chart subtitle [optional] (Inter 12px 400 ink-3)
  [ figure image ]
  Source (Source Serif 4 italic 12px ink-2)

FIGURE SIZES (width × height):
  full         6.5 × 4.0"     Standard chart
  full_tall    6.5 × 6.0"     Stacked / patchwork
  full_square  6.5 × 6.5"     Heatmaps
  major        4.278 × 4.0"   Chart + text wrap
  half         3.167 × 3.0"   Side-by-side pair
  half_tall    3.167 × 5.0"   Portrait chart

INK:         ink #1A1714 / ink-2 #2C2823 / ink-3 #4F4A42 / ink-4 #9A9389
ACCENT:      #1A5A8E (= c-1-dark)
CATEGORICAL (main tone):
             c-1 #2F87C8  c-2 #CC4948  c-3 #2AA584
             c-4 #7554A3  c-5 #EA822D  c-6 #CDC86B
MUTED:       c-muted #AFB5BE (paint everyone-else, then highlight focus in
             c-1 or c-2). Light #CDD2D9 / dark #5F6773 variants for stroke/text.
PAPER:       paper #FFFFFF  cover-bg #F3F2EA  rule #DDDDDD  gridline #D8D4CC
COVER:       rect-pattern.svg (working paper) | circle-pattern.svg (report)
             assets/design-library/cover-patterns/
```
