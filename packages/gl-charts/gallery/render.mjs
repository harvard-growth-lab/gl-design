/**
 * render.mjs — bundle the gallery, mount it in Chrome, screenshot every plate.
 *
 * Two decisions worth keeping:
 *
 * 1. **A real browser, not server-side SVG.** TanStack lays out axis gutters from
 *    measured text. Rendering headlessly with the real fonts installed is the only
 *    way the generated plate matches what a reader would actually see — an SSR
 *    render with stub metrics would diverge in exactly the dimension (axis
 *    geometry) the spec is fussiest about.
 *
 * 2. **The installed Chrome, via puppeteer-core.** No 150MB Chromium download, and
 *    the fonts registered by `scripts/install-fonts.sh` are the ones used.
 *
 * Output: out/generated/<id>.png at 2× device pixels.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';
import puppeteer from 'puppeteer-core';

import { RENDERABLE } from './catalog-meta.mjs';
import { RENDERABLE_SPECIMENS } from './specimens-meta.mjs';

/**
 * Everything mounted in the page: the PDF-mirroring plates, then the specimens
 * that have no reference figure. Both are screenshotted; only the plates get
 * paired against a crop in `compare.mjs`.
 *
 * `RENDERABLE_SPECIMENS`, not `SPECIMENS`: a `missing` specimen is a catalog
 * entry the library cannot draw, recorded so the compare page shows the gap
 * rather than hiding it. It has no plate by definition, and shooting the full
 * list would report each one as "plate never mounted" — turning documented
 * refusals into render errors.
 */
const SHOOTABLE = [...RENDERABLE, ...RENDERABLE_SPECIMENS];

const HERE = dirname(fileURLToPath(import.meta.url));
const BUILD = join(HERE, 'out', '.build');
const OUT = join(HERE, 'out', 'generated');

const DEVICE_SCALE = 2;

/** Candidate Chrome binaries, most preferred first. */
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
    throw new Error(
      'No Chrome found. Install Google Chrome or set CHROME_PATH to a Chromium binary.',
    );
  }
  return found;
}

// ── Bundle ──────────────────────────────────────────────────────────────────

async function bundle() {
  mkdirSync(BUILD, { recursive: true });

  await esbuild.build({
    entryPoints: [join(HERE, 'entry.tsx')],
    bundle: true,
    // IIFE, not ESM: the page is opened over file://, and Chrome refuses to load
    // a `type="module"` script from a null origin. A classic script has no such
    // restriction, and the gallery has nothing to gain from module semantics.
    format: 'iife',
    target: 'es2022',
    jsx: 'automatic',
    outfile: join(BUILD, 'gallery.js'),
    // The library warns on off-spec figures in dev; the gallery WANTS those warnings
    // surfaced, so it builds in development mode and the driver forwards the console.
    define: { 'process.env.NODE_ENV': '"development"' },
    logLevel: 'silent',
    loader: { '.css': 'css' },
  });

  // A plain-JS copy of the token module, for audit.mjs. The audit has to compare
  // the rendered DOM against the SAME values the charts were built from — reading
  // them out of a second hand-maintained list would just be a new place to drift.
  await esbuild.build({
    entryPoints: [join(HERE, '..', 'src', 'tokens.ts')],
    bundle: true,
    format: 'esm',
    target: 'es2022',
    outfile: join(BUILD, 'tokens.mjs'),
    logLevel: 'silent',
  });

  writeFileSync(
    join(BUILD, 'index.html'),
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>gl-charts gallery</title>
<link rel="stylesheet" href="./gallery.css">
</head>
<body><div id="root"></div><script src="./gallery.js"></script></body>
</html>
`,
  );
}

// ── Screenshot ──────────────────────────────────────────────────────────────

async function shoot() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: ['--font-render-hinting=none', '--force-color-profile=srgb', '--hide-scrollbars'],
  });

  const warnings = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 1200, deviceScaleFactor: DEVICE_SCALE });

    page.on('console', (msg) => {
      const text = msg.text();
      if (/\[gl-charts]/.test(text)) warnings.push({ level: msg.type(), text });
      else if (msg.type() === 'error') warnings.push({ level: 'error', text });
    });
    page.on('pageerror', (err) => warnings.push({ level: 'pageerror', text: String(err) }));

    await page.goto(`file://${join(BUILD, 'index.html')}`, { waitUntil: 'load' });
    try {
      await page.waitForFunction(() => document.documentElement.dataset.galleryReady === 'true', {
        timeout: 30_000,
      });
    } catch (error) {
      // A page that never signals ready has almost always thrown. The collected
      // console output says why; the timeout on its own never does.
      console.error('Gallery never became ready. Console output:');
      for (const w of warnings) console.error(`  [${w.level}] ${w.text}`);
      throw error;
    }

    const shots = [];
    for (const plate of SHOOTABLE) {
      const element = await page.$(`[data-plate="${plate.id}"]`);
      if (!element) {
        warnings.push({ level: 'error', text: `${plate.id}: plate never mounted` });
        continue;
      }
      const file = join(OUT, `${plate.id}.png`);
      await element.screenshot({ path: file });
      const box = await element.boundingBox();
      shots.push({ id: plate.id, width: Math.round(box.width), height: Math.round(box.height) });
      console.log(
        `  ${plate.id.padEnd(24)} ${String(Math.round(box.width)).padStart(4)}×` +
          `${String(Math.round(box.height)).padStart(4)}px @${DEVICE_SCALE}x`,
      );
    }
    return { shots, warnings };
  } finally {
    await browser.close();
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

export async function renderGallery() {
  await bundle();
  const result = await shoot();
  // Written here rather than in the CLI branch so `run.mjs` gets the log too —
  // a silent console error during a full run is exactly what you want recorded.
  writeFileSync(join(HERE, 'out', 'render-log.json'), JSON.stringify(result, null, 2));
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`Rendering ${SHOOTABLE.length} plates with gl-charts …`);
  const { shots, warnings } = await renderGallery();

  if (warnings.length) {
    console.log(`\n${warnings.length} console message(s) during render:`);
    for (const w of warnings) console.log(`  [${w.level}] ${w.text}`);
  }
  console.log(`\nWrote ${shots.length} plates to gallery/out/generated/`);
}
