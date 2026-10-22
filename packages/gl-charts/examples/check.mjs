/**
 * check.mjs — build the page, mount it in Chrome, and prove every demo drew.
 *
 * The gallery's `render.mjs` screenshots plates so they can be diffed against a
 * PDF. This page has no reference to diff against, so the questions it can
 * actually answer are different — and they are the ones that matter for a page
 * whose whole claim is "a hundred and five charts, from real data":
 *
 * 1. **Did every registered demo mount, and does it contain a chart?** A demo
 *    that throws renders an empty card, and on a page this long nobody scrolls
 *    far enough to notice.
 * 2. **Does every figure carry a source line?** The spec has no source-less
 *    figure, and Atlas provenance is the reason this page exists rather than the
 *    gallery.
 * 3. **Did anything throw or warn?** Console output is collected and reported;
 *    a React error boundary would otherwise swallow it.
 * 4. **Is the output actually self-contained?** No `src=`, `href=` or `url()`
 *    pointing anywhere but a `data:` URI.
 *
 * It deliberately does NOT re-implement `gallery/audit.mjs`. That audit measures
 * the rendered DOM against `tokens.ts` — a stroke that is 2.25px instead of 2, a
 * fill one hex off the palette, a tick label at 11px — and it already walks
 * every `[data-plate]` in whatever page it is given. These demos carry the same
 * ids and the same attribute, so it is **called** here rather than forked, with
 * this page's path and ready flag. Two copies of those thresholds would drift
 * apart the first time one was tuned.
 *
 * The gallery's per-plate expectations are not carried over: they encode what a
 * specific synthetic dataset should produce ("this stack must reach 100"), and
 * the whole point of this page is that the data is different. The generic
 * token rules are what transfer.
 *
 * Run: node examples/check.mjs
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer-core';

import { auditGallery } from '../gallery/audit.mjs';
import { buildExamples } from './build.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, 'out', 'index.html');
const TOKENS = join(HERE, 'out', '.build', 'tokens.mjs');

/** Same candidate list as the gallery — the installed Chrome, not a download. */
const CHROME_PATHS = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

function findChrome() {
  const found = CHROME_PATHS.find((p) => existsSync(p));
  if (!found) {
    throw new Error('No Chrome found. Install Google Chrome or set CHROME_PATH.');
  }
  return found;
}

/**
 * A page that references anything outside itself is not self-contained, whatever
 * the file size says. Checked on the emitted text rather than in the browser,
 * because a browser silently succeeds when the referenced file happens to exist
 * on *this* machine — which is exactly the bug that would ship.
 */
function externalRefs(html) {
  const refs = [];
  const patterns = [/\bsrc\s*=\s*["']([^"']+)["']/gi, /\bhref\s*=\s*["']([^"']+)["']/gi, /url\(\s*["']?([^"')]+)["']?\s*\)/gi];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html)) !== null) {
      const url = m[1].trim();
      if (url.startsWith('data:') || url.startsWith('#')) continue;
      refs.push(url);
    }
  }
  return [...new Set(refs)];
}

