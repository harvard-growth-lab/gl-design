# Phase-0 Reconciliation Report — GL Design-System Migration

**Date:** 2026-07-09 · **Canonical:** 116 tokens in `grammar.md` · **Units audited:** 14 (~895 token-agreements)
**Method:** multi-agent workflow (`gl-token-reconciliation`, run `wf_417349c3-c1c`) — 1 canonical
extractor, 14 parallel file-group extractors, per-unit diff, adversarial per-drift verification,
synthesis. Two agents hit the structured-output retry cap; both gaps were closed by hand (see §5).

## Verdict — GREENLIGHT: TRUE

Authoring `tokens.json` from `grammar.md` and generating downstream is **safe now**. Across 14
downstream units we confirmed **12 real, non-benign drifts**, but every one is either a *stale /
incomplete downstream copy* (wrong hex, truncated font stack, missing halo/spacing token) or a
*medium-inherent constraint*. In all 12, `grammar.md` is canonical and correct; none hides
undocumented design intent that would make `tokens.json` wrong. **10 of the 12 repair themselves the
moment downstream is regenerated from tokens**; the other 2 (a ggplot legend-color constraint, one
axis-gap number) are per-chart/skill concerns, not grammar defects. No confirmed drift requires
editing `grammar.md` or a designer ruling to proceed.

Color fidelity is near-perfect: **zero single-digit hex drift anywhere** except three values in one
stale file (`gl_pdf.tex`). Both 2026-06-16 revisions (c-muted `#AFB5BE`, gridline `#D8D4CC`) are
correctly propagated everywhere except that file.

## 1. Confirmed real drifts (all: fix downstream — `grammar.md` wins)

| # | Unit | Token | Downstream | Canonical | Fix |
|---|------|-------|-----------|-----------|-----|
| 1 | `gl_pdf.tex:48` | glaccent | `#015C9C` | `#1A5A8E` | Set to `1A5A8E` (restores accent == c-1-dark) |
| 2 | `gl_pdf.tex:50` | glmuted (c-muted) | `#7E8A99` | `#AFB5BE` | Set to `AFB5BE` (post-2026-06-16 value) |
| 3 | `gl_pdf.tex:53` | glpaper (paper) | `#FAF8F4` | `#FFFFFF` | Set to `FFFFFF` (content pages are pure white) |
| 4 | `gl-flint.mjs:456` | svg sans fallback | `'Inter',system-ui,sans-serif` | full canonical sans stack | Emit verbatim canonical string |
| 5 | `gl-flint.mjs:363,382` | label halo | absent | ~0.1em paper halo | Add `stroke: GL.paper`, `strokeWidth ~2`, round join |
| 6 | `gl-flint.mjs:101` | axis-title gap | unset (~2–4px) | 20px (grammar) | Add `titlePadding`; pin number (see §2) |
| 7 | `md2pdf-style.css:36` | `--font-sans` | drops `system-ui`, adds `BlinkMacSystemFont` | canonical sans stack | Restore verbatim |
| 8 | `md2pdf-style.css:35` | `--font-serif` | `'Source Serif 4', Georgia, serif` | `…Georgia, 'Times New Roman', serif` | Restore `'Times New Roman'` tier |
| 9 | `md2slides/gl.css:48` | `--font-sans` | same as #7 | canonical sans stack | Restore verbatim (+ serif at `gl.css:47`) |
| 10 | `md2pdf-minimal/…css:28` | `--font-serif` | same as #8 | canonical serif stack | Restore `'Times New Roman'` tier |
| 11 | `recipes/report.md:97` | footnote-anchor size | `0.75em` | `0.7em` | Change to `0.7em` (same recipe says `0.7em` at :287) |
| 12 | `theme_gl.R:305` | legend series-label color | `ink_2 #2C2823` (global) | per-series dark tone | **Not fixable in theme** — see §2 |

**Drifts 1–11 are mechanical downstream fixes.** Drift 12 is a ggplot limitation, not a value error.

The canonical sans stack (drifts 4, 7, 9):
`Inter, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif`
The canonical serif stack (drifts 8, 10): `'Source Serif 4', Georgia, 'Times New Roman', serif`
`gl-observable-plot/gl-plot.ts:106-107` already carries both verbatim — use it as the reference.

## 2. Needs designer / owner input (all non-blocking)

