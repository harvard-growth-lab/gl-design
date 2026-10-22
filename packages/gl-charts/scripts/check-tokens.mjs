/**
 * check-tokens.mjs — is every copy of a design value still the same value?
 *
 *   node scripts/check-tokens.mjs               strict.  exits 1 on failure
 *   node scripts/check-tokens.mjs --reconcile   report.  prose values, side by side
 *   node scripts/check-tokens.mjs --downstream  report.  drift outside this package
 *
 * STRICT (the gate; exits 1)
 *   1. `src/tokens.ts` and `src/tokens.css` on disk === what `emit-tokens.mjs`
 *      produces from `tokens.json`. This is what stops a hand-edit of a
 *      generated file: the edit reappears here as a diff.
 *   2. `tokens.json` === `grammar.md`, which is the repo's source of truth
 *      (CLAUDE.md: "design values flow downward, never back up"). Verified by
 *      re-parsing grammar.md's own pipe tables:
 *        · colour   — ink, accent, paper & chrome, categorical, muted,
 *                     sequential, diverging  (§1)
 *        · type     — family, weight and colour token per chart text role  (§2)
 *      A disagreement is a bug in `tokens.json`, never in `grammar.md`.
 *   3. Internal invariants that the spec states in prose: `accent` === `c-1-dark`
 *      (§1 "intentionally the same hex"), and no in-chart type size below
 *      `minTextSize` (§3.4.1 "never shrinks below the 12px floor").
 *
 * REPORT-ONLY (never fails)
 *   `--reconcile`  Geometry, opacity and the ramp defaults are prose in
 *                  `grammar.md` §3.4–3.6 ("**Tick mark**: 1px, 4px long,
 *                  **outward**"), not table cells, so they cannot be parsed into
 *                  a comparable value. Each token is printed beside the spec line
 *                  it comes from, for a human to read. Type SIZES are not checked
 *                  at all: grammar.md leaves absolute sizes to the recipes.
 *   `--downstream` The same values are hand-carried into an R theme, three CSS
 *                  sheets, a docx builder, a xelatex preamble and a handful of
 *                  undocumented files. Reports hexes those files carry that are
 *                  not in `tokens.json` (drift) and tokens missing from a file
 *                  the propagation table says should carry them. Report-only by
 *                  design: the set is not clean yet, and a build must not fail on
 *                  a skill's stale hex.
 *
 * Plain ESM, no dependencies, `node:` builtins only — same as gallery/*.mjs.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PKG, declarationsByName, emit, entriesOf, flattenValues, loadTokens } from './emit-tokens.mjs';

const REPO = join(PKG, '..', '..');
const spec = loadTokens();
const failures = [];
const fail = (msg) => failures.push(msg);

/** grammar.md's own names for the ink / accent tokens, as used in its type tables. */
const COLOR_TOKEN_PATH = {
  ink: 'ink.DEFAULT',
  'ink-2': 'ink.2',
  'ink-3': 'ink.3',
  'ink-4': 'ink.4',
  accent: 'accent.DEFAULT',
  paper: 'surface.paper',
};

// ── 1. Generated files match the emitter ────────────────────────────────────

/** Line-level LCS, so the printed diff shows the edit and not the whole file. */
function diffLines(a, b) {
  const n = a.length;
  const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push(['=', a[i], i + 1]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push(['-', a[i], i + 1]);
      i++;
    } else {
      out.push(['+', b[j], j + 1]);
      j++;
    }
  }
  for (; i < n; i++) out.push(['-', a[i], i + 1]);
  for (; j < m; j++) out.push(['+', b[j], j + 1]);
  return out;
}

function checkGenerated() {
  for (const [rel, expected] of Object.entries(emit(spec))) {
    const path = join(PKG, rel);
    if (!existsSync(path)) {
      fail(`${rel} does not exist — run \`node scripts/emit-tokens.mjs\``);
      continue;
    }
    const actual = readFileSync(path, 'utf8');
    if (actual === expected) {
      console.log(`  ✓ ${rel} matches tokens.json`);
      continue;
    }
    fail(`${rel} differs from what tokens.json emits`);
    const changes = diffLines(actual.split('\n'), expected.split('\n')).filter((c) => c[0] !== '=');
    console.log(`  ✗ ${rel} — ${changes.length} differing line(s); on disk (-) vs. emitted (+):`);
    for (const [sign, text, line] of changes.slice(0, 24)) {
      console.log(`      ${sign} ${String(line).padStart(4)}  ${text}`);
    }
    if (changes.length > 24) console.log(`      … ${changes.length - 24} more`);
    console.log('      Hand-edited a generated file? Move the change into tokens.json.');
  }
}

