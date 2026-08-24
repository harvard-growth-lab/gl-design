/**
 * GLTone resolution.
 *
 * `tokens.ts` is generated from `tokens.json` and holds values only, so the two
 * functions that read the palette live here instead. Both existed in three
 * places before this file did — `marks.ts`, `figure.tsx` and `tokens.ts` each
 * had their own copy of "a palette key, the muted grey, or an explicit triple",
 * which is one copy per consumer of a five-line function.
 *
 * The three tones, three jobs rule (the most-violated rule in the spec):
 *   main  → every fill and every line
 *   dark  → strokes on OVERLAPPING marks, and every text element tied to the
 *           color: direct labels, legend entries, callouts, annotations
 *   light → backgrounds, faded states, sequential ramp tail
 *
 * The only place `dark` is used as a *fill* is the three-tone stacked area.
 */

import {
  categorical,
  muted,
  paletteOrder,
  type GLCategoricalKey,
  type GLTone,
} from './tokens.js';

/** A palette key, the muted grey, or an explicit tone triple. */
export type GLToneRef = GLCategoricalKey | 'muted' | GLTone;

/** Which step of a triple a mark paints with. */
export type GLToneStep = 'light' | 'main' | 'dark';

/**
 * Resolve a tone reference to its triple. Defaults to `c-1` — the
 * single-series default, and the hue the spec spends first.
 */
export function resolveTone(tone: GLToneRef = 'c-1'): GLTone {
  if (tone === 'muted') return muted;
  if (typeof tone === 'string') return categorical[tone];
  return tone;
}

/**
 * The nth categorical hue in spec order — c-1 first, then c-2, and so on. This
 * is also the order TanStack's color scale spends the palette in, which is why
 * a direct label for series *i* can take `series(i)` and match the mark it
 * names without either side coordinating.
 *
 * Wraps past six — but if you are wrapping, the chart has too many series:
 * mute the rest and let one or two focus series carry the finding
 * (Decision Rule 1 + §14).
 */
export function series(index: number): GLTone {
  return categorical[seriesKeyAt(index)];
}

/** The nth palette *key*, for APIs that want the name rather than the triple. */
export function seriesKeyAt(index: number): GLCategoricalKey {
  return paletteOrder[index % paletteOrder.length];
}
