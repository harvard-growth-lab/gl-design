# Figures for a deck — the manifest, and the three cases

A deck embeds figures as **images**. What drew them does not matter: `gl-matplotlib`
(Python), `gl-ggplot` (R), or anything else that writes a PNG. What matters is that the
image is at a sensible size and that the deck can find the two sentences that belong with
it — the title above and the source below.

## The manifest

A PNG knows its pixels and nothing else. It does not know it is called "Exports pull away
after 2018." or that the data came from INEC. So `figures.json` records that, next to the
images:

```
<figs>/<group>/<name>_<lang>.png
<figs>/<group>/figures.json
```

```json
{
  "exports-index_en": {
    "name": "exports-index",
    "file": "exports-index_en.png",
    "lang": "en",
    "title": "Exports pull away after 2018.",
    "source": "Source: Growth Lab analysis of example data.",
    "caption": null
  }
}
```

The key is `<name>_<lang>`; absent fields are `null`, never omitted. **Both the Python and
the R writer emit exactly this**, so `find_fig` cannot tell which language produced a
figure. `<figs>` resolves as: an explicit argument -> `$GL_FIGS_DIR` -> the nearest `figs/`
directory at or above the working directory -> `./figs`. `group` is any bucket that suits
the project — a script name, a notebook, a chapter. **No project layout is assumed.**

Why bother: the title is authored **where the chart is made**, by the person who knows what
it shows, so it cannot drift from the chart or get lost between the analysis and the deck;
language becomes a parameter rather than a second set of hardcoded strings; and re-running
the analysis updates the image and its title together.

It is optional. With no manifest, `find_fig` globs the directory and infers `name`/`lang`
from filenames — you get the path, and you pass the title and source by hand.

## Writing it

**Python** (any matplotlib figure, styled by `gl-matplotlib`):

```python
gp.export_fig(fig, "exports", "gdp-trend",
              title="Growth stalls after 2018.",           # the finding, with a period
              source="Source: Growth Lab analysis of WDI data.",
              size="slide", lang="en")
```

**R** (any ggplot, styled by `gl-ggplot`):

```r
source(paste0(Sys.getenv("CLAUDE_PLUGIN_ROOT"), "/skills/gl-ggplot/assets/theme_gl.R"))
gl_setup(mode = "slide")
# ... build p ...
gl_export_fig("exports", "gdp-trend", plot = p,
              title = "Growth stalls after 2018.",
              source = "Source: Growth Lab analysis of WDI data.",
              size = "slide")
```

`gl_export_fig()` lives beside `save_fig()` in `theme_gl.R` and needs the `jsonlite`
package (only that function does — the theme and `save_fig()` work without it). Use
`save_fig()` when the figure is going into a report, `gl_export_fig()` when it is going
into a deck.

In both languages the call belongs **in the cell or function that builds the chart**, so
figures regenerate whenever the analysis re-runs. Never save figures out of band — an
out-of-band PNG is a fact nobody can reproduce.

### Language variants

Export the same `name` once per language and pick at build time:

```python
f = gp.find_fig("exports", "gdp-trend", lang=lang)   # one deck per language, same code
```

Set `$GL_FIG_LANG` to change the default from `en`. Keep each figure's text in one
language; underlying data labels stay in whatever language the source uses. Text the
**deck** supplies — eyebrows, body copy, table headers — is the caller's to localise; only
the figure's own title and source come from the manifest.

## Reading it

```python
gp.find_fig("exports")                            # every figure in the group
gp.find_fig("exports", "gdp-trend")               # one, default language
gp.find_fig("exports", "gdp-trend", lang="es")    # the Spanish variant
```

Each entry returns `path`, `title`, `source`, `caption`, `lang`, `stem`. A missing `source`
comes back as `None`, and the builders skip an empty source rather than printing "None".

## The three cases

**1. The analysis already exports figures.** Look them up and embed. Done.

**2. It builds figures but never exports them.** Find out what exists first:

```bash
python scripts/scan_figures.py analysis.py
python scripts/scan_figures.py notebooks/exports.ipynb --group exports
python scripts/scan_figures.py charts.R
```

It reports every place a figure is built or written and whether it is deck-ready — and it
**reads only**, never executing the file. Then add the export call as above.

**3. There is no chart yet.** Draw it with the chart skill for that language —
`gl-matplotlib` or `gl-ggplot` — then export it. Neither this skill nor the deck styles
charts; that is the chart skills' job.

## Named figure sizes

Shared across `gl-matplotlib`, `gl-ggplot` and this skill, so an R figure and a Python
figure of the same named size are interchangeable on a slide.

| Name | Inches | For |
|---|---|---|
| `slide_fill` | 12.4 × 5.4 | **a `chart` slide** — fills the image area exactly |
| `slide` | 10 × 5.625 | 16:9; a chart that may also be viewed on its own |
| `slide_half` | 4.9 × 5.0 | one side of a `cols` / `map` slide |
| `slide_wide` | 11.5 × 4.4 | wide, short charts (ranked bars) |
| `full` | 6.5 × 4.0 | report full-width |
| `full_tall` | 6.5 × 6.0 | report, faceted |
| `full_square` | 6.5 × 6.5 | scatter / network |
| `major` | 4.278 × 4.0 | report, beside text |
| `half` | 3.167 × 3.0 | report, side-by-side |

Match the size to the slide class. Two traps: a full-slide figure contained in a
half-width placeholder leaves most of the box empty; and a `chart` slide's image area is
12.4 × 5.42 in — an aspect of 2.29, **wider than 16:9** — so a `slide` figure fits by
height there and leaves a margin each side. Use `slide_fill` for a chart meant to occupy
the slide. Export at 200–300 DPI; bigger is not better, as
a 10 × 5.625 in PNG at 300 DPI is already 3000 px wide, more than any projector resolves.

## The one rule about titles

**A deck-bound chart carries no title and no source in the image.** The slide's
placeholders own them, and two copies is how a deck ends up with a slide title that says
one thing and a chart caption that says another.

Both chart skills can draw the figure block into the image — `chart_text()` in Python,
slide mode's in-chart titles in R. Those are for a PNG that travels **alone**. For a deck,
leave them off and let the manifest feed the slide.
