/**
 * `@growth-lab/gl-charts/shapes` — the chart types that need geometry of their
 * own, and the polar marks that reach the rest of the radial family.
 *
 * ## Why this is a separate entry point
 *
 * The library's guiding line is: **compose where TanStack can express the chart;
 * ship a whole-chart function only where it cannot.** A line, scatter, bar or
 * stacked chart is a handful of marks plus an axis preset, so the core entry
 * (`@growth-lab/gl-charts`) exports the marks and the compose helpers and you
 * write those charts out in five lines — there is no preset API for them, because
 * a preset would only be a worse spelling of the marks.
 *
 * These four are the cases where that fails. None of them share the Cartesian
 * machinery, and none of them can be assembled from TanStack marks at all:
 *
 * - **Radar** has no x/y axes. It reaches a different TanStack surface entirely
 *   (`@tanstack/charts/polar`) and has to sort rows onto the angle scale before
 *   drawing, or the polygon crosses itself.
 * - **Treemap** computes its own rectangles. TanStack ships no hierarchical
 *   layout of any kind, and the tiling has to run at the resolved pixel size, so
 *   the chart is a build function rather than a spec.
 * - **Boxplot / violin** summarise before they draw — five quantiles of one group
 *   at once, or a kernel-density estimate. TanStack's transform pipeline has a
 *   `quantile` reducer but nothing that produces either.
 * - **Choropleth** projects. Position comes from a `d3-geo` projection instead of
 *   a scale, and the ordered fill has to route through a chart-level colour scale
 *   the caller cannot reach.
 * - **Graph layouts** (`network.ts`) place before they draw. A Sankey's node
 *   rectangles and ribbon widths are pixel quantities; a force layout settles a
 *   simulation; a Delaunay triangulation is pure geometry. TanStack ships no
 *   layout of any kind, so all three come from d3 — `d3-sankey`, `d3-force`,
 *   `d3-delaunay`, declared and pinned exactly like `d3-hierarchy`.
 * - **Contours** (`contour.ts`) are marching squares over a grid, and the rings
 *   they produce have no mark to land on except `geoShape` — which is why they
 *   emit GeoJSON and travel the same route a coastline does.
 *
 * Keeping them behind their own subpath is what lets the core stay thin and
 * reviewable. It also means a consumer who never draws a map never pulls the geo
 * subpath (and with it `d3-geo`) into their bundle, and a consumer who never
 * draws a treemap never pays for `d3-hierarchy`.
 *
 * ## Polar is the exception, and shows the rule
 *
 * `polar.ts` sits here for the same reason radar does — it is the same
 * non-Cartesian TanStack surface — but almost all of it is *marks*, not whole
 * charts. `glRadialArc`, `glRadialLine`, `glRadialDot` and the rest route
 * through the same defaults table as their Cartesian counterparts, so a polar
 * line, a wind rose, a radial bar chart, a gauge and a sunburst are all
 * composable. Only `glDonutChart` is a whole-chart function, because a donut
 * needs angles computed from values before any mark exists and `grammar.md`
 * §3.8 caps its slice count — a rule about the data that a bare mark cannot
 * check.
 *
 * Radar keeps its preset because it needs the row-sorting, the shared radius
 * scale and the ring geometry; a caller who wants a radar variant the preset
 * does not cover can now build it from the marks instead of forking it.
 *
 * ## What you get
 *
 * Every builder here returns the same `GLChart` the core's `glChart()` returns —
 * `{ definition, className, props }` — and each sets its own variant class, so
 * the CSS a shape depends on cannot be forgotten at the call site:
 *
 * ```tsx
 * import { glTreemapChart } from '@growth-lab/gl-charts/shapes';
 *
 * const chart = glTreemapChart(rows, { category: 'product', value: 'exports' });
 * <Chart {...chart.props} height={300} ariaLabel="Export composition" />
 * ```
 *
 * The stylesheet is still the caller's to import — `@growth-lab/gl-charts/theme.css`
 * carries the typography and the render corrections these shapes rely on.
 */

export * from './shapes/radar.js';
export * from './shapes/polar.js';
export * from './shapes/treemap.js';
export * from './shapes/distribution.js';
export * from './shapes/geo.js';
export * from './shapes/network.js';
export * from './shapes/contour.js';
