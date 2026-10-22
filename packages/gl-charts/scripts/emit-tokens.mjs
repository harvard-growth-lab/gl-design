/**
 * emit-tokens.mjs — tokens.json → src/tokens.ts + src/tokens.css.
 *
 *   node scripts/emit-tokens.mjs          write both files
 *   node scripts/check-tokens.mjs         prove the files on disk match this emitter
 *
 * Before this script existed, every design value was hand-copied into four
 * renderers (the typed module, the custom-property block, the plain-JS copy the
 * gallery audit bundles, and literal hex in reference/build-reference.mjs) and
 * `theme.css` carried the comment "Mirrors src/tokens.ts exactly; if the two ever
 * disagree, both are wrong". That comment is now this build step.
 *
 * The prose matters as much as the values: each doc string in `tokens.json`
 * records WHICH spec rule its value serves and what breaks without it, so the
 * emitter carries every one of them into JSDoc / CSS comments. A generated file
 * with the comments stripped would be a downgrade, not a refactor.
 *
 * Plain ESM, no dependencies, `node:` builtins only — same as gallery/*.mjs.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PKG = join(HERE, '..');
export const SOURCE = join(PKG, 'tokens.json');

/** Column the `// ── … ─` section rules are padded to in the TS output. */
const TS_RULE_WIDTH = 79;
/** Same, for the `/* ── … ─ *\/` rules in the CSS output (2-space indented). */
const CSS_RULE_WIDTH = 77;

export function loadTokens(file = SOURCE) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

// ── Small formatting helpers ────────────────────────────────────────────────

const asLines = (doc) => (doc == null ? [] : Array.isArray(doc) ? doc : [doc]);

/** A JS string literal, preferring single quotes the way the source did. */
function str(s) {
  return s.includes("'") && !s.includes('"')
    ? `"${s}"`
    : `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** Object keys stay bare where TypeScript allows it; `'c-1'` has to be quoted. */
const key = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) || /^\d+$/.test(k) ? k : str(k));

function jsdoc(doc, indent = '') {
  const lines = asLines(doc);
  if (!lines.length) return [];
  if (lines.length === 1) return [`${indent}/** ${lines[0]} */`];
  return [
    `${indent}/**`,
    ...lines.map((l) => (l ? `${indent} * ${l}` : `${indent} *`)),
    `${indent} */`,
  ];
}

/** `// ── Title ────…` padded to TS_RULE_WIDTH characters (not bytes). */
function tsSection(section) {
  if (!section) return [];
  const head = `// ── ${section.title} `;
  const pad = Math.max(1, TS_RULE_WIDTH - [...head].length);
  return [
    head + '─'.repeat(pad),
    ...asLines(section.body).map((l) => (l ? `// ${l}` : '//')),
    '',
  ];
}

const tsValue = (v) => (typeof v === 'string' ? str(v) : String(v));

/** `ink.2` → `ink[2]`, `family.sans` → `family.sans`, `a.b-c` → `a['b-c']`. */
function tsAccessor(path) {
  const [head, ...rest] = path.split('.');
  return (
    head +
    rest
      .map((seg) =>
        /^\d+$/.test(seg) ? `[${seg}]` : /^[A-Za-z_$][\w$]*$/.test(seg) ? `.${seg}` : `[${str(seg)}]`,
      )
      .join('')
  );
}

// ── Reading tokens.json ─────────────────────────────────────────────────────

export function declarationsByName(spec) {
  return new Map(spec.declarations.map((d) => [d.name, d]));
}

/**
 * A declaration's entries in authoring order. JS hoists integer-like keys to the
 * front of an object, so `ink` (DEFAULT, 2, 3, 4) states its order explicitly and
 * everything else takes JSON insertion order.
 */
export function entriesOf(decl) {
  const entries = decl.entries ?? {};
  const order = decl.order ?? Object.keys(entries);
  return order.map((k) => {
    if (!(k in entries)) throw new Error(`tokens.json: '${decl.name}.order' names a missing entry '${k}'`);
    return [k, entries[k]];
  });
}

/**
 * Resolve a dotted path (`ink.2`, `categorical.c-1.main`, `typeRoles.title.size`,
 * `minTextSize`) to its value plus the CSS metadata authored beside it.
 */
export function resolve(spec, path) {
  const [name, ...rest] = path.split('.');
  const decl = declarationsByName(spec).get(name);
  if (!decl) throw new Error(`tokens.json: no declaration '${name}' (path '${path}')`);

  let value = decl.entries ?? decl.value;
  let css = decl.css;
  let node = decl.entries ? undefined : decl;

  for (const seg of rest) {
    if (node?.entries || (node === undefined && decl.entries)) {
      const entry = (node?.entries ?? decl.entries)[seg];
      if (!entry) throw new Error(`tokens.json: no entry '${seg}' in '${name}'`);
      node = entry;
      value = entry.value;
      css = entry.css;
      continue;
    }
    // Inside a value object: a tone step, or a type-role field.
    if (value == null || typeof value !== 'object') {
      throw new Error(`tokens.json: cannot walk '${seg}' in '${path}'`);
    }
    const next = value[seg];
    if (next === undefined) throw new Error(`tokens.json: no key '${seg}' in '${path}'`);
    css = css?.[seg] ?? undefined;
    value = next && typeof next === 'object' && 'ref' in next ? resolve(spec, next.ref).value : next;
    node = undefined;
  }

  if (value !== null && typeof value === 'object' && 'ref' in value) {
    value = resolve(spec, value.ref).value;
  }
  return { value, css, decl };
}

/** Every leaf value in the file, as `path → value`, for the drift scanners. */
export function flattenValues(spec) {
  const out = new Map();
  const walk = (path, value) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(`${path}[${i}]`, v));
      return;
    }
    if (typeof value === 'object') {
      if ('ref' in value) return; // a reference, not an authored value
      for (const [k, v] of Object.entries(value)) walk(`${path}.${k}`, v);
      return;
    }
    out.set(path, value);
  };
  for (const decl of spec.declarations) {
    if (decl.entries) for (const [k, e] of entriesOf(decl)) walk(`${decl.name}.${k}`, e.value);
    else if (decl.value !== undefined) walk(decl.name, decl.value);
  }
  return out;
}

