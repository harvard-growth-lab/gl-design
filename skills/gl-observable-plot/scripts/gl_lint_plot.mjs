#!/usr/bin/env node
//
// gl_lint_plot.mjs — conformance lint for Growth Lab Observable Plot charts.
//
// Two modes, because Plot renders to SVG we can inspect the OUTPUT, not just the
// source — a strictly stronger conformance signal than the ggplot linter can get:
//
//   SOURCE mode (default):  gl_lint_plot.mjs chart.ts [more...]
//     Regex heuristics over the JS/TS source — catches the mechanically visible
//     violations (non-token hex, named colors, accent-as-fill, sub-12px text,
//     raw Plot.plot instead of glPlot, a color channel with no GL scale).
//
//   RENDER mode:  gl_lint_plot.mjs --svg chart.svg [more...]   (or: --svg - for stdin)
//     Inspects a RENDERED SVG (Node SSR via jsdom, or a browser export). Walks
//     every element and asserts each fill/stroke is a GL token, text is >= 12px in
//     Inter/Source Serif, labels use dark tones, and the background is paper. A
//     computed or interpolated color that a regex would miss cannot hide here.
//
// Output: one line per finding — <src>:<line>: [check-id] message  (source mode)
//                                <svg> [check-id] message           (render mode)
// Exit 1 if anything flagged, 0 if clean. Dependency-free (no npm install).
//
// checkSource(text) and checkSvg(text) are exported so the eval harness can call
// them directly. A clean lint is necessary, not sufficient — pair with the
// judgment checklist in ../SKILL.md.

import { readFileSync } from "node:fs";

// ---- GL token sets (grammar.md — mirror of gl-plot.ts) ----------------------

const MAIN = ["#2F87C8", "#CC4948", "#2AA584", "#7554A3", "#EA822D", "#CDC86B"];
const DARK = ["#1A5A8E", "#8A2C2B", "#1A6B53", "#4A3470", "#A8580F", "#8A8638"];
const LIGHT = ["#B5D5EA", "#E89C9C", "#92D6BF", "#B5A0CC", "#F4BC8A", "#E6E2A8"];
const INK = ["#1A1714", "#2C2823", "#4F4A42", "#9A9389"];
const CHROME = ["#FFFFFF", "#F4F1EA", "#F3F2EA", "#ECEBE0", "#DDDDDD", "#D8D4CC"];
const ACCENT = ["#1A5A8E", "#003E6B", "#3A85B8", "#E1F0FA"];
const MUTED = ["#CDD2D9", "#AFB5BE", "#5F6773"];
const RAMP = [ // sequential + diverging intermediate steps
  "#E5F0F9", "#6FA5CE", "#F4D5D5", "#DC6F6E", "#D5EFE7", "#5BC0A0",
  "#E5DDF0", "#9276BA", "#FBE5D5", "#EE9A52", "#FBF8DC", "#DCD68E",
  "#EFC7C0", "#C5DCEC", "#BDE5D8",
];
const SECTORS = [ // Atlas HS / SITC / product-space externals (name→hex values)
  "#B23C6F", "#7BC8A4", "#E5C21A", "#CAA46B", "#A88B7D", "#C9656B", "#B07AC9",
  "#7A6CC3", "#6E8FC3", "#74C5C6", "#2F5D74", "#E76F8F", "#CF6F6F", "#B39183",
  "#F39C12", "#D73027", "#1F9D9A", "#355F73", "#E0B614", "#C77C2B", "#5CC7C6",
  "#9C3BD6", "#C43D3D", "#7A6A63", "#8A8A8A", "#2FA84F",
];
const GL_HEX = new Set(
  [...MAIN, ...DARK, ...LIGHT, ...INK, ...CHROME, ...ACCENT, ...MUTED, ...RAMP, ...SECTORS].map((h) => h.toUpperCase())
);

