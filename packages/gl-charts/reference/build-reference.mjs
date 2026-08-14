/**
 * Builds `spec-reference.html` — the visual target for the GL chart library.
 *
 * Every figure here is a hand-computed SVG that follows `docs/data-vis-spec-core.md`
 * exactly. It exists so the rendered components can be diffed against a known-good
 * baseline, and so the axis geometry rules (which are fiddly) have one worked
 * implementation to copy.
 *
 * Run: node packages/gl-charts/reference/build-reference.mjs
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

// ── Tokens (mirrors ../src/tokens.ts) ───────────────────────────────────────
const T = {
  ink: '#1A1714', ink2: '#2C2823', ink3: '#4F4A42',
  accent: '#1A5A8E', paper: '#FFFFFF', gridline: '#D8D4CC',
  c1: { light: '#B5D5EA', main: '#2F87C8', dark: '#1A5A8E' },
  c2: { light: '#E89C9C', main: '#CC4948', dark: '#8A2C2B' },
  c3: { light: '#92D6BF', main: '#2AA584', dark: '#1A6B53' },
  c5: { light: '#F4BC8A', main: '#EA822D', dark: '#A8580F' },
  muted: { light: '#CDD2D9', main: '#AFB5BE', dark: '#5F6773' },
};

// Geometry, straight from the spec.
const G = {
  axisW: 1, tickW: 1, tickLen: 4, tickLabelOffset: 6, axisLabelOffset: 20,
  gridW: 1, lineW: 2, lineWFocus: 2.4, pointR: 6, pointStroke: 1,
  stackGap: 1, textSize: 12,
};

/** Inter 12px advance width, close enough for label-clearance math. */
const charW = (s) => String(s).length * 6.9;

const scaleLinear = (d, r) => (v) =>
  r[0] + ((v - d[0]) / (d[1] - d[0])) * (r[1] - r[0]);
const scaleLog = (d, r) => {
  const [a, b] = d.map(Math.log10);
  return (v) => r[0] + ((Math.log10(v) - a) / (b - a)) * (r[1] - r[0]);
};

/** Deterministic PRNG so the reference render is byte-stable across runs. */
function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// ── Axis renderers ──────────────────────────────────────────────────────────

/**
 * Y axis: 1px ink-2 line, 4px outward (leftward) ticks, tick labels 6px outside
 * the axis and right-aligned, axis label 20px left of the START of the widest
 * tick label — NOT 20px from the axis line (that is what makes wide ticks like
 * "250" collide with the rotated label).
 */
function yAxis({ x, y0, y1, scale, ticks, fmt = String, label, grid, gridTo }) {
  const widest = Math.max(...ticks.map((t) => charW(fmt(t))));
  const labelX = x - G.tickLen - G.tickLabelOffset - widest - G.axisLabelOffset;
  const out = [];

  if (grid) {
    for (const t of ticks) {
      const yy = scale(t);
      // The zero baseline strokes at AXIS weight, never gridline weight.
      const isZero = t === 0;
      out.push(
        `<line class="gl-gridline" x1="${x}" x2="${gridTo}" y1="${yy}" y2="${yy}" ` +
          `stroke="${isZero ? T.ink2 : T.gridline}" stroke-width="${isZero ? G.axisW : G.gridW}" shape-rendering="crispEdges"/>`,
      );
    }
  }
  out.push(
    `<line x1="${x}" x2="${x}" y1="${y0}" y2="${y1}" stroke="${T.ink2}" stroke-width="${G.axisW}" shape-rendering="crispEdges"/>`,
  );
  for (const t of ticks) {
    const yy = scale(t);
    out.push(
      `<line x1="${x - G.tickLen}" x2="${x}" y1="${yy}" y2="${yy}" stroke="${T.ink2}" stroke-width="${G.tickW}" shape-rendering="crispEdges"/>`,
      `<text x="${x - G.tickLen - G.tickLabelOffset}" y="${yy}" text-anchor="end" dominant-baseline="middle" ` +
        `font-family="Inter" font-size="${G.textSize}" font-weight="400" fill="${T.ink2}" ` +
        `style="font-variant-numeric:tabular-nums">${esc(fmt(t))}</text>`,
    );
  }
  if (label) {
    const midY = (y0 + y1) / 2;
    out.push(
      `<text transform="translate(${labelX},${midY}) rotate(-90)" text-anchor="middle" ` +
        `font-family="Inter" font-size="${G.textSize}" font-weight="500" fill="${T.ink2}">${esc(label)}</text>`,
    );
  }
  return out.join('\n');
}

