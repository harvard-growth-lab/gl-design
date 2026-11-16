---
name: gl-docx-retheme
description: Convert an existing Word document to the Growth Lab design system. Use this skill when the user asks to apply the GL theme to a .docx, restyle or retheme a Word document, migrate a legacy report to the new design, or make a Word doc compliant with Nil's typography/data-viz rules. Runs in three parts — document, figures, image cropping — pausing for the author between each.
compatibility: Requires the gl.docx template (skills/md2docx/assets/templates/, built by build_gl_template.py), lxml, PyMuPDF and Pillow; md2pdf's headless Chromium renders the cover artwork in colour. Inter and Source Serif 4 must be installed for Word to show them. Word-comment flagging uses the docx skill's comment machinery when available.
metadata:
  author: taimur-shah
  version: "2.1"
---

# GL docx retheme

Converts an existing Word document to the Growth Lab design system
([`grammar.md`](../../grammar.md), [`recipes/report.md`](../../recipes/report.md),
Nil's specs under [`nil/`](../../docs/nil/)).

**The Word copy follows the same report spec as the md2pdf PDF:**
- **Theme:** the `gl` theme prints Nil's type scale with her px numbers as points (decided 2026-11-16): body 12pt, H1 34pt, H2 20pt, display 56pt, footnotes and page chrome 9pt. md2pdf prints the same sizes. (`gl-print`, the older 0.75pt-per-px reading, is still built for anyone who passes `--template`.)
- **Cover:** the GL cover is rebuilt, with the cover paper, the meta row with the GL and partner logos, the display title, the 50% accent rule, the byline, the note and the pattern artwork.
- **Page chrome:** a running head and a folio are added.

A rethemed page should match the md2pdf page. The exceptions are under *Known limits*.

**On Windows:**
- `python3` is often the Microsoft Store stub, so run the scripts with `py -3` or `python`.
- The `unpack.py` / `pack.py` / `validate.py` / `comment.py` helpers named below belong to the docx skill (`anthropic-skills:docx`). Load it to get their paths.

**Fonts:** Word needs Inter and Source Serif 4 installed. Without them it silently substitutes Cambria at the right sizes, which is easy to miss. Check before any visual review: `[System.Drawing.Text.InstalledFontCollection]` should list both families. If they're missing, generate static Regular, Italic, Bold and Bold Italic instances with `py -3 scripts/make_word_fonts.py <gl-design>/assets/fonts <out-dir>` (Bold is instanced at weight 600, the recipe's heaviest), then install the nine files for the current user. The ninth, "Source Serif 4 Display" (opsz 60), is the cut the cover title is set in, as in the PDF; the text cut is 9% wider and wraps 56pt titles a line early. `gl_pages.py` measures titles with the copy bundled in `assets/fonts/`. Word does not handle the variable fonts reliably.

## How this works

Three parts, run in order. Each one is delivered and confirmed before the next
begins.

| Part | What it changes | Starts when |
|---|---|---|
| **1 — The document** | Theme, fonts, headings, body text, tables, lists, page geometry, the GL cover and the page chrome. Figures are left exactly as they are. | Straight away |
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
> spec — fonts, headings, body text, tables, lists, page geometry — at the
> same print sizes as the GL PDF, and rebuilds the cover in the GL layout from
> your cover's own text and logos. Your
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
py -3 scripts/audit.py retheme/original/Report.docx
```

Read the report: which fonts and styles are in use, pseudo-headings,
caption-like paragraphs, source lines, all-caps text, unstyled tables, image
count. This is the work plan, and the figure inventory part 2 will use.

### 1.2 Mechanical transplant

```bash
py -3 scripts/retheme.py retheme/original/Report.docx retheme/Report-gl.docx --strip-direct
```

- Replaces theme (fonts + GL palette) and styles with the GL set from
  `gl.docx` (Nil's numbers as points); target-only styles are kept and listed.
  Decide per style whether its paragraphs should be remapped to a GL role.
  `--template <md2docx>/assets/templates/gl.docx` gives the larger 1px→1pt
  editing sizes instead; use it only if the author asks for a big-type
  working copy.
- Turns on font embedding (`embedTrueTypeFonts`, subsetted). Word embeds the
  GL fonts the next time the file is saved on a machine that has them, so
  readers without Inter or Source Serif 4 still see them.
- `--strip-direct` removes run-level font/size/color overrides (bold, italic,
  underline, superscript survive). It also removes the original's
  proportional line spacing (Word's "1.15", "Multiple 1.5", …; exact and
  at-least spacing stays) so the GL leading shows through, and clears the
  font/size/color on list and heading numbers in `numbering.xml` (a Georgia
  18pt "1." in front of a 34pt H1), keeping bullet symbol fonts.
  **Skip it only** if the document relies on intentional colored text — then
  strip selectively by hand in 1.3.
- Leading matches the PDF. The template states leading CSS-style, divided by
  each family's own line height (Inter 1.21em, Source Serif 4 1.371em),
  because Word's "auto" spacing multiplies the font's line height, not its
  size. Body prints 12pt on 19.2pt in both. Don't "fix" a style's `w:line`
  back to `line-height × 240`.
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

### 1.4 Cover and page chrome

`scripts/gl_pages.py` replaces the original cover with the recipe's cover
(the same layout md2pdf prints) and adds the running head and folio:

```bash
py -3 scripts/gl_pages.py list  retheme/Report-gl.docx          # number the first body blocks
py -3 scripts/gl_pages.py build retheme/Report-gl.docx retheme/Report-gl.docx \
      --spec retheme/cover/cover.json --drop N --running-head "Short report title"
