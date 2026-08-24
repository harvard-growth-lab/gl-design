# gl-charts — proposed additions to `grammar.md`

**Status: PROPOSED. Nothing in this file has been ratified.** `grammar.md` remains
the source of truth and is unchanged by the PR that added this package.

## Why this file exists

Building a chart library for the browser meant drawing marks the grammar has never
had to name. `grammar.md` rules on scatter, line, bar, area, treemap, choropleth
and radar; it says nothing about a donut, a confidence band, a lollipop stem, a
leader line, or where a legend goes. Every one of those needed a rule before it
could be drawn, so the rules were written here — at implementation, against the
spec PDF's own plates — rather than guessed at each call site.

This file is the result: **the rules `gl-charts` actually implements, in the form
they would take if merged into `grammar.md`.** Section headings mirror the
destination (`§3.11 Legends` here would become `§3.11 Legends` there), so review
is a matter of reading the section and either accepting it into `grammar.md` or
sending it back.

The library's source cites these sections directly — `SPEC.md §3.11`, not
`grammar.md §3.11` — so no citation in the codebase claims authority the grammar
has not granted. When a section is ratified, the citation is a mechanical rename.

## How to read it

| Part | What it contains | What it needs from a reviewer |
|---|---|---|
| **A. Amendments** | Rules that **contradict** something `grammar.md` already says | A decision. The library currently departs from the grammar here, and one of the two has to move |
| **B. Additions** | Rules for cases `grammar.md` is **silent** on | Accept, revise, or reject. Nothing is being overturned |
| **C. Open questions** | Gaps the implementation surfaced but could **not** resolve | Judgment — several are Nil's call, not ours |

Part A is short and Part B is long, which is the honest shape of it: almost all of
this fills silence. Read Part A carefully and Part B at your leisure.

## If a section is accepted

Move it into `grammar.md` at the numbered position, then propagate downward per
the README's table — the R theme, the CSS recipes, the docx template, the Marp
theme — and re-point the citations in this package with a find-and-replace from
`SPEC.md §X` to `grammar.md §X`. Delete the section from this file: a ratified
rule must have exactly one home, and it is not this one.

---

# Part A — Amendments to existing `grammar.md` rules

Three places where the library does something `grammar.md` currently forbids or
contradicts. These are the ones that need a ruling.

## A1. Treemap separation — a gutter at every depth, not a stroke at one

**This one reverses a deliberate, recent decision and should not be accepted
quietly.** Commit `1b01f95` (7 Jul 2026) ruled explicitly on treemap strokes, and
`grammar.md` §3.4 carries that ruling today:

> **Two-level treemaps** (children nested in parent groups, e.g. products within
> sectors) are the exception to no-stroke: thin `paper` separators between child
> tiles and a thicker `paper` border around each parent block keep the hierarchy
> legible. Flat single-level treemaps abut directly. In-tile labels that do not
> fit at the 12px floor are dropped, never shrunk below it.

`gl-charts` does not do this. `src/shapes/treemap.ts` draws **no stroke at either
depth** and separates every tile with a paper gutter — 5px between siblings, 10px
between parent blocks — including in a flat single-level treemap, which the rule
above says should abut directly.

**The evidence for the change.** Both treemap plates in the spec PDF are flat
single-level treemaps, and both separate every tile with a uniform paper gutter.
Measured off 200 dpi crops (`gallery/out/reference/*.png`), scale calibrated on
the 1px axis rule in Figure 2, which renders as exactly 2 device px with no
antialiasing:

| Plate | Gutter, x | Gutter, y |
|---|---|---|
| Figure 4 (p.17), flat treemap | 10 device px = **4.8 px**, every seam | 10 device px = **4.8 px** |
| Figure 11 (p.24), pop-up treemap | 10 device px = **4.8 px** | 10 device px = **4.8 px** |

Figure 11 is the strongest case: its seven supporting tiles are all `c-muted`, so
the gutter is the only thing separating them. With tiles abutting directly they
read as one grey mass with no boundaries at all.

**The counter-argument**, which is why this is Part A and not Part B: the July
ruling was made deliberately and with its own reasoning, the measurement is of
two plates rather than a stated intent, and 4.8px → 5px is a rounding we chose.
A reviewer who accepts the plates as evidence should also decide whether the
two-level stroke survives as a *third* device alongside the two gutter widths.

**If rejected**, `treemap.ts` reverts to abutting flat tiles and paper strokes at
depth 2, `§3.4.1` below is dropped, and the pop-up treemap loses its tile
boundaries. **If accepted**, §3.4's table row and the paragraph above are replaced
by §3.4.1 below, and the R theme's `treemapify` guidance in
`skills/gl-ggplot/SKILL.md` changes with it.