/** X axis: same rules, ticks downward, axis label 20px below the tick baseline. */
function xAxis({ y, x0, x1, scale, ticks, fmt = String, label }) {
  const out = [
    `<line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" stroke="${T.ink2}" stroke-width="${G.axisW}" shape-rendering="crispEdges"/>`,
  ];
  for (const t of ticks) {
    const xx = scale(t);
    out.push(
      `<line x1="${xx}" x2="${xx}" y1="${y}" y2="${y + G.tickLen}" stroke="${T.ink2}" stroke-width="${G.tickW}" shape-rendering="crispEdges"/>`,
      `<text x="${xx}" y="${y + G.tickLen + G.tickLabelOffset}" text-anchor="middle" dominant-baseline="hanging" ` +
        `font-family="Inter" font-size="${G.textSize}" font-weight="400" fill="${T.ink2}" ` +
        `style="font-variant-numeric:tabular-nums">${esc(fmt(t))}</text>`,
    );
  }
  if (label) {
    const baseline = y + G.tickLen + G.tickLabelOffset + G.textSize + G.axisLabelOffset;
    out.push(
      `<text x="${(x0 + x1) / 2}" y="${baseline}" text-anchor="middle" ` +
        `font-family="Inter" font-size="${G.textSize}" font-weight="500" fill="${T.ink2}">${esc(label)}</text>`,
    );
  }
  return out.join('\n');
}

/** Direct label over data: dark tone glyphs + thin paper halo. */
const dataLabel = (x, y, text, color, anchor = 'start') =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle" ` +
  `font-family="Inter" font-size="${G.textSize}" font-weight="600" fill="${color}" ` +
  `paint-order="stroke fill" stroke="${T.paper}" stroke-width="3" stroke-linejoin="round">${esc(text)}</text>`;

/**
 * Series end-labels must not collide — two series that finish at similar values
 * would otherwise overprint each other. Nudge them apart around their shared
 * centre of mass, preserving vertical order so each label still reads as
 * belonging to its line.
 */