```

1. **Find the original cover.** `list` numbers the first body blocks and
   flags section breaks, page breaks and pictures. The cover is usually
   everything before the first heading, acknowledgements or TOC. `--drop N`
   removes those N blocks.
2. **Write `cover.json` from the original cover, verbatim.** Copy the title
   (`\n` where the original breaks the line), subtitle, author line(s), date,
   and any partnership / disclaimer / affiliation text (as `note`, one string
   per paragraph) exactly as written. Use `series` for a status or series line
   the original shows (e.g. "Draft for comments"); never invent one.
3. **Logos.** The GL logo is added automatically. Extract partner logos (e.g.
   the ECU / UM6P mark) from the original's `word/media/` into
   `retheme/cover/` and list them under `partner_logos` with alt text. Do
   not re-add the GL logo from the original, and do not add a partner logo
   the original does not carry.
4. **Pattern.** `"pattern": "report"` (circle, full reports) or
   `"working-paper"` (rect). The script sizes the artwork into the space the
   text leaves and omits it when under ~1.25in remains, as md2pdf does; say
   so in the notes when it does.
5. **Running head.** A short form of the title, which the style sets in
   uppercase. The cover gets its own section with no running head or folio;
   every later section gets the GL running head (text left, GL logo right,
   hairline below) and a page-number folio bottom right.
6. **Check the cover.** Export page 1 through Word (below) and compare it with
   the original cover for content and with the md2pdf cover for layout.

When a report also has a GL PDF, use the same values in `cover.json` as the
PDF's frontmatter, so both covers say the same thing.

**Table of contents.** After the cover, run `scripts/gl_toc.py`. It gives
every report the same TOC as md2pdf's `toc: true` (Nil §9):

```bash
py -3 scripts/gl_toc.py retheme/Report-gl.docx retheme/Report-gl.docx --update
```

- **Replaces** the original TOC (field or content control, and its title).
- **Placement:** "Contents" on its own page right after the cover (after a
  colophon page if there is one), in a section with no running head or folio.
- **Depth:** Heading 1 and 2. Executive Summary sub-headings move to
  "Heading 2 (not in contents)"; `--keep-exec-subheads` lists them.
- **Page numbers:** one count from the cover, as in the PDF; restarts are
  removed.
- **Numbered headings:** auto-numbered headings get a space after the number,
  not a tab.
- **`--update`** has Word fill in the field and set the page numbers in
  Inter 11pt. Then export the PDF and check that every TOC number matches the
  printed folio.
- **Run once per file.** It removes the TOC it finds, so a second run on its
  own output stacks section breaks. Re-run it from the pre-TOC copy instead.
- **Word re-saves the file** and renames its media (`imageN.png`). Scripts
  that find pictures by file name must use the figure id instead.

### 1.5 Flag what only the author can fix

Insert Word comments (docx skill: `scripts/comment.py`, author "Claude") at
each spot; if comments are impractical, write `Report-gl-retheme-notes.md`
instead. Flag against this checklist:

- **Heading periods and case** — no trailing periods, sentence case.
- **Cover content** — only where the original cover is ambiguous (which line
  is the subtitle, whether a line is a series name) or carries something the
  GL cover has no slot for (a photo, a third logo row). Say what you chose.
- **Page numbering** — `gl_toc.py` makes it one count from the cover, as the
  PDF does; note it if the original restarted or used roman numerals.
- **Monospace anywhere** outside genuine code blocks.
- **Colored text** that is not a GL role (accent is for eyebrows, labels,
  dates).
- **TOC** — `gl_toc.py` replaces it (1.4). Flag only a hand-typed TOC the
  script could not find (plain paragraphs, no field), and delete it.
- **Text boxes and embedded OLE objects** — not restyled; list them.

Figure-level problems belong in part 2's flag list, not here.

### 1.6 Validate and hand over

```bash
py -3 <docx-skill>/scripts/office/validate.py retheme/Report-gl.docx
py -3 scripts/audit.py retheme/Report-gl.docx   # legacy fonts/colors should be gone
cp retheme/Report-gl.docx retheme/Report-gl-part1.docx
```

**Visual check through real Word.** Export to PDF and look at the cover and a
body page. Confirm the fonts in the PDF are Inter / Source Serif 4, not
Cambria, that body text is 12pt, and that body lines step about 19.2pt. If
the export comes out in Cambria although the fonts are installed per user,
Word has lost them: re-register them (AddFontResourceW on each
`%LOCALAPPDATA%\Microsoft\Windows\Fonts\*GL-*.ttf`, then broadcast
WM_FONTCHANGE) and export again; installing them for all users avoids it. On
Windows:

```powershell
$w = New-Object -ComObject Word.Application
try { $w.Visible = $false; $w.DisplayAlerts = 0
      $d = $w.Documents.Open("<abs>\Report-gl.docx", $false, $true)
      $d.SaveAs2("<abs>\Report-gl-check.pdf", 17); $d.Close(0) }