// ── 2. tokens.json matches grammar.md ───────────────────────────────────────

const GRAMMAR = join(REPO, 'grammar.md');

/**
 * Every pipe-table row in a markdown file, keyed by its first cell with the
 * backticks stripped: `| \`c-1\` | \`#B5D5EA\` | … |` → `c-1`. First occurrence
 * wins; separator rows (`|---|---|`) are skipped.
 */
function parseTableRows(text) {
  const rows = new Map();
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line.startsWith('|')) return;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 2 || /^:?-{2,}/.test(cells[0])) return;
    const name = cells[0].replace(/`/g, '').trim();
    if (!name || rows.has(name)) return;
    rows.set(name, { cells, line: i + 1, raw: line });
  });
  return rows;
}

const upper = (h) => h.toUpperCase();
const hexesIn = (s) => (s.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map(upper);

/** A token value as an ordered hex list, so scalars, tones and ramps compare alike. */
function hexList(value, order) {
  if (typeof value === 'string') return [upper(value)];
  if (Array.isArray(value)) return value.map(upper);
  const keys = order ?? Object.keys(value);
  return keys.map((k) => upper(value[k]));
}

function checkGrammarColors(rows) {
  let verified = 0;
  const claimed = new Set();

  for (const decl of spec.declarations) {
    const g = decl.grammar;
    if (!g) continue;

    if (g.kind === 'hex') {
      for (const [entryKey, grammarKey] of Object.entries(g.rows)) {
        claimed.add(grammarKey);
        const row = rows.get(grammarKey);
        if (!row) {
          fail(`grammar.md has no table row \`${grammarKey}\` for ${decl.name}.${entryKey}`);
          continue;
        }
        const expected = hexesIn(row.cells.slice(1).join(' | '));
        const value = decl.entries ? decl.entries[entryKey].value : decl.value[entryKey];
        const actual = hexList(value, g.order);
        if (actual.join(' ') !== expected.join(' ')) {
          fail(
            `${decl.name}.${entryKey} = ${actual.join(' · ')} but grammar.md:${row.line} ` +
              `(\`${grammarKey}\`) says ${expected.join(' · ')}`,
          );
        } else verified += actual.length;
      }
    }

    if (g.kind === 'keysOf') {
      const keys = entriesOf(declarationsByName(spec).get(g.of)).map(([k]) => k);
      if (decl.value.join(' ') !== keys.join(' ')) {
        fail(`${decl.name} = [${decl.value}] but ${g.of} declares [${keys}]`);
      }
    }

    if (g.kind === 'contains') {
      for (const [entryKey, needle] of Object.entries(g.rows)) {
        const value = decl.entries[entryKey].value;
        if (!value.includes(needle)) {
          fail(`${decl.name}.${entryKey} does not name the grammar.md family "${needle}"`);
        } else verified++;
      }
    }
  }
  return { verified, claimed };
}

/** grammar.md's chart text-role tables: family, weight and colour token per role. */
function checkGrammarRoles(rows) {
  let verified = 0;
  for (const decl of spec.declarations) {
    if (decl.grammar?.kind !== 'roleTable') continue;
    for (const [entryKey, roleName] of Object.entries(decl.grammar.rows)) {
      const row = rows.get(roleName);
      if (!row) {
        fail(`grammar.md has no role row "${roleName}" for ${decl.name}.${entryKey}`);
        continue;
      }
      const [, familyCell, weightCell, colorCell] = row.cells;
      const role = decl.entries[entryKey].value;
      const at = `${decl.name}.${entryKey} vs grammar.md:${row.line} ("${roleName}")`;

      const wantSerif = familyCell.includes('Source Serif 4');
      const gotSerif = role.family.ref === 'family.serif';
      if (wantSerif !== gotSerif) fail(`${at}: family should be ${wantSerif ? 'serif' : 'sans'}`);
      else verified++;

      const wantItalic = /italic/i.test(familyCell);
      if (wantItalic !== (role.fontStyle === 'italic')) {
        fail(`${at}: ${wantItalic ? 'should be italic' : 'should not be italic'}`);
      } else verified++;

      const weight = Number(weightCell.replace(/\D/g, ''));
      if (Number.isFinite(weight) && weight && weight !== role.weight) {
        fail(`${at}: weight ${role.weight} vs ${weight}`);
      } else verified++;

      const token = colorCell.replace(/`/g, '').trim();
      const wantPath = COLOR_TOKEN_PATH[token];
      if (!wantPath) continue; // "series dark tone" — prose, checked by eye
      if (role.color.ref !== wantPath) {
        fail(`${at}: color ${role.color.ref} vs \`${token}\` (${wantPath})`);
      } else verified++;
    }
  }
  return verified;
}