## A2. §3.4 mark table — replacement rows

The existing table has one row covering three geoms:

> `| Bar / area / treemap | main, full opacity | none — tiles abut directly | Stacked: leave a 1px gap between segments |`

The library needs those three separated (they no longer share a separation rule,
per A1) and ten further rows for marks the table does not cover. The full
proposed replacement table is in Part B under §3.4. Only the `Bar / area /
treemap` row is a *change*; every other row is new.

## A3. Decision Rule 6 — text drawn on top of a fill

Rule 6 currently reads "Dark tone for strokes and text — **no exceptions**", and
names the dark tone for every label associated with a colored mark. That is
correct for text on paper and unreadable for text on the mark itself: `c-1-dark`
on a `c-1` tile is dark-on-dark.

The library therefore applies a lightness rule inside a fill (`glLabelInkOn`,
`src/shapes/treemap.ts`) and the dark tone everywhere else. Proposed amendment —
append to Rule 6:

> This governs text drawn **on paper**. Text drawn **on top of a fill** — a
> treemap tile label, a value inside a bar — takes `paper` or `ink` by the fill's
> lightness instead (§3.4.1); a dark tone on its own main tone is unreadable.

Note that the lightness rule as specified does **not** clear WCAG AA on two of
the six mains — see Part C, question 3, which is the open half of this amendment.

---

# Part B — Additions where `grammar.md` is silent

Nothing here overturns an existing rule. Each section is numbered for the
position it would take in `grammar.md`.

## §1 (addition) — One background, no dark mode

Every color in `grammar.md` §1 is specified against `paper` (`#FFFFFF`, or `cover-bg` on a
cover). There is no dark variant of this system and no `prefers-color-scheme`
swap in any medium, including the web and slide recipes: the outputs are printed
documents and artifacts that behave like printed documents, so a chart has one
background and every contrast ratio in this file is computed against it. A
second background would fork the ink ramp, both accent tints, and the
light/main/dark tone of all seven hues — and would do it to serve a viewing mode
the artifacts do not have.

If a downstream encoding needs an ink or gridline value, it takes `ink-2` and
`gridline` unconditionally. A conditional is a bug, not an enhancement.

> **Not to be confused with the dark *tone*.** `c-1-dark`, `c-muted-dark` and
> their siblings (§3.3) are the stroke-and-text half of the light/main/dark
> grammar. They are darker paint *on paper*, required for WCAG AA against white,
> and have nothing to do with a dark background.

## §3.4 (amended) — Fill, stroke, opacity

Replacement table. Only the `Bar / area / treemap` row is a change (see A1/A2);
every other row covers a mark the current table does not name.

| Geom                 | Fill                          | Stroke                                  | Notes                                  |
|----------------------|-------------------------------|-----------------------------------------|----------------------------------------|
| Scatter circle       | main, `fill-opacity: 0.8`     | dark, `stroke-opacity: 0.8`, 1px        | Same 0.8 so overlapping points darken together |
| Line                 | —                             | main, full opacity, 2px (2.4px focus)   | `stroke-linejoin: round`; solid only   |
| Bar / area           | main, full opacity            | none                                    | Stacked: leave a 1px gap between segments |
| Binned bar (histogram bin) | main, full opacity      | none — separation is a channel, not a stroke | **1px** `paper` channel between bins (§3.4.3) |
| Treemap tile         | main, full opacity            | none — separation is a gap, not a stroke | 5px `paper` gutter between tiles (§3.4.1) |
| Choropleth polygon   | sequential or diverging tone  | `ink-3`, 0.5px                          | Separates regions                      |
| Radar polygon        | main, `fill-opacity: 0.25`    | main, full opacity, 2px round join      | Lower fill so gridlines/labels read    |
| Heatmap / hexbin cell | sequential tone, full opacity | none — separation is the grid gap       | A tile, not a point: cells never overlap, so the 0.8 rule does not apply |
| Stem (lollipop, drop line) | —                       | main, full opacity, 2px                 | It **is** the series — same weight as a line |
| Connector (dumbbell, wick, whisker, link) | —      | dark, full opacity, 2px, butt cap       | Joins two marks of one series, so it takes the stroke tone (§3.3) |
| Data tick (error-bar cap, rug) | —               | dark, full opacity, 1px, 8px long       | Twice the axis tick, so it reads as data rather than chrome |
| Arrow (directed change) | —                          | main, full opacity, 2px, 8px head       | Head length fixed in px — it must not scale with the data |
| Vector (field)       | —                             | main, full opacity, 1px, 6px head       | A field is hundreds of marks: take chrome weight, or the plot fills in |
| Band (uncertainty, focus region) | **light**, full opacity | none                                 | The light tone is the spec's background job (§3.3) — never a translucent main |
| Reference rule (threshold, identity, target) | —    | `ink-3`, 1px, `4 3` dash                | Chrome, not data — see §3.4.2         |

