---
name: md2slides
description: Convert markdown to a 16:9 PDF slide deck styled with the Growth Lab visual grammar. Use this skill when the user asks to create slides, a presentation, or a slide deck from markdown.
compatibility: Requires Node.js (with nvm) and the Marp CLI (`@marp-team/marp-cli`); uses headless Chromium discovered the same way md2pdf does.
metadata:
  author: taimur-shah
  version: "1.0"
---

# GL md2slides

Convert markdown to a 16:9 PDF deck that follows the [Growth Lab visual
grammar](../../grammar.md) and the [slide recipe](../../recipes/slide.md).
Built on [Marp](https://marp.app/) with a single bundled theme (`gl`) that
mirrors the design tokens used by `md2pdf` and `md2html`.

## Usage

```bash
md2slides input.md                      # outputs input.pdf
md2slides input.md output.pdf           # custom output path
md2slides --theme ./custom.css input.md # use a custom CSS file
md2slides --list-themes                 # list bundled themes
```

## Required frontmatter

```yaml
---
marp: true
theme: gl
size: 16:9
paginate: true
---
```

The `theme:` field is informational — the script passes the theme CSS to
Marp via `--theme`, so the CLI flag wins.

## Slide classes

Set with `<!-- _class: name -->` at the top of a slide.

| Class       | Purpose                                                                 |
|-------------|-------------------------------------------------------------------------|
| _(none)_    | Default content slide — H1 + body. Body block centers vertically.       |
| `title`     | Cover slide. `cover-bg` paper, eyebrow + date, display + accent rule + byline, rect-pattern bottom, GL logo top-right. |
| `break`     | Section divider. `ink-2` background, warm display in `cover-bg` tone.   |
| `chart`     | Compact eyebrow + chart title at top, chart fills the slide, source line below. Mirrors the report figure block. |
| `img-slide` | Image-left layout — pair with Marp's `![bg left:55%](img.png)`.         |
| `img-full`  | Full-bleed image with optional caption line below.                      |
| `map-slide` | Tight padding for side-by-side maps inside `.cols`.                     |
| `closing`   | Outro slide. `paper-warm` paper, italic display, eyebrow footer.        |

## Markdown → role mapping

| Markdown           | Role                          | Spec (slide sizes)                               |
|--------------------|-------------------------------|--------------------------------------------------|
| `# Heading`        | H1 / slide head               | Source Serif 4 40px 500 ink, opsz 36             |
| `## Heading`       | H2 / sub-head                 | Source Serif 4 26px 500 ink, opsz 22             |
| `### Heading`      | H3 / column head              | Source Serif 4 20px 600 ink, opsz 18             |
| `#### Heading`     | Eyebrow / figure label        | Inter 13px 600 UPPER accent, 0.14em tracking     |
| `body paragraph`   | Body                          | Inter 24px 400 ink-2, 1.55 leading               |
| `**bold**`         | Body emphasis                 | Inter 24px 600 ink                               |
| `> blockquote`     | Accent callout                | accent-tint bg, 3px accent left border           |
| `![alt](path)`     | Image (centered, bounded)     | Default; in `.chart` slides fills the slide      |
| `Source: ...`      | Chart source                  | Source Serif 4 italic 16px ink-2 (after image)   |
| `| col | col |`    | Table                         | Top/bottom ink rules, hairline row dividers      |
| `---`              | Slide separator (Marp)        | —                                                |

## Patterns

### Cover slide

```markdown
<!-- _class: title -->
<!-- _paginate: false -->

**MAY 2026**

# Pakistan's Path to Growth Through Productive Diversification

Taimur Shah, Ricardo Hausmann, and Tim O'Brien
```

The accent rule under the display is **auto-inserted** by the theme — don't
write `---` to make it appear (that would create a new slide). The cover
pattern (`rect-pattern-wide.svg`, a 6.8:1 mirror of the report's pattern
sized for 16:9) and the Growth Lab logo are baked into the title-slide
background by the script at render time. If you want a series eyebrow
above the date, add a leading `#### Eyebrow` line — it's optional, not
the default.

### Chart slide

```markdown
<!-- _class: chart -->

#### FIGURE 1

# Reserves have rebuilt from the 2023 trough.

![](imgs/reserves.png)

Source: Growth Lab analysis of State Bank of Pakistan data.
```

The eyebrow + title sit compact at the top, the chart fills the remaining
space, and the line that starts with `Source:` is styled as Source Serif 4
italic — matching the chart-source role in the report recipe.

**Figure sizing (automatic).** Before rendering, `size-images.js` reads each
chart PNG's pixel width and dpi (GL charts are 300 dpi from `save_fig`) and
injects a Marp width keyword — `![w:624](chart.png)` for a `full` (6.5in)
chart — so the image displays at its true physical size. This keeps the
baked-in chart text at its authored point size instead of scaling with the
slide (Marp/Chromium otherwise sizes a PNG at px÷96, then the theme's
max-width rescales it, transforming every label). Set a Marp keyword yourself
(`![w:800](chart.png)`, `![bg right:40%](chart.png)`) and it is left untouched.

### Two-column

Wrap the columns in a `.cols` div (HTML inside markdown is fine):

```markdown
<div class="cols">
<div>

### External

Reserves up sharply on remittance inflows; current account near balance.

</div>
<div>

### Fiscal

Revenue mobilization up from a low base; interest burden still consumes most.

</div>
</div>
```

The blank lines around the inner `<div>` tags are required so pandoc-style
markdown inside them is parsed as markdown rather than literal HTML.

## Choices and gaps

| Topic                                    | Status                                                                                 |
|------------------------------------------|----------------------------------------------------------------------------------------|
| Type sizes scaled for slide consumption  | Body 24px (≈ 2× report body); H1 40px, H2 26px, eyebrow 13px. Anchored to the grammar's role hierarchy, not the report's print pt values. |
| Cover layout                             | Mirrors the report cover (eyebrow + date, display, accent rule, byline, pattern, logo), at slide scale. |
| Slide-specific recipe                    | [`recipes/slide.md`](../../recipes/slide.md) — canvas, padding, type scale, slide-class catalog. |
| Bespoke slide types from the previous skill | (`agenda`, `journey`, `perspectives`, `proposal`, `tracks`, `topics`, `funding`, `diagram`, `takeaway` from the legacy `growth-lab` theme) — **not ported**. Add them back per-need rather than carrying a wide surface area into v1. |
| Mono font                                | Used only for inline `code` / code blocks. The grammar says no monospace — slides have no other reason to reach for it. |

## Quick example

```bash
# Under the installed plugin, the script and demo file live under $CLAUDE_PLUGIN_ROOT:
"$CLAUDE_PLUGIN_ROOT/skills/md2slides/scripts/md2slides" \
  "$CLAUDE_PLUGIN_ROOT/playground/demo-deck.md"
# (From a git checkout instead: cd into the repo and run skills/md2slides/scripts/md2slides ...)
```

Renders `playground/demo-deck.md` to `playground/demo-deck.pdf`. The demo
exercises every slide class (title, content, two-column, chart, table,
break, blockquote, closing).
