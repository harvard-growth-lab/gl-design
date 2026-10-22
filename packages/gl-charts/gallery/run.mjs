/**
 * run.mjs — the whole comparison, end to end.
 *
 *   node packages/gl-charts/gallery/run.mjs
 *
 * 1. cut the reference plates out of the spec PDF   (plates.mjs)
 * 2. render the same figures with gl-charts         (render.mjs)
 * 3. measure the render against the tokens          (audit.mjs)
 * 4. compose the pairs and the review page          (compare.mjs)
 *
 * Exits non-zero if the audit found anything, so this can gate a change.
 *
 * Everything lands in gallery/out/, which is gitignored — the plates are derived
 * from a PDF that IS in the repo, so committing them would just be a second copy
 * that can go stale.
 */

import { auditGallery } from './audit.mjs';
import { buildPlates } from './plates.mjs';
import { renderGallery } from './render.mjs';
import { buildComparison } from './compare.mjs';
import { PLATES, RENDERABLE } from './catalog-meta.mjs';
import { RENDERABLE_SPECIMENS, SPECIMENS } from './specimens-meta.mjs';
import { CATALOG } from './tanstack-catalog.mjs';
import { REFERENCED } from './tanstack-ref.mjs';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TANSTACK = join(dirname(fileURLToPath(import.meta.url)), 'out', 'tanstack');

console.log(`\n1/4  Reference plates — cutting ${PLATES.length} figures out of the spec PDF`);
buildPlates();

console.log(
  `\n2/4  gl-charts plates — rendering ${RENDERABLE.length} figures ` +
    `and ${RENDERABLE_SPECIMENS.length} specimens in Chrome`,
);
const { shots, warnings } = await renderGallery();
if (warnings.length) {
  console.log(`\n     ${warnings.length} console message(s):`);
  for (const w of warnings) console.log(`     [${w.level}] ${w.text}`);
}

console.log('\n3/4  Audit — measuring the render against the tokens');
const findings = await auditGallery();
if (findings.length) {
  const plates = new Set(findings.map((f) => f.plate));
  console.log(`     ${findings.length} finding(s) across ${plates.size} plate(s):`);
  for (const f of findings.slice(0, 12)) console.log(`     ${f.plate} — ${f.check}: ${f.detail}`);
  if (findings.length > 12) console.log(`     (+${findings.length - 12} more in out/audit.json)`);
} else {
  console.log('     clean');
}

console.log('\n4/4  Comparison');
await buildComparison();

const counts = PLATES.reduce((acc, p) => ({ ...acc, [p.status]: (acc[p.status] ?? 0) + 1 }), {});
const spec = SPECIMENS.reduce((acc, s) => ({ ...acc, [s.status]: (acc[s.status] ?? 0) + 1 }), {});
// Coverage against the CATALOG, not against the specimen list — counting the
// specimens would be circular, since every specimen covers something by
// construction. The number worth printing is how much of what TanStack publishes
// has an answer here.
const claimed = new Set(SPECIMENS.filter((s) => s.tanstack).map((s) => s.tanstack));
const unclaimed = CATALOG.filter((entry) => !claimed.has(entry.slug)).length;

console.log(
  `\nDone. ${shots.length} rendered.` +
    `\n     Plates    ${counts.built ?? 0} built, ${counts.partial ?? 0} partial, ` +
    `${counts.missing ?? 0} missing of ${PLATES.length} — diffed against the spec PDF.` +
    `\n     Specimens ${spec.built ?? 0} built, ${spec.partial ?? 0} partial, ` +
    `${spec.missing ?? 0} missing of ${SPECIMENS.length} — held by the audit.` +
    `\n     Catalog   ${CATALOG.length - unclaimed} of ${CATALOG.length} TanStack entries ` +
    `answered${unclaimed ? `, ${unclaimed} unclaimed` : ''}.`,
);

// The catalog references are opt-in: they need the network and a third-party
// site, and this run has to stay offline and deterministic.
const cached = REFERENCED.filter((s) => existsSync(join(TANSTACK, `${s.id}.png`))).length;
console.log(
  cached === REFERENCED.length
    ? `     ${cached} of those paired against the TanStack catalog.`
    : `     ${cached}/${REFERENCED.length} paired against the TanStack catalog — ` +
        `\`npm run gallery:tanstack\` fetches the rest.`,
);
console.log('     open packages/gl-charts/gallery/out/compare.html');
process.exitCode = findings.length ? 1 : 0;
