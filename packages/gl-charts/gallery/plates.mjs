/**
 * plates.mjs — cut the reference plates out of the spec PDF.
 *
 * The inspiration source is `assets/design-library/GL_data_visualization_spec.pdf`.
 * Each worked example in it is a *figure block*: the accent "FIGURE N" label, a
 * serif title, a subtitle, the plot, and an italic source line. That block is what
 * the library has to reproduce, so that block is what we crop.
 *
 * The crop box is derived, not hand-tuned. `pdftotext -bbox` gives every word's
 * position in PDF points; the block runs from the top of its "FIGURE" label down to
 * the bottom of the last word before the next figure label (or before the page
 * footer). Hand-typed crop rectangles would silently rot the first time the PDF is
 * re-exported — this doesn't.
 *
 * Output: out/reference/<id>.png at RESOLUTION dpi.
 *
 * The examples page calls `buildPlates` too, for the plate strip above its
 * masthead — same crop geometry, lower dpi, its own output directory. Hence the
 * options bag: the geometry is the part worth having one copy of, and a second
 * cropper tuned for thumbnails would be a second thing to keep true to the PDF.
 *
 * Requires poppler (`pdftotext`, `pdftoppm`) — `brew install poppler`.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PLATES } from './catalog-meta.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const PDF = join(REPO, 'assets', 'design-library', 'GL_data_visualization_spec.pdf');
const OUT = join(HERE, 'out', 'reference');

/** 200dpi ≈ 2.8× the PDF's own points — enough to read 12px type when scaled down. */
const RESOLUTION = 200;
const PT_TO_PX = RESOLUTION / 72;

/**
 * The prose column, in PDF points. Figure blocks are laid out inside it, but a
 * plot can bleed a few points past the text on either side, so the crop takes the
 * whole column rather than the text's own extent.
 */
const COLUMN = { left: 72, right: 548 };

/** Anything below this is the page-number footer, not figure content. */
const FOOTER_TOP = 745;

const PAD = 6;

// ── PDF text geometry ───────────────────────────────────────────────────────

