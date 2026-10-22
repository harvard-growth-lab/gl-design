/**
 * build-docs.mjs — the primitives reference, as one static HTML file.
 *
 * This is the *third* question the package answers about itself, and the only
 * one the other two cannot:
 *
 *   gallery/    can the library draw this on-spec?      → plate pairs
 *   examples/   does it survive real Atlas data?        → worked demos
 *   docs/       what IS each primitive, exactly?        → this page
 *
 * So it is deliberately NOT a demo page. There is no `<Chart>` here, no
 * TanStack render, no dataset: a reader who wants a whole chart has
 * `examples/out/index.html` for that. What this page carries is the vocabulary —
 * every exported token, tone, axis preset, mark, compose helper, scale and
 * shape, with its signature, its option list, and the prose that says which spec
 * rule it serves.
 *
 * **Nothing on the page is hand-written.** Three extractors feed it, and each
 * one reads the artifact that already owns its facts:
 *
 * | Section of the page | Extracted from | By |
 * |---|---|---|
 * | Signatures, options, prose | `src/**` TypeScript | the TS compiler API |
 * | Mark defaults + swatches | `glDefaults()` **called** | esbuild → import |
 * | Token values | `tokens.json` + `src/tokens.ts` | read + import |
 *
 * The middle row is the one worth arguing for. The mark defaults table is the
 * single most useful thing this package could document — which properties the
 * spec pins and which the caller may override — and it exists nowhere in prose,
 * only in one `DEFAULTS` table of arrow functions in `marks.ts`. Transcribing it
 * would create a copy that drifts the first time a value moves. So the page
 * *runs* `glDefaults(kind, {})` for every kind, and probes each resulting
 * property with a sentinel to see whether the caller's value survives. Pinned
 * vs. overridable is measured, not claimed, and the swatch beside each row is
 * stroked with the numbers that came back.
 *
 * Self-contained, for the same reason `examples/` is: fonts, CSS and script are
 * inlined, so the file can be handed to someone who does not have this repo.
 *
 *   node docs/build-docs.mjs            → docs/out/index.html
 *   node docs/build-docs.mjs --check    → build, then fail on an undocumented
 *                                         export or an external reference
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';
import ts from 'typescript';

import { fontFaces } from '../scripts/emit-tokens.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const REPO = join(PKG, '..', '..');
const OUT = join(HERE, 'out');
const BUILD = join(OUT, '.build');

// ── The roster ──────────────────────────────────────────────────────────────
//
// Explicit and ordered, not a directory scan. The order IS the page's reading
// order — tokens before tones before marks before the helpers that arrange
// them — and a scan would sort `chart.ts` above `tokens.ts` and teach the
// vocabulary backwards. A new module is one line here.

const ENTRIES = [
  {
    id: 'main',
    title: 'Main entry',
    specifier: '@growth-lab/gl-charts',
    // The barrel this entry publishes. `check()` reads its `export * from`
    // lines and fails if one names a module the roster below forgot — the one
    // way a whole module can go missing without any parse failing.
    entryFile: 'src/index.ts',
    blurb:
      'Tokens, tone resolution, the theme and axis presets, GL-defaulted marks, and the ' +
      'compose helpers. Produces plain chart data and pulls in no framework.',
    modules: [
      { file: 'src/tone.ts', title: 'GLTone' },
      { file: 'src/chart.ts', title: 'Chart & axes' },
      { file: 'src/marks.ts', title: 'Marks', marks: true },
      { file: 'src/hexbin.ts', title: 'Hexbin' },
      { file: 'src/compose.ts', title: 'Compose' },
      { file: 'src/scales.ts', title: 'Scales' },
    ],
  },
  {
    id: 'react',
    title: 'Figure chrome',
    specifier: '@growth-lab/gl-charts/react',
    blurb:
      'The figure furniture around a chart — label, title, subtitle, legend placement, ' +
      'source line. The only entry point that requires React.',
    modules: [{ file: 'src/figure.tsx', title: 'Figure & legends' }],
  },
  {
    id: 'shapes',
    title: 'Shapes',
    specifier: '@growth-lab/gl-charts/shapes',
    entryFile: 'src/shapes.ts',
    blurb:
      'The chart types TanStack cannot express from marks, plus the polar surface. These ' +
      'carry their own geometry — a squarified layout, a KDE, a projection, a force ' +
      'simulation — which is why they sit behind their own subpath.',
    modules: [
      { file: 'src/shapes/polar.ts', title: 'Polar & donut' },
      { file: 'src/shapes/radar.ts', title: 'Radar' },
      { file: 'src/shapes/treemap.ts', title: 'Treemap' },
      { file: 'src/shapes/distribution.ts', title: 'Boxplot & violin' },
      { file: 'src/shapes/geo.ts', title: 'Choropleth' },
      { file: 'src/shapes/network.ts', title: 'Sankey, force, Voronoi' },
      { file: 'src/shapes/contour.ts', title: 'Contours' },
    ],
  },
];

// ── Source parsing ──────────────────────────────────────────────────────────

/**
 * Read a module's exported surface out of its TypeScript source.
 *
 * The TS compiler API rather than regex, for the same reason `examples/build.mjs`
 * uses explicit region markers rather than brace-matching: the failure mode of a
 * hand parser is silent and plausible — a truncated signature that still looks
 * like a signature. `typescript` is already a devDependency for `npm run
 * typecheck`, so this costs nothing.
 */
