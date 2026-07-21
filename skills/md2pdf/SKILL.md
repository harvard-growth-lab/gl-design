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
| `[^1]` footnotes  | Footnote                                    | Inter 9pt ink-3 at document end               |

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
- **Figure sizing (automatic)**: `gl-figure.lua` reads each chart PNG's pixel
  width and dpi (all GL charts are 300 dpi from `save_fig`) and stamps the
  `<img>` with an explicit width in inches (`pixel_width ÷ dpi`). This is what
  keeps baked-in chart text at its authored point size: a raster carries its
  labels as pixels, so they only read at the right size when the image is
  displayed at the exact physical width it was rendered for. Chromium otherwise
  sizes a PNG at px÷96 and `max-width:100%` rescales it to the column, shrinking
  or enlarging every label. A `full` chart lands at 6.5in, `half` at 3.167in,
  etc. — matching the `save_fig` size table. To override, set the width
  yourself: `![cap](chart.png){width=4in}` (an explicit width is respected).
  Only `.png` images are stamped; `max-width:100%` remains as an overflow guard.
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
| Cover page (display + rule + byline + pattern) | Not rendered. Document starts at page 1 as content. See [`followups.md`](../../docs/followups.md) #8. |
| Running head (series tag + logo)  | Not rendered. Only the folio (page number) is in the bottom-right margin. |
| Figure label ("FIGURE 4")         | Rendered: pandoc-crossref numbers figures with a `{#fig:label}` id; `gl-figure.lua` styles "FIGURE N" as an accent eyebrow. Unnumbered images get title + optional subtitle only. |
| Pandoc fenced divs (`:::`)        | Plain remark doesn't parse them. Renders as literal `:::`. |
| TOC                               | Not generated. md-to-pdf has no built-in TOC. |
| Optical sizing                    | CSS `font-variation-settings: 'opsz' N` is set on headings; Chromium honors it via Source Serif 4's variable axis. |

For full report fidelity (cover page, running head, TOC, cross-references),
use the docx pipeline ([`../md2docx/`](../md2docx/)).

## Quick example

```bash
# Under the installed plugin, the script and demo file live under $CLAUDE_PLUGIN_ROOT:
"$CLAUDE_PLUGIN_ROOT/skills/md2pdf/scripts/md2pdf" \
  "$CLAUDE_PLUGIN_ROOT/playground/demo-report.md" demo-report.pdf
# (From a git checkout instead: cd into the repo and run skills/md2pdf/scripts/md2pdf ...)
```

Renders `playground/demo-report.md` to `demo-report.pdf` with full GL
typography (Source Serif 4 + Inter, opsz-tuned headings, recipe color
tokens). Inspect against [`nil/GL-report-sample.html`](../../docs/nil/GL-report-sample.html)
for visual alignment.
