---
name: gl-docx-retheme
description: Convert an existing Word document to the Growth Lab design system. Use this skill when the user asks to apply the GL theme to a .docx, restyle or retheme a Word document, migrate a legacy report to the new design, or make a Word doc compliant with Nil's typography/data-viz rules. Runs in three parts — document, figures, image cropping — pausing for the author between each.
compatibility: Requires the gl.docx template (skills/md2docx/assets/templates/). Word-comment flagging uses the docx skill's comment machinery when available.
metadata:
  author: taimur-shah
  version: "2.0"
---

# GL docx retheme

Converts an existing Word document to the Growth Lab design system
([`grammar.md`](../../grammar.md), [`recipes/report.md`](../../recipes/report.md),
Nil's specs under [`nil/`](../../docs/nil/)).

## How this works

Three parts, run in order. Each one is delivered and confirmed before the next
begins.

| Part | What it changes | Starts when |
|---|---|---|
| **1 — The document** | Theme, fonts, headings, body text, tables, lists, page geometry. Figures are left exactly as they are. | Straight away |
| **2 — The figures** | Rebuilds each figure into the GL figure block; moves caption and burned-in title text into the document, verbatim. | The author agrees after part 1 |
| **3 — The images** | Crops the title, subtitle, and source bands out of the chart files, working on copies. | The author agrees after part 2 |

Four rules hold across all three:

- **Work on a copy.** The file you were given is never opened for writing.
- **Explain, then do.** Open each part by telling the author what it will
  change and what it will leave alone. Do not start part 2 or part 3 without
  a clear go-ahead.
- **Relocate text; never rewrite it.** Titles, subtitles, and sources move
  between the image and the document word for word.
- **Never deliver a silent conversion.** Every part ships the file *plus* a
  flag list — the content-level problems no tool can fix.

Within a part, the work splits three ways: **mechanical** (the scripts),
**judgment** (you, editing XML), and **flags** (the author).

## Set up the working copy

Before part 1, and before any command touches the document:

```bash
WORK=retheme
mkdir -p "$WORK/original"
cp "Report.docx" "$WORK/original/Report.docx"    # pristine — never edited
```

Everything downstream reads from `$WORK/original/Report.docx` and writes to
`$WORK/Report-gl.docx`. Snapshot the working file at each part boundary
(`Report-gl-part1.docx`, `-part2`, …) so a part can be rolled back without
redoing the ones before it.

Tell the author where both files are before you begin.

---

## Part 1 — the document

Text, type, and structure onto the report spec. Figures keep their current
images, paths, captions, and placement; they are recorded, not touched.

### Brief the author first

> This runs in three parts. Part 1 puts the document itself on the GL report
> spec — fonts, headings, body text, tables, lists, page geometry. Your
> figures stay exactly as they are and I'll note the ones needing attention.
> Part 2 rebuilds the figure blocks and moves titles that are burned into the
> images into the document text, word for word. Part 3 crops those titles out
> of the image files, working on copies. I'll stop after each part and check
> with you.
>
> I'm working on `retheme/Report-gl.docx`; your original is untouched at
> `retheme/original/Report.docx`.

### 1.1 Audit

```bash
python3 scripts/audit.py retheme/original/Report.docx
```

Read the report: which fonts and styles are in use, pseudo-headings,
caption-like paragraphs, source lines, all-caps text, unstyled tables, image
count. This is the work plan, and the figure inventory part 2 will use.

### 1.2 Mechanical transplant

```bash
python3 scripts/retheme.py retheme/original/Report.docx retheme/Report-gl.docx --strip-direct
```

- Replaces theme (fonts + GL palette) and styles with the GL set; target-only
  styles are kept and listed — decide per style whether its paragraphs should
  be remapped to a GL role.
- `--strip-direct` removes run-level font/size/color overrides (bold, italic,
  underline, superscript survive). **Skip it only** if the document relies on
  intentional colored text — then strip selectively by hand in 1.3.
- `--keep-margins` if the document must keep its page geometry.

### 1.3 Judgment remaps (unpack → Edit → pack)

Unpack `Report-gl.docx` (the docx skill's `unpack.py`/`pack.py`) and work
through the audit findings in `word/document.xml`:

| Finding | Remap to |
|---------|----------|
| Bold/large paragraph posing as a heading | `<w:pStyle w:val="Heading1/2/3"/>`; strip leftover bold runs; sentence case, no trailing period |
| Caption typed below a table | `TableCaption` paragraph *above* the table, `Table N:` as a `SEQ Table` field |
| Hand-formatted table | `<w:tblStyle w:val="Table"/>`, delete direct `tblBorders`/`shd`, ensure `<w:tblLook w:firstRow="1" …/>`; numeric columns right-aligned; cell paragraphs → `Compact` |
| All-caps heading/body text | Sentence case (uppercase is reserved for eyebrow/label chrome, which the styles produce via `w:caps`) |
| Manually typed table numbers | `SEQ Table` fields |
| Lists with literal "•" characters | Real list paragraphs (`numPr` / `ListParagraph`) |

Leave figure captions, figure numbers, and figure source lines alone — they
are part 2's work, and restyling them now makes that pass harder to review.

### 1.4 Flag what only the author can fix

Insert Word comments (docx skill: `scripts/comment.py`, author "Claude") at
each spot; if comments are impractical, write `Report-gl-retheme-notes.md`
instead. Flag against this checklist:

- **Heading periods and case** — no trailing periods, sentence case.
- **Cover page** — the GL cover (cover paper, hairline, accent rule, pattern
  artwork) is HTML/PDF-first and cannot be reproduced mechanically; flag for
  rebuild from the starter template (`templates/gl.dotx`) if the document
  needs one.
- **Monospace anywhere** outside genuine code blocks.
- **Colored text** that is not a GL role (accent is for eyebrows, labels,
  dates).
- **TOC** — re-insert via References → Table of Contents if the old one was
  hand-typed; fields need updating (Ctrl+A, F9) either way.
- **Text boxes and embedded OLE objects** — not restyled; list them.

Figure-level problems belong in part 2's flag list, not here.

### 1.5 Validate and hand over

```bash
python3 <docx-skill>/scripts/office/validate.py retheme/Report-gl.docx
python3 scripts/audit.py retheme/Report-gl.docx   # legacy fonts/colors should be gone
cp retheme/Report-gl.docx retheme/Report-gl-part1.docx
```

A PDF conversion is a useful visual spot-check, with the LibreOffice caveats
in mind (side-by-side figures stack, fields show cached values); real Word is
the reference.

Deliver the file and the flag list, with a short summary of what changed
mechanically versus what needs the author.

### Signal, then ask

Say what part 1 did, what state the figures are in, and what part 2 would do:

> Part 1 is done — the document is on the GL spec. The figures are untouched:
> N of them, of which M have a title burned into the image and K have no
> source line. Part 2 would rebuild each figure into the GL block (label,
> title, subtitle, image, source) and move that text into the document
> verbatim. Want me to go ahead?

Stop here until they answer.

---

## Part 2 — the figures

More involved than part 1, and reviewed figure by figure.

### Brief the author first

> Part 2 is the figures. For each of the N figures I'll build the GL figure
> block — label, title, subtitle, image, source — and move the caption text
> into it. Where a title, subtitle, or source is burned into the image, I'll
> transcribe it into the document verbatim: no rewording, even where the
> wording does not match the GL convention. I'll flag those instead so you can
> decide. Afterwards the images will still have their titles inside them, so
> the text shows twice — cropping is part 3.

### 2.1 The figure block

Five paragraphs, in order. The styles carry uppercase, keep-together, and
spacing:

```xml
<w:p><w:pPr><w:pStyle w:val="FigureLabel"/></w:pPr>
  <w:r><w:t xml:space="preserve">Figure </w:t></w:r>
  <w:r><w:fldChar w:fldCharType="begin"/></w:r>
  <w:r><w:instrText xml:space="preserve"> SEQ Figure \* ARABIC </w:instrText></w:r>
  <w:r><w:fldChar w:fldCharType="separate"/></w:r>
  <w:r><w:t>1</w:t></w:r>
  <w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="FigureTitle"/></w:pPr>…title…</w:p>
<w:p><w:pPr><w:pStyle w:val="FigureSubtitle"/></w:pPr>…units/period (optional)…</w:p>
<w:p><w:pPr><w:pStyle w:val="FigureImage"/></w:pPr>…the existing w:drawing run…</w:p>
<w:p><w:pPr><w:pStyle w:val="FigureSource"/></w:pPr>…Source: … (required)…</w:p>
```

| Finding | Remap to |
|---------|----------|
| "Figure N: Title text" plain paragraph | The block above; number → `SEQ Figure` field, remainder → `FigureTitle` |
| "Source: …" / "Note: …" line near a figure | `FigureSource`, moved below the image |
| Manually typed figure numbers | `SEQ Figure` fields |
| Title, subtitle, or source burned into the image | Transcribe into the block — see 2.2 |

### 2.2 Extract the text verbatim

Where a chart carries its title, subtitle, or source inside the PNG, that text
moves into the figure block as document text. **Copy it verbatim** — same
words, same capitalization, same numbers, same punctuation. No rewriting to
fit the finding-plus-period convention, no tightening, no correcting what
looks like a typo, no supplying a subtitle the author did not write. The same
holds for a caption split at the colon: the remainder becomes the title
unchanged.

If the wording does not meet the GL convention, transcribe it as-is and flag
it, so the author sees what they wrote next to what the spec asks for. A
retheme relocates the author's words; it does not edit them.

Where a figure genuinely has no subtitle or no source, leave the paragraph out
and flag the gap rather than inventing text.

### 2.3 Flag what the author decides

- **Charts that predate the spec** — wrong palette, monospace axis text, old
  fonts. Note them; regenerating with `gl-ggplot` (`theme_gl()`) needs the
  underlying data and is separate work, not part of this pass.
- **Titles that do not state a finding** — the convention is a finding ending
  in a period ("Exports stagnated after 2014.", not "Export trends"). Flag as
  a note to the author, never as an edit.
- **Missing source lines** — every figure requires one.
- **Duplicated text** — every figure whose image still contains a title,
  subtitle, or source now also in the document. This list is part 3's input.

### 2.4 Validate and hand over

```bash
python3 <docx-skill>/scripts/office/validate.py retheme/Report-gl.docx
cp retheme/Report-gl.docx retheme/Report-gl-part2.docx
```

### Signal, then ask

> Part 2 is done — N figures are on the GL block. M of them still carry their
> title, subtitle, or source inside the image as well as in the document, so
> that text reads twice. Part 3 would crop those bands off, leaving the chart
> itself — plot area, axes, axis labels, legend. I'd copy the image files to
> `figures-cropped/` and crop the copies — your originals stay as they are —
> then repoint the document at the copies. Want me to?

Stop here until they answer.

---

## Part 3 — crop the images

Only the figures listed at 2.3 as carrying duplicated text.

Part 2 moved the title, subtitle, and source into the document. Those elements
are still inside the PNG, so each now reads twice. Part 3 takes them out of
the image.

### Brief the author first

> Part 3 crops the M images listed below. Their title, subtitle, and source
> are now in the document text, so they read twice — I'll take those bands off
> the image and leave the chart itself: plot area, axes, axis labels, legend.
> I'll copy the files to `figures-cropped/` and crop the copies; your original
> image files are not modified. Then I'll repoint the document at the copies,
> so if a crop looks wrong you can point it back at the original.

### 3.1 What comes off, what stays

Remove exactly what part 2 transcribed into the figure block:

- the **title** band across the top of the image
- the **subtitle** band beneath it
- the **source** or **note** line along the bottom

What remains is the graph itself — plot area, axes, axis titles, tick labels,
legend, and any in-chart annotation or direct label. Those are part of the
graphic rather than caption text, and stay in the image.

Crop only the elements that were actually transcribed. If a figure's source
was already a separate document paragraph and only its title came out of the
image, take the title band and leave the bottom of the image alone.

### 3.2 Rules

- **Never modify an original image**, in place or otherwise.
- Copy into a new sibling folder — `figures-cropped/` alongside the originals
  — keeping the original filenames.
- Crop only the copies, and only the bands listed in 3.1. Do not re-scale,
  re-encode at lower quality, or trim plot content.
- Repoint the document's image relationships at the copies. The originals stay
  untouched and still on disk, so any crop is reversible.

### 3.3 Deliver

Show the before/after for each cropped figure, or convert to PDF for a visual
pass. Note any figure where the crop was left undone because the title sat
inside the plot area rather than in a band above it — those need regeneration,
not cropping.

```bash
python3 <docx-skill>/scripts/office/validate.py retheme/Report-gl.docx
cp retheme/Report-gl.docx retheme/Report-gl-part3.docx
```

Close with the consolidated flag list from all three parts: what changed
mechanically, and what still needs the author.

## Known limits

- Sizes are the Word approximation (1px→1pt; body 12pt) — see
  `docs/followups.md` §10 for all Word-fidelity limits.
- `--strip-direct` removes *all* direct font/size/color, including intentional
  ones; audit first.
- Embedded OLE objects (Excel charts) and text boxes are not restyled — flag
  them.
- Headers/footers are left as-is; replacing them with the GL running head
  (logo right) is manual — copy from `templates/gl.docx` if wanted.
- Cropping cannot rescue a chart whose title sits inside the plot area, or
  whose palette is wrong. Those need regeneration from source data.