function parseModule(mod) {
  const abs = join(PKG, mod.file);
  const text = readFileSync(abs, 'utf8');
  const sf = ts.createSourceFile(
    abs,
    text,
    ts.ScriptTarget.ES2022,
    /* setParentNodes */ true,
    mod.file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const header = fileHeader(text);
  const symbols = [];
  let section = null;
  // The previous statement's doc, for the pairs this source writes under one
  // block: `FOCUS_TONES` / `MAX_FOCUS`, `MIN_RADAR_DIMENSIONS` /
  // `MAX_RADAR_DIMENSIONS`. Only a statement sitting flush against the last one
  // — no blank line, no comment of its own — inherits it, which is what keeps
  // the next unrelated export from picking up a note that was never about it.
  let prev = null;

  for (const node of sf.statements) {
    const { banner, doc } = leadingOf(text, node, header.end);
    if (banner) section = banner;

    // Exactly one newline: a blank line between two exports means the note
    // above the first was never about the second.
    const flush = prev?.doc && /^[ \t]*\n[ \t]*$/.test(text.slice(prev.end, node.getStart(sf)));
    const effective = doc ?? (flush ? prev.doc : null);
    prev = { end: node.end, doc: effective };

    if (!isExported(node)) continue;
    for (const sym of symbolsOf(node, sf, text)) {
      symbols.push({
        ...sym,
        doc: sym.doc ?? effective,
        docShared: !sym.doc && !doc && !!effective,
        section,
      });
    }
  }

  return { ...mod, header: header.doc, symbols: linkOptions(resolveMarks(symbols)) };
}

/**
 * Point a function at the interface that types its options.
 *
 * `glLine(data, options: GLLineOptions<T>)` and its option list are two cards
 * apart on the page, and the option list is where the actual documentation is
 * for most of the surface. The link is only rendered when the target is exported
 * from the same module, so it can never dangle.
 */
function linkOptions(symbols) {
  const declared = new Set(symbols.filter((s) => s.kind === 'interface').map((s) => s.name));
  for (const sym of symbols) {
    const last = sym.params?.at(-1);
    if (!last) continue;
    const base = /^([A-Za-z_$][\w$]*)/.exec(last.replace(/^\s*/, ''))?.[1];
    if (base && declared.has(base) && base !== sym.name) sym.optionsType = base;
  }
  return symbols;
}

// The two shapes a section rule takes in this source. Both are box-drawing
// characters, and neither can be allowed through as prose: a 76-character run of
// `═` is unbreakable, so a single one widens the whole page.
const RULE_ONLY = /^[\s─═]{4,}$/;
const INLINE_BANNER = /^\s*[─═]{2,}\s*(\S.*?)\s*[─═]*\s*$/;

/** The file's own doc comment: the first block comment, before any statement. */
function fileHeader(text) {
  const m = /^\s*\/\*\*([\s\S]*?)\*\//.exec(text);
  return m ? { doc: stripJsdoc(m[0]), end: m.index + m[0].length } : { doc: null, end: 0 };
}

/**
 * The comments attached to a statement, split into the two kinds that matter.
 *
 * A `// ── Title ─────` banner is a *section* — the source files are organised
 * with them, and mirroring that organisation is free structure for the page. A
 * `/** … *\/` block is the symbol's doc. A bare run of `//` lines immediately
 * above the statement is treated as its doc too, because several exports
 * (`export { resolveTone }`) are explained that way.
 */
function leadingOf(text, node, headerEnd) {
  const ranges = ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [];
  let banner = null;
  let jsdoc = null;
  let trailingLines = null;
  let trailingEnd = -1;
  let afterRule = false;

  for (const r of ranges) {
    if (r.end <= headerEnd) continue;
    const raw = text.slice(r.pos, r.end);

    if (raw.startsWith('/**')) {
      jsdoc = stripJsdoc(raw);
      trailingLines = null;
      continue;
    }
    if (raw.startsWith('/*')) continue;

    const line = raw.replace(/^\/\/ ?/, '');

    // A bare rule opens or closes a boxed banner:
    //     // ══════════
    //     // Sankey
    //     // ══════════
    if (RULE_ONLY.test(line)) {
      afterRule = true;
      trailingLines = null;
      continue;
    }
    if (afterRule) {
      afterRule = false;
      trailingLines = null;
      // Before the title, this is the title; after it, the banner's body.
      if (banner) banner.body.push(line);
      else banner = { title: line.trim(), body: [] };
      continue;
    }

    // …and the one-line form puts the rule and the title on the same line:
    //     // ── Shared ──────────
    const inlineBanner = INLINE_BANNER.exec(line);
    if (inlineBanner) {
      banner = { title: inlineBanner[1], body: [] };
      trailingLines = null;
      continue;
    }

    if (banner && banner.body.length === 0 && trailingLines === null && r.pos < node.getStart()) {
      banner.body.push(line);
      continue;
    }
    // Anything else is a candidate doc for the statement itself.
    (trailingLines ??= []).push(line);
    trailingEnd = r.end;
  }

  // Only adopt bare `//` lines as documentation when nothing but whitespace
  // separates them from the statement.
  const adjacent =
    trailingLines && /^\s*$/.test(text.slice(trailingEnd, node.getStart()));

  return { banner, doc: jsdoc ?? (adjacent ? trailingLines : null) };
}

/** `/** a\n * b *\/` → `['a', 'b']`, with the framing stripped and blanks trimmed. */
function stripJsdoc(raw) {
  const lines = raw
    .replace(/^\/\*\*/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\* ?/, '').replace(/\s+$/, ''));
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  return lines;
}

const isExported = (node) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

/**
 * One statement → zero or more documented symbols.
 *
 * `const a = 1, b = 2` is the reason this returns an array; the doc comment
 * hangs off the statement, so both declarations inherit it.
 */
function symbolsOf(node, sf, text) {
  const src = (from, to) => text.slice(from, to).replace(/\s+$/, '');

  if (ts.isFunctionDeclaration(node) && node.name) {
    const end = node.body ? node.body.getStart(sf) : node.end;
    return [
      {
        name: node.name.text,
        kind: /^[A-Z]/.test(node.name.text) && sf.fileName.endsWith('.tsx') ? 'component' : 'fn',
        signature: unexport(src(node.getStart(sf), end)),
        mark: analyzeMark(node, sf),
        params: node.parameters.map((p) => (p.type ? p.type.getText(sf) : '')),
      },
    ];
  }

  if (ts.isInterfaceDeclaration(node)) {
    const bodyStart = text.lastIndexOf('{', node.members.pos);
    return [
      {
        name: node.name.text,
        kind: 'interface',
        signature: unexport(src(node.getStart(sf), bodyStart)),
        members: node.members.map((m) => memberOf(m, sf, text)),
      },
    ];
  }

  if (ts.isTypeAliasDeclaration(node)) {
    return [
      {
        name: node.name.text,
        kind: 'type',
        signature: unexport(src(node.getStart(sf), node.end)),
        // A union of string literals is a closed vocabulary — worth rendering as
        // chips rather than making the reader pick it out of the signature.
        values: ts.isUnionTypeNode(node.type)
          ? node.type.types
              .filter((t) => ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal))
              .map((t) => t.literal.text)
          : [],
      },
    ];
  }

  if (ts.isVariableStatement(node)) {
    const kw = node.declarationList.flags & ts.NodeFlags.Const ? 'const' : 'let';
    return node.declarationList.declarations
      .filter((d) => ts.isIdentifier(d.name))
      .map((d) => {
        const type = d.type ? `: ${d.type.getText(sf)}` : '';
        const init = d.initializer ? src(d.initializer.getStart(sf), d.initializer.end) : null;
        // A long initializer is implementation, not signature. The cut-off is
        // where a value stops reading as one glance.
        const shown = init && init.length <= 320 ? ` = ${init}` : init ? ' = …' : '';
        return { name: d.name.text, kind: 'const', signature: `${kw} ${d.name.text}${type}${shown}` };
      });
  }

  // `export { resolveTone }` — a re-export, which is still part of the surface.
  if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
    const from = node.moduleSpecifier ? ` from ${node.moduleSpecifier.getText(sf)}` : '';
    return node.exportClause.elements.map((e) => ({
      name: e.name.text,
      kind: node.isTypeOnly ? 'type' : 'reexport',
      signature: `export { ${e.name.text} }${from}`,
    }));
  }

  return [];
}

