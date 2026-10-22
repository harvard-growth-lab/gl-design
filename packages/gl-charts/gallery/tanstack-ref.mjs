/**
 * tanstack-ref.mjs — screenshot TanStack's own catalog as the specimens' reference.
 *
 *   node packages/gl-charts/gallery/tanstack-ref.mjs           # fetch what's missing
 *   node packages/gl-charts/gallery/tanstack-ref.mjs --refresh # re-fetch everything
 *
 * ## Why this exists
 *
 * The spec-PDF plates are diffed against the figure they reproduce, and the
 * diff answers "did we reproduce the spec?". The specimens had no reference at
 * all — until it turned out one does exist, just not in this repo: TanStack
 * publishes a 102-chart catalog, and its embeds are public URLs.
 *
 * That gives the specimens a diff too, and it asks the more interesting
 * question: **what do the GL rules change?** TanStack's slopegraph spends eight
 * saturated hues and lets two end-labels collide; the same data under §3.1 and
 * Decision Rule 1 is one muted backdrop and one highlighted series. Neither is
 * wrong — they answer to different rules — and the pair is where you can see
 * which rule did what.
 *
 * ## Where the slug list comes from
 *
 * Two sources, unioned, both offline:
 *
 *   1. `@tanstack/charts/docs/examples/*.md` — the pinned package's own docs,
 *      which embed every example they document by iframe. 67 slugs.
 *   2. `tanstack-catalog.mjs` — the published catalog roster, transcribed. 103.
 *
 * Neither is a superset of the other, which is the reason for the union and is
 * documented at length in `tanstack-catalog.mjs`. `--audit` prints both
 * directions of the difference, so a TanStack upgrade that adds a docs page
 * surfaces as a line of output rather than as a quietly smaller denominator.
 * Only the screenshots need the network.
 *
 * ## Why it is opt-in
 *
 * `npm run gallery` is a gate: it must run offline, be deterministic, and not
 * depend on a third-party site being up or unchanged. This is a development
 * reference, cached in gitignored `out/`, and is never part of that gate.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer-core';

import { CATALOG, CATALOG_SOURCE } from './tanstack-catalog.mjs';
import { SPECIMENS } from './specimens-meta.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out', 'tanstack');
const DOCS = join(HERE, '..', 'node_modules', '@tanstack', 'charts', 'docs', 'examples');

const EMBED = (slug, height) =>
  `https://tanstack.com/charts/catalog/embed/${slug}/?theme=light&height=${height}`;

/** Matches the generated plate width, so the pair columns align. */
const WIDTH = 596;
const HEIGHT = 380;

const CHROME_PATHS = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const findChrome = () => {
  const found = CHROME_PATHS.find((p) => existsSync(p));
  if (!found) throw new Error('No Chrome found. Set CHROME_PATH.');
  return found;
};

/**
 * Every catalog slug the pinned package's docs embed.
 *
 * Read from `node_modules`, not from the website: the docs that ship with
 * 0.6.5 are the ones whose API this package is written against, and the live
 * catalog runs ahead of them (its interactive examples already use `crosshair`,
 * which 0.6.5 does not export — see constraints.test.ts §10).
 */
export function docsSlugs() {
  if (!existsSync(DOCS)) return [];
  const slugs = new Set();
  for (const file of readdirSync(DOCS).filter((f) => f.endsWith('.md'))) {
    const text = readFileSync(join(DOCS, file), 'utf8');
    for (const m of text.matchAll(/catalog\/embed\/([a-z0-9-]+)/g)) slugs.add(m[1]);
  }
  return [...slugs].sort();
}

/**
 * The full roster: the transcribed catalog, plus anything the pinned docs embed
 * that it does not carry.
 *
 * This is the coverage DENOMINATOR, so it is deliberately the larger of the two
 * readings. An example that exists in either place is an example a reader can
 * point at and ask why the gallery has no answer for it.
 */
export function catalogSlugs() {
  return [...new Set([...CATALOG.map((e) => e.slug), ...docsSlugs()])].sort();
}

