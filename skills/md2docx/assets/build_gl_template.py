#!/usr/bin/env python3
"""
build_gl_template.py

Builds the Growth Lab pandoc reference document (templates/gl.docx) from the
md2docx base template (template.docx), applying the Nil design system:
grammar.md tokens + recipes/report.md sizes.

  - Theme: ink ramp + accent + c-1..c-6 categorical palette;
    Source Serif 4 (major) / Inter (minor)
  - Styles: every pandoc-emitted style restyled to the Nil role hierarchy,
    including the five-element figure block (Figure Label / Figure Title /
    Figure Subtitle / Figure Image / Figure Source, kept together)
  - Tables: ink top/bottom rules, `rule` (#DDDDDD) row dividers,
    bold ink header row
  - Page setup: 1" top/left/right, 1.25" bottom -> 6.5 x 8.75" live area
  - Tabular numerals document-wide via w14:numSpacing

Unit note: the canonical report is the HTML->PDF path, authored in Nil's px.
Word is pt-native; this template maps 1px -> 1pt (body 12pt, H1 34pt), which
keeps the .docx comfortably editable but renders ~33% larger than the PDF
(where 12px = 9pt physical). Deliberate, user-decided 2026-06: Word is a
secondary, editable output, not the source of truth.

Weight note: Word's <w:b/> is boolean. Roles Nil specifies at weight 500/600
render bold (typically 700). Hierarchy is carried by size; known compromise.

Usage:
    python3 build_gl_template.py
"""

import os
import re
import shutil
import sys
import zipfile

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(SCRIPT_DIR, "template.docx")
OUTPUT = os.path.join(SCRIPT_DIR, "templates", "gl.docx")

# ---------------------------------------------------------------------------
# Design tokens (grammar.md)
# ---------------------------------------------------------------------------

INK = "1A1714"
INK2 = "2C2823"
INK3 = "4F4A42"
ACCENT = "1A5A8E"      # = c-1-dark
RULE = "DDDDDD"
PAPER_WARM = "F4F1EA"

# Categorical main tones, in palette order
C1, C2, C3, C4, C5, C6 = "2F87C8", "CC4948", "2AA584", "7554A3", "EA822D", "CDC86B"

SERIF = "Source Serif 4"
# Cover-title cut: Source Serif 4 at opsz 60, as Nil sets the display (md2pdf
# gets it from the variable font). Static instance from gl-docx-retheme's
# make_word_fonts.py; the text cut is 9% wider and wraps 56pt titles early.
SERIF_DISPLAY = "Source Serif 4 Display"
SANS = "Inter"

# Text width of the template page (US Letter, 1in margins) in twips: where TOC
# page numbers sit (right tab). gl_toc.py recomputes it from each document.
LIVE_TW = 9360

# Leading. The style table states leading the CSS way (w:line = line-height
# x 240, e.g. body 1.6 -> 384). Word's "auto" spacing is a multiple of the
# font's own line height (OS/2 win ascent + descent), not of the font size,
# so those values print 21% (Inter) / 37% (Source Serif 4) looser than the
# PDF. word_line() divides by each family's line height so Word's baseline
# step equals the CSS one (body 9pt x 1.6 = 14.4pt in both).
LINE_RATIO = {SANS: 1.21, SERIF: 1.371, SERIF_DISPLAY: 1.371}
BODY_LINE = 384  # 1.6, the recipe's body leading


def word_line(css_line, font=SANS):
    return round(css_line / LINE_RATIO.get(font, LINE_RATIO[SANS]))

# Office theme slots. accent1-6 feed Word's color picker and chart defaults,
# so they carry the chart palette; dk/lt carry ink and paper.
GL_THEME_COLORS = {
    "dk1": INK,
    "lt1": "FFFFFF",
    "dk2": INK2,
    "lt2": PAPER_WARM,
    "accent1": C1,
    "accent2": C2,
    "accent3": C3,
    "accent4": C4,
    "accent5": C5,
    "accent6": C6,
    "hlink": ACCENT,
    "folHlink": INK3,
}

# ---------------------------------------------------------------------------
# Style table — recipes/report.md role hierarchy at 1px->1pt
#
# Keys per style:
#   font, sz (half-points), color, bold, italic, caps,
#   tracking (w:spacing run prop, 1/20 pt),
#   before/after (twips), line (w:line, 240 = single),
#   keep_next, jc, outline (w:outlineLvl), ind_left/ind_right (twips),
#   border_bottom (sz_eighths, color, space_pt),
#   rpr_only (True = leave the style's pPr untouched — tab stops, indents),
#   prio (w:uiPriority — clusters related styles in the Styles pane),
#   gallery (True = w:qFormat, shown in the ribbon Quick Style gallery;
#            False = strip qFormat — plumbing styles stay out of the gallery;
#            omit both keys to leave a style's visibility metadata untouched)
# ---------------------------------------------------------------------------