function memberOf(m, sf, text) {
  const { doc } = leadingOf(text, m, 0);
  if (!m.name) return { name: m.getText(sf), type: '', optional: false, doc };
  return {
    name: m.name.getText(sf),
    optional: !!m.questionToken,
    type: m.type ? m.type.getText(sf).replace(/\s+/g, ' ') : '',
    doc,
  };
}

const unexport = (s) => s.replace(/^export\s+/, '').replace(/\s*\{?\s*$/, '');

/**
 * What a mark wrapper actually does, read off its body.
 *
 * The `gl*` wrappers are two lines each by design — the values live in
 * `DEFAULTS` — which leaves most of them with no doc comment and nothing to say
 * on the page beyond a signature anyone could have guessed. But the two lines
 * carry three facts worth documenting, and all three are in the AST: which
 * defaults kind the options are routed through, which TanStack mark is emitted,
 * and (for the `glMuted*` family) which sibling it delegates to and with what
 * pinned over the caller.
 *
 * That last one is why the preset is collected rather than just named: with it,
 * the swatch for `glMutedBar` can be drawn from `glDefaults('bar', { tone: 'muted' })`
 * and show the grey the caller will actually get, instead of the c-1 blue that a
 * kind-only lookup would have painted.
 */
function analyzeMark(node, sf) {
  if (!node.body) return null;
  let kind = null;
  let draws = null;
  let delegate = null;
  let preset = {};

  const visit = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      const name = n.expression.text;
      if (name === 'glDefaults') {
        const arg = n.arguments[0];
        if (!kind && arg && ts.isStringLiteral(arg)) kind = arg.text;
      } else if (/^gl[A-Z]/.test(name)) {
        if (!delegate) {
          delegate = name;
          const arg = n.arguments[1];
          if (arg && ts.isObjectLiteralExpression(arg)) preset = literalProps(arg);
        }
      } else if (!draws && /^[a-z]/.test(name)) {
        draws = name;
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(node.body);

  return kind || delegate ? { kind, draws, delegate, preset } : null;
}

/** The literal properties of an object literal; spreads and expressions are skipped. */
function literalProps(obj) {
  const out = {};
  for (const p of obj.properties) {
    if (!ts.isPropertyAssignment(p) || !p.name) continue;
    const key = ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : null;
    const v = p.initializer;
    if (!key) continue;
    if (ts.isStringLiteral(v)) out[key] = v.text;
    else if (ts.isNumericLiteral(v)) out[key] = Number(v.text);
    else if (v.kind === ts.SyntaxKind.TrueKeyword) out[key] = true;
    else if (v.kind === ts.SyntaxKind.FalseKeyword) out[key] = false;
  }
  return out;
}

/**
 * Follow `glMutedLine → glLine → 'line'`, carrying the pinned options down.
 *
 * Depth-capped rather than cycle-detected: the chains are one hop deep today and
 * a cap is the failure mode you want if that ever stops being true — a wrapper
 * with no swatch, not a build that hangs.
 */
function resolveMarks(symbols) {
  const byName = new Map(symbols.map((s) => [s.name, s]));
  for (const sym of symbols) {
    if (!sym.mark) continue;
    let { kind, preset } = sym.mark;
    let hop = sym.mark.delegate;
    for (let depth = 0; !kind && hop && depth < 4; depth += 1) {
      const next = byName.get(hop)?.mark;
      if (!next) break;
      // The caller's own preset wins: `glMutedLine` pins `tone` over whatever
      // `glLine` would have passed on.
      preset = { ...next.preset, ...preset };
      kind = next.kind;
      hop = next.delegate;
    }
    sym.mark = kind ? { ...sym.mark, kind, preset } : null;
  }
  return symbols;
}

// ── Runtime probes ──────────────────────────────────────────────────────────

/**
 * Bundle the bits of the library this page needs to *call*, and import them.
 *
 * `src/marks.ts` has value imports from `@tanstack/charts`, and the package
 * ships TypeScript with no build step — so the same esbuild-then-import step
 * `scripts/run-tests.mjs` uses gets it into Node.
 */
async function loadRuntime() {
  mkdirSync(BUILD, { recursive: true });
  const entry = join(BUILD, 'runtime.ts');
  writeFileSync(
    entry,
    [
      "export { glDefaults } from '../../../src/marks.js';",
      "export * as tokens from '../../../src/tokens.js';",
      '',
    ].join('\n'),
  );

  const outfile = join(BUILD, 'runtime.mjs');
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    outfile,
    logLevel: 'error',
    external: ['node:*'],
  });
  return import(`file://${outfile}?v=${Date.now()}`);
}

/** Sentinels chosen to be values no spec default could plausibly be. */
const PROBE = { number: -73317331, string: '__gl_probe__' };

/**
 * What `glDefaults(kind)` actually applies, and which of it the caller may
 * override.
 *
 * The override test is empirical: hand the property back in with a sentinel and
 * see whether the sentinel survives. `marks.ts` writes overridable properties as
 * `o.x ?? default` and pinned ones flat, so this reads the distinction straight
 * off the behaviour instead of off a convention someone has to keep honouring.
 */
function markDefaults(glDefaults, kinds) {
  return kinds.map((kind) => {
    const base = glDefaults(kind, {});
    const props = Object.entries(base).map(([key, value]) => {
      const sentinel = PROBE[typeof value];
      const pinned =
        sentinel === undefined ? null : glDefaults(kind, { [key]: sentinel })[key] !== sentinel;
      return { key, value, pinned };
    });
    return { kind, base, props };
  });
}

// ── Mark swatches ───────────────────────────────────────────────────────────
//
// One 120×32 glyph per mark kind, stroked with the values `glDefaults` just
// returned — so a swatch cannot disagree with the row beside it. These draw the
// mark and nothing else: no axes, no data, no scale. That is the whole
// distinction this page is built on.

const SW = { w: 120, h: 32 };