/** Spec rules that live inside tokens.json rather than between it and grammar.md. */
function checkInvariants() {
  const values = flattenValues(spec);
  if (values.get('accent.DEFAULT') !== values.get('categorical.c-1.dark')) {
    fail(
      'accent.DEFAULT !== categorical.c-1.dark — grammar.md §1 says they are ' +
        'intentionally the same hex (the c-1 dark tone is what labels c-1)',
    );
  }
  const floor = declarationsByName(spec).get('minTextSize').value;
  for (const [key, e] of entriesOf(declarationsByName(spec).get('typeRoles'))) {
    if (e.value.size < floor) {
      fail(`typeRoles.${key}.size = ${e.value.size} is below minTextSize (${floor})`);
    }
  }
}

/** grammar.md colour rows nothing in tokens.json claims — informational. */
function unclaimedGrammarTokens(rows, claimed) {
  const shape = /^(ink|accent|paper|cover-|rule$|gridline$|c-\d|c-muted|sequential-|div-|pattern-)/;
  return [...rows.keys()].filter((k) => shape.test(k) && !claimed.has(k));
}

function checkGrammar() {
  if (!existsSync(GRAMMAR)) {
    console.log('  ! grammar.md not found — skipped the source-of-truth comparison');
    return;
  }
  const rows = parseTableRows(readFileSync(GRAMMAR, 'utf8'));
  const { verified, claimed } = checkGrammarColors(rows);
  const roleFields = checkGrammarRoles(rows);
  checkInvariants();
  console.log(`  ✓ grammar.md — ${verified} colour value(s), ${roleFields} type-role field(s) verified`);
  const unclaimed = unclaimedGrammarTokens(rows, claimed);
  if (unclaimed.length) {
    console.log(`    grammar.md tokens this package does not carry (by design): ${unclaimed.join(', ')}`);
  }
}

// ── --reconcile: the values grammar.md states in prose ──────────────────────

function reconcile() {
  const cache = new Map();
  const readSpecFile = (rel) => {
    if (!cache.has(rel)) {
      const p = join(REPO, rel);
      cache.set(rel, existsSync(p) ? readFileSync(p, 'utf8').split('\n') : null);
    }
    return cache.get(rel);
  };

  console.log('Geometry, opacity and ramp defaults — report only.');
  console.log('grammar.md states these as prose, so they cannot be parsed into a');
  console.log('comparable value. Read each token against the spec line beside it.\n');

  for (const decl of spec.declarations) {
    const items = decl.entries
      ? entriesOf(decl).map(([k, e]) => [`${decl.name}.${k}`, e.value, e.grammar])
      : [[decl.name, decl.value, decl.grammar]];
    for (const [path, value, g] of items) {
      if (g?.kind !== 'prose') continue;
      const file = g.file ?? 'grammar.md';
      const lines = readSpecFile(file);
      const hit = lines?.findIndex((l) => l.includes(g.match)) ?? -1;
      const where = hit >= 0 ? `${file}:${hit + 1}` : `${file} (no line matching "${g.match}")`;
      console.log(`  ${path} = ${JSON.stringify(value)}`);
      console.log(`      ${where}`);
      if (hit >= 0) console.log(`      ${lines[hit].trim()}`);
    }
  }
  console.log('\nType SIZES are deliberately absent: grammar.md §2 leaves absolute sizes');
  console.log('to the recipes, so only the 12px floor (minTextSize) is verifiable here.');
}

// ── --downstream: the hand-carried copies elsewhere in the repo ─────────────

/**
 * Hexes in a file, with line numbers. Two forms, because the downstream media
 * disagree: `#RRGGBB` (CSS, R, prose) and bare `RRGGBB` inside quotes or braces
 * (OOXML in the Python and Lua constants, `\definecolor{…}{HTML}{1A1714}` in the
 * xelatex preamble). Bare hex is only taken when delimited, so English words in
 * prose — "facade", "decade" — cannot masquerade as a colour.
 */
function scanHexes(text) {
  const found = new Map();
  text.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/#([0-9a-fA-F]{6})\b|["'{]([0-9a-fA-F]{6})["'}]/g)) {
      const hex = `#${upper(m[1] ?? m[2])}`;
      if (!found.has(hex)) found.set(hex, { line: i + 1, text: line.trim() });
    }
  });
  return found;
}