1. **Axis-title gap number.** `grammar.md:384-385` says "typically 20px"; the ggplot twin uses 15px.
   Pin one value in `tokens.json` (grammar's 20px is the standing value) so gl-flint and ggplot align.
2. **Legend series-label color is per-chart, not a token.** A single theme/config property can't carry
   a per-series color — do **not** encode a scalar legend-label color in `tokens.json`. Keep the
   dark-tone rule as an application-level convention. Fix in the gl-ggplot skill via
   `guide_legend(override.aes=)` / scale-driven `*_dark` tones; `ink_2` stays a neutral fallback.
   The flint twin already sidesteps this by dropping the legend for direct dark-tone labels.
3. **Warm PDF page (optional confirm).** `gl_pdf.tex`'s `#FAF8F4` is treated as a bug to revert to
   `#FFFFFF`. If a warm print page is genuinely wanted, introduce it in `grammar.md` first.

## 3. Coverage summary (14 units)

| Unit | Agreements | Confirmed drift |
|------|-----------:|-----------------|
| `gl-ggplot/theme_gl.R` | 166 | 1 (legend color, not theme-fixable) |
| `gl-ggplot` SKILL + `gl_pdf.tex` | 82 | 3 (glaccent / glmuted / glpaper) |
| `gl-flint` (mjs + render + SKILL) | 158 | 3 (svg font, halo, titlePadding) |
| **`gl-observable-plot` core (`gl-plot.ts` + fonts + SKILL)** | **~75** | **0 — cleanest JS encoding (see §5)** |
| `gl-observable-plot/gl_lint_plot.mjs` | 75 | 0 |
| `chart-audit/gl_lint.R` | 58 | 0 |
| `chart-audit/SKILL.md` | 11 | 0 |
| `md2pdf` (css/template/lua/SKILL) | 47 | 2 (sans + serif stacks) |
| `md2html` | 0 | 0 (delegates to md2pdf) |
| `md2slides` (gl.css/script/SKILL) | 42 | 1 (sans stack) |
| `md2docx` (py/lua/SKILL) | 61 | 0 |
| `md2pdf-minimal` (css/SKILL) | 38 | 1 (serif stack) |
| `gl-docx-retheme` (audit/retheme/SKILL) | 2 | 0 |
| `recipes/report.md` + `slide.md` | 80 | 1 (footnote-anchor) |

## 4. Benign differences — do NOT re-flag

- **Bare `Inter` / `Source Serif 4` in docx & the R theme** (`build_gl_template.py`,
  `growthlabbify.lua`, `gl-docx-retheme`, `theme_gl.R`/systemfonts). Correct: Word `rFonts` and R
  `register_font` take a single family and supply their own fallback. The "never emit bare Inter" rule
  governs CSS/SVG emission only.
- **Unit conversions (all correct).** px→linewidth `/2.845`, px→point-stroke `×1.889`, px→pt `×0.75`,
  em↔twips tracking. The 0.53-vs-0.35 "1px" pair is two different ggplot scales, both right.
- **Sector palettes** (Atlas HS/SITC/product-space) — external standard, `grammar.md` defers to the
  CSV and does not enumerate them, so they cannot drift.
- **Documented per-medium deviations** — slide base 12pt, slide `strong`=accent, docx body 12pt +
  1px→1pt approximation — each carries in-file rationale.
- **Stale doc-table opsz cells** (`md2pdf/SKILL.md:41-42`, `md2pdf-minimal/SKILL.md:45-46` reading opsz
  28/18) — the shipping CSS already renders opsz 36/22 per grammar. Documentation lag only.
- **Out-of-grammar medium extras** — JetBrains Mono code font, dark-mode axis/gridline swaps,
  screen-only HTML backgrounds/shadows, H3 level, ribbon alpha 0.5, break-slide opsz 48. Each scoped
  and commented; grammar defines none.
- **Recipe-delegated geometry** — figure sizes, DPI, margins, line-heights. Grammar's `figure-sizes`
  token says "not defined in grammar — pinned per recipe." Verify against `recipes/`, not `grammar.md`.

## 5. Method notes & the two closed gaps

- **`diff:gl-observable` crashed** on the structured-output retry cap (its extraction succeeded; only
  the diff stage failed). Closed by hand: `gl-plot.ts:106-107` carries both canonical font stacks
  verbatim, implements the paper label-halo (`:290`, `:64`), and its palette hexes matched in
  extraction. **Result: 0 drift** — it is the best-behaved JS encoding and the reference for
  regenerating drifts 4, 7, 9.
- **One verify agent crashed** (same cap) — one of 24 candidate drifts went unverified. Non-material:
  it does not change the greenlight, and any real drift it hid would still be a "grammar wins"
  downstream fix like the other 11.

## 6. What this greenlights

Proceed to migration Phase 1 (author `tokens.json` from `grammar.md`) — see
[`skill-architecture-migration.md`](skill-architecture-migration.md). The 11 mechanical drifts (1–11)
can be fixed now by hand, or left to be corrected automatically when the generator first emits their
files. Drift 12 and the axis-gap number are tracked as application-level follow-ups.