The 0.8 rule is for overlapping marks. Single-layer marks (bars, treemap
tiles, choropleths, heatmap cells, hexbins) stay at full opacity — overlap
isn't a risk and lowering opacity just dilutes the color.

## §3.4.1 Treemap geometry

Treemap tiles are **separated by a paper gutter, not by a stroke** — at every
depth, including a flat single-level treemap. Without it a treemap of one hue
(the pop-up case, where every supporting tile is `c-muted`) reads as a single
grey mass with no tile boundaries at all.

| Part                          | Value                                                    |
|-------------------------------|----------------------------------------------------------|
| Gutter between sibling tiles  | **5px** `paper`, the same on both axes                    |
| Gutter between parent blocks  | **10px** `paper` — twice the sibling gutter, so depth reads |
| Outer edge of the plot        | flush — no gutter against the plot boundary               |
| Tile label padding            | **12px** from the tile's top and left                     |
| Label line 1 (name)           | Inter 12 / 600, baseline **24px** below the tile top       |
| Label line 2 (value · share)  | Inter 12 / 400, baseline **40px** — a 16px line step       |
| Label color                   | `paper`, or `ink` where the fill is light (see below)      |

**Label color follows the fill's lightness, not the palette.** Use `paper` on a
tile whose fill has relative luminance below **0.4**, and `ink` (`#1A1714`) at
or above it. That puts paper on `c-1` through `c-5` (the lightest of them,
`c-5` `#EA822D`, is L 0.34) and ink on `c-6` (`#CDC86B`, L 0.55), on `muted`
(`#AFB5BE`, L 0.46), on `muted-light`, and on every `light` tone — the tiles
where paper text falls under 2.5:1.

**Tiles too small for the full label shorten it before dropping it.** Try, in
order: `USD 6.2B · 38%` → `6.2B · 38%` → `6.2B` → no label. Type never shrinks
below the 12px floor, and a label that still does not fit inside its padding at
12px is dropped rather than clipped or spilled over the neighbouring tile.

**Squarify in plot space, not unit space.** The layout has to be computed
against the plot's real pixel width and height. Squarifying in the unit square
and then scaling the result stretches every tile by the plot's aspect ratio,
which is the one thing the algorithm exists to prevent.

## §3.4.2 Chrome marks and data marks

The same geometry does two different jobs, and the job — not the shape —
decides the color. A horizontal line across a plot is a **reference rule** when
it marks a threshold the analyst brought to the chart, and a **stem** when it
is the chart's own encoding of a value. They must not look alike:

| | Encodes a value? | Color | Weight | Dash |
|---|---|---|---|---|
| **Chrome** — reference rule, target line, identity line, gridline, axis | no | `ink-3` (`ink-2` at axis weight for a zero baseline) | 1px | dashed |
| **Data** — stem, connector, tick, arrow, vector, band | yes | the series tone, per §3.3 | 2px (1px for ticks and vectors) | solid |

Two consequences worth stating, because both are easy to get wrong:

- **A reference rule never takes a categorical hue.** Painting a threshold in
  `c-1` spends the institutional blue on something that is not a finding, and
  the reader then has to work out that one blue line means something different
  from the other blue line.
- **Solid is reserved for measurement.** §3.4 already says data lines are solid
  only. The two things allowed to be dashed are chrome (above) and a projected
  or forecast continuation of a real series — in that second case the dash
  keeps the series' own tone, because it is still that series.

## §3.4.3 Binned bar geometry

A histogram in one hue with nothing between its bins reads as a single blue
mass — the same failure §3.4.1 names for a one-hue treemap. Bins therefore take
a separator, on the same principle as the stacked bar's 1px gap and the
treemap's 5px gutter: **one hue abutting itself needs a paper channel.**

| Part | Value |
|------|-------|
| Channel between adjacent bins | **1px** `paper` |
| How it is cut | a **0.5px inset per side**, trimming width only |
| Outer edge of the first and last bin | flush — no inset against the plot boundary |

Two things this is deliberately *not*:

