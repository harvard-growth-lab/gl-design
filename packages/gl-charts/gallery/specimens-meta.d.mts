/**
 * Types for `specimens-meta.mjs`.
 *
 * Plain `.mjs` for the same reason `catalog-meta.mjs` is: `render.mjs`,
 * `audit.mjs`, `compare.mjs` and `run.mjs` all read it with nothing but Node, so
 * the metadata must not depend on the bundler. This declaration is the seam that
 * lets `specimens.tsx` import it under `--strict`.
 *
 * See the header of `specimens-meta.mjs` for what a specimen is and why it has
 * no reference figure.
 */

export interface SpecimenMeta {
  id: string;
  /**
   * The catalog slug this specimen answers, if any.
   *
   * `npm run gallery:tanstack` screenshots `catalog/embed/<slug>` into the
   * plate's left column, and `gallery:tanstack:audit` uses the set of claimed
   * slugs as the coverage numerator. A specimen without one is answering a
   * `grammar.md` rule rather than a catalog entry, which is the case for two of
   * the original twenty-five.
   */
  tanstack?: string;
  /** What the chart is — the caption on the compare page. */
  kind: string;
  /** The TanStack example family it answers, so coverage claims stay checkable. */
  family: string;
  /** The `grammar.md` rule the specimen exists to demonstrate. */
  rule: string;
  /** The library surface it is built from, named so the plate doubles as a recipe. */
  built: string;
  /**
   * `missing` means the entry is on the page WITHOUT a plate — the catalog
   * reference is shown and the `gaps` say what would close it. It exists because
   * the honest coverage denominator is the whole catalog rather than the part
   * the library happens to reach; an entry quietly dropped from the list is a
   * worse artifact than an empty column with a reason under it.
   *
   * A `missing` specimen has no renderer, so it is excluded from
   * `RENDERABLE_SPECIMENS` and never screenshotted or audited.
   */
  status: 'built' | 'partial' | 'missing';
  /** What the library still cannot express here. Never patched over in the plate. */
  gaps: readonly string[];
}

export declare const SPECIMENS: readonly SpecimenMeta[];

/** Rule-first specimens: the original twenty-five. See the `.mjs` header. */
export declare const CORE_SPECIMENS: readonly SpecimenMeta[];

/**
 * The specimens that mount a chart — everything except `missing`.
 *
 * `render.mjs` and `audit.mjs` walk this, not `SPECIMENS`, so a documented
 * refusal is never reported as a render failure.
 */
export declare const RENDERABLE_SPECIMENS: readonly SpecimenMeta[];

export declare const specimenById: Record<string, SpecimenMeta>;
