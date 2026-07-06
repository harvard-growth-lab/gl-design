---
name: chart-audit
description: Audit ggplot2 charts against the Growth Lab design grammar. Use this skill after generating or modifying charts to flag visual issues — legend sizing, color misuse, dimension mismatches, highlight consistency, and readability problems. Includes a mechanical linter (scripts/gl_lint.R) to run before the judgment checks.
compatibility: Requires R script with ggplot2 charts and the GL design grammar (grammar.md + recipes/report.md).
metadata:
  author: taimur-shah
  version: "2.1"
---

# Chart Audit

Audit ggplot2 charts against the Growth Lab visual grammar. Run this after
generating or modifying charts to catch visual problems before they reach a
report.

## When to use

- After creating or editing charts in an R script
- Before converting a report to Word/PDF
- When reviewing an existing set of chart PNGs

## How to run

Two passes — mechanical first, judgment second:

1. **Run the linter**: `Rscript <kit>/skills/chart-audit/scripts/gl_lint.R script.R`.
   It deterministically catches non-token hexes and color literals, dashed
   zero baselines, sub-floor text sizes, hand-rolled gradients, theme resets,
   raw `ggsave`/`save_fig` redefinitions, stacked-area strokes, missing
   horizontal-bar gridline flips, and `accent`-as-data. Exit 1 = flags found
   (`file:line: [check-id] message`). It lints chart scripts, not
   `theme_gl.R` itself; line-based heuristics can miss multi-line calls, so
   a clean lint is necessary, not sufficient.
2. Read the R script that produces the charts
3. Read the rendered PNG images
4. Walk through every check below for each chart
5. Report a summary table: chart name, pass/flag, issue

## Audit checks

### 1. Legend placement

| Condition | Expected | Flag if |
|-----------|----------|---------|
| Report mode, ≤6 legend items | `legend.position = "bottom"` (theme default) | Legend is on the right, consuming plot width |
| Report mode, >6 legend items | Either `legend.position = "right"` (explicit) or mute-then-highlight pattern instead | Bottom legend wrapping to 3+ rows |
| Bottom legend with 4+ items | Items fit in 1–2 rows without clipping | Any label is truncated or runs off-edge |
| Any legend | Title is either `NULL`/`""` or a short Inter label | Long prose legend titles |
| Slide mode | Default ggplot position (right) is acceptable | — |

### 2. Highlight and the mute-then-paint pattern

| Condition | Expected | Flag if |
|-----------|----------|---------|
| Highlighted data points | Uses `highlight` (main blue `#2F87C8`, = `c_1`) for the default focus, or `lead_finding` (red `#CC4948`, = `c_2`) for stark emphasis | Uses `"red"`, `accent` as a data fill, or any old-palette / arbitrary hex |
| Highlighted point stroke / label | Point stroke = `highlight_dark` (`#1A5A8E`); any label/text tied to the series = its dark tone (`#1A5A8E` blue, `#8A2C2B` red) | Main tone used for the point stroke or for text tied to the series |
| Highlighted **points** painted once | Focus rows excluded from the muted backdrop layer; focus point drawn a single time at `alpha = 1` | Focus left in the `alpha`-0.8 backdrop and overpainted — the dot reads muddy / desaturated from the grey showing through |
| Highlighted lines / bars | Painted twice — non-focus in `c_muted` (`#AFB5BE`), focus on top in `highlight`/`lead_finding` (opaque geoms, so overlap is fine) | Single geom with conditional color, or no muted layer |
| Non-highlighted geoms (when a focus exists) | Painted in `c_muted` to recede | Gratuitously varied palette colors for "everyone else" |
| `accent` (`#1A5A8E`) usage | Non-data chrome only (figure labels, eyebrows, links) | Used as a data-mark fill — that's the typography↔data-viz mix-up |

### 3. Figure dimensions

| Condition | Expected | Flag if |
|-----------|----------|---------|
| `save_fig()` call present | Uses a named size from `gl_fig` | Raw `ggsave()` with arbitrary dimensions |
| Named size matches content | `full` (6.5×4.0) for standard charts, `full_tall` (6.5×6.0) for faceted/stacked, `half` (3.167×3.0) for side-by-side | Size doesn't match chart complexity |
| Faceted charts with ≥4 panels | `full_tall` or `full_square` | `full` — panels will be too compressed |

### 4. Color palette

| Condition | Expected | Flag if |
|-----------|----------|---------|
| Discrete color/fill scales | Uses `gl$palette` (set via `options()`) or `scale_*_gl()` with a framework palette | Default ggplot rainbow, or colors outside the framework palette |
| Categorical palette | 6 main tones: `#2F87C8 #CC4948 #2AA584 #7554A3 #EA822D #CDC86B` (blue, red, teal, purple, orange, yellow) | Unlisted hex values (except `c_muted` greys, the `*_dark` / `*_light` tones, `accent`) |
| Manual color values | Framework tokens (`gl$c_N`, `gl$c_N_dark`, `gl$c_muted`, `accent`) or the named ramps | Arbitrary hex colors not in the palette |
| Color literals | Tokens: `gl$paper`, `gl$c_muted_light`, `highlight` | `"white"`, `"lightgrey"`, `"red"`, `"grey50"` string literals |
| Diverging gradient | `scale_*_gl_gradient("diverging_*")` — hue boundary centered on the reference value (`midpoint`, default 0) | Hand-rolled `scale_fill_gradientn`/`gradient2`; or a diverging ramp whose boundary sits at the data-range middle instead of the midpoint |
| Charts with >4 series | Mute-then-highlight (most stays in `c_muted`) | All 6+ series at full-saturation palette colors |