/** Specimens that name a counterpart, and the slug each one claims. */
export const REFERENCED = SPECIMENS.filter((s) => s.tanstack);

export async function fetchReferences({ refresh = false } = {}) {
  mkdirSync(OUT, { recursive: true });

  const wanted = REFERENCED.filter(
    (s) => refresh || !existsSync(join(OUT, `${s.id}.png`)),
  );
  if (!wanted.length) {
    console.log(`  all ${REFERENCED.length} references already cached in out/tanstack/`);
    return { fetched: [], failed: [] };
  }

  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: ['--font-render-hinting=none', '--force-color-profile=srgb', '--hide-scrollbars'],
  });

  const fetched = [];
  const failed = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 2 });

    for (const spec of wanted) {
      const url = EMBED(spec.tanstack, HEIGHT);
      try {
        const res = await page.goto(url, { waitUntil: 'networkidle0', timeout: 45_000 });
        if (!res || res.status() >= 400) throw new Error(`HTTP ${res?.status()}`);
        // The catalog mounts its chart after hydration; wait for real geometry
        // rather than a fixed delay, so a slow response cannot yield a blank plate.
        await page.waitForFunction(
          () => {
            const svg = document.querySelector('svg');
            return svg != null && svg.getBoundingClientRect().height > 40;
          },
          { timeout: 20_000 },
        );
        await page.screenshot({ path: join(OUT, `${spec.id}.png`) });
        fetched.push(spec.id);
        console.log(`  ${spec.id.padEnd(24)} ← ${spec.tanstack}`);
      } catch (error) {
        failed.push({ id: spec.id, slug: spec.tanstack, reason: String(error).slice(0, 90) });
        console.log(`  ${spec.id.padEnd(24)} ✗ ${spec.tanstack} — ${String(error).slice(0, 60)}`);
      }
    }
  } finally {
    await browser.close();
  }
  return { fetched, failed };
}

/** What the catalog has that no specimen claims — the honest coverage signal. */
export function unclaimed() {
  const claimed = new Set(REFERENCED.map((s) => s.tanstack));
  return catalogSlugs().filter((slug) => !claimed.has(slug));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const slugs = catalogSlugs();
  const missing = unclaimed();

  if (process.argv.includes('--audit')) {
    const docs = docsSlugs();
    const roster = new Set(CATALOG.map((e) => e.slug));
    const undocumented = CATALOG.filter((e) => !docs.includes(e.slug)).length;
    const untranscribed = docs.filter((s) => !roster.has(s));

    console.log(`\n${slugs.length} catalog slugs, unioned from two offline sources:`);
    console.log(`  ${CATALOG.length} transcribed from ${CATALOG_SOURCE.url} (${CATALOG_SOURCE.transcribed})`);
    console.log(`  ${docs.length} embedded by the pinned docs — ${undocumented} roster entries they don't document`);
    if (untranscribed.length) {
      console.log(
        `\n  ${untranscribed.length} slug(s) the docs embed but tanstack-catalog.mjs does not list.\n` +
          `  Re-transcribe the roster, or add them by hand:\n` +
          untranscribed.map((s) => `    ${s}`).join('\n'),
      );
    }
    console.log(`\n${REFERENCED.length} claimed by a specimen, ${missing.length} not:\n`);
    for (const slug of missing) console.log(`  ${slug}`);
    process.exit(0);
  }

  console.log(
    `\nFetching TanStack catalog references for ${REFERENCED.length} specimens ` +
      `(of ${slugs.length} catalog slugs) …\n`,
  );
  const { fetched, failed } = await fetchReferences({
    refresh: process.argv.includes('--refresh'),
  });
  writeFileSync(
    join(HERE, 'out', 'tanstack-ref.json'),
    JSON.stringify({ fetched, failed, unclaimed: missing }, null, 2),
  );
  console.log(
    `\n${fetched.length} fetched, ${failed.length} failed. ` +
      `${missing.length} catalog entries unclaimed — see out/tanstack-ref.json.`,
  );
  process.exitCode = failed.length ? 1 : 0;
}
