/**
 * tokens.mjs — `tokens.json` as a plain-JS module, for the repo's own tooling.
 *
 *   import { ink, categorical, geometry } from '../scripts/tokens.mjs';
 *
 * Node cannot import `src/tokens.ts`, so anything in this repo that runs under
 * bare Node used to keep its own hand-copy of the values: `reference/build-
 * reference.mjs` had one (`const T = {…}`, `const G = {…}`, "mirrors
 * ../src/tokens.ts"), and `gallery/render.mjs` bundles a second one through
 * esbuild for the audit to import. This module removes the excuse: it reads
 * `tokens.json` — the same source `src/tokens.ts` is generated from — and exposes
 * the same flat shape.
 *
 * The export surface deliberately mirrors `src/tokens.ts`:
 *
 *   ink · accent · surface · categorical · muted · paletteOrder ·
 *   categoricalMains · sequential · diverging · defaultSequential ·
 *   defaultDiverging · family · minTextSize · typeRoles · geometry · opacity
 *   default export: glTokens (all of the above)
 *
 * so a consumer can be ported between the TS module and this one by changing
 * only the import specifier. Two deliberate absences: the `GLTone` / `GLTypeRole`
 * types (there are no types here) and `series(index)`, which is logic and lives
 * in `src/tone.ts`.
 *
 * Values only — the doc prose stays in `tokens.json`; read it there.
 */

import { entriesOf, loadTokens, resolve } from './emit-tokens.mjs';

/** tokens.json → `{ [declarationName]: plainValue }`. */
function build(spec) {
  const out = {};
  for (const decl of spec.declarations) {
    switch (decl.kind) {
      case 'map':
      case 'tones':
      case 'ramps':
        out[decl.name] = Object.fromEntries(entriesOf(decl).map(([k, e]) => [k, e.value]));
        break;
      case 'roles':
        out[decl.name] = Object.fromEntries(
          entriesOf(decl).map(([k, e]) => [
            k,
            Object.fromEntries(
              Object.entries(e.value).map(([field, v]) => [
                field,
                v !== null && typeof v === 'object' ? resolve(spec, v.ref).value : v,
              ]),
            ),
          ]),
        );
        break;
      case 'tone':
      case 'list':
      case 'scalar':
        out[decl.name] = decl.value;
        break;
      case 'derived': {
        // e.g. categoricalMains = paletteOrder.map((k) => categorical[k].main)
        const { over, from, pick } = decl.derive;
        out[decl.name] = out[over].map((k) => out[from][k][pick]);
        break;
      }
      case 'aggregate':
        out[decl.name] = Object.fromEntries(decl.members.map((m) => [m, out[m]]));
        break;
      case 'interface':
      case 'type':
        break; // types have no runtime form
      default:
        throw new Error(`tokens.json: unknown declaration kind '${decl.kind}'`);
    }
  }
  return out;
}

const t = build(loadTokens());

export const ink = t.ink;
export const accent = t.accent;
export const surface = t.surface;
export const categorical = t.categorical;
export const muted = t.muted;
export const paletteOrder = t.paletteOrder;
export const categoricalMains = t.categoricalMains;
export const sequential = t.sequential;
export const diverging = t.diverging;
export const defaultSequential = t.defaultSequential;
export const defaultDiverging = t.defaultDiverging;
export const family = t.family;
export const minTextSize = t.minTextSize;
export const typeRoles = t.typeRoles;
export const geometry = t.geometry;
export const opacity = t.opacity;
export const glTokens = t.glTokens;

export default glTokens;