- **Not band padding.** §3.5 keeps a binned axis at zero padding, and that rule
  is untouched. Zero governs the *scale*: the band still spans the full bin, so
  bin width stays proportional to bin extent. The channel is chrome laid over
  the boundary, and it is a **fixed 1px at any bin count** — a proportional gap
  would widen as the bin count fell, and the reader would see the separator
  grow while the data said nothing.
- **Not a stroke.** A centred `paper` stroke — the device the stacked bar uses —
  also runs along the top of the rect, and would erase the 1–2px bars in the
  tail of a skewed distribution. That tail is the finding in most economic
  distributions, so the separator must trim width and never height.

The same channel applies to a horizontal binned bar, where "width" is the
bar's extent along the binned axis.

**Where the medium cannot inset**, the 1px `paper` stroke is the accepted
fallback and no other value changes: `geom_histogram` inherits the
`geom_col`/`geom_bar` default the R theme already sets, so a ggplot histogram
comes out with the channel and needs nothing added. Accept the stroke's cost —
it trims the bar's top edge — rather than widening the channel to compensate.

## §3.5 (additions) — Axes, ticks, gridlines

Two bullets to add to the existing list; nothing in it changes.

- **Categorical band padding**: **0.28** between bars, so a ranked list reads
  as discrete items. **0.2** on a point scale, where the marks are lines or
  dots over discrete categories and the padding only keeps the end marks off
  the axis. **Zero** for a binned axis — a histogram, a matrix heatmap, a
  calendar, a Marimekko. Bins are a partition of a continuum and must abut; a
  gap there invents a discreteness the data does not have. This governs the
  *scale*, so the band always spans the full bin. Bins are still separated —
  by the fixed 1px `paper` channel of §3.4.3, which is chrome over the
  boundary and does not scale with the bin count
- **Date axis**: label the endpoints of the span, as with years, and let the
  span pick the unit — years above ~5 years, `Mon YYYY` above ~6 months,
  `D Mon` below that. Never repeat the year on every tick when one span-level
  label will do, and never mix units on one axis

## §3.8 Radial and polar charts

Radial encodings trade positional accuracy for a shape the reader recognises.
That trade is worth making when the dimension really is cyclic or the profile
matters more than any single value, and not otherwise.

| Form | Use it | Because |
|---|---|---|
| **Radar** | 4–8 normalised dimensions, ≤3 series | The polygon *shape* is the finding; already specified in §3.4 |
| **Polar line / polar scatter** | a genuinely cyclic domain — hour of day, day of year, compass bearing | Wrapping is the point: December sits next to January, which no Cartesian axis can do |
| **Donut** | one part-to-whole split, ≤4 slices, directly labelled | At four slices the angle comparison is still safe, and the hole holds the total |
| **Pie** | prefer a donut | The hole costs nothing and gives the total a home; a full pie only earns its place when the total has nowhere else to go |
| **Rose / radial bar** | cyclic magnitude (wind by bearing, births by month) | Same justification as the polar line |
| **Gauge** | a single value against a known range | One number; the arc carries the range |
| **Sunburst** | prefer a treemap | Outer rings inflate with radius, so equal areas read as unequal. A treemap encodes the same hierarchy in honest area |

**Above four slices, stop.** A donut or pie with five or more parts is a ranked
bar chart drawn badly: keep the slices the reader needs to track and collapse
the tail into a single `c-muted` "Everything else" slice — §3.1's highlight-by-
muting, applied to a radial form — or switch form. Radial charts are also where
the palette runs out fastest; Decision Rule 5 still caps you at what the reader
can hold.

Geometry, following §3.4 and §3.5:

| Part | Value |
|---|---|
| Arc fill | main, full opacity — arcs are single-layer, like bars |
| Arc separation | **1px** `paper` pad angle, matching the stacked-bar gap |
| Donut hole | **0.6 × outer radius** — enough to read a centred total at 12px |
| Radial / angle grid | 1px `gridline`, as §3.5 |
| Radial polygon guide | `polygon` shape for radar, `circle` for polar and rose |
| Slice label | direct, in the slice's **dark** tone (§3.3), never a legend |

## §3.9 Intervals, uncertainty, and error

An interval is a *qualification* of a value, so it must sit behind and below
the value it qualifies — never compete with it:

- **Band / ribbon** (confidence interval, percentile fan, Bollinger): the
  **light** tone of the series it belongs to, full opacity, no stroke, drawn
  before the line. §3.3 already assigns light tone to backgrounds; an interval
  is the background of its own series. Do not reach for a translucent main
  tone — it produces a different colour over every mark it crosses
