/**
 * Types for `catalog-meta.mjs`.
 *
 * The catalog is plain `.mjs` on purpose — `plates.mjs` reads it with nothing but
 * poppler installed, so the crop step must not depend on the bundler. That leaves
 * the TypeScript side of the gallery (`catalog.tsx`) importing an untyped module,
 * which `npm run typecheck` rightly objects to. This declaration is the seam: the
 * shape is stated once here instead of being asserted at every import site.
 *
 * `status` is the honest coverage signal — see the header of `catalog-meta.mjs`
 * for what each value means and why a 'built' plate may still list a gap.
 */

export interface PlateMeta {
  id: string;
  figure: string;
  page: number;
  kind: string;
  status: 'built' | 'partial' | 'missing';
  gaps: readonly string[];
}

export declare const PLATES: readonly PlateMeta[];

/** Everything the renderer can actually shoot — `status !== 'missing'`. */
export declare const RENDERABLE: readonly PlateMeta[];

export declare const byId: Record<string, PlateMeta>;
