# Docs — the primitives, one static page

Every exported token, tone, axis preset, mark, compose helper, scale, shape and
figure component in `@growth-lab/gl-charts`: its signature, its options, the
defaults it applies, and the prose that says which spec rule it serves.

```bash
npm run docs          # → docs/out/index.html
open docs/out/index.html
```

No server, no network, no `node_modules` at view time. Fonts, CSS and script are
inlined — the file can be emailed.

---

## Why this exists next to `gallery/` and `examples/`

Three questions, three artifacts. This is the only one that answers the third.

|  | `gallery/` | `examples/` | `docs/` |
|---|---|---|---|
| Asks | *Can* it draw this on-spec? | Does it survive real data? | What **is** this primitive? |
| Shows | Spec crop vs. render | Whole charts + source | Signatures, options, defaults |
| Draws a chart | Yes, 118 of them | Yes, from Atlas | **No** |

The distinction in that last row is the point. A page of worked examples teaches
you the four or five charts someone thought to write; it cannot tell you what
`glDefaults('band')` paints, which properties of `glPoint` the spec pins against
you, or that `rule` and `stem` are the same geometry with opposite jobs. Those
are questions about the vocabulary, and they want a reference, not a demo.

## Nothing on the page is hand-written

Three extractors feed it, each reading the artifact that already owns its facts:

| Section | Source | Mechanism |
|---|---|---|
| Signatures, options, section structure, prose | `src/**` | TypeScript compiler API |
| Mark defaults, swatches, pinned-vs-overridable | `glDefaults()` | esbuild → import → **call it** |
| Token values, CSS custom-property names | `tokens.json` + `src/tokens.ts` | read + import |

The middle row is the one worth arguing for.

**The mark defaults table is measured, not transcribed.** It is the most useful
thing this package could document — which of `fill`, `fillOpacity`, `stroke`,
`strokeWidth`, `r` the spec pins and which the caller may override — and it
exists nowhere in prose, only in one table of arrow functions in `marks.ts`.
Writing it out on a page would create a copy that goes stale the first time a
value moves. So the build calls `glDefaults(kind, {})` for all sixteen kinds,
then hands each resulting property back in with a sentinel value: if the sentinel
survives, the property is a default; if it is overwritten, the spec pins it. The
swatch beside each row is stroked with the numbers that came back, so a swatch
cannot disagree with the row it sits in.

The same machinery documents the wrappers. `glMutedBar` has no doc comment — it
is two lines, on purpose — but its body says it delegates to `glBar` pinning
`tone: 'muted'`, so its card shows a **grey** bar swatch and the exact fill the
caller will get. That is derived documentation, and it cannot drift.

## Layout

| File | |
|---|---|
| `build-docs.mjs` | The generator: parse → probe → render → inline |
| `docs.css` | Page chrome only. Draws nothing that is a chart |
| `page.js` | Filter (`/` focuses it) and current-symbol tracking |
| `out/index.html` | The page |

The module roster at the top of `build-docs.mjs` is explicit and ordered, not a
directory scan: the order is the page's reading order — tokens before tones
before marks before the helpers that arrange them — and a scan would sort
`chart.ts` above `tokens.ts` and teach the vocabulary backwards. A new module is
one line.

## Verifying

```bash
npm run docs:check
```

Following the split the repo already uses (`tokens:check` fails,
`tokens:downstream` reports):

- **Fails** on a module that parsed to zero exports — a rename or a parser
  regression would otherwise drop a whole section from the page silently — and
  on any external reference (`<link>`, `<script src>`, a remote `url()`, a
  non-`data:` image), which would break the self-contained claim.
- **Reports** documentation coverage: how many symbols carry prose, options or
  derived defaults, and names the ones that render as a signature alone. This is
  a number to look at, not a gate. The `gl*` wrappers are deliberately doc-free
  and `renderMarkCard` derives their documentation anyway; a gate that failed on
  a missing doc comment could only ever be satisfied with filler prose.

It is not part of `npm run check`. That gate is the library's correctness;
this page is a deliverable built from it.