- **Error bar**: a connector in the series' dark tone with 8px caps (§3.4)
- **Nested intervals** (50% and 90% fans): confidence level is an *ordered*
  variable, so it takes the **sequential ramp of the series' own hue**, palest
  outermost. Two levels on `c-1` are `sequential-1` steps 2 and 3
  (`#B5D5EA`, `#6FA5CE`) under a `c-1` line — which is step 4, so the line still
  reads over both. Never a second hue: that claims a second subject. Never the
  same tone twice either — at the full opacity §3.4 requires, two identical
  fills are one fill, and the inner interval disappears
- **Never encode uncertainty with opacity alone.** It disappears in print and
  in greyscale, and readers cannot compare two opacities

## §3.10 Derived series — averages, fits, projections

A derived series (rolling mean, regression fit, forecast) is drawn *from* a
real series and must stay visually subordinate to it:

- Keep the **parent series' hue**. A moving average of the `c-1` line is
  `c-1`, not `c-2` — a new hue claims a new subject
- Distinguish by **weight and dash**, not colour: the raw series at 2px solid,
  the derived series at 2px dashed, or the raw series muted to `c-muted` and
  the derived one at full `c-1` when the trend *is* the finding
- A **fit line** is chrome when it is a reference (an identity or 45° line —
  §3.4.2) and data when it is an estimate the chart is about
- **Label what it is.** "3-yr moving average" belongs on the line, directly,
  or the reader is entitled to read it as a second measurement

## §3.11 Legends

A legend is the fallback, not the default. §3.4 and §3.8 both prefer a direct
label — at a line's end, inside a treemap tile, beside a slice — because a
direct label costs the reader nothing and a legend costs them a lookup on every
mark. Reach for one only when the marks genuinely cannot carry their own names:
a stack whose bands are too thin to label, a scatter coloured by group, a
choropleth's bins.

### The legend mark is a miniature of the mark it names

This is the part that goes wrong most often. A legend entry is not a colour
swatch — it is a **small drawing of the thing it stands for**, in the same
tone, stroke, and weight the plot uses. A 10×10 filled square standing for a
2px line tells the reader the series is an area; a square standing for a
scatter dot loses the stroke that §3.4 requires on overlapping circles.

| The series is…                                            | Its legend mark is…                                                                 |
|-----------------------------------------------------------|--------------------------------------------------------------------------------------|
| Bar, stacked band, area, treemap tile, choropleth bin, arc | **10×10 square**, main tone, full opacity, no stroke                                   |
| Scatter point or bubble                                    | **10px circle**, main fill + 1px dark stroke at 0.8 opacity — the scatter circle of §3.4 |
| Line                                                       | **16×2px rule**, main tone, round cap. **2.4px** when that series is the focus series (§3.4) |
| Derived series — moving average, fit, forecast (§3.10)     | the same rule, **dashed**, in the parent series' tone                                  |
| Band, interval, fan (§3.9)                                 | **10×10 square**, light tone, full opacity, **no stroke** — as §3.4 draws a band        |
| Radar polygon (§3.4)                                       | **10×10 square**, main tone at `0.25` under a full-opacity main stroke — the polygon has both |
| Reference rule, threshold, target (§3.4.2)                 | **16×1px dashed rule in `ink-3`**, label in `ink-2` — chrome takes no categorical hue   |

Where one series is drawn as more than one mark — a line with point markers, a
band under its line — the legend mark carries both, drawn the same way: the dot
centred on the rule.

The **label** is unchanged by any of this: Inter 12 / 600 in the series' **dark**
tone (§3.3, Decision Rule 6), 7px after the mark.

### Placement

One convention, one exception:

- **Default — below the plot, flush left, in one horizontal row**, in the order
  the reader meets the series left to right. Below, because a legend above the
  plot sits between the subtitle and the data and reads as part of the
  sentence. Flush left, because every other element of the figure block is —
  the figure label, the title, the subtitle and the source all start on the
  same line, and the legend belongs to that block rather than to the plot. A
  centred legend is the only thing in the figure not on that edge, and it reads
  as floating.
- **Right of the plot, stacked vertically, when the series are stacked bands**
  — a stacked bar or area. The legend then runs **top to bottom in the stack's
  own order**, so a reader maps row to band by position and never has to count.
  A radial chart that cannot take direct slice labels uses this position too.

Never above the plot. Never split across two places in one figure. If the
entries do not fit on one row below the plot, the chart has too many series
(Decision Rule 5), not a legend problem.

### Order and content

