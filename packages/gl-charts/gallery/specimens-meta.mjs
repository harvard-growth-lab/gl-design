/**
 * The specimen catalog — plates with no reference figure.
 *
 * ## Why this is separate from PLATES
 *
 * `catalog-meta.mjs` mirrors the spec PDF: every entry has a page number, gets
 * cropped out of the PDF by `plates.mjs`, and is shown beside the figure it
 * reproduces. Its whole value is the *diff*.
 *
 * These have no figure to diff against. The spec PDF has eleven worked examples;
 * TanStack's gallery has sixty-nine, and `SPEC.md` §3.4.2 / §3.8 / §3.9 /
 * §3.10 now rule on chart types the PDF never drew. A lollipop, a candlestick, a
 * donut and a hexbin all have a right answer under the spec, and none of them
 * has a plate.
 *
 * So the value here is the OTHER two things the gallery does:
 *
 *   1. **The audit runs on them.** `audit.mjs` walks every `[data-plate]` in the
 *      page, so a specimen is measured against the tokens exactly like a plate —
 *      12px floor, token-only colours, ticks outward, no mark overflowing the
 *      frame, a source line present. That is what makes "the library can build
 *      this" a checked claim rather than a README assertion.
 *   2. **They are the recipes.** The package ships no whole-chart presets for the
 *      Cartesian types on purpose, so a worked, rendered, audited snippet *is*
 *      the API documentation for a lollipop or a waterfall.
 *
 * ## The contract
 *
 * The same one `catalog.tsx` keeps, and it is the point of the exercise:
 * **nothing may be styled by hand.** No hex, font size, stroke width or opacity
 * may appear in `specimens.tsx`. If a specimen needs one, the library is missing
 * something and it belongs in `gaps` here — not in a style attribute. A specimen
 * that cheats proves nothing.
 *
 * `family` names the TanStack example family the specimen answers, so
 * `reference/tanstack-example-coverage.md` and this file cannot drift apart
 * silently.
 *
 * ## `tanstack` — the reference that does exist after all
 *
 * TanStack publishes its own catalog at `tanstack.com/charts/catalog`, and the
 * slugs are enumerable **offline** out of `node_modules/@tanstack/charts/docs`,
 * where every examples page embeds them by iframe. Where a specimen has a
 * counterpart there, `tanstack` names it and `npm run gallery:tanstack`
 * screenshots the embed into the left column — so the specimen gets the same
 * side-by-side treatment a spec-PDF plate gets.
 *
 * The diff means something different from the plates', and that is the point.
 * A plate asks "did we reproduce the spec?". This asks "what does the spec
 * CHANGE?" — TanStack's slopegraph spends eight saturated hues and lets two
 * labels collide; the GL rules are what turn that into one muted backdrop and
 * one highlighted series. Neither chart is wrong; they answer to different
 * rules, and the pair is where you can see which.
 *
 * It is opt-in because it needs the network and a third-party site, and
 * `npm run gallery` has to stay offline and deterministic.
 */

/** @typedef {'built' | 'partial' | 'missing'} SpecimenStatus */

import { CATALOG_SPECIMENS } from './tanstack-specimens-meta.mjs';

/**
 * The original twenty-five: one plate per `grammar.md` rule the spec PDF never
 * drew. These were written rule-first — the question was "is §3.4.2 checkable?",
 * and the TanStack slug was attached afterwards where a counterpart happened to
 * exist.
 *
 * `CATALOG_SPECIMENS` was written the other way round, from the catalog roster
 * inward, and the two orders find different things. Keeping them as separate
 * lists rather than one sorted table is what preserves that: a rule with no
 * catalog entry and a catalog entry with no rule are both interesting, and a
 * merged list hides which is which.
 */