S_BASE = {
    # Body. docDefaults already carry Inter 12pt ink-2, justified, 1.6 leading;
    # restated here so the named style survives docDefault edits.
    "Normal": dict(font=SANS, sz=24, color=INK2, after=120,
                   prio=1, gallery=True),

    # Cover roles (pandoc emits these from YAML metadata).
    # Title carries the 3pt accent title rule as a bottom border — Word can't
    # do Nil's 50%-width rule, so it runs full column width (approximation).
    "Title": dict(font=SERIF_DISPLAY, sz=112, color=INK, tracking=-28, after=240,
                  line=288, jc="left", border_bottom=(24, ACCENT, 16),
                  prio=10, gallery=True),
    "Subtitle": dict(font=SERIF, sz=34, color=INK2, after=240, line=336,
                     jc="left", prio=11, gallery=True),
    "Author": dict(font=SERIF, sz=28, color=INK, after=60, jc="left",
                   prio=12, gallery=True),
    "Date": dict(font=SANS, sz=22, color=ACCENT, bold=True, caps=True,
                 tracking=40, after=480, jc="left", prio=13, gallery=True),
    # Cover meta and note (recipes/report.md "Cover meta"), used by the
    # retheme cover builder: series eyebrow (Inter 11px 600 ink-3 UPPER,
    # 0.18em) and the partnership / disclaimer note (serif italic 11px ink-3).
    "CoverSeries": dict(font=SANS, sz=22, color=INK3, bold=True, caps=True,
                        tracking=40, after=80, line=240, jc="left",
                        prio=14, gallery=False),
    "CoverNote": dict(font=SERIF, sz=22, color=INK3, italic=True,
                      before=480, after=80, line=360, jc="left",
                      prio=15, gallery=False),

    # Section headings (H3 is the recipe extension; H4-6 mild fallbacks).
    "Heading1": dict(font=SERIF, sz=68, color=INK, bold=True, tracking=-12,
                     before=480, after=160, line=259, keep_next=True,
                     page_before=True,  # each section starts a page, as md2pdf
                     jc="left", outline=0, prio=9, gallery=True),
    "Heading2": dict(font=SERIF, sz=40, color=INK, bold=True, tracking=-4,
                     before=560, after=160, line=288, keep_next=True,
                     jc="left", outline=1, prio=9, gallery=True),
    "Heading3": dict(font=SERIF, sz=32, color=INK, bold=True,
                     before=280, after=160, line=312, keep_next=True,
                     jc="left", outline=2, prio=9, gallery=True),
    "Heading4": dict(font=SANS, sz=24, color=INK3, bold=True,
                     before=240, after=120, keep_next=True, jc="left",
                     outline=3, prio=9, gallery=False),
    "Heading5": dict(font=SANS, sz=24, color=INK3,
                     before=240, after=120, keep_next=True, jc="left",
                     outline=4, prio=9, gallery=False),
    "Heading6": dict(font=SANS, sz=24, color=INK3, italic=True,
                     before=240, after=120, keep_next=True, jc="left",
                     outline=5, prio=9, gallery=False),
    "Heading7": dict(font=SANS, sz=24, color=INK3, italic=True, rpr_only=True),
    "Heading8": dict(font=SANS, sz=24, color=INK3, rpr_only=True),
    "Heading9": dict(font=SANS, sz=24, color=INK3, rpr_only=True),

    # Quotes — blockquote is serif italic (not a Nil element; GL extension).
    "Quote": dict(font=SERIF, sz=28, color=INK2, italic=True,
                  before=120, after=120, ind_left=360, ind_right=360,
                  jc="left"),
    "IntenseQuote": dict(font=SERIF, sz=34, color=ACCENT,
                         before=120, after=120, ind_left=360, ind_right=360,
                         jc="left"),

    # Figure block (recipes/report.md §5) — five elements, kept together.
    # prio 20-25 clusters them in the Styles pane, in block order.
    "FigureLabel": dict(font=SANS, sz=24, color=ACCENT, bold=True, caps=True,
                        tracking=34, before=240, after=40, line=240,
                        keep_next=True, jc="left", prio=20, gallery=True),
    "FigureTitle": dict(font=SERIF, sz=28, color=INK, bold=True,
                        after=60, line=300, keep_next=True, jc="left",
                        prio=21, gallery=True),
    "FigureSubtitle": dict(font=SANS, sz=24, color=INK3,
                           after=120, line=336, keep_next=True, jc="left",
                           prio=22, gallery=True),
    "FigureImage": dict(after=60, keep_next=True, jc="left",
                        prio=23, gallery=True),
    "FigureSource": dict(font=SERIF, sz=24, color=INK2, italic=True,
                         after=120, line=348, jc="left",
                         prio=24, gallery=True),
    "Source": dict(font=SERIF, sz=24, color=INK2, italic=True,
                   after=120, line=348, jc="left", prio=24, gallery=False),
    "Caption": dict(font=SERIF, sz=24, color=INK2, italic=True,
                    before=60, after=120, line=348, jc="left",
                    prio=35, gallery=True),

    # Page chrome. Header/Footer keep their pPr (tab stops position the
    # folio); running-head text renders uppercase with 0.16em tracking.
    "Header": dict(font=SANS, sz=18, color=INK3, caps=True, tracking=29,
                   rpr_only=True),
    "Footer": dict(font=SANS, sz=18, color=INK3, rpr_only=True),
    "FootnoteText": dict(font=SANS, sz=18, color=INK3, after=60, line=360,
                         jc="left"),
    # Footnote anchor: serif italic accent (grammar role hierarchy).
    "FootnoteReference": dict(font=SERIF, color=ACCENT, italic=True,
                              rpr_only=True),

    # TOC (Nil §9; the same standard as md2pdf and gl-docx-retheme's
    # gl_toc.py): title = Heading 1 look on its own page; major entry serif
    # 14 600 ink with a 1pt ink rule above (top + between, so consecutive
    # majors each get one); sub-entry Inter 12 ink-2 at an 18pt indent;
    # sub-sub italic ink-3 at 36pt. Page numbers on a right tab at the text
    # width, no dot leaders.
    "TOCHeading": dict(font=SERIF, sz=68, color=INK, bold=True, tracking=-12,
                       before=0, after=480, line=259, jc="left", outline=9,
                       page_before=True),
    "TOC1": dict(font=SERIF, sz=28, color=INK, bold=True, keep_next=True,
                 rule_above=(8, INK, 6), tab_right=LIVE_TW, before=200,
                 after=100, line=312, jc="left"),
    "TOC2": dict(font=SANS, sz=24, color=INK2, tab_right=LIVE_TW, before=40,
                 after=40, line=324, ind_left=360, jc="left"),
    "TOC3": dict(font=SANS, sz=24, color=INK3, italic=True, tab_right=LIVE_TW,
                 before=40, after=40, line=324, ind_left=720, jc="left"),
    "TOC4": dict(font=SANS, sz=24, color=INK3, italic=True, tab_right=LIVE_TW,
                 before=40, after=40, line=324, ind_left=1080, jc="left"),

    # Character styles / inline roles.
    "Strong": dict(color=INK, bold=True, rpr_only=True),
    "Emphasis": dict(italic=True, rpr_only=True),
    "IntenseEmphasis": dict(font=SANS, color=ACCENT, italic=True,
                            rpr_only=True),
    "IntenseReference": dict(font=SANS, color=ACCENT, bold=True,
                             rpr_only=True),
    "Hyperlink": dict(color=ACCENT, rpr_only=True),
    "Mention": dict(color=ACCENT, rpr_only=True),
    "UnresolvedMention": dict(color=INK3, rpr_only=True),

    # Styles pandoc's docx writer emits but the base template never defined —
    # without them Word silently falls back to Normal (justified, 6pt-after
    # paragraphs inside table cells, unstyled references).
    # gallery=False keeps this plumbing out of the ribbon gallery — manual
    # users should reach for Normal and the figure block, not these.
    "BodyText": dict(font=SANS, sz=24, color=INK2, after=120,
                     prio=80, gallery=False),
    "FirstParagraph": dict(font=SANS, sz=24, color=INK2, after=120,
                           prio=80, gallery=False),
    # Table cells: tighter leading, ragged right (numerals right-align via
    # the cell-level jc pandoc writes).
    "Compact": dict(font=SANS, sz=24, color=INK2, after=40, line=348,
                    jc="left", prio=80, gallery=False),
    # References (recipes/report.md): Inter 10pt, hanging indent, 8pt between
    # entries. (Reference titles stay italic Inter — the serif-italic title
    # treatment needs a run style pandoc doesn't emit; known approximation.)
    # Zotero's Word plugin applies this style automatically.
    "Bibliography": dict(font=SANS, sz=20, color=INK2, after=160, line=372,
                         ind_left=360, ind_hanging=360, jc="left",
                         prio=37, gallery=False),
    # Caption pandoc places above a table ("Table N: ...").
    "TableCaption": dict(font=SERIF, sz=24, color=INK2, italic=True,
                         after=120, keep_next=True, jc="left",
                         prio=25, gallery=True),
    # Used by the box builder in growthlabbify.lua (no numPr — glyphs come
    # from the list markers pandoc writes, so these just carry indent/face).
    "ListBullet": dict(font=SANS, sz=24, color=INK2, after=60,
                       ind_left=360, jc="left", prio=80, gallery=False),
    "ListNumber": dict(font=SANS, sz=24, color=INK2, after=60,
                       ind_left=360, jc="left", prio=80, gallery=False),
    # Character style on the auto section number inside headings — inherit.
    "SectionNumber": dict(gallery=False),

    # Leftovers from the base template — normalize to the stack.
    "ListParagraph": dict(font=SANS, sz=24, color=INK2, rpr_only=True),
    "NormalWeb": dict(font=SANS, sz=24, color=INK2, rpr_only=True),
    "cf01": dict(font=SANS, sz=24, color=INK2, rpr_only=True),
    "Revision": dict(font=SANS, sz=24, color=INK2, rpr_only=True),
    "CommentText": dict(font=SANS, sz=20, color=INK2, rpr_only=True),
    "CommentSubject": dict(font=SANS, sz=20, color=INK2, rpr_only=True),
}

