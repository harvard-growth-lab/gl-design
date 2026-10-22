# Running the whole TanStack catalog through the GL layer

**2026-08-07** · 118 plates rendered, audit clean, 103/103 catalog entries **built**.

The gallery's specimen track previously held 25 plates and claimed 23 of the
TanStack catalog's entries. This run took the denominator seriously: every example
TanStack publishes now has a rendered, audited plate on `compare.html`, beside its
own catalog embed.

```
Plates    11 built,  2 partial, 0 missing of 13   — diffed against the spec PDF
Specimens 64 built, 41 partial, 0 missing of 105  — held by the audit
Catalog   103 of 103 TanStack entries answered
```

It landed in two passes. The first reached 96 of 103 and recorded seven refusals,
each naming the d3 layout it was blocked on. The second took those four
dependencies and closed all seven — which is the argument for recording a refusal
on the page rather than dropping it from the list: they were closeable because
they were visible, with the exact blocker written down.

Coverage is written up in
[`reference/tanstack-example-coverage.md`](../../reference/tanstack-example-coverage.md).
This file records what the *run* found.

---

## 1. The denominator was wrong, by a third

Coverage had been measured against the 69 examples the pinned package's docs index.
The **published catalog has 102**, and the 36 the docs omit are not a random
sample — they are the pie variants, the entire interaction family, and the composed
and small-multiple charts. Measuring against the docs skipped precisely the
examples most likely to expose a rule `grammar.md` has not written.

Enumerating from the website instead would have been no better. The pinned docs
embed `118-token-usage-calendar`; the live catalog **404s** for it. Each source
loses examples the other has, so `catalogSlugs()` now unions both and
`gallery/tanstack-catalog.mjs` carries the roster as checked-in data with a
transcription date, so staleness is visible rather than assumed.

**103 entries. 0 unclaimed. 0 without a plate.**

---

## 2. Six library defects, five of them invisible to the tests

Running 80 new plates found more in the library than in the catalog. Every one is
fixed and gated; three were caught by `audit.mjs` measuring the rendered DOM
rather than by anyone looking at a picture.

1. **`glAxisYear` silently dropped a pinned `domain`** — it assembled its `scale`
   field by hand instead of routing through `continuousScale`. Exactly the defect
   the previous pass found on `glAxisPercent`, in a preset where it bites hardest:
   a year axis is where a chart routinely puts a 6px dot on its first and last
   datum, and there was no other way to ask for the room. *Caught by
   `mark-overflow` on the bump chart.*

2. **`facet` renders its shared axes outside `.ts-chart__axes`** — they land in
   `ts-chart__facet-axes`, inside the marks group, so every correction in
   `patch.css` missed them. And because a facet cell is narrower than TanStack's
   360px breakpoint, its tick labels arrived at **10px**, under the spec's floor.
   *Caught by `text-too-small` on both facet plates.*

3. **`facet` cell titles are hard-coded 11px / 600 / fill-opacity 0.78** with no
   option. Corrected in `patch.css`; new expiry test in `constraints.test.ts`
   names the rule to delete when TanStack grows the API.

4. **`glLabelInkOn` was private to the treemap.** The rule for a label sitting *on*
   a fill — follow the fill's luminance, because Decision Rule 6's dark tone is a
   rule about text on **paper**, and `c-1-dark` on `c-1` measures 2.5:1 — was
   locked in `shapes/treemap.ts`. A labelled heatmap cell asks the identical
   question. Now exported, which closes half of `spec-13-heatmap`'s recorded gap.
   *Found by writing `heatmap-labeled`.*

5. **`glBandX` promises something its mark cannot do.** Its doc comment says "a
   shaded vertical region spanning `x1`–`x2`"; `bandX` takes a single `x` on a
   *band* scale and shades one categorical slot. Recorded in the range specimens'
   gaps rather than fixed — the fix is a naming decision, not a code one.

6. **`GLLegendItem` cannot express a ramp step.** Its label always takes the item's
   *dark* tone, which is right for a series and wrong for a ramp bin. Two plates
   work around it; both record the gap.

---

## 3. Four d3 layouts, and the seven entries they closed

Every one of the seven refusals was blocked on the same kind of thing — **a
layout, never a paint decision**. §3.4.2 had already ruled that a network edge is
a connector; §12 had already ruled that a contour level walks a sequential ramp.
Only the geometry was missing, and TanStack ships none.

| Package | Closes | New surface |
|---|---|---|
| `d3-sankey` | `111-basic-sankey`, `111-sankey-flow` | `glSankeyChart`, `glSankeyLayout` |
| `d3-force` | `40-force-directed-network` | `glForceLayout` |
| `d3-delaunay` | `37-delaunay-network`, `65-voronoi-nearest-tooltip` | `glDelaunayEdges`, `glVoronoiCells` |
| `d3-contour` | `39-density-contours`, `38-contour-topography` | `glContourDensity`, `glContourGrid` |

They live behind the `/shapes` entry point, so a consumer who never draws a
network never pays for one. Two things needed real care:

- **Determinism.** A force simulation settles over animation frames and a chart
  definition is data, so `glForceLayout` runs `stop()` then a fixed tick count.
  Determinism is then *bought*: it pins starting positions on a circle so
  `d3-force`'s only use of `Math.random()` — `jiggle()`, which fires when two
  nodes coincide — never fires. Without that, a plate lands somewhere new on every
  render and every diff in this gallery becomes meaningless.
- **Contours have no mark to land on.** Marching squares emits rings with holes,
  and `geoShape` is the only polygon-capable mark in the stack — so a contour is
  GeoJSON drawn through `glGeoShape` with `geoIdentity`. Arguably the right model
  rather than a workaround: an iso-line and a coastline are the same object.

---

## 4. Four more families went from zero, none needing a dependency

- **Hierarchy (sunburst, nested donut, tidy tree).** `d3-hierarchy`'s `partition()`
  and `tree()` were already available — the treemap declares the dependency. What
  had been recorded as "the arcs compose but the layout does not ship" was one
  import away the whole time.
- **Small multiples.** `facet` paints nothing, so using it unwrapped does not
  breach the no-hand-styling contract. It cost the two typography fixes above.
- **Interaction (16 of 16).** See §5.
- **Geography.** The remaining five map entries needed no new marks, only a
  synthetic world and the discipline of fitting two layers to *one* geometry —
  `fit: 'data'` fits each mark to its own features, which is what makes a bubble
  layer drift off its basemap.

---

## 5. The interaction result is better than expected

Sixteen entries, and **not one needed a rule that did not already exist**:

| What the interaction draws | Rule that already covers it |
|---|---|
| Pointer, crosshair, playhead | §3.4.2 — a reference rule: `ink-3`, dashed, ignores `tone` |
| Brushed / retained / focus window | §3.9 — a band: light tone at full opacity |
| Selected mark | §3.1 — the pop-up effect |
| Drag handle | §3.4.2 — a data tick at 8px, twice the axis tick |

So the design language is not the gap; the **event plumbing** is, and TanStack
0.6.5 has none either (`constraints.test.ts` §10 fails the day `crosshair()` lands).

The one genuine hole is the **tooltip** — it needs a surface, a padding scale, a
type scale and a connector, and `grammar.md` has none of them. That is the largest
single thing this exercise found missing from the spec, and the sixteen
resting-state plates are what narrow it to that.

Two smaller unruled cases: a **baseline-free stack** (§3.5 assumes a baseline the
reader measures from) and a **second y axis** (choosing two ranges lets an author
manufacture any correlation they like).

---

## 6. Plates that were wrong before they were right

Worth recording, because the audit passed all three — they are the class of defect
only a picture catches.

- **The sunburst labelled its arcs in place** and "Minerals" ran across the ring
  boundary. Nothing in the library can measure whether a label fits a wedge, which
  is the plate's recorded gap; the fix was to put the labels in the gutter outside
  the outermost ring, reading outward, the way `glDonutChart` already does.
- **The Likert stack was inverted.** `offset: 'diverging'` lays each side out from
  the zero line in list order, so sorting by the signed rank put "Strongly
  disagree" *against* the baseline — the reader decodes intensity as decreasing
  outward, which is the opposite of what a Likert scale means.
- **Two legends did not match their charts.** Both spent a hue's light/main/dark
  against fills that came from a *ramp*. Defect #6 above.
- **The first Sankey clipped every source label.** Only the right-hand gutter was
  reserved, and the first column's labels read leftward.
- **The first force network was string, not clusters.** The synthetic communities
  were too sparse — a third of the within-community pairs were dropped, leaving
  paths. A force layout over paths finds nothing.
- **Two captions described data that was not there.** The topographic plate
  claimed "a ridge between the lows" over a field whose lows merged into one
  basin, and the density plate claimed the two regimes the hexbin found while its
  bandwidth smoothed them into a single mode. The first was fixed in the data; the
  second was fixed in the *caption*, and is now the more useful plate — a kernel
  estimate merging what a hexbin separates is exactly the pairing's point.

---

## 7. The second spec hole: §3.4.2 does not survive a ribbon

The Sankey found the one place in this repo where a downstream file knowingly
disagrees with `grammar.md`.

§3.4.2 lists "a Sankey link" among its CONNECTORS — series **dark** tone at line
weight. That was written for a dumbbell bar and a candlestick wick: marks two
pixels wide. A ribbon is the same geometry at forty, and the rule does not scale.
Overlapping dark ribbons at full opacity are unreadable and bury the node
rectangles they connect.

`glSankeyChart` uses the source node's **light** tone instead, following §3.3 and
mirroring §3.9's argument for bands. **The fix belongs upstream.** Until it lands,
`linkTone` takes the literal reading back and `ts-111-sankey-flow` draws it, so the
two sit side by side on the compare page and the case makes itself rather than
being asserted.

A smaller decision fell out of the same plate: a Sankey's columns default to **one
hue**, not one per column. They are stages of a process, not competing subjects,
and §3.1 asks the prior question — position and ribbon width carry the finding, so
colour has nothing to do.