// Ordered GL ramps (grammar.md §1). A continuous sequential/diverging scale
// INTERPOLATES between adjacent stops, so Plot emits per-cell/per-dot colors
// that lie ON the segment between two stops without being tokens themselves.
// onGlRamp() accepts those (RGB-collinear + between adjacent stops) so a heatmap
// or a diverging scatter — the two commonest GL continuous charts — can lint
// clean instead of flooding svg-color with legitimate ramp colors.
const RAMPS = [
  ["#E5F0F9", "#B5D5EA", "#6FA5CE", "#2F87C8", "#1A5A8E"],            // sequential_1
  ["#F4D5D5", "#E89C9C", "#DC6F6E", "#CC4948", "#8A2C2B"],            // sequential_2
  ["#D5EFE7", "#92D6BF", "#5BC0A0", "#2AA584", "#1A6B53"],            // sequential_3
  ["#E5DDF0", "#B5A0CC", "#9276BA", "#7554A3", "#4A3470"],            // sequential_4
  ["#FBE5D5", "#F4BC8A", "#EE9A52", "#EA822D", "#A8580F"],            // sequential_5
  ["#FBF8DC", "#E6E2A8", "#DCD68E", "#CDC86B", "#8A8638"],            // sequential_6
  ["#8A2C2B", "#DC6F6E", "#EFC7C0", "#C5DCEC", "#6FA5CE", "#1A5A8E"], // diverging_2_1
  ["#1A6B53", "#5BC0A0", "#BDE5D8", "#C5DCEC", "#6FA5CE", "#1A5A8E"], // diverging_3_1
  ["#A8580F", "#EE9A52", "#F4BC8A", "#C5DCEC", "#6FA5CE", "#1A5A8E"], // diverging_5_1
  ["#8A8638", "#DCD68E", "#E6E2A8", "#C5DCEC", "#6FA5CE", "#1A5A8E"], // diverging_6_1
];
const toRgb = (h) => { const s = h.replace("#", ""); return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)); };
const RAMP_SEGMENTS = RAMPS.flatMap((r) => r.slice(1).map((_, i) => [toRgb(r[i]), toRgb(r[i + 1])]));
function onGlRamp(hex, tol = 4) {
  if (typeof hex !== "string" || !/^#[0-9A-F]{6}$/i.test(hex)) return false;
  const p = toRgb(hex);
  for (const [a, b] of RAMP_SEGMENTS) {
    let axis = 0, span = 0;
    for (let c = 0; c < 3; c++) { const d = Math.abs(b[c] - a[c]); if (d > span) { span = d; axis = c; } }
    if (span === 0) { if (p.every((v, c) => Math.abs(v - a[c]) <= tol)) return true; continue; }
    const t = (p[axis] - a[axis]) / (b[axis] - a[axis]);       // param from the widest channel
    if (t < -0.02 || t > 1.02) continue;
    if (p.every((v, c) => Math.abs(a[c] + t * (b[c] - a[c]) - v) <= tol)) return true; // verify all 3
  }
  return false;
}

const MAIN_SET = new Set(MAIN.map((h) => h.toUpperCase()));
const LIGHT_SET = new Set(LIGHT.map((h) => h.toUpperCase()));
// Non-color keywords that are legal anywhere a color is expected.
const COLOR_OK = new Set(["NONE", "CURRENTCOLOR", "TRANSPARENT", "INHERIT", "INITIAL"]);

// ---- color normalization (attrs are hex; jsdom serializes some to rgb()) ----

// The few CSS named colors that ARE GL tokens (so "white" === paper #FFFFFF).
const NAMED_HEX = { WHITE: "#FFFFFF" };

// Decode the quote/amp entities a serializer puts INSIDE an attribute value.
// Apply AFTER extracting the attribute (its real "…" delimiters are still
// encoded as &quot; at that point, so [^"]* captures the whole value first).
const decode = (s) => s.replace(/&quot;|&#34;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&");

function normColor(v) {
  if (!v) return null;
  const s = v.trim();
  if (s.startsWith("url(") || COLOR_OK.has(s.toUpperCase())) return s.toUpperCase();
  if (NAMED_HEX[s.toUpperCase()]) return NAMED_HEX[s.toUpperCase()];
  const rgb = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (rgb) {
    const hex = rgb.slice(1, 4).map((n) => Math.round(+n).toString(16).padStart(2, "0")).join("");
    return ("#" + hex).toUpperCase();
  }
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(s)) return ("#" + s.slice(1).split("").map((c) => c + c).join("")).toUpperCase();
  return s.toUpperCase(); // other named CSS color — will fail the token test
}

// Parse the ROOT <svg ...> opening tag: its inline style (which WINS over
// presentation attributes in the cascade) and its attributes. This is why the
// checker must read style-first — Plot sets font-family="system-ui"/font-size="10"
// as attributes but glStyle overrides them with an inline style.
function rootProps(svg) {
  // A legend'd plot is a <figure> whose categorical swatches are tiny inline
  // <svg> squares that precede the chart <svg>. Pick the chart root: prefer the
  // <svg class="gl-plot">, else the first <svg> carrying an inline style, else
  // the first <svg>.
  const opens = svg.match(/<svg\b[^>]*>/gi) || [""];
  const open =
    opens.find((t) => /class\s*=\s*"[^"]*\bgl-plot\b[^"]*"/i.test(t)) ||
    opens.find((t) => /\bstyle\s*=\s*"/i.test(t)) ||
    opens[0];
  const styleAttr = decode((open.match(/style\s*=\s*"([^"]*)"/i) || [])[1] || "");
  const style = {};
  for (const d of styleAttr.split(";")) {
    const kv = d.split(":"); if (kv.length < 2) continue;
    style[kv[0].trim().toLowerCase()] = kv.slice(1).join(":").trim();
  }
  const attr = (n) => (open.match(new RegExp(`\\b${n}\\s*=\\s*"([^"]*)"`, "i")) || [])[1];
  return {
    fontFamily: style["font-family"] ?? attr("font-family") ?? "",
    fontSize: style["font-size"] ?? attr("font-size"),
    background: style["background"] ?? style["--plot-background"],
  };
}

const isGlColor = (c) => c == null || COLOR_OK.has(c) || c.startsWith("URL(") || GL_HEX.has(c);

// ============================================================================
// SOURCE MODE — regex heuristics over JS/TS
// ============================================================================

const NAMED = "red|blue|green|black|white|gr[ae]y|lightgr[ae]y|darkgr[ae]y|orange|purple|teal|yellow";

export function checkSource(text, file = "<source>") {
  const findings = [];
  const add = (line, id, msg) => findings.push({ file, line, id, msg });
  const raw = text.split(/\r?\n/);
  const usesPlot = /\bPlot\.plot\s*\(/.test(text);
  const usesGlPlot = /\bglPlot\s*\(/.test(text);
  const importsTheme = /from\s+['"][^'"]*gl-plot(\.[tj]s)?['"]/.test(text);

  raw.forEach((full, i) => {
    const ln = full.replace(/\/\/(?![0-9a-fA-F]{6}).*$/, ""); // strip // comments, keep #hex
    if (!ln.trim()) return;
    const at = i + 1;

    // 1. non-token hex literals
    for (const m of ln.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      if (!GL_HEX.has(m[0].toUpperCase()))
        add(at, "hex", `${m[0]} is not a GL token — use GL.* tokens or a named palette`);
    }
    // 2. named CSS colors in a fill/stroke
    const nm = ln.match(new RegExp(`(fill|stroke)\\s*:\\s*['"](${NAMED})['"]`, "i"));
    if (nm) add(at, "literal", `named color in \`${nm[0]}\` — use GL tokens (GL.paper, GL.c_muted, highlight, lead_finding)`);
    // 3. accent as a data-mark fill/stroke
    if (/\b(fill|stroke)\s*:\s*(GL\.accent|accent)\b/.test(ln))
      add(at, "accent", "accent is non-data chrome only — data marks use highlight (c_1) or lead_finding (c_2)");
    // 4. dark tone as a FILL (dark is stroke/text only, save the three-tone area)
    if (/\bfill\s*:\s*(GL\.c_[1-6]_dark|highlight_dark|lead_finding_dark)\b/.test(ln))
      add(at, "dark-fill", "dark tones are for strokes and text, not fills (exception: three-tone stacked area)");
    // 5. sub-12px text
    const fs = ln.match(/fontSize\s*:\s*['"]?([0-9]+(?:\.[0-9]+)?)(px)?['"]?/);
    if (fs && +fs[1] < 12) add(at, "text-size", `fontSize ${fs[1]} is below the 12px floor — GL chart text is 12px`);
    // 6. monospace
    if (/monospace|JetBrains|Courier|['"]mono['"]/.test(ln)) add(at, "mono", "no monospace in charts (decision rule 2)");
    // 7. a hand-dashed zero baseline via ruleY([0])
    if (/rule[XY]\s*\(\s*\[\s*0\s*\]/.test(ln) && /strokeDasharray/.test(ln))
      add(at, "zero-line", "a zero baseline is solid ink_2 — use glZeroLine(), never a dashed rule (grammar §3.5)");
  });

  // file-level
  if (usesPlot && !usesGlPlot)
    add(1, "raw-plot", "Plot.plot() called directly — render through glPlot() so the GL style/gridlines apply");
  if ((usesGlPlot || usesPlot) && !importsTheme)
    add(1, "setup", "no import from gl-plot — the chart will not carry GL tokens/helpers");
  // a color channel mapped to a field but no GL color scale anywhere
  const mapsColor = /\b(fill|stroke)\s*:\s*['"][A-Za-z_]/.test(text); // fill:"field"
  const hasGlScale = /\bglColor(Sequential|Diverging)?\s*\(|color\s*:/.test(text);
  if (mapsColor && !hasGlScale)
    add(1, "color-scale", "a color channel maps to a field but no GL color scale is set — add color: glColor()/glColorSequential()/glColorDiverging()");

  return findings;
}

// ============================================================================
// RENDER MODE — inspect a rendered SVG string (dependency-free XML scan)
// ============================================================================

export function checkSvg(svg, file = "<svg>") {
  const findings = [];
  const add = (id, msg) => findings.push({ file, id, msg });
  // Serialized SVG HTML-encodes quotes inside the style attribute as &quot; —
  // whose trailing ';' would break declaration splitting. Decode quote/amp
  // entities first (not &lt;/&gt;, which could forge tags).
  // Collect every color that appears as an attribute OR in an inline style.
  const seen = new Map(); // color -> sample context
  const attrRe = /\b(fill|stroke)\s*=\s*"([^"]*)"/g;
  for (const m of svg.matchAll(attrRe)) { const c = normColor(m[2]); if (c) seen.set(m[1] + ":" + c, c); }
  const styleRe = /style\s*=\s*"([^"]*)"/g;
  for (const m of svg.matchAll(styleRe)) {
    for (const d of decode(m[1]).split(";")) {
      const kv = d.split(":"); if (kv.length < 2) continue;
      const k = kv[0].trim().toLowerCase();
      if (k === "fill" || k === "stroke" || k === "background" || k === "--plot-background") {
        const c = normColor(kv.slice(1).join(":")); if (c) seen.set(k + ":" + c, c);
      }
    }
  }
  // 1. every color must be a GL token
  for (const [ctx, c] of seen) {
    if (!isGlColor(c) && !onGlRamp(c))
      add("svg-color", `non-token color ${c} (${ctx.split(":")[0]}) — every fill/stroke must be a GL token or a GL ramp color`);
  }

  // 2. typography — read the ROOT inline style (cascade winner), not attributes
  const root = rootProps(svg);
  if (!/inter|source serif/i.test(root.fontFamily))
    add("svg-font", `root font-family "${root.fontFamily.trim()}" is not Inter / Source Serif — load gl-fonts.css and render through glPlot`);
  const rootFs = parseFloat(root.fontSize);
  if (!Number.isNaN(rootFs) && rootFs < 12)
    add("svg-fontsize", `root font-size ${root.fontSize} below the 12px floor`);
  // per-element text/tspan that sets its OWN sub-12px size (the root default is
  // already covered above; a real label shrunk below the floor is the concern)
  for (const m of svg.matchAll(/<(?:text|tspan)\b[^>]*font-size\s*[:=]\s*["']?([0-9]+(?:\.[0-9]+)?)/gi)) {
    if (+m[1] < 12) { add("svg-fontsize", `a text element sets font-size ${m[1]}, below the 12px floor`); break; }
  }
  if (!/tabular-nums|["']tnum["']/.test(svg))
    add("svg-tabular", "no tabular-nums in the output — numerals should be tabular (grammar §3.7)");

  // 3. background is paper (root inline style wins over Plot's --plot-background)
  if (root.background && !isGlColor(normColor(root.background)))
    add("svg-bg", `background ${root.background.trim()} is not a GL paper token`);

  // 4. dark-tone rule — a <text> fill must not be a MAIN or LIGHT categorical tone
  for (const m of svg.matchAll(/<(?:text|tspan)\b[^>]*\bfill\s*=\s*"([^"]*)"/g)) {
    const c = normColor(m[1]);
    if (c && (MAIN_SET.has(c) || LIGHT_SET.has(c)))
      add("svg-darktone", `label fill ${c} is a main/light tone — text tied to a series must use its DARK tone (grammar §3.3)`);
  }
  // also check text fill carried on an ancestor <g aria-label>
  for (const m of svg.matchAll(/<g\b[^>]*aria-label="(?:text|tip)"[^>]*\bfill\s*=\s*"([^"]*)"/g)) {
    const c = normColor(m[1]);
    if (c && (MAIN_SET.has(c) || LIGHT_SET.has(c)))
      add("svg-darktone", `text group fill ${c} is a main/light tone — series labels use the dark tone (grammar §3.3)`);
  }

  return findings;
}

// ============================================================================
// CLI
// ============================================================================

function main(argv) {
  const args = argv.slice(2);
  const svgMode = args[0] === "--svg";
  const files = svgMode ? args.slice(1) : args;
  if (!files.length) {
    console.error("usage: gl_lint_plot.mjs chart.ts [...]        # source lint");
    console.error("       gl_lint_plot.mjs --svg chart.svg [...]  # rendered-SVG lint (- for stdin)");
    process.exit(2);
  }
  let total = 0;
  for (const f of files) {
    let text;
    try { text = f === "-" ? readFileSync(0, "utf8") : readFileSync(f, "utf8"); }
    catch { console.error(`${f}: no such file`); total++; continue; }
    const findings = svgMode ? checkSvg(text, f) : checkSource(text, f);
    for (const x of findings) {
      total++;
      if (svgMode) console.log(`${x.file} [${x.id}] ${x.msg}`);
      else console.log(`${x.file}:${x.line}: [${x.id}] ${x.msg}`);
    }
  }
  if (total) { console.log(`\n${total} flag(s). See skills/gl-observable-plot/SKILL.md for the rules.`); process.exit(1); }
  console.log("clean");
}

// Run as CLI only when invoked directly (not when imported by the eval harness).
if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