# Linked "Char" styles mirror the run properties of their paragraph styles.
CHAR_MIRROR = [
    "Title", "Subtitle", "Heading1", "Heading2", "Heading3", "Heading4",
    "Heading5", "Heading6", "Heading7", "Heading8", "Heading9", "Quote",
    "IntenseQuote", "FigureTitle", "Source", "Header", "Footer",
    "FootnoteText", "CommentText", "CommentSubject",
]

# Styles that don't exist in the base template and must be created.
# Names must match what pandoc looks up (it resolves styles by name).
NEW_STYLES = {
    "FigureLabel": ("Figure Label", "paragraph", "Normal"),
    "FigureSubtitle": ("Figure Subtitle", "paragraph", "Normal"),
    "Author": ("Author", "paragraph", "Normal"),
    "Date": ("Date", "paragraph", "Normal"),
    "CoverSeries": ("Cover Series", "paragraph", "Normal"),
    "CoverNote": ("Cover Note", "paragraph", "Normal"),
    "BodyText": ("Body Text", "paragraph", "Normal"),
    "FirstParagraph": ("First Paragraph", "paragraph", "BodyText"),
    "Compact": ("Compact", "paragraph", "BodyText"),
    "Bibliography": ("Bibliography", "paragraph", "Normal"),
    "TableCaption": ("Table Caption", "paragraph", "Normal"),
    "ListBullet": ("List Bullet", "paragraph", "BodyText"),
    "ListNumber": ("List Number", "paragraph", "BodyText"),
    "SectionNumber": ("Section Number", "character", "DefaultParagraphFont"),
}