const attrs = (o) =>
  Object.entries(o)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}="${esc(v)}"`)
    .join(' ');

const el = (tag, o, inner = '') => `<${tag} ${attrs(o)}${inner ? `>${inner}</${tag}>` : '/>'}`;

/** Stroke properties, named the way SVG wants them. */
const strokeOf = (d) => ({
  stroke: d.stroke,
  'stroke-width': d.strokeWidth,
  'stroke-opacity': d.strokeOpacity,
  'stroke-dasharray': d.strokeDasharray,
  'stroke-linecap': d.lineCap,
  fill: 'none',
});

const fillOf = (d) => ({
  fill: d.fill,
  'fill-opacity': d.fillOpacity,
  stroke: d.stroke,
  'stroke-width': d.strokeWidth,
});

function arrowGlyph(d, x1, x2, y) {
  const head = Number(d.headLength) || 8;
  const w = head * 0.55;
  return [
    el('line', { x1, y1: y, x2: x2 - head, y2: y, ...strokeOf(d) }),
    el('path', {
      d: `M${x2} ${y} L${x2 - head} ${y - w} L${x2 - head} ${y + w} Z`,
      fill: d.stroke,
    }),
  ].join('');
}

const SWATCHES = {
  line: (d) => el('path', { d: 'M4 25 C 24 5, 40 27, 60 16 S 96 4, 116 9', ...strokeOf(d) }),

  point: (d) =>
    [22, 46, 56, 84].map((x, i) => el('circle', { cx: x, cy: [14, 20, 13, 18][i], r: d.r, ...fillOf(d), 'stroke-opacity': d.strokeOpacity })).join(''),

  area: (d) => el('path', { d: 'M4 30 L4 18 C 24 8, 40 22, 60 14 S 96 6, 116 11 L116 30 Z', ...fillOf(d) }),

  bar: (d) =>
    [18, 9, 22, 14, 26].map((h, i) => el('rect', { x: 6 + i * 23, y: 30 - h, width: 15, height: h, ...fillOf(d) })).join(''),

  tile: (d) =>
    [[4, 4, 52, 24], [58, 4, 34, 24], [94, 4, 22, 11], [94, 17, 22, 11]]
      .map(([x, y, width, height]) => el('rect', { x, y, width, height, ...fillOf(d) }))
      .join(''),

  region: (d) =>
    [[4, 6, 54, 20], [64, 6, 52, 20]]
      .map(([x, y, width, height]) => el('rect', { x, y, width, height, ...fillOf(d) }))
      .join(''),

  label: (d, t) => el('text', { x: 4, y: 21, fill: d.fill, 'font-size': d.fontSize, 'font-weight': d.fontWeight, 'font-family': t.family.sans }, 'Mongolia'),

  annotation: (d, t) => el('text', { x: 4, y: 21, fill: d.fill, 'font-size': d.fontSize, 'font-weight': d.fontWeight, 'font-family': t.family.sans }, 'Peak, 2014'),

  rule: (d) => el('line', { x1: 4, y1: 16, x2: 116, y2: 16, ...strokeOf(d) }),

  stem: (d) =>
    [14, 38, 62, 86, 108]
      .map((x, i) => {
        const y = [10, 18, 6, 14, 9][i];
        return el('line', { x1: x, y1: 29, x2: x, y2: y, ...strokeOf(d) }) + el('circle', { cx: x, cy: y, r: 3.5, fill: d.stroke });
      })
      .join(''),

  connector: (d) =>
    el('line', { x1: 22, y1: 24, x2: 98, y2: 9, ...strokeOf(d) }) +
    el('circle', { cx: 22, cy: 24, r: 3.5, fill: d.stroke }) +
    el('circle', { cx: 98, cy: 9, r: 3.5, fill: d.stroke }),

  tick: (d) => {
    const len = Number(d.length) || 8;
    return [10, 26, 33, 52, 70, 78, 104]
      .map((x) => el('line', { x1: x, y1: 16 - len / 2, x2: x, y2: 16 + len / 2, ...strokeOf(d) }))
      .join('');
  },

  arrow: (d) => arrowGlyph(d, 6, 114, 16),

  vector: (d) => arrowGlyph(d, 8, 54, 22) + arrowGlyph(d, 66, 112, 10),

  leader: (d) =>
    el('circle', { cx: 10, cy: 24, r: 3, fill: d.stroke }) +
    el('path', { d: 'M10 24 L 52 24 L 74 11 L 112 11', ...strokeOf(d) }),

  band: (d, t) =>
    el('path', { d: 'M4 24 C 28 12, 52 20, 78 10 S 104 6, 116 8 L116 20 C 104 18, 92 22, 78 22 S 28 24, 4 30 Z', ...fillOf(d) }) +
    el('path', { d: 'M4 27 C 28 18, 52 21, 78 16 S 104 12, 116 14', fill: 'none', stroke: t.categorical['c-1'].main, 'stroke-width': t.geometry.lineWidth }),
};

function swatch(kind, base, tokens) {
  const draw = SWATCHES[kind];
  const inner = draw ? draw(base, tokens) : '';
  return `<svg class="swatch" viewBox="0 0 ${SW.w} ${SW.h}" width="${SW.w}" height="${SW.h}" role="img" aria-label="${esc(kind)} mark at its GL defaults">${inner}</svg>`;
}

// ── Doc comment → HTML ──────────────────────────────────────────────────────

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Inline markup, with code spans protected first.
 *
 * Order matters and the placeholder pass is what makes it safe: a `§` or a `*`
 * inside `` `code` `` must survive verbatim, and escaping has to happen before
 * any tag is introduced or the tags get escaped too.
 */
function inline(text) {
  const code = [];
  let s = String(text).replace(/`([^`]+)`/g, (_, c) => `\u0000${code.push(c) - 1}\u0000`);

  s = esc(s);
  // http(s) links become anchors; a repo-relative path becomes plain text,
  // because this file is meant to travel and a dangling `../../grammar.md`
  // would be a broken promise rather than a link.
  s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, (_, t, u) => `<a href="${esc(u)}" rel="noreferrer">${t}</a>`);
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, (_, t) => `<span class="path">${t}</span>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  // A spec citation. Not a link: `grammar.md` does not travel with this file.
  s = s.replace(/§\s?\d+(?:\.\d+)*/g, (m) => `<span class="ref">${m}</span>`);

  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(code[i])}</code>`);
}

/**
 * A doc comment's body → block HTML.
 *
 * Paragraphs, lists, fenced code and pipe tables — the four shapes the source's
 * JSDoc actually uses. Anything else degrades to a paragraph, which is the right
 * failure mode: the prose still reads.
 */
