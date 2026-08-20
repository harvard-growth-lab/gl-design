---
name: gl-pptx
description: Build an editable PowerPoint (.pptx) deck on the official Growth Lab template, from an analysis. Use this skill when the user wants to build a slide deck or presentation, "turn this into slides", draft a deck from data, charts or an analysis script, or stitch several finished section decks into one presentation. Output is always a valid, editable .pptx on GL_presentation_template.potx (12 branded layouts, logos baked in). For a flat 16:9 PDF deck from prose markdown, use md2slides instead.
compatibility: Requires Python 3.9+ with python-pptx (and pillow for image fitting; matplotlib + pandas for the chart/table paths). No pandoc, Node or Chromium needed.
metadata:
  version: "1.0"
---

# GL md -> pptx decks

Build **editable PowerPoint decks** on the official Growth Lab template
(`assets/GL_presentation_template.potx`). The deck follows the [visual
grammar](../../grammar.md) and the [slide recipe](../../recipes/slide.md); the
template's **12 layouts are the ground truth for PowerPoint** — logos are baked into
every layout and placeholder text inherits the master font.

**When to use this skill vs. `md2slides`:** both render the slide recipe. `md2slides`
turns prose markdown into a flat 16:9 **PDF** — reach for it when the deck is written,
not computed, and nobody needs to edit it afterwards. `gl-pptx` produces an **editable
.pptx** from an analysis — reach for it when the deck is built from charts, data and
scripts, and colleagues will reorder slides, retype a title, or present from PowerPoint.

Two workflows: **A — create** a section deck; **C — compile** section decks into one.
(There is deliberately no "restyle someone's existing deck" workflow; see *Not in scope*.)

## Core stance — a presentation partner, not a generator

- **The user owns the message.** Improve structure and clarity; never overwrite their point.
- **Challenge** unclear messages, missing logic, and slides that say two things at once.
- **Agree the plan before building**, and summarise what was built afterwards.
- **One idea per slide** (recipe rule 2). If a slide needs two H1s' worth of content, it is
  two slides.
- Never hand back a deck the user has not validated.

## Setup

1. `python -c "import pptx"` — if it fails: `python -m pip install python-pptx pillow`.
   The chart and table paths also want `matplotlib` and `pandas`.
2. Run scripts with that interpreter, e.g.
   `python "$CLAUDE_PLUGIN_ROOT/skills/gl-pptx/scripts/compile_deck.py" --help`.
3. Nothing else — no fonts to install (the deck inherits the template master, and the
   in-chart font falls back gracefully), no pandoc, no Chromium.

## Slide classes -> template layouts

Author in the recipe's slide-class vocabulary; each class maps to one of the 12 layouts.
Full mapping, placeholder indices and geometry: `references/slide-classes.md`.

| Recipe class | Builder | Template layout | Use for |
|---|---|---|---|
| `title` | `add_title_slide(prs, title, subtitle, footer, background=)` | `Title Slide` / `Title Slide With Background Image` | deck opener; `subtitle` is the date |
| `content` | `add_content_slide(prs, title, body, source=)` | `Title + Blank` | a title + a body block |
| `chart` | `add_chart_slide(prs, title, png, source=, eyebrow=)` | `Single Visual` | one chart or figure |
| `cols` | `add_cols_slide(prs, title, left, right, source=)` | `Two Visuals` / `1_Two Visuals` | two figures, or figure + text column |
| `map` | `add_map_slide(prs, title, left, right, source=)` | `Two Visuals` | side-by-side maps (tight padding) |
| `img_slide` | `add_img_slide(prs, heading, body, photo)` | `Side Image + Text` | text beside a side image |
| `img_full` | `add_img_full_slide(prs, photo, caption=)` | `Full Image` | full-bleed image |
| `break` | `add_break_slide(prs, text)` | `Statement Text` | section divider / one big takeaway |
| `table` | `add_table_slide(prs, title, dataframe, source=)` | `Title + Blank` | a small table |
| `closing` | `add_closing_slide(prs, message, contact=)` | `Closing Slide` | deck closer |
| `blank` | `add_blank_slide(prs, footer=True)` | `Blank` / `Blank without footer` | freeform |

