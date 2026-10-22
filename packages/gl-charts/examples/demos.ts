/**
 * The roster.
 *
 * Family order is the order the page reads in, and it is editorial rather than
 * alphabetical. It starts with the forms that answer *what changed* (lines,
 * composition), moves through *how much* and *how do they compare* (bars,
 * scatter, distributions, intervals), then the forms that need the reader to
 * have seen a plain chart first — annotations, densities, small multiples — and
 * ends with the specialised families: radial, structural, geographic, and the
 * interaction resting states, which are the least self-explanatory of all.
 *
 * Each family file owns its own demos and is registered here exactly once.
 */

import type { Family } from './demo.js';

import { annotationsFamily } from './demos-annotations.js';
import { barsFamily } from './demos-bars.js';
import { compositionFamily } from './demos-composition.js';
import { distributionsFamily } from './demos-distributions.js';
import { facetsFamily } from './demos-facets.js';
import { heatmapsFamily } from './demos-heatmaps.js';
import { interactionFamily } from './demos-interaction.js';
import { intervalsFamily } from './demos-intervals.js';
import { linesFamily } from './demos-lines.js';
import { mapsFamily } from './demos-maps.js';
import { networksFamily } from './demos-networks.js';
import { polarFamily } from './demos-polar.js';
import { scatterFamily } from './demos-scatter.js';

export const FAMILIES: readonly Family[] = [
  linesFamily,
  compositionFamily,
  barsFamily,
  scatterFamily,
  distributionsFamily,
  intervalsFamily,
  annotationsFamily,
  heatmapsFamily,
  facetsFamily,
  polarFamily,
  networksFamily,
  mapsFamily,
  interactionFamily,
];
