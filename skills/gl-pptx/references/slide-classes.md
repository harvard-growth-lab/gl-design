# Slide classes -> template layouts

The [slide recipe](../../../recipes/slide.md) defines slide *classes*; the GL template
defines 12 *layouts*. In PowerPoint the **layouts win** — logos, footer band, title
styling and the master font are baked into them. This file is the mapping, the measured
geometry, and the judgement call for each class.

## The mapping

| Class | Builder | Layout | Notes |
|---|---|---|---|
| `title` | `add_title_slide` | `Title Slide` | `background=` switches to `Title Slide With Background Image` |
| `content` | `add_content_slide` | `Title + Blank` | body drawn as a textbox (no body placeholder exists) |
| `chart` | `add_chart_slide` | `Single Visual` | `eyebrow=` grows the title block and pushes the chart down |
| `cols` | `add_cols_slide` | `Two Visuals` (2 images) / `1_Two Visuals` (image + text) | chosen from the argument types |
| `map` | `add_map_slide` | `Two Visuals` | images placed in computed rects at the recipe's tight map padding |
| `img_slide` | `add_img_slide` | `Side Image + Text` | image is cover-cropped |
| `img_full` | `add_img_full_slide` | `Full Image` | cover-cropped, optional caption |
| `break` | `add_break_slide` | `Statement Text` | |
| `table` | `add_table_slide` | `Title + Blank` | table drawn with grammar rules |
| `closing` | `add_closing_slide` | `Closing Slide` | layout owns the artwork; message/contact overlay |
| `blank` | `add_blank_slide` | `Blank` / `Blank without footer` | freeform, and the compiler's copy target |

Recipe classes with no PowerPoint equivalent: the recipe's **cover artwork** (pattern +
logo + accent rule) and its **`break` inversion** (`ink-2` ground, light type) are the
template's business — its `Title Slide` and `Statement Text` layouts already carry a GL
cover and divider. Do not rebuild them.

## Measured placeholder geometry (inches)

Read from the shipped template. The builders address placeholders by these indices and
fall back to "the nth placeholder of this kind" if a future template revision renumbers
them.

| Layout | idx | Kind | L | T | W | H |
|---|---|---|---|---|---|---|
| `Single Visual` | 14 | title text | 0.47 | 0.27 | 12.41 | 0.55 |
| | 16 | picture | 0.47 | 0.97 | 12.40 | 5.42 |
| | 15 | source text | 0.47 | 6.54 | 12.41 | 0.22 |
| `Two Visuals ` | 14 | title | 0.47 | 0.27 | 12.41 | 0.55 |
| | 17 | picture (left) | 0.47 | 0.97 | 6.01 | 5.42 |
| | 18 | picture (right) | 6.89 | 0.98 | 6.01 | 5.42 |
| | 15 | source | 0.47 | 6.54 | 12.41 | 0.22 |
| `1_Two Visuals ` | 17 | picture | 0.47 | 1.08 | 7.03 | 5.56 |
| | 18 | text column | 7.76 | 1.08 | 5.13 | 4.93 |
| | 15 | source | 7.73 | 6.14 | 5.13 | 0.51 |
| `Title + Blank` | 14 | title | 0.47 | 0.38 | 12.41 | 0.55 |

Every layout also carries date (10), footer (11) and slide-number (12) placeholders at
T=6.95 — that is the **footer band**, and nothing else may cross **6.82 in**
(`validate_deck` enforces it; `fit_above_footer` repairs it).

Note `Two Visuals ` and `Full Image ` have a **trailing space** in their names. `_layout()`
matches names tolerantly, so builders are unaffected.

## Two traps worth knowing

**Placeholders that inherit geometry have no `<a:xfrm>` of their own.** Setting one
dimension (`ph.top = ...`) writes a *partial* xfrm and the shape collapses or lands off
slide. Either write all four values (`left/top/width/height`) or read the rect, drop the
placeholder, and place content yourself. Both patterns are in `gl_pptx.py`.

**Stripping a table's style id makes PowerPoint draw its own default grid.** Every unwanted
edge must be explicitly `noFill`, and the four edge elements must appear in the order
lnL, lnR, lnT, lnB — out of order, PowerPoint discards the whole spec and the vertical
rules come back.

## Choosing a class

- **One message per slide, and the class that communicates it fastest.** A number in a
  sentence does not need a chart; a comparison does not need two slides.
- `chart` for one figure that carries the argument. Title states the **finding**, with a
  period — "Exports pull away after 2018." not "Exports, 2010-2024".
- `cols` for a genuine parallel: two views of one question, or a chart plus the two
  sentences that read it. Not for two unrelated ideas sharing a slide.
- `break` is punctuation — no body, no chart (recipe rule 7). If a divider needs a chart,
  it is not a divider.
- `content` when the argument is verbal. Keep to a few lines; body is 18pt and read at
  distance, and shrinking it is how a slide becomes a document.
- `table` for a handful of exact numbers (about 6 rows x 4 columns). Past that, chart it or
  split it — a table nobody can read from the back of the room is decoration.
- `img_slide` / `img_full` for photographs, not for charts: they cover-crop, so a chart
  would lose its axes.

## Figure sizes per class

A full-slide figure contained in a half-width box leaves most of the box empty. Match the
export size to the class (`references/figures.md` has the full table):

| Class | Size | Inches |
|---|---|---|
| `chart` | `slide_fill` | 12.4 x 5.4 |
| `cols`, `map` | `slide_half` | 4.9 x 5.0 |
| `cols` (image + text) | `slide_half` | 4.9 x 5.0 |
| wide ranked bars on `chart` | `slide_wide` | 11.5 x 4.4 |
| a chart that also travels alone | `slide` | 10 x 5.625 |
