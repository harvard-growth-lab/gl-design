/**
 * audit.mjs — measure the rendered plates against the tokens.
 *
 * The side-by-side pairs catch what a person can see. This catches what they
 * can't: a stroke that is 2.25px instead of 2, a tick label that rendered at
 * 11px, a fill one hex off the palette, a bar that extends past the plot frame.
 * Eyes are not a measuring instrument and the spec is mostly measurements.
 *
 * Everything here reads the DOM of the same page `render.mjs` screenshots, so
 * the audit and the picture can never disagree about what was rendered.
 *
 *   node packages/gl-charts/gallery/audit.mjs        # after a render
 *
 * Exit code 1 if anything failed, so it can gate a change.
 */

import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer-core';

import { RENDERABLE } from './catalog-meta.mjs';
import { RENDERABLE_SPECIMENS } from './specimens-meta.mjs';

/**
 * The audit walks every `[data-plate]` in the page, so specimens are measured
 * whether or not this list mentions them. It exists for the CLI summary — so a
 * clean specimen prints a tick rather than silently not appearing.
 *
 * `missing` specimens are excluded for the same reason `render.mjs` excludes
 * them: there is no plate to measure, and listing one would print a permanent
 * unexplained tick against a chart that was never drawn.
 */
const AUDITED = [...RENDERABLE, ...RENDERABLE_SPECIMENS];

const HERE = dirname(fileURLToPath(import.meta.url));
const BUILD = join(HERE, 'out', '.build');

const CHROME_PATHS = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const findChrome = () => {
  const found = CHROME_PATHS.find((p) => existsSync(p));
  if (!found) throw new Error('No Chrome found. Set CHROME_PATH.');
  return found;
};

/**
 * The checks run inside the page, so this function is serialized across the CDP
 * boundary — it can close over nothing. Tokens come in as an argument.
 */
