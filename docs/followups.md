# Open questions and follow-ups

Working notes for the `nil-design` branch — points that need a decision, a
conversation with nil, or future iteration. Not for the merged spec.

## 1. Heading depth — we need an H3

Nil's typography spec defines three heading tiers: **display** (cover only),
**H1 section**, **H2 subsection**. Long-form research reports almost always
need at least one more level (H3) for sub-subsections. `recipes/report.md` and
the md2pdf CSS currently **improvise** an H3 (Source Serif 4 16px weight 600,
opsz 16) as a recipe extension — still pending Nil's blessing of the third tier.

**Resolution options:**
- Ask nil to extend the spec with an H3 (and confirm the improvised 16px).
- Keep the improvised H3 — Source Serif 4 16px weight 600, sitting between H2
  (20px) and chart title (14px). Risk: collision with chart-title styling.
- Use the lead paragraph as a soft section break, and rely on visual rhythm
  instead of an explicit H3.

## 2. Body baseline doesn't align to the 1.25" vertical module grid

Previously: body at 11pt / 15pt leading = 0.208" per baseline. Six baselines
= 1.25" = one vertical module. Body lines and figure placements snapped to
the same rhythm.

Under nil (px everywhere): body at 12px / 1.6 line-height = 19.2px leading =
0.2" per baseline. Six baselines = 1.2" — does not divide 1.25". Body has its
own rhythm; the module grid is still useful for figure placement but the two no
longer share a baseline.

**Resolution options:**
- Accept the decoupling (current state). Figures snap; body flows.
- Adjust body leading so 6 baselines = one module (20px leading → line-height
  ~1.67) — overrides nil's `line-height: 1.6`.
- Recompute the vertical module on the body baseline (would shrink modules
  to ~1.07", break the 7-module fit into 8.75" live height).

## 3. opsz numbers live in grammar but technically track size

`grammar.md` §2 includes specific opsz values (60 / 36 / 22 / 18 / 14) tied
to usage roles. By the grammar/recipe split rule, those values should live
in the recipe alongside size. The argument for keeping them in grammar:
opsz is a *glyph-cut intent*, not an absolute size — a slide cover and a
report cover both want opsz 60 even at different absolute sizes.

**Decision:** keep in grammar for now (user call). Revisit if a slide
recipe picks different opsz values.

## 4. Slide mode under nil's grammar

Nil's spec is report-only. `theme_gl()` currently exposes `mode = "slide"`
and `mode = "report"`. The slide mode renders titles inside the chart;
report mode suppresses them.

Under nil, the families and palette are the same, but the in-chart text
roles (chart title, subtitle, source) all want serif vs italic-serif
treatment. The default base size for slide-rendered charts will need to be
bigger (~16pt vs 12pt body) to read at a distance.

**Resolution:** specify slide recipe when one becomes a real artifact. For
now, `mode = "slide"` falls back to sensible defaults using the new fonts.

**Verification when that happens:** chart subtitle color migrated from old
`ink-3` (`#6B645A`) to new `ink-3` (`#4F4A42`) — visually cooler and darker.
Report mode suppresses the subtitle entirely, so this only matters once
slide mode is exercised again. Confirm the new tone reads correctly against
the slide background before declaring done.

## 5. Paper color rendering in Word — mostly moot

Content paper is now pure white (`paper #FFFFFF`), so the only non-white
surface is the cover (`cover-bg #F3F2EA`). Word page backgrounds don't print
by default, but since the cover is an HTML-or-PDF-first artifact (see §10),
the docx pipeline simply renders white throughout. Revisit only if a Word
cover becomes a real deliverable.

## 6. Figure block density

Nil's figure block has five elements: figure label, chart title, chart
subtitle (optional), image, source. The previous recipe had three (title,
image, caption). On small inset charts the five-element block may feel
heavy.

**Resolution options:**
- Treat figure label + subtitle as optional for `minor` / `half` figures.
- Keep the full block for `full` and `major`; collapse to title + image +
  source for smaller sizes.
- Follow nil strictly everywhere.

## 7. Sector palettes vs nil's 6-color categorical

The Atlas HS sector palette
(`assets/design-library/visualization_colors/atlas/hs_product_sectors.csv`)
is an external Growth Lab standard. It does not match nil's 6-color
categorical palette. We need a rule for when to use which.

**Tentative rule:** use the Atlas / sector palette when the chart is about
trade or product data (the colors carry sector semantics). Use the
6-color categorical otherwise. This mirrors how Atlas / Metroverse pages
themselves work.

## 8. Should growthlabbify.lua be format-agnostic?

