---
name: md2pdf
description: Convert markdown files to styled PDF documents using the Growth Lab visual grammar. Use this skill when the user asks to render, export, or convert a markdown file to PDF, or when a task requires producing a PDF that matches the GL design system.
compatibility: Requires pandoc, pandoc-crossref, and headless Chromium (chrome-headless-shell). Optional references.bib in the input dir enables citations via citeproc.
metadata:
  author: taimur-shah
  version: "2.0"
---

# GL md2pdf

Convert markdown to a PDF that follows the [Growth Lab visual
grammar](../../grammar.md) and the [report
recipe](../../recipes/report.md). The pipeline is pandoc (with
`pandoc-crossref`, and `citeproc` when a `references.bib` is present) →
standalone HTML with the GL stylesheet → `chrome-headless-shell --print-to-pdf`.
The stylesheet maps markdown elements to the grammar's role hierarchy.

## Usage

```bash
md2pdf input.md             # outputs input.pdf alongside the source file
md2pdf input.md output.pdf  # outputs to a specific path
```

Markdown frontmatter can override page format:

```yaml
---
title: "Document title"
pdf_options:
  format: Letter   # or A4
  margin: "1in 1in 1.25in 1in"
---
```

## Cover page

A `title` in the frontmatter produces the recipe's cover (cover paper, eyebrow
+ date, display title, accent rule, byline, pattern artwork, GL logo top
right). Cover keys:

```yaml
---
title: "City Growth Diagnostic: Ben Guerir"   # inline string; `\` + newline for a line break
subtitle: "Optional subtitle"
author:
  - "Adeline Hipps, Jesús Daboin, Tim O'Brien and Issam Samiri"
date: "September 24, 2026"
series: "Draft for comments"       # eyebrow line; omit when the source has none
cover-pattern: report               # report (circle) | working-paper (rect, the default) | false | path
partner-logos:                      # optional; shown after the GL logo, hairline-separated
  - src: cover/ecu_logo.png         # relative to the markdown file
    alt: "Economics and Complexity Unit, UM6P"
cover-note: |                       # optional partnership/disclaimer text under the byline
  This report is part of a research partnership between ...
colophon: |                         # optional page 2 (Nil §4): affiliations, disclaimers,
  * Assistant Professor, ...        #   citation, when they do not fit on the cover
cover-logo: path/to/other-logo.png  # optional; overrides the default GL logo
toc: true                           # optional "Contents" page after the cover (Nil §9)
---
```

Sizes are Nil's px numbers printed as points (body 12pt, display 56pt). The
cover holds one page only: if page 2 starts with cover text (a long byline or
note), move the note to `colophon:` (serif 14pt, white page, no folio). With
partner logos the meta-row logos step down (GL 28pt, partner 30pt) so the row
never forces Chromium to shrink every page; the size check after rendering
warns when body text comes out under 12pt.

Full reports use `cover-pattern: report`; working papers use the default.
Block scalars (`|`) also work for title/subtitle/author.

## Alt text

Give each figure its alt text with `fig-alt`; it becomes the `<img alt>` and
the tagged PDF's `/Alt`. Without it the alt falls back to the caption.

```markdown
![Exports stagnated after 2014. // Share of GDP, percent](fig03.png){#fig:exports fig-alt="Line chart of ..."}
```

## Page scaling check

Chromium shrinks **every** page when any element is wider than the text
column. The stylesheet lets long tokens wrap and tightens wide tables to
prevent it. After rendering, md2pdf fits the text sizes against the recipe
and prints `WARNING: pages printed at N% scale` if the document came out
shrunk. This needs PyMuPDF (`fitz`) and is skipped without it. Fix the
offending element (usually a very wide table or an unbreakable string) and
re-render.

## Markdown → grammar role mapping

