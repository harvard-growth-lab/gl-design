---
name: md2pdf-minimal
description: Minimal fallback for markdown → PDF using md-to-pdf (Node). Preserved while md2pdf is rebuilt on the pandoc pipeline. Use only if pandoc-based md2pdf is broken or unavailable. For day-to-day use, prefer `md2pdf`.
compatibility: Requires Node.js (npx) and the md-to-pdf package; uses Source Serif 4 + Inter via Google Fonts at render time.
metadata:
  author: taimur-shah
  version: "2.0-minimal"
---

# GL md2pdf-minimal (fallback)

This is the preserved md-to-pdf flow, kept as a fallback while
`md2pdf` is rebuilt on top of pandoc. **No support for `:::` callouts,
citations, or cross-references** — those are why we're moving to pandoc.
Invoked as `md2pdf-minimal` to avoid colliding with the new `md2pdf`.

Convert markdown to a PDF that follows the [Growth Lab visual
grammar](../../grammar.md) and the [report
recipe](../../recipes/report.md). The skill is a thin Node wrapper around
`md-to-pdf` plus a stylesheet that maps markdown elements to the grammar's
role hierarchy.

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
  line, then `Source: ...` as a regular paragraph. The stylesheet uses
  `p:has(> img) + p` to detect and style the source line.
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
| Figure label ("FIGURE 4")         | Not auto-numbered. Authors include manually if needed. |
| Pandoc fenced divs (`:::`)        | Plain remark doesn't parse them. Renders as literal `:::`. |
| TOC                               | Not generated. md-to-pdf has no built-in TOC. |
| Optical sizing                    | CSS `font-variation-settings: 'opsz' N` is set on headings; Chromium honors it via Source Serif 4's variable axis. |

For full report fidelity (cover page, running head, TOC, cross-references),
use the docx pipeline ([`../md2docx/`](../md2docx/)).

## Quick example

```bash
# Under the installed plugin, the script and demo file live under $CLAUDE_PLUGIN_ROOT:
"$CLAUDE_PLUGIN_ROOT/skills/md2pdf-minimal/scripts/md2pdf-minimal" \
  "$CLAUDE_PLUGIN_ROOT/playground/demo-report.md" demo-report.pdf
# (From a git checkout instead: cd into the repo and run skills/md2pdf-minimal/scripts/md2pdf-minimal ...)
```

Renders `playground/demo-report.md` to `demo-report.pdf` with full GL
typography (Source Serif 4 + Inter, opsz-tuned headings, recipe color
tokens). Inspect against the upstream typography deliverable —
[`nil/typography-spec.html`](../../docs/nil/typography-spec.html), and the gaps already
recorded in [`nil/typography-alignment-review.md`](../../docs/nil/typography-alignment-review.md)
— for visual alignment.
