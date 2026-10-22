/**
 * compare.mjs — put the two plates side by side and make the difference reviewable.
 *
 * Produces two things:
 *
 *   out/pairs/<id>.png   one composite per figure, spec plate left, gl-charts
 *                        right, both scaled to the same column width. This is the
 *                        artifact a human (or a model) actually looks at — a pair
 *                        in one image removes the "was that blue the same blue?"
 *                        problem of flipping between two files.
 *
 *   out/compare.html     every pair in one page, and nothing else. The page is
 *                        meant to be handed to someone: it carries no coverage
 *                        table, no status badges, no §-citations and no recorded
 *                        gaps. Those are the project's own bookkeeping and they
 *                        live where the bookkeeping lives —
 *                        `gallery/specimens-meta.mjs`, `gallery/catalog-meta.mjs`
 *                        and the audit that `npm run gallery` prints.
 *
 * Both plates are scaled to a common width rather than cropped to a common size.
 * The spec plate is a 200dpi raster of a letter page and the generated plate is a
 * 2× browser screenshot; they will never share a pixel grid, and pretending they
 * do would produce a precise-looking diff that means nothing. Width-matching keeps
 * the comparison at the level it is actually valid — proportion, color, weight,
 * spacing, type — and leaves pixel arithmetic out of it.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer-core';

import { fontFaces, loadTokens } from '../scripts/emit-tokens.mjs';

import { PLATES } from './catalog-meta.mjs';
import { SPECIMENS } from './specimens-meta.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const REFERENCE = join(OUT, 'reference');
const GENERATED = join(OUT, 'generated');
const PAIRS = join(OUT, 'pairs');
const TANSTACK = join(OUT, 'tanstack');

/** Column width for each plate inside a composite, in CSS px. */
const COLUMN = 620;

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

const dataUri = (file) => `data:image/png;base64,${readFileSync(file).toString('base64')}`;

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── Page fragments ──────────────────────────────────────────────────────────

// The faces, inlined, ahead of every rule that names one.
//
// This page is chrome around screenshots, so a substitution here does not move a
// chart — but the review page is where a human decides whether the render is
// on-spec, and it should not be the one page in the set set in Georgia. It is
// also handed around like `examples/out/index.html`, and `shootPairs()` below
// bakes this same STYLE into the pair PNGs, where the caption type IS the type
// being reviewed. Shared with `src/fonts.css` through `tokens.json` so the
// family names cannot drift from the stacks the rules below ask for.
//
// Roman only: this page sets no italic anywhere, and a declared face nothing
// selects stays `unloaded` — the state `audit.mjs` reads as a name mismatch.
const FONT_FACES = fontFaces(loadTokens(), (face) => face.style !== 'italic');

const STYLE = `
  ${FONT_FACES}
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #F7F5F1;
    font-family: Inter, system-ui, sans-serif;
    color: #2C2823;
  }
  .pair { background: #F7F5F1; padding: 20px; }
  .pair__grid { display: grid; grid-template-columns: ${COLUMN}px ${COLUMN}px; gap: 20px; }
  .pane { background: #FFFFFF; border: 1px solid #D8D4CC; border-radius: 3px; overflow: hidden; }
  .pane__head {
    font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase;
    padding: 7px 12px; border-bottom: 1px solid #D8D4CC;
  }
  .pane__head--ref { color: #4F4A42; background: #EFECE6; }
  .pane__head--gen { color: #1A5A8E; background: #EAF2F9; }
  .pane__head--ts  { color: #4F4A42; background: #EFECE6; }
  .pane img { display: block; width: 100%; height: auto; }
  .pane__empty {
    padding: 48px 16px; text-align: center; font-size: 13px; color: #8A2C2B; background: #FBF4F4;
  }
  .pair__caption {
    display: flex; align-items: baseline; gap: 10px;
    margin: 0 0 12px; font-size: 13px;
  }
  .pair__caption b { font-size: 15px; }
  .pair__caption span { color: #4F4A42; }
`;

const REPORT_STYLE = `
  .wrap { max-width: ${COLUMN * 2 + 80}px; margin: 0 auto; padding: 40px 20px 100px; }
  h1 { font-family: "Source Serif 4", Georgia, serif; font-size: 30px; margin: 0 0 6px; color: #1A1714; }
  .lede { font-size: 15px; color: #4F4A42; margin: 0 0 32px; max-width: 68ch; line-height: 1.55; }
  h2 {
    font-family: "Source Serif 4", Georgia, serif; font-size: 22px; color: #1A1714;
    margin: 56px 0 6px; padding-top: 20px; border-top: 1px solid #D8D4CC;
  }
  h2:first-of-type { border-top: 0; padding-top: 0; }
  h3 {
    font-size: 12px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase;
    color: #6B655B; margin: 64px 0 22px;
  }
  .pair { padding: 0; margin: 0 0 40px; }
  .pane--solo { max-width: 660px; }
`;

function paneHtml(kind, file, label) {
  const head = `<div class="pane__head pane__head--${kind}">${label}</div>`;
  const body = existsSync(file)
    ? `<img src="${dataUri(file)}" alt="${label}">`
    : `<div class="pane__empty">not rendered</div>`;
  return `<div class="pane">${head}${body}</div>`;
}