| Markdown          | Role                                        | Spec                                          |
|-------------------|---------------------------------------------|-----------------------------------------------|
| `# Heading`       | H1 / Section                                | Source Serif 4 26pt 500 ink, opsz 28          |
| `## Heading`      | H2 / Subsection                             | Source Serif 4 16pt 500 ink, opsz 18          |
| `### Heading`     | H3 (improvised — see docs/followups.md #1)  | Source Serif 4 14pt 600 ink, opsz 16          |
| `#### Heading`    | Eyebrow                                     | Inter 11pt 600 UPPER accent, 0.14em tracking  |
| `body paragraph`  | Body                                        | Inter 12pt 400 ink-2, 1.6 leading             |
| `**bold**`        | Body emphasis                               | Inter 12pt 600 ink                            |
| `*italic*`        | Italic                                      | Inter 12pt 400 italic ink-2                   |
| `> blockquote`    | Small callout                               | accent-tint bg, 3px accent left border        |
| ` `inline code` ` | Inline code                                 | monospace, 0.88em, paper-warm bg              |
| ```` ```block``` ```` | Code block                              | monospace 9.5pt, paper-warm bg                |
| `![alt](path)`    | Figure block                                | Full-width image                              |
| `Source: ...`     | Chart source (paragraph after image)        | Source Serif 4 italic 12pt ink-2              |
| `| col | col |`   | Table                                       | Recipe table (top/bottom ink rules)           |
| `---`             | Horizontal rule                             | 1px `rule` (#DDDDDD)                          |
| `[^1]` footnotes  | Footnote                                    | Inter 9pt ink-3 at document end (Nil's 9px as pt) |

## Conventions

- **Figure block**: write the image on its own line, follow with a blank
  line, then `Source: ...` as a regular paragraph. The `gl-figure.lua` filter
  stacks the caption into Nil's three-part block:
  - **Figure label** — add a `{#fig:label}` id and pandoc-crossref numbers it;
    the filter splits "Figure N" into an accent-blue uppercase eyebrow on its
    own line. Without an id the figure is unnumbered (no label).
  - **Chart title** — the image alt text up to a standalone ` // ` (Source
    Serif 4; end it with a period).
  - **Chart subtitle** — *optional*, written after the ` // ` in the alt text:
    `![Chart title. // Units, period, unit of analysis](chart.png){#fig:x}`.
    (A legacy form — subtitle in the image title attribute,
    `![Title](chart.png "Subtitle")` — still works.)
- **Lead paragraph**: not automatic. Wrap the first paragraph after a
  heading with `<p class="lead">` (HTML pass-through) when you want the
  lead role. md-to-pdf supports inline HTML in markdown.
- **Callouts**: pandoc-style fenced divs (`::: {.box title="..."}`) pass
  through if a remark transformer converts them; otherwise they render as
  literal text. See *Known gaps* below.

## Known gaps

The pipeline is markdown → headless Chrome → PDF; it gives us typography
fidelity but not document chrome. The following are recipe features that
md2pdf does **not** render today:

| Recipe feature                    | Status                                         |
|-----------------------------------|------------------------------------------------|
| Cover page (display + rule + byline + pattern) | Rendered from the frontmatter: see *Cover page* above. |
| Colophon page (page 2)            | Not rendered. |
| Annex figure labels ("Figure A1") | Not supported: crossref numbers are numeric. Workaround: an unnumbered figure with `[Figure A1]{.fig-label}` at the start of the caption. |
| Running head (series tag + logo)  | Not rendered. Only the folio (page number) is in the bottom-right margin. |
| Figure label ("FIGURE 4")         | Rendered: pandoc-crossref numbers figures with a `{#fig:label}` id; `gl-figure.lua` styles "FIGURE N" as an accent eyebrow. Unnumbered images get title + optional subtitle only. |
| Pandoc fenced divs (`:::`)        | Plain remark doesn't parse them. Renders as literal `:::`. |
| TOC                               | `toc: true`: a "Contents" page after the cover (and colophon), Heading 1 and 2 (`toc-depth:` to change), Nil §9 styles, no folio. Chromium has no `target-counter()`, so md2pdf prints twice and fills the page numbers from the PDF's own links (`scripts/toc_pages.py`, needs PyMuPDF). `{.unlisted}` leaves a heading out. |
| Optical sizing                    | CSS `font-variation-settings: 'opsz' N` is set on headings; Chromium honors it via Source Serif 4's variable axis. |

The PDF is the report deliverable (see the report recipe). The Word pipelines
([`../md2docx/`](../md2docx/), `gl-docx-retheme`) give an editable copy with a
live TOC, but at 1px→1pt sizes and without the GL cover.

## Quick example

```bash
# Under the installed plugin, the script and demo file live under $CLAUDE_PLUGIN_ROOT:
"$CLAUDE_PLUGIN_ROOT/skills/md2pdf/scripts/md2pdf" \
  "$CLAUDE_PLUGIN_ROOT/playground/demo-report.md" demo-report.pdf
# (From a git checkout instead: cd into the repo and run skills/md2pdf/scripts/md2pdf ...)
```

Renders `playground/demo-report.md` to `demo-report.pdf` with full GL
typography (Source Serif 4 + Inter, opsz-tuned headings, recipe color
tokens). Inspect against the upstream typography deliverable —
[`nil/typography-spec.html`](../../docs/nil/typography-spec.html), and the gaps already
recorded in [`nil/typography-alignment-review.md`](../../docs/nil/typography-alignment-review.md)
— for visual alignment.