# ---------------------------------------------------------------------------
# XML generators
# ---------------------------------------------------------------------------

def make_rpr(d):
    """Build a <w:rPr> for a style from its dict (schema element order)."""
    parts = []
    if d.get("font"):
        f = d["font"]
        parts.append(f'<w:rFonts w:ascii="{f}" w:hAnsi="{f}" '
                     f'w:eastAsia="{f}" w:cs="{f}"/>')
    if d.get("bold"):
        parts.append("<w:b/><w:bCs/>")
    if d.get("italic"):
        parts.append("<w:i/><w:iCs/>")
    if d.get("caps"):
        parts.append("<w:caps/>")
    if d.get("color"):
        parts.append(f'<w:color w:val="{d["color"]}"/>')
    if d.get("tracking"):
        parts.append(f'<w:spacing w:val="{d["tracking"]}"/>')
    if d.get("sz"):
        parts.append(f'<w:sz w:val="{d["sz"]}"/><w:szCs w:val="{d["sz"]}"/>')
    return "<w:rPr>" + "".join(parts) + "</w:rPr>"


def make_ppr(d):
    """Build a <w:pPr> for a style from its dict (schema element order)."""
    parts = []
    if d.get("keep_next"):
        parts.append("<w:keepNext/><w:keepLines/>")
    if d.get("page_before"):
        parts.append("<w:pageBreakBefore/>")
    if d.get("border_bottom"):
        sz, color, space = d["border_bottom"]
        parts.append(f'<w:pBdr><w:bottom w:val="single" w:sz="{sz}" '
                     f'w:space="{space}" w:color="{color}"/></w:pBdr>')
    if d.get("rule_above"):
        # top + between: Word draws one top border per run of identical
        # paragraphs, so "between" gives each following paragraph its rule.
        sz, color, space = d["rule_above"]
        rule = f'w:val="single" w:sz="{sz}" w:space="{space}" w:color="{color}"'
        parts.append(f'<w:pBdr><w:top {rule}/><w:between {rule}/></w:pBdr>')
    if d.get("tab_right"):
        parts.append(f'<w:tabs><w:tab w:val="right" w:leader="none" '
                     f'w:pos="{d["tab_right"]}"/></w:tabs>')
    spacing_attrs = []
    if d.get("before") is not None:
        spacing_attrs.append(f'w:before="{d["before"]}"')
    if d.get("after") is not None:
        spacing_attrs.append(f'w:after="{d["after"]}"')
    font = d.get("font") or SANS
    # A serif style with no stated leading would inherit the Inter-corrected
    # body value from docDefaults; restate 1.6 for its own family instead.
    css_line = d.get("line") or (BODY_LINE if font != SANS else None)
    if css_line:
        spacing_attrs.append(
            f'w:line="{word_line(css_line, font)}" w:lineRule="auto"')
    if spacing_attrs:
        parts.append(f'<w:spacing {" ".join(spacing_attrs)}/>')
    if d.get("ind_left") or d.get("ind_right") or d.get("ind_hanging"):
        attrs = []
        if d.get("ind_left"):
            attrs.append(f'w:left="{d["ind_left"]}"')
        if d.get("ind_right"):
            attrs.append(f'w:right="{d["ind_right"]}"')
        if d.get("ind_hanging"):
            attrs.append(f'w:hanging="{d["ind_hanging"]}"')
        parts.append(f'<w:ind {" ".join(attrs)}/>')
    if d.get("jc"):
        parts.append(f'<w:jc w:val="{d["jc"]}"/>')
    if d.get("outline") is not None:
        parts.append(f'<w:outlineLvl w:val="{d["outline"]}"/>')
    return "<w:pPr>" + "".join(parts) + "</w:pPr>"


def make_meta(d):
    """uiPriority + qFormat (Styles-pane ordering / gallery visibility)."""
    parts = []
    if d.get("prio") is not None:
        parts.append(f'<w:uiPriority w:val="{d["prio"]}"/>')
    if d.get("gallery"):
        parts.append("<w:qFormat/>")
    return "".join(parts)