function pairHtml(plate, { caption }) {
  const heading = caption
    ? `<p class="pair__caption"><b>Figure ${escapeHtml(plate.figure)}</b>
         <span>${escapeHtml(plate.kind)} &middot; specification p.${plate.page}</span></p>`
    : '';
  return `<section class="pair" data-pair="${plate.id}">
  ${heading}
  <div class="pair__grid">
    ${paneHtml('ref', join(REFERENCE, `${plate.id}.png`), `Specification &middot; Figure ${escapeHtml(plate.figure)}`)}
    ${paneHtml('gen', join(GENERATED, `${plate.id}.png`), 'Growth Lab')}
  </div>
</section>`;
}

/**
 * One chart, beside its off-the-shelf counterpart where there is one.
 *
 * A specimen with no counterpart is shown alone rather than forced into the grid
 * with an empty left pane. An empty column would read as a missing reference —
 * as though a screenshot failed — when the truth is that no such example exists
 * and none is owed.
 */
function specimenHtml(spec) {
  const generated = join(GENERATED, `${spec.id}.png`);
  const reference = spec.tanstack ? join(TANSTACK, `${spec.id}.png`) : null;
  const paired = reference && existsSync(reference);

  const body = paired
    ? `<div class="pair__grid">
    ${paneHtml('ts', reference, 'Charting library default')}
    ${paneHtml('gen', generated, 'Growth Lab')}
  </div>`
    : `<div class="pane pane--solo">${
        existsSync(generated)
          ? `<img src="${dataUri(generated)}" alt="${escapeHtml(spec.kind)}">`
          : `<div class="pane__empty">not rendered</div>`
      }</div>`;

  return `<section class="pair specimen" data-pair="${spec.id}">
  <p class="pair__caption"><b>${escapeHtml(spec.kind)}</b></p>
  ${body}
</section>`;
}

// ── Composites ──────────────────────────────────────────────────────────────

async function shootPairs(page) {
  rmSync(PAIRS, { recursive: true, force: true });
  mkdirSync(PAIRS, { recursive: true });

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${STYLE}</style></head>
<body>${PLATES.map((p) => pairHtml(p, { caption: false })).join('\n')}</body></html>`;

  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);

  for (const plate of PLATES) {
    const element = await page.$(`[data-pair="${plate.id}"]`);
    await element.screenshot({ path: join(PAIRS, `${plate.id}.png`) });
  }
}

// ── Report ──────────────────────────────────────────────────────────────────

const rendered = (id) => existsSync(join(GENERATED, `${id}.png`));

/**
 * Only what actually drew.
 *
 * A plate or specimen with no generated PNG is a `missing` entry or a render
 * that failed, and either way an empty pane with "not rendered" in it is a
 * project note on a page that carries none. `buildComparison` prints what was
 * left out, so it is dropped from the page and not from the run.
 */
const shown = {
  plates: () => PLATES.filter((p) => rendered(p.id)),
  specimens: () => SPECIMENS.filter((s) => rendered(s.id)),
};

/** Specimens grouped by family, in the order the families first appear. */
function byFamily(specimens) {
  const groups = new Map();
  for (const spec of specimens) {
    if (!groups.has(spec.family)) groups.set(spec.family, []);
    groups.get(spec.family).push(spec);
  }
  return [...groups];
}

function reportHtml() {
  const plates = shown.plates();
  const specimens = shown.specimens();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Growth Lab charts, side by side</title>
<style>${STYLE}${REPORT_STYLE}</style>
</head>
<body>
<div class="wrap">
  <h1>Growth Lab charts, side by side</h1>
  <p class="lede">
    What the Growth Lab data visualization specification does to a chart. On the left,
    the chart as it comes — a worked example from the specification itself, or a
    stock example from the charting library. On the right, the same form drawn to
    the specification: fewer hues, a quieter backdrop, and labels that read without
    a legend.
  </p>

  <h2>The specification's worked examples</h2>
  <p class="lede">
    The ${plates.length} figures printed in the specification, cropped straight out of
    the PDF, each beside the same figure rebuilt with the design system from the same
    numbers. Every visible difference is the drawing, not the data.
  </p>
  ${plates.map((p) => pairHtml(p, { caption: true })).join('\n')}

  <h2>The rest of the catalog</h2>
  <p class="lede">
    ${specimens.length} more charts, covering the forms an analyst actually reaches for.
    Where a stock example of the same form exists, it sits on the left. Neither chart is
    wrong; they answer to different rules.
  </p>
  ${byFamily(specimens)
    .map(
      ([family, specs]) =>
        `<h3>${escapeHtml(family)}</h3>\n${specs.map((s) => specimenHtml(s)).join('\n')}`,
    )
    .join('\n')}
</div>
</body>
</html>`;
}

// ── Main ────────────────────────────────────────────────────────────────────

export async function buildComparison() {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'compare.html'), reportHtml());

  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: ['--font-render-hinting=none', '--force-color-profile=srgb', '--hide-scrollbars'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: COLUMN * 2 + 80, height: 1000, deviceScaleFactor: 1 });
    await shootPairs(page);
  } finally {
    await browser.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Composing side-by-side pairs …');
  await buildComparison();

  const skipped = [
    ...PLATES.filter((p) => !rendered(p.id)),
    ...SPECIMENS.filter((s) => !rendered(s.id)),
  ];
  console.log(`  ${PLATES.length} composites → gallery/out/pairs/`);
  console.log(
    `  viewing page     → gallery/out/compare.html ` +
      `(${shown.plates().length} figures, ${shown.specimens().length} charts)`,
  );
  if (skipped.length) {
    console.log(`  left off the page — nothing rendered: ${skipped.map((x) => x.id).join(', ')}`);
  }
}
