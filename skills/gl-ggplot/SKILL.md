---
name: gl-ggplot
description: Apply the Growth Lab design system to ggplot2 charts. Use this skill when creating R/ggplot visualizations in any project to ensure they follow GL visual standards — colors, typography, sizing, and save conventions.
compatibility: Requires R >= 4.1, systemfonts >= 1.1.0 (for match_fonts), ggplot2 >= 3.3, and ragg. These are floors, not pins — newer is fine, and no upgrade is needed if you already meet them.
metadata:
  author: taimur-shah
  version: "2.1"
---

# GL ggplot Design System

This skill tells you how to produce ggplot2 charts that follow the Growth Lab
visual grammar (Source Serif 4 + Inter; 4-layer warm ink ramp; categorical
palette with light/main/dark tones; mute-then-highlight).

## Setup

At the top of every R script or Rmd file that produces charts, add:

```r
source(paste0(Sys.getenv("CLAUDE_PLUGIN_ROOT"), "/skills/gl-ggplot/assets/theme_gl.R"))
# ^ under the installed plugin. If CLAUDE_PLUGIN_ROOT is unset (symlink install),
#   use "~/.claude/skills/gl-ggplot/assets/theme_gl.R" — the repo root auto-detects either way.
gl_setup()                          # report mode (default) — no title/subtitle/caption
gl_setup(mode = "slide")            # slide mode — keeps title/subtitle/caption
```

This registers the bundled fonts (**Source Serif 4** + **Inter** via
systemfonts), sets the theme globally, and configures the default discrete
color/fill palette. You do **not** need to call `theme_set()` or set
`ggplot2.discrete.colour` yourself — `gl_setup()` handles it.

