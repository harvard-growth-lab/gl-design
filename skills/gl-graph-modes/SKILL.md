---
name: gl-graph-modes
description: Generate Growth Lab charts in two modes — fast, colorful research graphs (default) or production/report-ready graphs compliant with the GL visual grammar (Nil's data-vis spec). Use when the user asks to create any chart, plot, or visualization.
compatibility: Requires R >= 4.1, systemfonts >= 1.1.0, ggplot2 >= 3.3, and ragg (same floors as gl-ggplot, whose theme_gl.R this skill sources).
metadata:
  author: jedaboin
  version: "1.0"
---

# GL Graph Modes

You create charts following the Growth Lab design system (Source Serif 4 +
Inter, the Nil categorical palette with light/main/dark tones, warm ink ramp).
This skill wraps the `gl-ggplot` design system with **two modes** that have
different rules: exploration should be fast and colorful; deliverables should
be spec-compliant and deliberate. **Write the R script; never run it** unless
the user asks — the user executes scripts themselves.

## Mode selection — do this first

- **Research mode is the silent default.** No questions, full color, fast
  iteration. Use it unless the user signals otherwise.
- **Production mode** triggers when the invocation says `prod`, or the user's
  wording signals a deliverable: "final", "production", "report", "for the
  deck", "for the memo", "publication-ready", "to send", etc.
- **On entering production mode, ask before writing any code** using the
  AskUserQuestion tool. Cover (adapt to what's already known from context):
  1. **Main message** — what single finding should the chart state? The answer
     becomes the chart title (a full sentence ending in a period).
  2. **Destination** — report document (report mode: no in-chart title/source,
     `save_fig("full", ...)` etc.), slide deck or standalone PNG (slide mode:
     title + subtitle + source render in-chart, `save_fig("slide", ...)`).
  3. **Color strategy** — pop-up (mute everything, highlight 1–2 focus series —
     and which entity is the focus), full categorical (≤6 unrelated
     categories), or tones of one hue (categories sharing a parent).
  4. **Source line** — the data attribution text (always required in
     production).

  Skip any question whose answer is unambiguous from the conversation; never
  skip the main-message question.

## Setup (both modes)

At the top of every chart script:

```r
source(paste0(Sys.getenv("CLAUDE_PLUGIN_ROOT"), "/skills/gl-graph-modes/assets/gl_graph.R"))
# ^ under the installed plugin. If CLAUDE_PLUGIN_ROOT is unset (symlink install),
#   use "~/.claude/skills/gl-graph-modes/assets/gl_graph.R" — the repo root
#   auto-detects either way.
gl_setup_graph()                    # research mode (default)
gl_setup_graph(mode = "report")     # production — chart placed into a document
gl_setup_graph(mode = "slide")      # production — standalone PNG / slide deck
```

This sources `gl-ggplot`'s `theme_gl.R` from the same repo (fonts, theme,
palettes, `save_fig()`, all helpers), then layers on the extended research
palette and mode handling. Everything `gl_setup()` provides is available.
Never add `theme_set()`, `+ theme_minimal()`, or per-chart theme overrides
(allowed exceptions: legend position/rows, the horizontal-bar gridline flip,
`gl_endlabel_room()`).

Do not probe for or install packages — if sourcing fails, report the error to
the user.

---

## RESEARCH MODE (default)

Purpose: exploration. Show as much of the data as possible, in as much color
as needed, with minimum ceremony. Research charts still use GL typography and
theme, so they read as drafts of production charts — but the production
restrictions do **not** apply.

- **Palette**: the extended 12-hue palette is the discrete default — just map
  `color`/`fill` and every category gets a distinct hue (blue, red, teal,
  purple, orange, yellow, pink, green, cyan, indigo, brown, gold). No
  color-count warnings, no muting requirement. The first six hues are the
  production palette, so switching a draft to production re-scopes color
  rather than restyling.
- **Colorful by default**: untyped geoms come out in the house blue (`gl$c_1`)
  — a bare `geom_line()` or `geom_col()` on a single series needs no color
  argument. Muting is opt-in (`color = gl$c_muted`) rather than the default.
- **Titles/subtitles in-chart**: allowed and encouraged (`labs(title = ...,
  subtitle = ...)`); a source line is welcome but not mandatory.
- **Legends**: bottom, no title (the mode default). Legends are fine here —
  direct end labels are a production nicety.
- **Export**: `save_graph("my_chart.png")` → 2000×1000 px PNG into `plots/`
  (16:9-slide-ready; renders 10×5 in at 200 dpi so all theme proportions
  hold). Descriptive snake_case filenames.
- **Label floors are relaxed**: in-chart text may drop below the production
  12px floor when density demands it (e.g. treemap tile labels) — never in
  production mode.
- Still worth keeping even in research mode: `scale_x_log10()` for GDP per
  capita, formatted axes (`scales::dollar`, `percent`, `comma`),
  `labs(x = NULL)` on year-only axes, and GL hexes rather than `"red"`.

```r
# Research example — many categories, zero ceremony
df |>
    ggplot(aes(year, export_value, color = sector)) +
    geom_line() +                                  # 12-hue palette applies
    scale_y_continuous(labels = scales::dollar) +
    labs(title = "Exports by sector", x = NULL, y = "Export value")
save_graph("exports_by_sector.png")
```

---

## PRODUCTION MODE (report / slide)

Purpose: deliverables compliant with the GL visual grammar. After the
AskUserQuestion round, apply the **full gl-ggplot rule set** —
`skills/gl-ggplot/SKILL.md` is the authority; its core rules, geom defaults,
and checklist all apply unchanged. `gl_setup_graph(mode = "report"|"slide")`
delegates straight to `gl_setup(mode)`, restoring the strict upstream
defaults: muted-by-default geoms, 6-hue palette, report 9pt / slide 12pt base.

The decisions from the question round map onto the grammar:

- **Main message** → the chart title, a finding statement ending in a period
  (in-chart in slide mode; supplied by the document's figure block in report
  mode). Long titles take an explicit `\n` — slide-mode titles do not
  auto-wrap.
- **Destination** → the mode and the `save_fig()` size (`"full"` for report
  figures, `"slide"` for decks/standalone).
- **Color strategy** → pop-up (untyped geoms are already muted; overpaint the
  focus with `highlight`, or `lead_finding` when the finding itself is
  negative/alarming — red is valence, not emphasis strength), full categorical
  (≤6 hues, assigned in order), or tones of one hue. Every label tied to a
  colored mark uses the dark tone (`gl_dark()`).
- **Source line** → `labs(caption = "Source: ...")` in slide mode; recorded
  for the document figure block in report mode. A chart with no source
  anywhere is incomplete.

Also verify before saving: zero baselines via `gl_zero_line()` wherever 0 is
in an axis range, the 12px text floor (`gl_text_size`, drop labels rather than
shrink them), sequential vs. diverging ramps used correctly, and the full
checklist at the bottom of `gl-ggplot/SKILL.md`.

---

## Extended palette reference

Research extension (defined in `assets/gl_graph.R`, layered onto the `gl`
token list): `gl$c_7`…`gl$c_12` main tones `#D4679F` (pink), `#67A544`
(green), `#3FAAC8` (cyan), `#5D6DC4` (indigo), `#A3714A` (brown), `#D9A93E`
(gold), each with `_light`/`_dark` partners following the same tone grammar as
c_1..c_6. Named palettes added to `gl_palettes`: `categorical_ext`,
`categorical_ext_dark`, `categorical_ext_light` (12 each). `gl_dark()` is
extended to cover all 12 hues. The extended hues are **research-only** —
production charts stay within c_1..c_6 and the external sector palettes.

## Gotchas learned in the field

- **treemapify subgroup layouts crash on NA subgroup values** ("argument of
  length 0"). Coalesce NA groups to an explicit category (e.g.
  `"Unclassified"`, mapped to `gl$c_muted`) before plotting; top-N cuts mask
  the bug by dropping the NA rows.
- **`geom_smooth()` requires mgcv at the stat layer in some environments even
  with `method = "lm"`.** Where mgcv is unavailable, fit `lm()` by hand and
  draw the prediction with `geom_line(colour = gl$ink_4, linewidth = 0.70)`
  (for log-log axes: `10^(coef[1] + coef[2]*log10(x))`).

## Maintenance

This skill deliberately duplicates nothing from `gl-ggplot`: `theme_gl.R`,
fonts, and all upstream helpers are sourced from `skills/gl-ggplot/assets/`.
Changes to the core grammar belong there; only the mode logic, the extended
research palette, and `save_graph()` live in `assets/gl_graph.R`.