function prose(lines, { tagsToo = true } = {}) {
  if (!lines || !lines.length) return '';

  const body = [];
  const tags = [];
  let inTag = false;
  for (const line of lines) {
    if (/^@\w+/.test(line)) {
      inTag = true;
      tags.push(line);
    } else if (inTag && /^\s+\S/.test(line)) {
      tags[tags.length - 1] += ` ${line.trim()}`;
    } else {
      inTag = false;
      body.push(line);
    }
  }

  const out = [];
  let i = 0;
  while (i < body.length) {
    const line = body[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // The same rules the section banners use also appear inside doc comments,
    // where a titled one is a subheading and a bare one is a divider. Rendered
    // as prose they would be an unbreakable 76-character word.
    if (RULE_ONLY.test(line)) {
      out.push('<hr>');
      i += 1;
      continue;
    }
    const inlineBanner = INLINE_BANNER.exec(line);
    if (inlineBanner) {
      out.push(`<h5>${inline(inlineBanner[1])}</h5>`);
      i += 1;
      continue;
    }

    if (line.trim().startsWith('```')) {
      const code = [];
      i += 1;
      while (i < body.length && !body[i].trim().startsWith('```')) code.push(body[i]), (i += 1);
      i += 1;
      out.push(`<pre class="code">${esc(dedent(code).join('\n'))}</pre>`);
      continue;
    }

    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows = [];
      while (i < body.length && /^\s*\|/.test(body[i])) rows.push(body[i].trim()), (i += 1);
      out.push(pipeTable(rows));
      continue;
    }

    if (/^\s*[-•]\s+/.test(line)) {
      const items = [];
      while (i < body.length && (/^\s*[-•]\s+/.test(body[i]) || (items.length && /^\s{2,}\S/.test(body[i])))) {
        if (/^\s*[-•]\s+/.test(body[i])) items.push(body[i].replace(/^\s*[-•]\s+/, ''));
        else items[items.length - 1] += ` ${body[i].trim()}`;
        i += 1;
      }
      out.push(`<ul>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>`);
      continue;
    }

    // An indented run that is not a list is a diagram or a small table the
    // author laid out by hand — `tokens.css → the custom properties`, say. Those
    // are ruined by reflow, so they keep their spacing.
    if (/^\s{2,}\S/.test(line)) {
      const block = [];
      while (i < body.length && (/^\s{2,}\S/.test(body[i]) || !body[i].trim())) {
        if (!body[i].trim() && !/^\s{2,}\S/.test(body[i + 1] ?? '')) break;
        block.push(body[i]);
        i += 1;
      }
      out.push(`<pre class="fixed">${esc(dedent(block).join('\n'))}</pre>`);
      continue;
    }

    const para = [];
    while (i < body.length && body[i].trim() && !/^\s*[-•|]\s/.test(body[i]) && !/^\s{2,}\S/.test(body[i])) {
      para.push(body[i].trim());
      i += 1;
    }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }

  if (tagsToo && tags.length) {
    out.push(
      `<dl class="tags">${tags
        .map((t) => {
          const [, tag, rest] = /^@(\w+)\s*(.*)$/.exec(t) ?? [, t, ''];
          return `<dt>@${esc(tag)}</dt><dd>${inline(rest)}</dd>`;
        })
        .join('')}</dl>`,
    );
  }

  return out.join('\n');
}

function pipeTable(rows) {
  const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const head = cells(rows[0]);
  const body = rows.slice(/^\s*\|[\s:|-]+\|\s*$/.test(rows[1] ?? '') ? 2 : 1);
  return [
    '<table class="md">',
    `<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>`,
    `<tbody>${body.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`,
    '</table>',
  ].join('');
}

function dedent(lines) {
  const widths = lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length);
  const strip = widths.length ? Math.min(...widths) : 0;
  return lines.map((l) => l.slice(strip));
}

// ── Tokens section ──────────────────────────────────────────────────────────

const isHex = (v) => typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v);

const chip = (hex) => `<span class="chip" style="--chip:${esc(hex)}"></span>`;

/**
 * A token declaration → a table of values.
 *
 * Values come from the emitted runtime (`src/tokens.ts`), names and prose from
 * `tokens.json`. Both are generated from the same source, so they agree by
 * construction — and taking values from the runtime means a `{ ref: 'family.sans' }`
 * in the JSON arrives here already resolved.
 */
function tokenRows(decl, value) {
  const entries = decl.entries ?? {};
  const cssOf = (key, sub) => {
    const e = entries[key];
    if (!e?.css) return null;
    return sub ? e.css[sub]?.name : e.css.name;
  };

  if (value == null) return [];

  // A single tone, or a plain map of values.
  if (!Array.isArray(value) && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, v]) => {
      if (v != null && typeof v === 'object' && !Array.isArray(v)) {
        return [
          {
            key,
            doc: entries[key]?.doc ?? null,
            parts: Object.entries(v).map(([sub, sv]) => ({
              sub,
              value: sv,
              css: cssOf(key, sub) ?? decl.css?.[sub]?.name ?? null,
            })),
          },
        ];
      }
      return [{ key, doc: entries[key]?.doc ?? null, value: v, css: cssOf(key) ?? decl.css?.[key]?.name ?? null }];
    });
  }

  if (Array.isArray(value)) return [{ key: null, value, css: null, doc: null }];
  return [{ key: null, value, css: decl.css?.name ?? null, doc: decl.doc ?? null }];
}

function renderTokenValue(v) {
  if (isHex(v)) return `${chip(v)}<code>${esc(v)}</code>`;
  if (Array.isArray(v)) {
    return v.every(isHex)
      ? `<span class="ramp">${v.map((h) => chip(h)).join('')}</span><code>${v.length} steps</code>`
      : `<code>${esc(v.join(', '))}</code>`;
  }
  return `<code>${esc(v)}</code>`;
}

