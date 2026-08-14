/**
 * The whole TanStack Charts catalog, as data.
 *
 * ## Why this file exists at all
 *
 * `tanstack-ref.mjs` used to enumerate the catalog out of
 * `node_modules/@tanstack/charts/docs/examples/*.md`, which is deterministic and
 * offline and was the right call — except that it answers a narrower question
 * than the one we ask of it. The shipped docs embed **67** slugs. The published
 * catalog at <https://tanstack.com/charts/catalog> carries **102**. The docs are
 * a curated tour; the catalog is the roster.
 *
 * Measuring coverage against 67 therefore flattered the number by a third, and
 * the entries it silently omitted were not a random third — they were the pie
 * variants, the interaction family, the composed and small-multiple charts. The
 * ones most likely to expose a rule `grammar.md` has not written yet.
 *
 * So the roster is transcribed here instead, and `catalogSlugs()` unions it with
 * whatever the pinned docs embed. That keeps both properties:
 *
 *   - **Offline and deterministic.** A checked-in list needs no network, and
 *     `npm run gallery` stays a gate that can run on a plane.
 *   - **Self-correcting.** `--audit` diffs this list against the pinned docs and
 *     prints anything the docs embed that is missing here, so a TanStack upgrade
 *     that adds an example surfaces as a report rather than as silence.
 *
 * What it cannot do is notice an example added to the *website* without a docs
 * page. That is a re-transcription, and `CATALOG_SOURCE` below records when this
 * was last done so the staleness is visible rather than assumed.
 *
 * ## `category` is TanStack's word, `family` is theirs too
 *
 * The catalog groups by a one-word *category* ("Trend", "Polar"); the docs group
 * by a longer *family* ("Lines and Areas", "Polar and Radar"). They are different
 * taxonomies over the same charts and neither is a superset. Specimens record the
 * family, because that is what `reference/tanstack-example-coverage.md` counts in;
 * this file records the category, because that is what the page the user is
 * looking at shows. Keeping both is what lets the two documents be checked
 * against each other instead of trusted.
 */

/** When the roster below was last transcribed from the live catalog. */
export const CATALOG_SOURCE = {
  url: 'https://tanstack.com/charts/catalog',
  transcribed: '2026-08-07',
  /** What the live page listed. The roster below adds one the docs embed and it doesn't. */
  listed: 102,
};

/**
 * @typedef {object} CatalogEntry
 * @property {string} slug   The `/charts/catalog/embed/<slug>` path segment.
 * @property {string} title  The catalog's own title for the example.
 * @property {string} category TanStack's one-word grouping on the catalog page.
 */