// ── src/tokens.ts ───────────────────────────────────────────────────────────

function tsHeader(spec) {
  return [
    '/**',
    ' * GENERATED FILE — do not edit.',
    ' *',
    ` *   source:    packages/gl-charts/${spec.meta.source}`,
    ` *   generator: packages/gl-charts/${spec.meta.generator}`,
    ' *   verify:    node scripts/check-tokens.mjs   (fails if this file was hand-edited)',
    ' *',
    ' * Values AND doc comments are authored in `tokens.json`; edit them there and',
    ' * re-run the generator. `series(index)` lives in `src/tone.ts`, not here — it is',
    ' * logic, not a value.',
    ' *',
    ...asLines(spec.meta.tsHeader).map((l) => (l ? ` * ${l}` : ' *')),
    ' */',
    '',
  ];
}

function tsDeclaration(spec, decl) {
  const out = [...tsSection(decl.section), ...jsdoc(decl.doc)];
  const type = decl.ts?.type ? `: ${decl.ts.type}` : '';
  const tail = decl.ts?.satisfies
    ? ` as const satisfies ${decl.ts.satisfies};`
    : decl.kind === 'scalar' || decl.kind === 'derived'
      ? ';'
      : ' as const;';

  switch (decl.kind) {
    case 'map':
      out.push(`export const ${decl.name}${type} = {`);
      for (const [k, e] of entriesOf(decl)) {
        out.push(...jsdoc(e.doc, '  '), `  ${key(k)}: ${tsValue(e.value)},`);
      }
      out.push(`}${tail}`);
      break;

    case 'tones':
      out.push(`export const ${decl.name}${type} = {`);
      for (const [k, e] of entriesOf(decl)) {
        const tones = Object.entries(e.value)
          .map(([step, hex]) => `${key(step)}: ${tsValue(hex)}`)
          .join(', ');
        out.push(...jsdoc(e.doc, '  '), `  ${key(k)}: { ${tones} },`);
      }
      out.push(`}${tail}`);
      break;

    case 'tone':
      out.push(`export const ${decl.name}${type} = {`);
      for (const [step, hex] of Object.entries(decl.value)) {
        out.push(`  ${key(step)}: ${tsValue(hex)},`);
      }
      out.push(`}${tail}`);
      break;

    case 'list':
      out.push(`export const ${decl.name}${type} = [`);
      for (const v of decl.value) out.push(`  ${tsValue(v)},`);
      out.push(`]${tail}`);
      break;

    case 'ramps':
      out.push(`export const ${decl.name}${type} = {`);
      for (const [k, e] of entriesOf(decl)) {
        const steps = e.value.map(tsValue).join(', ');
        out.push(...jsdoc(e.doc, '  '), `  ${key(k)}: [${steps}],`);
      }
      out.push(`}${tail}`);
      break;

    case 'scalar':
      out.push(`export const ${decl.name}${type} = ${tsValue(decl.value)};`);
      break;

    case 'derived':
      out.push(`export const ${decl.name}${type} = ${decl.ts.expr};`);
      break;

    case 'roles':
      out.push(`export const ${decl.name}${type} = {`);
      for (const [k, e] of entriesOf(decl)) {
        out.push(...jsdoc(e.doc, '  '), `  ${key(k)}: {`);
        for (const [field, v] of Object.entries(e.value)) {
          const isRef = v !== null && typeof v === 'object';
          const rendered = isRef ? tsAccessor(v.ref) : tsValue(v);
          const comment = isRef && v.comment ? ` // ${v.comment}` : '';
          out.push(`    ${key(field)}: ${rendered},${comment}`);
        }
        out.push('  },');
      }
      out.push(`}${tail}`);
      break;

    case 'interface':
      out.push(`export interface ${decl.name} {`);
      for (const [field, f] of Object.entries(decl.fields)) {
        out.push(...jsdoc(f.doc, '  '), `  ${field}${f.optional ? '?' : ''}: ${f.type};`);
      }
      out.push('}');
      break;

    case 'type': {
      const rhs = decl.expr
        ? decl.expr
        : entriesOf(declarationsByName(spec).get(decl.unionOfKeys))
            .map(([k]) => str(k))
            .join(' | ');
      out.push(`export type ${decl.name} = ${rhs};`);
      break;
    }

    case 'aggregate':
      out.push(`export const ${decl.name} = {`);
      for (const m of decl.members) out.push(`  ${m},`);
      out.push('} as const;');
      if (decl.default) out.push('', `export default ${decl.name};`);
      break;

    default:
      throw new Error(`tokens.json: unknown declaration kind '${decl.kind}'`);
  }
  return out;
}

