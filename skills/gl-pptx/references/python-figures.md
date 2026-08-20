# Figures for a pptx deck — the three cases, and the Python chart theme

A deck embeds figures as **images**. What drew them does not matter: matplotlib, ggplot via
`gl-ggplot`'s `save_fig("slide", ...)`, even a hand-made SVG rendered to PNG. What matters
is that the image is at a sensible size and that the deck can find its title and source.

## Case 1 — the analysis already exports figures

Look them up:

```python
gp.find_fig("exports")                            # every figure in the group
gp.find_fig("exports", "gdp-trend")               # one, default language
gp.find_fig("exports", "gdp-trend", lang="es")    # the Spanish variant
```

Each entry carries `path`, `title`, `source`, `caption`, `lang`, `stem`. Layout on disk:

```
<figs>/<group>/<name>_<lang>.png
<figs>/<group>/figures.json          # title / source / caption / lang per figure
```

`<figs>` resolves as: explicit `root=` -> `$GL_FIGS_DIR` -> the nearest `figs/` directory at
or above the cwd -> `./figs`. **No project layout is assumed** — `group` is whatever bucket
suits the project (a script name, a notebook, a chapter).

If a directory has no `figures.json`, `find_fig` falls back to globbing `*.png` and infers
`name`/`lang` from the filename. Titles and sources are then unknown and must be passed to
the builder by hand.

### Language variants

Export the same `name` once per language and pick at build time:

```python
gp.export_fig(fig_en, "exports", "gdp-trend", lang="en", title="Growth stalls after 2018.")
gp.export_fig(fig_es, "exports", "gdp-trend", lang="es", title="El crecimiento se estanca desde 2018.")
...
f = gp.find_fig("exports", "gdp-trend", lang=lang)   # one deck per language, same code
```

Set `$GL_FIG_LANG` to change the default from `en`. Keep each figure's text in one language;
underlying data labels stay in whatever language the source uses.

## Case 2 — figures are built but never exported

Run the scanner to see what exists:

```bash
python scripts/scan_figures.py analysis.py
python scripts/scan_figures.py notebooks/exports.ipynb --group exports
```

It reports every place a figure is built or written and whether it is deck-ready. It
**reads only** — it never executes the file.

Then add the export call **in the cell or function that builds the chart**, so figures
regenerate whenever the analysis re-runs:

```python
gp.export_fig(fig, "exports", "gdp-trend",
              title="Growth stalls after 2018.",           # the finding, with a period
              source="Source: Growth Lab analysis of WDI data.")
```

Use `plt.gcf()` if the figure was built inside a helper. Never save figures out of band —
an out-of-band PNG is a fact nobody can reproduce.

## Case 3 — there is no chart yet

Write one with `gl_chart.py`, the Python counterpart of `gl-ggplot`'s `theme_gl.R`: same
tokens, same palettes, same axis conventions, same named sizes.

```python
import gl_chart as gc

gc.gl_setup()                       # 'slide' mode (base 12pt); gl_setup("report") for 9pt
fig, ax = gc.subplots("slide")
```

### Highlight by muting is the default

The prop cycle is a **single muted grey**, not the categorical palette — an unpainted series
recedes, so the grammar's highlight pattern (rule 4) is what you get for free:

```python
for s in others:
    ax.plot(s.x, s.y)                                    # c-muted, 1.5pt
ax.plot(f.x, f.y, color=gc.gl["highlight"], linewidth=gc.FOCUS_LW)   # c-1, 1.8pt
gc.endlabel(ax, f.x[-1], f.y[-1], "Sindh", gc.gl["highlight"])       # dark tone + paper halo
```

For genuinely unrelated categories, opt in explicitly — and never past six (rule 5):

```python
ax.set_prop_cycle(**gc.cycle(3))
```

Prefer tones of one hue when categories share a parent (goods/services, low/medium/high):
`gp.CAT["c-1"]["main"]` and `["light"]`.

### API

| Call | Does |
|---|---|
| `gl_setup(mode, family, base_size)` | apply the theme; `mode` is `slide` or `report` (nothing else) |
| `subplots(size)` | `plt.subplots` at a named figure size |
| `style_axes(ax, ylabel=, grid=, zero_line=, year_axis=)` | gridlines on one axis, outward ticks, right-aligned y labels, zero baseline at axis weight, thousands separators; `year_axis=True` drops the x label |
| `chart_text(ax, eyebrow=, title=, subtitle=, source=)` | the figure-block text **inside** the image — for standalone/report PNGs, **not** for deck slides |
| `endlabel(ax, x, y, text, color)` | direct label in the series' dark tone with a `paper` halo |
| `cycle(n)`, `mute_and_highlight(cats, focus)` | categorical cycling; highlight-by-muting map |
| `dark(hex)` | the dark tone required for any text naming that mark (rule 6) |
| `cmap(palette)`, `diverging_norm(vmin, vmax, midpoint)` | grammar ramps; pins a diverging boundary to the real reference point |
| `save_fig(fig, size, filename)` | save at a named size (prefer `gp.export_fig` for decks) |
| `gc.gl[...]` | the token dict, R-compatible names (`ink_2`, `c_1_dark`, `c_muted`, `highlight`, `lead_finding`) |

`gc.gl_setup()` picks the first installed font from a stack (Source Sans Pro -> Source Sans 3
-> Inter -> DejaVu Sans) and warns if none is present, so a missing font degrades to
something readable instead of box glyphs.

### Line weights

The grammar specifies px; matplotlib wants points, and 1 px at 96 DPI = 0.75 pt:

| Role | px | `gl_chart` |
|---|---|---|
| axis, ticks, gridlines, zero baseline | 1 | `HAIRLINE_LW` = 0.75 |
| standard series line | 2 | `LINE_LW` = 1.5 |
| focus series line | 2.4 | `FOCUS_LW` = 1.8 |
| choropleth borders | 0.5 | `MAP_LW` = 0.375 |

## Named figure sizes

Shared with `gl-ggplot` so R and Python figures land identically.

| Name | Inches | For |
|---|---|---|
| `slide` | 10 x 5.625 | a `chart` slide (16:9) |
| `slide_half` | 4.9 x 5.0 | one side of a `cols` / `map` slide |
| `slide_wide` | 11.5 x 4.4 | wide, short charts (ranked bars) |
| `full` | 6.5 x 4.0 | report full-width |
| `full_tall` | 6.5 x 6.0 | report, faceted |
| `full_square` | 6.5 x 6.5 | scatter / network |
| `half` | 3.167 x 3.0 | report, side-by-side |

Export at 200-300 DPI. Bigger is not better: a 10 x 5.625 in PNG at 300 DPI is already
3000 px wide, more than any projector resolves.

## The one rule about titles

**A deck-bound chart carries no title and no source in the image.** The slide's
placeholders own them, and two copies is how a deck ends up with a slide title that says
one thing and a chart caption that says another. `chart_text()` exists for standalone PNGs
and report figures, where the image travels alone.

For a chart headed into a **report** rather than a deck, pass `gl_setup(family="Inter")` —
that is the grammar's in-chart family. The default matches the deck's master font instead,
so a slide reads as one artifact.