function auditInPage(tokens) {
  const { ink, surface, palette, geometry, opacity, minTextSize, accent } = tokens;

  const findings = [];
  const flag = (plate, check, detail) => findings.push({ plate, check, detail });

  /** '#2F87C8' → 'rgb(47, 135, 200)', the form getComputedStyle returns. */
  const toRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
  };

  const TOKEN_COLORS = new Map();
  for (const [name, hex] of Object.entries(palette)) TOKEN_COLORS.set(toRgb(hex), name);
  for (const [level, hex] of Object.entries(ink)) TOKEN_COLORS.set(toRgb(hex), `ink-${level}`);
  for (const [name, hex] of Object.entries(surface)) TOKEN_COLORS.set(toRgb(hex), name);
  TOKEN_COLORS.set(toRgb(accent), 'accent');

  const isTokenColor = (value) =>
    value === 'none' ||
    value === 'rgba(0, 0, 0, 0)' ||
    value === 'transparent' ||
    TOKEN_COLORS.has(value);

  const round = (n) => Math.round(n * 100) / 100;
  const near = (a, b, tolerance = 0.01) => Math.abs(a - b) <= tolerance;

  for (const plate of document.querySelectorAll('[data-plate]')) {
    const id = plate.dataset.plate;
    // NOT `querySelector('svg')`. `GLLegend` renders each swatch as its own
    // 10×10 SVG, and a legend placed above the plot comes first in the DOM — so
    // the naive query returns the swatch, finds no axis lines and no marks
    // inside it, and the plate passes every check below by measuring nothing.
    // Every legended plate was silently unaudited until this line.
    const svg = [...plate.querySelectorAll('svg')].find(
      (el) => !el.classList.contains('gl-legend__mark'),
    );
    if (!svg) {
      flag(id, 'render', 'no chart <svg> in the plate');
      continue;
    }

    const px = (el, prop) => parseFloat(getComputedStyle(el)[prop]);

    // ── Plot frame, from the axis lines themselves ──────────────────────────
    const axisLines = [...svg.querySelectorAll('.ts-chart__axes line')].filter((l) =>
      /-axis$/.test(l.getAttribute('data-ts-key') ?? ''),
    );
    const xAxis = axisLines.find((l) => l.getAttribute('data-ts-key') === 'x-axis');
    const yAxis = axisLines.find((l) => l.getAttribute('data-ts-key') === 'y-axis');
    const frame =
      xAxis && yAxis
        ? {
            left: Math.min(+yAxis.getAttribute('x1'), +xAxis.getAttribute('x1')),
            right: Math.max(+xAxis.getAttribute('x2'), +yAxis.getAttribute('x2')),
            top: Math.min(+yAxis.getAttribute('y1'), +yAxis.getAttribute('y2')),
            bottom: Math.max(+xAxis.getAttribute('y1'), +yAxis.getAttribute('y2')),
          }
        : null;

    // ── 1. Axis line: 1px, ink-2 ───────────────────────────────────────────
    for (const line of axisLines) {
      const stroke = getComputedStyle(line).stroke;
      if (stroke !== toRgb(ink[2])) {
        flag(id, 'axis-color', `${line.getAttribute('data-ts-key')} stroke ${stroke}`);
      }
      if (!near(px(line, 'strokeWidth'), geometry.axisWidth)) {
        flag(id, 'axis-width', `${line.getAttribute('data-ts-key')} ${px(line, 'strokeWidth')}px`);
      }
    }

    // ── 2. Ticks: 4px, outward ─────────────────────────────────────────────
    const ticks = [...svg.querySelectorAll('.ts-chart__axes line')].filter((l) =>
      /tick/.test(l.getAttribute('data-ts-key') ?? ''),
    );
    for (const tick of ticks) {
      const length = Math.max(
        Math.abs(+tick.getAttribute('x2') - +tick.getAttribute('x1')),
        Math.abs(+tick.getAttribute('y2') - +tick.getAttribute('y1')),
      );
      if (!near(length, geometry.tickLength, 0.5)) {
        flag(id, 'tick-length', `${tick.getAttribute('data-ts-key')} is ${round(length)}px`);
      }
      if (frame) {
        const key = tick.getAttribute('data-ts-key') ?? '';
        // Outward = away from the plot. An x tick must not rise above the axis
        // line; a y tick must not reach right of it.
        if (key.startsWith('x-tick') && Math.min(+tick.getAttribute('y1'), +tick.getAttribute('y2')) < frame.bottom - 0.5) {
          flag(id, 'tick-inward', `${key} points into the plot`);
        }
        if (key.startsWith('y-tick') && Math.max(+tick.getAttribute('x1'), +tick.getAttribute('x2')) > frame.left + 0.5) {
          flag(id, 'tick-inward', `${key} points into the plot`);
        }
      }
    }

    // ── 3. Gridlines: pale, 1px, one axis only ─────────────────────────────
    const gridlines = [...svg.querySelectorAll('.ts-chart__grid line')];
    let horizontal = 0;
    let vertical = 0;
    for (const line of gridlines) {
      const isHorizontal = near(+line.getAttribute('y1'), +line.getAttribute('y2'), 0.5);
      if (isHorizontal) horizontal += 1;
      else vertical += 1;

      const stroke = getComputedStyle(line).stroke;
      // The gridline at zero strokes at AXIS weight, but only where the chart
      // declared zero to be a genuine baseline — glChartProps({ zeroBaseline }).
      // An axis that merely spans zero (an index, a z-score) keeps the pale
      // gridline, so the expectation has to follow the opt-in, not the value.
      const promoted =
        /:number:0$/.test(line.getAttribute('data-ts-key') ?? '') &&
        !!line.closest('.gl-chart--zero-baseline');
      const expected = promoted ? toRgb(ink[2]) : toRgb(surface.gridline);
      if (stroke !== expected) {
        flag(id, 'gridline-color', `${line.getAttribute('data-ts-key')} ${stroke}`);
      }
      const width = px(line, 'strokeWidth');
      const expectedWidth = promoted ? geometry.axisWidth : geometry.gridlineWidth;
      if (!near(width, expectedWidth)) {
        flag(id, 'gridline-width', `${line.getAttribute('data-ts-key')} ${width}px`);
      }
    }
    if (horizontal > 0 && vertical > 0) {
      flag(id, 'gridline-both-axes', `${horizontal} horizontal + ${vertical} vertical`);
    }

    // ── 4. Marks: token colors, spec widths, spec opacities ────────────────
    const marks = [...svg.querySelectorAll('.ts-chart__marks *')].filter((el) =>
      ['path', 'rect', 'circle', 'line', 'polygon'].includes(el.tagName),
    );
    for (const mark of marks) {
      const style = getComputedStyle(mark);
      const key = mark.getAttribute('data-ts-key') ?? mark.tagName;

      // TanStack renders POLAR guides — the spokes a radar's dimensions run
      // along, and its rings — inside the marks group rather than the axes group,
      // so the audit has to recognise them by key. They are stroke-only: an SVG
      // <line> has no fill area at all, and a guide's unset fill computes to
      // black, which would otherwise read as an off-token paint on every radar.
      const isGuide = /^(spoke|ring)\b/.test(key) || mark.tagName === 'line';
      const isRadarMark = /^gl-radar/.test(key);

      if (!isGuide && !isTokenColor(style.fill)) {
        flag(id, 'non-token-fill', `${key} ${style.fill}`);
      }
      if (!isTokenColor(style.stroke)) flag(id, 'non-token-stroke', `${key} ${style.stroke}`);

      const isLine = /^line-/.test(key) || mark.closest('.ts-chart__line');
      const isDot = /^dot-/.test(key) || mark.closest('.ts-chart__dot');
      const isFilled = /^(bar|rect|area)-/.test(key) || mark.closest('.ts-chart__area');

      if (isLine && style.fill === 'none') {
        const width = px(mark, 'strokeWidth');
        if (!near(width, geometry.lineWidth) && !near(width, geometry.lineWidthFocus)) {
          flag(id, 'line-width', `${key} ${width}px (expected 2 or 2.4)`);
        }
      }
      if (isDot) {
        const fillOpacity = parseFloat(style.fillOpacity);
        const strokeOpacity = parseFloat(style.strokeOpacity);

        // The substantive rule first: fill and stroke opacity MATCH. That is what
        // makes overlapping circles darken together into a density signal instead
        // of one layer punching through the other, and it holds at any value.
        if (!near(fillOpacity, strokeOpacity)) {
          flag(
            id,
            'dot-opacity-mismatch',
            `${key} fill ${style.fillOpacity} vs stroke ${style.strokeOpacity}`,
          );
        } else if (!isRadarMark && !near(fillOpacity, opacity.overlap)) {
          // Then the value, for the marks the 0.8 rule is *about*: scatter
          // circles, which overlap. A radar's vertex dots sit one per spoke on a
          // polygon that is itself at 0.25 — they cannot overlap, and 0.8 there
          // would only dilute them against the fill they mark.
          flag(id, 'dot-opacity', `${key} ${style.fillOpacity} (scatter circles are 0.8)`);
        }
      }
      if (isFilled && !isDot && !near(parseFloat(style.fillOpacity), opacity.full)) {
        flag(id, 'fill-opacity', `${key} ${style.fillOpacity} (single-layer marks are opaque)`);
      }

      // ── 5. Nothing may extend past the plot frame ────────────────────────
      if (frame) {
        const box = mark.getBBox();
        const slack = 1.5;
        if (box.width > 0 && box.height > 0) {
          if (box.x < frame.left - slack) {
            flag(id, 'mark-overflow', `${key} starts ${round(frame.left - box.x)}px left of the y axis`);
          }
          if (box.x + box.width > frame.right + slack) {
            flag(id, 'mark-overflow', `${key} runs ${round(box.x + box.width - frame.right)}px past the right edge`);
          }
          if (box.y + box.height > frame.bottom + slack) {
            flag(id, 'mark-overflow', `${key} drops ${round(box.y + box.height - frame.bottom)}px below the x axis`);
          }
        }
      }
    }

    // ── 6. Type: nothing under 12px, sans in-chart ─────────────────────────
    for (const textNode of svg.querySelectorAll('text')) {
      const style = getComputedStyle(textNode);
      const size = parseFloat(style.fontSize);
      if (size < minTextSize) {
        flag(id, 'text-too-small', `"${textNode.textContent}" at ${size}px`);
      }
      if (/serif/i.test(style.fontFamily) && !/Inter/i.test(style.fontFamily)) {
        flag(id, 'serif-in-chart', `"${textNode.textContent}" in ${style.fontFamily}`);
      }
      if (!isTokenColor(style.fill)) {
        flag(id, 'non-token-text', `"${textNode.textContent}" ${style.fill}`);
      }
    }

    // ── 7. Figure chrome ───────────────────────────────────────────────────
    const label = plate.querySelector('.gl-figure__label');
    if (label && getComputedStyle(label).color !== toRgb(accent)) {
      flag(id, 'figure-label-color', getComputedStyle(label).color);
    }
    const title = plate.querySelector('.gl-figure__title');
    if (title) {
      if (!/Source Serif/i.test(getComputedStyle(title).fontFamily)) {
        flag(id, 'title-family', getComputedStyle(title).fontFamily);
      }
      if (!/[.?!]["')\]]?$/.test(title.textContent.trim())) {
        flag(id, 'title-period', title.textContent);
      }
    }
    if (!plate.querySelector('.gl-figure__source')) flag(id, 'missing-source', '');

    // ── 8. Per-plate expectations ──────────────────────────────────────────
    const expected = tokens.expectations[id];
    if (expected?.yTopTick) {
      const yTicks = [...svg.querySelectorAll('.ts-chart__axes text')]
        .filter((t) => /^y-tick-label/.test(t.getAttribute('data-ts-key') ?? ''))
        .map((t) => t.textContent.trim());
      const top = yTicks[0] === expected.yTopTick || yTicks[yTicks.length - 1] === expected.yTopTick;
      if (!top) {
        flag(
          id,
          'y-domain',
          `top tick is ${JSON.stringify(yTicks)}, expected to reach ${expected.yTopTick} ` +
            `— a stack that does not reach its total is not stacking`,
        );
      }
    }
    if (expected?.xTickLabels) {
      const xTicks = [...svg.querySelectorAll('.ts-chart__axes text')]
        .filter((t) => /^x-tick-label/.test(t.getAttribute('data-ts-key') ?? ''))
        .map((t) => t.textContent.trim());
      for (const want of expected.xTickLabels) {
        if (!xTicks.includes(want)) {
          flag(id, 'x-tick-missing', `"${want}" not labelled (got ${JSON.stringify(xTicks)})`);
        }
      }
    }
  }

  // ── 9. The fonts the page ASKS for are the fonts it GOT ───────────────────
  //
  // Page-level, and it exists because every other type check in this file reads
  // `getComputedStyle().fontFamily` — which returns the declared STACK, not the
  // face the browser resolved. A stack of `Inter, -apple-system, …` satisfies
  // `/Inter/i` whether or not an Inter glyph was ever painted, so the checks
  // above cannot distinguish a page set in Inter from one silently falling
  // through to the system sans. That is not hypothetical: both self-contained
  // builds inlined the variable face under `font-family: 'InterVariable'` while
  // the tokens asked for `Inter`, and 118 plates audited clean while every axis
  // label on every one of them was rendered in San Francisco — and TanStack
  // measures text to size axis gutters, so the geometry was wrong too.
  //
  // `document.fonts` is the honest witness: a declared face that never matched a
  // selector stays `unloaded` forever.
  //
  // Every clause below is written to fire on the EMPTY page as well as the
  // mismatched one. The first version of this check guarded each comparison with
  // `declared.size &&`, and read the stacks off `document.documentElement` — so
  // when the gallery declared no faces at all and `tokens.css` scoped the vars to
  // `.gl-figure`, all three clauses short-circuited and 118 plates in Georgia and
  // San Francisco audited clean. A guard that no-ops on the worst case is not a
  // guard; absence of declaration is the finding.
  const declared = new Set([...document.fonts].map((f) => f.family));
  if (declared.size === 0) {
    flag(
      'page',
      'no-fonts-declared',
      'the page declares no @font-face at all — every figure is rendering in whatever ' +
        'the OS substituted. Import `src/fonts.css`.',
    );
  }
  for (const face of document.fonts) {
    if (face.status !== 'loaded') {
      flag('page', 'font-never-loaded', `@font-face '${face.family}' (${face.style}) is ${face.status} — nothing on the page selects it`);
    }
  }
  // Read the stacks off a real figure: `src/tokens.css` scopes every custom
  // property to `.gl-figure`, so `documentElement` reports them as empty string.
  const figure = document.querySelector('.gl-figure') ?? document.documentElement;
  for (const role of ['--font-sans', '--font-serif']) {
    const value = getComputedStyle(figure).getPropertyValue(role);
    const first = value.split(',')[0].trim().replace(/^["']|["']$/g, '');
    if (!first) {
      flag('page', 'font-token-missing', `${role} resolves to nothing on .gl-figure — the token layer did not load`);
    } else if (!declared.has(first)) {
      flag('page', 'font-not-declared', `${role} asks for "${first}", which no @font-face declares (declared: ${[...declared].join(', ') || 'none'})`);
    }
  }

  return findings;
}

// ── Main ────────────────────────────────────────────────────────────────────

/**
 * What each plate must be true of beyond the generic rules. Kept here rather
 * than in catalog-meta so the crop step stays free of render concerns.
 */
const EXPECTATIONS = {
  'fig-02-line': { xTickLabels: ['2003', '2024'] },
  'fig-03-stacked-bar': { yTopTick: '100', xTickLabels: ['2010', '2024'] },
  'fig-03b-two-tone': { yTopTick: '100', xTickLabels: ['2010', '2024'] },
  'fig-03c-three-tone': { yTopTick: '100', xTickLabels: ['2010', '2024'] },
  'fig-10-popup-line': { xTickLabels: ['2010', '2024'] },
};

/**
 * Audit a rendered page against the tokens.
 *
 * Parameterised rather than hardcoded to the gallery because there is now a
 * second page built from the same library and held to the same spec — the Atlas
 * examples page in `examples/`. Both mount their charts under `[data-plate]`, so
 * the measurements below apply unchanged; only *where the page is* and *what it
 * signals when it is ready* differ. Forking this file for the second page would
 * mean two copies of every threshold, drifting apart the first time one was
 * tuned.
 *
 * Defaults reproduce the original behaviour exactly, so `npm run gallery:audit`
 * is unaffected.
 *
 * @param {object} [options]
 * @param {string} [options.pageHtml]   Absolute path to the built page.
 * @param {string} [options.tokensJs]   Absolute path to the plain-JS token copy.
 * @param {string} [options.readyFlag]  `document.documentElement.dataset` key the page sets.
 * @param {object} [options.expectations] Per-plate expectations; defaults to the gallery's.
 */
export async function auditGallery({
  pageHtml = join(BUILD, 'index.html'),
  tokensJs = join(BUILD, 'tokens.mjs'),
  readyFlag = 'galleryReady',
  expectations = EXPECTATIONS,
} = {}) {
  if (!existsSync(pageHtml)) {
    throw new Error(`No build to audit at ${pageHtml}. Render the page first.`);
  }

  // tokens.ts is TypeScript, so Node cannot import it directly. render.mjs emits
  // a plain-JS copy beside the bundle for exactly this reason — the audit must
  // compare against the same values the charts were built from.
  const {
    accent,
    categorical,
    diverging,
    geometry,
    ink,
    minTextSize,
    muted,
    opacity,
    sequential,
    surface,
  } = await import(`file://${tokensJs}`);

  const tokens = {
    accent: accent.DEFAULT,
    ink,
    surface,
    geometry,
    opacity,
    minTextSize,
    palette: Object.fromEntries([
      ...Object.entries(categorical).flatMap(([key, tone]) =>
        Object.entries(tone).map(([step, hex]) => [`${key}-${step}`, hex]),
      ),
      ...Object.entries(muted).map(([step, hex]) => [`c-muted-${step}`, hex]),
      // The ordered ramps count as token colours too. A choropleth's fills come
      // from `sequential-*` / `div-*`, so without these every map reads as
      // off-token — the check would flag exactly the charts that are most
      // carefully on-spec. (A ramp resampled to a step count the tokens don't
      // enumerate interpolates *between* these values and will still flag; that
      // is a known limit, and the sizes the spec names are all here.)
      ...Object.entries(sequential).flatMap(([name, steps]) =>
        steps.map((hex, i) => [`${name}-${i}`, hex]),
      ),
      ...Object.entries(diverging).flatMap(([name, steps]) =>
        steps.map((hex, i) => [`${name}-${i}`, hex]),
      ),
    ]),
    expectations,
  };

  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: ['--font-render-hinting=none', '--force-color-profile=srgb', '--hide-scrollbars'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 1200, deviceScaleFactor: 2 });
    await page.goto(`file://${pageHtml}`, { waitUntil: 'load' });
    await page.waitForFunction(
      (flag) => document.documentElement.dataset[flag] === 'true',
      { timeout: 60_000 },
      readyFlag,
    );
    // Awaited, not returned: `finally` closes the browser as soon as this
    // function returns, and an unawaited promise would race the close.
    const findings = await page.evaluate(auditInPage, tokens);
    return findings;
  } finally {
    await browser.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const findings = await auditGallery();
  writeFileSync(join(HERE, 'out', 'audit.json'), JSON.stringify(findings, null, 2));

  const byPlate = new Map();
  for (const f of findings) {
    if (!byPlate.has(f.plate)) byPlate.set(f.plate, []);
    byPlate.get(f.plate).push(f);
  }

  console.log(`Auditing ${AUDITED.length} rendered plates against the tokens …\n`);
  for (const plate of AUDITED) {
    const issues = byPlate.get(plate.id) ?? [];
    if (!issues.length) {
      console.log(`  ✓ ${plate.id}`);
      continue;
    }
    console.log(`  ✗ ${plate.id} — ${issues.length} finding(s)`);
    // Collapse repeats: 40 identical overflow flags is one problem, not forty.
    const grouped = new Map();
    for (const i of issues) {
      if (!grouped.has(i.check)) grouped.set(i.check, []);
      grouped.get(i.check).push(i.detail);
    }
    for (const [check, details] of grouped) {
      const shown = details.slice(0, 2).join('; ');
      const more = details.length > 2 ? ` (+${details.length - 2} more)` : '';
      console.log(`      ${check}: ${shown}${more}`);
    }
  }

  console.log(`\n${findings.length} finding(s) total → gallery/out/audit.json`);
  process.exitCode = findings.length ? 1 : 0;
}
