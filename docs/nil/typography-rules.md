# Growth Lab — Typography Spec

> Markdown transcription of `docs/nil/typography-spec.html` (Nil's typography spec &
> sample report). This captures the **explicit rules Nil wrote** — the prose
> ("usage") notes, the per-element spec cards, the type scale, the palette, and
> the decision rules — not values inferred from CSS alone. Companion to
> [`data-vis-spec.md`](data-vis-spec.md), which covers charts.
>
> The HTML is a sample Growth Lab report (cover → colophon → content →
> references) followed by a spec section that annotates each style. Page/section
> order below follows the spec's own "Contents."

---

## 1. Foundations — two families, one ink set

> The system stands on **two type families** and a **small set of ink colors**.
> Everything else — every heading, label, and caption — is built by varying the
> **size, weight, and case** of these two families against the ink palette.
> Resist adding a third family or new colors; reach for the existing tokens
> first.

### Type families

| Family | Stack | Weights | Used for |
|--------|-------|---------|----------|
| **Source Serif 4** (serif) | `"Source Serif 4", "Iowan Old Style", Georgia, serif` | 300, 400, 500, 600 | Cover title, **all** section & subsection headings, the lead paragraph, the colophon, footnote markers |
| **Inter** (sans) | `"Inter", system-ui, -apple-system, sans-serif` | 400, 500, 600, 700 | Body copy, table headers & cells, TOC sub-entries, page chrome (running head, folio, footnotes), eyebrows, any small uppercase label |

- **Honor the optical-size axis** on the serif: cover title at `opsz 60`,
  section heads at `opsz 36`, body & captions at `opsz 14–18`.
- Always pair **tabular numerics** (`font-variant-numeric: tabular-nums`) on
  numeric columns.
- **No monospace** anywhere.

### Type scale

| px | Role | Family / spec | Selector |
|----|------|---------------|----------|
| **56** | Cover display | Serif 400, tracking −0.025em, opsz 60 | `.display` |
| **34** | Section heading | Serif 500, tracking −0.018em, opsz 36 | `h1.section` |
| **20** | Subsection heading | Serif 500, tracking −0.01em, opsz 22 | `h2.subsection` |
| **17** | Lead paragraph | Serif 300, opsz 18 | `p.lead` |
| **14** | Colophon body | Serif 400, opsz 14 | `.colophon p` |
| **12** | Body copy, table cells | Sans 400 | `p`, `table` |
| **11** | Cover meta (series / date) | Sans 600, uppercase 0.18em, ink-3 | cover only |
| **9** | Running head / folio / footnotes | Sans 500, uppercase 0.16em, ink-3 | `.running-head`, `.folio`, `.footnotes` |

---

## 2. Ink & accent palette

> Text is **layered**: black for emphasis (`--ink`), near-black for body
> (`--ink-2`), warm grey for secondary text / captions / page chrome / hairlines
> (`--ink-3`). The accent blue is reserved for **eyebrows, brand marks, and the
> cover date.**

| Token | Hex | Role |
|-------|-----|------|
| `--ink` | `#1A1714` | Cover title, section & subsection heads, table emphasis, strong |
| `--ink-2` | `#2C2823` | Body copy default, table cells |
| `--ink-3` | `#4F4A42` | Captions, eyebrow on cover, page chrome, hairline rules, sub-sub TOC |
| `--accent` | `#1A5A8E` | Cover date, eyebrows |
| `--rule` | `#DDDDDD` | Table row dividers, closing-footer hairline |

Other tokens defined in the CSS `:root` but **not referenced by any written
rule** (so treat as latent, not part of the spec): `--paper #FAF8F4`,
`--paper-warm #F4F1EA`, `--accent-deep #003E6B`, `--accent-soft #3A85B8`,
`--accent-tint #E1F0FA`. Cover/colophon paper is `#F3F2EA`; the disk behind the
report-cover medallion is `#ECEBE0` (one tone darker than the paper). Content
pages are **white**.

---

## 3. Display & cover type

The cover is a **fixed layout**, set in the same order on every cover:

1. Top meta row — series name & date (left), Growth Lab logo (right)
2. A soft 1px `--ink-3` hairline at 0.3 opacity
3. Report title in display serif
4. A 3px `--accent` rule (50% width, left-anchored)
5. Author byline
6. A faded decorative pattern pinned to the bottom edge

Two variants share this anatomy and change only the **eyebrow text** and the
**artwork**: Working Paper (rectangular dashed-network pattern, eyebrow "Growth
Lab Working Paper Series") and Report (circular medallion in a `#ECEBE0` disk,
eyebrow "Growth Lab Report"). Background for both is cover paper `#F3F2EA`.
Running head and folio are hidden on the cover.

