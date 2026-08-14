/**
 * run-tests.mjs — bundle every `tests/*.test.ts` and hand them to Node's runner.
 *
 * The package ships TypeScript source and has no build step, so the tests have to
 * be bundled before `node --test` sees them. Node can strip types on its own but
 * does not rewrite the TypeScript-style `'./x.js'` imports the source uses, and it
 * cannot resolve `@tanstack/charts`' subpath exports from a bare `.ts` file —
 * esbuild does both.
 *
 * Discovering the test files rather than listing them means a new test file is
 * picked up by `npm run check` without anyone remembering to wire it in.
 *
 *   node scripts/run-tests.mjs
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const TESTS = join(ROOT, 'tests');
const OUT = join(ROOT, '.tmp');

const files = readdirSync(TESTS)
  .filter((f) => f.endsWith('.test.ts'))
  .sort();

if (!files.length) {
  console.error('No tests found in tests/.');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

const bundled = [];
for (const file of files) {
  const outfile = join(OUT, file.replace(/\.ts$/, '.mjs'));
  await esbuild.build({
    entryPoints: [join(TESTS, file)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    outfile,
    logLevel: 'error',
    // Node builtins stay external; everything else is inlined so the runner needs
    // no resolution of its own.
    external: ['node:*'],
  });
  bundled.push(outfile);
}

console.log(`Running ${bundled.length} test file(s): ${files.join(', ')}\n`);
const result = spawnSync(process.execPath, ['--test', ...bundled], { stdio: 'inherit' });
process.exit(result.status ?? 1);
