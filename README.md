# Growth Lab Design System

A visual grammar for all Growth Lab outputs — reports, slides, briefs, charts — codified
as a **source-of-truth grammar** ([`grammar.md`](grammar.md)), per-medium **recipes**
([`recipes/`](recipes/)), and the **runnable tools** that apply them: an R/ggplot theme,
markdown→Word/PDF/HTML/slide pipelines, and audit checklists. The goal: you absorb the
system by *using* it, not by reading a spec.

Three layers, each separable: the **grammar** holds the medium-agnostic primitives (color,
type, chart conventions); **recipes** apply the grammar to one medium (page geometry,
figure sizes); **tools** encode both so researchers get the right defaults automatically.

This document has two halves: **[Using the kit](#using-the-kit)** (the common case) and
**[Changing the system](#changing-the-system)** (editing the grammar or tools). The spec
itself lives in [`grammar.md`](grammar.md) and is the source of truth for every value.

---

# Using the kit

Run `/design-kit` in any project and the rest of your session inherits the grammar: charts
use the GL theme, documents render through the GL pipelines, no restating required. The kit
ships these skills:

| Skill | Does |
|---|---|
| **/design-kit** | **Start here.** Session primer — verifies tooling, loads the grammar + report recipe, and makes every chart and document you produce follow GL conventions for the rest of the session |
| **gl-ggplot** | GL theme, palettes, and `save_fig` sizes for R/ggplot2 charts |
| **gl-graph-modes** | Two-mode R/ggplot wrapper over `gl-ggplot` — fast colorful *research* graphs (default) vs. spec-compliant *production* graphs |
| **gl-charts** | GL theme, palettes, marks, and compose helpers for **web** charts (TanStack Charts v0) |
| **chart-audit** | Visual audit checklist to run after generating ggplot charts |
| **md2docx** | Markdown → Word (.docx) with citations + cross-references |
| **md2pdf** | Markdown → styled PDF |
| **md2html** | Markdown → self-contained, portable HTML |
| **md2slides** | Markdown → 16:9 PDF slide deck (Marp) |
| **md2pdf-minimal** | Node-only fallback for PDF when the pandoc path is unavailable |
| **gl-docx-retheme** | Restyle an existing Word doc to the GL theme |

> **These skills ship together as the `gl-design` plugin — they are not standalone.**
> They share one source of truth: `grammar.md` and `recipes/` at the plugin root. The
> skills reference those shared files (and the bundled fonts), so copying a single skill
> directory out on its own will break it. Install the whole kit, not one skill.

## Install

> **Installing with Claude (the common path).** Point Claude Code at this public repo and
> say "install this." Claude should: **(1)** run `claude plugin install gl-design` — this is
> OS-neutral and gives the skills + `/design-kit`; **(2)** do the font step for the OS:
> *Linux/macOS* → `bash scripts/install-fonts.sh`; *Windows* → install the four `.ttf` files
> under `assets/fonts/inter/ttf/` and `assets/fonts/source-serif-4/ttf/` for the current user
> (right-click → Install, or PowerShell); **(3)** verify external tools — `scripts/doctor.sh`
> on Linux/macOS, or check `pandoc`, `pandoc-crossref`, Node/Marp, and Chromium natively on
> Windows. The R/ggplot chart path needs no font step; only PDF/slides/xelatex do. The
> scripts are conveniences — Claude can run the equivalent native commands on any OS.

### 1. Clone

```bash
git clone https://github.com/taimur38/gl-design.git
cd gl-design
```

### 2. Check / install dependencies

The kit leans on a few external tools (pandoc + pandoc-crossref, headless Chromium, Node +
Marp, R with ggplot2/systemfonts/ragg). Run the doctor to see what's present and get the
exact install command for anything missing:

```bash
bash scripts/doctor.sh
```

It does **not** install anything — it tells you what to run. Install the items it marks `✗`.

**Requirements (floors, not pins — newer is fine; don't upgrade if you already meet them):**

| Tool | Minimum | Needed for |
|---|---|---|
| R | 4.1 | charts (`\(x)` lambda syntax in the theme) |
| systemfonts (R pkg) | 1.1.0 | font registration (`match_fonts`) |
| ggplot2 (R pkg) | 3.3 | charts |
| ragg, textshaping (R pkg) | any recent | chart raster output |
| pandoc + pandoc-crossref | any recent (crossref must match your pandoc) | md2docx / md2pdf / md2html |
| Node.js + Marp CLI | any LTS (Marp via `npx` on demand) | md2slides |
| Chromium / chrome-headless-shell | any recent | md2pdf / md2slides PDF rendering |

The doctor checks **presence** (and warns if R/systemfonts are below the floor) but never
forces an upgrade.

### 3. Install the skills

**Preferred — Claude Code plugin** (auto-updates from git, no symlinks):

```bash
claude plugin marketplace add ./           # or: taimur38/gl-design once pushed
claude plugin install gl-design
bash scripts/install-fonts.sh              # one-time: register fonts system-wide
```

The plugin install gives you the skills and `/design-kit`. It does **not** register the
fonts — and the PDF, slides, and xelatex paths resolve fonts by name from the OS (the
R/ggplot path reads the bundled fonts directly and needs nothing). So run
`scripts/install-fonts.sh` once after installing.

**Fallback — symlink script** (if you're not on the plugin system):

```bash
bash scripts/install.sh
```

This symlinks every skill in `skills/` into `~/.claude/skills/`, installs the fonts (via
`install-fonts.sh`), and re-runs the doctor.

## Use

In any project:

```
/design-kit
```

This verifies tooling, loads `grammar.md` + the report recipe, and adopts GL conventions
for the session. From there, just ask for charts or documents as normal — they'll follow
the grammar. You can also invoke any sub-skill directly (e.g. "convert this to a Word doc"
triggers `md2docx`).

Charts, by hand, start with:

```r
source(paste0(Sys.getenv("CLAUDE_PLUGIN_ROOT"), "/skills/gl-ggplot/assets/theme_gl.R"))
# ^ under the installed plugin. If CLAUDE_PLUGIN_ROOT is unset (symlink install or a
#   plain Rscript run), use "~/.claude/skills/gl-ggplot/assets/theme_gl.R" instead.
gl_setup()
```

Once the file is sourced, the repo root auto-detects, so the legacy
`source("~/dev/gl-design/...")` form keeps working too. Set `GL_DESIGN_ROOT` to override.

---

# Changing the system

This half is for editing the grammar or the tools — not for using the kit.

## The one rule: values flow downward, never back up

A design value (a color hex, a font family, a type size, a figure dimension) has exactly
one home, and every other place that carries it is a **downstream copy that must match**.
For most of the tree that match is maintained by convention, so the authority order has to
be explicit. **One medium is now generated:** `packages/gl-charts/tokens.json` is the
machine-readable encoding of `grammar.md`'s tables, and the web/SVG token files are emitted
from it — see [Generated vs. hand-carried](#generated-vs-hand-carried) below.

```
docs/nil/       UPSTREAM INSPIRATION — Nil's original deliverables.
                Read-only. We distill from it; we never edit it, and it is not
                authoritative once distilled.
  ↓ distilled into
grammar.md      SOURCE OF TRUTH — canonical, medium-agnostic values: color ramps +
                palettes, type stack, weights, type scale, in-chart conventions.
                If a value disagrees anywhere, grammar.md wins. CHANGE TOKENS HERE FIRST.
  ↓ applied per medium
recipes/        Medium APPLICATIONS — page geometry, grid, figure sizes, per-medium type
                sizes (report.md, slide.md). May ADD medium-only values but must never
                CONTRADICT grammar.md.
  ↓ encoded as runnable form
DOWNSTREAM      Must MATCH grammar.md + the relevant recipe. Never a source of truth.
ENCODINGS       When a grammar/recipe value changes, update every file below that carries
                it, then re-render the playground to verify.
```

## Where each value lives downstream

When you change a token in `grammar.md`, grep these and update every copy that carries it:

| File | Carries |
|---|---|
| `skills/gl-ggplot/assets/theme_gl.R` | R: the `gl` token list, palettes, `save_fig` sizes, geom defaults |
| `skills/gl-ggplot/assets/gl_pdf.tex` | xelatex: font families + the color palette (R Markdown PDF route) |
| `skills/md2docx/assets/build_gl_template.py` | Python constants → `gl.docx` / `gl.dotx`. **Deliberate** px→pt and boolean-bold compromises live here, documented in-file |
| `skills/md2pdf/assets/md2pdf-style.css` | CSS `:root` vars (shared by md2html) |
| `skills/md2pdf-minimal/assets/md2pdf-style.css` | CSS `:root` vars (minimal fallback) |
| `skills/md2slides/assets/themes/gl.css` | Marp theme CSS |
| `packages/gl-charts/tokens.json` | Web/SVG: the **authored** machine-readable encoding — values *and* their rationale. Verified against `grammar.md` by `npm run tokens:check` |

`docs/nil/` and `playground/` are **out of scope** for drift checks: the former is upstream,
the latter is derived output.

<a id="generated-vs-hand-carried"></a>
## Generated vs. hand-carried

| | Files | How it is kept true |
|---|---|---|
| **Generated** | `packages/gl-charts/src/tokens.ts`, `src/tokens.css`, `src/fonts.css` | Emitted from `tokens.json` by `npm run tokens`. Do not hand-edit: `npm run tokens:check` fails if you do, and also fails if `tokens.json` disagrees with `grammar.md`'s colour tables |
| **Hand-carried** | the six skill assets above | Convention, plus `npm run tokens:downstream` — a report (never a build failure) of every GL hex present downstream that is missing from `tokens.json`, and every token a file is documented to carry but doesn't |

`grammar.md`'s colour tables are parsed and enforced. Its geometry section is prose
(`- **Tick mark**: 1px, 4px long, **outward**`), so those values are printed side by side
for reconciliation instead — `node packages/gl-charts/scripts/check-tokens.mjs --reconcile`.

## Auditing for drift (and for LLMs)

Treat `grammar.md` as ground truth. For each color hex / font family / type size it
defines, grep the downstream encodings above and flag any that differ. **A mismatch is a
bug in the downstream file, not in grammar.md** — unless the downstream file documents a
deliberate per-medium compromise (as `build_gl_template.py` does for Word).
`npm run tokens:downstream` from `packages/gl-charts` does that grep for you and reports
what it finds; it never fails a build.

## Repo structure

```
grammar.md            # SOURCE OF TRUTH — color, type, chart conventions
recipes/
  report.md           # Long-form report: page, grid, figure sizes, patterns
  slide.md            # 16:9 slide deck: canvas, type sizes, slide classes

assets/               # Static embodiments of grammar + recipe
  fonts/              # Source Serif 4 + Inter (local copies; legacy/ holds retired faces)
  design-library/     # GL brand assets: logos, flags, color palettes (CSV)

skills/               # Runnable, Claude-consumable tools
  gl-ggplot/          # GL design system for R/ggplot2 (theme, scales, sizes)
    assets/theme_gl.R   # Sourceable R file — the portable runtime
  gl-graph-modes/     # Research vs. production modes over gl-ggplot
    assets/gl_graph.R   # Sources theme_gl.R, then layers the research-mode defaults
  gl-charts/          # GL design system for web charts (see packages/gl-charts)
  md2docx/            # Markdown → Word conversion (pandoc + Lua filters)
    assets/templates/gl.docx       # GL Word reference doc (the live --theme gl)
    assets/templates/gl.dotx       # Template twin for manual Word users
    assets/build_gl_template.py    # Rebuilds gl.docx + gl.dotx from Nil tokens
  gl-docx-retheme/    # Convert an existing Word doc to the GL theme
  md2pdf/             # Markdown → PDF via pandoc + headless Chromium
  md2html/            # Markdown → self-contained HTML (shares md2pdf assets)
  md2slides/          # Markdown → 16:9 PDF deck via Marp + gl theme
  md2pdf-minimal/     # Node-only PDF fallback when pandoc is unavailable
  chart-audit/        # Visual audit checklist for ggplot charts

commands/             # /design-kit session primer
scripts/              # doctor.sh (deps) · install-fonts.sh · install.sh (symlink fallback)
playground/           # Working dogfood example (demo report + chart code + renders)
eval/                 # Skill smoke test: prompt battery + headless runner + eval protocol
                      #   (run folders in eval/reports/<stamp>/, gitignored; the
                      #    <stamp>.md evaluation reports beside them are committed)
packages/
  gl-charts/          # GL themed chart component library for the web (over TanStack Charts)
    SPEC.md             # PROPOSED additions to grammar.md — the rules this package needed
                        #   for marks the grammar never had to name (donut, band, stem,
                        #   leader, legend placement). Not ratified; grammar.md still wins
    src/tokens.ts       # Typed token module — downstream copy of grammar.md
    src/theme.css       # CSS custom properties + figure-block chrome
    reference/          # Hand-computed, TanStack-free render of the spec (the visual target)
    gallery/            # Fidelity harness: rebuilds the spec PDF's worked examples with
                        #   gl-charts and diffs them against crops of the PDF itself
                        #   (`npm run gallery`; reports in gallery/reports/)
    examples/           # Every catalog chart type drawn from REAL Atlas of Economic
                        #   Complexity data, each shipped with its source, bundled to one
                        #   self-contained HTML (`npm run examples`). The gallery asks
                        #   "can the library draw this on-spec?"; this asks "does it
                        #   survive data nobody designed for it?" — and the answers that
                        #   come back "no" are recorded under each chart

docs/
  followups.md        # Open questions / Word-fidelity limits (cited by skills)
  data-vis-spec-core.md  # Condensed core of the data-vis spec PDF (downstream of grammar.md)
  nil/                # Upstream inspiration — Nil's original spec deliverables (read-only)
```

## After any change: re-render the playground

The playground is the dogfood verifier. From the `pakistan-explore` working directory:

```bash
cd ~/dev/pakistan-explore
Rscript ~/dev/gl-design/playground/render_report_charts.R   # regenerate chart PNGs
```

Then render the demo report through the pipeline(s) you touched and eyeball the result:

```bash
skills/md2pdf/scripts/md2pdf   playground/demo-report.md /tmp/demo.pdf
skills/md2docx/scripts/md2docx --theme gl playground/demo-report.md /tmp/demo.docx
```

A change isn't done until the playground reflects it.

## Portability

Skills must not hardcode absolute paths. `theme_gl.R` resolves the repo root in this order:
`GL_DESIGN_ROOT` → `CLAUDE_PLUGIN_ROOT` → the script's own location → `~/dev/gl-design`
(legacy fallback). New scripts should follow the same pattern — derive paths from
`${CLAUDE_PLUGIN_ROOT}` (commands/hooks) or the script's own location, never from a fixed
`/home/...` path.

## Packaging

The repo root is itself the Claude Code plugin: `.claude-plugin/plugin.json` +
`.claude-plugin/marketplace.json` declare it, and `skills/`, `commands/` auto-discover.
Adding a skill = drop it under `skills/` and add it to the `skills` array in
`marketplace.json`. Adding a command = drop a `.md` under `commands/` (do **not** list it
in `marketplace.json` — the `commands`/`skills`/`agents` fields there are directory-path
*overrides*, not file lists).

**The skills are plugin members, not standalone.** They deliberately share one source of
truth — `grammar.md`, `recipes/`, and `assets/fonts` at the plugin root — and reference it
via `../../grammar.md`-style links and `${CLAUDE_PLUGIN_ROOT}`. That resolves only because
the whole repo is the plugin root; a skill copied out on its own will break. This is why
the repo is packaged as one plugin rather than ten per-skill plugins.

**Fonts on the plugin path.** `claude plugin install` does not run any script, so plugin
users must run `scripts/install-fonts.sh` once to register the fonts system-wide. Only the
R/ggplot path reads the bundled fonts directly; the PDF / slides / xelatex paths resolve
fonts by name from the OS. `scripts/install.sh` (the symlink fallback) calls
`install-fonts.sh` for you. Keep font logic in `install-fonts.sh`, not duplicated.

---

# Background

## Why it exists

Lab outputs didn't feel like they came from the same place — each medium reinvented its
typography, sizing, and figure conventions ad-hoc, brand colors got re-picked by hand, and
researchers without design background had no opinionated default to fall back on. The
grammar fixes the shared parts once; recipes apply them per medium; tools make the right
defaults automatic so the system can be followed without design training.

## Design inspirations

- **Foreign Affairs** — clean, authoritative layouts; strong typographic hierarchy;
  generous margins that let the text breathe.
- **World Bank flagship reports** — professional data presentation; effective use of
  sidebars, call-out boxes, and structured figure placement.
- **The Economist** — data-dense but highly readable; disciplined use of color; excellent
  chart typography.
- **QJE (Quarterly Journal of Economics)** — academic rigor; clean, no-nonsense
  typesetting; well-integrated figures and tables.

## Type stack and assets

- **Source Serif 4 + Inter** — the two-family type stack (serif for voice, sans for
  function), bundled locally in [`assets/fonts/`](assets/fonts/). Earlier iterations used
  Source Sans 3 (retired). The grammar forbids monospace in the type stack and in charts
  (never `family = "mono"` in ggplot). The one exception is fenced **code blocks** in the
  rendered document pipelines, which use JetBrains Mono — kept under
  `assets/fonts/legacy/` and resolved by name in the xelatex/CSS paths.
- **Growth Lab Design Library** (`growthlab.app/design-library`) — brand colors,
  visualization palettes, logos, flags. Downloaded to
  [`assets/design-library/`](assets/design-library/).
- **Pakistan FM meeting materials** ([`playground/`](playground/)) — a working dogfood
  example of the report recipe, with embedded ggplot code and rendered output.

## Constraints

- Output formats vary by recipe: PDF (reports, briefs), PPTX/PDF (slides), PNG/SVG
  (charts), HTML (web). The grammar holds across all of them.
- Researchers author in Markdown / Rmd / Quarto; figures are generated in R (ggplot2) and
  saved as PNG at 300 DPI.
- References managed via Zotero → CSL/BibTeX.
- The system must be simple enough that a researcher can follow it without design
  training — the tools make the right defaults automatic.