Status: **not now.** The original idea was to refactor the lua filter to emit
format-agnostic AST so both `md2pdf` (HTML) and `md2docx` (DOCX) could share
it. After building the pandoc-based `md2pdf`, the filter turned out to be
**unnecessary** on the HTML path:

| Feature                          | DOCX (lua filter)           | HTML (pandoc + CSS) |
|----------------------------------|-----------------------------|---------------------|
| `:::` callout box                | OpenXML table with shading  | `<div class="box">` + CSS |
| Figure title above image         | Reorders AST + custom-style | `figure { flex-direction: column-reverse }` |
| `Source:` paragraph styling      | Custom-style "Figure Source"| `figure + p` selector |
| Side-by-side figures             | OpenXML side-by-side table  | Could be `figure + figure` CSS later |
| References H1                    | Inserts Header before `#refs` div | `--reference-section-title` |

The two pipelines now do the same job from the same markdown input via
totally different mechanisms. That's acceptable — each renderer plays to
its strengths (pandoc's HTML writer is already rich; the DOCX writer needs
the Lua kick).

**When to revisit:** if we introduce a third output target (e.g. a slide
recipe), refactoring the filter to emit AST + classes that both targets
style natively starts to pay for itself.

## 10. Word (docx) fidelity — rebuilt 2026-06-11, known limits

The GL Word theme was rebuilt from scratch against Nil's tokens:
`skills/md2docx/assets/build_gl_template.py` → `templates/gl.docx` (the file
`md2docx --theme gl` actually uses; the orphaned `assets/gl-report.docx` was
retired). Styles now cover the full role hierarchy, the five-element figure
block (Figure Label / Title / Subtitle / Image / Source, kept together —
`growthlabbify.lua` splits the crossref caption on ` // ` exactly like
md2pdf's `gl-figure.lua`), Nil tables (ink rules, `rule` dividers, bold ink
header), references (`Bibliography`, hanging indent), and the pandoc
fallback styles (`Compact`, `Body Text`, `First Paragraph`, …) that
previously dropped to Normal.

Known, accepted limits of the Word path (PDF remains the source of truth):

- **Sizes are 1px→1pt** (body 12pt) — ~33% larger than the canonical PDF
  (12px = 9pt). User decision 2026-06-11: Word stays editable/readable.
- **Weight 500/600 render bold (700)** — Word's `<w:b/>` is boolean.
- **Title rule is full content width** — Word can't do Nil's 50% left rule.
- **Cover artwork / colophon pattern** — still HTML-or-PDF-first; no SVG
  pattern, hairline, or cover paper in Word.
- **Reference titles** are italic Inter, not serif italic — pandoc emits no
  run style to hook the serif treatment onto.
