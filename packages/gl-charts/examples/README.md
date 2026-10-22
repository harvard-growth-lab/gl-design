# Examples — every catalog chart, drawn from Atlas data

One self-contained HTML page: every renderable chart type in the TanStack Charts
catalog, rebuilt with `@growth-lab/gl-charts`, drawn from **real Atlas of
Economic Complexity data**.

The page is the artifact that gets handed to people outside the project, so it
shows charts and nothing else — no source panels, no §-citations, no recorded
gaps, no reference plates. Those are working notes and they stay in the repo:
each demo still carries its `rule` and `gaps` in the family file, and the
gallery report is where they are argued.

```bash
npm run examples          # → examples/out/index.html
open examples/out/index.html
```

No server, no network, no `node_modules` at view time. Fonts, data and code are
all inlined — the file can be emailed.

---

## Why this exists next to `gallery/`

They ask different questions, and both answers are worth having.

|  | `gallery/` | `examples/` |
|---|---|---|
| Data | Synthetic, shaped to be awkward | Real, from a released Atlas build |
| Question | *Can* the library draw this on-spec? | Does it **survive** data nobody designed for it? |
| Output | Reference-vs-generated plate pairs | A readable page of finished charts |
| Verified by | Pixel pairs + a token audit | Every demo mounted, drew, and cited its source |

The gallery's synthetic datasets are deliberately unhelpful — a right skew where
economics has one, groups with unequal n, a gap where an observation is genuinely
missing. That is a good test, and it is not the same test as nine real sectors
where the palette has six hues, or six real economies whose lines converge so
tightly that their end labels collide. **Findings from this page are recorded in
each demo's `gaps`**, beside the chart that found them, and read from there — the
page itself does not print them.

---

## Layout

| File | |
|---|---|
| `AUTHORING.md` | **The contract.** Read before writing a demo |
| `demo.ts` | The `Demo` / `Family` types, and what a demo is |
| `demos.ts` | The roster: family order, which is the page's reading order |
| `demos-*.tsx` | The demos themselves, one file per chart family |
| `atlas-data.ts` | The datasets, typed, with provenance. The only data source |
| `atlas/extract.mjs` | Pulls the committed JSON out of a local Atlas release |
| `atlas/geometry.mjs` | Pulls and simplifies the Natural Earth country outlines |
| `data/` | The committed snapshots. ~1.9 MB, versioned, with provenance |
| `entry.tsx` | The page: sidebar, masthead, cards |
| `examples.css` | Page chrome only — **may not style a chart** |
| `build.mjs` | Bundles everything into one HTML |
| `check.mjs` | Mounts it in Chrome and proves every demo drew |

---

## The data

`data/*.json` is committed, so the page builds without the Atlas release mounted.
Each file carries its own provenance — release id, classification, level, years,
and any exclusion applied — and `atlas-data.ts` turns that into the source line
under every figure. There is no source-less chart, and no chart citing an Atlas
it did not read.

Refresh the snapshots (needs the `atlas-ai` release and, for geometry, network):

```bash
ATLAS_HOME=/path/to/atlas-ai npm run examples:data
npm run examples:data:check   # fails if the committed files drifted from a fresh extract
```

Two decisions worth knowing before reading a chart:

- **HS92 throughout.** The only classification spanning 1962–2024 *and* carrying
  the product-space edges. HS12 starts at 2012, so a thirty-year composition
  chart is not expressible in it.
- **The "Other" sector is excluded.** It holds exactly two entries — trade
  discrepancies and unclassified commodities — and neither is a product. Left in,
  the largest tile on Vietnam's 2023 treemap is a reconciliation residual.

---

## Verifying

```bash
npm run typecheck        # includes examples/
npm run examples:check   # builds, mounts in Chrome, checks every demo
```

`examples:check` fails if a demo does not mount, draws fewer than six elements,
has no title, has no source line, is missing from the roster, or if the emitted
HTML references anything outside itself.