function deoverlap(items, minGap = G.textSize + 3) {
  const s = [...items].sort((a, b) => a.y - b.y);
  for (let i = 1; i < s.length; i++) {
    const gap = s[i].y - s[i - 1].y;
    if (gap < minGap) s[i].y = s[i - 1].y + minGap;
  }
  // Re-centre the block on the original mean so labels stay near their lines.
  const meanBefore = items.reduce((a, d) => a + d.y0, 0) / items.length;
  const meanAfter = s.reduce((a, d) => a + d.y, 0) / s.length;
  const shift = meanBefore - meanAfter;
  for (const d of s) d.y += shift;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// Figure 1 — Scatter with the pop-up effect
// ═══════════════════════════════════════════════════════════════════════════
function figScatter() {
  const W = 540, H = 300;
  const m = { top: 8, right: 16, bottom: 52, left: 74 };
  const px0 = m.left, px1 = W - m.right, py0 = H - m.bottom, py1 = m.top;

  const x = scaleLog([1000, 100000], [px0, px1]);
  const y = scaleLinear([-1.5, 3], [py0, py1]);
  const rnd = lcg(7);

  const pts = [];
  for (let i = 0; i < 90; i++) {
    const gdp = 1000 * 10 ** (rnd() * 2);
    const eci = -1.2 + 1.55 * Math.log10(gdp / 1000) + (rnd() - 0.5) * 1.5;
    pts.push({ gdp, eci: Math.max(-1.4, Math.min(2.9, eci)) });
  }

  // Supporting cloud in c-muted; a single focus point in c-1 carries the finding.
  const cloud = pts
    .map(
      (p) =>
        `<circle cx="${x(p.gdp).toFixed(1)}" cy="${y(p.eci).toFixed(1)}" r="${G.pointR}" ` +
        `fill="${T.muted.main}" fill-opacity="0.8" stroke="${T.muted.dark}" stroke-opacity="0.8" stroke-width="${G.pointStroke}"/>`,
    )
    .join('\n');

  const kr = { gdp: 46000, eci: 2.55 };
  const focus =
    `<circle cx="${x(kr.gdp).toFixed(1)}" cy="${y(kr.eci).toFixed(1)}" r="${G.pointR}" ` +
    `fill="${T.c1.main}" fill-opacity="0.8" stroke="${T.c1.dark}" stroke-opacity="0.8" stroke-width="${G.pointStroke}"/>`;

  const svg = `
${yAxis({ x: px0, y0: py0, y1: py1, scale: y, ticks: [-1, 0, 1, 2, 3], label: 'Economic Complexity Index', grid: true, gridTo: px1 })}
${xAxis({ y: py0, x0: px0, x1: px1, scale: x, ticks: [1000, 5000, 20000, 50000, 100000], fmt: (v) => (v >= 1000 ? `${v / 1000}k` : v), label: 'GDP per capita, PPP (log scale)' })}
${cloud}
${focus}
${dataLabel(x(kr.gdp) - 12, y(kr.eci) - 2, 'South Korea', T.c1.dark, 'end')}`;

  return figure({
    n: 1,
    title: 'South Korea climbed the complexity ladder faster than its peers.',
    subtitle: 'GDP per capita vs. Economic Complexity Index, 2022.',
    source: 'Source: Growth Lab analysis of Atlas of Economic Complexity, 2022.',
    W, H, svg,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Figure 2 — Line chart, pop-up effect with two focus series
// ═══════════════════════════════════════════════════════════════════════════
function figLine() {
  const W = 540, H = 300;
  const m = { top: 8, right: 72, bottom: 40, left: 62 };
  const px0 = m.left, px1 = W - m.right, py0 = H - m.bottom, py1 = m.top;

  const years = Array.from({ length: 15 }, (_, i) => 2010 + i);
  const x = scaleLinear([2010, 2024], [px0, px1]);
  const y = scaleLinear([50, 250], [py0, py1]);
  const rnd = lcg(23);

  const path = (vals) =>
    vals.map((v, i) => `${i ? 'L' : 'M'}${x(years[i]).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  const walk = (start, drift) => {
    let v = start;
    return years.map(() => (v = Math.max(55, Math.min(245, v + drift + (rnd() - 0.5) * 22))));
  };

  // Ten supporting series, muted. They carry the trend, not the finding.
  const backdrop = Array.from({ length: 10 }, () => walk(100, rnd() * 4 - 1.5))
    .map(
      (s) =>
        `<path d="${path(s)}" fill="none" stroke="${T.muted.main}" stroke-width="${G.lineW}" stroke-linejoin="round" stroke-linecap="round"/>`,
    )
    .join('\n');

  const mong = walk(100, 8.5);
  const chile = walk(100, 6.2);

  const endLabels = deoverlap([
    { y0: y(mong.at(-1)), y: y(mong.at(-1)), text: 'Mongolia', color: T.c1.dark },
    { y0: y(chile.at(-1)), y: y(chile.at(-1)), text: 'Chile', color: T.c2.dark },
  ])
    .map((d) => dataLabel(px1 + 6, d.y, d.text, d.color))
    .join('\n');

  const svg = `
${yAxis({ x: px0, y0: py0, y1: py1, scale: y, ticks: [50, 100, 150, 200, 250], label: 'Index (2010 = 100)', grid: true, gridTo: px1 })}
${xAxis({ y: py0, x0: px0, x1: px1, scale: x, ticks: [2010, 2014, 2018, 2022, 2024] })}
${backdrop}
<path d="${path(chile)}" fill="none" stroke="${T.c2.main}" stroke-width="${G.lineWFocus}" stroke-linejoin="round" stroke-linecap="round"/>
<path d="${path(mong)}"  fill="none" stroke="${T.c1.main}" stroke-width="${G.lineWFocus}" stroke-linejoin="round" stroke-linecap="round"/>
${endLabels}`;

  return figure({
    n: 2,
    title: 'Mongolia and Chile broke from the pack on copper exports.',
    subtitle: 'Index of copper export value (2010 = 100), twelve mineral economies.',
    source: 'Source: Growth Lab analysis of UN Comtrade. HS 2603, 7402.',
    W, H, svg,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Figure 3 — Stacked bars, four categories, 1px gap between segments
// ═══════════════════════════════════════════════════════════════════════════
function figStacked() {
  const W = 540, H = 300;
  const m = { top: 8, right: 84, bottom: 40, left: 62 };
  const px0 = m.left, px1 = W - m.right, py0 = H - m.bottom, py1 = m.top;

  const years = [2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024];
  const y = scaleLinear([0, 100], [py0, py1]);
  const band = (px1 - px0) / years.length;
  const barW = band * 0.72;

  // Ordered largest mean share at the BOTTOM upward.
  const cats = [
    { name: 'Minerals', color: T.c5, vals: [34, 32, 30, 28, 26, 24, 22, 20] },
    { name: 'Agri.',    color: T.c3, vals: [22, 21, 21, 20, 19, 18, 18, 17] },
    { name: 'Manuf.',   color: T.c2, vals: [26, 26, 26, 26, 26, 26, 25, 25] },
    { name: 'Services', color: T.c1, vals: [18, 21, 23, 26, 29, 32, 35, 38] },
  ];

  const bars = [];
  years.forEach((yr, i) => {
    const cx = px0 + band * i + (band - barW) / 2;
    let acc = 0;
    cats.forEach((c) => {
      const y0 = y(acc), y1 = y(acc + c.vals[i]);
      // The 1px gap gives each category boundary a clean edge and helps readers
      // with low color discrimination separate adjacent segments.
      const h = Math.max(0, y0 - y1 - G.stackGap);
      bars.push(
        `<rect x="${cx.toFixed(1)}" y="${y1.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="${c.color.main}"/>`,
      );
      acc += c.vals[i];
    });
  });

  // Legend entries take the DARK tone of the series they name.
  const legend = cats
    .slice()
    .reverse()
    .map((c, i) => {
      const ly = py1 + 10 + i * 18;
      return (
        `<rect x="${px1 + 12}" y="${ly - 5}" width="10" height="10" fill="${c.color.main}"/>` +
        `<text x="${px1 + 27}" y="${ly}" dominant-baseline="middle" font-family="Inter" font-size="${G.textSize}" ` +
        `font-weight="600" fill="${c.color.dark}">${esc(c.name)}</text>`
      );
    })
    .join('\n');

  const svg = `
${yAxis({ x: px0, y0: py0, y1: py1, scale: y, ticks: [0, 20, 40, 60, 80, 100], label: 'Share of exports (%)', grid: true, gridTo: px1 })}
${xAxis({ y: py0, x0: px0, x1: px1, scale: scaleLinear([0, years.length - 1], [px0 + band / 2, px1 - band / 2]), ticks: years.map((_, i) => i), fmt: (i) => years[i] })}
${bars.join('\n')}
${legend}`;

  return figure({
    n: 3,
    title: 'Services took over the export basket.',
    subtitle: 'Export composition by sector, 2010–2024, share of total exports.',
    source: 'Source: Growth Lab analysis of national statistics.',
    W, H, svg,
  });
}

