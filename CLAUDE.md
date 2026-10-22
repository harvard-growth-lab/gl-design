# Growth Lab Design System

This repo is the GL design system: a visual grammar plus the runnable tools that apply it
(an R/ggplot theme, markdown→Word/PDF/HTML/slide pipelines, audit checklists).

**The one rule when editing:** design values flow **downward, never back up**.
`docs/nil/` (upstream) → `grammar.md` (**source of truth**) → `recipes/` (per-medium) →
downstream encodings (the R theme, CSS, docx template, Marp theme). If a value disagrees
anywhere, `grammar.md` wins. **Change a token in `grammar.md` first**, then update every
downstream file that carries it, then re-render the playground to verify. A mismatch is a
bug in the downstream file, not in `grammar.md`.

**The web/SVG medium is generated, not hand-carried.** `packages/gl-charts/tokens.json` is
the machine-readable encoding of `grammar.md`; `src/tokens.ts`, `src/tokens.css` and
`src/fonts.css` are emitted from it and must never be hand-edited. After a token change, run
`npm run tokens && npm run check` in `packages/gl-charts` — `tokens:check` verifies the
generated files *and* compares `tokens.json` against `grammar.md`'s colour tables, and
`tokens:downstream` reports the copies the other skills still carry by hand.

For everything else — the full propagation map, the per-file downstream table, install,
repo structure, packaging — see [`README.md`](README.md). The spec itself is
[`grammar.md`](grammar.md); per-medium applications are in [`recipes/`](recipes/); each
skill's usage is in its own `skills/*/SKILL.md`.