export function emitTs(spec) {
  const lines = tsHeader(spec);
  for (const decl of spec.declarations) lines.push(...tsDeclaration(spec, decl), '');
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

// ── src/tokens.css ──────────────────────────────────────────────────────────

const cssValue = (value, unit) =>
  typeof value === 'string'
    ? /^#[0-9a-f]{3,8}$/i.test(value)
      ? value.toLowerCase()
      : value
    : `${value}${unit ?? ''}`;

function cssHeader(spec) {
  return [
    '/**',
    ' * GENERATED FILE — do not edit.',
    ' *',
    ` *   source:    packages/gl-charts/${spec.meta.source}`,
    ` *   generator: packages/gl-charts/${spec.meta.generator}`,
    ' *   verify:    node scripts/check-tokens.mjs   (fails if this file was hand-edited)',
    ' *',
    ' * Custom properties only. Figure chrome, TanStack patches and the reference',
    " * vocabulary live in the hand-written sheets that @import this one.",
    ' *',
    ...asLines(spec.meta.cssHeader).map((l) => (l ? ` * ${l}` : ' *')),
    ' */',
    '',
  ];
}

function cssComment(text, indent = '  ') {
  const lines = asLines(text);
  if (lines.length === 1) return [`${indent}/* ${lines[0]} */`];
  return lines.map((l, i) =>
    i === 0 ? `${indent}/* ${l}` : `${indent}   ${l}${i === lines.length - 1 ? ' */' : ''}`,
  );
}

function cssSectionRule(title) {
  const head = `  /* ── ${title} `;
  const pad = Math.max(1, CSS_RULE_WIDTH - [...head].length - 3);
  return `${head}${'─'.repeat(pad)} */`;
}

/** One `--prop: value;` for a row that points at an authored token. */
function cssDecl(spec, row) {
  const path = typeof row === 'string' ? row : row.ref;
  const { value, css } = resolve(spec, path);
  const prop = (typeof row === 'string' ? undefined : row.prop) ?? css?.name;
  if (!prop) throw new Error(`tokens.json: css row '${path}' has no custom-property name`);
  const unit = (typeof row === 'string' ? undefined : row.unit) ?? css?.unit;
  return `${prop}: ${cssValue(value, unit)};`;
}

export function emitCss(spec) {
  const lines = cssHeader(spec);
  lines.push(`${spec.css.selector} {`);

  spec.css.sections.forEach((section, i) => {
    if (i) lines.push('');
    lines.push(cssSectionRule(section.comment));
    for (const row of section.rows) {
      if (typeof row === 'string') {
        lines.push(`  ${cssDecl(spec, row)}`);
      } else if (row.blank) {
        lines.push('');
      } else if (row.comment) {
        lines.push(...cssComment(row.comment));
      } else if (row.pack) {
        lines.push(`  ${row.pack.map((p) => cssDecl(spec, p)).join('  ')}`);
      } else if (row.alias) {
        const { css } = resolve(spec, row.alias);
        const aliases = css?.aliases ?? [];
        if (!aliases.includes(row.prop)) {
          throw new Error(
            `tokens.json: '${row.prop}' is not listed in ${row.alias}'s css.aliases — ` +
              'add it there so the alias is discoverable from the token it mirrors',
          );
        }
        lines.push(`  ${row.prop}: var(${css.name});`);
      } else {
        lines.push(`  ${cssDecl(spec, row)}`);
      }
    }
  });

  lines.push('}', '');
  return lines.join('\n');
}

// ── Fonts ───────────────────────────────────────────────────────────────────

/** Repo root — `assets/fonts/` sits above the package, beside `grammar.md`. */
const REPO_ROOT = join(PKG, '..', '..');

/**
 * Absolute path to a face's woff2, and the assertion that it is there.
 *
 * Throws rather than degrading: a missing file would otherwise emit a sheet that
 * declares nothing, which is indistinguishable at render time from the bug this
 * whole file exists to prevent.
 */
export function fontFile(spec, face) {
  const path = join(REPO_ROOT, spec.fonts.root, face.file);
  if (!existsSync(path)) {
    throw new Error(
      `Font missing: ${path}\n` +
        `  tokens.json lists it as '${face.family}' (${face.style}). Without it the ` +
        'theme declares a family nothing can load, and every figure falls through ' +
        'to the system font.',
    );
  }
  return path;
}

/**
 * One `@font-face` per entry in `tokens.json`'s `fonts.faces`, woff2 inlined.
 *
 * Shared with the three generated pages and the published stylesheet so none of
 * them can declare a different face — or, worse, a different `family` name — from
 * the others.
 *
 * `include` narrows the list for a page that genuinely cannot use one: the
 * comparison page is chrome around screenshots and sets no italic, and a face
 * that is declared but never selected stays `unloaded` forever, which is the
 * signature `gallery/audit.mjs` reads as a name mismatch. Declaring only what the
 * page can select keeps "declared implies used" true, so that check keeps meaning
 * what it says. Narrow it only when the page provably has no such text.
 */
export function fontFaces(spec = loadTokens(), include = () => true) {
  return spec.fonts.faces
    .filter(include)
    .map((face) => {
      const b64 = readFileSync(fontFile(spec, face)).toString('base64');
      return [
        ...(face.doc ? [`/* ${face.doc} */`] : []),
        '@font-face {',
        `  font-family: '${face.family}';`,
        `  font-style: ${face.style};`,
        `  font-weight: ${spec.fonts.weightRange};`,
        '  font-display: block;',
        `  src: url(data:font/woff2;base64,${b64}) format('woff2-variations');`,
        '}',
      ].join('\n');
    })
    .join('\n\n');
}

export function emitFontsCss(spec) {
  return [
    '/**',
    ' * GENERATED FILE — do not edit.',
    ' *',
    ` *   source:    packages/gl-charts/${spec.meta.source}`,
    ` *   generator: packages/gl-charts/${spec.meta.generator}`,
    ' *   verify:    node scripts/check-tokens.mjs   (fails if this file was hand-edited)',
    ' *',
    ...asLines(spec.fonts.cssHeader).map((l) => (l ? ` * ${l}` : ' *')),
    ' */',
    '',
    fontFaces(spec),
    '',
  ].join('\n');
}

// ── Emit ────────────────────────────────────────────────────────────────────

/** Every output, keyed by its path relative to the package root. */
export function emit(spec = loadTokens()) {
  return {
    [spec.meta.outputs.ts]: emitTs(spec),
    [spec.meta.outputs.css]: emitCss(spec),
    [spec.meta.outputs.fontsCss]: emitFontsCss(spec),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = emit();
  for (const [rel, contents] of Object.entries(files)) {
    writeFileSync(join(PKG, rel), contents);
    console.log(`  wrote ${rel}  (${contents.split('\n').length} lines)`);
  }
  console.log('\nRun `node scripts/check-tokens.mjs` to verify, ' + 'and `--downstream` for drift.');
}