async function main() {
  console.log('Building …');
  const { ids } = await buildExamples({ quiet: true });

  const html = readFileSync(PAGE, 'utf8');
  const refs = externalRefs(html);

  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: ['--font-render-hinting=none', '--force-color-profile=srgb', '--hide-scrollbars'],
  });

  const console_ = [];
  const problems = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1240, height: 1400, deviceScaleFactor: 1 });

    page.on('console', (msg) => {
      if (msg.type() === 'error' || /\[gl-charts]/.test(msg.text())) {
        console_.push({ level: msg.type(), text: msg.text() });
      }
    });
    page.on('pageerror', (err) => console_.push({ level: 'pageerror', text: String(err) }));

    await page.goto(`file://${PAGE}`, { waitUntil: 'load' });
    try {
      await page.waitForFunction(() => document.documentElement.dataset.examplesReady === 'true', {
        timeout: 60_000,
      });
    } catch (error) {
      console.error('Page never became ready. Console output:');
      for (const c of console_) console.error(`  [${c.level}] ${c.text}`);
      throw error;
    }

    // ── Fonts ───────────────────────────────────────────────────────────────
    //
    // The whole point of this page is that it can be handed to someone, so the
    // faces have to be IN it — not resolved from whatever that person has
    // installed. Mirrors `gallery/audit.mjs` §9, and fires on the empty case as
    // well as the mismatched one: a page declaring nothing is exactly the state
    // the gallery sat in while auditing clean, in Georgia and San Francisco.
    const fonts = await page.evaluate(() => {
      const declared = [...document.fonts];
      const figure = document.querySelector('.gl-figure') ?? document.documentElement;
      const stacks = ['--font-sans', '--font-serif'].map((role) => ({
        role,
        first: getComputedStyle(figure)
          .getPropertyValue(role)
          .split(',')[0]
          .trim()
          .replace(/^["']|["']$/g, ''),
      }));
      return {
        declared: declared.map((f) => ({ family: f.family, style: f.style, status: f.status })),
        stacks,
      };
    });
    const families = new Set(fonts.declared.map((f) => f.family));
    if (!fonts.declared.length) {
      problems.push('page declares no @font-face — the fonts did not get inlined');
    }
    for (const f of fonts.declared) {
      if (f.status !== 'loaded') {
        problems.push(`@font-face '${f.family}' (${f.style}) is ${f.status} — nothing selects it`);
      }
    }
    for (const { role, first } of fonts.stacks) {
      if (!first) problems.push(`${role} resolves to nothing on .gl-figure`);
      else if (!families.has(first)) {
        problems.push(
          `${role} asks for "${first}", which no @font-face declares ` +
            `(declared: ${[...families].join(', ') || 'none'})`,
        );
      }
    }

    // Everything the page believes it rendered, measured from the DOM.
    const found = await page.evaluate(() =>
      [...document.querySelectorAll('[data-plate]')].map((el) => {
        // NOT `querySelector('svg')`. A legend swatch is itself a 10×10 SVG and
        // comes first in the DOM, so the naive query measures the legend and
        // reports a perfectly good chart as having drawn one element. Charts are
        // every SVG that is not a legend swatch — plural, because the facet and
        // marginal-histogram demos legitimately mount more than one.
        const svgs = [...el.querySelectorAll('svg')].filter(
          (s) => !s.classList.contains('gl-legend__mark'),
        );
        const box = el.getBoundingClientRect();
        return {
          id: el.getAttribute('data-plate'),
          hasSvg: svgs.length > 0,
          marks: svgs.reduce(
            (n, s) => n + s.querySelectorAll('path, rect, circle, line, text, polygon').length,
            0,
          ),
          hasSource: Boolean(el.querySelector('.gl-figure__source')?.textContent?.trim()),
          hasTitle: Boolean(el.querySelector('.gl-figure__title')?.textContent?.trim()),
          height: Math.round(box.height),
        };
      }),
    );

    const byId = new Map(found.map((f) => [f.id, f]));

    for (const id of ids) {
      const f = byId.get(id);
      if (!f) {
        problems.push(`${id}: registered but never mounted`);
        continue;
      }
      if (!f.hasSvg) problems.push(`${id}: mounted but drew no chart`);
      // Catches a chart whose marks all failed while the frame survived. The
      // floor is deliberately low: a Cartesian chart with axes carries ~40
      // elements, but not every form has axes. `ts-39-density-contours` draws
      // five contour rings through `geoShape` and — as its own gaps explain at
      // length — a fitted projection leaves nothing for an axis to read, so a
      // correct render is ten elements. A floor tuned to the common case would
      // report the page's most carefully documented chart as broken.
      else if (f.marks < 6) problems.push(`${id}: chart has only ${f.marks} elements`);
      if (!f.hasTitle) problems.push(`${id}: figure has no title`);
      if (!f.hasSource) problems.push(`${id}: figure has no source line — the spec requires one`);
    }

    for (const f of found) {
      if (!ids.includes(f.id)) problems.push(`${f.id}: mounted but is not in the roster`);
    }

    // ── Report ─────────────────────────────────────────────────────────────
    console.log(`\n${found.length} demos mounted, ${ids.length} in the roster`);
    for (const f of found) {
      console.log(
        `  ${f.id.padEnd(34)} ${String(f.marks).padStart(5)} marks  ${String(f.height).padStart(4)}px` +
          `${f.hasSource ? '' : '  NO SOURCE'}`,
      );
    }

    console.log(`\nSelf-contained: ${refs.length === 0 ? 'yes' : `NO — ${refs.length} external ref(s)`}`);
    for (const r of refs.slice(0, 10)) console.log(`  ${r}`);

    // `[gl-charts]` warnings are the library ENFORCING grammar.md at runtime, so
    // they are signal rather than failure — and at least one demo
    // (`ts-93-labeled-pie`) exists precisely to trip the four-slice donut cap so
    // the enforcement is visible on the page. Real errors are separated out and
    // do count.
    const glWarnings = console_.filter((c) => /\[gl-charts]/.test(c.text));
    const errors = console_.filter((c) => !/\[gl-charts]/.test(c.text));

    if (glWarnings.length) {
      console.log(`\n${glWarnings.length} spec warning(s) from the library (expected, not failures):`);
      for (const c of glWarnings) console.log(`  ${c.text}`);
    }
    if (errors.length) {
      console.log(`\n${errors.length} console error(s):`);
      for (const c of errors) console.log(`  [${c.level}] ${c.text}`);
    }

    if (problems.length) {
      console.error(`\n${problems.length} problem(s):`);
      for (const p of problems) console.error(`  ${p}`);
    } else {
      console.log('\nNo problems.');
    }

    return { problems: problems.length + refs.length + errors.length };
  } finally {
    await browser.close();
  }
}

/**
 * The token audit, run against this page rather than the gallery's.
 *
 * Reported separately from the structural problems above and NOT folded into the
 * exit code by default. A token finding here is usually a real-data finding —
 * nine sectors where the palette has six, a label the library placed on top of
 * another one — and those are the output of this page, not a reason to refuse to
 * build it. `--strict` makes them fatal for a CI gate that wants that.
 */
async function audit() {
  const findings = await auditGallery({
    pageHtml: PAGE,
    tokensJs: TOKENS,
    readyFlag: 'examplesReady',
    expectations: {},
  });

  // `findings` is a flat list of VIOLATIONS — `{ plate, check, detail }` — not a
  // per-plate status. An empty array is the clean result.
  const byCheck = new Map();
  for (const f of findings) byCheck.set(f.check, (byCheck.get(f.check) ?? 0) + 1);

  console.log(`\nToken audit: ${findings.length} finding(s)`);
  for (const [check, n] of [...byCheck].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${check.padEnd(22)} ${n}`);
  }
  for (const f of findings.slice(0, 30)) {
    console.log(`    ${String(f.plate).padEnd(34)} ${f.check}: ${f.detail}`);
  }
  if (findings.length > 30) console.log(`    … and ${findings.length - 30} more`);
  return findings.length;
}

const { problems } = await main();
const auditFindings = await audit();

const strict = process.argv.includes('--strict');
process.exit(problems > 0 || (strict && auditFindings > 0) ? 1 : 0);