def make_new_style(sid, name, stype, based_on, d):
    """Build a complete new <w:style> block."""
    ppr = make_ppr(d) if stype == "paragraph" and not d.get("rpr_only") else ""
    return (f'<w:style w:type="{stype}" w:styleId="{sid}">'
            f'<w:name w:val="{name}"/>'
            f'<w:basedOn w:val="{based_on}"/>'
            f'{make_meta(d)}'
            f'{ppr}{make_rpr(d)}'
            f'</w:style>')


# ---------------------------------------------------------------------------
# Theme
# ---------------------------------------------------------------------------

def build_theme_xml():
    def color_element(tag, val):
        if tag in ("dk1", "lt1"):
            sys_name = "windowText" if tag == "dk1" else "window"
            return f'<a:{tag}><a:sysClr val="{sys_name}" lastClr="{val}"/></a:{tag}>'
        return f'<a:{tag}><a:srgbClr val="{val}"/></a:{tag}>'

    colors = "".join(color_element(k, v) for k, v in GL_THEME_COLORS.items())

    def font_list(typeface):
        return (f'<a:latin typeface="{typeface}"/>'
                '<a:ea typeface=""/>'
                '<a:cs typeface=""/>'
                '<a:font script="Arab" typeface="Arial"/>'
                '<a:font script="Hebr" typeface="Arial"/>')

    fill_line_effects = (
        '<a:fmtScheme name="Office">'
        '<a:fillStyleLst>'
        + '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' * 3 +
        '</a:fillStyleLst>'
        '<a:lnStyleLst>'
        '<a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>'
        '<a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>'
        '<a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>'
        '</a:lnStyleLst>'
        '<a:effectStyleLst>'
        + '<a:effectStyle><a:effectLst/></a:effectStyle>' * 3 +
        '</a:effectStyleLst>'
        '<a:bgFillStyleLst>'
        + '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' * 3 +
        '</a:bgFillStyleLst>'
        '</a:fmtScheme>'
    )

    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Growth Lab">'
            '<a:themeElements>'
            f'<a:clrScheme name="Growth Lab">{colors}</a:clrScheme>'
            '<a:fontScheme name="Growth Lab">'
            f'<a:majorFont>{font_list(SERIF)}</a:majorFont>'
            f'<a:minorFont>{font_list(SANS)}</a:minorFont>'
            '</a:fontScheme>'
            f'{fill_line_effects}'
            '</a:themeElements>'
            '<a:objectDefaults/>'
            '<a:extraClrSchemeLst/>'
            '</a:theme>')


# ---------------------------------------------------------------------------
# styles.xml transform
# ---------------------------------------------------------------------------

def replace_style_block(content, sid, d, char_variant=False):
    """Wholesale-replace a style's pPr/rPr, keeping its metadata children."""
    pattern = rf'<w:style [^>]*w:styleId="{sid}"[^>]*>.*?</w:style>'
    m = re.search(pattern, content, re.DOTALL)
    if not m:
        return content, False
    block = m.group(0)

    # Strip existing pPr and rPr
    new_block = re.sub(r'<w:pPr>.*?</w:pPr>', '', block, flags=re.DOTALL)
    new_block = re.sub(r'<w:pPr/>', '', new_block)
    new_block = re.sub(r'<w:rPr>.*?</w:rPr>', '', new_block, flags=re.DOTALL)
    new_block = re.sub(r'<w:rPr/>', '', new_block)

    # Visibility metadata — only when the dict opts in, so styles without
    # prio/gallery keys keep their original flags. Schema order puts
    # uiPriority/semiHidden/unhideWhenUsed/qFormat before rsid and pPr/rPr.
    if "prio" in d or "gallery" in d:
        for pat in (r'<w:uiPriority[^>]*/>', r'<w:qFormat[^>]*/>',
                    r'<w:semiHidden[^>]*/>', r'<w:unhideWhenUsed[^>]*/>'):
            new_block = re.sub(pat, '', new_block)
        meta = make_meta(d)
        m_rsid = re.search(r'<w:rsid\b', new_block)
        if m_rsid:
            i = m_rsid.start()
            new_block = new_block[:i] + meta + new_block[i:]
        else:
            new_block = new_block.replace("</w:style>", meta + "</w:style>")

    inject = ""
    if not char_variant and not d.get("rpr_only"):
        inject += make_ppr(d)
    inject += make_rpr(d)
    new_block = new_block.replace("</w:style>", inject + "</w:style>")
    return content[:m.start()] + new_block + content[m.end():], True


def scaled_styles(styles, f):
    """The style table at another px->pt factor. Sizes, spacing, tracking and
    rule weights scale; leading (w:line, proportional) and indents (inches in
    the recipe) do not."""
    if f == 1.0:
        return styles
    out = {}
    for sid, d in styles.items():
        d = dict(d)
        for key in ("sz", "before", "after", "tracking"):
            if d.get(key):
                d[key] = max(1, round(d[key] * f)) if d[key] > 0 \
                    else round(d[key] * f)
        if d.get("border_bottom"):
            sz, color, space = d["border_bottom"]
            d["border_bottom"] = (max(2, round(sz * f)), color,
                                  round(space * f))
        out[sid] = d
    return out