`left`/`right` on a `cols` slide may each be an image path **or** text — the builder picks
`Two Visuals` or `1_Two Visuals` accordingly. Charts are embedded **contained** (never
cropped); photos use cover-fit.

## Workflow A — create a section deck

1. **Understand intent** — topic, audience, objective, length, source material, and the
   user's key messages. Use `references/intake-checklist.md`.
2. **Find the figures first.** Run `scripts/scan_figures.py <analysis.py|.ipynb|.R>` to see
   what the analysis already produces and whether it is deck-ready. Prefer an existing
   exported figure (`gp.find_fig`) over making a new one.
3. **Agree the slide plan — and the class per slide.** State each slide's single purpose
   *and* its proposed class ("two charts -> `cols`"). When the class is not obvious from
   what the user said, confirm it.
4. **Build** with `gl_pptx` (snippet below). Do **not** add title/closing slides by
   default — an A deck is one *section*, and Workflow C adds them. Add them only for a
   standalone deck.
5. **Validate**: `gp.validate_deck(path, strict=True)`.
6. **Hand back** the path, a slide-by-slide summary, and any open questions.

```python
import sys, os
sys.path.insert(0, os.path.join(os.environ["CLAUDE_PLUGIN_ROOT"], "skills/gl-pptx/scripts"))
import gl_pptx as gp

prs = gp.new_deck()                                    # GL template, no slides
f = gp.find_fig("exports", "exports-index", lang="en") # a deck-ready figure
gp.add_chart_slide(prs, f["title"], f["path"], source=f["source"], eyebrow="Figure 1")
gp.add_cols_slide(prs, "Composition and wages", left_png, right_png, source="Source: ...")
gp.add_break_slide(prs, "What would it take?")
out = gp.save_deck(prs, "section-macro")               # -> $GL_SLIDES_DIR or the cwd
gp.validate_deck(out, strict=True)
```

## Workflow C — compile section decks into one

```bash
python scripts/compile_deck.py part1.pptx part2.pptx \
    --title "Pakistan's Path to Growth" --subtitle "MAY 2026" \
    --closing "Thank you." --contact "CONTACT - name@host.edu" --name briefing
```

Builds from the template, adds a `Title Slide`, stitches every input deck's slides in
order (preserving text, images and **live charts**), adds a `Closing Slide`, validates.
Inputs are assumed already on the template — the compiler does not audit or restyle them.
`--fit` nudges copied shapes off the footer band. A human reviews the result.

## Charts and figures

Charts arrive as **images**, and the deck does not care what drew them — matplotlib, ggplot
(`save_fig("slide", ...)` from `gl-ggplot`), anything. Three cases, in order of preference:

**1. The analysis already exports figures.** Look them up and embed:

```python
gp.find_fig("exports")                        # every figure in the group
gp.find_fig("exports", "gdp-trend", lang="es")  # one, in Spanish
```

`export_fig` writes `<figs>/<group>/<name>_<lang>.png` plus a `figures.json` carrying the
title, source and language. The figs root is `$GL_FIGS_DIR`, else the nearest `figs/` at or
above the cwd — no project layout is assumed. **Language variants are first-class**: export
the same `name` once per language and build the deck with `lang=`.

**2. The analysis builds figures but never exports them.** Add the export call **in the
cell or function that builds the chart**, so figures regenerate when the analysis re-runs —
never dump PNGs out of band:

```python
gp.export_fig(fig, "exports", "gdp-trend", title="Growth stalls after 2018.",
              source="Source: Growth Lab analysis of WDI data.")
```

**3. There is no chart yet.** Write one with `gl_chart.py`, the Python counterpart of
`theme_gl.R` — same tokens, same palettes, same axis conventions, same named sizes:

```python
import gl_chart as gc
gc.gl_setup()                                  # slide mode
fig, ax = gc.subplots("slide")
for s in others: ax.plot(s.x, s.y)             # muted by default
ax.plot(f.x, f.y, color=gc.gl["highlight"], linewidth=gc.FOCUS_LW)
gc.endlabel(ax, f.x[-1], f.y[-1], "Sindh", gc.gl["highlight"])
gc.style_axes(ax, ylabel="Index (2010 = 100)", year_axis=True)
gp.export_fig(fig, "exports", "gdp-trend", title="Growth stalls after 2018.", source="...")
```