Legend order follows the data, never the alphabet: stack order for a stack,
descending magnitude for a ranked scatter, scale order (worst → best) for a
Likert or any ordered encoding. A muted "everything else" entry always goes
last. Entries a reader cannot act on — a residual bucket that is already
labelled in the subtitle, a single-series legend on a chart with a title that
names the series — should be dropped rather than listed.

A **binned or continuous encoding takes a stepped ramp, not a set of swatches**:
one bar of the sequential ramp's steps (§1) with the bin boundaries printed
beneath it — the form a choropleth's key already takes. That applies to a
heatmap and a hexbin as much as to a map — the mark is a bin either way.

## §3.12 Annotations and callouts

An annotation names a mark. It therefore has to be **near that mark and off
it** — the two constraints that produce every mistake in this category when one
of them is dropped.

- **Clearance.** An annotation clears the edge of the mark it names by **8px**,
  measured from the mark's real rendered edge — a bubble's radius, a bar's cap,
  an arrowhead's tip. A fixed offset that ignores the mark's size is what puts a
  label inside a bubble the moment the radius becomes a size channel.
- **Side.** Place it on the side of the mark with open plot space, preferring
  above-right. Never place it where it crosses the mark it names, another
  series, an axis, or a tick label — an annotation that has run outside the plot
  frame has been placed on the wrong side.
- **Direction follows the mark.** A label on an arrow, a slope, or any mark that
  points goes at the *pointing* end and continues in that direction: a leftward
  arrow takes a label to its left, end-anchored. Anchoring every label the same
  way puts half of them back over their own marks.
- **Leaders when there is no room.** When no side is clear within 8px, keep the
  annotation in the nearest open space and connect it with a **leader**: 1px in
  the mark's dark tone, from the mark's edge to the text's edge, no arrowhead.
  A leader is preferable to a label that has been shoved somewhere ambiguous —
  but two leaders crossing means the chart needed direct labels or fewer marks.
- **Never larger than what it labels, when it sits inside it.** Text placed
  *within* an element — a treemap tile, a bar, an arc — must fit inside that
  element's padding at the 12px floor (§3.4.1's ladder: shorten, then move out,
  then drop). Text wider or taller than its element does not shrink to fit; it
  moves outside with a leader, or it goes.
- **Halo.** Any annotation over data carries the thin `paper` halo of §3.5. The
  halo is for legibility, not for licence to overlap.
- **Type.** Inter 12 / 400 in `ink-2` for an annotation about the chart; Inter
  12 / 600 in the series' **dark** tone when it names a specific series (§3.3).
  Sparingly — three annotations on one plot is a chart that should have been
  two.

## §4 (additions) — Decision Rules 11 and 12

11. **A legend mark is a miniature of the mark it names.** A line gets a rule,
    a scatter gets a stroked dot, a band gets a light square with a dark
    stroke, a bar gets a filled square (§3.11). One square for everything
    tells the reader the wrong geom. The legend goes **below the plot, flush
    left** with the rest of the figure block — or right of it, vertically, when
    the series are stacked bands. Never above the plot.

12. **An annotation never covers what it names.** 8px clear of the mark's real
    edge, on the side with open space, following the direction of anything
    that points (§3.12). Text that will not fit inside an element moves
    outside it with a leader rather than shrinking or overlapping.

---

# Part C — Open questions the implementation surfaced

Seven things the library ran into and could not settle on its own. None is
blocking; all are recorded so the next person meets a question rather than a gap.

## C1. Zero baseline — is the rule about the *value* or the *reference*?

`grammar.md` §3.5 says, without qualification:

> **Zero baseline**: render with axis weight, not gridline weight

`gl-charts` applies that **only when the caller opts in**
(`glChartProps({ zeroBaseline: true })`), which is a departure from the literal
rule and therefore, by the repo's own convention, a bug in the downstream file
until `grammar.md` is amended.

**Why the departure.** The rule reads as being about a chart whose marks grow
*from* zero — gains and losses, where zero is the reference the reader measures
against. Applied to every axis that merely *contains* zero it misfires: the
Economic Complexity Index scatter (spec p.12, p.23) crosses zero without zero
meaning anything, and promoting that gridline paints a heavy dark rule across
mid-plot that reads as a second x axis. The spec's own plates for those two
figures keep it pale — the PDF does not follow the literal rule either.

**Proposed amendment**, narrowing the rule to the case it was written for:

> **Zero baseline**: where zero is the reference the reader measures from
> (gains vs. losses, change vs. baseline), render with axis weight rather than
> gridline weight. An axis that merely spans zero — an index, a z-score — keeps
> the ordinary gridline.

