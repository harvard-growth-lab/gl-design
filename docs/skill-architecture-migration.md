# Migration plan: from hand-copied spec to a generated, adapter-based skill system

**Status:** proposal / draft — not yet ratified.
**Scope:** how the GL design system is *packaged* into skills. No behavior or design values change.
**Author:** analysis session, 2026-07-09.

---

## 1. Why

The repo is a **fan-out pipeline**: a designer's spec (`docs/nil/`) → `grammar.md` (source of
truth) → `recipes/` → ~10 skills that each encode the grammar for one medium. Best-in-class systems
that do this same thing — design tokens (Style Dictionary / [W3C DTCG](https://www.designtokens.org/)),
grammar-of-graphics ([Vega-Lite](https://vega.github.io/vega-lite/)), and Anthropic's own
[Agent Skills guidance](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) —
all converge on two rules we are only *half* following:

1. **Define the design once, machine-readably, then *generate* every downstream encoding.**
   We define it once *in prose* (`grammar.md`) and then **hand-copy** the values into every skill.
   The categorical palette + ramps (~40–50 hexes) are hand-transcribed in at least six files:
   `grammar.md`, `skills/gl-ggplot/assets/theme_gl.R` (lines 47–198), `skills/gl-ggplot/SKILL.md`,
   `skills/gl-flint/assets/gl-flint.mjs`, `skills/gl-observable-plot/assets/gl-plot.ts`, and both
   linters (`gl_lint.R`, `gl_lint_plot.mjs`). `CLAUDE.md`'s "one rule" (*change grammar.md first,
   then update every downstream, then re-render to verify*) is a **manual discipline standing in for
   a build step.** That discipline does not hold at scale — which is the entire reason Style
   Dictionary exists.

2. **Teach the medium-independent grammar once; keep per-medium skills thin.** Anthropic's guidance
   is progressive disclosure + domain separation: a lean router, heavy material loaded on demand,
   references one level deep. Our per-medium separation is *correct* and should stay. But each
   `SKILL.md` currently *re-teaches the whole grammar* (mute-then-highlight, the dark-tone rule,
   valence, the 12px floor) on top of its renderer mechanics. `gl-ggplot` (760 lines) and
   `gl-observable-plot` (809) are over the 500-line target largely because of this duplication.

The goal is to make drift **structurally impossible** rather than **policed**, and to make the whole
apparatus **reusable** by another org that swaps the values and keeps the machinery — the model
Anthropic's `dataviz` skill already uses (a placeholder palette you replace).

## 2. Target architecture

```
docs/nil/ (designer, upstream)
        │
        ▼
  tokens.json  ◄── NEW: machine-readable SOURCE OF TRUTH for VALUES
        │             (DTCG for colors/type; $extensions for chart primitives)
        │
        ├── generator ──► theme_gl.R (palette block)      ┐
        │                 gl-plot.ts (palette)            │  GENERATED regions,
        │                 gl-flint.mjs (palette)          │  marked "do not edit",
        │                 :root CSS vars (pdf/html/slide) │  verified by CI diff
        │                 gl_lint.R / gl_lint_plot.mjs    │
        │                 docx template inputs            ┘
        │
  grammar.md  ◄── DEMOTED: human-readable NARRATIVE + RATIONALE for VALUES,
        │             and SOURCE OF TRUTH for BEHAVIORAL grammar (§3–4:
        │             mute-then-highlight, dark-tone rule, valence) — things
        │             DTCG cannot model. Points at tokens.json for the numbers.
        │
        ├── gl-design (shared grammar skill)  ◄── teaches the medium-independent
        │                                          grammar ONCE, progressive-disclosure
        │
        └── thin adapter skills  ◄── gl-ggplot, gl-observable-plot, gl-flint,
                                      md2pdf/html/docx/slides, chart-audit, retheme.
                                      Assume the grammar; teach only renderer mechanics;
                                      point at the generated asset.
```

Two independent axes, each with its own payoff:

| Axis | Change | Payoff |
|------|--------|--------|
| **A — values** | `tokens.json` + generator; downstream files carry *generated* regions | Drift becomes impossible; one edit propagates |
| **B — packaging** | one shared grammar skill; thin the adapters | SKILL.md files shrink under 500 lines; grammar taught once |

The axes are separable — A can ship without B and vice versa — but they share Phase 0.

## 3. Phased plan

### Phase 0 — Reconcile & inventory (gates everything)

You cannot generate from a source whose copies disagree. First establish the canonical values.

1. Extract every hard-coded token from all downstream files into one comparison table
   (color hexes, font strings, line weights, opacities, tick geometry, figure sizes, opsz).
2. Diff each against `grammar.md`. Resolve every discrepancy **by asking the designer / against
   `docs/nil/`**, not by picking one silently. (E.g. confirm `chart-audit`'s categorical row matches
   the tiered `c-N` values elsewhere; confirm the `182ea68` gridline/muted revisions are reflected
   everywhere.)
3. Freeze the reconciled set. This is what `tokens.json` will hold.

**Deliverable:** a reconciliation table + a green "everything currently agrees" checkpoint.
**Risk if skipped:** you bake a wrong value into the generator and propagate it everywhere.

### Phase 1 — Author the token source (Axis A)

Create `tokens.json` as the value source of truth.

- **Format:** [DTCG](https://www.designtokens.org/) (`$value`/`$type`) for the primitives it models
  well — `color`, `fontFamily`, `fontWeight`, `dimension`. Use its `$extensions` namespace for
  GL-specific groupings DTCG doesn't have a type for (categorical light/main/dark triples, named
  sequential/diverging ramps, sector palettes, chart geom primitives). DTCG just reached a
  [stable v1](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/)
  and is tool-supported (Style Dictionary can consume it directly), which is why it beats a bespoke shape.
- **What goes in:** ink ramp, accent, paper/chrome, categorical (×3 tones), muted (×3), sequential
  (×6), diverging (×4), sector palettes, cover-pattern palette; font-family *strings incl. fallbacks*
  (grammar §2 — the "never a bare family name" rule is itself a token), weights, the opsz role table,
  the type-role table (family/weight/color/case per role); chart primitives (line weights in **source
  px**, opacities, tick length/offset, the 12px floor, figure sizes).
- **What stays out of tokens.json (stays prose):** the *behavioral* grammar — mute-then-highlight,
  the dark-tone rule, valence/sign-encoding, "2–4 colors." DTCG models values, not chart semantics.
  Forcing behavior into JSON is over-abstraction; keep it in `grammar.md` §3–4 and the shared skill.
- **Store source units, not derived ones.** `theme_gl.R` derives `linewidth = px / 2.845`, `pt = px ×
  0.75`, `geom size ≈ 3.16` (theme_gl.R lines 10–31). Put **px** in tokens; let each emitter own its
  unit transform (this is precisely Style Dictionary's per-platform "transform" model). Do not store
  the R-specific numbers as tokens.

### Phase 2 — Build the generator (Axis A)

One script that reads `tokens.json` and writes a marked, generated region into each downstream.

- **Language:** Node (most targets are JS/CSS/pandoc; it can emit the R block as text too). Model it
  on Style Dictionary's transform→format pipeline; you may even use Style Dictionary itself for the
  CSS/JS outputs and a small custom formatter for the R and linter blocks.
- **Emitters (one per target):** `theme_gl.R` token+palette block · `gl-plot.ts` palette · `gl-flint.mjs`
  palette · `:root` CSS custom properties (shared by md2pdf/html/slides) · `gl_lint.R` + `gl_lint_plot.mjs`
  expected-value tables · docx template build inputs (`build_gl_template.py`).
- **Mechanism:** each emitter writes between `// GL-GENERATED:START` … `// GL-GENERATED:END` markers so
  hand-written logic around it is untouched.
- **The CI guard (this is what kills drift):** a `verify`/`make check` that regenerates and fails on any
  git diff. Drift stops being a manual audit and becomes a red build.

### Phase 3 — Cut each downstream over to generated regions (Axis A)

One target at a time, lowest-risk first, re-rendering the playground after each to confirm output is
pixel-identical:

1. Linters (pure data, zero visual risk).
2. `theme_gl.R` token block.
3. Shared CSS `:root`.
4. `gl-plot.ts`, `gl-flint.mjs`.
5. docx template.

After all five: the hand-maintained copies are gone; `grammar.md`'s tables can either stay (regenerated
from tokens for human reading) or link to a rendered token reference.

### Phase 4 — Extract the shared grammar skill (Axis B)

Promote the existing `design-kit` priming skill into the canonical, medium-independent grammar teacher:
the philosophy (mute-then-highlight, dark-tone rule, valence, hierarchy, tabular figures), stated once,
pointing at `tokens.json` for values and `grammar.md` for rationale. Progressive disclosure: a lean body,
heavy tables in referenced files one level deep.

### Phase 5 — Thin the adapter skills (Axis B)

Rewrite each per-medium `SKILL.md` to (a) assume the shared grammar is known, (b) teach only what's
unique to that renderer (`theme_gl()` call and geom pattern; pandoc invocation; Flint's
`ChartAssemblyInput`), (c) point at its *generated* asset. Target < 500 lines each; `gl-ggplot` and
`gl-observable-plot` should drop the most. Descriptions stay as-is — they are already good routers.

### Phase 6 — Generalize / templatize (both axes)

Separate the **invariant machinery** (tokens → generator → shared-grammar skill → adapters) from the
**GL-specific content** (the hexes, Inter/Source Serif, the valence rules). Document the swap points so
another org forks by replacing `tokens.json` + the narrative and keeps everything else — the reuse model
Anthropic's `dataviz` skill is built around.

## 4. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| **Unit math diverges** — px→R linewidth, px→pt, opsz rescale differ per target | Store **source px** in tokens; each emitter owns its transform (Style Dictionary model). Never store derived per-platform numbers as tokens. |
| **Regeneration gets skipped / hand-edits creep back** | Generated-region markers + a **CI diff check** that fails the build on drift. This is the load-bearing mitigation. |
| **DTCG can't express chart semantics** | Don't force it. Values in JSON; behavioral rules stay prose (`grammar.md` §3–4 + shared skill). |
| **Sector palettes are external CSV standards** | Keep as a distinct token group sourced from the Atlas CSV; never fold into `categorical`. |
| **Over-abstraction** — collapsing skills into one mega-skill | Explicit non-goal. Per-medium separation is correct (Anthropic "domain separation"); keep it. |
| **Governance ambiguity** — two "sources of truth" | Resolve explicitly (see §5): `tokens.json` = SoT for *values*; `grammar.md` = SoT for *rationale + behavior*. Update `CLAUDE.md`'s "one rule" to name both. |
| **Font-string subtlety** — the "family + fallback, never bare" rule (grammar §2) | Model the full fallback strings as tokens so no emitter can emit a bare `"Inter"`. |

## 5. Decisions required before starting

1. **Governance:** ratify that `tokens.json` becomes SoT for *values* while `grammar.md` stays SoT for
   *rationale and behavioral grammar*. This amends `CLAUDE.md`'s core rule and should be signed off by
   the designer, since it changes what "the spec" means.
2. **Format:** DTCG + `$extensions` (recommended) vs. a bespoke JSON shape.
3. **Generator:** Style Dictionary vs. a small custom Node script (or Style Dictionary for CSS/JS +
   custom formatter for R/linters).
4. **Axis order:** ship Axis A first (kills drift — highest value), Axis B first (shrinks skills), or
   interleave. Recommended: **A first**, since B's adapters should point at generated assets that A produces.

## 6. Non-goals

- No change to any design value, rule, or rendered output — this is a packaging refactor.
- No collapsing of per-medium skills.
- No change to the `docs/nil → grammar → recipes → renderer` direction of flow.
- The linters stay (they are the feedback loop best-practice rewards) — they just check generated
  constants instead of hand-typed ones.

## 7. Rough sequencing

Phase 0 gates 1 → 2 → 3 (Axis A). Phases 4–5 (Axis B) can start once tokens exist (they reference the
generated assets). Phase 6 last. Axis A delivers the headline win (drift impossible) by end of Phase 3;
Axis B is independent polish after.