/**
 * The Atlas sector palettes and colour scales, straight out of the CSVs that
 * define them. They are an external standard, not GL tokens, so the R theme and
 * the chart linter carry them legitimately and they are not drift.
 */
function externalPaletteHexes() {
  const dir = join(REPO, spec.downstream.ignoreHexes.externalPalettes ?? '');
  if (!existsSync(dir)) return new Set();
  const hexes = new Set();
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.csv')) {
        for (const hex of scanHexes(readFileSync(p, 'utf8')).keys()) hexes.add(hex);
      }
    }
  };
  walk(dir);
  return hexes;
}

function tokenHexIndex() {
  const byHex = new Map();
  for (const [path, value] of flattenValues(spec)) {
    if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) continue;
    const hex = upper(value);
    if (!byHex.has(hex)) byHex.set(hex, []);
    byHex.get(hex).push(path);
  }
  return byHex;
}

function downstream() {
  const byHex = tokenHexIndex();
  const values = flattenValues(spec);
  const external = externalPaletteHexes();
  const ignore = new Set([
    ...(spec.downstream.ignoreHexes?.grammarTokens ?? []).map(upper),
    ...external,
  ]);
  const groupsOf = (names) =>
    names.flatMap((name) => [...values.keys()].filter((p) => p.startsWith(`${name}.`)));

  const report = (file) => {
    const path = join(REPO, file.path);
    if (!existsSync(path)) {
      console.log(`  ? ${file.path} — not found`);
      return;
    }
    const found = scanHexes(readFileSync(path, 'utf8'));
    const unknown = [...found].filter(([hex]) => !byHex.has(hex) && !ignore.has(hex));
    const skipped = [...found.keys()].filter((hex) => ignore.has(hex)).length;
    const missing = (file.expect ? groupsOf(file.expect) : []).filter((p) => {
      const v = values.get(p);
      return typeof v === 'string' && /^#/.test(v) && !found.has(upper(v));
    });

    const flag = unknown.length || missing.length ? '✗' : '✓';
    console.log(`  ${flag} ${file.path}`);
    console.log(`      carries: ${file.carries}`);
    console.log(
      `      ${found.size} hex(es): ${found.size - unknown.length - skipped} in tokens.json, ` +
        `${skipped} external palette, ${unknown.length} unaccounted for`,
    );
    if (unknown.length) {
      console.log('      drift — hex present here but NOT in tokens.json:');
      for (const [hex, { line, text }] of unknown) {
        console.log(`        ${hex}  ${file.path}:${line}`);
        console.log(`          ${text.length > 96 ? `${text.slice(0, 96)}…` : text}`);
      }
    }
    if (missing.length) {
      console.log(`      absent — the propagation table says this file carries ${file.expect.join(', ')}:`);
      const shown = missing.slice(0, 14);
      for (const p of shown) console.log(`        ${p} (${values.get(p)})`);
      if (missing.length > shown.length) console.log(`        … ${missing.length - shown.length} more`);
    }
  };

  console.log('Downstream drift — REPORT ONLY, never fails a build.\n');
  console.log('Documented carriers (README.md "Where each value lives downstream"):\n');
  for (const file of spec.downstream.documented) report(file);
  console.log('\nUndocumented carriers — these hold GL hexes but are missing from that');
  console.log('table. The incomplete propagation map is itself the finding:\n');
  for (const file of spec.downstream.undocumented) report(file);
  console.log('\nOut of scope per README.md: docs/nil/ (upstream), playground/ (derived).');
  console.log(`External palettes read from ${spec.downstream.ignoreHexes.externalPalettes}/*.csv:`);
  console.log(`${external.size} hex(es) excluded as an external standard, not GL tokens.`);
}

// ── Main ────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);

if (argv.includes('--downstream')) {
  downstream();
  process.exitCode = 0;
} else if (argv.includes('--reconcile')) {
  reconcile();
  process.exitCode = 0;
} else {
  console.log('Checking tokens.json → generated files → grammar.md …\n');
  checkGenerated();
  checkGrammar();
  if (failures.length) {
    console.log(`\n${failures.length} failure(s):`);
    for (const f of failures) console.log(`  ✗ ${f}`);
    console.log('\nA value that disagrees with grammar.md is a bug HERE, not there.');
    process.exitCode = 1;
  } else {
    console.log('\nClean. Geometry and opacity are prose in grammar.md — `--reconcile` to');
    console.log('read them side by side; `--downstream` for the hand-carried copies.');
  }
}
