# `@growth-lab/gl-charts`

The Growth Lab data-visualization spec, as a thin layer over
[TanStack Charts v0](https://tanstack.com/charts/v0).

Rules and values: [`docs/data-vis-spec-core.md`](../../docs/data-vis-spec-core.md).
Source of truth for every token: [`grammar.md`](../../grammar.md).

### Reading the `§` citations

Source comments cite spec sections by number — `§3.3`, `§3.4.2`, `Decision Rule 6`.
The numbering is `grammar.md`'s throughout, but it spans **two** files:

| Sections | Live in | Status |
|---|---|---|
| §1, §2, §3.1–§3.7, Decision Rules 1–10 | [`grammar.md`](../../grammar.md) | ratified — the source of truth |
| §3.4.1–§3.4.3, §3.8–§3.12, Decision Rules 11–12 | [`SPEC.md`](SPEC.md) | **proposed** — written here because `grammar.md` is silent on these marks |

Building this package meant drawing things the grammar has never had to name — a
donut, a confidence band, a lollipop stem, a leader line, a legend's position.
Those rules had to exist before the code could, so they were written into
[`SPEC.md`](SPEC.md) as a reviewable proposal rather than pushed into
`grammar.md` unilaterally. Section numbers match the position each would take if
ratified, so a citation stays correct either way.

`SPEC.md` also records the three places this package knowingly **departs** from
`grammar.md` (Part A) and the questions the implementation could not settle
(Part C). Read Part A before changing anything about treemaps.

---

## One owner per kind of rule

The spec states four different kinds of thing, and each gets exactly one home. A
rule that lives in two places drifts; a rule that lives in four (as most of these
did) cannot be reasoned about at all.

| Kind of rule | Owner | Why there |
|---|---|---|
| A **value** — hex, size, width, opacity | [`tokens.json`](tokens.json) → emitters | machines sync better than comments |
| A **default** — 2px lines, 0.8 on overlap, ticks outward | [`src/marks.ts`](src/marks.ts) + [`src/chart.ts`](src/chart.ts) | applies to any TanStack mark, not per-preset |
| A **judgment** — pop-up first, title-as-finding, chart choice | [`skills/gl-charts/SKILL.md`](../../skills/gl-charts/SKILL.md) | prose; a library cannot enforce it |
| An **invariant** — nothing under 12px, dark-tone labels, source present | [`gallery/audit.mjs`](gallery/audit.mjs) | verified on the render, so it catches hand-written charts too |
| A **workaround** for a TanStack limitation | one CSS rule + one expiry test | the test fails when TanStack fixes it |

The guiding line for the API: **compose where TanStack can express the chart; ship
a whole-chart function only where it cannot.**

### Naming

| Shape | Rule |
|---|---|
| `gl*` — `glLine`, `glAxisY`, `glTreemapChart` | A function that **applies the spec's defaults**. If it paints, it is `gl`-prefixed |
| `GL*` — `GLLineOptions`, `GLToneRef`, `GLChart` | **Every exported type**, without exception. A bare `RampScaleOptions` beside a `GLSequentialOptions` reads as two different APIs |
| `GL*` — `GLFigure`, `GLLegend` | React components, which are PascalCase anyway |
| unprefixed — `popUp`, `stackOrder`, `waterfall`, `binValues` | A compose helper that **only reshapes data**. It never paints, so it carries no GL default and claims no prefix |

CSS goes the other way and deliberately so: classes are `gl-`-prefixed BEM
(`.gl-figure__title`), but the custom properties are **not** (`--c-1`, `--ink-2`,
`--gridline`). They use the names the spec PDF itself uses, so spec text maps to
code without translation, and they are scoped to `.gl-figure` rather than
`:root` so an unprefixed `--accent` cannot collide with a host application's.

### The coverage boundary is the kind list

`glDefaults(kind, options)` is the escape hatch that makes composing work: a mark
this package never wrapped can still be built on-spec by routing its options
through the table. That claim is only true for the marks the table **models**,
and the `GLMarkKind` union is therefore the documented boundary, not a
convenience.

It used to have eight entries, all of which answered some version of *what fill,
stroke, opacity and size?* — so pointing it at a mark with a different question
returned a confidently wrong answer. `glDefaults('line')` on a `ruleX` gave a
threshold line a 2px saturated `c-1` stroke, spending the institutional blue on
something that is not a finding, and `gallery/audit.mjs` passed it because that
*is* a token and it *is* 2px.

It now has sixteen, and the ones that closed that hole come from
[`SPEC.md` §3.4.2](../../grammar.md), which splits marks by **job rather than
geometry**: `rule` is chrome and never carries a series hue; `stem`, `connector`,
`tick`, `arrow` and `vector` are data and take the series tone. `band` (§3.9) is
the light tone at full opacity, because an interval is the background of its own
series. Coverage against TanStack's own example gallery — what this bought, and
what is still missing — is measured in
[`reference/tanstack-example-coverage.md`](reference/tanstack-example-coverage.md).

## Why there are no Cartesian presets

TanStack Charts has **no component tree** — no `<BarChart>`, no `<XAxis>`, no
`<Line>`. A chart is a plain data object from `defineChart(spec)`, rendered by one
component. So this package could never be wrapper components; the question was
whether it should be *preset functions* instead.

It shouldn't. A `glLineChart(rows, { x, y, series, highlight, endLabels, … })` is a
second API to learn and version, it can only express what its option bag
anticipated, and every chart outside that bag re-teaches raw `defineChart` anyway.
Composing costs a dozen lines and keeps the whole TanStack surface — plus TanStack's
own documentation — available:

```tsx
const { backdrop, focus } = popUp(rows, { by: 'country', highlight: ['Mongolia', 'Chile'] });

const chart = glChart({
  marks: [
    glMutedLine(backdrop, { x: 'year', y: 'index', z: 'country' }),
    ...focus.map((s) =>
      glLine(s.rows, { x: 'year', y: 'index', z: 'country', tone: s.tone, focus: true }),
    ),
    ...endLabels(focus, { x: 'year', y: 'index' }),
  ],
  x: yearAxisFor(rows, 'year'),
  y: glAxisY({ label: 'Index (2010 = 100)' }),
  endLabels: true,
});

<Chart {...chart.props} height={300} ariaLabel="Copper export index" />
```

The recipes live in [`gallery/catalog.tsx`](gallery/catalog.tsx) — one per figure in
the spec PDF, rendered in Chrome and audited against the tokens on every
`npm run gallery`. A snippet that is executed and measured on every run cannot
quietly stop being true, which a documented API surface can.

## Layout

| Layer | File | What it carries |
|---|---|---|
| Values | `tokens.json` | Every hex, size, weight, width, opacity — **authored here, nowhere else** |
| | `src/tokens.ts`, `src/tokens.css` | **GENERATED** by `scripts/emit-tokens.mjs` |
| Tone | `src/tone.ts` | `resolveTone`, `series(i)` — the only palette logic |
| Theme | `src/chart.ts` | `glTheme`, axis presets, margins, `glChart()` |
| Marks | `src/marks.ts` | One defaults table (16 kinds) + `glDefaults()`; the `gl*` wrappers are two lines each |
| Hexbin | `src/hexbin.ts` | `glHexbinLattice` + `glHexbin` — the one binned mark whose geometry no scale supplies, so the lattice and the mark ship together |
| Compose | `src/compose.ts` | `popUp`, `toSeries`, `endLabels`, `clearance`, `anchorWithin`, `stackOrder`, `toneRamp`, `yearAxisFor`, `timeAxisFor`, `movingAverage`, `linearFit`, `binValues`, `ecdf`, `waterfall`, `signColor` |
| Scales | `src/scales.ts` | Log axis, endpoint-pinned year and date ticks, sequential/diverging colour |
| Chrome | `src/figure.tsx` | `<GLFigure>` (which places the legend), `<GLLegend>`, `<GLRampLegend>` — `@growth-lab/gl-charts/react` |
| Shapes | `src/shapes/*` | Radar, polar, treemap, boxplot/violin, choropleth, graph layouts (Sankey, force, Delaunay/Voronoi), contours — `@growth-lab/gl-charts/shapes` |
| CSS | `src/theme.css` | `@import`s only → `tokens.css` + `chrome.css` + `patch.css` + `shapes.css` |

Every builder — `glChart()` and all eight whole-chart shape functions
(`glRadarChart`, `glTreemapChart`, `glBoxplotChart`, `glViolinChart`,
`glChoroplethChart`, `glSankeyChart`, `glDonutChart`, `glPolarChart`) — returns
`{ definition, className, props }`. Spread `props` onto `<Chart>` and the CSS-only
spec rules cannot be left off; that used to be a choice between three prop bags at
the call site.

### The shapes entry, and why it is separate

None of these can be assembled from TanStack marks: a radar has no x/y axes, a
treemap computes its own rectangles at the resolved pixel size, a boxplot
summarises before it draws, a choropleth projects, a Sankey and a force graph
*place* before they draw, and a contour is marching squares over a grid. What
they have in common is **geometry TanStack does not ship** — it has no layout of
any kind.

`src/shapes/` is ~4,500 lines, several times the rest of the package, so it sits
behind its own subpath. A consumer who never draws a map never pulls `d3-geo`
into their bundle, and one who never draws a network never pulls `d3-force`.

Note the split inside it: `glSankeyChart` is a whole chart for the same two
reasons the treemap is — the layout runs at the resolved pixel size, and the
paint decision is not freely the caller's (§5 of the coverage report).
`glForceLayout`, `glDelaunayEdges`, `glVoronoiCells`, `glContourDensity` and
`glContourGrid` return **data** instead, on the same principle as `waterfall` and
`linearFit`: how you draw a network is editorial, and §3.4.2 already decides how
each mark is painted.

`shapes/polar.ts` sits there for the same reason — it is the same non-Cartesian
TanStack surface — but is mostly **marks**, not whole charts. `glRadialArc`,
`glRadialLine`, `glRadialDot` and the rest route through the same defaults table
as their Cartesian counterparts, so a pie, gauge, rose, radial bar chart, polar
line and sunburst are all composable. Only `glDonutChart` is a whole-chart
function, because a donut needs angles computed from values before any mark
exists and §3.8 caps the slice count at four — a rule about the data that a bare
mark cannot check.

### What the theme object cannot carry

TanStack's `ChartTheme` is five fields: `foreground`, `muted`, `grid`,
`background`, `palette`. No font. No font size. No stroke width. No tick length. No
mark defaults. Everything else has to be applied at the call site, which is what
`chart.ts` and `marks.ts` do — and `tests/constraints.test.ts` asserts the theme is
*still* five fields, so if TanStack grows one, a test tells us.

Typography reaches the chart the only way it can: CSS inheritance from the
container, with TanStack resolving `foreground`/`muted`/`grid` through
`currentColor`.

---

## Install

`@growth-lab/gl-charts` is **not published to npm**. It is consumed from this repo
by path, and its `exports` point at raw TypeScript (`./src/index.ts`), so the
consuming project needs a TS-aware bundler — there is no build step and no `dist/`.

```bash
# in the consuming project
npm install /path/to/gl-design/packages/gl-charts   # or: file:../gl-design/packages/gl-charts
npm install @tanstack/charts @tanstack/charts-scales @tanstack/react-charts
```

React 19 is required by the TanStack React adapter.

The shapes entry owns five real dependencies, all pinned exactly, all serving a
**layout** rather than a paint decision — TanStack ships none:

| Package | Serves |
|---|---|
| `d3-hierarchy` | treemap, tidy tree, nested donut, sunburst — see [`reference/tanstack-treemap.md`](reference/tanstack-treemap.md) |
| `d3-sankey` | `glSankeyChart`, `glSankeyLayout` |
| `d3-force` | `glForceLayout` |
| `d3-delaunay` | `glDelaunayEdges`, `glVoronoiCells` |
| `d3-contour` | `glContourDensity`, `glContourGrid` |

`d3-geo` is the deliberate exception and stays **undeclared**: a choropleth takes
a projection factory that **you** pass, so the package never picks a projection
for you.

This package ships TypeScript source; your bundler compiles it, matching the
repo's convention of sourceable assets over build artifacts.

### Fonts

`theme.css` points `--font-sans` / `--font-serif` at **Inter** and **Source Serif 4**
but does not load them. Unless your host already serves both under those exact
family names, import the faces too:

```js
import '@growth-lab/gl-charts/theme.css';
import '@growth-lab/gl-charts/fonts.css';   // ~1.4 MB, the two variable faces inlined
```

Separate and opt-in only so a host that already serves them need not ship them
twice. There is no third option: **installing the fonts on the machine does not
work.** `scripts/install-fonts.sh` registers the variable files, which the OS
names `Inter Variable` and `Source Serif 4 Variable` — names no stack in this
package asks for.

Skipping `fonts.css` fails silently. Inter and San Francisco are near-identical
by design, so a substituted page still looks plausible, and TanStack sizes axis
gutters from measured text — so the geometry goes wrong with the type.
`npm run gallery` fails on it: `gallery/audit.mjs` treats an undeclared face, an
unloaded one, and a page with no `@font-face` at all as findings.

---

## Tokens

```bash
npm run tokens              # tokens.json → src/tokens.ts + src/tokens.css + src/fonts.css
npm run tokens:check        # fails if either generated file was hand-edited,
                            # and if tokens.json disagrees with grammar.md
npm run tokens:downstream   # reports (never fails) the repo's other hand-carried copies
```

`tokens.json` carries the doc comments as well as the values, so the rationale —
which spec rule a value serves, what breaks without it — is generated into both
outputs instead of being maintained twice. The colour tables in `grammar.md` are
parsed and compared on every check; geometry is prose there, so those values are
reported for reconciliation rather than verified (`--reconcile`).

## Gates

```bash
npm run check     # tokens:check + typecheck + tests/*.test.ts        (seconds)
npm run gallery   # crop the PDF, render in Chrome, audit, compose pairs (a minute)
```

- **`tests/constraints.test.ts`** is the expiry list: 24 tests, each asserting a
  TanStack limitation still exists and naming the workaround to delete when it
  doesn't. Behavioural where the behaviour is reachable headlessly, structural
  (asserting against TanStack's shipped `dist/`) where it isn't. Two of them —
  no time scale, no interaction API — gate absences the library has *not* worked
  around, so they say what to rule on when TanStack ships.
- **`tests/marks.test.ts` / `compose.test.ts` / `scales.test.ts` /
  `polar.test.ts`** cover the pure logic — a mismatched dot opacity, a tone ramp
  in the wrong order, an off-by-one in a bin boundary, slices that don't close
  the circle. All invisible in a render and wrong in the data.
- **`tests/render.test.ts`** builds real scenes with `createChartScene` and
  asserts the marks *draw*, in the right place and the right order. It exists
  because a wrapper can produce a perfectly correct options bag and still emit
  nothing: TanStack channels are a field name or a function, and a mark handed a
  raw number draws no nodes at all, with no error. That is how `glStemX` shipped
  with invisible stems — a value test cannot catch it.
- **`gallery/`** is the picture, and it has two tracks.

  **Plates** (`catalog-meta.mjs`, 13) rebuild every worked example in
  `assets/design-library/GL_data_visualization_spec.pdf` using nothing but this
  package, and sit beside a crop of the PDF page they mirror. That diff asks:
  *did we reproduce the spec?*

  **Specimens** (`specimens-meta.mjs`, 105) are everything the PDF never drew,
  and they were written from two directions. Twenty-five are **rule-first** — a
  lollipop, a candlestick, a donut, a hexbin — one per rule added in
  `SPEC.md` §3.4.2, §3.8, §3.9 and §3.10. The other eighty are
  **catalog-first**: one per entry in TanStack's published catalog, so the
  coverage claim has a denominator someone else chose. They mount under the same
  `data-plate` attribute, so the audit measures them exactly like a plate; that
  is what makes "the library can build this" a checked claim.

  A specimen may be `missing`, which a plate may not — an entry with no plate,
  carrying the reason instead. Nothing is `missing` today: seven entries were,
  each naming the d3 layout it was blocked on, until those four layouts were
  declared and all seven closed. The status stays, because that is precisely what
  made them closeable — a documented refusal on the page is a worse artifact than
  a working plate and a far better one than an entry dropped from the list.

  Both keep the same contract: **no plate may style a chart by hand.** Anything
  that cannot be built from the library is recorded as a gap instead of patched
  over, so the coverage count stays honest. Findings land in
  [`gallery/reports/`](gallery/reports/).

- **`gallery/tanstack-ref.mjs`** gives the specimens a reference after all.
  TanStack publishes its own catalog, and the roster is enumerable **offline**
  from two checked-in sources: `gallery/tanstack-catalog.mjs` (the published
  list, transcribed) unioned with the slugs `node_modules/@tanstack/charts/docs`
  embeds by iframe. Neither is a superset — the site lists 36 examples the
  pinned docs never document, and the docs embed one the site now 404s — so the
  union is the honest denominator: **103**.

  `npm run gallery:tanstack` screenshots each one into the specimen's left
  column; `gallery:tanstack:audit` lists whatever the gallery has not claimed,
  which is currently **none**. Every one of the 103 has a rendered, audited
  plate — coverage is written up in
  [`reference/tanstack-example-coverage.md`](reference/tanstack-example-coverage.md).

  That diff asks the *other* question — not "did we reproduce the spec?" but
  **"what does the spec change?"** Their slopegraph spends eight saturated hues
  and lets two end-labels collide; the same data under §3.1 is one muted
  backdrop and one highlight. Neither is wrong; they answer to different rules.

  It is opt-in, and stays out of `npm run gallery`: that run is a gate and has
  to work offline, deterministically, without a third-party site being up.
- **`reference/`** says what the components *should* draw: a hand-computed,
  TanStack-free rendering of the spec, built from `tokens.json` through
  `scripts/tokens.mjs`. If the library drifts, the reference is what tells you.

---

## Pages

Three static pages are built from this package, and they answer three different
questions. None of them is a gate; they are what you hand to someone.

```bash
npm run docs       # → docs/out/index.html       what IS each primitive?
npm run examples   # → examples/out/index.html   does it survive real Atlas data?
npm run gallery    # → gallery/out/             did we reproduce the spec?
```

[`docs/`](docs/) is the primitives reference: every exported token, mark, helper
and shape, with its signature, its options and the defaults it applies. It draws
**no chart** — that is the distinction it exists on. A page of worked examples
teaches the charts someone thought to write; it cannot tell you what
`glDefaults('band')` paints or which properties of `glPoint` the spec pins
against you.

Nothing on it is hand-written, and the mark defaults table in particular is
*measured*: the build calls `glDefaults(kind, {})` for all sixteen kinds and
probes each property with a sentinel to find out whether a caller's value
survives it. Pinned-vs-overridable is read off the behaviour, not off a
convention someone has to keep honouring, and the swatch on each row is stroked
with the values that came back. `npm run docs:check` fails if a module parsed to
nothing or the page grew an external reference, and reports documentation
coverage rather than failing on it.

---

## Pre-alpha warning

TanStack Charts is **pre-alpha** and says so on every docs page: "Its API may
change between releases, and it is not ready for production use." API-shaping
changes have landed in patch releases, so the peer range is pinned exactly.

After bumping it: `npm run check` (the constraints tests say what changed), then
`npm run gallery` (the audit and the diff say whether it still looks right).
