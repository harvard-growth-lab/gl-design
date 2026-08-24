# Refactor: one owner per rule — 2026-08-06

Second run of the day. The morning run closed the last audit findings and brought
coverage to 11 built / 2 partial of 13. This run did not change what the plates
look like; it changed **where the rules live**.

**Result: audit clean (0 findings, 13 plates), 72 unit tests pass, typecheck clean,
`tokens:check` clean against `grammar.md`.** Coverage unchanged at 11 built,
2 partial, 0 missing of 13.

## What was wrong

The package had grown as a preset API plus a belt-and-braces stylesheet, so every
spec rule was enforced in two to four places and every value was hand-copied into
four renderers. Concretely:

- **"Line 2px, focus 2.4px"** lived in `tokens.geometry`, `marks.ts`,
  `theme.css`'s `.gl-mark--line`, the audit's expectations, and the SKILL's rule
  list. Five copies of one number.
- **`theme.css:4`** said "Mirrors `src/tokens.ts` exactly; if the two ever
  disagree, both are wrong" — a comment where a build step belonged. The values
  were also re-emitted for the audit by `render.mjs` and re-typed a fourth time in
  `reference/build-reference.mjs` (`const T`, `const G`).
- **`charts.ts` (645 lines)** was a second API surface: six presets with their own
  option vocabulary, which could only express what the option bags anticipated, and
  which every "going beyond the presets" section then had to work around.
- **~165 lines of CSS** defined a `.gl-mark--*` / `.gl-axis__*` vocabulary the
  shipped library never emits, because TanStack marks take no className. Only the
  hand-written reference renderer used it.
- **Three prop bags** (`chartProps`, `stackedChartProps`, `haloLabelProps`) had to
  be picked correctly at every call site, or a CSS-only spec rule silently didn't
  apply.

## What changed

| Kind of rule | Now owned by |
|---|---|
| A value | `tokens.json` → `scripts/emit-tokens.mjs` → `src/tokens.ts`, `src/tokens.css` |
| A default | `src/marks.ts` (one table, one applier) + `src/chart.ts` (`glChart`) |
| A judgment | `skills/gl-charts/SKILL.md` |
| An invariant | `gallery/audit.mjs` |
| A workaround | one CSS rule in `patch.css`/`shapes.css` + one expiry test |

- **`charts.ts` deleted.** Cartesian charts are composed: `glChart({ marks, x, y })`
  with the spec's named moves as helpers in `compose.ts` — `popUp`, `toSeries`,
  `endLabels`, `clearOf`, `stackOrder`, `toneRamp`, `yearAxisFor`. All of that logic
  came out of the presets rather than being rewritten. The recipes moved to
  `gallery/catalog.tsx`, which is rendered and audited every run.
- **`theme.ts` folded into `chart.ts`**, which also gained `glChart()`. Every
  builder — including all five shape functions — now returns
  `{ definition, className, props }`, so the prop-bag choice is gone.
- **`marks.ts` is a defaults table plus `glDefaults(kind, options)`**, which applies
  the spec to *any* TanStack mark, wrapped or not. The `gl*` wrappers are two lines
  each. `glTile`'s `nested` paper stroke was removed: tiles are separated by a
  gutter at every depth (§3.4.1), which made that branch dead.
- **Shapes moved behind `@growth-lab/gl-charts/shapes`** — radar, treemap,
  boxplot/violin, choropleth: 3,100 lines that carry geometry rather than defaults,
  and that a consumer who never draws a map should not pay for.
- **`theme.css` split by owner** into `tokens.css` (generated), `chrome.css` (our
  markup), `patch.css` (TanStack Cartesian corrections), `shapes.css` (the same for
  the shape types), with the dead `.gl-*` vocabulary moved to
  `reference/reference.css` where its only consumer lives.
- **`reference/build-reference.mjs` reads `tokens.json`** through
  `scripts/tokens.mjs` instead of keeping its own copy of the values.

