# Coverage against the TanStack Charts catalog

**Date:** 2026-08-07 · **TanStack pinned at:** 0.6.5 (exact) ·
**Sources:** <https://tanstack.com/charts/catalog> (102 examples, transcribed into
`gallery/tanstack-catalog.mjs`) unioned with the 67 slugs the pinned package's own
docs embed → **103 catalog entries**.

The goal this measures against: *`gl-charts` should be a nice abstraction over all of
TanStack Charts, not just over the eleven plates in the GL spec PDF.* The gallery's
plate track (`gallery/catalog-meta.mjs`) measures the opposite direction — how much of
the **PDF** the library reproduces (11/11, two partial). This document measures how much
of **TanStack** the library can dress on-spec.

---

## Headline

| Measure | Previous pass | Now |
|---|---|---|
| Catalog entries measured against | 69 (the docs' own index) | **103** |
| Entries with a rendered, audited plate | 25 | **103** |
| — of those, fully on-spec | 25 | **62** |
| — on-spec with a recorded shortfall | 0 | **41** |
| Entries with no plate | — | **0** |
| Audit findings across the rendered gallery | 0 | **0** (118 plates) |

**Every entry in the catalog now has a rendered, audited plate**, shown in
`gallery/out/compare.html` beside its own embed.

Seven of them were refusals until the four d3 layouts they were blocked on were
declared — the Sankeys, the force network, the Delaunay triangulation and its Voronoi
dual, and the two contour forms. That was a dependency decision rather than a design
one, and §4 records what it bought and what it cost. The `missing` status and the
machinery behind it stay, deliberately: they are what made those seven closeable, by
keeping them on the page with the exact blocker named instead of absent from the list.

### Why the denominator moved from 69 to 103

The old number came from the docs' example index. The **published catalog is a third
larger**, and the entries the docs omit are not a random third — they are the pie
variants, the whole interaction family, and the composed and small-multiple charts. So
measuring against 69 flattered the result and skipped precisely the examples most likely
to expose a rule `grammar.md` has not written.

`gallery/tanstack-catalog.mjs` now carries the roster as checked-in data, and
`catalogSlugs()` unions it with whatever the pinned docs embed. Both directions matter,
and the union caught one entry going each way: the live site lists 36 examples the 0.6.5
docs never document, and `118-token-usage-calendar` is embedded by
`heatmaps-and-densities.md` while the live site returns **404** for it. Enumerating from
either source alone loses examples.

---

## 1. Coverage by family

| Family | Built | Partial | Total |
|---|---:|---:|---:|
| Polar and Radar | **12** | 3 | 15 |
| Bars and Rankings | **10** | 1 | 11 |
| Lines and Areas | **7** | 0 | 7 |
| Maps and Spatial | **6** | 4 | 10 |
| Stacked and Composition | **5** | 3 | 8 |
| Scatterplots and Relationships | **5** | 2 | 7 |
| Distributions | **5** | 2 | 7 |
| Heatmaps and Densities | **4** | 2 | 6 |
| Intervals and Financial | **4** | 0 | 4 |
| Annotations and Overlays | **2** | 1 | 3 |
| Networks and Hierarchies | **2** | 4 | 6 |
| Facets and Multiple Views | 0 | 3 | 3 |
| Interactive | 0 | 16 | 16 |
| **Total** | **62** | **41** | **103** |

---

## 2. What moved, and what it cost

Five families went from zero or near-zero to covered. Four of them needed no new
dependency at all; the fifth is §4.

**Polar and Radar: 13 → 15.** The pie, labelled pie, rounded donut, nested donut,
sunburst, radial bars and arc gauge are all `glRadialArc` plus an angular layout. The two
hierarchical forms — nested donut and sunburst — used `d3-hierarchy`'s `partition()`,
which was already a declared dependency for the treemap. That is the whole reason they
moved from "the arcs compose but the layout does not ship" to built.

**Networks and Hierarchies: 0 → 6.** The tidy tree is `d3-hierarchy`'s `tree()` plus
`glLink`, `glPoint` and `glLabel`. §3.4.2 had already ruled that a tree edge is a
*connector* — dark tone, line weight, butt cap — so nothing about the drawing needed
deciding; only the layout was missing, and it was three lines from a dependency the
package already had. The other four (two Sankeys, the force network, the triangulation)
took three new ones — see §4.

**Facets and Multiple Views: 0 → 3.** `facet` is TanStack's own layout mark and it
*paints nothing*, so using it unwrapped does not breach the gallery's no-hand-styling
contract. It does carry typography, which is where it cost something — see §4.

**Interactive: 0 → 16.** Not a claim that the library does interaction. Every one of the
sixteen draws the chart's **resting state** on-spec plus the static half of the
interaction, and every one is recorded `partial` naming the same two shortfalls (§5). The
sixteenth is the Voronoi entry, which the triangulation closed: its cells exist to route
pointer events, and drawing them shows the hit-testing rather than describing it.
The useful result is what did *not* need inventing: a pointer or playhead is a reference
rule under §3.4.2, a brushed or retained window is a band under §3.9, and a selected mark
is the pop-up effect under §3.1. **No interaction plate needed a rule that did not
already exist** — what is missing is the event plumbing, not the design language.

---

## 3. Six defects the exercise surfaced

Running the whole catalog through the layer found more in the library than in the
catalog. All six are fixed and gated. (A seventh, in the brand-new Sankey, is §5 — the
first render clipped every source node's label because only the right-hand gutter was
reserved.)

1. **`glAxisYear` silently dropped a pinned `domain`.** It built its `scale` field by
   hand instead of routing through `continuousScale`, so a caller asking for endpoint
   padding got nothing and no warning — the identical defect to the dead `domain` key on
   `glAxisPercent` that the previous pass found. It matters most on exactly this preset:
   a year axis is where a chart routinely puts a 6px dot on its first and last datum.
   Caught by `mark-overflow` on the bump chart.

2. **`facet` renders its shared axes outside `.ts-chart__axes`.** A faceted chart puts
   its outer axes in `ts-chart__facet-axes` *inside the marks group*, so every correction
   in `patch.css` missed them — and because a facet cell is narrower than TanStack's
   360px breakpoint, its tick labels arrived at **10px**, under the spec's 12px floor.
   The selectors now name both groups. Caught by `text-too-small` on both facet plates.

3. **`facet` cell titles are hard-coded at 11px/600/fill-opacity 0.78** with no option.
   Corrected in `patch.css` with a new expiry test in `constraints.test.ts`.

4. **`glLabelInkOn` was private to the treemap.** The rule for a label sitting *on* a
   fill — follow the fill's luminance, because Decision Rule 6's dark tone is a rule
   about text on **paper** and `c-1-dark` on `c-1` measures 2.5:1 — was locked inside
   `shapes/treemap.ts`. A labelled heatmap cell asks the identical question. It now
   ships from `@growth-lab/gl-charts/shapes`, which closes half of `spec-13-heatmap`'s
   recorded gap.

5. **`glBandX`'s doc comment promises something its mark cannot do.** It says "a shaded
   vertical region spanning `x1`–`x2`"; `bandX` takes a single `x` on a *band* scale and
   shades one categorical slot. A span over a continuous axis has to be `glBand` (an area
   with two data-driven edges). Recorded in the range specimens' gaps rather than fixed,
   because the fix is a naming decision.

6. **`GLLegendItem` cannot express a ramp step.** Its label always takes the item's
   *dark* tone, which is right for a series and wrong for a ramp bin — a ramp step has no
   "dark tone" to reach for, the same reason `glGeoShape` strokes at `ink-3`. The waffle
   and Likert plates pass `{ light: fill, main: fill, dark: ink[2] }` to work around it;
   both record the gap.

---

## 4. The four layouts, and what taking them cost

The last seven entries were all blocked on the same kind of thing — **a layout, never a
paint decision.** §3.4.2 had already ruled that a network edge is a connector; §12 had
already ruled that a contour level walks a sequential ramp. Only the geometry was
missing, and TanStack ships no layout of any kind.

Four packages close all seven, declared and pinned exactly like `d3-hierarchy`:

| Package | Serves | New library surface |
|---|---|---|
| `d3-sankey` | `111-basic-sankey`, `111-sankey-flow` | `glSankeyChart`, `glSankeyLayout` |
| `d3-force` | `40-force-directed-network` | `glForceLayout` |
| `d3-delaunay` | `37-delaunay-network`, `65-voronoi-nearest-tooltip` | `glDelaunayEdges`, `glVoronoiCells` |
| `d3-contour` | `39-density-contours`, `38-contour-topography` | `glContourDensity`, `glContourGrid` |

They live in `src/shapes/network.ts` and `src/shapes/contour.ts`, behind the
`/shapes` entry point — so a consumer who never draws a network never pays for one.
`package.json`'s `comments.dependencies` carries the reasoning; `d3-geo` remains the
deliberate exception and stays **undeclared**, because a projection is an editorial
choice the caller makes.

**What is a preset and what is only data.** `glSankeyChart` is a whole chart, for the two
reasons the treemap is one: the layout runs at the resolved pixel size, and the paint
decision is not freely the caller's (§5). The other three return data, on the same
principle as `waterfall` and `linearFit` — how you draw a network is editorial, and
§3.4.2 already decides how each mark is painted.

### Two things that needed care

**The force layout had to be made deterministic.** A simulation settles over animation
frames, and a chart definition is data — nothing in the pipeline can await one. So
`glForceLayout` runs `stop()` then a fixed tick count, which is d3's own supported path.
Determinism is then bought rather than given: it pins starting positions on a circle so
that `d3-force`'s single use of `Math.random()` — `jiggle()`, which fires only when two
nodes coincide — never fires. Without that a plate would land somewhere new on every
render and every diff in the gallery would become meaningless. `tests/network.test.ts`
asserts two runs agree.

**Contours reach a chart the way a coastline does.** Marching squares emits rings with
holes, and `geoShape` is the only polygon-capable mark in the stack — so a contour is a
GeoJSON `MultiPolygon` drawn through `glGeoShape` with `geoIdentity`. Arguably the right
model rather than a workaround: an iso-line and a coastline are the same kind of object.
The cost is that a chart with no geography in it imports `d3-geo` at the call site.

---

## 5. The two holes this found in `grammar.md`

### §3.4.2's connector rule does not survive a ribbon

The one place in this repo where a downstream file knowingly disagrees with the spec, and
it was found by building the Sankey.

§3.4.2 lists "a Sankey link" among its CONNECTORS, which take the series **dark** tone at
line weight. That ruling was written for a dumbbell bar, a candlestick wick and a boxplot
whisker — marks two pixels wide. A ribbon is the same geometry at forty, and the rule does
not scale: overlapping dark ribbons at full opacity are unreadable and bury the node
rectangles they are supposed to connect.

`glSankeyChart` paints a ribbon in its source node's **light** tone instead, following
§3.3 (light already has the background job) and mirroring §3.9's argument for bands.
**The fix belongs upstream** — §3.4.2 should distinguish a hairline connector from a
ribbon. Until it does, `linkTone` takes the literal reading back, and
`ts-111-sankey-flow` draws it so the two can be compared rather than argued about. Put
the pair side by side on the compare page and the case makes itself.

A second, smaller decision fell out of the same plate: a Sankey's columns default to
**one hue**, not one per column. The columns are stages of a process, not competing
subjects, and §3.1 asks the prior question — the finding is carried by position and
ribbon width, so colour has nothing to do.

### Interaction is entirely unruled

**Interaction is entirely unruled.** No hover state, no tooltip surface or type scale, no
focus ring, no rule for what a selected mark looks like. Sixteen catalog entries — the
largest single category TanStack publishes — depend on it.

That is survivable today because TanStack 0.6.5 exports no interaction API either
(`constraints.test.ts` §10 fails the day `crosshair()` and `createChartCursor` land), so
there is nothing to dress. It stops being survivable the moment they ship. The fifteen
resting-state plates are the groundwork: they establish that the *marks* an interaction
draws are already covered, and narrow the open question to the one thing that genuinely
is not — **the tooltip**, which needs a surface, a padding scale, a type scale and a
connector, none of which exist anywhere in the spec.

Two smaller unruled cases turned up alongside it:

- **A baseline-free stack** (`21-streamgraph`). §3.5 assumes a baseline the reader
  measures from. A streamgraph gives that up deliberately, so every value is read as a
  thickness — the one visual comparison people are measurably bad at — and §3.5 has
  nothing to say for or against the trade.
- **A second y axis** (`70-composed-chart`). The plate rescales one series onto the
  other's axis and says so in the subtitle. A real dual axis needs a ruling first,
  because choosing two ranges lets an author manufacture any correlation they like.

---

## 6. Can the catalog be rendered automatically?

Asked directly in the previous pass, and the answer has not changed: **no**, and the
reasons are worth keeping.

**Rewriting an existing `ChartDefinition` — no.** A constructed mark is
`{ initialize: fn }` and nothing else; every option is captured in a closure with no
accessor. There is no definition to walk.

**Rewriting the rendered scene — possible, and wrong.** `initialize()` yields scene nodes
carrying `style.stroke` and friends, so a filter could re-paint them. It would be a
second implementation of the spec operating on output with no access to *semantics* — and
§3.4.2 is exactly a semantic distinction. A scene node cannot tell you whether a 2px line
is a series or a threshold, so the filter would get the chrome/data split wrong by
construction, and would look like it worked.

**Running the catalog sources — no.** They import an unpublished workspace package and
subpaths 0.6.5 does not export, and would render in their own hardcoded palette anyway.

**What is automatic: the reference column.** The embeds are public URLs and the slugs
enumerate offline, so `npm run gallery:tanstack` fetches all 103 and every specimen gets
the side-by-side treatment. 102 of 103 fetch; the 404 is documented above.

The 105 recipes stay hand-written, and that is the right answer rather than a concession:
a recipe is where the *judgment* lives. `popUp` picking two of five series to highlight,
a stem being data where a rule is chrome, four slices being the cap, a tidy tree having
no axis worth drawing while a "framed" scatter must keep its — none of that is derivable
from TanStack's version of the chart, because their chart answers to different rules.

---

## 7. Verification

Everything above is gated:

```
npm run check              # tokens ↔ grammar.md, typecheck, 139 tests
npm run gallery            # 13 plates + 105 specimens in Chrome, audited — 0 findings
npm run gallery:tanstack   # opt-in: 103 catalog references for the pair columns
npm run gallery:tanstack:audit   # prints anything the catalog has and the gallery does not
```

`gallery:tanstack:audit` is the standing to-do list and it currently prints **0
unclaimed**. It compares against the union of both sources, so it cannot go quiet by
losing entries from the denominator.

New this pass:

- `tests/network.test.ts` — 20 checks on the graph layouts. The load-bearing one is that
  two force runs agree; the rest guard ribbon widths summing to node throughput, edges
  being emitted once rather than once per incident triangle, and neither `d3-sankey` nor
  `d3-force` rewriting the caller's arrays (both mutate in place by default).
- `tests/contour.test.ts` — 11 checks, all of them about one bug: contours returned in
  grid space rather than data space. A half-cell error still draws, still looks like a
  contour, and sits quietly beside the points it claims to describe.
- `tests/constraints.test.ts` — a facet-cell-label expiry test, naming the `patch.css`
  rule to delete when TanStack stops hard-coding 11px.
- `gallery/tanstack-catalog.mjs` — the roster, with the transcription date recorded so
  staleness is visible rather than assumed.
- `gallery/audit.mjs` and `render.mjs` walk `RENDERABLE_SPECIMENS`. Nothing is `missing`
  today; the filter stays so the next unreachable entry is recorded rather than dropped.

The specimen track paid for itself again. The 80 new plates turned up the six library
defects in §3 — five of which are invisible to typechecking and to the value tests, and
three of which (`glAxisYear`'s dropped domain, the facet axis selectors, the 10px facet
tick labels) were caught by `audit.mjs` measuring the rendered DOM rather than by anyone
looking at a picture.
