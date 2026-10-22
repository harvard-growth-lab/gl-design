/**
 * Specimen metadata for the TanStack catalog entries.
 *
 * `specimens-meta.mjs` carries the first twenty-five — the ones written to
 * exercise a `grammar.md` rule the spec PDF never drew. These carry the rest of
 * the catalog, and they answer a different question: not "is this rule
 * demonstrated?" but **"can the library answer every chart TanStack publishes,
 * and what does the answer change?"**
 *
 * ## `status`
 *
 * `built` and `partial` mean what they mean everywhere else in this gallery, and
 * every entry now carries one of them: **all 103 catalog entries have a rendered,
 * audited plate.**
 *
 * `missing` remains a legal status and `RENDERABLE_SPECIMENS` still filters on
 * it, deliberately. It was used by seven entries — the Sankeys, the network, the
 * triangulation and its Voronoi dual, and the two contour forms — until the four
 * d3 layouts they were blocked on were declared. Keeping the machinery costs
 * nothing and means the next unreachable entry is recorded rather than dropped,
 * which is the property that made those seven closeable: they were on the page,
 * with the exact dependency named, instead of absent from the list.
 *
 * ## Why the gaps are long
 *
 * Because a gap is the deliverable. The plates that come out right are pleasant
 * and prove little; the value of running the whole catalog through the GL layer
 * is the list of places it does not fit, stated precisely enough to act on. A
 * gap that says "partial" and nothing else is a gap nobody can close.
 */

/**
 * Interaction is one shortfall repeated sixteen times, so it is written once.
 * Each interaction specimen appends whatever is specific to it.
 */
const INTERACTION_GAP =
  'The interaction itself is not built, and cannot be: TanStack 0.6.5 exports no ' +
  'interaction API at all — its published docs already use `crosshair()` and ' +
  '`createChartCursor`, neither of which is in `dist/` (constraints.test.ts §10 ' +
  'fails the day they land). `grammar.md` is also silent on the whole layer: no ' +
  'hover state, no tooltip type scale, no focus ring, no rule for a selected ' +
  'mark. So the plate draws the RESTING state on-spec and the static half of the ' +
  'interaction — pointer, band, selection — out of §3.4.2 and §3.9, which already ' +
  'cover them. Inventing the rest would be inventing spec.';

/**
 * The Sankey ribbon departs from §3.4.2, and the departure is the finding.
 *
 * Written once because both Sankey specimens carry it, and because it is the
 * only place in this gallery where a downstream file knowingly disagrees with
 * `grammar.md` — which is exactly the thing this repo exists to prevent, so it
 * is stated at length rather than buried.
 */
const RIBBON_GAP =
  '§3.4.2 names "a Sankey link" among its CONNECTORS, which take the series DARK ' +
  'tone at line weight — and `glSankeyChart` does not do that by default. The ' +
  'ruling was written for a dumbbell bar, a candlestick wick and a boxplot ' +
  'whisker: marks two pixels wide. A ribbon is the same geometry at forty, and the ' +
  'rule does not survive the scale change — overlapping dark ribbons at full ' +
  'opacity are unreadable and bury the node rectangles they are supposed to ' +
  'connect. The default is the source node\u2019s LIGHT tone, which follows §3.3 ' +
  '(light already has the background job) and mirrors §3.9\u2019s argument for ' +
  'bands: a known flat colour wherever two ribbons cross, and a lightness step ' +
  'that survives greyscale where an alpha does not. THE FIX BELONGS UPSTREAM — ' +
  '§3.4.2 should distinguish a hairline connector from a ribbon. Until it does, ' +
  '`linkTone` takes the literal reading back, and `ts-111-sankey-flow` draws it so ' +
  'the two can be compared rather than argued about.';