// ── Figure block: label · title · subtitle · plot · source ──────────────────
function figure({ n, title, subtitle, source, W, H, svg }) {
  return `<figure class="gl-figure">
  <p class="gl-figure__label">Figure ${n}</p>
  <h3 class="gl-figure__title">${esc(title)}</h3>
  <p class="gl-figure__subtitle">${esc(subtitle)}</p>
  <div class="gl-figure__plot"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">${svg}</svg></div>
  <figcaption class="gl-figure__source">${esc(source)}</figcaption>
</figure>`;
}

const html = `<!doctype html>
<meta charset="utf-8">
<title>GL charts — spec reference</title>
<!-- The shipped sheet: tokens (which reference.css's var(--…) resolve against),
     figure chrome, and the TanStack patches. Browsers follow its @imports. -->
<link rel="stylesheet" href="../src/theme.css">
<!-- The .gl-* primitive vocabulary. Reference-only: TanStack marks take no
     className, so nothing the shipped library renders can carry these classes,
     and the shipped sheet does not import this file. The SVG below writes literal
     hex presentation attributes for everything anyway — this is belt and braces. -->
<link rel="stylesheet" href="reference.css">
<style>
  body { margin: 0; padding: 40px; background: #FFFFFF; }
  .sheet { display: flex; flex-direction: column; gap: 44px; width: 540px; margin: 0 auto; }
  .gl-figure__title, .gl-figure__subtitle, .gl-figure__label, .gl-figure__source { max-width: 540px; }
</style>
<div class="sheet">
${[figScatter(), figLine(), figStacked()].join('\n')}
</div>
`;

writeFileSync(join(HERE, 'spec-reference.html'), html);
console.log('wrote spec-reference.html');