## The audit changed too, and that is the point

Moving enforcement into the audit means the audit's rules have to encode the spec
correctly. Two were too broad, and both showed up as findings on plates that were
in fact on-spec:

1. **Ordered ramps were not token colours.** `TOKEN_COLORS` knew the categorical
   palette and the inks but not `sequential-*` / `div-*`, so both choropleths were
   flagged for painting themselves out of the ramps the spec prescribes — 15
   findings. Fixed by adding the ramps. Known limit, now documented in the file: a
   ramp resampled to a step count the tokens don't enumerate interpolates *between*
   ramp values and will still flag.
2. **"Every dot is at 0.8" is not the rule.** 0.8 is for OVERLAP. A radar's vertex
   dots sit one per spoke on a polygon already at 0.25 fill; they cannot overlap,
   and 0.8 there would only dilute them. The check now asserts the substantive
   rule first — fill and stroke opacity **match**, at any value, which is what
   makes overlapping circles darken together — and applies the 0.8 value only to
   the marks the rule is about. Radar accounted for 12 findings.
3. **Polar guides are rendered inside the marks group**, and a guide's unset fill
   computes to black, so every radar spoke read as an off-token paint (6 findings).
   The audit now recognises guides by key and skips the fill check on stroke-only
   geometry, while still requiring the stroke to be a token colour.

All 33 findings were audit bugs, not render bugs. Worth stating plainly: they had
been sitting in the working tree since radar and the choropleths were built, and
nothing was watching, because the plates predate the last report.

## Verification

```
npm run tokens:check   ✓ tokens.ts + tokens.css match tokens.json
                       ✓ 89 colour values, 31 type-role fields verified vs grammar.md
npm run typecheck      ✓ (now covers gallery/ too — it never had before)
npm run test           ✓ 72 tests: scales, marks, compose, constraints
npm run gallery        ✓ 13 rendered, audit clean, 11 built / 2 partial
```

`tests/constraints.test.ts` is new and is the workaround expiry list: 22 tests, each
asserting a TanStack limitation still exists and naming the rule to delete when it
stops existing. Behavioural where the behaviour is reachable headlessly (gridline
opacity 0.11, axis 0.28, `areaY` 0.2, `dot` r 3.5, `rect` inset 0.75, the `'auto'`
offset reference point, `colorLegend`'s 10px labels, `ruleY` spanning the plot),
structural against TanStack's `dist/` where it isn't (`ChartTheme`'s five fields,
`PolarGuideStyle` lacking `labelFontWeight`, `RectOptions.fill` not being a
channel). The pinned version is asserted too, so a bump forces a re-read.

## Size

| | Lines |
|---|---|
| Core (`chart`, `marks`, `compose`, `tone`, `scales`, `figure`, `index`, `dev`, generated `tokens.ts`) | 2,258 |
| Shapes (`src/shapes/*` + entry) | 3,132 |
| CSS, all five sheets + the reference vocabulary | 759 |
| Tokens, emitters, tests | 3,331 |

The core number is not much smaller than before (the deleted 645-line preset layer
was roughly replaced by `glChart` + `compose` + the generated token file), and that
is the honest read: this refactor bought **single ownership**, not brevity. The two
places it did buy brevity are the CSS (526 → 480 shipped, with 169 of the old lines
moved to where their only consumer is) and the treemap layout (two copies of a
squarified layout → `d3-hierarchy`).

## Still open

- The four `partial` / gap entries in `catalog-meta.mjs` are unchanged.
- `npm run tokens:downstream` found real drift in the *other* skills' hand-carried
  copies — five off-token hexes in `gl_pdf.tex`, three of them values the spec
  retired, plus six undocumented carriers. Recorded as items 15 and 16 in
  `SPEC.md` C4; not fixed here, because each needs a decision about which
  value is right.
- `grammar.md`'s geometry section is prose, so geometry values can only be
  *reported*, never verified. Colour and type roles are enforced.
