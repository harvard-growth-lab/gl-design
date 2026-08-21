---
name: gl-matplotlib
description: Apply the Growth Lab design system to Python charts. Use this skill when creating or restyling matplotlib, seaborn, or pandas plots in any project — colors, typography, axis conventions, highlight-by-muting, and the named save sizes. The Python counterpart of gl-ggplot; for R/ggplot2 charts use that skill instead.
compatibility: Requires Python 3.9+ with matplotlib. The bundled fonts (Inter, Source Serif 4) should be registered with scripts/install-fonts.sh; without them charts fall back to a readable face and warn.
metadata:
  version: "1.0"
---

# GL matplotlib Design System

Produce Python charts that follow the Growth Lab [visual grammar](../../grammar.md):
the warm four-layer ink ramp, the six-hue categorical palette in light/main/dark tones,
mute-then-highlight, outward ticks and single-axis gridlines.

This is the Python twin of **`gl-ggplot`**. Same tokens, same palettes, same named figure
sizes, same rules — so a matplotlib chart and a ggplot chart of the same data are
siblings, not cousins. Use `gl-ggplot` for R; use this for Python.

## Setup

```python
import sys, os
sys.path.insert(0, os.path.join(os.environ["CLAUDE_PLUGIN_ROOT"],
                                "skills/gl-matplotlib/scripts"))
import gl_matplotlib as gm

gm.gl_setup()                   # report mode (default), base 9pt
gm.gl_setup(mode="slide")       # slide mode, base 12pt — read at distance
```

`gl_setup()` sets the theme globally through `rcParams`; you do not restyle per chart.

**Mode picks the base size and who owns the titles.** `report` assumes the document
prints the figure label, title and source, so don't draw them into the image. `slide`
is for a chart read at distance. Only these two modes exist — anything else raises,
because invented mode names used to fall through silently.

For a chart headed into a **`gl-pptx` deck**, use `gm.gl_setup(mode="slide",
family="Source Sans Pro")`: slide sizing, and the template's master font so the chart and
the slide around it read as one artifact.

## Highlight by muting is the default

The prop cycle is a **single muted grey**, not the categorical palette. An unpainted
series recedes, so the grammar's highlight pattern (rule 4) is what you get for free:

```python
fig, ax = gm.subplots("full")
for s in others:
    ax.plot(s.x, s.y)                                       # c-muted, 1.5pt
ax.plot(f.x, f.y, color=gm.gl["highlight"], linewidth=gm.FOCUS_LW)   # c-1, 1.8pt
gm.endlabel(ax, f.x[-1], f.y[-1], "Mongolia", gm.gl["highlight"])
gm.style_axes(ax, ylabel="Index (2010 = 100)", year_axis=True)
```

`gl["highlight"]` is c-1, the institutional blue; `gl["lead_finding"]` is c-2, the red,
for stark emphasis. For genuinely unrelated categories opt in explicitly — and never past
six (rule 5), which raises rather than silently extending the palette:

```python
ax.set_prop_cycle(**gm.cycle(3))
```

When categories share a parent (goods/services, low/medium/high), prefer **tones of one
hue** over unrelated colors (rule 7): `gm.CAT["c-1"]["main"]` and `["light"]`.

## API

| Call | Does |
|---|---|
| `gl_setup(mode, family, base_size)` | apply the theme; `report` or `slide` only |
| `subplots(size, **kw)` | `plt.subplots` at a named figure size |
| `style_axes(ax, ylabel=, xlabel=, grid=, zero_line=, thousands=, year_axis=)` | gridlines on one axis, right-aligned y ticks, zero baseline at axis weight, thousands separators; `year_axis=True` drops the x label |
| `chart_text(ax, eyebrow=, title=, subtitle=, source=)` | the figure block **inside** the image — standalone PNGs only (see below) |
| `endlabel(ax, x, y, text, color)` | direct label in the series' dark tone with a `paper` halo |
| `cycle(n)` / `mute_and_highlight(cats, focus)` | categorical cycling / highlight map |
| `dark(hex)` | the dark tone required for text naming that mark (rule 6) |
| `cmap(palette)` | colormap from a `sequential-N` or `div-N-1` ramp |
| `diverging_norm(vmin, vmax, midpoint)` | pins a diverging boundary to the real reference point |
| `save_fig(fig, size, filename, dpi=300)` | save at a named size |
| `gl[...]`, `CAT`, `MUTED`, `SEQUENTIAL`, `DIVERGING`, `token(name)` | the palette; `gl` uses `theme_gl.R`'s names (`ink_2`, `c_1_dark`, `c_muted`) |
| `check_token_drift()` | verify every hex here still matches `grammar.md` |

