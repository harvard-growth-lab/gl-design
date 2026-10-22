# Authoring a demo family

Every demo on the examples page is one of the 105 renderable specimens from
`gallery/specimens-meta.mjs`, rebuilt on **real Atlas of Economic Complexity
data**. This file is the contract. `demos-lines.tsx` is the worked example —
read it before writing anything.

---

## The one rule

**No demo may style a chart by hand.** No hex, no font size, no stroke width, no
opacity, no `style={{…}}` on a mark. Every value on screen comes from
`tokens.json` by way of a `gl*` mark, an axis preset, or a compose helper from
`../src/index.js` / `../src/shapes.js`.

A demo that reaches for a style attribute to look right has disproved the thing
this page exists to show. If a chart cannot be drawn correctly from the library
alone, **let it come out wrong and record the shortfall in `gaps`.** That is the
finding.

What you *do* author is **data preparation** — pivoting a panel into a stack,
ranking a year, binning a distribution, rebasing an index, computing shares.
That decides *where* a mark goes and never what it looks like. Unlike the
gallery, this is the interesting half here — it is how an Atlas table becomes a
chart, and the next person to write a demo reads it. Make it readable.

---

## Honesty about data

This is the rule that separates this page from the gallery, and it is not
negotiable.

- **Never fabricate a column to complete a shape.** If a form needs data the
  Atlas does not have, draw the nearest *honest* Atlas framing and say so in
  `gaps`. Do not synthesise open/high/low/close, do not invent daily
  observations, do not jitter values to make a distribution look better.
- **The Atlas is annual.** There is no daily, monthly or intraday anything. Forms
  that assume sub-annual grain (candlestick, calendar heatmap, streaming windows)
  must be reframed at year grain and the deviation recorded.
- **Nulls are not zeros.** `defined(rows, 'key')` drops them explicitly, at the
  point of use. Never `?? 0` a measured value.
- **Names, never ids.** Use `nameShort` on axes and legends, full `name` on first
  mention. `countryName(iso3)` resolves a country. Atlas product names run long —
  that is a real legibility constraint and part of what this page is testing.
- **Every figure carries a source line.** Build it with `sourceOf(...tables)`,
  passing every table the chart read. Add caveats with `withNote(src, '…')`.

---

## File shape

One file per family: `demos-<slug>.tsx`. It must export a `Family`:

```tsx
export const <name>Family: Family = {
  slug: 'bars-and-rankings',   // matches the anchor used in demos.ts
  title: 'Bars and Rankings',  // matches the specimen roster family name
  blurb: '…',                  // one or two sentences: what this family is for
  demos,
};
```

Each demo's chart function **must** be wrapped in region markers. `build.mjs`
reads them to build the roster of ids that `check.mjs` holds the mounted page
against, and it **fails the build** if a registered demo has no region:

```tsx
// #region demo:ts-04-stacked-time-area
/**
 * A doc comment explaining the choice — this is shown to the reader.
 */
function SectorComposition() { … }
// #endregion
```

The `id` must match the specimen id exactly. Registration:

```tsx
const demos: Demo[] = [
  {
    id: 'ts-04-stacked-time-area',
    family: 'Stacked and Composition',
    name: 'Stacked area over time',      // names the FORM, not the finding
    question: 'What did Vietnam stop exporting, and what replaced it?',
    rule: '§3.7 — stack order is by size at the last period…',
    render: SectorComposition,
    gaps: ['…'],                          // omit if none
  },
];
```

---

## The data

Import from `./atlas-data.js`. Full types and notes are in that file; the
datasets are:

| Import | Shape | Good for |
|---|---|---|
| `countryYear` | 146 countries × 1995–2023: `eci`, `eciRank`, `coi`, `diversity`, `gdpPerCapita`, `population`, `exportValueM`, `growthProjection` | trends, cross-sections, scatters, distributions, maps, rankings |
| `countrySectorYear` | cohort × 9 sectors × years, `exportValueM` | stacks, streams, marimekko, normalised shares |
| `worldSectorYear` | world × 9 sectors × years | the backdrop a country's share is read against |
| `leadProducts` | Vietnam's 1199 HS92 4-digit products, 2023: `exportValueM`, `pci`, `distance`, `cog`, `rca`, `globalMarketShare` | treemaps, rankings, opportunity scatters, distributions |
| `leadProductPanel` | Vietnam's 12 largest products × 1995–2023 | bump ranks, slopegraphs, small multiples |
| `leadThresholds` | Atlas-computed p10/p25/p50/p75/p90, min/max/mean/std by year and variable (`pci`, `cog`, `distance`, `exportRca`) | percentile fans, boxplots, bands — **without re-deriving quantiles** |
| `productNodes` | 1241 HS92 products with `pci` and world `exportValueM` | scatters, hexbins, hierarchies |
| `productEdges` | 4316 proximity edges between product codes | matrices, adjacency |
| `leadPartners` | Vietnam's 12 largest destination markets × years | flows, routes, ranked bars |
| `worldFeatures` | Natural Earth 1:110m outlines keyed by `iso3` | choropleths, bubble maps |
| `countries` | catalog: `region`, `subregion`, `incomeGroup` | grouping, colour, facets |

Helpers: `seriesFor(iso3)`, `crossSection(year)`, `leadSectorsIn(year)`,
`topProducts(n)`, `thresholdsFor(variable)`, `partnersIn(year)`, `defined(rows, key)`,
`countryName(iso3)`, `sectorRank(name)`, `SECTOR_ORDER`, `COHORT`, `LEAD`,
`FIRST_YEAR`, `LATEST_YEAR`, and formatters `usd`, `pct`, `index`, `rank`.

`SECTOR_ORDER` is the page's categorical key: a sector's index there fixes its
tone, so "Electronics" is the same colour on every chart. Use it.

### Things real Atlas data will do to your chart

Expect these, and record them rather than working around them:

- **Nine sectors, not five.** The palette has six hues. A nine-category stack is
  a real constraint; `toneRamp` and sector grouping are the honest answers.
- **Long product names.** "Transmission apparatus for radio, telephone and TV" on
  a bar label is a legibility problem the synthetic specimens never had.
- **Heavy skew.** Export values are log-normal. A linear axis on a product
  ranking shows one bar and 1198 slivers; that is what `glAxisLog` is for.
- **Converging series.** Six real economies cross and bunch. `endLabels` has **no
  collision handling** — already recorded as a gap on two Lines demos. If it bites
  your family, cite that gap rather than re-discovering it.

---

## Checking your work

```bash
npx tsc -p tsconfig.json --noEmit    # must pass
node examples/build.mjs              # extracts sources, emits out/index.html
node examples/check.mjs              # mounts in Chrome, proves every demo drew
```

`check.mjs` fails if a demo does not mount, draws fewer than 12 elements, has no
title, has no source line, or has no extracted source.

---

## Specimen status

The specimen roster records `built` / `partial` / `missing`. **Do not change a
specimen's status**, and do not write a demo for a `missing` one — those are
chart types `gl-charts` cannot express at all and they have no plate by design.
Carry a `partial` specimen's existing gaps over, and add any new ones the real
data exposes.
