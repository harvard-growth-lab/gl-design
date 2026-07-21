#!/usr/bin/env node
// size-images.js — inject Marp physical-width keywords into markdown images.
//
// GL charts bake their text in as PIXELS at a fixed dpi (save_fig → ragg,
// 300dpi). Marp/Chromium sizes a PNG at px÷96 and the theme's max-width then
// rescales it to fit the slide, multiplying every baked-in label, tick, and
// axis title by the scale factor. We counter that by giving each chart PNG an
// explicit Marp width keyword `w:<css_px>` where
//
//     css_px = pixel_width × 96 ÷ dpi
//
// so the image displays at its true physical size (display-inches ==
// render-inches) and the text lands at the point size ggplot drew it. This
// mirrors the gl-figure.lua stamp on the pdf/html path and the inch-width pin
// growthlabbify.lua already applies on the Word path.
//
// Bare numbers are px in Marp, which is why we emit px rather than `in`.
//
// Usage: node size-images.js input.md output.md

const fs = require('fs');
const path = require('path');

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error('Usage: node size-images.js input.md output.md');
  process.exit(1);
}

const baseDir = path.dirname(path.resolve(inPath));

// Read width_px and dpi straight from a PNG (IHDR width + pHYs resolution).
function pngDims(file) {
  let buf;
  try { buf = fs.readFileSync(file); } catch { return null; }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 33 || !buf.subarray(0, 8).equals(sig)) return null;
  const width = buf.readUInt32BE(16); // IHDR width: bytes 16-19
  let dpi = null;
  let pos = 8; // first chunk
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    if (type === 'pHYs') {
      const ppuX = buf.readUInt32BE(pos + 8); // pixels per unit, x
      const unit = buf[pos + 16];             // 1 = metre
      if (unit === 1 && ppuX > 0) dpi = Math.round(ppuX * 0.0254);
      break;
    }
    if (type === 'IEND') break;
    pos += 12 + len; // length(4) + type(4) + data + crc(4)
  }
  return { width, dpi: dpi || 300 };
}

// Skip images that already carry a Marp size keyword or are background/layout
// directives (`bg`) — never override an author's explicit intent.
const HAS_SIZE = /(^|\s)(w|h|width|height):/i;
const HAS_BG = /(^|\s)bg(\s|$)/i;

const src = fs.readFileSync(inPath, 'utf8');
const out = src.replace(
  /!\[([^\]]*)\]\(([^)\s]+)(\s+"[^"]*")?\)/g,
  (m, alt, imgSrc, title) => {
    if (!/\.png$/i.test(imgSrc)) return m;
    if (HAS_SIZE.test(alt) || HAS_BG.test(alt)) return m;
    const file = path.isAbsolute(imgSrc)
      ? imgSrc
      : path.join(baseDir, imgSrc.replace(/^file:\/\//, ''));
    const dims = pngDims(file);
    if (!dims) return m;
    const cssPx = Math.round((dims.width * 96) / dims.dpi);
    const newAlt = alt ? `${alt} w:${cssPx}` : `w:${cssPx}`;
    return `![${newAlt}](${imgSrc}${title || ''})`;
  }
);

fs.writeFileSync(outPath, out);
