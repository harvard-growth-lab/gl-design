# Stack comparison — R/ggplot vs Observable Plot — 2026-07-08

Test corpus: `complexity-explainer/report` (the 12-figure "Grammar of Economic
Complexity" primer). Both stacks rendered the **same 12 figures** and the **same
23-page report** through the identical md2pdf pipeline; only the embedded charts
differ (`gl-ggplot` PNG vs `gl-observable-plot` SVG).

**Result: R wins 11, Plot wins 0, 1 equivalent · mean fidelity 65.7/100 · 3 semantic bugs + 1 dropped legend in Plot.**

> **Update (same day) — fixes applied & re-verified.** The findings below drove
> changes to `gl-plot.ts` (theme defaults: strip axis-title arrows, `tickSize:0`,
> `glCell` abut, `GL_SIZE` presets), `SKILL.md` (per-chart conventions §9/§11), and
> a new reproducible render harness `report/charts/render_all_plot.mjs` (Node SSR
> — the ad-hoc SVGs were not reproducible before). A 12-agent re-audit against R
> scored the fixed charts: **mean fidelity 65.7 → 80.9**, head-to-head **R 8 /
> equivalent 4 / Plot 0**, **all 4 semantic/legend bugs resolved, 0 regressions**.
> Residuals flagged in re-scoring (heatmap band-scale gutters, ch1 below-CHN sort
> metric, two long-label margin clips) were then fixed in the harness. Visual
> before/after: the published Artifact.

## Method

- R charts: `report/charts/*.png` (existing `render_all.R` output).
- Plot charts: `report/charts/plot/*.svg`, rasterized to PNG via
  `chrome-headless-shell --force-device-scale-factor=2` with `gl-fonts.css`
  loaded (Inter confirmed resolving, no fallback).
- Two full PDFs built through `md2pdf` (R-PNG variant vs SVG variant, image
  paths swapped by `sed`), both **23 pages, pagination checked page-for-page**,
  rasterized at 110 dpi with `pdftoppm`.
- 19 agents (12 per-chart image audits + 6 page-range integration audits + 1
  synthesis), each judging against `grammar.md` as source of truth.
- Artifacts: `scratchpad/plot_png/`, `scratchpad/pdf_pages/{R,plot}/`,
  `scratchpad/report_{R,plot}.pdf`.

## Scorecard

| Chart | Type | Fidelity | Winner | Headline issue |
|---|---|--:|---|---|
| `ch1_trade_matrix` | Sequential heatmap | 55 | R | **Plot inverts country rank — CHN at BOTTOM** (semantic) |
| `ch1_cheese_exporters` | Ranked bar (highlight) | 80 | R | `→` axis-title arrow, dense every-1,000 gridlines, no zero baseline |
| `ch2_cheese_time` | Highlighted time series | 60 | R | `↑` top-left y-title + ~15 every-20 gridlines over-ink the panel |
| `ch3_diverse` | Ranked bar | 80 | R | Right-anchored `→` axis title; (R's gridlines are dashed) |
| `ch3_ubiquity` | Paired ranked bars | 57 | R | **Free per-facet x-scales collapse the rare-vs-ubiquitous contrast** (semantic) |
| `ch4_eci_rank` | Diverging sign bars | 67 | R | Clips "United Kingdom" label, `→` arrow, doubled gridline density |
| `ch4_scatter` | Continuous-color scatter | 52 | R | **Drops the ECI color legend — third variable undecodable** (semantic) |
| `ch5_prox_matrix` | Proximity heatmap | 72 | R | **Ascending-y mirrors the matrix** + white cell-inset gutters |
| `ch6_product_space` | Network / node map | 86 | equivalent | Abbreviates 3 legend labels — cosmetic |
| `ch6_eci_paths` | Two-series line | 67 | R | `↑` y-title, every-0.5 gridlines, main-tone (not dark) end labels |
| `ch7_nearby_distant` | Faceted ranked bars | 44 | R | **Inverts y-order, swaps facets, AND free x-scales** (semantic, worst) |
| `ch8_eci_coi` | Highlighted scatter | 68 | R | `↑`/`→` corner axis titles, every-0.5 gridlines |

## Semantic / data-integrity bugs (fix first — these change conclusions)

1. **`ch1_trade_matrix`** — Plot's ascending-y default puts **CHN (largest) at the bottom**, contradicting the caption. Fix: descending y-domain.
2. **`ch7_nearby_distant`** — triple corruption: y-order inverted, facets swapped (Nearby vs Distant), and independent per-facet x-domains, so distant bars no longer read as farther on a shared 0–1 scale. The figure's entire point is lost.
3. **`ch3_ubiquity`** — free per-facet x-scales; ~45-country bars stretch to look as long as ~108-country bars, collapsing the magnitude contrast.
4. **`ch4_scatter`** — points colored by ECI with **no legend at all**; the continuous third variable is undecodable.
5. **`ch5_prox_matrix`** — ascending-y mirrors the matrix vertically (value-preserving but reads upside-down vs convention). Correct anyway.

## Systematic Plot defaults fighting the grammar (breadth → leverage)

| Pattern | Charts | Fix class |
|---|--:|---|
| A. Arrowed/corner axis titles (`↑`/`→`) | 9 | **[theme]** strip arrow + center x; **[per-chart]** rotated y-title helper |
| B. Dense auto gridlines / tick labels (~2× grammar density) | ~6 | **[theme]** lower tick target |
| C. Default outward tick dashes (incl. on heatmaps) | ~7 | **[theme]** suppress on categorical/heatmap |
| D. Ascending-y categorical inversion | 3 | **[per-chart]** descending domain + house convention |
| E. Free/independent facet scales | 2 | **[per-chart]** pin shared domain |
| F. Cell insets / white gutters on heatmaps | 2 | **[theme]** `inset: 0`, no stroke |
| G. Bold facet-strip titles | 2 | **[theme]** strip weight Inter 400 |
| H. Aspect not snapped to named figure sizes | ~6 | **[theme]** ship `full`/`full_square` presets |

**Plot got RIGHT (don't regress):** continuous legends stayed continuous on both
heatmaps and the scatter ramp (no swatch discretization); avoided the top-axis
arrow on the two heatmaps and the network map; suppressed axes on the network map.

## Page / layout findings

- Pagination-aligned on 4 of 6 ranges. **Drift on pages 16 and 17**: Plot's
  taller product-space figure + 2-column legend push the trailing paragraph off
  the page. Root cause = figure geometry not locked to named sizes (pattern H) —
  fixing H fixes the drift.
- **Axis-title collisions (pages 05, 08, 10, 11):** right-anchored `→` title sits
  on the tick baseline and collides with the last tick.
- **Page 11:** scatter ships with no ECI legend (`ch4_scatter`).
- **Page 21:** Plot scatter frame ends short of the right margin (under-fills column).
- **R-side layout bugs (for balance):** R clips its shared x-axis title on page 09
  ("…exporting with F") and the "1.0(" tick at the right margin on page 19 — both
  margin/overflow issues to fix on the R side.

## Prioritized fixes for `gl-observable-plot`

**Tier 1 — correctness (changes conclusions):**
1. **[per-chart]** Descending domain on every ranked categorical axis — ship a `rankedY()` helper + convention. (ch1, ch5, ch7)
2. **[per-chart]** Pin one shared domain across facets. (ch3_ubiquity, ch7)
3. **[per-chart]** Require a legend for any color/size encoding — make "no legend" a lint failure. (ch4_scatter)

**Tier 2 — highest-breadth theme defaults:**
4. **[theme]** Strip axis-title arrows, center x-titles; add a rotated y-title helper. (9 charts)
5. **[theme]** Sparsen gridlines/ticks to grammar density (~4–6, not ~10–15). (~6 charts)
6. **[theme]** Lock named figure sizes (`full` 6.5×4, `full_square` 6.5×6.5). Also fixes page-16/17 drift + page-21 under-fill.

**Tier 3 — targeted:**
7. **[theme]** `inset: 0`, no stroke on heatmap cell marks. (ch5, ch1)
8. **[theme]** `glDot()` scatter mark: main fill + dark stroke, both 0.8 opacity. (ch4_scatter)
9. **[theme]** Facet-strip title weight → Inter 400 ink-3. (ch3_ubiquity, ch7)
10. **[theme]** Auto-size left margin to widest tick label. (ch4_eci_rank "nited Kingdom")
11. **[theme]** House tick-mark policy (suppress on categorical/heatmap).

**Tier 4 — polish:** full sector names in legends (ch6); dark-tone direct labels (ch6_eci_paths); clean rounded tick breaks 0/80/160 not 0/82/164 (ch1, ch4, ch6).

**Bottom line:** ~5 theme-default changes (#4–#9) + 3 per-chart conventions (#1–#3)
close the majority of the gap. Semantic bugs and the missing legend are
non-negotiable; the arrow-title + gridline defaults are the highest-breadth
polish; locking figure geometry simultaneously resolves the pagination drift.
Do those and the Observable stack should reach effective parity on this report.