**If accepted**, this propagates to `recipes/`, the R theme's zero-baseline
handling, and the audit expectation in `skills/chart-audit`. **If rejected**,
`theme.css` reverts to promoting unconditionally and the two scatter plates get
the dark mid-plot rule. Either way the current split has to close.

Surfaced by `gallery/` — see `gallery/reports/2026-08-06.md`.

## C2. Treemap separation

Promoted to **Part A, question A1** — it contradicts a standing rule rather than
filling a gap, so it needs a decision rather than a note.

## C3. Paper tile labels miss WCAG AA on three of the six mains

The open half of amendment A3. At the 12px/600 the spec pins for in-tile labels —
*not* WCAG "large text", which starts at 18.66px bold, so the bar is 4.5:1 and
not 3:1 — `paper` does not clear AA on three mains:

| Fill  | on `paper` | on `ink` | A3 picks | clears AA? |
|-------|-----------:|---------:|----------|------------|
| `c-1` |       3.87 |     4.61 | paper    | **no**     |
| `c-2` |       4.55 |     3.92 | paper    | yes        |
| `c-3` |       3.08 |     5.79 | paper    | **no**     |
| `c-4` |       5.91 |     3.02 | paper    | yes        |
| `c-5` |       2.72 |     6.57 | paper    | **no**     |
| `c-6` |       1.74 |    10.26 | ink      | yes        |
| `muted` |     2.06 |     8.65 | ink      | yes        |

Picking the higher ratio per fill would clear 4.5:1 everywhere. `gl-charts` did
that briefly and backed it out: it inverts the spec's own plates on `c-1` and
`c-5`, and it renders a six-hue treemap as an alternating checkerboard of white
and near-black labels. So the shortfall is recorded rather than patched.

Three ways out, for Nil to pick between:

1. **Darken the mains.** `c-5` (`#EA822D`) is the worst at 2.72:1. Taking the
   affected mains to roughly the `dark` tone's lightness would clear AA and keep
   the "white on a colored tile" convention intact.
2. **Raise the in-tile label size** to 18.66px bold, where the bar drops to 3:1 —
   `c-1` and `c-3` clear it, `c-5` still does not, and tiles that small stop
   being labelled at all.
3. **Accept it for tile labels specifically**, on the grounds that the tile also
   carries its value and share and is never the only place a number appears.

`glLabelInkOn` ships from `@growth-lab/gl-charts/shapes` rather than staying
private to the treemap — a labelled heatmap cell asks the identical question.

## C4. Drift the token checker found in existing carriers

`tokens.json` is the machine-readable encoding of `grammar.md`'s colour tables,
and `npm run tokens:downstream` reports every hand-carried copy elsewhere in the
repo. Its first run surfaced real drift that convention had missed. **None of it
is fixed** — each needs a decision about which value is right, and all of it is
in files outside this package.

**`skills/gl-ggplot/assets/gl_pdf.tex` is the worst carrier.** Five of its ten
hexes are off-token, three of them values the spec has moved on from:

| Line | Carries | Spec |
|---|---|---|
| 45 | `#6B645A` ink-3 | `#4F4A42` |
| 48 | `#015C9C` accent | `#1A5A8E` |
| 50 | `#7E8A99` muted | `#AFB5BE` |
| 49 | `#C77A20` "amber accent / story-highlight" | no such token — `c-5` is `#EA822D` |
| 53 | `#FAF8F4` "page paper" | `paper` is `#FFFFFF`, `paper-warm` is `#F4F1EA` |

The README also claims this file carries "the color palette"; it carries no
categorical hue at all. Either the table is wrong or the file is incomplete — and
if the xelatex route is still live, it has been rendering PDFs in the pre-2026
palette. **This is the finding most worth acting on**, and it is independent of
everything else in this file.

**Undocumented carriers.** Six files outside the propagation table carry GL hexes.
The one that will bite is `skills/chart-audit/scripts/gl_lint.R`, whose
`GL_COLORS` allowlist rejects any hex it does not enumerate — so adding a token to
`grammar.md` silently makes the linter flag correct charts. It should read
`tokens.json` instead of hard-coding the list.

**Two stray hexes in the spec digest.** `docs/data-vis-spec-core.md:25-26`
mentions `#ECE9E2` and `#999FA8` in a table comparing our values against
`docs/nil/` — upstream's older values, quoted deliberately. Harmless, but the
checker cannot tell a quotation from a value, so they keep appearing in the
report until the table marks them.