def build_doc_defaults(f=1.0):
    """Inter body ink-2, 1.6 leading, 6px after, justified, tabular numerals."""
    sz = round(24 * f)
    after = round(120 * f)
    return ('<w:docDefaults>'
            '<w:rPrDefault><w:rPr>'
            f'<w:rFonts w:ascii="{SANS}" w:hAnsi="{SANS}" '
            f'w:eastAsia="{SANS}" w:cs="{SANS}"/>'
            f'<w:color w:val="{INK2}"/>'
            # Kern every size (Word's "Kerning for fonts: 1pt and above"):
            # browsers kern by default, so the PDF's line breaks rely on it.
            '<w:kern w:val="2"/>'
            f'<w:sz w:val="{sz}"/><w:szCs w:val="{sz}"/>'
            '<w14:numSpacing w14:val="tabular"/>'
            '</w:rPr></w:rPrDefault>'
            '<w:pPrDefault><w:pPr>'
            f'<w:spacing w:after="{after}" w:line="{word_line(BODY_LINE)}" '
            'w:lineRule="auto"/>'
            '<w:jc w:val="both"/>'
            '</w:pPr></w:pPrDefault>'
            '</w:docDefaults>')


def build_table_style(f=1.0):
    """Nil table: ink top/bottom rules, `rule` row dividers, bold ink header."""
    ink_rule = max(2, round(8 * f))
    thin_rule = max(2, round(4 * f))
    pad_v, pad_r = round(80 * f), round(160 * f)
    return ('<w:style w:type="table" w:styleId="Table">'
            '<w:name w:val="Table"/>'
            '<w:uiPriority w:val="39"/>'
            '<w:qFormat/>'
            # Cell text: CSS td leading 1.45, no paragraph gap, flush left
            # (Normal inherits justified from docDefaults otherwise).
            f'<w:pPr><w:spacing w:after="0" w:line="{word_line(348)}" '
            'w:lineRule="auto"/><w:jc w:val="left"/></w:pPr>'
            '<w:tblPr>'
            '<w:tblBorders>'
            f'<w:top w:val="single" w:sz="{ink_rule}" w:space="0" w:color="{INK}"/>'
            '<w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
            f'<w:bottom w:val="single" w:sz="{ink_rule}" w:space="0" w:color="{INK}"/>'
            '<w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
            f'<w:insideH w:val="single" w:sz="{thin_rule}" w:space="0" w:color="{RULE}"/>'
            '<w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
            '</w:tblBorders>'
            '<w:tblCellMar>'
            f'<w:top w:w="{pad_v}" w:type="dxa"/>'
            '<w:left w:w="0" w:type="dxa"/>'
            f'<w:bottom w:w="{pad_v}" w:type="dxa"/>'
            f'<w:right w:w="{pad_r}" w:type="dxa"/>'
            '</w:tblCellMar>'
            '</w:tblPr>'
            '<w:tblStylePr w:type="firstRow">'
            f'<w:pPr><w:spacing w:line="{word_line(312)}" '
            'w:lineRule="auto"/></w:pPr>'
            f'<w:rPr><w:b/><w:bCs/><w:color w:val="{INK}"/></w:rPr>'
            '<w:tcPr><w:tcBorders>'
            f'<w:bottom w:val="single" w:sz="{ink_rule}" w:space="0" w:color="{INK}"/>'
            '</w:tcBorders></w:tcPr>'
            '</w:tblStylePr>'
            '</w:style>')


NS_DECLS = {
    "w15": "http://schemas.microsoft.com/office/word/2012/wordml",
    "w16se": "http://schemas.microsoft.com/office/word/2015/wordml/symex",
    "w16cid": "http://schemas.microsoft.com/office/word/2016/wordml/cid",
    "w16": "http://schemas.microsoft.com/office/word/2018/wordml",
    "w16cex": "http://schemas.microsoft.com/office/word/2018/wordml/cex",
    "w16sdtdh": "http://schemas.microsoft.com/office/word/2020/wordml/sdtdatahash",
    "w16sdtfl": "http://schemas.microsoft.com/office/word/2024/wordml/sdtformatlock",
    "w16du": "http://schemas.microsoft.com/office/word/2023/wordml/word16du",
}


def fix_root_namespaces(content):
    """Declare every prefix listed in mc:Ignorable (base template omits them)."""
    m = re.search(r'<w:styles [^>]*>', content)
    if not m:
        return content
    root = m.group(0)
    new_root = root
    for prefix, uri in NS_DECLS.items():
        if f"xmlns:{prefix}=" not in root:
            new_root = new_root.replace(
                ' mc:Ignorable=', f' xmlns:{prefix}="{uri}" mc:Ignorable=')
    return content.replace(root, new_root, 1)