function renderTokens(tokensJson, runtime) {
  const out = [];
  let section = null;

  for (const decl of tokensJson.declarations) {
    if (decl.section && decl.section.title !== section) {
      section = decl.section.title;
      out.push(`<h3 class="band" id="tok-${slug(section)}">${inline(section)}</h3>`);
      if (decl.section.body?.length) out.push(prose(decl.section.body));
    }

    const value = runtime[decl.name];
    const type = decl.ts?.type ?? decl.ts?.satisfies ?? null;

    out.push(`<article class="sym" id="sym-${esc(decl.name)}" data-name="${esc(decl.name)}">`);
    out.push(
      `<h4><span class="badge ${esc(decl.kind === 'type' || decl.kind === 'interface' ? decl.kind : 'token')}">${esc(decl.kind)}</span>` +
        `<a class="anchor" href="#sym-${esc(decl.name)}">${esc(decl.name)}</a>` +
        (type ? `<span class="type">${esc(type)}</span>` : '') +
        '</h4>',
    );
    if (decl.doc) out.push(`<div class="doc">${prose(asLines(decl.doc))}</div>`);

    if (decl.kind === 'interface' && decl.fields) {
      out.push(memberTable(Object.entries(decl.fields).map(([name, f]) => ({ name, optional: !!f.optional, type: f.type, doc: null }))));
    } else if (decl.kind === 'aggregate') {
      out.push(`<p class="note">Default export. Bundles ${decl.members.map((m) => `<code>${esc(m)}</code>`).join(', ')}.</p>`);
    } else if (decl.kind === 'derived') {
      out.push(`<pre class="code">${esc(decl.ts.expr)}</pre>`);
    } else if (decl.kind === 'type') {
      // A token type has no runtime value to tabulate — it is the key set of the
      // map it was derived from, so show those keys rather than an empty card.
      const keys = decl.unionOfKeys ? Object.keys(runtime[decl.unionOfKeys] ?? {}) : [];
      out.push(
        keys.length
          ? `<p class="chips">${keys.map((k) => `<code>'${esc(k)}'</code>`).join('')}</p>`
          : `<pre class="code">${esc(decl.expr ?? decl.ts?.type ?? '')}</pre>`,
      );
    } else {
      const rows = tokenRows(decl, value);
      if (rows.length) out.push(tokenTable(rows));
    }
    out.push('</article>');
  }
  return out.join('\n');
}

function tokenTable(rows) {
  const anyCss = rows.some((r) => r.css || r.parts?.some((p) => p.css));
  const body = rows
    .map((r) => {
      if (r.parts) {
        return r.parts
          .map(
            (p, i) =>
              `<tr>${i === 0 ? `<th rowspan="${r.parts.length}">${esc(r.key)}${r.doc ? `<span class="hint">${inline(asLines(r.doc).join(' '))}</span>` : ''}</th>` : ''}` +
              `<td class="sub">${esc(p.sub)}</td><td>${renderTokenValue(p.value)}</td>` +
              (anyCss ? `<td>${p.css ? `<code>${esc(p.css)}</code>` : ''}</td>` : '') +
              '</tr>',
          )
          .join('');
      }
      return (
        `<tr><th${r.key ? '' : ' class="unkeyed"'}>${r.key ? esc(r.key) : '—'}${r.doc ? `<span class="hint">${inline(asLines(r.doc).join(' '))}</span>` : ''}</th>` +
        `<td class="sub"></td><td>${renderTokenValue(r.value)}</td>` +
        (anyCss ? `<td>${r.css ? `<code>${esc(r.css)}</code>` : ''}</td>` : '') +
        '</tr>'
      );
    })
    .join('');
  return `<table class="values"><tbody>${body}</tbody></table>`;
}

const asLines = (d) => (d == null ? [] : Array.isArray(d) ? d : [d]);

// ── Symbol rendering ────────────────────────────────────────────────────────

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function memberTable(members) {
  if (!members?.length) return '';
  const rows = members
    .map(
      (m) =>
        `<tr><th>${esc(m.name)}${m.optional ? '<span class="opt">?</span>' : ''}</th>` +
        `<td class="ty">${m.type ? `<code>${esc(m.type)}</code>` : ''}</td>` +
        `<td class="why">${m.doc ? prose(m.doc, { tagsToo: false }) : ''}</td></tr>`,
    )
    .join('');
  return `<table class="members"><thead><tr><th>Option</th><th>Type</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderSymbol(sym, { glDefaults, tokens }) {
  const out = [`<article class="sym" id="sym-${esc(sym.name)}" data-name="${esc(sym.name)}">`];
  out.push(
    `<h4><span class="badge ${esc(sym.kind)}">${esc(sym.kind)}</span>` +
      `<a class="anchor" href="#sym-${esc(sym.name)}">${esc(sym.name)}</a></h4>`,
  );
  // Signatures render as plain escaped text. There is no tokenizer in this
  // package — `docs.css` styles `pre.sig` as a block and defines no token
  // classes, so highlighting would have been invisible even if one existed.
  out.push(`<pre class="sig">${esc(sym.signature)}</pre>`);
  if (sym.values?.length) {
    out.push(`<p class="chips">${sym.values.map((v) => `<code>'${esc(v)}'</code>`).join('')}</p>`);
  }
  if (sym.doc) {
    out.push(`<div class="doc${sym.docShared ? ' shared' : ''}">${prose(sym.doc)}</div>`);
  }
  if (sym.mark) out.push(renderMarkCard(sym.mark, glDefaults, tokens));
  if (sym.optionsType) {
    out.push(
      `<p class="seealso">Options: <a href="#sym-${esc(sym.optionsType)}"><code>${esc(sym.optionsType)}</code></a></p>`,
    );
  }
  out.push(memberTable(sym.members));
  out.push('</article>');
  return out.join('\n');
}

/**
 * The derived half of a mark wrapper's documentation: what it paints, and what
 * that looks like.
 *
 * This is the answer to the two-line wrappers having no prose of their own.
 * Rather than demanding a doc comment be written for `glBar` — which would say
 * "draws a bar" and drift the day the defaults move — the card shows the
 * defaults it will actually apply, resolved through the same call the caller
 * makes.
 */
function renderMarkCard({ kind, preset, draws, delegate }, glDefaults, tokens) {
  const resolved = glDefaults(kind, { ...preset });
  const pins = Object.entries(preset)
    .map(([k, v]) => `<code>${esc(k)}: ${typeof v === 'string' ? `'${esc(v)}'` : esc(v)}</code>`)
    .join(' ');

  const trail = [`routes through the <code>'${esc(kind)}'</code> defaults`];
  if (delegate) trail.unshift(`delegates to <code>${esc(delegate)}</code>`);
  if (draws) trail.push(`emits TanStack's <code>${esc(draws)}</code>`);

  return [
    '<div class="markcard">',
    swatch(kind, resolved, tokens),
    '<div>',
    `<p class="trail">${trail.join(' → ')}${pins ? `, pinning ${pins}` : ''}.</p>`,
    `<p class="props">${Object.entries(resolved)
      .map(([k, v]) => `<span class="prop"><code>${esc(k)}</code><b>${esc(fmtValue(v))}</b></span>`)
      .join('')}</p>`,
    '</div></div>',
  ].join('');
}