**Two dark-mode hexes.** `skills/gl-ggplot/SKILL.md:139-140` carries `#6B6560`
and `#302C28` for a dark-mode axis and gridline. They are the only dark-mode
values in the repo, the `AX`/`GR` constants they feed are referenced nowhere, and
no dark-mode tokens exist in `grammar.md`. If §1's proposed addition (Part B) is
accepted, they become formally wrong and should be deleted; until then they are
dead but harmless, so this PR leaves them alone.

## C5. Geometry in `grammar.md` is prose, so it cannot be verified

The token checker parses `grammar.md`'s colour tables and enforces them: 89 colour
values and 31 type-role fields are compared on every `npm run check`. Geometry
(§3.5) is a prose bullet list — `- **Tick mark**: 1px, 4px long, **outward**` — so
those values can only be *reported* side by side (`--reconcile`), never checked.

Every geometry value in the system is therefore still trust-based: tick length,
label offsets, line widths, point radii, the treemap gutter, opacities. Turning
§3.5 into a table with one value per cell would put geometry under the same gate
as colour, at the cost of prose that currently reads well. Worth doing when
someone next edits that section; not worth a special pass.

## C6. A leader line has to be expressed in data coordinates

§3.12 (Part B) gives an annotation a **leader** for the case where no side of the
mark has 8px of open plot to put the text in. `glLeader` and the `leader` mark
kind exist and are on spec.

What is missing is a way to *place* one. TanStack's `link` takes `x1/y1/x2/y2` as
data channels and has no `dx/dy`, so a leader's ends can only be given in data
space — while the thing it has to reach is a label offset from its mark by a
number of **pixels**. The two cannot be reconciled inside a chart definition: the
definition is built before the scales resolve, so nothing there can convert 8px
into data units.

Three ways out, none free:

1. **A pixel offset on `link`.** The right fix, and upstream — `text` already
   takes `dx`/`dy`, so the channel shape exists in the library.
2. **A dynamic definition**, as `glTreemapChart` and `glSankeyChart` already are:
   those receive the resolved plot size and lay out in real pixels. A `glAnnotate`
   composer could do the same and emit leader plus label together, at the cost of
   being a chart rather than a mark.
3. **Data-space leaders at the call site** — what a plate would have to do today.
   It works and it is wrong: the offset silently changes meaning when the axis
   domain changes, which is the class of bug this package exists to remove.

Until one of those lands, no plate demonstrates a leader, and the annotation
plates avoid needing one — `fig-09` puts its label above the bubble and `spec-06`
widens the domain rather than tethering. Both are better answers than a leader
anyway (§3.12 prefers a clear side to a tether), so this is a gap in coverage
rather than in the renders.

## C7. Legend order has to be reversed by hand on every stack

§3.11 (Part B) puts a stacked chart's legend to the right of the plot, running
**top-to-bottom in the stack's own order**, so a reader maps row to band by
position. But a stack is *built* bottom-up: `stackOrder` and `toneRamp` both take
the bottom-up sequence, and so does TanStack's colour scale. Every stacked plate
in the gallery therefore ends with a bare `.reverse()` on its legend items, and a
plate that forgets it renders a legend exactly upside down against its own chart
— which is worse than no legend, and which nothing checks.

The fix is for the legend to know it is labelling a stack: either a `reverse` /
`order: 'stack'` prop on `GLLegend`, or — better — for `legendPlacement="right"`
to imply it, since §3.11 only sends a legend to the right *because* the series are
stacked bands. That would make the correct thing the default and remove the
call-site step entirely.

Left as a follow-up rather than done here because it changes the meaning of an
existing prop, and the `.reverse()` calls are at least visible and commented at
each site.

## C8. §3.4.2's connector rule does not survive a change of scale

§3.4.2 (Part B) gives a **connector** — the mark joining two points of one series
— the series' **dark** tone at full opacity. That is right for what the rule was
written against: a dumbbell's bar, a candlestick wick, a whisker. Marks two
pixels wide.

A **Sankey ribbon is the same geometry at forty pixels**, and the rule does not
survive the scale change: overlapping dark ribbons at full opacity are unreadable
and bury the nodes they connect.

`glSankeyChart` therefore paints a ribbon in its source node's **light** tone,
which follows §3.3 (light already has the background job) and mirrors §3.9's
argument for bands. It works, and it is a downstream file disagreeing with the
spec — the thing this repo exists to prevent.

**The fix belongs in §3.4.2**, which should split the row: a connector is dark at
hairline weight, and a **ribbon** — a connector wide enough to have area — takes
the light tone, like every other filled region in §3.9. Until that lands, the
departure is recorded here and in both Sankey specimens' gap notes.