def transform_styles_xml(content, f=1.0):
    S = scaled_styles(S_BASE, f)

    # 0. Root namespace hygiene (pre-existing defect in the base template)
    content = fix_root_namespaces(content)

    # 1. docDefaults
    content = re.sub(r'<w:docDefaults>.*?</w:docDefaults>',
                     lambda _m: build_doc_defaults(f), content,
                     flags=re.DOTALL)

    # 2. Named styles — wholesale pPr/rPr replacement
    missing = []
    for sid, d in S.items():
        content, found = replace_style_block(content, sid, d)
        if not found:
            missing.append(sid)

    # 3. Linked Char styles mirror run properties
    for base in CHAR_MIRROR:
        if base in S:
            content, _ = replace_style_block(content, base + "Char", S[base],
                                             char_variant=True)

    # 4. Create styles the base template lacks
    additions = []
    for sid in missing:
        if sid in NEW_STYLES:
            name, stype, based_on = NEW_STYLES[sid]
            additions.append(make_new_style(sid, name, stype, based_on, S[sid]))
        else:
            print(f"  warning: style {sid} not found and not creatable")
    if additions:
        content = content.replace("</w:styles>",
                                  "".join(additions) + "</w:styles>")

    # 5. Replace the pandoc "Table" table style wholesale
    content = re.sub(r'<w:style w:type="table" w:styleId="Table">.*?</w:style>',
                     lambda _m: build_table_style(f), content, flags=re.DOTALL)

    # 6. Sweep remaining legacy fonts/colors in untouched styles
    for legacy in ("Garamond", "Times New Roman", "Segoe UI",
                   "Source Sans 3", "JetBrains Mono"):
        content = content.replace(f'w:ascii="{legacy}"', f'w:ascii="{SANS}"')
        content = content.replace(f'w:hAnsi="{legacy}"', f'w:hAnsi="{SANS}"')
        content = content.replace(f'w:eastAsia="{legacy}"', f'w:eastAsia="{SANS}"')
        content = content.replace(f'w:cs="{legacy}"', f'w:cs="{SANS}"')
    legacy_colors = {"467886": ACCENT, "0F4761": ACCENT, "2B579A": ACCENT,
                     "272727": INK3, "595959": INK3, "605E5C": INK3,
                     "266798": ACCENT, "015C9C": ACCENT,
                     "333333": INK2, "7c7c7c": INK3, "6B645A": INK3}
    for old, new in legacy_colors.items():
        content = content.replace(f'w:val="{old}"', f'w:val="{new}"')

    return content


# ---------------------------------------------------------------------------
# document.xml — page geometry + starter body
#
# pandoc ignores the reference doc's body, so it is free real estate for the
# manual-Word audience: a self-documenting starter page showing every GL role,
# with a live SEQ-numbered figure block they can copy-paste per figure.
# ---------------------------------------------------------------------------

def _r(text, italic=False, bold=False):
    rpr = ""
    if bold or italic:
        rpr = ("<w:rPr>" + ("<w:b/><w:bCs/>" if bold else "")
               + ("<w:i/><w:iCs/>" if italic else "") + "</w:rPr>")
    return f'<w:r>{rpr}<w:t xml:space="preserve">{text}</w:t></w:r>'


def _seq(label):
    """A SEQ field rendering its cached value '1' until fields update."""
    return ('<w:r><w:fldChar w:fldCharType="begin"/></w:r>'
            f'<w:r><w:instrText xml:space="preserve"> SEQ {label} '
            '\\* ARABIC </w:instrText></w:r>'
            '<w:r><w:fldChar w:fldCharType="separate"/></w:r>'
            '<w:r><w:t>1</w:t></w:r>'
            '<w:r><w:fldChar w:fldCharType="end"/></w:r>')


def _p(style, inner, jc=None):
    ppr = ""
    if style or jc:
        ppr = ("<w:pPr>"
               + (f'<w:pStyle w:val="{style}"/>' if style else "")
               + (f'<w:jc w:val="{jc}"/>' if jc else "")
               + "</w:pPr>")
    return f"<w:p>{ppr}{inner}</w:p>"


def _starter_table():
    def cell(text, style="Compact", jc=None, w=3120):
        return (f'<w:tc><w:tcPr><w:tcW w:w="{w}" w:type="dxa"/></w:tcPr>'
                + _p(style, _r(text), jc=jc) + "</w:tc>")

    rows = [
        ("<w:tr><w:trPr><w:tblHeader/></w:trPr>"
         + cell("Sector") + cell("Exports", jc="right")
         + cell("Share", jc="right") + "</w:tr>"),
        ("<w:tr>" + cell("Textiles") + cell("16,400", jc="right")
         + cell("54.2", jc="right") + "</w:tr>"),
        ("<w:tr>" + cell("Agriculture") + cell("4,800", jc="right")
         + cell("15.9", jc="right") + "</w:tr>"),
    ]
    return ('<w:tbl><w:tblPr><w:tblStyle w:val="Table"/>'
            '<w:tblW w:w="9360" w:type="dxa"/>'
            '<w:tblLook w:val="0420" w:firstRow="1" w:lastRow="0" '
            'w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/>'
            '</w:tblPr>'
            '<w:tblGrid><w:gridCol w:w="3120"/><w:gridCol w:w="3120"/>'
            '<w:gridCol w:w="3120"/></w:tblGrid>'
            + "".join(rows) + "</w:tbl>")