function renderMarkTable(table, tokens) {
  const rows = table
    .map(({ kind, base, props }) => {
      const cells = props
        .map(
          (p) =>
            `<span class="prop${p.pinned ? ' pinned' : ''}" title="${p.pinned ? 'Pinned by the spec — a caller value is overwritten' : 'Overridable — a caller value wins'}">` +
            `<code>${esc(p.key)}</code><b>${esc(fmtValue(p.value))}</b></span>`,
        )
        .join('');
      return `<tr><th><code>'${esc(kind)}'</code></th><td class="glyph">${swatch(kind, base, tokens)}</td><td class="props">${cells}</td></tr>`;
    })
    .join('');

  return [
    '<table class="marks"><thead><tr><th>kind</th><th>at its defaults</th><th>what it applies</th></tr></thead>',
    `<tbody>${rows}</tbody></table>`,
    '<p class="legend"><span class="prop pinned"><code>key</code><b>value</b></span> pinned by the spec — the table writes it last and a caller value is overwritten. ' +
      '<span class="prop"><code>key</code><b>value</b></span> a default — the caller\'s value wins.</p>',
  ].join('');
}

const fmtValue = (v) => String(v);

// ── Page ────────────────────────────────────────────────────────────────────

function renderNav(entries, tokenDecls) {
  const items = [];
  items.push(
    `<details open><summary>Tokens</summary><ul>` +
      tokenDecls.map((d) => `<li><a href="#sym-${esc(d.name)}" data-name="${esc(d.name)}">${esc(d.name)}</a></li>`).join('') +
      '</ul></details>',
  );
  for (const entry of entries) {
    for (const mod of entry.modules) {
      items.push(
        `<details open><summary>${esc(mod.title)}</summary><ul>` +
          mod.symbols
            .map((s) => `<li><a href="#sym-${esc(s.name)}" data-name="${esc(s.name)}">${esc(s.name)}</a></li>`)
            .join('') +
          '</ul></details>',
      );
    }
  }
  return items.join('');
}

function renderPage({ entries, tokensJson, runtime, marks, counts }) {
  const parts = [];

  parts.push(`<header class="masthead">
<p class="eyebrow">Growth Lab design system</p>
<h1>gl-charts primitives</h1>
<p class="lede">Every exported token, mark, helper and shape in <code>@growth-lab/gl-charts</code> —
what it is, what it applies, and which spec rule it serves. ${counts.symbols} symbols across
${counts.modules} modules and ${counts.entries} entry points.</p>
<p class="meta">This page documents the <em>vocabulary</em>. For whole charts drawn from real data,
see the examples page; for spec-vs-render plate pairs, the gallery. Generated from source by
<code>docs/build-docs.mjs</code> — nothing here is hand-written.</p>
</header>`);

  parts.push('<section class="entry" id="tokens">');
  parts.push('<h2>Tokens</h2>');
  parts.push(
    '<p class="blurb">Every design value in the package, authored once in <code>tokens.json</code> ' +
      'and emitted into <code>src/tokens.ts</code> and <code>src/tokens.css</code>. The CSS column is the ' +
      'custom property each value is published under, scoped to <code>.gl-figure</code>.</p>',
  );
  parts.push(renderTokens(tokensJson, runtime.tokens));
  parts.push('</section>');

  for (const entry of entries) {
    parts.push(`<section class="entry" id="entry-${esc(entry.id)}">`);
    parts.push(`<h2>${esc(entry.title)}<code class="spec">${esc(entry.specifier)}</code></h2>`);
    parts.push(`<p class="blurb">${inline(entry.blurb)}</p>`);

    for (const mod of entry.modules) {
      parts.push(`<div class="module" id="mod-${slug(mod.file)}">`);
      parts.push(`<h3>${esc(mod.title)}<span class="file">${esc(mod.file)}</span></h3>`);
      if (mod.header) parts.push(`<div class="doc modhead">${prose(mod.header)}</div>`);

      if (mod.marks) {
        parts.push('<h3 class="band">Mark defaults, measured</h3>');
        parts.push(
          '<p>Each row is <code>glDefaults(kind, {})</code>, called at build time. The swatch is drawn ' +
            'with exactly the values in the third column — no other paint is applied — and every ' +
            'property was probed with a sentinel to find out whether a caller value survives it.</p>',
        );
        parts.push(renderMarkTable(marks, runtime.tokens));
      }

      let section = null;
      for (const sym of mod.symbols) {
        if (sym.section && sym.section.title !== section) {
          section = sym.section.title;
          parts.push(`<h3 class="band" id="sec-${slug(mod.file)}-${slug(section)}">${inline(section)}</h3>`);
          const body = prose(sym.section.body);
          if (body) parts.push(`<div class="doc">${body}</div>`);
        }
        parts.push(
          renderSymbol(sym, {
            glDefaults: runtime.glDefaults,
            tokens: runtime.tokens,
          }),
        );
      }
      parts.push('</div>');
    }
    parts.push('</section>');
  }

  return parts.join('\n');
}

// ── Assets ──────────────────────────────────────────────────────────────────

/**
 * Inlined so the page travels. Same faces the examples page ships, and the same
 * reason: axis type and figure headings are the spec, and a substituted font is
 * a different document.
 *
 * The list is `tokens.json`'s `fonts.faces`, shared through the emitter, so the
 * `family` names here cannot drift from the stack `--font-sans` / `--font-serif`
 * declare — the drift that silently drops a page to the system font.
 */
const fontCss = () => fontFaces();

/**
 * The page chrome's own custom properties.
 *
 * `src/tokens.css` scopes everything to `.gl-figure` so an unprefixed `--accent`
 * cannot collide with a host app's. This page is not a figure and still has to be
 * the same ink on the same paper, so it republishes the values it needs at
 * `:root` under a `--dc-` prefix — generated, never typed out.
 */
function chromeCss(t) {
  const rows = [
    ['--dc-ink', t.ink.DEFAULT],
    ['--dc-ink-2', t.ink[2]],
    ['--dc-ink-3', t.ink[3]],
    ['--dc-ink-4', t.ink[4]],
    ['--dc-paper', t.surface.paper],
    ['--dc-paper-warm', t.surface.paperWarm],
    ['--dc-rule', t.surface.rule],
    ['--dc-gridline', t.surface.gridline],
    ['--dc-accent', t.accent.DEFAULT],
    ['--dc-accent-deep', t.accent.deep],
    ['--dc-accent-tint', t.accent.tint],
    ['--dc-c2', t.categorical['c-2'].dark],
    ['--dc-c3', t.categorical['c-3'].dark],
    ['--dc-font-sans', t.family.sans],
    ['--dc-font-serif', t.family.serif],
    ['--dc-text', `${t.minTextSize}px`],
  ];
  return ['/* GENERATED from src/tokens.ts by docs/build-docs.mjs — do not edit. */', ':root {', ...rows.map(([n, v]) => `  ${n}: ${v};`), '}'].join('\n');
}

const escapeScript = (js) => js.replace(/<\/script/gi, '<\\/script');

function emit({ nav, body, css, fonts, tokens, script, counts }) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>gl-charts — ${counts.symbols} primitives</title>
<style>
${fonts}