/** @type {readonly CatalogEntry[]} */
export const CATALOG = [
  // ── Trend ─────────────────────────────────────────────────────────────────
  { slug: '01-line-gaps', title: 'Apple stock line with seasonal gaps', category: 'Trend' },
  { slug: '02-multi-line-end-labels', title: 'Industry unemployment with end labels', category: 'Trend' },
  { slug: '19-moving-average-line', title: 'San Francisco temperature moving averages', category: 'Trend' },
  { slug: '22-bollinger-band', title: 'Bollinger band', category: 'Trend' },
  { slug: '55-indexed-multi-line', title: 'Indexed industry unemployment', category: 'Trend' },
  { slug: '58-select-extrema', title: 'Annotated AAPL extrema', category: 'Trend' },

  // ── Range ─────────────────────────────────────────────────────────────────
  { slug: '03-temperature-range-band', title: 'San Francisco temperature range band', category: 'Range' },

  // ── Composition ───────────────────────────────────────────────────────────
  { slug: '04-stacked-time-area', title: 'Industry unemployment stacked area', category: 'Composition' },
  { slug: '20-normalized-stacked-area', title: 'Industry share of unemployment', category: 'Composition' },
  { slug: '21-streamgraph', title: 'Streamgraph', category: 'Composition' },
  { slug: '29-waterfall', title: 'Annual gasoline-price waterfall', category: 'Composition' },
  { slug: '70-composed-chart', title: 'Layered Seattle weather chart', category: 'Composition' },

  // ── Bar ───────────────────────────────────────────────────────────────────
  { slug: 'bar-vertical-sorted', title: 'Sorted vertical bars', category: 'Bar' },
  { slug: 'bar-horizontal-ranking', title: 'Horizontal ranking with long labels', category: 'Bar' },
  { slug: 'bar-grouped', title: 'Grouped bars', category: 'Bar' },
  { slug: 'bar-stacked', title: 'Stacked bars', category: 'Bar' },
  { slug: '59-grouped-reducer-bars', title: 'Mean penguin mass reducer bars', category: 'Bar' },

  // ── Relationship ──────────────────────────────────────────────────────────
  { slug: 'scatter-bubble', title: 'Bubble scatterplot', category: 'Relationship' },
  { slug: '31-linear-regression', title: 'Scatterplot with linear regression', category: 'Relationship' },
  { slug: '53-log-scale-scatter', title: 'Log-scale Flare class sizes', category: 'Relationship' },
  { slug: '56-connected-scatter', title: 'Directed connected scatterplot', category: 'Relationship' },
  { slug: '60-lag-autocorrelation', title: 'AAPL lag-one autocorrelation', category: 'Relationship' },
  { slug: '73-many-point-scatter', title: 'Automobile specifications scatter', category: 'Relationship' },

  // ── Distribution ──────────────────────────────────────────────────────────
  { slug: 'histogram', title: 'Histogram', category: 'Distribution' },
  { slug: '15-boxplot', title: 'Grouped boxplot', category: 'Distribution' },
  { slug: '18-cumulative-histogram', title: 'Cumulative histogram', category: 'Distribution' },
  { slug: '24-quantitative-binned-heatmap', title: 'Quantitative binned heatmap', category: 'Distribution' },
  { slug: '39-density-contours', title: 'Point density contours', category: 'Distribution' },
  { slug: '43-hexbin-density', title: 'Hexagonally binned density', category: 'Distribution' },
  { slug: '50-empirical-cdf', title: 'Empirical cumulative distribution', category: 'Distribution' },
  { slug: '51-faceted-distributions', title: 'Faceted distributions', category: 'Distribution' },
  { slug: '52-beeswarm-dodge', title: 'Beeswarm distribution', category: 'Distribution' },
  { slug: '57-scatter-marginal-histograms', title: 'Scatterplot with marginal histograms', category: 'Distribution' },
  { slug: '62-ridgeline-density', title: 'Ridgeline density comparison', category: 'Distribution' },
  { slug: '63-violin-distributions', title: 'Violin distribution comparison', category: 'Distribution' },

  // ── Matrix ────────────────────────────────────────────────────────────────
  { slug: 'heatmap-labeled', title: 'Labeled ordinal heatmap', category: 'Matrix' },

  // ── Small Multiples ───────────────────────────────────────────────────────
  { slug: 'facets-anscombe', title: 'Anscombe quartet small multiples', category: 'Small Multiples' },

  // ── Interval ──────────────────────────────────────────────────────────────
  { slug: '13-interval-timeline', title: 'Open-to-close price intervals', category: 'Interval' },

  // ── Uncertainty ───────────────────────────────────────────────────────────
  { slug: '14-error-bars', title: 'Point estimates with error bars', category: 'Uncertainty' },
  { slug: '61-quantile-ribbon', title: 'Industry unemployment percentile ribbon', category: 'Uncertainty' },

  // ── Comparison ────────────────────────────────────────────────────────────
  { slug: '16-lollipop', title: 'Ranked lollipop chart', category: 'Comparison' },
  { slug: '17-dumbbell', title: 'Dumbbell comparison', category: 'Comparison' },
  { slug: '71-recharts-population-pyramid', title: 'Palmer penguins by species and sex', category: 'Comparison' },
  { slug: '72-recharts-mixed-bars', title: 'Stacked and adjacent Seattle weather bars', category: 'Comparison' },

  // ── Time ──────────────────────────────────────────────────────────────────
  { slug: '25-calendar-heatmap', title: 'Calendar heatmap', category: 'Time' },

  // ── Survey ────────────────────────────────────────────────────────────────
  { slug: '26-diverging-likert', title: 'Diverging Likert responses', category: 'Survey' },

  // ── Multivariate ──────────────────────────────────────────────────────────
  { slug: '27-parallel-coordinates', title: 'Parallel coordinates', category: 'Multivariate' },

  // ── Financial ─────────────────────────────────────────────────────────────
  { slug: '28-candlestick', title: 'Candlestick chart', category: 'Financial' },

  // ── Change ────────────────────────────────────────────────────────────────
  { slug: '30-slopegraph', title: 'Two-period slopegraph', category: 'Change' },
  { slug: '32-change-arrows', title: 'Metro inequality change arrows', category: 'Change' },
  { slug: '33-difference-chart', title: 'Apple close versus moving average', category: 'Change' },

  // ── Interaction ───────────────────────────────────────────────────────────
  { slug: '34-pointer-tooltip', title: 'Pointer-selected tooltip', category: 'Interaction' },
  { slug: '35-grouped-tooltip', title: 'Grouped X tooltip', category: 'Interaction' },
  { slug: '65-voronoi-nearest-tooltip', title: 'Voronoi nearest-point interaction', category: 'Interaction' },
  { slug: '80-echarts-axis-pointer', title: 'Snapped axis pointer with grouped tooltip', category: 'Interaction' },
  { slug: '81-recharts-interactive-legend', title: 'Interactive series legend', category: 'Interaction' },
  { slug: '82-chart-table-selection', title: 'Linked chart and data table selection', category: 'Interaction' },
  { slug: '83-focus-context-window', title: 'Focus and context time window', category: 'Interaction' },
  { slug: '84-pinned-nested-chart-tooltip', title: 'Pinned penguin tooltip with a nested chart', category: 'Interaction' },
  { slug: '85-scrollable-resource-lanes', title: 'Scrollable resource timeline lanes', category: 'Interaction' },
  { slug: '86-streaming-window-preservation', title: 'Streaming window preservation', category: 'Interaction' },
  { slug: '87-echarts-synchronized-cursors', title: 'Synchronized cursors across views', category: 'Interaction' },
  { slug: '88-echarts-free-cursor', title: 'Free cursor over car measurements', category: 'Interaction' },
  { slug: '89-brush-range-selection', title: 'Observed monthly AAPL brush selection', category: 'Interaction' },
  { slug: '90-zoomable-time-window', title: 'Wheel zoom and pan over AAPL closes', category: 'Interaction' },
  { slug: '91-timeline-playback-scrubber', title: 'AAPL close playback scrubber', category: 'Interaction' },
  { slug: '92-editable-event-range', title: 'Editable event range', category: 'Interaction' },

  // ── Hierarchy ─────────────────────────────────────────────────────────────
  { slug: '36-hierarchy-tree', title: 'Tidy hierarchy tree', category: 'Hierarchy' },
  { slug: '74-recharts-treemap', title: 'Flare analytics treemap', category: 'Hierarchy' },
  { slug: '101-sunburst', title: 'Flare analytics sunburst', category: 'Hierarchy' },

  // ── Spatial ───────────────────────────────────────────────────────────────
  { slug: '37-delaunay-network', title: 'Delaunay spatial network', category: 'Spatial' },
  { slug: '38-contour-topography', title: 'Filled wind-speed contours', category: 'Spatial' },
  { slug: '42-vector-field', title: 'Two-dimensional vector field', category: 'Spatial' },

  // ── Geography ─────────────────────────────────────────────────────────────
  { slug: '40-geojson-map', title: 'Westport House floor plan', category: 'Geography' },
  { slug: '102-world-choropleth', title: 'World learning-poverty choropleth', category: 'Geography' },
  { slug: '103-bubble-map', title: 'World population bubble map', category: 'Geography' },
  { slug: '104-orthographic-globe', title: 'Orthographic globe with graticule', category: 'Geography' },
  { slug: '105-route-map', title: 'HMS Beagle voyage', category: 'Geography' },
  { slug: '108-country-choropleth', title: 'World population-density choropleth', category: 'Geography' },
  { slug: '109-us-state-choropleth', title: 'United States county unemployment choropleth', category: 'Geography' },
  { slug: '110-projection-gallery', title: 'Standard world projection gallery', category: 'Geography' },

  // ── Network ───────────────────────────────────────────────────────────────
  { slug: '40-force-directed-network', title: 'Les Misérables character network', category: 'Network' },
  { slug: '111-basic-sankey', title: 'Basic Sankey', category: 'Network' },
  { slug: '111-sankey-flow', title: 'Sankey', category: 'Network' },

  // ── Part-to-Whole ─────────────────────────────────────────────────────────
  { slug: '41-waffle-unit-chart', title: 'English letter frequency waffle', category: 'Part-to-Whole' },
  { slug: '64-marimekko-mosaic', title: 'Marimekko survey composition', category: 'Part-to-Whole' },

  // ── Decoration ────────────────────────────────────────────────────────────
  { slug: '44-framed-scatter', title: 'Framed guide-free scatterplot', category: 'Decoration' },

  // ── Polar ─────────────────────────────────────────────────────────────────
  { slug: '75-radar', title: 'Simple radar chart', category: 'Polar' },
  { slug: '76-pie', title: 'English letter frequency pie', category: 'Polar' },
  { slug: '77-donut', title: 'English letter frequency donut', category: 'Polar' },
  { slug: '78-gauge', title: 'Survey agreement share gauge', category: 'Polar' },
  { slug: '93-labeled-pie', title: 'Letter frequency pie with labels', category: 'Polar' },
  { slug: '94-center-donut', title: 'Letter frequency donut with total', category: 'Polar' },
  { slug: '95-rounded-donut', title: 'Rounded letter frequency donut', category: 'Polar' },
  { slug: '96-nested-donut', title: 'Nested Flare package sizes', category: 'Polar' },
  { slug: '97-rose', title: 'English letter frequency rose', category: 'Polar' },
  { slug: '98-needle-gauge', title: 'County unemployment gauge', category: 'Polar' },
  { slug: '99-comparative-radar', title: 'Comparative radar chart', category: 'Polar' },
  { slug: '100-radial-bars', title: 'Concentric letter frequency bars', category: 'Polar' },
  { slug: '106-polar-line', title: 'Seattle daily high-temperature polar line', category: 'Polar' },
  { slug: '107-polar-scatter', title: 'Surface wind polar scatter', category: 'Polar' },

  // ── Ranking ───────────────────────────────────────────────────────────────
  { slug: '54-bump-ranking', title: 'Industry unemployment bump chart', category: 'Ranking' },

  // ── Only in the pinned docs ───────────────────────────────────────────────
  // The union works in both directions, and this is the direction that proves
  // it: `heatmaps-and-densities.md` in 0.6.5 embeds this slug and the live
  // catalog page does not list it. Enumerating from either source alone would
  // have lost an example — the website's roster is ahead of the docs in general
  // and behind them here.
  { slug: '118-token-usage-calendar', title: 'Token usage calendar', category: 'Time' },
];

/** Slug → entry, for the places that have a slug and want its title. */
export const catalogBySlug = Object.fromEntries(CATALOG.map((e) => [e.slug, e]));

/** Categories in the order the catalog page shows them. */
export const CATALOG_CATEGORIES = [...new Set(CATALOG.map((e) => e.category))];