| Element | Family | Size | Weight | Color | Notes |
|---------|--------|------|--------|-------|-------|
| Display title | Source Serif 4 | 56px | 400 | `--ink` | Leading 1.2, tracking −0.025em, opsz 60. **Use once per document** (cover only). Always pair with the rule below + byline. **Never wrap past three lines.** 96px above / 24px below. |
| Cover meta — series | Inter | 11px | 600 | `--ink-3` | Uppercase, 0.18em. Top-left, above the date. |
| Cover meta — date | Inter | 11px | **700** | `--accent` | Uppercase, 0.18em. Immediately below the series line. |
| Cover authors | Source Serif 4 | 14px | 400 | `--ink` | Leading 1.5. One line below the title rule; comma-separated, "and" before the last author. |
| Pre-title hairline | — | 1px solid | — | `--ink-3` @ 0.3 opacity | Full content width. 20px below meta row, 100px above title (asymmetric — closer to the meta row). |
| Title rule | — | 3px solid | — | `--accent` | 50% width, left-anchored. 0 top / 32px bottom. |
| Logo | PNG (base-64) | 36px high | — | — | Top-right of meta row, top-aligned to the series line. Cover only. |
| Decorative pattern | inline SVG | full width | — | brand hues | Bottom-anchored, absolute-positioned to the content column. Purely decorative — no encoded data. Cover only. |

---

## 4. Colophon page (page 2)

> Page 2 of every report: imprint, partnership note, disclaimer, copyright,
> citation, and a faded grayscale echo of the cover pattern pinned to the
> bottom. **No running head and no page number** — just a small Growth Lab mark
> top-right, then four short serif paragraphs.

- **Single column** (overrides the six-column grid for prose width). Background
  **white** (no cream). Folio shows page number only; running head replaced by a
  logo-only row.
- **Address block** — Inter 10px / 600 / uppercase / 0.18em / `--ink-2`, leading
  1.7, five lines stacked with `<br>`. Reads as a fixed nameplate, not body
  text.
- **Imprint paragraphs** — four of them (partnership note, disclaimer,
  copyright, suggested citation), all `.colophon p`: Source Serif 4, 14px, 400,
  leading 1.55, opsz 14, `--ink-2`, 16px between paragraphs. Serif distinguishes
  the colophon from the sans body used elsewhere.
- **Logo row** — 25px logo (matches running-head height); the hidden
  series-name span is kept (`visibility:hidden`) so the right-edge alignment
  matches every other page.
- **Pattern** — the cover SVG at `grayscale(1)` / 35% opacity — an echo, not a
  repeat.

---

## 5. Section headings

| Element | Family | Size | Weight | Leading | Tracking | opsz | Color | Notes |
|---------|--------|------|--------|---------|----------|------|-------|-------|
| Section title `h1.section` | Source Serif 4 | 34px | 500 | 1.08 | −0.018em | 36 | `--ink` | First element in `.page-inner`; spans full content row. **Sentence case, never a trailing period.** Avoid manual `<br>`. |
| Subsection `h2.subsection` | Source Serif 4 | 20px | 500 | 1.2 | −0.01em | 22 | `--ink` | Marks a thematic break within a section. **Sentence case, no trailing period.** 28px top margin from the preceding paragraph. |

---

## 6. Body copy

| Element | Family | Size | Weight | Leading | Color | Notes |
|---------|--------|------|--------|---------|-------|-------|
| Body paragraph `p` | Inter | 12px | 400 | 1.6 | `--ink-2` | Default for all narrative text (except colophon and cover). One blank line between paragraphs. **Emphasis:** `<strong>` → 600, `--ink`. |
| Colophon body `.colophon p` | Source Serif 4 | 14px | 400 | 1.55 | `--ink-2` | Colophon (page 2) only. opsz 14. Serif, slightly bigger / more open than the sans body. |
| Footnote `.folio-note` | Inter | 9px | — | 1.5 | `--ink-3` | Anchor in **serif italic accent**; note text 9px sans ink-3. Rendered at the bottom of the page next to the folio. |

---

## 7. Lead paragraph

| Element | Family | Size | Weight | Leading | opsz | Color | Notes |
|---------|--------|------|--------|---------|------|-------|-------|
| Lead `p.lead` | Source Serif 4 | 17px | **300** | 1.4 | 18 | `--ink-2` | Lifts the opening paragraph of a section, the executive summary, or a standout intro. **One per section**, immediately under the heading. |

