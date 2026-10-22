/**
 * The plate catalog — which worked examples in the spec PDF we reproduce, and
 * where each one lives in the source document.
 *
 * This is plain `.mjs` on purpose: `plates.mjs` (which needs nothing but poppler)
 * and `catalog.tsx` (which needs the whole bundler) both read it, and the crop
 * step must not depend on the render step being buildable.
 *
 * `status` is the honest coverage signal:
 *   'built'   — reproduced with gl-charts presets; a generated plate exists
 *   'partial' — reproduced, but something in it is hand-rolled in the gallery
 *               rather than supplied by the library (noted in `gaps`)
 *   'missing' — the spec has this chart type and gl-charts cannot express it yet
 *
 * `gaps` carries what is still wrong or still owed. A plate can be 'built' and
 * still list a gap — the entries marked "divergence" are places where the
 * library is deliberately right and the PDF is wrong, recorded so nobody
 * "fixes" them back toward the plate.
 */

/** @typedef {'built' | 'partial' | 'missing'} PlateStatus */

export const PLATES = [
  {
    id: 'fig-01-scatter',
    figure: '1',
    page: 12,
    kind: 'Scatter plot',
    status: 'built',
    gaps: [
      'Divergence: the zero gridline renders at axis weight, which grammar.md ' +
        'line 373 requires and the plate does not do. On an index that crosses ' +
        'zero (ECI) that is a dark rule across mid-plot. grammar.md wins.',
      'Divergence: the plate paints South Asia in c-4 purple as its third ' +
        'series. Decision Rule 1 spends the palette in order, so this is c-3.',
    ],
  },
  {
    id: 'fig-02-line',
    figure: '2',
    page: 13,
    kind: 'Line chart — four series',
    status: 'built',
    gaps: [
      "Divergence: the plate's own series labels are placeholders (x, y, z, t) " +
        'and its third series is c-4 purple. This plate names the series and ' +
        'spends the palette in order.',
    ],
  },
  {
    id: 'fig-03-stacked-bar',
    figure: '3',
    page: 14,
    kind: 'Stacked bar — four categories',
    status: 'built',
    gaps: [],
  },
  {
    id: 'fig-03b-two-tone',
    figure: '3B',
    page: 15,
    kind: 'Stacked bar — two tones of one hue',
    status: 'built',
    gaps: [],
  },
  {
    id: 'fig-03c-three-tone',
    figure: '3C',
    page: 16,
    kind: 'Stacked area — three tones of one hue',
    status: 'built',
    gaps: [],
  },
  {
    id: 'fig-04-treemap',
    figure: '4',
    page: 17,
    kind: 'Treemap',
    status: 'built',
    gaps: [
      'Divergence: the plate draws tiles at 0.8 opacity with dark strokes. ' +
        'grammar.md overrules that page — the PDF contradicts itself, see ' +
        'docs/data-vis-spec-core.md §0 — so tiles render full opacity, no ' +
        'stroke, separated by the 5px paper gutter of SPEC.md §3.4.1.',
      'Divergence: the plate is hand-laid, not squarified, so the arrangement ' +
        'will not match tile-for-tile at any plot width — only the gutter, the ' +
        'label geometry and the tile aspect match. Measured on this render: ' +
        'gutter 5.0px against the plate\'s 4.8, left pad 12.5 against 11.5-12.0, ' +
        'name cap-top 15.5 against 16.3-16.8, line step 16.0 against ~15.5.',
      'Divergence: in-tile label ink follows the fill\'s lightness (paper below ' +
        '0.4 relative luminance, ink at or above), so the c-3 teal tile takes ' +
        'paper where the plate uses ink. The plate is the inconsistent party — ' +
        'it gives ink to c-3 at 0.291 while giving paper to c-5, which is ' +
        'lighter at 0.336. See labelInkOn() in src/treemap.ts.',
      'Known: "Everything else" goes unlabelled at this width. Its tile comes ' +
        'out 97.5px wide and the label is estimated at 89.2px, which does not ' +
        'clear 12px padding on both sides. The plate labels it by overrunning ' +
        'its own right padding by ~7px; the fit test will not do that. Filed ' +
        'under Deliberate divergences in the report.',
    ],
  },
  {
    id: 'fig-05-radar',
    figure: '5',
    page: 18,
    kind: 'Radar chart',
    status: 'built',
    gaps: [
      'The scale ticks run up the vertical spoke and the 1.0 tick collides with ' +
        'the "Complexity" axis label above it: labelDx offsets the tick run ' +
        'sideways but nothing moves the axis label out of its way.',
    ],
  },
  {
    id: 'fig-06-boxplot',
    figure: '6',
    page: 19,
    kind: 'Boxplot / violin',
    status: 'partial',
    gaps: [
      'GLDistributionOptions exposes valueLabel and valueFormat but no tick ' +
        'control, so the value axis cannot be pinned to the plate\'s ' +
        '$0/$5k/$10k/$15k/$20k. glAxisY already takes `values` and `tickCount`; ' +
        'the preset just does not forward them.',
      'The plate carries a second end-label, "Peer median", pointing at the box ' +
        'medians. Nothing in the preset labels the distribution itself — a ' +
        'second focus series would draw a muted LINE the plate does not have.',
    ],
  },
  {
    id: 'fig-07-choropleth-sequential',
    figure: '7',
    page: 21,
    kind: 'Geomap — sequential',
    status: 'built',
    gaps: [
      'Divergence: the step legend renders ABOVE the map, which is where §12\'s ' +
        '"under the title" lands once GLFigure puts the title above the plot. ' +
        'Both plates put it under the map instead. TanStack\'s colorLegend has ' +
        'no placement option, so this is not currently a choice.',
      'The default boundary format prints "-1 / -0.5 / 0 / 0.5 / 1 / 1.5"; the ' +
        'plate prints "-1.0 … +1.5". A signed, fixed-decimal default would read ' +
        'better on any centred scale.',
    ],
  },
  {
    id: 'fig-08-choropleth-diverging',
    figure: '8',
    page: 22,
    kind: 'Geomap — diverging',
    status: 'partial',
    gaps: [
      'Bins are always equal-width across the domain, so the six steps cut at ' +
        '-6/-4/-2/0/+2/+4/+6. The plate uses hand-set breaks at ' +
        '-6/-3/-1/+1/+3/+6 to give the near-zero band its own bin. ' +
        'GLChoroplethColorOptions takes `steps` but no `thresholds`.',
      'Divergence: the plate paints this map in div-5-1 (orange↔blue). §13 and ' +
        'grammar.md both say red negative / blue positive, which is div-2-1 and ' +
        'the library default, so the plate is the outlier.',
    ],
  },
  {
    id: 'fig-09-popup-scatter',
    figure: '9',
    page: 23,
    kind: 'Pop-up effect — bubble scatter',
    status: 'built',
    gaps: [
      'The focus label sits left of its bubble; the plate puts it upper-right. ' +
        'Both clear the mark. Placing it on the side with more room would need ' +
        'the resolved scale, which the preset does not have at definition time.',
    ],
  },
  {
    id: 'fig-10-popup-line',
    figure: '10',
    page: 23,
    kind: 'Pop-up effect — line',
    status: 'built',
    gaps: [],
  },
  {
    id: 'fig-11-popup-treemap',
    figure: '11',
    page: 24,
    kind: 'Pop-up effect — treemap',
    status: 'built',
    gaps: [
      'MEASURED 2026-08-06, ruling PENDING (SPEC.md A1): this plate is the ' +
        'argument for giving flat treemaps a separator. The gutter is 4.8px on ' +
        'both axes here and in Figure 4, so SPEC.md §3.4.1 proposes a 5px paper ' +
        'gutter at every depth, and this library draws one — the seven muted ' +
        'tiles read as seven tiles again. Note this DEPARTS from grammar.md, ' +
        'which still says flat treemaps abut directly and only two-level ones ' +
        'take paper strokes. Needs a ruling before it propagates.',
      'MEASURED 2026-08-06, ruling PENDING (SPEC.md A3/C3): paper on c-muted ' +
        'measured about 2:1. The plate does not use paper there — it uses ' +
        'near-black ink, sampled #1A1A1A. Tile ink here follows the fill\'s ' +
        'lightness, so muted tiles take ink at 8.65:1. A different AA gap ' +
        'survives on c-1, c-3 and c-5 and is filed as SPEC.md C3.',
    ],
  },
];

/** Plates we actually attempt to render. */
export const RENDERABLE = PLATES.filter((p) => p.status !== 'missing');

export const byId = Object.fromEntries(PLATES.map((p) => [p.id, p]));