${tokens}

${css}
</style>
</head>
<body>
<div class="shell">
<aside class="sidebar">
  <a class="brand" href="#top">gl-charts</a>
  <input id="filter" type="search" placeholder="Filter ${counts.symbols} symbols…" autocomplete="off" spellcheck="false">
  <nav id="nav">${nav}</nav>
</aside>
<main id="top">
${body}
</main>
</div>
<script>${escapeScript(script)}</script>
</body>
</html>
`;
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'index.html'), html);
  return html;
}

// ── Check ───────────────────────────────────────────────────────────────────

/**
 * What the page claims about itself, verified — and what it can only report.
 *
 * The split follows the repo's existing line (`tokens:check` fails,
 * `tokens:downstream` reports): a **failure** is an invariant the page cannot be
 * published without, a **report** is a number someone should look at.
 *
 * Empty coverage is a failure, because a module that parses to nothing is a
 * renamed file or a parser regression and the page would silently lose a whole
 * section. A missing doc comment is a report, because the two-line mark wrappers
 * genuinely have nothing to say that `renderMarkCard` does not derive, and a
 * gate that failed on them would only ever be satisfied by filler prose.
 *
 * An **unlisted** module is a failure too, and it is the one this gate used to
 * miss entirely: the roster is explicit, so a module absent from it is never
 * parsed, and a check that only looks at what was parsed cannot see the hole.
 * `src/hexbin.ts` sat outside the page that way. So the barrel each entry
 * publishes is read back, and every `export * from` in it must land on a roster
 * module.
 */

/**
 * Modules a barrel re-exports that the page covers somewhere other than the
 * roster. Only `tokens.ts`, which has its own generated section built from
 * `tokens.json` — see the token extractor.
 */
const COVERED_ELSEWHERE = new Set(['src/tokens.ts']);

/** Resolve an `export * from './x.js'` specifier to a repo-relative source path. */
function reexportTarget(entryFile, specifier) {
  const dir = entryFile.slice(0, entryFile.lastIndexOf('/'));
  return `${dir}/${specifier.replace(/^\.\//, '').replace(/\.js$/, '.ts')}`;
}

function check(entries, html) {
  const problems = [];
  const notes = [];

  for (const entry of entries) {
    for (const mod of entry.modules) {
      if (!mod.symbols.length) problems.push(`No exports parsed from ${mod.file} — the page lost a section.`);
    }

    if (!entry.entryFile) continue;
    const listed = new Set(entry.modules.map((m) => m.file));
    const barrel = readFileSync(join(PKG, entry.entryFile), 'utf8');
    for (const [, specifier] of barrel.matchAll(/^\s*export\s+\*\s+from\s+'([^']+)'/gm)) {
      const target = reexportTarget(entry.entryFile, specifier);
      if (listed.has(target) || COVERED_ELSEWHERE.has(target)) continue;
      problems.push(
        `${entry.entryFile} re-exports ${target}, which is not in the '${entry.id}' roster — ` +
          `its exports are missing from the page. Add { file: '${target}', title: … }.`,
      );
    }
  }

  const external = [
    [/<link\b/i, '<link> element'],
    [/<script[^>]+\bsrc=/i, '<script src>'],
    [/url\(\s*['"]?https?:/i, 'remote url() in CSS'],
    [/<img[^>]+\bsrc=["']?(?!data:)/i, '<img> with a non-data src'],
  ].filter(([re]) => re.test(html));
  for (const [, what] of external) problems.push(`Not self-contained: found ${what}.`);

  // A card is thin only if nothing at all was found for it: no prose, no
  // documented options, no derived mark defaults, no closed vocabulary.
  const symbols = entries.flatMap((e) => e.modules.flatMap((m) => m.symbols.map((s) => ({ ...s, file: m.file }))));
  const thin = symbols.filter(
    (s) =>
      s.kind !== 'reexport' &&
      !s.doc?.length &&
      !s.mark &&
      !s.optionsType &&
      !s.values?.length &&
      !s.members?.length,
  );
  notes.push(`${symbols.length - thin.length}/${symbols.length} symbols carry prose, options or derived defaults.`);
  if (thin.length) {
    notes.push(`${thin.length} render as a signature alone:`);
    for (const s of thin) notes.push(`    ${s.file}  ${s.name}`);
  }

  return { problems, notes };
}

// ── Main ────────────────────────────────────────────────────────────────────

export async function buildDocs({ quiet = false, checking = false } = {}) {
  rmSync(BUILD, { recursive: true, force: true });

  const runtime = await loadRuntime();
  const tokensJson = JSON.parse(readFileSync(join(PKG, 'tokens.json'), 'utf8'));

  const entries = ENTRIES.map((e) => ({ ...e, modules: e.modules.map(parseModule) }));

  // The kind list is read off the `GLMarkKind` union rather than typed out, so
  // the table cannot fall behind the type it documents.
  const marksModule = entries.flatMap((e) => e.modules).find((m) => m.marks);
  const kinds = marksModule?.symbols.find((s) => s.name === 'GLMarkKind')?.values ?? [];
  if (!kinds.length) throw new Error('GLMarkKind union not found — the mark table would be empty.');
  const marks = markDefaults(runtime.glDefaults, kinds);

  const counts = {
    entries: entries.length,
    modules: entries.reduce((n, e) => n + e.modules.length, 0),
    symbols:
      entries.reduce((n, e) => n + e.modules.reduce((m, x) => m + x.symbols.length, 0), 0) +
      tokensJson.declarations.length,
  };

  const html = emit({
    nav: renderNav(entries, tokensJson.declarations),
    body: renderPage({ entries, tokensJson, runtime, marks, counts }),
    css: readFileSync(join(HERE, 'docs.css'), 'utf8'),
    script: readFileSync(join(HERE, 'page.js'), 'utf8'),
    fonts: fontCss(),
    tokens: chromeCss(runtime.tokens),
    counts,
  });

  rmSync(BUILD, { recursive: true, force: true });

  const { problems, notes } = checking ? check(entries, html) : { problems: [], notes: [] };

  if (!quiet) {
    console.log(`  ${counts.symbols} symbols — ${counts.modules} modules, ${kinds.length} mark kinds`);
    console.log(`\nWrote docs/out/index.html — ${kb(html.length)}, self-contained`);
    if (notes.length) console.log(`\n${notes.join('\n')}`);
    for (const p of problems) console.error(`\n${p}`);
  }

  return { counts, problems, notes, bytes: html.length };
}

const kb = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

if (import.meta.url === `file://${process.argv[1]}`) {
  const checking = process.argv.includes('--check');
  const { problems } = await buildDocs({ checking });
  if (problems.length) process.exit(1);
}