---

## 8. Table typography

> **Sentence-case headers (never all caps).** Text columns left-aligned; numeric
> columns right-aligned with `tabular-nums`. Top & bottom rules in **ink**; row
> dividers in `--rule`.

| Property | Value |
|----------|-------|
| Family | Inter (both head and body) |
| Size | 12px throughout |
| Weight | Header 600 / body 400 |
| Leading | 1.45 |
| Color | Head `--ink`; body `--ink-2` |
| Strong | First-column emphasis `--ink` 600 |
| Numerics | `font-variant-numeric: tabular-nums`, right-aligned |
| Rules | Top & bottom in `--ink`; row dividers in `--rule` |

---

## 9. Table of contents styles

| Level | Class | Family | Size | Weight | Color | Notes |
|-------|-------|--------|------|--------|-------|-------|
| Major entry | `.toc-row.major` | Source Serif 4 | 14px | 600 | `--ink` | Top-level section. Sentence case (no all caps). Top border in `--ink`. |
| Sub-entry | `.toc-row.sub` | Inter | 12px | 400 | `--ink-2` | Nested under a major entry. 18px indent. |
| Sub-sub entry | `.toc-row.sub-sub` | Inter **italic** | 12px | — | `--ink-3` | Two-level-deep nesting. Deeper (36px) indent. |

Page numbers are `tabular-nums`; major folios in `--ink` 700, sub folios in
`--ink-2` 500.

---

## 10. Page chrome

| Element | Family | Size | Weight | Case | Color | Notes |
|---------|--------|------|--------|------|-------|-------|
| Running head `.running-head` | Inter | 9px | 500 | Uppercase, 0.16em | `--ink-3` | Top of every content page (omitted on cover). Series tag left, 25px GL logo right. |
| Folio number `.folio` | Inter | 9px | — | — | `--ink-3` | Bottom of every content page, flush right. Omitted on cover, TOC, colophon, references. |
| Folio note `.folio-note` | Source Serif 4 *italic* | 10px | — | — | `--ink-3` | Optional footnote on the left of the folio; anchor `<sup>` in accent italic. |

---

## 11. References (final page)

> Final page of every report. **Single column** of hanging-indent citations,
> closed by a small nameplate-rule sign-off. Set in the **smallest body type in
> the system** so a long list fits on one page, kept readable by tight leading
> and a generous indent that pulls each surname out to the margin.

| Property | Value |
|----------|-------|
| Class | `.reflist p` (one entry per `<p>`) |
| Family | Inter (body) / Source Serif 4 italic (titles in `<em>`) |
| Size | 10px body / 11px italic title |
| Weight | 400 |
| Leading | 1.55 |
| Color | `--ink-2` |
| Indent | Hanging — `padding-left: 18px; text-indent: -18px` |
| Spacing | 8px between entries |
| Order | Alphabetical by author surname; institutional authors by first significant word |

**Closing footer** — a single Inter 9px / 500 / uppercase / 0.16em / `--ink-3`
eyebrow ("Growth Lab · Harvard Kennedy School") above a 1px `--rule` hairline,
acting as the page's sign-off. Standard running head + folio (page number only).

---

## 12. Decision rules

1. **Serif or sans?** Serif for the cover, **all headings**, the lead, and the
   colophon. Sans for everything else.
2. **Body size is 12px.** Do not push body text below 12px. Footnotes (9px) are
   the only exception, and they live next to the folio.
3. **No trailing periods on headings.** Section headings, subsection headings,
   and TOC entries end without a period. *(Note: charts are the opposite — a
   chart **title** ends in a period because it reads as a finding. See
   [`data-vis-spec.md`](data-vis-spec.md) §3.)*
4. **No all-caps body or headings.** Uppercase is reserved for eyebrows, running
   heads, and similar 9–11px chrome.
5. **Color is for emphasis, not decoration.** Default ink layers: `--ink`
   (titles, strong), `--ink-2` (body), `--ink-3` (captions, chrome, hairlines).
   Reach for `--accent` only for eyebrows and the cover date.
6. **Tabular numerals in tables.** Always set `tabular-nums` on numeric cells,
   page numbers, and TOC page numbers.
7. **One lead per section.** A `p.lead` never appears twice on the same page.
8. **Cover meta is two lines.** Series name in ink-3 weight 600; date in accent
   weight 700. Never combine them on one line.
9. **No monospace.** Numerals use Inter with tabular figures. Avoid mono fonts in
   body and tables.