- **TOC renders empty until fields update** (md2docx sets
  `updateFields=false` to suppress Word's prompt) — update manually in Word.
- **LibreOffice preview quirks** — side-by-side figures stack vertically and
  similar artifacts in `soffice` conversion; real Word renders fine.

For manual (non-pipeline) Word users, the template body is a self-documenting
starter page (cover roles, a live SEQ-numbered figure block to copy-paste, a
styled table), shipped alongside as `gl.dotx` so double-click creates a new
document. See `skills/md2docx/SKILL.md` § "Using the GL theme manually".

For **existing** Word documents, `skills/gl-docx-retheme/` converts to the GL
theme: scripted theme/style transplant + direct-formatting strip, Claude
judgment remaps (pseudo-headings, figure blocks, tables), and Word-comment
flags for what only the author can fix (chart regeneration, finding-style
titles, cover rebuild).

## 9. Typography size history — px vs pt (RESOLVED: px everywhere)

Nil's typography-spec.html writes sizes in **CSS px** at real Letter geometry
(8.5 × 11in pages), so her px values *are* print sizes (12px body = 9pt on the
page). The system briefly experimented with two pt translations and they
disagreed with each other:

- `recipes/report.md` / md2pdf CSS: headings ×0.75 (56→44, 34→26…) but body
  re-anchored up to 12pt for "print readability."
- `md2docx` template: literal 1px→1pt (56→56, 34→34…), ~33% bigger again.

Net effect: the Word file and the PDF rendered at different sizes, and neither
matched Nil.

**Resolution (2026-06):** the report ships as HTML → PDF, where CSS px is an
absolute print unit (96px = 72pt = 1in) and renders deterministically. So the
md2pdf stylesheet and `recipes/report.md` now use **Nil's px values as-is** —
1:1 with her reference. This makes body 12px = 9pt physical (dense editorial
sizing — accepted as Nil's intent, not a bug). pt is no longer used for the
report.

| Role     | Nil HTML | Now (px, used as-is) |
|----------|----------|----------------------|
| Display  | 56 px    | 56 px                |
| H1       | 34 px    | 34 px                |
| H2       | 20 px    | 20 px                |
| H3       | 16 px    | 16 px (recipe extension) |
| Lead     | 17 px    | 17 px                |
| Body     | 12 px    | 12 px                |
| Footnote |  9 px    |  9 px                |

`.docx` remains pt-native (Word can't express px) and is an explicit
*best-effort approximation* of the PDF — see the note in
`skills/md2docx/assets/build_gl_template.py`. **Resolved (2026-06-11):**
keep the literal 1px→1pt map (body 12pt) so Word stays comfortably editable;
accepted that Word renders ~33% larger than the canonical PDF. See §10.

## 11. Old font retention on merge

Three font families are still on the branch from the previous system:
Source Sans 3, JetBrains Mono, Crimson Pro. None are referenced by the new
grammar / recipe / tooling.

**Resolution options:**
- Remove on merge — clean break.
- Keep them in `assets/fonts/` indefinitely as historical reference / for
  any inherited Rmd that hasn't migrated.
- Move to a separate `assets/fonts/legacy/` subfolder.

## 12. PowerPoint (pptx) fidelity — the type-stack exception

`skills/gl-pptx/` renders the slide recipe as an **editable .pptx** on the team template
(`GL_presentation_template.potx`), alongside `md2slides`' PDF. Two deviations from the
grammar are baked in deliberately; both are recorded in `gl_pptx.py`'s module docstring and
need a ruling if the grammar is ever to cover this medium formally.

- **Type stack: Source Sans Pro, not Source Serif 4 + Inter.** The template's 12 layouts
  are the ground truth for PowerPoint — logos, footer band, cover artwork and title styling
  are baked into them, and the master font is Source Sans Pro. The builders therefore never
  set a font at all; placeholder text inherits the master, which also means a deck cannot
  render with box glyphs on a machine that lacks the grammar's fonts. The consequence is
  that the grammar's serif-for-voice / sans-for-function split collapses, and is carried by
  **weight and italic** instead: headings semibold, chart source italic, eyebrows uppercase
  and tracked.

  **Resolution options:** (a) keep the exception, and treat the template as authoritative
  for pptx (current state, user decision); (b) rebuild the .potx from grammar tokens the way
  `build_gl_template.py` rebuilds `gl.docx`, giving pptx the real two-family stack at the
  cost of owning the template's artwork and requiring the fonts to be installed; (c) set
  the grammar fonts explicitly on every run over the template's master, which renders
  correctly only where both fonts are installed.

- **`opsz` is unavailable.** OOXML cannot express a variable-font axis, so the optical-size
  values in grammar §2 have no expression here. Per grammar §2 this stub defaults to text
  optical size.

Everything else follows the grammar and `recipes/slide.md` exactly. The px→pt conversion is
**lossless**, unlike the Word path's: the template canvas is 13.333 × 7.5 in = 960 × 540 pt,
which is the recipe's 1280 × 720 px at 96 DPI, so every recipe value is exactly ×0.75 (body
24 px → 18 pt, H1 40 → 30, cover 64 → 48, chart source 16 → 12).

Two other notes for whoever picks this up:

- **The chart theme now exists in Python too**, as the **`gl-matplotlib`** skill beside
  `gl-ggplot`: the kit's chart tooling was R-only, so matplotlib users had no on-brand
  default. It mirrors `theme_gl.R`'s API (`gl_setup`, the `gl` token list, the named sizes,
  muted-by-default geoms) and carries its own token copy with its own `check_token_drift()`,
  exactly as the R theme does. It started inside `gl-pptx` and was moved out, because a
  researcher who just wants an on-brand chart for a memo should not have to reach into a
  PowerPoint skill to get one.

- **Deck-ready figures now work from R as well as Python.** `gl_export_fig()` in
  `theme_gl.R` writes the same `figures.json` manifest the Python side writes (schema in
  `skills/gl-pptx/references/figures.md`), so `gl-pptx` cannot tell which language produced
  a figure and R figures arrive with their title, source and language rather than needing
  them retyped at deck-build time. It is the only function in the kit that needs
  **`jsonlite`**; the theme and `save_fig()` are unaffected. The reader (`find_fig`) lives
  in `gl-pptx` because slides are the only consumer today — if a report pipeline ever wants
  figure metadata, promote the schema and both writers to a shared root module.
- **`skills/gl-graph-modes/` is not listed in `.claude-plugin/marketplace.json`.** Per the
  README's packaging rule ("add it to the `skills` array"), the plugin will not expose it.
  Left untouched here — it predates this branch and belongs in its own fix.
