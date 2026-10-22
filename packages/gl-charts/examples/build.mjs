/**
 * build.mjs — bundle the examples page into one self-contained HTML file.
 *
 * "Self-contained" is the requirement, and it is a stronger one than it sounds.
 * The output must render identically on a machine that has never seen this
 * repository: no CDN, no `node_modules`, no sibling `data/` directory, no fonts
 * installed on the host. One file you can email. That rules out every ordinary
 * asset pipeline, so everything is inlined:
 *
 * | Asset | How it gets in |
 * |---|---|
 * | JS + React + charts | esbuild bundle, IIFE, inlined in a `<script>` |
 * | Atlas data | imported as JSON, so esbuild inlines it into the bundle |
 * | Theme + page CSS | esbuild CSS output, inlined in a `<style>` |
 * | Fonts | woff2 → base64 `data:` URIs in generated `@font-face` rules |
 * | Chrome tokens | generated from `src/tokens.ts`, never hand-written |
 * | Demo registry | the `#region` markers in the family files, read at build time |
 *
 * IIFE rather than ESM for the same reason the gallery uses it: the page is
 * opened over `file://`, and Chrome refuses to load a `type="module"` script
 * from a null origin.
 *
 * Run: node examples/build.mjs   →   examples/out/index.html
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';

import { fontFaces } from '../scripts/emit-tokens.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const REPO = join(PKG, '..', '..');
const BUILD = join(HERE, 'out', '.build');
const OUT = join(HERE, 'out');

// ── Demo source extraction ──────────────────────────────────────────────────

/**
 * Lift each demo's code out of its family file.
 *
 * The page itself no longer prints any of it — it shows charts and nothing else
 * — but the keys are the roster `check.mjs` holds the mounted page against, and
 * the only list of expected demos that a `.mjs` script can read without
 * compiling the `.tsx` family files. A demo that stops rendering is otherwise
 * invisible on a page this long.
 *
 * Explicit `// #region demo:<id>` markers rather than brace-matching from the
 * function declaration: brace-matching would work today and break the first time
 * a demo contains a string with a `}` in it.
 */
function extractSources() {
  const sources = {};
  const files = readdirSync(HERE).filter((f) => /^demos-.*\.tsx$/.test(f));

  if (files.length === 0) {
    throw new Error('No demos-*.tsx files found — nothing to build.');
  }

  for (const file of files) {
    const text = readFileSync(join(HERE, file), 'utf8');
    const re = /^[ \t]*\/\/ #region demo:([\w-]+)[ \t]*\n([\s\S]*?)^[ \t]*\/\/ #endregion[ \t]*$/gm;
    let match;
    while ((match = re.exec(text)) !== null) {
      const [, id, body] = match;
      if (sources[id]) throw new Error(`Duplicate demo region "${id}" (second one in ${file}).`);
      sources[id] = dedent(body).trimEnd();
    }
  }
  return sources;
}

/** Strip the common leading indentation so the panel doesn't show dead space. */
function dedent(text) {
  const lines = text.replace(/\t/g, '  ').split('\n');
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length);
  const strip = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(strip)).join('\n');
}

// ── Fonts ───────────────────────────────────────────────────────────────────

/**
 * The typefaces the spec names, inlined — so the page can be handed to someone.
 *
 * A GL figure rendered in Times and Helvetica is not a GL figure, and axis
 * gutters are sized from measured text, so a substitution moves the geometry too.
 *
 * The face list itself lives in `tokens.json` (`fonts.faces`) and is shared with
 * `src/fonts.css` and the docs page, because the one thing that must never drift
 * is the `family` name: it has to equal the first entry of the stack the tokens
 * ask for. Declaring the face as `InterVariable` while `--font-sans` asks for
 * `Inter` inlines 340 KB no selector can match and drops the page to the system
 * sans. `scripts/emit-tokens.mjs` owns that rule now; see its `fontFaces()`.
 */
const fontCss = () => fontFaces();

// ── Chrome tokens ───────────────────────────────────────────────────────────

/**
 * `src/tokens.css` scopes every custom property to `.gl-figure`, deliberately —
 * so an unprefixed `--accent` cannot collide with a host application's. The page
 * chrome lives outside any figure and still has to be the same ink on the same
 * paper, so it needs those values at `:root` under names of its own.
 *
 * Generated from `src/tokens.ts` rather than typed out here. Hand-copying them
 * would make this file a downstream token carrier — exactly the kind of copy
 * `tokens:downstream` exists to hunt down — and it would be wrong the first time
 * `grammar.md` changed a hex.
 */