/** Parse `pdftotext -bbox` into `[{ page, words: [{ text, xMin, yMin, xMax, yMax }] }]`. */
function readWordBoxes(pdf) {
  const xml = execFileSync('pdftotext', ['-bbox', pdf, '-'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  const pages = [];
  const pageRe = /<page\b[^>]*>([\s\S]*?)<\/page>/g;
  const wordRe =
    /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([\s\S]*?)<\/word>/g;

  for (let pageMatch; (pageMatch = pageRe.exec(xml)); ) {
    const words = [];
    for (let m; (m = wordRe.exec(pageMatch[1])); ) {
      words.push({
        xMin: +m[1],
        yMin: +m[2],
        xMax: +m[3],
        yMax: +m[4],
        text: m[5]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"'),
      });
    }
    pages.push({ words });
  }
  return pages;
}

/**
 * Every "FIGURE <n>" label on a page, in reading order.
 *
 * The label is set in 12px/600 uppercase with 0.14em tracking, and that tracking
 * makes pdftotext split it unpredictably: "FIGURE 2" comes back as two words but
 * "FIGURE 3B" comes back as three ("FIGURE", "3", "B"). So the identifier is
 * rebuilt by joining every uppercase-alphanumeric token that follows "FIGURE" on
 * the same baseline.
 */
function figureLabels(words) {
  /**
   * Same line = the two glyph boxes overlap vertically. Comparing yMin directly
   * does not work: a digit's box is shorter than a capital's, so "FIGURE" and the
   * "7" beside it differ by ~2pt on the same baseline.
   */
  const sameLine = (a, b) => {
    const overlap = Math.min(a.yMax, b.yMax) - Math.max(a.yMin, b.yMin);
    return overlap > 0.5 * Math.min(a.yMax - a.yMin, b.yMax - b.yMin);
  };

  /** The tracked label never leaves more than a few points between glyph runs. */
  const adjacent = (a, b) => b.xMin - a.xMax < 8;

  return words
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => w.text === 'FIGURE')
    .map(({ w, i }) => {
      let number = '';
      let previous = w;
      for (let j = i + 1; j < words.length; j += 1) {
        const next = words[j];
        if (!sameLine(w, next) || !adjacent(previous, next)) break;
        if (!/^[0-9A-Z]+$/.test(next.text)) break;
        number += next.text;
        previous = next;
      }
      return { number, top: w.yMin };
    })
    .sort((a, b) => a.top - b.top);
}

/**
 * The crop box for one figure block, in PDF points.
 *
 * Bottom edge = the lowest text that still belongs to this block. Two things can
 * end a block: the next figure label on the same page, or the footer. Prose that
 * *follows* a figure (pages 15 and 16 both carry an explanatory paragraph under
 * the plot) is excluded by stopping at the source line — the last italic line
 * beginning "Source:".
 */
function figureBox(words, label, nextTop) {
  const limit = nextTop ?? FOOTER_TOP;
  const inBlock = words.filter((w) => w.yMin >= label.top - 1 && w.yMin < limit);

  const sourceWord = inBlock.find((w) => /^Source:?$/.test(w.text));
  const bottom = sourceWord
    ? Math.max(...inBlock.filter((w) => w.yMin <= sourceWord.yMax).map((w) => w.yMax))
    : Math.max(...inBlock.map((w) => w.yMax));

  return {
    left: COLUMN.left,
    top: label.top - PAD,
    right: COLUMN.right,
    bottom: bottom + PAD,
  };
}

// ── Rasterize ───────────────────────────────────────────────────────────────

function crop(pdf, page, box, destination, dpi) {
  const scale = dpi / 72;
  const args = [
    '-f', String(page),
    '-l', String(page),
    '-r', String(dpi),
    '-x', String(Math.round(box.left * scale)),
    '-y', String(Math.round(box.top * scale)),
    '-W', String(Math.round((box.right - box.left) * scale)),
    '-H', String(Math.round((box.bottom - box.top) * scale)),
    '-png',
    '-singlefile',
    pdf,
    destination.replace(/\.png$/, ''),
  ];
  execFileSync('pdftoppm', args);
}

// ── Main ────────────────────────────────────────────────────────────────────

/**
 * @param {object} [options]
 * @param {number} [options.resolution] Raster dpi. The gallery diffs the crops
 *   against a screenshot and needs every glyph; the examples page shows them at
 *   a third of the width and does not.
 * @param {string} [options.out] Destination directory. Wiped first.
 * @param {boolean} [options.quiet] Suppress the per-plate line.
 */
function main({ resolution = RESOLUTION, out = OUT, quiet = false } = {}) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const scale = resolution / 72;
  const pages = readWordBoxes(PDF);
  const results = [];

  for (const plate of PLATES) {
    const page = pages[plate.page - 1];
    if (!page) throw new Error(`${plate.id}: page ${plate.page} is not in the PDF`);

    const labels = figureLabels(page.words);
    const index = labels.findIndex((l) => l.number === plate.figure);
    if (index === -1) {
      throw new Error(
        `${plate.id}: no "FIGURE ${plate.figure}" on page ${plate.page} ` +
          `(found: ${labels.map((l) => l.number).join(', ') || 'none'})`,
      );
    }

    const box = figureBox(page.words, labels[index], labels[index + 1]?.top);
    const file = join(out, `${plate.id}.png`);
    crop(PDF, plate.page, box, file, resolution);

    const width = Math.round((box.right - box.left) * scale);
    const height = Math.round((box.bottom - box.top) * scale);
    results.push({ id: plate.id, page: plate.page, figure: plate.figure, file, width, height });
    if (!quiet) {
      console.log(
        `  ${plate.id.padEnd(24)} p.${String(plate.page).padStart(2)} ` +
          `FIGURE ${plate.figure.padEnd(3)} ${width}×${height}px`,
      );
    }
  }

  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`Cutting ${PLATES.length} reference plates from the spec PDF …`);
  main();
  console.log(`\nWrote ${readdirSync(OUT).length} plates to gallery/out/reference/`);
}

export { main as buildPlates, RESOLUTION, PT_TO_PX };
