#!/usr/bin/env node
// =============================================================================
// gl_flint_render.mjs — render a GL-themed Flint (Vega-Lite) spec to a
// standalone, GL-serialized SVG, and (optionally) conformance-lint the output.
//
//   node gl_flint_render.mjs chart.mjs out.svg          # render
//   node gl_flint_render.mjs chart.mjs out.svg --lint    # render + lint the SVG
//   node gl_flint_render.mjs spec.json out.svg           # render a raw VL spec JSON
//
// `chart.mjs` must export the GL-themed VL spec as `spec` (named or default) —
// i.e. the `.spec` returned by `glAssembleVegaLite(...)`. A `.json` input is
// treated as an already-themed VL spec object.
//
// The render lint is the STRONG conformance check: it inspects the rendered SVG
// (not the source) and asserts every fill/stroke is a GL token, text is >= 12px
// in Inter / Source Serif, labels use dark tones, numerals are tabular, and the
// background is paper — the values in grammar.md §1–3. It reuses `checkSvg` from
// the shared, backend-agnostic SVG linter so there is one grammar-derived check
// for every renderer in the kit (ggplot PNG, Observable SVG, Flint/VL SVG).
// =============================================================================
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve, extname } from "node:path";
import { glRenderSVG } from "../assets/gl-flint.mjs";
import { checkSvg } from "../../gl-observable-plot/scripts/gl_lint_plot.mjs";

async function loadSpec(file) {
  const p = resolve(file);
  if (extname(p) === ".json") return JSON.parse(readFileSync(p, "utf8"));
  const mod = await import(pathToFileURL(p).href);
  const spec = mod.spec ?? mod.default;
  if (!spec) throw new Error(`${file}: export a GL-themed VL spec as \`spec\` or default`);
  return spec;
}

async function main(argv) {
  const args = argv.slice(2);
  const lint = args.includes("--lint");
  const files = args.filter((a) => !a.startsWith("--"));
  const [input, out] = files;
  if (!input) {
    console.error("usage: gl_flint_render.mjs <chart.mjs|spec.json> [out.svg] [--lint]");
    process.exit(2);
  }
  const spec = await loadSpec(input);
  const svg = await glRenderSVG(spec);
  if (out) { const { writeFileSync } = await import("node:fs"); writeFileSync(out, svg); }
  else process.stdout.write(svg);

  if (lint) {
    const findings = checkSvg(svg, out || input);
    for (const f of findings) console.error(`${f.file} [${f.id}] ${f.msg}`);
    if (findings.length) { console.error(`\n${findings.length} flag(s) — see skills/gl-flint/SKILL.md`); process.exit(1); }
    console.error("lint: clean");
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv);