async function chromeTokenCss() {
  mkdirSync(BUILD, { recursive: true });
  const tokensJs = join(BUILD, 'tokens.mjs');
  await esbuild.build({
    entryPoints: [join(PKG, 'src', 'tokens.ts')],
    bundle: true,
    format: 'esm',
    target: 'es2022',
    outfile: tokensJs,
    logLevel: 'silent',
  });
  const t = await import(`file://${tokensJs}?v=${Date.now()}`);

  const rows = [
    ['--ex-ink', t.ink.DEFAULT],
    ['--ex-ink-2', t.ink[2]],
    ['--ex-ink-3', t.ink[3]],
    ['--ex-ink-4', t.ink[4]],
    ['--ex-paper', t.surface.paper],
    ['--ex-paper-warm', t.surface.paperWarm],
    ['--ex-rule', t.surface.rule],
    ['--ex-gridline', t.surface.gridline],
    ['--ex-accent', t.accent.DEFAULT],
    ['--ex-accent-deep', t.accent.deep],
    ['--ex-accent-tint', t.accent.tint],
    ['--ex-font-sans', t.family.sans],
    ['--ex-font-serif', t.family.serif],
    ['--ex-text-size', `${t.minTextSize}px`],
  ];

  return [
    '/* GENERATED from src/tokens.ts by examples/build.mjs — do not edit. */',
    ':root {',
    ...rows.map(([name, value]) => `  ${name}: ${value};`),
    '}',
  ].join('\n');
}

// ── Bundle ──────────────────────────────────────────────────────────────────

async function bundle() {
  mkdirSync(BUILD, { recursive: true });

  const result = await esbuild.build({
    entryPoints: [join(HERE, 'entry.tsx')],
    bundle: true,
    format: 'iife',
    target: 'es2022',
    jsx: 'automatic',
    outfile: join(BUILD, 'examples.js'),
    // Production: this page is a deliverable, not a development harness. The
    // gallery builds in development precisely to surface `[gl-charts]` warnings;
    // here they would be console noise for a reader.
    define: { 'process.env.NODE_ENV': '"production"' },
    minify: true,
    loader: { '.css': 'css', '.json': 'json' },
    metafile: true,
    logLevel: 'warning',
  });

  const js = readFileSync(join(BUILD, 'examples.js'), 'utf8');
  const cssPath = join(BUILD, 'examples.css');
  const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : '';
  return { js, css, metafile: result.metafile };
}

// ── Emit ────────────────────────────────────────────────────────────────────

/**
 * `</script>` anywhere inside the inlined JS would close the tag early. It can
 * legitimately appear in a string — a demo that renders markup, say — so it is
 * escaped rather than assumed absent.
 */
const escapeScript = (js) => js.replace(/<\/script/gi, '<\\/script');

function emit({ js, css, fonts, tokens, count }) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>gl-charts — ${count} charts from Atlas data</title>
<style>
${fonts}

${tokens}

${css}
</style>
</head>
<body>
<div id="root"></div>
<script>${escapeScript(js)}</script>
</body>
</html>
`;
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'index.html'), html);
  return html.length;
}

// ── Main ────────────────────────────────────────────────────────────────────

export async function buildExamples({ quiet = false } = {}) {
  rmSync(BUILD, { recursive: true, force: true });

  const sources = extractSources();
  const [tokens, fonts] = [await chromeTokenCss(), fontCss()];
  const { js, css, metafile } = await bundle();

  const ids = Object.keys(sources);
  const bytes = emit({ js, css, fonts, tokens, count: ids.length });

  if (!quiet) {
    const dataBytes = Object.entries(metafile.inputs)
      .filter(([p]) => p.includes('examples/data/'))
      .reduce((a, [, v]) => a + v.bytes, 0);
    console.log(`  ${ids.length} demos registered`);
    console.log(
      `  js ${kb(js.length)}  css ${kb(css.length)}  fonts ${kb(fonts.length)}  ` +
        `data ${kb(dataBytes)}`,
    );
    console.log(`\nWrote examples/out/index.html — ${kb(bytes)}, self-contained`);
  }
  return { ids, bytes };
}

const kb = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildExamples();
}