finally { try { $w.Quit() } catch {}
          [void][Runtime.InteropServices.Marshal]::ReleaseComObject($w) }
```

Use `SaveAs2(path, 17)`, not `ExportAsFixedFormat`: the latter crashed Word
(`RPC_E_DISCONNECTED`) on three of the six Morocco reports, while `SaveAs2`
exported all of them. `Quit()` with no argument. `Quit(0)` throws in
PowerShell, which leaves a hidden Word process holding the file open; one
Word instance per file keeps a crash from taking the next file with it. LibreOffice is a weaker fallback:
side-by-side figures stack, and fields show cached values.

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
py -3 <docx-skill>/scripts/office/validate.py retheme/Report-gl.docx
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
py -3 <docx-skill>/scripts/office/validate.py retheme/Report-gl.docx
cp retheme/Report-gl.docx retheme/Report-gl-part3.docx
```

Close with the consolidated flag list from all three parts: what changed
mechanically, and what still needs the author.

## Known limits

Compared with the md2pdf PDF:

- **Weights** — Word's bold is on/off. Install the fonts with Bold instanced at
  600 and every bold role (H1/H2 at 500, H3/labels/table headers at 600)
  renders at 600: one step heavy for H1/H2, exact for the rest.
- **Optical sizing** — the static Source Serif 4 has one optical size, so the
  42pt display title sets a little wider than the PDF's opsz-60 cut and may
  wrap one word earlier.
- **Colophon page** — not built (md2pdf does not build one either).
- **Page numbering** — kept as the original has it (restarts, roman front
  matter); the PDF numbers straight through.
- **Fonts** — Word must have Inter and Source Serif 4 installed; otherwise it
  substitutes Cambria. Embedding is switched on, but only takes effect when
  the file is saved in Word on a machine that has the fonts.

Process limits:

- `--strip-direct` removes *all* direct font/size/color, including intentional
  ones; audit first.
- Embedded OLE objects (Excel charts) and text boxes are not restyled — flag
  them.
- `gl_pages.py` replaces the running head and folio in every section after the
  cover; the original headers/footers stay in the package, unreferenced.
- The cover's text height is estimated to fit the artwork; check page 1 in
  Word. If the artwork touches the note, rebuild with `"pattern": "none"`.
- Cropping cannot rescue a chart whose title sits inside the plot area, or
  whose palette is wrong. Those need regeneration from source data.