Details and the R-vs-Python size table: `references/python-figures.md`.

**Never read a figure out of a running notebook, and never execute someone's analysis to
get a picture.** `scan_figures.py` reads files; it does not run them.

**A deck-bound chart carries no title or source in the image** — the slide's placeholders
own those (two copies is how a deck ends up with a title that says one thing and a chart
that says another). `gc.chart_text()` bakes them in, and is for standalone or report PNGs.

## House style, and the two compromises

Everything comes from `grammar.md` + `recipes/slide.md`: the warm ink ramp, `accent`, the
6-hue x 3-tone categorical palette, sequential/diverging ramps, highlight-by-muting, the
dark-tone-for-all-text rule, horizontal-only table rules, and the type scale. The recipe's
px values convert to pt exactly (x0.75) — the template canvas is 960 x 540 pt, which is the
recipe's 1280 x 720 px at 96 DPI.

Two documented per-medium compromises (also recorded in `docs/followups.md`):

1. **Type stack.** The grammar's stack is Source Serif 4 + Inter; this medium keeps the
   template master's **Source Sans Pro**, because the 12 layouts are the PowerPoint ground
   truth and a deck must render on any machine that opens it. Builders therefore **never set
   a font** — text inherits the master. The serif/sans (voice/function) split is carried by
   **weight and italic** instead: headings semibold, chart source italic, eyebrows uppercase
   and tracked.
2. **Optical sizing.** `opsz` is not expressible in OOXML, so the grammar's optical-size
   axis is unavailable here.

Never hardcode a hex: `gp.token("c-1.dark")`, `gp.categorical(3)`, `gp.emphasis(...)`,
`gp.label_color(fill)`. `gp.check_token_drift()` verifies every hex in `gl_pptx.py` still
matches `grammar.md` (89 values) — run it if a color ever looks off.

## Validation

`gp.validate_deck(path)` re-opens the finished file and checks: it opens; it is 16:9; every
slide is on one of the 12 layouts; no run declares an off-template font; every explicit
text color resolves to a grammar token; **no dark text sits on a dark layout** (`Title
Slide`, `Title Slide With Background Image`, `Closing Slide` have a `#124560` ground, and
their placeholder text inherits white — so setting an ink tone there makes it invisible);
nothing crosses the footer band (6.82 in); no picture placeholder was left empty showing
its prompt. It also *notes* chart titles that do not end with a period (recipe rule 5 —
findings, not labels). Always finish a deck with it.

## Not in scope

- **Restyling a deck built outside this skill.** The 12 layouts are the ground truth, so
  arbitrary decks have no reliable mapping onto them; a preserve-and-recolor path was cut
  deliberately. Rebuild the deck through Workflow A instead.
- **A flat PDF deck from prose.** That is `md2slides`.
- **Charts in R.** That is `gl-ggplot`; export at the `slide` size and embed the PNG.

## Files

| Path | Role |
|---|---|
| `scripts/gl_pptx.py` | The engine: grammar tokens + type scale, the 11 slide-class builders, tables, `copy_slide`, the figs/ pipeline, `fit_above_footer`, `validate_deck`, `check_token_drift`. |
| `scripts/gl_chart.py` | Python/matplotlib chart theme — the counterpart of `theme_gl.R`. |
| `scripts/compile_deck.py` | Workflow C — compile section decks into one. |
| `scripts/scan_figures.py` | Read a `.py`/`.ipynb`/`.R` and report which figures exist and which are deck-ready. |
| `assets/GL_presentation_template.potx` | The official GL template (12 layouts, logos baked in). |
| `references/slide-classes.md` | Class -> layout mapping, placeholder indices, geometry, when to use each. |
| `references/python-figures.md` | The three figure cases, sizes, and the chart-theme API. |
| `references/intake-checklist.md` | Plain-language "what to give me" guide for the user. |
| `../../playground/demo-pptx.py` | Dogfood example — builds charts, exports them, assembles a deck using every class, validates. |
