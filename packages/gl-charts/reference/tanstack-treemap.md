# TanStack Charts — the canonical treemap

Reference notes for `src/treemap.ts`. Everything here is quoted from a primary
source: the docs that ship **inside the pinned package**, the shipped `.d.ts`
files, or TanStack's own published catalog entry.

## Where the canonical docs live

`@tanstack/charts` ships its full documentation set in the tarball. Read it
locally — it is versioned with the pin, so it can never drift from the code
this package actually runs against:

```
node_modules/@tanstack/charts/llms.txt                 # index of every canonical page
node_modules/@tanstack/charts/docs/                    # 80+ pages
node_modules/@tanstack/charts/docs/reference/marks/bar-and-rect.md
node_modules/@tanstack/charts/docs/concepts/chart-definitions.md
node_modules/@tanstack/charts/docs/examples/networks-and-hierarchies.md
```

`llms.txt` says it plainly: *"Each concept is documented once; guides and
examples link back to its owner page."* Start there, not at the website.

## 1. There is no treemap layout in TanStack Charts

Checked against the shipped `dist/` of the pinned 0.6.5:

| Category   | What ships |
|------------|------------|
| Marks      | `rect`, `cell`, `bar`, `line`, `area`, `dot`, `hexagon`, `arrow`, `link`, `rule`, `tick`, `text`, `frame`, `facet`, `geo`, `polar` |
| Transforms | `bin`, `bin-xy`, `bin-time`, `stack`, `group`, `normalize`, `rank`, `reduce`, `select`, `window`, `cumulative` |
| Own deps   | `d3-array`, `d3-geo`, `d3-scale`, `d3-shape` |

No `treemap`, no `hierarchy`, no `pack`, no `partition`. `d3-hierarchy` is not
in TanStack's dependency tree either, so it cannot be reached transitively.

**Consequence:** the layout is ours to supply, and we supply it with
`d3-hierarchy` — which is what TanStack's own catalog entry does.

## 2. TanStack's own treemap example

`https://tanstack.com/charts/catalog/charts/74-recharts-treemap`, file
`cases/74-recharts-treemap/tanstack.ts`, quoted verbatim:

```ts
import { defineChart, rect, text } from '@tanstack/charts'
import { hierarchy, treemap } from 'd3-hierarchy'
import { scaleLinear } from 'd3-scale'

function layoutCells(): readonly BundleCell[] {
  const treemapData = selectTreemapData(flare)
  const root = hierarchy(flareTree(treemapData))
    .sum((node) => node.size ?? 0)
    .sort((left, right) => (right.value ?? 0) - (left.value ?? 0))

  const layoutRoot = treemap<FlareTreeNode>()
    .size([100, 100])
    .paddingInner(0.5)
    .round(false)(root)

  return layoutRoot.leaves().map((leaf) => ({
    name: leaf.data.name,
    family: leaf.data.family,
    x1: leaf.x0,
    x2: leaf.x1,
    y1: leaf.y0,
    y2: leaf.y1,
    labelX: (leaf.x0 + leaf.x1) / 2,
    labelY: (leaf.y0 + leaf.y1) / 2,
  }))
}

const definition = (input: ConformanceInput) => {
  const cells = layoutCells()
  const labels = cells.filter((cell) => {
    const label = flareLabel(cell.name)
    const width = ((cell.x2 - cell.x1) / 100) * input.width
    const height = ((cell.y2 - cell.y1) / 100) * input.height
    return width >= label.length * 4.8 + 8 && height >= 14
  })

  return defineChart({
    marks: [
      rect(cells, {
        x1: 'x1', x2: 'x2', y1: 'y1', y2: 'y2',
        color: 'family',
        inset: 1,
        stroke: '#ffffff',
        strokeWidth: 1,
      }),
      text(labels, {
        x: 'labelX', y: 'labelY',
        text: (cell) => flareLabel(cell.name),
        fill: '#ffffff', fontSize: 8, fontWeight: 600, anchor: 'middle',
      }),
    ],
    x: { scale: scaleLinear().domain([0, 100]) },
    y: { scale: scaleLinear().domain([100, 0]) },
    guides: false,
    margin: 0,
  })
}
```

### What we take from it

- **`d3-hierarchy` for the layout.** `hierarchy(...).sum(...).sort(...)` then
  `treemap().size(...).paddingInner(...)`, and read `.leaves()`.
- **`rect` with `x1/x2/y1/y2`** against a linear scale, `guides: false`,
  `margin: 0`.
- **Flip by reversing the y domain**, not by transforming the rectangles.
  `y: { scale: scaleLinear().domain([100, 0]) }` — d3's treemap measures y
  downward from the top, and the scale is the right place to turn that over.
  This replaces the hand-rolled `flipY()` helper the old `squarify.ts` carried.
- **Fit-test labels inside the responsive builder**, against real pixels.

### What we deliberately do NOT take from it

- **`.size([100, 100])`.** A fixed square layout space, scaled afterwards to a
  non-square plot, stretches every tile by the plot's aspect ratio — the one
  thing squarification exists to prevent. We pass the *resolved pixel size*,
  so `paddingInner` is also in real px rather than in hundredths of a plot.
- **`stroke: '#ffffff'` for separation.** `SPEC.md` §3.4.1 gives treemap
  tiles a **gap and never a stroke**. `paddingInner` produces the gap in the
  layout, which is better than `inset` here: the outer edge stays flush, and
  the fit test sees the true post-gutter rectangle.
- **The `label.length * 4.8` width estimate.** Ours is per-character (see
  `estimateTextWidth`), because tile names are real words and not monospaced.

## 3. `rect`'s `inset` — the built-in gap

`docs/reference/marks/bar-and-rect.md`:

| Option  | Type     | Default | Meaning |
|---------|----------|---------|---------|
| `inset` | `number` | `0.75`  | **Pixels removed from all four edges** |

Confirmed in `dist/rect.js:91-94` — `paintedX = left + inset`,
`paintedWidth = width - inset * 2`, both axes, pixel space. Note the contrast
with `bar`, where the same option name means *"pixels removed from both
**categorical** edges"* (one axis only, `dist/bar.js:126` sets
`insetAxis: 'x'`).

The default of `0.75` is why `glTile` pins `inset: 0`: without it every tile
carries a stray sub-pixel channel that no token accounts for.

## 4. Responsive definitions take a `chart` builder

`docs/concepts/chart-definitions.md`, *"Responsive definitions"*:

```ts
defineChart({
  chart: ({ width }) => ({ marks: [...], x: {...}, y: {...} }),
})
```

The type is `DynamicChartDefinition` (`dist/types.d.ts:384`):

```ts
interface DynamicChartDefinition<...> extends StoredChartDefinitionOptions {
  chart: (context: ChartBuildContext) => StoredChartSpec
}
interface ChartBuildContext { width: number; height: number; theme: ChartTheme }
```

A **bare function** passed to `defineChart` is not a `DynamicChartDefinition`
and does not typecheck — it only compiles behind an `as unknown as` cast. Use
the `chart:` property. The docs add: *"The host controls `width` and `height`;
the builder only reads their resolved values."*

## 5. Text measurement is not available to a definition

There is no measurement API reachable from a chart definition.
`ChartBuildContext` carries `width`, `height` and `theme` and nothing else.
`<Chart>` does accept a `measureText` host option, but it feeds axis-label
layout and never reaches the builder. Hence `estimateTextWidth` in
`src/treemap.ts` — and the reason it stays a pure function is SSR/hydration
determinism, argued at the function itself.