## Core rules that bite in matplotlib

1. **Dark tone for every label.** Any text naming a colored mark uses that color's **dark**
   variant — `gm.dark(color)`, never the fill hex. This includes the muted grey: a
   `c-muted` line gets a `c-muted-dark` label, because `c-muted` itself fails contrast
   against paper. `endlabel()` applies this for you.
2. **Gridlines on one axis.** `style_axes` defaults to y. Both axes only if the chart is
   genuinely dense.
3. **Ticks point out**, 4px, with tick labels 6px clear. Set by the theme; don't override.
4. **Diverging ramps need a real midpoint.** Use `diverging_norm(vmin, vmax, midpoint=0)`.
   A plain `Normalize` puts the hue boundary mid-range, so on data from −5 to +20 the
   boundary lands at +7.5 and the chart lies.
5. **0.8 opacity on overlapping marks** — scatter circles, overlaid polygons. Single-layer
   marks (bars, treemap tiles, choropleths) stay at full opacity; lowering it just dilutes
   the color.
6. **Chart titles end with a period.** They are findings, not labels. `chart_text()` warns
   if one doesn't.
7. **No monospace**, in the chart or out of it. Numerals are Inter with tabular figures.

## Figure sizes

| Name | Inches | For |
|---|---|---|
| `full` | 6.5 × 4.0 | report full-width |
| `full_tall` | 6.5 × 6.0 | faceted / stacked |
| `full_square` | 6.5 × 6.5 | scatter, network |
| `major` | 4.278 × 4.0 | 4-column chart beside text |
| `half` | 3.167 × 3.0 | side-by-side pair |
| `half_tall` | 3.167 × 5.0 | tall narrow |
| `slide` | 10 × 5.625 | a 16:9 chart slide |
| `slide_half` | 4.9 × 5.0 | one side of a two-up slide |
| `slide_wide` | 11.5 × 4.4 | wide and short (ranked bars) |

Every one of these matches `gl-ggplot`'s `save_fig` sizes exactly, so an R figure and a
Python figure of the same named size are interchangeable on a page or a slide. Save only at
named sizes — a bespoke `figsize` is how a deck ends up with eight different type scales.

## Where the titles live

`chart_text()` draws the eyebrow, title, subtitle and source **into the image**. That is
right for a standalone PNG that travels alone, and wrong everywhere else:

- **In a GL document** (`md2pdf`, `md2docx`) the figure block is the document's — pass the
  title and source in the markdown.
- **In a `gl-pptx` deck** the slide's own placeholders carry them. Two copies is how a deck
  ends up with a slide title that says one thing and a chart caption that says another.

For a deck, save through `gl_pptx.export_fig(...)` instead of `save_fig`: same sizes, but it
also records the title, source and language in `figures.json` so the deck builder can fill
the slide's placeholders itself.

## Checklist before finalizing

- Does one series carry the story, with the rest muted?
- Is every label in its mark's dark tone?
- Gridlines on one axis only? Ticks outward? Top/right spines gone?
- Six colors or fewer — and are unrelated hues really necessary, or would tones of one hue
  do?
- Title a finding, ending in a period? Source present?
- Saved at a named size, at 300 DPI?
- `check_token_drift()` clean?

## Files

| Path | Role |
|---|---|
| `scripts/gl_matplotlib.py` | The theme: tokens, palettes, `gl_setup`, `style_axes`, `chart_text`, `endlabel`, ramps, named sizes, `check_token_drift`. |