export const CORE_SPECIMENS = [
  // ── §3.4.2 — the chrome / data split ──────────────────────────────────────
  {
    id: 'spec-01-lollipop',
    tanstack: '16-lollipop',
    kind: 'Lollipop — ranked categories',
    family: 'Bars and Rankings',
    rule: '§3.4.2 — a stem is DATA: series tone at line weight',
    built: 'glStemX + glPoint + glAxisBand',
    status: 'built',
    gaps: [],
  },
  {
    id: 'spec-02-dumbbell',
    tanstack: '17-dumbbell',
    kind: 'Dumbbell — two states per entity',
    family: 'Bars and Rankings',
    rule: '§3.4.2 — a connector takes the DARK tone; it strokes an assembled glyph',
    built: 'glLink + glPoint ×2 + glAxisBand',
    status: 'built',
    gaps: [],
  },
  {
    id: 'spec-03-threshold',
    kind: 'Reference rule over a series',
    family: 'Annotations and Overlays',
    rule: '§3.4.2 — chrome: ink-3, dashed, and it IGNORES tone',
    built: 'glLine + glRuleY + glAnnotation',
    status: 'built',
    gaps: [
      'The rule is labelled with a margin annotation. A label sitting ON the ' +
        'rule would need the paper halo (variant: { labelHalo: true }) and a ' +
        'measured x position the definition does not have at build time.',
    ],
  },
  {
    id: 'spec-04-errorbar',
    tanstack: '14-error-bars',
    kind: 'Point estimates with error bars',
    family: 'Intervals and Financial',
    rule: '§3.4.2 — a data tick is 8px, twice the axis tick',
    built: 'glLink + glTickX ×2 + glPoint',
    status: 'built',
    gaps: [],
  },
  {
    id: 'spec-05-candlestick',
    tanstack: '28-candlestick',
    kind: 'Candlestick — OHLC',
    family: 'Intervals and Financial',
    rule: '§3.6 — colour encodes sign, so every body follows it',
    built: 'glLink (wick) + glTile (body) + signColor',
    status: 'built',
    gaps: [],
  },
  {
    id: 'spec-06-change-arrows',
    tanstack: '32-change-arrows',
    kind: 'Directed change in two dimensions',
    family: 'Annotations and Overlays',
    rule: '§3.4.2 — the 8px head is pinned; a scaled head encodes the value twice',
    built: 'glArrow + glLabel',
    status: 'built',
    gaps: [],
  },
  {
    id: 'spec-07-vector-field',
    tanstack: '42-vector-field',
    kind: 'Vector field',
    family: 'Maps and Spatial',
    rule: '§3.4.2 — chrome WEIGHT with a data TONE, so a dense field stays readable',
    built: 'glVector',
    status: 'built',
    gaps: [],
  },

  // ── §3.9 — intervals and uncertainty ──────────────────────────────────────
  {
    id: 'spec-08-band',
    tanstack: '22-bollinger-band',
    kind: 'Confidence band around a line',
    family: 'Lines and Areas',
    rule: '§3.9 — the LIGHT tone at full opacity, never a translucent main',
    built: 'glBand then glLine (array order is paint order)',
    status: 'built',
    gaps: [],
  },
  {
    id: 'spec-09-percentile-fan',
    tanstack: '61-quantile-ribbon',
    kind: 'Nested percentile fan',
    family: 'Intervals and Financial',
    rule: '§3.9 — confidence level is ORDERED, so it walks the sequential ramp of one hue',
    built: 'fanTones + glBand ×2 + glLine',
    status: 'built',
    gaps: [],
  },

  // ── §3.10 — derived series ────────────────────────────────────────────────
  {
    id: 'spec-10-moving-average',
    tanstack: '19-moving-average-line',
    kind: 'Moving average over its own series',
    family: 'Lines and Areas',
    rule: '§3.10 — a derived series keeps the parent hue and separates by dash',
    built: 'movingAverage + glLine ×2 + timeAxisFor',
    status: 'built',
    gaps: [],
  },
  {
    id: 'spec-11-regression',
    tanstack: '31-linear-regression',
    kind: 'Scatter with a fitted line',
    family: 'Scatterplots and Relationships',
    rule: '§3.10 — the fit is the estimate the chart is about, so it is data',
    built: 'glPoint + linearFit + glLine',
    status: 'built',
    gaps: [],
  },

  // ── Binned marks — a cell is a tile, not a point ──────────────────────────
  {
    id: 'spec-12-histogram',
    tanstack: 'histogram',
    kind: 'Histogram',
    family: 'Distributions',
    rule: '§3.5 — a binned axis has ZERO padding; §3.4.3 — bins take a 1px paper channel',
    built: 'binValues + glBinBar + glAxisBin',
    status: 'built',
    gaps: [
      'Tick labels name each bin\'s LEFT EDGE but sit at the bin CENTRE, so every ' +
        'label points half a bin (~344 units) right of the value it names. A band ' +
        'scale puts its ticks at band centres and offers no edge option. The fix is ' +
        'to draw the histogram as glTile on a continuous glAxisX — x1/x2 in data ' +
        'space, the way the Marimekko is built — which would also put the bin ' +
        'boundaries on the axis where a histogram reader expects to find them.',
    ],
  },
  {
    id: 'spec-13-heatmap',
    tanstack: '24-quantitative-binned-heatmap',
    kind: 'Matrix heatmap',
    family: 'Heatmaps and Densities',
    rule: '§3.4 — a cell is a TILE: full opacity, never the scatter 0.8',
    built: 'glCell + glAxisBin ×2 + glSequentialColor',
    status: 'built',
    gaps: [
      'Cell values are not labelled. The treemap has a label-fit routine ' +
        '(estimateTextWidth + the shorten ladder) and it is private to ' +
        'shapes/treemap.ts; a heatmap needs the same "does it fit, else drop" ' +
        'test and cannot reach it.',
    ],
  },
  {
    id: 'spec-14-hexbin',
    tanstack: '43-hexbin-density',
    kind: 'Hexagonally binned density',
    family: 'Heatmaps and Densities',
    rule: '§3.4 — hexbins tile the plane and cannot overlap, so 0.8 would only dilute',
    built: 'glHexbinLattice + glHexbin + glSequentialColor',
    status: 'built',
    gaps: [
      'The binning is done in DATA space, where TanStack bins in pixel space ' +
        'against the measured inner bounds. That is now a choice rather than a ' +
        'missing helper: pixel bins are always regular hexagons but move their ' +
        'boundaries when the container resizes, so the counts a printed legend ' +
        'names are right at one width only.',
      'The plot aspect is authored (`aspect: 2.4`) because a mark cannot know ' +
        'the resolved plot bounds before its bins are counted. It decides only ' +
        'whether the tiles are regular — the tiling itself holds at any width — ' +
        'and a development warning names the number when it is far off.',
    ],
  },
  {
    id: 'spec-15-ecdf',
    tanstack: '50-empirical-cdf',
    kind: 'Empirical cumulative distribution',
    family: 'Distributions',
    rule: 'A step curve: the distribution is genuinely flat between observations',
    built: 'ecdf + stepPoints + glLine + glAxisPercent',
    status: 'built',
    gaps: [],
  },

  // ── Composition ───────────────────────────────────────────────────────────
  {
    id: 'spec-16-waterfall',
    tanstack: '29-waterfall',
    kind: 'Waterfall bridge',
    family: 'Bars and Rankings',
    rule: '§3.6 — every bar follows the sign encoding, the total included',
    built: 'waterfall + glBar (y1/y2) + signColor + zeroBaseline variant',
    status: 'built',
    gaps: [],
  },
  {
    id: 'spec-17-normalized',
    tanstack: '20-normalized-stacked-area',
    kind: 'Normalized 100% stacked bars',
    family: 'Stacked and Composition',
    rule: 'The parts sum to the whole, so the axis is pinned to 0–100%',
    built: 'stack({ offset: normalize }) + glAxisPercent + toneRamp',
    status: 'built',
    gaps: [],
  },
  {
    id: 'spec-18-marimekko',
    tanstack: '64-marimekko-mosaic',
    kind: 'Marimekko — width and height both encode',
    family: 'Stacked and Composition',
    rule: '§3.5 — both axes are binned, so segments abut on both',
    built: 'glTile with x1/x2 and y1/y2',
    status: 'built',
    gaps: [
      'Column widths are computed by the plate. Nothing in compose.ts turns a ' +
        'two-level share table into paired intervals the way `waterfall` does ' +
        'for a signed sequence.',
    ],
  },
  {
    id: 'spec-19-ranked-barx',
    tanstack: 'bar-vertical-sorted',
    kind: 'Horizontal ranked bars with the pop-up effect',
    family: 'Bars and Rankings',
    rule: '§3.1 — mute everything, let one bar carry the finding',
    built: 'popUp + glMutedBarX + glBarX',
    status: 'built',
    gaps: [],
  },

  // ── Time ──────────────────────────────────────────────────────────────────
  {
    id: 'spec-20-date-axis',
    kind: 'Daily series on a date axis',
    family: 'Lines and Areas',
    rule: '§3.5 — endpoints labelled, one unit for the whole axis',
    built: 'timeAxisFor + toEpoch + glLine',
    status: 'built',
    gaps: [
      'TanStack ships no time scale, so this is a linear scale over epoch ' +
        'milliseconds. Tick placement is the library\'s (dateTicks), not a ' +
        'scale\'s — see constraints.test.ts §9.',
    ],
  },

  // ── §3.8 — radial ─────────────────────────────────────────────────────────
  {
    id: 'spec-21-donut',
    tanstack: '94-center-donut',
    kind: 'Donut with the total in the hole',
    family: 'Polar and Radar',
    rule: '§3.8 — ≤4 slices, directly labelled, each label in its own dark tone',
    built: 'glDonutChart',
    status: 'built',
    gaps: [],
  },
  {
    id: 'spec-22-gauge',
    tanstack: '98-needle-gauge',
    kind: 'Gauge — one value against its range',
    family: 'Polar and Radar',
    rule: '§3.8 — a partial angular range; the arc carries the range',
    built: 'arcAngles (partial turn) + glRadialArc + glRadialAnnotation',
    status: 'built',
    gaps: [],
  },
  {
    id: 'spec-23-polar-line',
    tanstack: '106-polar-line',
    kind: 'Polar line — a cyclic domain',
    family: 'Polar and Radar',
    rule: '§3.8 — wrapping is the point: December sits next to January',
    built: 'glRadialLine + glRadialGrid + glAngleGrid + glPolarChart',
    status: 'built',
    gaps: [],
  },
  {
    id: 'spec-24-rose',
    tanstack: '97-rose',
    kind: 'Rose — cyclic magnitude',
    family: 'Polar and Radar',
    rule: '§3.8 — equal angles, variable radii; arcs are single-layer like bars',
    built: 'arcAngles + glRadialArc',
    status: 'built',
    gaps: [],
  },
  {
    id: 'spec-25-wind-rose',
    tanstack: '107-polar-scatter',
    kind: 'Polar scatter — observations by bearing',
    family: 'Polar and Radar',
    rule: '§3.4 — a radial dot is a scatter circle: the 0.8 overlap rule applies',
    built: 'glRadialDot + glRadialGrid + glAngleGrid',
    status: 'built',
    gaps: [],
  },
];

export const SPECIMENS = [...CORE_SPECIMENS, ...CATALOG_SPECIMENS];

export const specimenById = Object.fromEntries(SPECIMENS.map((s) => [s.id, s]));

/**
 * The specimens that actually mount a chart.
 *
 * `render.mjs` and `audit.mjs` walk this rather than `SPECIMENS`, because a
 * `missing` entry has no renderer by definition — it is on the page to show the
 * TanStack reference and the reason there is nothing beside it. Screenshotting
 * the full list would report every one of them as "plate never mounted", which
 * would turn seven documented refusals into seven render errors.
 */
export const RENDERABLE_SPECIMENS = SPECIMENS.filter((s) => s.status !== 'missing');
