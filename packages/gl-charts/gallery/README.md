# Gallery — gl-charts against the spec PDF

A visual regression harness pointed at the inspiration source. It rebuilds every
worked example in
[`assets/design-library/GL_data_visualization_spec.pdf`](../../../assets/design-library/GL_data_visualization_spec.pdf)
using nothing but `@growth-lab/gl-charts`, then puts the two side by side so the
distance between "what the spec shows" and "what the library produces" is a
picture instead of an opinion.

```bash
node packages/gl-charts/gallery/run.mjs     # all four steps
open packages/gl-charts/gallery/out/compare.html
```

Needs [poppler](https://poppler.freedesktop.org) (`brew install poppler`) for
`pdftotext`/`pdftoppm`, a local Chrome, and the GL fonts registered with the OS
(`bash scripts/install-fonts.sh`). Set `CHROME_PATH` if Chrome is somewhere
unusual.

---

## The four steps

| Step | Script | What it does |
|---|---|---|
| 1 | `plates.mjs` | Crops each figure block out of the PDF at 200dpi → `out/reference/` |
| 2 | `render.mjs` | Bundles the gallery, mounts it in Chrome, screenshots each plate at 2× → `out/generated/` |
| 3 | `audit.mjs` | Measures the rendered DOM against `tokens.ts` → `out/audit.json` |
| 4 | `compare.mjs` | Composes reference-vs-generated pairs → `out/pairs/`, plus `out/compare.html` |

`compare.html` is a viewing page, not a report: pairs only, no coverage tables,
no status badges, no gaps. The counts and the gaps print at the end of a run and
are carried in `catalog-meta.mjs` / `specimens-meta.mjs`, which is where they are
argued.

Each runs standalone (`node packages/gl-charts/gallery/plates.mjs`) when you only
need one of them. `run.mjs` exits non-zero if the audit found anything, so it can
gate a change.

### Two passes, because eyes are not a measuring instrument

The pairs catch what a person can see: a stack that doesn't stack, a label on top
of its own mark, the wrong tone at the bottom of a bar. `audit.mjs` catches what
they can't — a stroke that is 2.25px instead of 2, a tick label that rendered at
11px, a fill one hex off the palette, a bar extending 19px past the plot frame.
It reads the DOM of the same page `render.mjs` screenshots, against the same
token module the charts were built from, so the audit and the picture can never
disagree about what was rendered.

It also carries per-plate expectations that generic rules can't express — "this
stack must reach 100", "this axis must label 2003 and 2024". Those are how the
non-stacking bug was caught mechanically rather than by squinting at an axis.

### Why the crop box is computed, not hand-tuned

`plates.mjs` reads word positions out of the PDF with `pdftotext -bbox` and
derives each figure's box from its own text: top edge at the "FIGURE N" label,
bottom edge at the end of the italic source line, sides at the prose column. A
table of hand-measured rectangles would silently rot the first time the PDF is
re-exported. This doesn't — if a figure moves, the crop moves with it, and if a
figure disappears the run fails loudly.

### Why a real browser, not server-side SVG

TanStack sizes axis gutters from *measured* text. `renderChartSvg` in Node would
measure against a metrics stub and diverge from what a reader sees — in exactly
the dimension (axis geometry) the spec is fussiest about. Chrome with the real
Source Serif 4 and Inter installed is the only render that means anything.

### Why the plates are width-matched, not pixel-diffed

The reference is a 200dpi raster of a letter page; the generated plate is a 2×
browser screenshot of a 596px figure block. They will never share a pixel grid.
Scaling both to one column width keeps the comparison at the level where it is
actually valid — proportion, color, weight, spacing, type — instead of producing
a precise-looking pixel delta that means nothing.

---

## The rule the gallery keeps

**No plate may style a chart by hand.** No hex, no font size, no stroke width, no
opacity in `catalog.tsx`. If a figure cannot be reproduced from the library's own
library and its tokens, that is the finding — record it in the plate's `gaps` in
[`catalog-meta.mjs`](catalog-meta.mjs) and let the plate come out wrong.

`gallery.css` may only place a plate on paper and lay a legend beside a plot.
Anything in it that changes how a *mark* looks belongs in `src/theme.css`, or the
gallery is lying about what the library produces.

There is no longer a sanctioned exception. The treemap squarification the
gallery used to carry in `squarify.ts` now lives in `glTreemapChart`, which gets
it from `d3-hierarchy` — so every plate below is composed entirely out of the
library.

Two things a plate *may* do, and the line between them and styling:

- **Layout arithmetic.** A Marimekko's column boundaries, a beeswarm's dodge, a
  ridgeline's offsets. These decide *where* a mark goes and never what it looks
  like. Where the preparation is general enough to be reused it belongs in the
  library and the plate records a gap saying so — the hexbin lattice was on this
  list until a hand-rolled one disagreed with the mark drawing it, which is now
  `glHexbinLattice`.
- **Placement.** `gallery.css` may put panels in a grid — the marginal
  histograms and the projection gallery both need one. It may not change how a
  mark looks; the projection captions reference `tokens.css` custom properties
  rather than choosing a size or an ink.

Three unwrapped TanStack marks are used directly, and all three paint nothing:
`facet` (a layout), `stack`/`group` (layouts) and the transforms. A bare `dot()`
would breach the contract; `facet` cannot, because it has no fill, stroke or
opacity to get wrong.

## Files

| File | |
|---|---|
| `catalog-meta.mjs` | Which figures, which PDF page, coverage status, recorded gaps |
| `catalog.tsx` | The figures themselves, composed from the gl-charts core and shapes entries |
| `data.ts` | Datasets digitized off the PDF's own plots. **Not real data — do not cite** |
| `entry.tsx` | Browser entry; signals `data-gallery-ready` once fonts have painted |
| `gallery.css` | Plate chrome only |
| `audit.mjs` | Mechanical checks; per-plate expectations live in its `EXPECTATIONS` map |

### The specimen track

| File | |
|---|---|
| `tanstack-catalog.mjs` | The catalog roster (103), transcribed. The coverage denominator |
| `specimens-meta.mjs` | The 25 rule-first specimens, plus the merge and `RENDERABLE_SPECIMENS` |
| `tanstack-specimens-meta.mjs` | The 80 catalog-first specimens: rule, build, status, gaps |
| `specimens.tsx` | The 25 rule-first plates, and the renderer merge |
| `specimens-cartesian.tsx` | Trend, composition, bar, scatter, change, interval, survey |
| `specimens-distribution.tsx` | Boxplot, violin, ridgeline, beeswarm, facets, matrix, calendar |
| `specimens-radial.tsx` | Pie and donut variants, sunburst, radial bars, radar, treemap, tree |
| `specimens-geo.tsx` | Choropleths, bubble map, route, globe, projection gallery |
| `specimens-interaction.tsx` | The sixteen interaction entries, at rest |
| `specimens-network.tsx` | Sankey, force network, Delaunay, Voronoi, contours |
| `specimen-data.ts` | Datasets for the 25 |
| `tanstack-data.ts` | Datasets for the 80 |
| `tanstack-ref.mjs` | Screenshots each catalog embed into the left column (opt-in, needs network) |

Split by family rather than kept in one file because the families genuinely differ
in what they are testing, and each file's header says what its family is for. One
file holding a hundred plates would be unreadable and would hide that.

## Coverage status

`built` — reproduced from the library alone. `partial` — reproduced, but something
in it is hand-rolled here or renders off-spec. `missing` — the catalog has this
chart type and gl-charts cannot express it at all, so there is **no plate** and
the entry carries the reason instead. The counts print at the end of a run.

**Nothing is `missing` today.** Seven entries were — the Sankeys, the force
network, the triangulation and its Voronoi dual, the two contour forms — each
naming the d3 layout it was blocked on, until those four layouts were declared.
The status and its machinery stay, because that is what made them closeable: a
refusal that stays on the page with the blocker written down gets fixed, and one
dropped from the list does not.

`missing` is excluded from `RENDERABLE_SPECIMENS`, which is what `render.mjs` and
`audit.mjs` walk — otherwise a documented refusal would report as a "plate never
mounted" error. It has no plate to show, so it does not appear on the compare
page at all; `run.mjs` prints it.

Findings from a run get written up in [`reports/`](reports/). Coverage against the
catalog is measured in
[`reference/tanstack-example-coverage.md`](../reference/tanstack-example-coverage.md).