Base size resolves by mode: **report charts use 9pt** (they are placed 1:1
into the page, where 9pt renders exactly Nil's specced 12px chart text);
**slide charts use 12pt** (distance viewing; slides sit outside Nil's
report-only spec). Override with `gl_setup(base_size = ...)` only with reason.

## What `gl_setup()` provides

After calling `gl_setup()`, the following are available:

| Object | What it is |
|--------|-----------|
| `gl` | Full list of design tokens — see below |
| `highlight` | `gl$c_1` (`#2F87C8`) — main blue, the default data focus: bar/area/point **fills** and highlighted **lines** |
| `highlight_dark` | `gl$c_1_dark` (`#1A5A8E`) — the **stroke** on a highlighted point and the **text/label** tied to the highlight (WCAG AA) |
| `lead_finding` | `gl$c_2` (`#CC4948`) — main red, for stark / lead-finding emphasis (sparingly) |
| `lead_finding_dark` | `gl$c_2_dark` (`#8A2C2B`) — stroke/label for the lead-finding mark |
| `accent` | `gl$accent` (`#1A5A8E`) — **non-data UI chrome only** (eyebrows, figure labels, links). Do **not** use as a data-mark fill — that is the typography↔data-viz mix-up to avoid |
| `c_muted` | `gl$c_muted` (`#AFB5BE`) — "everyone-else" gray for de-emphasis |
| `highlight_sz` | `linewidth` for the highlighted focus line (`0.84` = 2.4px). Standard/muted lines default to `0.70` (= 2px) — the focus is 1.2× thicker, per spec §5 (not a 2× jump) |
| `gl_text_size` | `size` for `geom_text`/`geom_label`/`annotate` (≈3.16 = 9pt = Nil's 12px). Already the geom default; it is the **floor** — never pass anything smaller |
| `gl_zero_line()` | Zero baseline: solid 1px `ink_2` at axis weight (Nil §4). `gl_zero_line()` for y = 0, `gl_zero_line("x")` for x = 0. The bare `geom_hline`/`geom_vline` default (dashed `ink_3`) is for reference *thresholds*, not zero lines |
| `gl_dark()` | Maps any GL main/light tone to its dark partner — for label/stroke colors (decision rule 2) |
| `gl_endlabel()` | Direct line-end series labels (wraps `geom_text_repel` with house conventions: dark tone, 12px floor, paper halo) |
| `gl_endlabel_room()` | Companion: `clip = "off"` + right margin + no legend, so end labels aren't clipped |
| `gl_highlight_point()` | A focus point painted **once**: shape 21, `fill` = main tone, `colour` = its dark partner, `alpha = 1`. Use for the highlighted dot — a bare `geom_point(color = highlight)` colors only the 1px stroke and leaves the body muted grey (the shape-21 default fills with `fill`, not `colour`) |
| `gl_hbar_grid()` | Flip gridlines for a horizontal-bar chart (X major on, Y off) so the reader can estimate bar lengths — the theme default is Y-only |
| `gl_blank_panel()` | Clear axes, ticks, gridlines, and frame for a plot with no meaningful axes (network, treemap, choropleth). A plain `theme(panel.grid = element_blank())` does **not** work — the theme sets specific child elements that survive a parent blank |
| `theme_gl()` | The theme function (already applied via `theme_set`) |
| `scale_color_gl()` | Discrete color scale using GL palettes |
| `scale_fill_gl()` | Discrete fill scale using GL palettes |
| `scale_color_gl_gradient()` | Continuous color scale (sequential / diverging; diverging auto-centers on `midpoint = 0`) |
| `scale_fill_gl_gradient()` | Continuous fill scale (same midpoint behavior) |
| `gl_palettes` | Named list of all available palettes |
| `gl_fig` | Named figure sizes for `save_fig()` |
| `save_fig()` | Save at a named size at 300 DPI — to `imgs/` or `dir =` / `options(gl.fig.dir = ...)` |

### Tokens in `gl`

| Token        | Hex       | Use                                                   |
|--------------|-----------|-------------------------------------------------------|
| `gl$ink`     | `#1A1714` | Headings, strong emphasis                             |
| `gl$ink_2`   | `#2C2823` | Body, axis text, table cells, axis lines / ticks      |
| `gl$ink_3`   | `#4F4A42` | Captions, eyebrows, chrome, chart subtitles           |
| `gl$ink_4`   | `#9A9389` | In-chart faint markers, sparse trendlines             |
| `gl$accent`  | `#1A5A8E` | Eyebrows, figure labels, links — = `gl$c_1_dark`      |
| `gl$gridline`| `#D8D4CC` | In-chart major gridlines                              |
| `gl$c_1`..`gl$c_6` | (palette) | Categorical main tones (fills)                 |
| `gl$c_1_dark`..`gl$c_6_dark` | (palette) | Dark tones — strokes + labels         |
| `gl$c_1_light`..`gl$c_6_light` | (palette) | Light tones — backgrounds, faded    |
| `gl$c_muted` | `#AFB5BE` | "Everyone else" gray for the mute-then-highlight move |
| `gl$c_muted_dark` | `#5F6773` | Strokes / labels for muted series                |

### Web / D3 widget encoding

**When building any HTML, D3, or SVG chart widget, copy this block verbatim —
never reconstruct color values from memory.** This is the authoritative JS
mirror of `theme_gl.R`. Update here whenever `grammar.md` changes.

```js
const GL = {
  // Ink ramp
  ink:          '#1A1714',
  ink_2:        '#2C2823',  // axis lines, ticks, tick labels — the standard axis color (Nil §4)
  ink_3:        '#4F4A42',  // subtitles, captions, reference lines
  ink_4:        '#9A9389',  // faint markers, sparse trendlines
  accent:       '#1A5A8E',  // non-data chrome only (eyebrows, links) — = c_1_dark
  paper:        '#FFFFFF',
  gridline:     '#D8D4CC',  // horizontal major gridlines

  // Categorical palette — main tones (fills, lines)
  c_1:          '#2F87C8',  // blue
  c_2:          '#CC4948',  // red
  c_3:          '#2AA584',  // teal
  c_4:          '#7554A3',  // purple
  c_5:          '#EA822D',  // orange
  c_6:          '#CDC86B',  // yellow

  // Dark tones — strokes on marks + ALL text tied to a series (WCAG AA)
  c_1_dark:     '#1A5A8E',
  c_2_dark:     '#8A2C2B',
  c_3_dark:     '#1A6B53',
  c_4_dark:     '#4A3470',
  c_5_dark:     '#A8580F',
  c_6_dark:     '#8A8638',

  // Light tones — backgrounds, faded states
  c_1_light:    '#B5D5EA',
  c_2_light:    '#E89C9C',
  c_3_light:    '#92D6BF',
  c_4_light:    '#B5A0CC',
  c_5_light:    '#F4BC8A',
  c_6_light:    '#E6E2A8',

  // Muted — "everyone else" grey
  // IMPORTANT: c_muted is the fill/line color only.
  // Any label, end-label, or legend entry for a muted series must use c_muted_dark.
  c_muted:      '#AFB5BE',
  c_muted_dark: '#5F6773',
  c_muted_light:'#CDD2D9',

  // Convenience aliases
  highlight:         '#2F87C8',  // = c_1 — default data focus (fills, lines)
  highlight_dark:    '#1A5A8E',  // = c_1_dark — point strokes + all labels tied to highlight
  lead_finding:      '#CC4948',  // = c_2 — stark emphasis (sparingly)
  lead_finding_dark: '#8A2C2B',  // = c_2_dark — stroke/label for lead-finding mark
};

// Dark-mode swap — axes and gridlines only; brand colors stay the same
const dm = matchMedia('(prefers-color-scheme: dark)').matches;
const AX = dm ? '#6B6560' : GL.ink_2;   // axis lines + tick labels (ink_2 per Nil §4)
const GR = dm ? '#302C28' : GL.gridline; // gridlines

// Font sizes (SVG user units). Nil §3: ALL chart text is 12px at render size —
// that is both the spec value and the floor. SVG font-size is in viewBox user
// units, so if the viewBox renders at a different pixel width, rescale:
//   font-size = 12 × (viewBox_width / render_width_px)
// For a viewBox rendered 1:1 (e.g. 310 units in a 310px column):
const FS     = 12;   // tick labels, axis titles, source line (weight 400/500)
const FS_LBL = 12;   // series end-labels, direct data labels (weight 600, dark tone)
```

## Core rules

### 1. Do not override the theme per chart

The theme is set globally. Do **not** add `+ theme_gl()` or `+ theme_minimal()`
to individual plots. The only per-chart theme adjustments allowed are:

- `legend.position = "right"` (when >6 categories — more than the default palette)
- `guides(color = guide_legend(nrow = 2))` (when bottom legend clips)
- the gridline flip for horizontal-bar charts (rule 13)
- `gl_endlabel_room()` when using direct end labels (rule 13)

### 2. Highlight with the mute-then-paint technique

The canonical Growth Lab chart move: untyped geoms are already muted (see
rule 3), so the pattern collapses to *overpainting the focus*. The muted
layer carries the trend; the highlight carries the finding. Never use
`"red"` or arbitrary hex for emphasis.

```r
data |>
    ggplot(aes(x = year, y = value, group = country)) +
    geom_line() +                                          # muted, default
    geom_line(data = \(d) filter(d, country == focus),
              color = highlight, linewidth = highlight_sz)
```

This works with any geom: `geom_point`, `geom_col`, `geom_bar`, `geom_text`, etc.

**Layer order matters: highlights go LAST.** ggplot draws geoms in the
order you add them, so the last layer sits on top. If you mix a muted
backdrop, a trend line, and a highlighted point, the highlight call must
come *after* `geom_smooth`/`stat_smooth`, otherwise the smooth ribbon will
occlude the focus dot.

```r
ggplot(data, aes(x, y)) +
    geom_point(data = \(d) filter(d, !focus)) +            # 1. muted backdrop (0.8 default,
                                                           #    same as Nil's samples), focus EXCLUDED
    geom_smooth() +                                        # 2. trend (ink_4 default)
    geom_point(data = \(d) filter(d, focus),               # 3. highlight, painted ONCE —
               fill = highlight, color = highlight_dark,   #    main fill + dark stroke
               alpha = 1) +                                #    alpha = 1, no grey underneath
    geom_text_repel(data = \(d) filter(d, focus),          # 4. label: dark tone + paper halo
                    aes(label = name), color = highlight_dark,
                    size = gl_text_size, bg.color = gl$paper, bg.r = 0.1)
```

**Any text layer drawn over data carries a thin paper halo** —
`bg.color = gl$paper, bg.r = 0.1` on `geom_text_repel` / `geom_label_repel` —
so the label stays legible when it lands on points or lines (`gl_endlabel()`
does this automatically). The halo never replaces the dark-tone rule: the
glyphs themselves stay in the series' dark tone.

**Why exclude the focus from the backdrop?** The `geom_point` default carries
`alpha = 0.8` so dense clouds darken on overlap instead of washing out. But that
opacity is poison for a highlight: if you leave the focus row in the muted
backdrop *and* overpaint it, the highlight dot (a) shows the panel through its own
0.8 alpha and (b) sits on top of a grey dot — the blue comes out muddy and
desaturated. So a highlighted point is **painted once**: filter the focus *out* of
the backdrop layer, then draw it a single time at `alpha = 1`. (Lines and bars are
opaque, so they can stay one-line overpaints — this only bites `geom_point`.)

Use `highlight` (main blue `#2F87C8` = `c_1`) for the default focus — the
institutional voice. Use `lead_finding` (main red `#CC4948` = `c_2`) when the
finding is stark — gains vs. losses, alarm, exception. Use sparingly.
**Red signals valence, not emphasis strength**: a focus series compared
against peers is the default-blue case however striking its performance;
reach for red only when the finding itself is negative or alarming (a
crisis, a loss, a breached threshold). For a
highlighted **point**, the fill is `highlight`, the **stroke** is
`highlight_dark` (`#1A5A8E`), and it is drawn **once at `alpha = 1`** (focus rows
excluded from the muted backdrop — see above); any **label** tied to the focus
also uses `highlight_dark`. Don't confuse this with `accent` (`#1A5A8E`), which is
for non-data UI chrome only.

### 3. Use the default palette by doing nothing

`gl_setup()` sets the default discrete colour and fill scales to the GL
6-color categorical palette. For most charts, you don't need any scale call
at all — just map to `color` or `fill`.

```r
# This just works — no scale_color_* needed
data |>
    ggplot(aes(x = year, y = exports, color = sector)) +
    geom_line()
```

The 6-color palette is deliberately small. If you have 7+ categories,
consider whether mute-then-highlight would tell the story better than seven
distinct colors.

#### Assign colors in order

When mapping categories to the categorical palette, always assign in order:
c_1 (blue) first, then c_2 (red), c_3 (teal), c_4 (purple), c_5 (orange),
c_6 (yellow). Never skip or reorder unless a category has an established
external convention (e.g., Atlas sector palettes).

#### Color count — warn at 5+

**If a user's chart requires more than 4 distinct categorical colors, surface
this warning before writing the chart code:**

> ⚠️ **Color count check:** You're about to use 5 or more distinct colors.
> Color should convey meaning, not sequence — adding a new color costs the
> reader attention every time. Before introducing a fifth color, consider:
>
> - **Mute the background, highlight the message.** Paint all
>   lower-priority series in `c_muted` grey and reserve a saturated hue
>   for the 1–2 series that carry the actual finding. This almost always
>   tells the story more clearly than five equal-weight colors.
> - **Group or consolidate categories** so fewer distinct colors suffice.
> - **Use tones of one hue** (light / main / dark of c_1, for example)
>   for categories that share a parent — the shared hue keeps them reading
>   as one total; lightness carries the split.
>
> If you've considered these alternatives and still need 5–6 colors, assign
> them in order and proceed. More than 6 distinct colors nearly always
> signals that a different chart type — small multiples, ranked bar,
> treemap — would communicate better than a rainbow legend.

**Untyped geoms default to muted, not a saturated color** — this is the
GL popout pattern: paint everyone in `c_muted` first (no aesthetic mapping
needed), then re-paint the focus series in `highlight` (or `lead_finding`
for stark emphasis). Authors opt *in* to color, never out of it.

```r
data |>
    ggplot(aes(x = country, y = value)) +
    geom_col() +                                  # all bars c_muted grey
    geom_col(data = \(d) filter(d, focus),
             fill = highlight)                    # focus bar main blue (#2F87C8)
```

After `gl_setup()` the relevant defaults are:

| Geom | Default |
|------|---------|
| `geom_line` / `geom_path` / `geom_step` | colour = `c_muted`, 2px — the muted backdrop of the pop-up pattern (Nil §11) |
| `geom_point` | **shape 21**, fill = `c_muted`, colour (stroke) = `c_muted_dark` 1px, 0.8 alpha, size 3 (Nil §5: 5–7px radius) — every point has a fill + a darker stroke |
| `geom_col` / `geom_bar` | fill = `c_muted`, **1px `paper` stroke** (gives the stacked-segment separation; invisible on a single bar) |
| `geom_area` | fill = `c_muted`, no stroke (stacked areas stay gapless) |
| `geom_smooth` | line `ink_4` (grammar §1: trendlines), ribbon `c_muted_light` |
| `geom_ribbon` | fill = `c_muted_light`, alpha 0.5 |
| `geom_boxplot` / `geom_violin` | **recede**: `c_muted_light` fill, `c_muted` outline — not a dark outline (Nil §11b) |
| `geom_sf` | 0.5px `ink_3` borders between regions (Nil §10) |
| `geom_hline` / `geom_vline` | dashed `ink_3` (reference **threshold** — a zero baseline is `gl_zero_line()`, see rule 12) |
| `geom_text` / `geom_label` | `ink_2`, sans family, size = `gl_text_size` (the 12px floor) |

Every muted mark shares `c_muted` so the backdrop reads as one recessive
layer, and any label tied to it takes `c_muted_dark` — never the same hex
as the mark. A **single-series** chart is a focus series with no backdrop:
opt into color explicitly with `geom_line(color = highlight)` (the main
blue — Nil's samples draw every line series in the main tone; `accent` is
never a data color).

### 4. Use `scale_color_gl()` / `scale_fill_gl()` for named palettes

When you need a specific named palette (e.g., Atlas HS sector colors), use:

```r
data |>
    ggplot(aes(x = year, y = rca, fill = sector)) +
    geom_col() +
    scale_fill_gl("hs_sectors")
```

Available palettes:

| Name | Colors | Use case |
|------|--------|----------|
| `"categorical"` | 6 | Default. General purpose. Used automatically. Main (fill) tones. |
| `"categorical_dark"` | 6 | Dark tones, same order — strokes + all text tied to a series (WCAG AA). |
| `"categorical_light"` | 6 | Light tones, same order — backgrounds, faded states, two/three-tone fills. |
| `"sequential_1"`..`"sequential_6"` | 5 each | Single-hue ramp low → high (one per c-N) |
| `"diverging_2_1"` | 6 | Red ↔ blue, midpoint-centered (default diverging) |
| `"diverging_3_1"` | 6 | Teal ↔ blue |
| `"diverging_5_1"` | 6 | Orange ↔ blue |
| `"diverging_6_1"` | 6 | Yellow ↔ blue |
| `"hs_sectors"` | 11 | Atlas HS product sectors (named) — external standard |
| `"sitc_sectors"` | 11 | Atlas SITC product sectors (named) — external standard |
| `"product_space"` | 8 | Product space clusters (named) — external standard |

The sector and product-space palettes are external Growth Lab standards
that coexist with the categorical grammar. Use them whenever the chart is
about that specific data taxonomy.

For named palettes, the values are matched by name — your data's factor
levels must match the palette names (e.g., "Agriculture", "Metals").

**Sequential vs. diverging:**

- Use **sequential** for any ordered encoding without a natural midpoint
  (population, GDP, complexity, count). Darker = higher.
- Use **diverging** *only* when the data has a real reference point — gains
  vs. losses, above vs. below baseline. Never on a purely positive scale.
- **When color encodes sign** (a gains/losses bar chart split at zero),
  every bar follows the sign encoding — color residual or "unspecified"
  buckets by their sign like any other bar. Pulling one bar out into
  `c_muted` reads as a third category and breaks the encoding.

For continuous data (e.g. choropleth fill), use `*_gl_gradient()`:

```r
states |>
    ggplot(aes(geometry = geom, fill = gdp_per_cap)) +
    geom_sf() +      # 0.5px ink_3 region borders come from the geom default
    scale_fill_gl_gradient("sequential_1")
```

**Diverging palettes center themselves on `midpoint = 0`.** The boundary
between the two hues must sit at the data's reference point (Nil decision
rule 9) — a plain `gradientn` would put it at the middle of the data *range*,
so on data from −5 to +20 the red/blue boundary would land at +7.5 and the
chart would lie. Pass `midpoint =` for a non-zero reference (e.g. a baseline
mean), or `midpoint = NA` to disable when binning by hand.

### 5. Save figures at named sizes

Always use `save_fig()` with a named size:

```r
save_fig("full", "exports-timeseries.png")
save_fig("full_tall", "faceted-sectors.png")
save_fig("half", "small-sidebar-chart.png")
```

| Size | Dimensions | Use |
|------|-----------|-----|
| `full` | 6.5 × 4.0" | Standard full-width chart |
| `full_tall` | 6.5 × 6.0" | Faceted or vertically stacked |
| `full_square` | 6.5 × 6.5" | Square charts (scatter, network) |
| `major` | 4.278 × 4.0" | 4-column chart alongside text |
| `half` | 3.167 × 3.0" | Side-by-side pair |
| `half_tall` | 3.167 × 5.0" | Tall narrow chart |
| `slide` | 10 × 5.625" | 16:9 slide deck (Marp, PowerPoint) |

Figures land in `imgs/` by default. To redirect a whole script, set
`options(gl.fig.dir = "path/to/dir")` once at the top (or pass `dir =` per
call) — do **not** redefine `save_fig()`, which silently loses the ragg
device and the tabular-figure rendering with it.

### 6. Log scale for GDP per capita

When GDP per capita is on the x-axis, always use `scale_x_log10()`.

### 7. Prefer tones of one hue; three tones, three jobs

**Whenever possible, limit the number of different colors and use different
tones of the same hue instead** (spec §7). When two or three categories share
a parent — goods vs. services, low/medium/high, primary/intermediate/final —
encode them with one hue's light/main(/dark) tones rather than reaching for
unrelated colors. The shared hue keeps the chart reading as one total; the
lightness step carries the split. Reach for the categorical palette only when
the categories are genuinely unrelated.

```r
# Two-tone stacked bars: one hue, main + light
ggplot(data, aes(x = year, y = share, fill = tier)) +
    geom_col() +
    scale_fill_manual(values = c(Goods = gl$c_1, Services = gl$c_1_light))
```

Each `c-N` hue has light / main / dark variants. They are not
interchangeable:

- **Main** (`gl$c_1`, `gl$c_2`, ...) — fills (bars, lines, treemap tiles,
  scatter circles, choropleth polygons).
- **Dark** (`gl$c_1_dark`, ...) — strokes on overlapping marks, and **every
  text element associated with the color**: direct labels, end-labels, legend
  marks, callouts, annotations. Required for WCAG AA contrast against paper.
  **Never use the main tone for text** — it fails contrast.
- **Light** (`gl$c_1_light`, ...) — backgrounds, faded states, the lighter
  end of a sequential ramp.

**This rule covers every color in the palette without exception — including
`c_muted`.** A muted line or bar uses `gl$c_muted` (#AFB5BE) for the mark;
its end-label, legend entry, and any annotation must use `gl$c_muted_dark`
(#5F6773). Using `c_muted` for the label text fails contrast against paper.

> **Quick test:** if a text element names or points to a colored mark, it
> must use the dark tone of that mark's color. No label ever shares the same
> hex as its associated fill or line.

The only place dark is used as a *fill* is the three-tone stacked area
(light / main / dark of one hue, when three bands belong to the same parent
variable).

### 8. Opacity on overlapping marks

When marks can overlap, set both fill and stroke opacity to 0.8 — overlapping
points then darken together rather than washing out.

The stroke must be the **dark** tone of the hue, the fill the **main** tone
(Decision Rule 2). With `shape = 21`, `fill` is the circle body and `color` is
the stroke — so pair a dark color scale with a main fill scale:

```r
ggplot(data, aes(x, y, color = group, fill = group)) +
    geom_point() +                        # shape 21, size 3, 1px stroke, 0.8 alpha — all defaults
    scale_fill_gl("categorical") +        # main tone — circle body
    scale_color_gl("categorical_dark")    # dark tone — stroke
```

For a single-focus scatter, draw the focus point **once at `alpha = 1`** (and keep
it out of the muted backdrop layer):
`geom_point(fill = gl$c_1, color = gl$c_1_dark, alpha = 1)`.
The 0.8 default opacity is for the overlapping *backdrop* cloud, not the highlight.

Single-layer marks (bars, treemap tiles, choropleths) stay at full opacity —
overlap isn't a risk and lowering opacity just dilutes the color.

Radar polygons are the exception: fill at 0.25 so gridlines and labels read
through the polygon.

### 9. Report vs slide mode

- **Report mode** (`gl_setup()` or `gl_setup(mode = "report")`): the chart's
  plot.title, plot.subtitle, and plot.caption are suppressed — the
  document handles the figure label, chart title, subtitle, and source via
  Word styles. Legend defaults to bottom-left.
- **Slide mode** (`gl_setup(mode = "slide")`): plot.title (Source Serif 4
  14pt), plot.subtitle (Inter 12pt), and plot.caption (Source Serif 4
  italic 12pt) all render inside the chart. Use for standalone charts or
  presentations.

**Pick the mode by destination, and only these two exist** (anything else —
"standalone", "print", … — errors). A chart headed into a GL document takes
report mode; the document supplies its caption block. A chart that is itself
the deliverable — a bare PNG someone asked for, a one-off shared image — takes
**slide mode**, so the title (ending in a period), subtitle, and source line
render in-chart. A report-mode PNG floating outside any document has no title
and no source anywhere, which the checklist treats as incomplete.

### 10. Stacked bars: 1px gap between segments

Spec §6 requires a **1px gap** separating each stacked-bar segment from the one
above — a clean boundary that also helps readers with low color discrimination.
The `geom_col`/`geom_bar` default now carries a 1px `paper` stroke, so plain
`geom_col()` already gives the gap; you don't add anything. Order categories
**largest mean share at the bottom**, upward.

Stacked **areas** are the exception — they sit edge-to-edge with no gap; the
color (or lightness, for the three-tone option) carries the separation.

**A marker on top of a stacked bar** (e.g. a net-total dot over saturated
segments) takes the **lightest muted tone with a white stroke** — the bar tones
are built to contrast strongly with white, so a pale dot ringed in `paper` reads
cleanly on top of them (a dark stroke would disappear into the dark segments).

```r
geom_point(aes(x = total), fill = gl$c_muted_light, color = gl$paper,
           size = 2.2, stroke = 0.7)
```

### 11. Chart text is 12px — the spec value and the floor

Nil §3 sets **every text element inside a chart at 12px** (only the chart
title is larger, at 14px). 12px is simultaneously the target and the floor:

- Axis tick labels and axis titles
- Direct series labels, callout annotations, and line-end labels
- Legend text
- Figure labels (eyebrows) and chart source lines

Never go below it, even when space is tight. If labels crowd at 12px,
reduce the number of ticks, abbreviate the label text, or resize the figure
— do not shrink the type.

**Units differ by layer — don't eyeball the numbers.** Report figures are
saved at physical size and placed 1:1 into the page, where CSS px is an
absolute unit (96px = 1in). The conversions:

| Spec (px) | Theme (`element_text`, pt = px × 0.75) | Geoms (`size`, = pt / 2.845) |
|-----------|------------------------------------------|-------------------------------|
| 12px chart text | 9pt — the report-mode `base_size` | `gl_text_size` (≈ 3.16) — the geom default |
| 14px chart title | 10.5pt (`rel(14/12)`) | — |

So in report mode everything is already right: `base_size = 9` and the
`geom_text`/`geom_label` default of `gl_text_size` both render exactly 12px
on the page. The failure mode is passing a hand-picked `size = 3` or
`size = 2.5` to a text geom (both below the floor) or overriding
`element_text(size = ...)` downward — don't. Pass `size = gl_text_size` when
a text layer needs an explicit size (e.g. `geom_text_repel`, whose defaults
the theme cannot reach).

Line widths follow the same discipline (`linewidth` × 2.845 = px): 1px
axis/gridline/baseline = `0.35`, 2px standard line = `0.70`, 2.4px focus =
`highlight_sz` (0.84).

**In D3 / SVG widgets**, `font-size` is in viewBox user units and scales
with the container. All chart text is 12px *at render size*, so:
`font-size = 12 × (viewBox_width / render_width_px)` — for a viewBox
rendered 1:1, that is simply `12` (see the GL constants block above).

### 12. Same geom, different jobs — pick by role, not by geom

The spec assigns different treatments to the *role* a mark plays, so the
same geom is styled differently by context. The defaults cover the most
common role; the others are one explicit call:

| Role | Treatment | How |
|------|-----------|-----|
| Reference **threshold** (a target, a safety line) | dashed 1px `ink_3` | `geom_hline(yintercept = 3)` — the default |
| **Zero baseline** (part of the frame of reference) | **solid** 1px `ink_2`, axis weight — never dashed, never gridline weight (Nil §4) | `gl_zero_line()` / `gl_zero_line("x")` |
| **Trend** (regression, smoother) | `ink_4` line, soft ribbon | `geom_smooth()` — the default |
| **Muted backdrop** (the "everyone else" of the pop-up) | `c_muted`, standard 2px | bare `geom_line()` / `geom_col()` / `geom_point()` — the default |
| **Single series** (no backdrop — the chart *is* the focus) | main blue, standard 2px | `geom_line(color = highlight)` |
| **Focus over a backdrop** | main blue (or red), 2.4px | `geom_line(color = highlight, linewidth = highlight_sz)` |

Two easy mistakes this table exists to prevent: a dashed zero baseline
(zero is frame, not annotation), and a backdrop painted with `accent` or a
dark tone (backdrops are `c_muted`; dark tones belong to strokes and text).

**No muted layer in the chart → no `highlight_sz`.** A lone series or
coequal multi-series lines take the standard 2px default — just
`geom_line(color = highlight)` or the palette mapping, no `linewidth`
argument. `highlight_sz` exists for exactly one job: lifting a focus line
1.2× above a muted backdrop. If nothing in the chart is muted, nothing is
"highlighted" either.

**Before saving, scan each axis for zero.** If 0 falls inside the plotted
range of a value axis — sparse negatives count — that axis needs
`gl_zero_line()`; the default gridline at 0 is too light to carry the frame.

### 13. Axis & title conventions

- **Year axis:** when the X axis is just years, **omit the axis label** — the
  tick labels already name the dimension. Use `labs(x = NULL)`.
- **Y-axis label is always rotated vertically** — `angle = 90` pointing upward,
  centered on the axis (`hjust = 0.5`). Never leave it horizontal. In ggplot2
  this is the default when you supply a `labs(y = "...")` label; do not
  override `axis.title.y` to flatten it. In D3/SVG, always apply
  `attr('transform', 'rotate(-90)')` with `attr('text-anchor', 'middle')` and
  position it clear of the widest tick label (at least 15pt offset from tick
  label start — see `axis.title.y = element_text(margin = margin(r = 15))` in
  `theme_gl`).
- **Chart title ends in a period** (slide mode, or the document in report mode)
  — it reads as a finding statement. The subtitle does **not** end in a period.
- **Gridlines default to horizontal (Y) only.** For horizontal-bar charts, flip
  to vertical so the reader can estimate bar lengths:
  `theme(panel.grid.major.x = element_line(color = gl$gridline, linewidth = 0.35), panel.grid.major.y = element_blank())`.
- **Prefer direct end labels over a legend** when the reader tracks 1–4 series
  (Nil §3, §11). Filter each series to its last point, then:

  ```r
  ends <- data |> group_by(series) |> filter(year == max(year)) |> ungroup()
  ... +
  gl_endlabel(data = ends, mapping = aes(x = year, y = value, label = series),
              color = ends$main_tone) +    # main tones in — dark tones drawn
  gl_endlabel_room()                       # clip off + right margin + no legend
  ```
- **Tabular figures — enabled.** The spec asks for
  `font-variant-numeric: tabular-nums` on all numerals (Decision Rule 11). Fonts
  are registered through `systemfonts` (not `showtext`), so every Inter family
  carries the `tnum` OpenType feature and all numerals — tick labels included —
  render at equal width. Charts must be rasterized through a systemfonts-aware
  device: `save_fig()` / `ggsave()` use ragg's `agg_png` by default when `ragg`
  is installed, and `gl_setup()` sets `dev = "ragg_png"` inside a knit.

### 14. Background distribution + highlighted country

When box plots (or violins) show the **background distribution** of a peer set
and a line shows one country relative to it, the box plots must **recede** —
they are context, not the subject. The `geom_boxplot` default does this for you
(soft `c_muted_light` fill, `c_muted` outline); draw the country as a
`highlight` line with a `fill = highlight, color = highlight_dark` point on top.

```r
data |>
    ggplot(aes(x = year, y = value, group = year)) +
    geom_boxplot(data = \(d) filter(d, iso %in% peers),     # muted grey, background
                 outlier.shape = NA) +
    geom_line(data = \(d) filter(d, iso == focus),          # main-blue line, pops
              aes(group = NA), color = highlight, linewidth = highlight_sz) +
    geom_point(data = \(d) filter(d, iso == focus),         # marker painted once, opaque
               aes(group = NA), fill = highlight, color = highlight_dark,
               alpha = 1, size = 2)
```

### 15. Choropleths and maps

- Region borders: **0.5px `ink_3`** between polygons (Nil §10) — this is the
  `geom_sf` default after `gl_setup()`, so plain `geom_sf()` is correct.
- Fill: `scale_fill_gl_gradient("sequential_1")` for ordered values (darker =
  higher); a `diverging_*` palette **only** when the data has a real midpoint —
  the scale centers itself on `midpoint = 0` (see rule 4). Never diverging on a
  purely positive scale.
- Match the ramp's step count to the data when binning: three steps for coarse
  signals, seven+ for fine gradients.

### 16. Radar charts and treemaps — no helper, follow the tokens

There is no `theme_gl` helper for these; when improvising (e.g. `ggradar`,
`treemapify`, or raw grid), apply Nil's values directly:

**Radar (Nil §9):** series polygon fill `gl$c_1` at **`alpha = 0.25`** (the
one place fills drop below 0.8 — gridlines must read through), stroke `gl$c_1`
full opacity 2px round join; vertex dots 3px `gl$c_1`, no stroke; grid rings
1px `gl$gridline` with the **outermost ring `gl$ink_3`**; axis lines 1px
`gl$ink_3`; axis labels Inter 12px / 500 / `ink_2` outside the ring; a second
entity is `gl$c_muted` at the same opacities, drawn *under* the focus.

**Treemap (Nil §8):** tiles in main tones at **full opacity**; labels Inter,
white on dark tiles with a dark-text fallback on light tiles, value + share
on a second line. For product-space / trade data use the sector palettes
(`scale_fill_gl("hs_sectors")`), otherwise categorical order. The pop-up
variant colors only the focus tile and leaves the rest `c_muted`. Strokes
depend on depth: a **flat single-level treemap has no stroke** (tiles abut
directly); a **two-level treemap** (products within sectors) takes thin
`gl$paper` separators between child tiles and a thicker `gl$paper` border
around each sector block so the hierarchy stays legible. In-tile labels that
don't fit at the 12px floor are **dropped, never shrunk** — with
`treemapify`, that means `min.size` stays at the floor (≈9pt), not below it.

## Complete example

```r
source(paste0(Sys.getenv("CLAUDE_PLUGIN_ROOT"), "/skills/gl-ggplot/assets/theme_gl.R"))
# ^ under the installed plugin. If CLAUDE_PLUGIN_ROOT is unset (symlink install),
#   use "~/.claude/skills/gl-ggplot/assets/theme_gl.R" — the repo root auto-detects either way.
gl_setup()

library(dplyr)

focus_country <- "Mongolia"

trade_data |>
    ggplot(aes(x = year, y = export_value, group = country)) +
    geom_line() +                            # muted backdrop — the default
    geom_line(data = \(d) filter(d, country == focus_country),
              color = highlight, linewidth = highlight_sz) +
    scale_y_continuous(labels = scales::dollar) +
    labs(x = NULL, y = "Export value")

save_fig("full", "mongolia-exports-vs-peers.png")
```

## Accessing raw palette vectors

If you need the color vectors directly:

```r
gl_palettes$categorical          # 6-color unnamed vector
gl_palettes$sequential_1         # 5-color blue ramp, low → high
gl_palettes$diverging_2_1        # 6-color red ↔ blue
gl_palettes$hs_sectors           # named: "Agriculture" = "#e5c21a", ...
gl$accent                        # "#1A5A8E"  (= gl$c_1_dark; UI chrome only)
gl$c_muted                       # "#AFB5BE"  (muted bars / "everyone else")
gl$c_muted_dark                  # "#5F6773"  (line/point strokes)
gl$c_1                           # "#2F87C8"  (main blue, = highlight)
gl$c_1_dark                      # "#1A5A8E"  (= highlight_dark — point strokes/labels)
gl$c_2                           # "#CC4948"  (main red, = lead_finding)
gl$ink                           # "#1A1714"
```

## Checklist before finalizing charts

- [ ] `gl_setup()` called at top of script
- [ ] Mode matches destination: `mode = "slide"` for a standalone PNG (title +
      source render in-chart); report mode only when a document supplies the
      caption block
- [ ] No per-chart theme overrides (except legend position)
- [ ] No monospace anywhere (no JetBrains Mono, no `font.family = "mono"`)
- [ ] Highlights use `highlight` (main blue) or `lead_finding` (main red), not `"red"`, `accent`, or arbitrary hex — fills/lines use the **main** tone
- [ ] Highlighted points use `fill = highlight` + `color = highlight_dark` (main fill, dark 1px stroke); their labels use `highlight_dark`
- [ ] Highlighted points are painted **once** at `alpha = 1` — focus rows excluded from the muted backdrop layer, never overpainted on top of a grey dot
- [ ] Points are shape-21 filled circles with a darker 1px stroke (the geom default)
- [ ] Highlights use mute-then-paint — supporting data is `c_muted`
- [ ] Colors assigned in order (c_1, c_2, c_3 …); no skipping or reordering
- [ ] 5+ distinct colors prompted a color-count check before proceeding; mute-then-highlight or grouping considered first
- [ ] Most charts use 2–4 colors; anything larger defaults to the muted base
- [ ] **Every label associated with a colored mark uses the dark tone of that color** —
      direct labels, end-labels, legend entries, callouts, annotations, all of them.
      `c_1` fill → `c_1_dark` label. `c_muted` fill/line → `c_muted_dark` label.
      No label ever shares the same hex as its associated mark's fill or line.
- [ ] Overlapping marks (scatter, radar) use 0.8 fill+stroke opacity
- [ ] Related categories use one hue's tones (two/three-tone) before reaching
      for multiple colors
- [ ] Stacked bars have the 1px paper gap (the `geom_col` default), ordered
      largest-share-at-bottom; stacked areas stay edge-to-edge — no white stroke
- [ ] Highlighted focus line is 1.2× the muted line (`highlight_sz` 0.84 vs 0.70), not a 2× jump
- [ ] `highlight_sz` appears **only** over a muted backdrop — lone or coequal
      series stay at the standard width (no `linewidth` argument)
- [ ] **Zero baselines use `gl_zero_line()`** — solid 1px ink_2, never the dashed
      threshold default, never gridline weight
- [ ] Sequential ramp for ordered values; diverging only with a real midpoint —
      and the diverging scale is centered (`midpoint =`, default 0)
- [ ] All in-chart text is 12px: theme sizes untouched, explicit text layers use
      `gl_text_size` — nothing smaller, no exceptions
- [ ] No non-token color literals — `gl$paper` not `"white"`, `gl$c_muted_light`
      not `"lightgrey"`, never `"red"`/`"blue"`
- [ ] Scatter points keep the default size 3 / 1px stroke (Nil §5: 5–7px radius)
- [ ] Choropleths: `geom_sf()` default 0.5px `ink_3` borders intact
- [ ] Y-axis label is rotated vertically (upward, centered) — never horizontal
- [ ] Year-only X axis omits its axis label (`labs(x = NULL)`)
- [ ] Chart title (slide mode) ends in a period; subtitle does not
- [ ] A source line exists — in-chart (slide mode) or in the document figure
      block (report mode); a standalone PNG with no source is incomplete
- [ ] Horizontal-bar charts flip gridlines to vertical (X)
- [ ] Figures saved with `save_fig()` at named sizes (`options(gl.fig.dir=)` to
      redirect — never redefine `save_fig`)
- [ ] GDP per capita axes use `scale_x_log10()`
- [ ] Legend fits without clipping (use `nrow = 2` or `position = "right"` if
      needed) — or better, direct end labels via `gl_endlabel()`
