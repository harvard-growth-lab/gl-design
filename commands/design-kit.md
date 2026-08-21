---
description: Prime this session onto the Growth Lab design grammar — verify tooling, load the grammar + report recipe, and adopt GL conventions for every chart and document produced from here on.
allowed-tools: Bash(bash:*), Bash(Rscript:*), Read, Glob
---

# Growth Lab design kit — session primer

You are activating the Growth Lab design system for this working session. After this
command, **everything you produce — charts, reports, slides, briefs — must follow the
grammar**, without the user having to restate it.

## 1. Tooling check

Run the doctor and report what's available. If a tool needed for something the user later
asks for is missing, surface the exact fix from the doctor output — don't fail silently.

!`bash "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.sh"`

## 2. Load the source of truth

Read these two files **now** and treat them as authoritative for the rest of the session —
they hold the actual values (color hexes, type stack, type scale, figure sizes). Do not
restate or hardcode those values from memory; defer to what you read here:

- `${CLAUDE_PLUGIN_ROOT}/grammar.md` — THE source of truth: color ramps + palettes, type
  stack, type scale, in-chart typography conventions.
- `${CLAUDE_PLUGIN_ROOT}/recipes/report.md` — the report application: page geometry, grid,
  figure sizes, layout patterns.

(If `CLAUDE_PLUGIN_ROOT` is unset because the kit was installed via the symlink fallback,
read `~/.claude/skills/gl-ggplot/assets/theme_gl.R` and the repo's `grammar.md` instead.)

## 3. Working agreement for this session

The detailed rules live in the files above and in the skills below — this is the behavioral
contract, not a second copy of the values:

- **Charts** → `gl-ggplot` for R, **`gl-matplotlib`** for Python. R scripts source
  `theme_gl.R`; Python scripts import `gl_matplotlib`. Either way call `gl_setup()` once and
  **do not override the theme per chart**. Highlight by muting (overpaint the focus series;
  paint highlighted points once at full opacity). Save only at the named `save_fig()` sizes.
  After generating charts, run the **chart-audit** skill.
- **Documents** → render through the GL pipelines, never ad-hoc pandoc: `md2docx` (Word),
  `md2pdf` (PDF), `md2html` (HTML), `md2slides` (16:9 PDF deck). To restyle an existing Word
  doc, use `gl-docx-retheme`.
- **Slide decks** → `md2slides` when the deck is prose and ships as a flat PDF; **`gl-pptx`**
  when it is built from an analysis and must stay editable in PowerPoint (charts, data,
  tables on the team template). Both apply `recipes/slide.md`.

These skills carry the full API and the exact conventions; they auto-trigger on the right
tasks, or invoke them by name. Chart scripts start with:

```r
source(paste0(Sys.getenv("CLAUDE_PLUGIN_ROOT"), "/skills/gl-ggplot/assets/theme_gl.R"))
gl_setup()                  # report mode; gl_setup(mode = "slide") for standalone charts
```

```python
import sys, os
sys.path.insert(0, os.path.join(os.environ["CLAUDE_PLUGIN_ROOT"],
                                "skills/gl-matplotlib/scripts"))
import gl_matplotlib as gm
gm.gl_setup()               # report mode; gm.gl_setup(mode="slide") for standalone charts
```

Confirm to the user, in one line, that the GL design kit is active, and note anything the
doctor flagged as missing (e.g. fonts not system-registered → `scripts/install-fonts.sh`).