### 5. Theme compliance

| Condition | Expected | Flag if |
|-----------|----------|---------|
| `theme_gl()` is set | `theme_set(theme_gl(mode = "report"))` at top of script | Missing, or using `theme_minimal()`, `theme_bw()`, etc. |
| Report mode | `plot.title`, `plot.subtitle`, `plot.caption` are blank | Title/subtitle/caption visible in rendered PNG |
| Per-chart theme overrides | Minimal — only `legend.position` or `strip.text` adjustments | Overriding fonts, font sizes, colors, or axis styling |

### 6. Typography (no monospace)

| Condition | Expected | Flag if |
|-----------|----------|---------|
| In-chart text family | Inter (sans) for axis, legend, strip; Source Serif 4 for chart title (slide mode only) | Any monospace font visible — JetBrains Mono, Courier, mono fallbacks |
| Numeric axis ticks | tabular-nums numerals via Inter | Variable-width digits causing column drift |
| Chart title (slide mode) | Source Serif 4 14pt weight bold; ends with a period (statement-of-finding) | Sans-serif title, or no terminal period when reading as a finding |
| Annotation text | Inter, regular, ink-2 | Italic emphasis on raw data points |
| In-chart text size | 12px everywhere (Nil §3): theme sizes untouched; explicit text layers at `gl_text_size` (≈3.16) | Any text geom with `size <` 3.16, or `element_text(size <` 9`)` |

### 7. Axis and scale conventions

| Condition | Expected | Flag if |
|-----------|----------|---------|
| GDP per capita on x-axis | `scale_x_log10()` | Linear scale for GDP per capita |
| Percentage y-axis | `labels = percent` or `percent_format()` | Raw decimal values (0.05 instead of 5%) |
| Year axis | Reasonable breaks (not every year) | Overlapping year labels |
| Year-only x-axis | **No axis title** — the tick labels already name the dimension (Nil §4) | A redundant `"Year"` axis title under year ticks |
| Zero baseline | `gl_zero_line()` — **solid** 1px `ink_2` at axis weight (Nil §4) | A dashed zero line (that default is for reference *thresholds*), or a zero line at gridline weight |
| Axis-title spacing | Title sits ~20px (≈15pt) off the tick labels — `theme_gl()` sets `axis.title.x = margin(t = 15)`, `axis.title.y = margin(r = 15)` | Per-chart override shrinking the gap, or a wide Y tick (e.g. "250") colliding with the rotated Y title |
| Tick-label spacing | Tick label sits 6px off the axis (3pt tick + 1.5pt gap = 4.5pt) — theme default | Per-chart override pulling tick labels onto the axis line |

### 8. Text and labels

| Condition | Expected | Flag if |
|-----------|----------|---------|
| Axis titles | Short, sentence case | Long prose axis titles |
| `labs()` in report mode | Title/caption omitted (or marker strings) | Actual title/caption text that will be suppressed anyway |
| Multi-series labeling | **Prefer direct line-end / series labels over a legend** (Nil §3, pop-up §11). Each series label uses the series' **dark tone** (`gl$c_N_dark`), Inter weight 600 | A legend used where 1–3 tracked series could be labeled directly at the line end; or series labels in the main tone instead of the dark tone |
| Direct labels (if used) | `geom_text_repel()` / `geom_label_repel()`; text in the series dark tone | `geom_text()` with overlapping labels, or label color = main tone / `"black"` |

### 9. Visual weight and readability

This check requires reading the rendered PNG:

| Condition | Expected | Flag if |
|-----------|----------|---------|
| Data-ink ratio | Chart area dominates; legends, axes, whitespace are secondary | Legend or axis labels take >30% of figure area |
| Highlight visibility | Focus series jumps out of the muted layer immediately | Focus and muted are similar weights / saturations |
| Overplotting | Points/lines are distinguishable | Dense scatter with no alpha, or many overlapping lines |
| Grid lines | Horizontal-only, `gridline` (`#D8D4CC`); no vertical or minor unless the chart is dense. **Horizontal-bar charts flip them**: vertical on, horizontal off | Heavy grid lines; both X and Y on a non-dense chart; horizontal gridlines running across horizontal bars (or none at all) |
| Stacked areas | Edge-to-edge, no stroke (Nil §6) | `geom_area(color = "white")` gap strokes |
| Scatter point size | Default size 3 ≈ 5–7px radius (Nil §5) | Tiny dots (e.g. ggplot's old 1.5 default) or unexplained bubble sizes |
| Map borders | `geom_sf` default: 0.5px `ink_3` between regions (Nil §10) | Heavy or colored polygon borders |

## Output format

After auditing, produce a summary:

```
## Chart Audit Results

| # | Chart | Status | Issues |
|---|-------|--------|--------|
| 1 | reserves-time-series | PASS | — |
| 2 | sbp-balance-sheet | FLAG | Legend clipped at right edge |
| 3 | exports-per-capita | PASS | — (right legend override OK for 11 sectors) |
...

### Flagged items

**sbp-balance-sheet** — Legend clipped at right edge
- Current: 4 long labels in single-row bottom legend
- Fix: Add `guides(color = guide_legend(nrow = 2))`
```