/** @type {import('./specimens-meta.d.mts').SpecimenMeta[]} */
export const CATALOG_SPECIMENS = [
  // ══════════════════════════════════════════════════════════════════════════
  // Lines and Areas — Trend, Range
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ts-01-line-gaps',
    tanstack: '01-line-gaps',
    kind: 'Line with genuine gaps',
    family: 'Lines and Areas',
    rule: 'A null is not a missing row — the path breaks rather than interpolating',
    built: 'glLine over null y values + timeAxisFor',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-02-multi-line-end-labels',
    tanstack: '02-multi-line-end-labels',
    kind: 'Five series with direct end labels',
    family: 'Lines and Areas',
    rule: '§3.1 — colour is spent only where it carries a finding; the rest is c-muted',
    built: 'popUp + glMutedLine (z) + glLine ×2 + endLabels',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-55-indexed-multi-line',
    tanstack: '55-indexed-multi-line',
    kind: 'Series rebased to a common index',
    family: 'Lines and Areas',
    rule: '§3.4.2 — the line at 100 is a REFERENCE, so it is dashed ink-3 and takes no hue',
    built: 'glRuleY + popUp + glMutedLine + glLine + endLabels',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-58-select-extrema',
    tanstack: '58-select-extrema',
    kind: 'Series with its extrema annotated',
    family: 'Lines and Areas',
    rule: '§3.4 — a label over data takes the paper halo, never a lighter ink',
    built: "select({ select: 'max' | 'min' }) + glPoint + glLabel + labelHalo",
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-03-temperature-range-band',
    tanstack: '03-temperature-range-band',
    kind: 'Observed range around a mean',
    family: 'Lines and Areas',
    rule: '§3.9 — a band is the LIGHT tone at full opacity, never a translucent main',
    built: 'glBand then glLine (array order is paint order)',
    status: 'built',
    gaps: [],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Stacked and Composition
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ts-04-stacked-time-area',
    tanstack: '04-stacked-time-area',
    kind: 'Stacked area over time',
    family: 'Stacked and Composition',
    rule: 'A stack happens INSIDE one mark, through z — there is no stacking across marks',
    built: 'glArea with z + stack() + the categorical palette',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-21-streamgraph',
    tanstack: '21-streamgraph',
    kind: 'Streamgraph — a baseline-free stack',
    family: 'Stacked and Composition',
    rule: 'Unruled: §3.5 assumes a baseline the reader can measure from',
    built: "glArea + stack({ offset: 'wiggle' })",
    status: 'partial',
    gaps: [
      'The marks compose and the plate renders, but `grammar.md` has no ruling on ' +
        'when a baseline may be given up. Every value on a wiggle baseline is read ' +
        'as a THICKNESS, which is the one visual comparison people are measurably ' +
        'bad at, and §3.5 has nothing to say for or against that trade. Until it ' +
        'does, this plate cannot claim to be on-spec — only to be drawable.',
      'The y axis is left unlabelled because its numbers are offsets from a ' +
        'floating centre and mean nothing to a reader. That is the plate deciding ' +
        'something the library should: an axis preset for a baseline-free stack ' +
        'would suppress the scale rather than leave every caller to blank it.',
    ],
  },
  {
    id: 'ts-70-composed-chart',
    tanstack: '70-composed-chart',
    kind: 'Bars and a line in one frame',
    family: 'Stacked and Composition',
    rule: '§3.1 — two encodings, one finding: the bars take the light tone, the line the hue',
    built: 'glBar (step: light) + glLine (focus) + glPoint',
    status: 'partial',
    gaps: [
      'The two series are on genuinely different units and `glChart` has one y ' +
        'axis, so the rainfall bars are rescaled onto the temperature scale by the ' +
        'plate and the subtitle says so. A second axis is a real feature — it needs ' +
        'a ruling first, because a dual axis lets an author manufacture any ' +
        'correlation they want by choosing the two ranges, which is why most ' +
        'house styles ban it outright.',
    ],
  },
  {
    id: 'ts-26-diverging-likert',
    tanstack: '26-diverging-likert',
    kind: 'Diverging Likert responses',
    family: 'Stacked and Composition',
    rule: 'Decision Rule 9 — a diverging ramp needs a midpoint that MEANS something',
    built: "glBarX + stack({ offset: 'diverging' }) + glDivergingColor + zeroBaseline",
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-27-parallel-coordinates',
    tanstack: '27-parallel-coordinates',
    kind: 'Parallel coordinates',
    family: 'Stacked and Composition',
    rule: '§3.1 — six polylines in six hues is spaghetti; one profile against a field is not',
    built: 'per-dimension normalization + popUp + glAxisPoint + endLabels',
    status: 'partial',
    gaps: [
      'Each dimension wants its own tick labels in its own units, and a GL chart ' +
        'has one y axis. The dimension names are on the categorical x axis and the ' +
        'values are unlabelled, so the reader gets the shape and not the ' +
        'magnitudes. A per-dimension axis stack is the missing piece and it is the ' +
        'same shortfall the marginal-histogram plate records — no linked-panel or ' +
        'multi-scale layout exists.',
    ],
  },
  {
    id: 'ts-41-waffle-unit-chart',
    tanstack: '41-waffle-unit-chart',
    kind: 'Waffle — one square per percentage point',
    family: 'Stacked and Composition',
    rule: '§3.4 — a unit square tiles the plane, so it is a TILE at full opacity',
    built: 'glTile on two pinned continuous axes + glSequentialColor over the rank',
    status: 'built',
    gaps: [],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Bars and Rankings
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ts-bar-horizontal-ranking',
    tanstack: 'bar-horizontal-ranking',
    kind: 'Horizontal ranking with long labels',
    family: 'Bars and Rankings',
    rule: '§3.5 — long category names read left-to-right, never rotated 90°',
    built: 'popUp + glMutedBarX + glBarX + glAxisBand with a pinned domain',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-bar-grouped',
    tanstack: 'bar-grouped',
    kind: 'Grouped bars',
    family: 'Bars and Rankings',
    rule: '§8c — three periods of ONE ordered variable walk light → main → dark',
    built: 'glBar + group() + toneRamp',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-bar-stacked',
    tanstack: 'bar-stacked',
    kind: 'Stacked bars',
    family: 'Bars and Rankings',
    rule: 'The 1px inter-segment gap is CSS — barY exposes no stroke and insets width',
    built: 'glBar + stack() + toneRamp + variant: { stacked: true }',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-59-grouped-reducer-bars',
    tanstack: '59-grouped-reducer-bars',
    kind: 'Bars whose height is a computed mean',
    family: 'Bars and Rankings',
    rule: '§8b — two categories sharing a parent are one hue at main + light',
    built: "groupBy({ reduce: 'mean' }) + glBar + group() + toneRamp",
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-71-population-pyramid',
    tanstack: '71-recharts-population-pyramid',
    kind: 'Population pyramid',
    family: 'Bars and Rankings',
    rule: '§8b — sex is NOT a sign, so this must not reach for signColor()',
    built: "glBarX + stack({ offset: 'diverging' }) + toneRamp + zeroBaseline",
    status: 'partial',
    gaps: [
      'The x axis labels the signed value, so the female wing reads negative. A ' +
        'mirrored axis that labels both wings positive is one formatter, and the ' +
        'library has no way to express "format the absolute value but keep the ' +
        'sign for placement" other than the plate passing `Math.abs` itself — ' +
        'which it does. That works and is invisible to a reader; it is recorded ' +
        'because the next chart that needs it will write it again.',
    ],
  },
  {
    id: 'ts-72-mixed-bars',
    tanstack: '72-recharts-mixed-bars',
    kind: 'A stack and a line in one frame',
    family: 'Bars and Rankings',
    rule: '§8b — the stack is one hue in two tones, so the line can take a second',
    built: 'glBar + stack() + toneRamp + glLine (c-2)',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-54-bump-ranking',
    tanstack: '54-bump-ranking',
    kind: 'Bump chart — rank over time',
    family: 'Bars and Rankings',
    rule: '§3.5 — rank 1 belongs at the top, so the y domain is pinned high-to-low',
    built: 'per-year ranking + popUp + glMutedLine/Point + glLine/Point + endLabels',
    status: 'built',
    gaps: [],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Scatterplots and Relationships
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ts-scatter-bubble',
    tanstack: 'scatter-bubble',
    kind: 'Bubble scatter — a third variable on size',
    family: 'Scatterplots and Relationships',
    rule: 'Radius takes the square root, or the value is encoded as area SQUARED',
    built: 'popUp + glMutedPoint/glPoint with an r channel + endLabels(clearOf(r))',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-53-log-scale-scatter',
    tanstack: '53-log-scale-scatter',
    kind: 'Log-scale scatter over four decades',
    family: 'Scatterplots and Relationships',
    rule: '§3.5 — a log axis rounds outward to 1–2–5 bounds and ticks on 1–2–5 steps',
    built: 'glPoint + glAxisLog',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-56-connected-scatter',
    tanstack: '56-connected-scatter',
    kind: 'Connected scatter — a path through a state space',
    family: 'Scatterplots and Relationships',
    rule: '§3.4.2 — the 8px head is pinned; a scaled head encodes the value twice',
    built: 'glArrow per segment + glPoint + glLabel + labelHalo',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-60-lag-autocorrelation',
    tanstack: '60-lag-autocorrelation',
    kind: 'Lag-one autocorrelation',
    family: 'Scatterplots and Relationships',
    rule: '§3.4.2 — a reference line is chrome and glRuleY IGNORES tone outright',
    built: 'lagPairs + glPoint + glRuleY with a pinned square domain',
    status: 'partial',
    gaps: [
      'The reference is drawn as a horizontal rule at the series mean rather than ' +
        'as the 45° identity line the entry uses. TanStack rules ignore their ' +
        'endpoint channels and always span the plot (`constraints.test.ts` §7), so ' +
        'a diagonal cannot be a rule — and drawing it with `glLine` would make it ' +
        'DATA under §3.4.2, which is exactly the confusion the chrome/data split ' +
        'exists to prevent. A `glRuleDiagonal` built on `link` (the way `glStemX` ' +
        'is) would close it.',
    ],
  },
  {
    id: 'ts-73-many-point-scatter',
    tanstack: '73-many-point-scatter',
    kind: 'Four hundred points with heavy overplotting',
    family: 'Scatterplots and Relationships',
    rule: '§3.4 — fill AND stroke at 0.8, so overlaps darken together into density',
    built: 'glPoint',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-44-framed-scatter',
    tanstack: '44-framed-scatter',
    kind: 'The guide-free scatter, answered rather than reproduced',
    family: 'Scatterplots and Relationships',
    rule: '§3.5 — a frame is not an axis, and the reader needs an axis',
    built: 'glPoint + glAxisX + glAxisY',
    status: 'partial',
    gaps: [
      'This entry is REFUSED rather than built, and the plate is what the refusal ' +
        'looks like. TanStack drops the axes and draws a frame; §3.5 puts an axis ' +
        'line on both dimensions and gridlines on the one values are estimated ' +
        'from, so the GL answer is the same scatter with its guides. `frame` stays ' +
        'unwrapped because a GL chart has no use for it — recorded here so the ' +
        'coverage table shows a decision rather than an omission.',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Distributions
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ts-15-boxplot',
    tanstack: '15-boxplot',
    kind: 'Grouped boxplot',
    family: 'Distributions',
    rule: '§11 — a distribution is context, so the boxes are muted by construction',
    built: 'glBoxplotChart from raw observations',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-63-violin-distributions',
    tanstack: '63-violin-distributions',
    kind: 'Violin — density instead of five numbers',
    family: 'Distributions',
    rule: "Trimmed to the observed range: an untrimmed tail reads as evidence",
    built: "glViolinChart({ scale: 'area' })",
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-62-ridgeline-density',
    tanstack: '62-ridgeline-density',
    kind: 'Ridgeline — densities stacked down the page',
    family: 'Distributions',
    rule: '§12 — the group ordering is carried by a sequential ramp, not by six hues',
    built: 'glDensity + glLine per group at a computed offset + glSequentialColor',
    status: 'partial',
    gaps: [
      'The curves are spaced rather than overlapped, which gives up the ' +
        'compactness that is a ridgeline\'s whole argument. Overlapping them needs ' +
        'a translucent fill, and §3.4 puts every area mark at full opacity — a ' +
        'translucent overlap would read as a new colour wherever two curves cross ' +
        'and would vanish in greyscale. The rule §3.9 uses for nested bands ' +
        '(walk the sequential ramp instead of stacking alpha) is the likely answer, ' +
        'but it is unruled for this form.',
      'Each ridge is a line rather than a filled silhouette, because a filled one ' +
        'at full opacity would hide every curve behind it. `glDensity` returns the ' +
        'points either way; what is missing is the ruling, not the mark.',
    ],
  },
  {
    id: 'ts-52-beeswarm-dodge',
    tanstack: '52-beeswarm-dodge',
    kind: 'Beeswarm — every observation, none overlapping',
    family: 'Distributions',
    rule: '§3.4 — the dodge is layout, so the marks stay ordinary scatter circles',
    built: 'binned dodge computed in the plate + glPoint on a pinned continuous x',
    status: 'partial',
    gaps: [
      'The dodge is computed here. It is layout arithmetic rather than styling — ' +
        'the same class of thing as the hexbin lattice and the Marimekko column ' +
        'boundaries — but it is general enough to belong in `compose.ts` beside ' +
        '`binValues`, and three plates in this gallery now roll their own variant ' +
        'of "bin, then offset within the slot".',
    ],
  },
  {
    id: 'ts-51-faceted-distributions',
    tanstack: '51-faceted-distributions',
    kind: 'Small multiples — one histogram per group',
    family: 'Facets and Multiple Views',
    rule: '§3.5 — panels are only comparable on a shared scale, so facet resolves it',
    built: 'facet({ by, columns }) + binValues + glBar + glAxisBin per cell',
    status: 'partial',
    gaps: [
      '`facet` is used unwrapped. It paints nothing — no fill, stroke or opacity — ' +
        'so that does not breach the no-hand-styling contract, but two things are ' +
        'missing. `glMargin` is sized for a single chart (74px left to clear a ' +
        'rotated axis label), which is most of a narrow facet cell, so every ' +
        'faceted plate overrides it by hand; and `facet` hard-codes its cell titles ' +
        'at 11px/600 with fill-opacity 0.78, below the 12px floor. The type is now ' +
        'corrected in `src/patch.css` with an expiry test, but the margin model is ' +
        'still the caller\'s problem. A `glFacet` would own both.',
    ],
  },
  {
    id: 'ts-facets-anscombe',
    tanstack: 'facets-anscombe',
    kind: "Anscombe's quartet on shared axes",
    family: 'Facets and Multiple Views',
    rule: 'The demonstration collapses unless every panel is on the SAME two scales',
    built: 'facet({ by, columns, label }) + glPoint + pinned domains',
    status: 'partial',
    gaps: [
      'Same `facet` shortfall as the faceted distributions: unwrapped, and the ' +
        'small-multiple margin model is the plate\'s to supply.',
    ],
  },
  {
    id: 'ts-57-scatter-marginal-histograms',
    tanstack: '57-scatter-marginal-histograms',
    kind: 'Joint distribution with both marginals',
    family: 'Facets and Multiple Views',
    rule: '§3.5 — the marginals are only readable against the joint plot\'s own domains',
    built: 'three glCharts with hand-pinned shared domains + binValues + glPoint',
    status: 'partial',
    gaps: [
      'This is the clearest case for a layout the library does not have. Three ' +
        'panels sharing two scales is a LINKED-PANEL layout; `facet` splits one ' +
        'spec across cells and cannot compose three different specs against shared ' +
        'scales. So the panels are placed by a grid rule in `gallery.css` and the ' +
        'shared domains are pinned by hand on all three charts — which is exactly ' +
        'what a layout would otherwise guarantee, and exactly the kind of ' +
        'hand-coordination that rots the first time the data changes.',
    ],
  },
  {
    id: 'ts-18-cumulative-histogram',
    tanstack: '18-cumulative-histogram',
    kind: 'Cumulative histogram',
    family: 'Distributions',
    rule: '§3.5 — a binned axis has ZERO padding; §3.4.3 — bins take a 1px paper channel',
    built: 'binValues + running total + glBinBar + glAxisBin + glAxisPercent',
    status: 'built',
    gaps: [
      'Tick labels name each bin\'s left edge but sit at the bin centre — the same ' +
        'band-scale limitation recorded on spec-12-histogram.',
    ],
  },
  {
    id: 'ts-39-density-contours',
    tanstack: '39-density-contours',
    kind: 'Point density contours',
    family: 'Heatmaps and Densities',
    rule: '§12 — a contour level is ORDERED with no midpoint, so it walks one hue',
    built: 'glContourDensity + glGeoShape(geoIdentity) + glSequentialColor',
    status: 'partial',
    gaps: [
      'A kernel estimate is a MODEL, and an iso-line drawn where nothing was ' +
        'observed reads as evidence rather than as smoothing. `glDensity` answers ' +
        'that in one dimension by trimming to the observed range; a two-dimensional ' +
        'hull is not an interval, so `glContourDensity` drops the lowest level ' +
        'instead — the ring that balloons furthest past the data. That is a blunter ' +
        'instrument than trimming and it is the reason this is `partial`. Read the ' +
        'plate against `spec-14-hexbin`, which draws the same cloud and cannot ' +
        'claim density anywhere it has no observations.',
      'Contours reach a chart through `glGeoShape` with `geoIdentity`, because ' +
        'marching squares emits rings with holes and `geoShape` is the only ' +
        'polygon-capable mark in the stack. That works and is arguably the right ' +
        'model — an iso-line and a coastline are the same kind of object — but it ' +
        'means the plate imports `d3-geo` for a chart with no geography in it.',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Heatmaps and Densities — Matrix, Time
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ts-heatmap-labeled',
    tanstack: 'heatmap-labeled',
    kind: 'Labelled ordinal heatmap',
    family: 'Heatmaps and Densities',
    rule: '§3.4.1 — a label ON a fill follows that fill\'s luminance, not Decision Rule 6',
    built: 'glCell + glLabel(fill: glLabelInkOn) + glAxisBin ×2 + glSequentialColor',
    status: 'partial',
    gaps: [
      'Writing this plate closed half of `spec-13-heatmap`\'s gap: the in-tile ink ' +
        'rule was private to `shapes/treemap.ts` and now ships as `glLabelInkOn`, ' +
        'because a heatmap cell asks the identical question a treemap tile does. ' +
        'Decision Rule 6\'s dark tone is wrong on a saturated fill — `c-1-dark` on ' +
        '`c-1` measures 2.5:1 — and every mark that puts text on a fill needs the ' +
        'luminance split instead.',
      'The other half is still open. `estimateTextWidth` and the shorten ladder ' +
        'remain private, so nothing here can test whether a label FITS its cell. ' +
        'This plate only labels safely because a 5×5 matrix of two-digit ' +
        'percentages fits by construction — which the plate knows and the library ' +
        'cannot check.',
    ],
  },
  {
    id: 'ts-25-calendar-heatmap',
    tanstack: '25-calendar-heatmap',
    kind: 'Calendar heatmap — a year on a week × weekday lattice',
    family: 'Heatmaps and Densities',
    rule: '§3.5 — a calendar is binned on BOTH axes, so both take zero padding',
    built: 'glCell + glAxisBin ×2 + glSequentialColor',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-118-token-usage-calendar',
    tanstack: '118-token-usage-calendar',
    kind: 'Consumption calendar',
    family: 'Heatmaps and Densities',
    rule: '§12 — a count ramp and a consumption ramp are the same ramp',
    built: 'glCell + glAxisBin ×2 + glSequentialColor',
    status: 'built',
    gaps: [
      'The only entry with NO reference column: `catalog/embed/118-token-usage-calendar` ' +
        'returns 404. The slug is embedded by `heatmaps-and-densities.md` in the ' +
        'pinned 0.6.5 docs and the live catalog no longer serves it, which is the ' +
        'exact case `tanstack-catalog.mjs` unions two sources to catch — enumerate ' +
        'from the website alone and this example disappears from the denominator. ' +
        'The plate is built and audited; only the diff is unavailable.',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Intervals and Financial
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ts-13-interval-timeline',
    tanstack: '13-interval-timeline',
    kind: 'Open-to-close intervals',
    family: 'Intervals and Financial',
    rule: '§3.6 — colour encodes sign, so every interval follows it',
    built: 'glLink (sign-coloured) + glTickX + signColor',
    status: 'built',
    gaps: [],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Annotations and Overlays — Change
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ts-30-slopegraph',
    tanstack: '30-slopegraph',
    kind: 'Two-period slopegraph',
    family: 'Annotations and Overlays',
    rule: '§3.1 + Decision Rule 1 — eight hues become one backdrop and two findings',
    built: 'popUp + glMutedLine/Point + glLine/Point + endLabels + glAxisPoint',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-33-difference-chart',
    tanstack: '33-difference-chart',
    kind: 'A series against its own trend',
    family: 'Annotations and Overlays',
    rule: '§3.10 — a derived series keeps the parent hue and separates by dash',
    built: 'movingAverage + glBand + glLine ×2 (one dashed)',
    status: 'partial',
    gaps: [
      'The difference is shaded as ONE band in the series\' light tone rather than ' +
        'as two sign-coloured regions. Splitting it needs the band clipped at every ' +
        'point where the two curves cross, and nothing in `compose.ts` computes ' +
        'those crossings — `waterfall` does the analogous job for a signed sequence ' +
        'and there is no equivalent for a pair of curves. §3.6 would want the ' +
        'split, so this is a real shortfall rather than a stylistic choice.',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Polar and Radar
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ts-76-pie',
    tanstack: '76-pie',
    kind: 'Pie — the form §3.8 allows and does not prefer',
    family: 'Polar and Radar',
    rule: '§3.8 — the donut is the default; a pie has to be asked for',
    built: 'glDonutChart({ pie: true }) over a capped four-slice split',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-77-donut',
    tanstack: '77-donut',
    kind: 'Donut',
    family: 'Polar and Radar',
    rule: '§3.8 — the hole costs nothing and removes the least readable part of a pie',
    built: 'glDonutChart',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-93-labeled-pie',
    tanstack: '93-labeled-pie',
    kind: 'Seven slices — the case §3.8 refuses',
    family: 'Polar and Radar',
    rule: '§3.8 — past four slices, comparing angles stops being safe',
    built: 'glDonutChart over the uncapped seven, warning and all',
    status: 'partial',
    gaps: [
      'This plate deliberately BREAKS the four-slice cap so the enforcement is ' +
        'visible: `glDonutChart` warns and draws anyway, which is the right ' +
        'behaviour — refusing would leave a caller with an exception and no way to ' +
        'see their data — but it is invisible unless something exercises it. The ' +
        'warning text is "A donut holds at most 4 slices; 7 were passed ' +
        '(SPEC.md §3.8) … Group the tail into \'Everything else\', or switch ' +
        'form." The three smallest slices\' labels are what the rule is arguing ' +
        'about, and they are on the plate.',
    ],
  },
  {
    id: 'ts-95-rounded-donut',
    tanstack: '95-rounded-donut',
    kind: 'Donut with rounded arc ends',
    family: 'Polar and Radar',
    rule: 'The spec rules on fill, opacity, gap and slice count — and not on corners',
    built: 'arcAngles + glRadialArc({ cornerRadius }) + glRadialLabel',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-96-nested-donut',
    tanstack: '96-nested-donut',
    kind: 'Nested donut — two hierarchy levels on two rings',
    family: 'Polar and Radar',
    rule: '§8b — a child takes its PARENT\'s hue at the light step, not a hue of its own',
    built: 'd3-hierarchy partition() + glRadialArc ×2 rings + glRadialLabel',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-101-sunburst',
    tanstack: '101-sunburst',
    kind: 'Sunburst — the same partition to full depth',
    family: 'Polar and Radar',
    rule: '§3.8 — the angular cap applies outward too; depth carries the lightness',
    built: 'd3-hierarchy partition() + glRadialArc per node + glRadialLabel',
    status: 'partial',
    gaps: [
      'Labels stop at depth 1. A label that does not fit has to be dropped, and ' +
        'unlike the treemap nothing here can measure whether it fits — ' +
        '`estimateTextWidth` is private to `shapes/treemap.ts`, and an arc needs a ' +
        'harder test than a rectangle anyway (the available width varies along the ' +
        'arc). The same private-fit-routine gap the labelled heatmap records.',
      'Read against `ts-74-treemap`, which draws the identical hierarchy and ' +
        'labels ten tiles where this labels four. That is the honest comparison ' +
        'and the reason §9 makes the treemap the spec\'s composition chart.',
    ],
  },
  {
    id: 'ts-100-radial-bars',
    tanstack: '100-radial-bars',
    kind: 'Concentric radial bars',
    family: 'Polar and Radar',
    rule: '§3.8 — bending bars round a centre costs them their common baseline',
    built: 'glRadialArc track + value pairs at per-row radii + glRadialLabel',
    status: 'partial',
    gaps: [
      'The form is systematically distorting and the library cannot fix it: outer ' +
        'tracks are physically longer at equal value, so whatever is drawn ' +
        'outermost is overstated. The plate answers it the only way available — it ' +
        'sorts descending so the distortion reinforces the ranking instead of ' +
        'fighting it — and that is a plate decision where it should be a preset\'s. ' +
        'A `glRadialBarChart` that sorted by construction, the way `glDonutChart` ' +
        'caps slices by construction, is the missing piece.',
    ],
  },
  {
    id: 'ts-78-gauge',
    tanstack: '78-gauge',
    kind: 'Gauge — the arc form rather than the needle',
    family: 'Polar and Radar',
    rule: '§3.8 — a filled arc is a LENGTH against a track; a needle is an angle',
    built: 'glRadialArc (track + value) + cornerRadius + glRadialAnnotation ×2',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-75-radar',
    tanstack: '75-radar',
    kind: 'Radar — one profile across six dimensions',
    family: 'Polar and Radar',
    rule: '§3.8 — every dimension on ONE normalized scale, or the shape means nothing',
    built: 'glRadarChart({ max: 1 })',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-99-comparative-radar',
    tanstack: '99-comparative-radar',
    kind: 'Comparative radar — a profile against its peer',
    family: 'Polar and Radar',
    rule: '§11 — the second series is a PEER (c-muted, stacked under), not a co-finding',
    built: 'glRadarChart({ series, focus })',
    status: 'built',
    gaps: [],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Networks and Hierarchies
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ts-74-treemap',
    tanstack: '74-recharts-treemap',
    kind: 'Two-level treemap',
    family: 'Networks and Hierarchies',
    rule: '§3.4.1 — tiers are separated by PAPER GUTTER, never by a stroke',
    built: 'glTreemapChart({ category, group, value })',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-36-hierarchy-tree',
    tanstack: '36-hierarchy-tree',
    kind: 'Tidy hierarchy tree',
    family: 'Networks and Hierarchies',
    rule: '§3.4.2 — a tree edge is a CONNECTOR: dark tone, line weight, butt cap',
    built: 'd3-hierarchy tree() + glLink + glPoint + glLabel + labelHalo',
    status: 'partial',
    gaps: [
      '`tree()` is called in the plate rather than wrapped. That is a defensible ' +
        'place to leave it — the layout is three lines and `d3-hierarchy` is ' +
        'already a declared dependency for the treemap — but it means the node ' +
        'radius, the label side and the domain padding are all the plate\'s ' +
        'decisions. A `glTreeChart` would own them; it would also be a whole-chart ' +
        'function for a form `grammar.md` has never ruled on, which is why it does ' +
        'not exist yet.',
    ],
  },
  {
    id: 'ts-37-delaunay-network',
    tanstack: '37-delaunay-network',
    kind: 'Delaunay spatial network',
    family: 'Networks and Hierarchies',
    rule: '§3.4.2 — a triangulation side is a CONNECTOR, exactly like a network edge',
    built: 'glDelaunayEdges + glLink + glPoint',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-40-force-directed-network',
    tanstack: '40-force-directed-network',
    kind: 'Force-directed network',
    family: 'Networks and Hierarchies',
    rule: '§3.4.2 — edges are connectors; §3.4 — overlapping nodes darken at 0.8',
    built: 'glForceLayout (synchronous, deterministic) + glLink + glPoint + glLabel',
    status: 'partial',
    gaps: [
      'The simulation is run SYNCHRONOUSLY to a fixed tick count, because a chart ' +
        'definition is data and nothing in the pipeline can await a layout that ' +
        'settles over animation frames. That is d3\u2019s own supported path ' +
        '(`stop()` then `tick(n)`) and it costs the live, draggable behaviour ' +
        'TanStack\u2019s version has — which is the interaction gap again, not a ' +
        'layout one.',
      'Determinism is bought rather than given. `glForceLayout` pins its starting ' +
        'positions on a circle so that `d3-force`\u2019s one use of `Math.random()` ' +
        '— `jiggle()`, which fires when two nodes coincide — never fires. Two nodes ' +
        'sharing an id would still coincide; that warns, and ' +
        '`tests/network.test.ts` asserts two runs agree. Without this the gallery ' +
        'premise fails: a plate that lands somewhere new on every render makes ' +
        'every diff meaningless.',
    ],
  },
  {
    id: 'ts-111-basic-sankey',
    tanstack: '111-basic-sankey',
    kind: 'Basic Sankey',
    family: 'Networks and Hierarchies',
    rule: '§3.3 — a ribbon is the background of the two nodes it joins, so it is LIGHT',
    built: 'glSankeyChart (dynamic, laid out at the resolved pixel size)',
    status: 'partial',
    gaps: [RIBBON_GAP],
  },
  {
    id: 'ts-111-sankey-flow',
    tanstack: '111-sankey-flow',
    kind: 'Sankey flow — the literal §3.4.2 reading',
    family: 'Networks and Hierarchies',
    rule: '§3.4.2 as written — every ribbon one dark connector. Compare the plate above',
    built: "glSankeyChart({ linkTone: 'c-1', align: 'left' })",
    status: 'partial',
    gaps: [
      'This plate exists to make the departure ARGUABLE rather than asserted: it ' +
        'is the same graph under the connector rule exactly as §3.4.2 writes it, ' +
        'so the two can be compared side by side. ' +
        RIBBON_GAP,
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Maps and Spatial
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ts-102-world-choropleth',
    tanstack: '102-world-choropleth',
    kind: 'World choropleth, sequential',
    family: 'Maps and Spatial',
    rule: '§12 — five equal-width bins on one hue; darker is higher, always',
    built: 'glChoroplethChart + a pinned domain + the step legend',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-108-country-choropleth',
    tanstack: '108-country-choropleth',
    kind: 'World choropleth, diverging',
    family: 'Maps and Spatial',
    rule: 'Decision Rule 9 — a diverging ramp needs a midpoint that means something',
    built: "glChoroplethChart({ kind: 'diverging', midpoint: 0 })",
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-109-us-state-choropleth',
    tanstack: '109-us-state-choropleth',
    kind: 'Sub-national choropleth',
    family: 'Maps and Spatial',
    rule: '§12 — the projection is an argument, so the scale change is one line',
    built: 'glChoroplethChart({ projection: geoMercator })',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-103-bubble-map',
    tanstack: '103-bubble-map',
    kind: 'Bubble map — a quantity AT a place',
    family: 'Maps and Spatial',
    rule: 'Two layers must fit ONE geometry, or they render at two different scales',
    built: 'glGeoShape ×2 with a shared explicit fit + a square-rooted radius',
    status: 'partial',
    gaps: [
      'Bubbles overlap, so §3.4\'s 0.8 fill-and-stroke should apply — and ' +
        '`glGeoShape` has no point variant that reaches the scatter defaults. It is ' +
        'a choropleth POLYGON mark: full opacity, `ink-3` hairline, which is right ' +
        'for a region and wrong for a proportional symbol. A `glGeoPoint` routing ' +
        'to the `point` kind is the missing piece, and it is four lines.',
      'The fills are named through `resolveTone` at the call site because the mark ' +
        'takes no `tone`. Every value is a token, so the plate is on-spec, but it ' +
        'is reaching past the vocabulary to get there.',
    ],
  },
  {
    id: 'ts-105-route-map',
    tanstack: '105-route-map',
    kind: 'Route map — a path on the sphere',
    family: 'Maps and Spatial',
    rule: '§3.1 — the geography is context (c-muted-light); the track is the finding',
    built: 'glGeoShape over a LineString + Point features, one shared fit',
    status: 'partial',
    gaps: [
      'Same shortfall as the bubble map: the route and its ports are painted ' +
        'through `resolveTone` at the call site because `glGeoShape` takes no ' +
        '`tone`. A LineString drawn through a polygon mark also needs `fill: ' +
        "'none'` passed explicitly, which is the mark telling you it was designed " +
        'for regions.',
    ],
  },
  {
    id: 'ts-104-orthographic-globe',
    tanstack: '104-orthographic-globe',
    kind: 'Orthographic globe with a graticule',
    family: 'Maps and Spatial',
    rule: "§5 — a meridian is chrome, and glGeoShape's ink-3 default lands it correctly",
    built: "glGeoShape over a generated graticule + fit: 'sphere'",
    status: 'partial',
    gaps: [
      'There is no sphere outline, so the globe has no edge where no landmass ' +
        'reaches it. Drawing one means a synthetic `{ type: "Sphere" }` feature and ' +
        'an ink for it, and `grammar.md` §5 rules on boundaries and graticules but ' +
        'not on the globe\'s own limb.',
      'The graticule is generated in `tanstack-data.ts` rather than taken from ' +
        '`d3-geo`\'s `geoGraticule`, because the library never writes ' +
        '`from \'d3-geo\'` and a gallery plate should not be the one place that ' +
        'does. Meridians carry 37 vertices each so they bend under the projection — ' +
        'a four-point meridian draws as a straight chord on a globe.',
    ],
  },
  {
    id: 'ts-40-geojson-map',
    tanstack: '40-geojson-map',
    kind: 'Pre-projected geometry',
    family: 'Maps and Spatial',
    rule: 'geoIdentity is the case "the caller picks the projection" was written for',
    built: 'glGeoShape + geoIdentity().reflectY(true)',
    status: 'built',
    gaps: [],
  },
  {
    id: 'ts-110-projection-gallery',
    tanstack: '110-projection-gallery',
    kind: 'The same world under four projections',
    family: 'Maps and Spatial',
    rule: 'The projection is one argument; every other GL rule holds across all four',
    built: 'four glCharts, one glGeoShape each, identical but for the type function',
    status: 'partial',
    gaps: [
      'The four panels are placed by the plate\'s own grid and each carries an ' +
        'HTML caption, because a map has no axis to label. `facet` cannot help — it ' +
        'splits one dataset by a channel, and this is one dataset drawn four ways. ' +
        'The same linked-panel shortfall the marginal-histogram plate records.',
    ],
  },
  {
    id: 'ts-38-contour-topography',
    tanstack: '38-contour-topography',
    kind: 'Filled topographic contours',
    family: 'Maps and Spatial',
    rule: '§12 — five equal-width steps of one hue; darker is higher, always',
    built: 'glContourGrid (pinned thresholds) + glGeoShape + glSequentialColor',
    status: 'built',
    gaps: [],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Interactive
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ts-34-pointer-tooltip',
    tanstack: '34-pointer-tooltip',
    kind: 'Pointer-selected tooltip, at rest',
    family: 'Interactive',
    rule: '§3.4.2 — a pointer is chrome: dashed ink-3, and it ignores tone',
    built: 'glRuleX + glLine + glPoint + glLabel + labelHalo',
    status: 'partial',
    gaps: [
      INTERACTION_GAP,
      'What a tooltip would SAY is drawn as a label, because a tooltip\'s own ' +
        'surface, padding, type scale and connector are unruled. That is the ' +
        'largest single hole this exercise found in `grammar.md`.',
    ],
  },
  {
    id: 'ts-35-grouped-tooltip',
    tanstack: '35-grouped-tooltip',
    kind: 'Grouped read at one x position',
    family: 'Interactive',
    rule: 'Decision Rule 2 — each value is labelled in its own series\' DARK tone',
    built: 'glRuleX + popUp + glPoint + glLabel per series + labelHalo',
    status: 'partial',
    gaps: [INTERACTION_GAP],
  },
  {
    id: 'ts-80-echarts-axis-pointer',
    tanstack: '80-echarts-axis-pointer',
    kind: 'Pointer that labels its own axis position',
    family: 'Interactive',
    rule: '§3.5 — the pointer\'s axis label is a tick, so it takes axis ink',
    built: 'glRuleX + popUp + glAxisX with the pointer position in `values`',
    status: 'partial',
    gaps: [
      INTERACTION_GAP,
      'Snapping is invisible at rest. The plate shows the axis-side half — the ' +
        'pointer carrying its own value among the ordinary ticks — which is the ' +
        'one piece of pointer chrome that already has a home in the rules.',
    ],
  },
  {
    id: 'ts-88-echarts-free-cursor',
    tanstack: '88-echarts-free-cursor',
    kind: 'Crosshair over a dense scatter',
    family: 'Interactive',
    rule: '§3.4.2 — two rules, both chrome; a saturated crosshair reads as a series',
    built: 'glRuleX + glRuleY + glPoint (muted) + glPoint (focus)',
    status: 'partial',
    gaps: [INTERACTION_GAP],
  },
  {
    id: 'ts-84-pinned-nested-chart-tooltip',
    tanstack: '84-pinned-nested-chart-tooltip',
    kind: 'A tooltip containing a chart',
    family: 'Interactive',
    rule: '§3.1 — the selected group is the pop-up effect; the detail is a second chart',
    built: 'popUp + glPoint over a dodged x, plus a second glChart for the detail',
    status: 'partial',
    gaps: [
      INTERACTION_GAP,
      'The nested chart is placed above the main one rather than ANCHORED to the ' +
        'selected mark. Anchoring needs the mark\'s resolved pixel position, and a ' +
        'chart definition cannot see it — the same reason the treemap has to be a ' +
        'build function rather than a spec.',
    ],
  },
  {
    id: 'ts-81-recharts-interactive-legend',
    tanstack: '81-recharts-interactive-legend',
    kind: 'Interactive series legend',
    family: 'Interactive',
    rule: 'The spec prefers a DIRECT LABEL to a legend wherever the chart allows it',
    built: 'popUp + endLabels + GLLegend',
    status: 'partial',
    gaps: [
      INTERACTION_GAP,
      'The plate deliberately carries both a legend and the end labels that make ' +
        'it redundant. That redundancy is the finding: an interactive legend is a ' +
        'CONTROL, and once it is only a control the chart still has to be readable ' +
        'without touching it.',
    ],
  },
  {
    id: 'ts-82-chart-table-selection',
    tanstack: '82-chart-table-selection',
    kind: 'Chart and table selecting each other',
    family: 'Interactive',
    rule: '§3.1 — a selected mark is the pop-up effect, not a new visual state',
    built: 'popUp + glMutedBarX + glBarX + glLabel',
    status: 'partial',
    gaps: [
      INTERACTION_GAP,
      'Only one side of the link is here: a table is not a chart and the library ' +
        'draws no tables. Worth recording as a positive result too — §3.1 already ' +
        'answers "what does a selected bar look like", so selection needed no new ' +
        'rule at all.',
    ],
  },
  {
    id: 'ts-89-brush-range-selection',
    tanstack: '89-brush-range-selection',
    kind: 'Brushed range selection',
    family: 'Interactive',
    rule: '§3.9 — a band is the light tone at full opacity, so a brush is greyscale-safe',
    built: 'glBandX + glLine',
    status: 'partial',
    gaps: [INTERACTION_GAP],
  },
  {
    id: 'ts-83-focus-context-window',
    tanstack: '83-focus-context-window',
    kind: 'Focus window over a context strip',
    family: 'Interactive',
    rule: '§3.9 — the context strip is muted and the window it names is a band',
    built: 'two glCharts: a focus line, and a muted full series under a glBandX',
    status: 'partial',
    gaps: [
      INTERACTION_GAP,
      'The two charts are independent and placed by the plate. A linked-panel ' +
        'layout would guarantee the context strip\'s domain contains the focus ' +
        'chart\'s; here that is true only because both were pinned by hand.',
    ],
  },
  {
    id: 'ts-90-zoomable-time-window',
    tanstack: '90-zoomable-time-window',
    kind: 'Wheel zoom over a time window',
    family: 'Interactive',
    rule: '§3.5 — a zoomed axis relabels itself; dateTicks picks the unit from the span',
    built: 'glLine + glPoint + timeAxisFor over the zoomed slice',
    status: 'partial',
    gaps: [INTERACTION_GAP],
  },
  {
    id: 'ts-86-streaming-window-preservation',
    tanstack: '86-streaming-window-preservation',
    kind: 'Streaming series with a preserved window',
    family: 'Interactive',
    rule: '§3.9 — shading the RETAINED span is what shows the window is fixed',
    built: 'glBandX + glMutedLine + glLine + glPoint at the head',
    status: 'partial',
    gaps: [INTERACTION_GAP],
  },
  {
    id: 'ts-91-timeline-playback-scrubber',
    tanstack: '91-timeline-playback-scrubber',
    kind: 'Playback scrubber',
    family: 'Interactive',
    rule: '§3.1 — played and unplayed are the pop-up effect, used as progress',
    built: 'glRuleX playhead + glMutedLine (ahead) + glLine (behind) + glPoint',
    status: 'partial',
    gaps: [INTERACTION_GAP],
  },
  {
    id: 'ts-87-echarts-synchronized-cursors',
    tanstack: '87-echarts-synchronized-cursors',
    kind: 'Synchronized cursors across two views',
    family: 'Interactive',
    rule: 'A shared position must be identifiably ONE mark in both panels',
    built: 'two glCharts, the same glRuleX at the same x in each',
    status: 'partial',
    gaps: [
      INTERACTION_GAP,
      'Same linked-panel shortfall: the two charts share an x domain only because ' +
        'both were pinned, and nothing checks that they still do.',
    ],
  },
  {
    id: 'ts-85-scrollable-resource-lanes',
    tanstack: '85-scrollable-resource-lanes',
    kind: 'Resource timeline lanes',
    family: 'Interactive',
    rule: '§8c — phase is ORDERED, so it walks one hue light → main → dark',
    built: 'glBarX (x1/x2) + glAxisBand of lanes + toneRamp + glLabel + labelHalo',
    status: 'partial',
    gaps: [
      INTERACTION_GAP,
      'Scrolling is the interaction and the chart under it is an ordinary ranged ' +
        'bar per event. Worth noting as a form the spec PDF had no plate for and ' +
        'that needed no new rule to draw.',
    ],
  },
  {
    id: 'ts-92-editable-event-range',
    tanstack: '92-editable-event-range',
    kind: 'Editable event range',
    family: 'Interactive',
    rule: '§3.4.2 — a drag handle is a DATA tick: 8px, twice the axis tick',
    built: 'the lane chart + glTickY ×2 in c-2 at the editable range\'s ends',
    status: 'partial',
    gaps: [
      INTERACTION_GAP,
      'The handles needed no new rule, which is the useful result: §3.4.2 sizes a ' +
        'data tick at twice the axis tick precisely so a tick carrying a value ' +
        'cannot be mistaken for chrome, and a handle is a value the reader can move.',
    ],
  },
  {
    id: 'ts-65-voronoi-nearest-tooltip',
    tanstack: '65-voronoi-nearest-tooltip',
    kind: 'Voronoi nearest-point partition',
    family: 'Interactive',
    rule: '§3.4 — cells tile the plane and cannot overlap, so they are opaque tiles',
    built: 'glVoronoiCells + glVoronoiFeatures + glGeoShape + glSequentialColor',
    status: 'partial',
    gaps: [
      INTERACTION_GAP,
      'The geometry is now built, which changes what this plate shows: the cells ' +
        'exist in the catalog entry to route POINTER EVENTS, and drawing them is ' +
        'more informative than describing them — each cell IS the region a cursor ' +
        'would resolve to, so the plate renders the hit-testing rather than ' +
        'asserting it. What is still absent is only the routing.',
    ],
  },
];