def build_starter_body():
    parts = [
        _p("Title", _r("Report title")),
        _p("Subtitle", _r("A one-line subtitle describing the report")),
        _p("Author", _r("Author One, Author Two and Author Three")),
        _p("Date", _r("June 2026")),

        _p("Heading1", _r("Using this template")),
        _p(None, _r("Body text is Inter 12 pt, justified. Every Growth "
                    "Lab role is a named style — pick them from the "
                    "Styles gallery (Home tab) rather than formatting by "
                    "hand. Use ") + _r("bold", bold=True)
              + _r(" for emphasis. Build the contents page with References "
                   "→ Table of Contents; insert footnotes with "
                   "References → Insert Footnote. Both come out "
                   "GL-styled automatically.")),

        _p("Heading2", _r("The figure block")),
        _p(None, _r("Each figure is the five-paragraph block below. Copy and "
                    "paste the whole block for every new figure — the "
                    "figure number is a SEQ field, so it renumbers "
                    "automatically (select all and press F9 to update). "
                    "Point at a figure from text with References → "
                    "Cross-reference, reference type “Figure”.")),

        _p("FigureLabel", _r("Figure ") + _seq("Figure")),
        _p("FigureTitle", _r("Chart titles state a finding and end with a "
                             "period.")),
        _p("FigureSubtitle", _r("Units, period covered, unit of analysis "
                                "— delete this paragraph if redundant")),
        _p("FigureImage", _r("[ Replace this paragraph’s text with the "
                             "chart: Insert → Pictures ]")),
        _p("FigureSource", _r("Source: Growth Lab analysis of … "
                              "(required on every figure).", italic=True)),

        _p("Heading2", _r("Tables")),
        _p("TableCaption", _r("Table ") + _seq("Table")
              + _r(": Sentence-case table caption above the table")),
        _starter_table(),
        _p(None, _r("Number table captions with a SEQ field the same way "
                    "(this one is live). Table cells use the "
                    "“Compact” style; numeric columns are "
                    "right-aligned and render with tabular figures.")),
    ]
    return "".join(parts)


def transform_document_xml(content):
    """Page geometry (1"/1.25" margins) + replace the body with the starter."""
    content = re.sub(
        r'<w:pgMar[^/]*/>',
        '<w:pgMar w:top="1440" w:right="1440" w:bottom="1800" w:left="1440" '
        'w:header="720" w:footer="720" w:gutter="0" />',
        content)
    content = re.sub(r'(<w:body>).*?(<w:sectPr)',
                     lambda m: m.group(1) + build_starter_body() + m.group(2),
                     content, count=1, flags=re.DOTALL)
    return content


# ---------------------------------------------------------------------------
# header2.xml — drop the "Internal Document" text, keep the GL logo
# ---------------------------------------------------------------------------

def transform_header_xml(content):
    return re.sub(
        r'<w:r w:rsidRPr="[^"]*"><w:rPr><w:highlight w:val="yellow"/></w:rPr>'
        r'<w:t>[^<]*</w:t></w:r>',
        '', content)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

# Two builds from one style table:
#   gl.docx        1px -> 1pt   (body 12pt) — editable default for md2docx
#   gl-print.docx  1px -> 0.75pt (body 9pt) — the PDF's true print sizes
#                  (CSS 96px = 72pt), used by gl-docx-retheme so the Word
#                  copy matches the md2pdf deliverable.
VARIANTS = {
    "gl": 1.0,
    "gl-print": 0.75,
}


def build_template(name="gl", f=1.0):
    output = os.path.join(SCRIPT_DIR, "templates", f"{name}.docx")
    os.makedirs(os.path.dirname(output), exist_ok=True)
    tmp = output + ".tmp"

    with zipfile.ZipFile(SOURCE, "r") as zin, \
         zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == "word/theme/theme1.xml":
                data = build_theme_xml().encode("utf-8")
            elif item.filename == "word/styles.xml":
                data = transform_styles_xml(data.decode("utf-8"), f).encode("utf-8")
            elif item.filename == "word/document.xml":
                xml = transform_document_xml(data.decode("utf-8"))
                if f != 1.0:
                    xml = xml.replace("Inter 12 pt", f"Inter {12 * f:g} pt")
                data = xml.encode("utf-8")
            elif item.filename == "word/header2.xml":
                data = transform_header_xml(data.decode("utf-8")).encode("utf-8")
            zout.writestr(item, data)

    shutil.move(tmp, output)
    print(f"Built: {output}")
    build_dotx(output)


def build_dotx(output=OUTPUT):
    """gl.dotx — same package with the Word *template* content type, so
    double-clicking creates a new document instead of opening (and risking
    clobbering) the team template. For manual Word use only; pandoc keeps
    using gl.docx."""
    dotx = output[:-5] + ".dotx"
    tmp = dotx + ".tmp"
    with zipfile.ZipFile(output, "r") as zin, \
         zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == "[Content_Types].xml":
                data = data.decode("utf-8").replace(
                    "wordprocessingml.document.main+xml",
                    "wordprocessingml.template.main+xml").encode("utf-8")
            zout.writestr(item, data)
    shutil.move(tmp, dotx)
    print(f"Built: {dotx}")


def main():
    if not os.path.exists(SOURCE):
        print(f"Error: base template not found at {SOURCE}")
        sys.exit(1)
    for name, f in VARIANTS.items():
        build_template(name, f)


if __name__ == "__main__":
    main()
