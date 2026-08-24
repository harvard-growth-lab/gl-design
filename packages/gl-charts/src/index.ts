/**
 * @growth-lab/gl-charts — the Growth Lab data-visualization spec over
 * TanStack Charts v0.
 *
 * This entry point is the thin layer: tokens, tone resolution, the theme and
 * axis presets, GL-defaulted marks, and the compose helpers for the moves the
 * spec names. All of it produces plain `ChartDefinition` data, and none of it
 * pulls in React — the figure chrome lives at `@growth-lab/gl-charts/react`, so a
 * Vue, Svelte or vanilla consumer never sees it.
 *
 * The chart types TanStack cannot express at all — radar, polar, treemap,
 * boxplot/violin, choropleth, the graph layouts (Sankey, force, Delaunay and its
 * Voronoi dual) and contours — live behind `@growth-lab/gl-charts/shapes`. They
 * carry their own geometry (a squarified layout, a KDE, a projection, a settled
 * simulation, marching squares) and are several times the size of everything
 * here, so they are a separate import rather than a tax on every consumer.
 *
 * There are deliberately no whole-chart presets for the Cartesian types. See the
 * header of `chart.ts` for why, and `gallery/catalog.tsx` for one worked,
 * rendered, audited recipe per figure in the spec.
 *
 * Don't forget the stylesheet — it carries the typography and the render
 * corrections without which TanStack draws gridlines and axis text off-spec:
 *
 *   import '@growth-lab/gl-charts/theme.css'
 */

// Values. Generated from tokens.json — see scripts/emit-tokens.mjs.
export * from './tokens.js';

// Palette logic: a tone reference resolved to its triple, and the nth hue.
export * from './tone.js';

// Scales the spec needs and TanStack doesn't ship: log axis, endpoint-pinned
// year ticks, sequential and diverging colour ramps.
export * from './scales.js';

// The theme object, the axis presets, and glChart().
export * from './chart.js';

// Mark defaults, and the table behind them.
export * from './marks.js';

// Hexagonal binning: the lattice and the mark that tiles with it. Here rather
// than in `marks.ts` because a hexbin is the one binned mark whose geometry the
// scale cannot supply — see that module's header.
export * from './hexbin.js';

// The spec's named moves: the pop-up effect, stack order, tone ramps, direct
// labels, year ticks pinned to the data.
export * from './compose.js';

export { default as glTokens } from './tokens.js';
