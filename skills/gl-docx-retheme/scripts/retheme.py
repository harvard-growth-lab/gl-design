#!/usr/bin/env python3
"""
retheme.py — transplant the Growth Lab design system into an existing .docx.

The deterministic half of gl-docx-retheme:

  1. Replaces word/theme/theme1.xml with the GL theme (fonts + palette).
  2. Replaces word/styles.xml with the GL style set, then re-appends any
     target-only styles (custom styles, numbering-linked styles) so nothing
     the document references goes undefined. Re-appended styles keep their
     look until Claude remaps the paragraphs that use them.
  3. Sets GL page geometry (1" top/left/right, 1.25" bottom) on every section
     unless --keep-margins.
  4. With --strip-direct: removes run-level font/size/color overrides from
     the document body and footnotes/endnotes, so the transplanted styles
     actually show through. Bold/italic/underline/superscript are kept —
     they carry meaning. Headers/footers are left untouched.

What this does NOT do (Claude's judgment half, see SKILL.md): remap
direct-formatted pseudo-headings to Heading styles, rebuild figure blocks,
apply the Table style to tables, or flag content-level Nil violations.

Usage:
    python3 retheme.py input.docx output.docx [--strip-direct]
        [--keep-margins] [--template path/to/gl.docx]
"""

import argparse
import os
import re
import shutil
import sys
import zipfile

# gl: Nil's spec numbers as points (body 12pt, H1 34pt, display 56pt), the
# same sizes the md2pdf deliverable prints since 2026-11-16.
# `--template .../gl-print.docx` gives the old 0.75pt-per-px sizes.
DEFAULT_TEMPLATE = os.path.normpath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "..", "md2docx", "assets", "templates", "gl.docx"))


def embed_fonts(settings_xml):
    """Ask Word to embed the fonts it uses (subsetted) on its next save, so a
    reader without Inter / Source Serif 4 still sees them. Only takes effect
    when the file is saved in Word on a machine that has the fonts."""
    if "<w:embedTrueTypeFonts" not in settings_xml:
        settings_xml = re.sub(r'(<w:settings\b[^>]*>)',
                              r'\1<w:embedTrueTypeFonts/><w:saveSubsetFonts/>',
                              settings_xml, count=1)
    return settings_xml

GL_PGMAR = ('<w:pgMar w:top="1440" w:right="1440" w:bottom="1800" '
            'w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>')

STYLE_RE = re.compile(r'<w:style [^>]*w:styleId="([^"]+)"[^>]*>.*?</w:style>',
                      re.DOTALL)


def merge_styles(gl_styles, target_styles, used_ids):
    """GL styles wholesale + the target-only styles the document actually
    uses (plus their basedOn/link/next chains). Unused latent styles —
    Word templates carry ~100 — are dropped."""
    gl_ids = set(STYLE_RE.findall(gl_styles))
    target_blocks = {m.group(1): m.group(0)
                     for m in STYLE_RE.finditer(target_styles)}

    keep = set()
    frontier = [sid for sid in used_ids
                if sid in target_blocks and sid not in gl_ids]
    while frontier:
        sid = frontier.pop()
        if sid in keep:
            continue
        keep.add(sid)
        for ref in re.findall(r'<w:(?:basedOn|link|next) w:val="([^"]+)"',
                              target_blocks[sid]):
            if ref in target_blocks and ref not in gl_ids and ref not in keep:
                frontier.append(ref)

    extra = [target_blocks[sid] for sid in sorted(keep)]
    if extra:
        gl_styles = gl_styles.replace(
            "</w:styles>", "".join(extra) + "</w:styles>")
    return gl_styles, sorted(keep)


def collect_used_style_ids(zin):
    """Style ids referenced anywhere in the document's content parts."""
    used = set()
    for name in zin.namelist():
        if re.match(r'word/(document|footnotes|endnotes|header\d*|footer\d*)\.xml$',
                    name):
            xml = zin.read(name).decode("utf-8", errors="replace")
            used |= set(re.findall(
                r'<w:(?:pStyle|rStyle|tblStyle) w:val="([^"]+)"', xml))
    return used


def strip_direct_formatting(xml):
    """Remove run-level font/size/color overrides; keep semantic formatting
    (bold, italic, underline, vertAlign, highlight)."""
    for pat in (r'<w:rFonts\b[^>]*/>', r'<w:sz\b[^>]*/>',
                r'<w:szCs\b[^>]*/>', r'<w:color\b[^>]*/>'):
        xml = re.sub(pat, '', xml)
    # Drop run-property containers left empty by the strip
    xml = re.sub(r'<w:rPr>\s*</w:rPr>', '', xml)
    return xml


AUTO_SPACING_RE = re.compile(r'<w:spacing\b[^>]*\bw:line="[^"]*"[^>]*/>')

PARA_RE = re.compile(r'<w:p(?:\s[^>]*)?>.*?</w:p>', re.DOTALL)
PAGE_BR = '<w:br w:type="page"/>'


def strip_page_breaks(xml):
    """Remove the original's manual page breaks (break-only paragraphs, breaks
    inside text, direct pageBreakBefore). They were placed for the original
    layout and land at random once styles change; the GL template starts
    each Heading 1 on a new page instead, as md2pdf does. Everything up to
    the first section break (the cover, and a colophon page after it) is
    left alone. Returns (xml, paragraphs removed, breaks removed)."""
    m = re.search(r'<w:sectPr\b', xml)
    body_start = xml.find('<w:body>')
    start = body_start
    if m:
        end_p = xml.find('</w:p>', m.start())
        last_sect = xml.rfind('<w:sectPr')
        if end_p != -1 and m.start() != last_sect:
            start = end_p + len('</w:p>')
    head, tail = xml[:start], xml[start:]
    removed_p = removed_br = 0

    def fix(pm):
        nonlocal removed_p, removed_br
        p = pm.group(0)
        if PAGE_BR not in p and '<w:pageBreakBefore' not in p:
            return p
        if '<w:sectPr' in p or '<w:drawing' in p or '<w:pict' in p:
            n = p.count(PAGE_BR)
            removed_br += n
            return p.replace(PAGE_BR, '')
        text = ''.join(re.findall(r'<w:t(?:\s[^>]*)?>([^<]*)</w:t>', p)).strip()
        if not text and PAGE_BR in p:
            removed_p += 1
            return ''
        removed_br += p.count(PAGE_BR)
        p = p.replace(PAGE_BR, '')
        return re.sub(r'<w:pageBreakBefore(?:\s[^>]*)?/>', '', p)

    tail = PARA_RE.sub(fix, tail)
    return head + tail, removed_p, removed_br


def strip_auto_leading(xml):
    """Drop direct proportional line spacing (w:line with lineRule auto or
    unset) so the GL styles' leading shows through. Exact / atLeast spacing
    is kept: it is deliberate (cover title, fixed-height figure anchors)."""
    def fix(m):
        el = m.group(0)
        rule = re.search(r'w:lineRule="(\w+)"', el)
        if rule and rule.group(1) != "auto":
            return el
        el = re.sub(r'\s+w:line="[^"]*"', '', el)
        el = re.sub(r'\s+w:lineRule="auto"', '', el)
        return '' if re.fullmatch(r'<w:spacing\s*/>', el) else el
    return AUTO_SPACING_RE.sub(fix, xml)


SYMBOL_FONTS = {"Symbol", "Wingdings", "Wingdings 2", "Wingdings 3",
                "Courier New", "Webdings"}


def strip_numbering_fonts(xml):
    """List and heading numbers carry their own font/size/color in
    numbering.xml (e.g. a Georgia 18pt '1.' before a 25.5pt H1). Remove them
    so numbers take the paragraph's style; keep bullet symbol fonts."""
    def fix_rpr(m):
        rpr = m.group(0)
        for pat in (r'<w:sz\b[^>]*/>', r'<w:szCs\b[^>]*/>',
                    r'<w:color\b[^>]*/>'):
            rpr = re.sub(pat, '', rpr)
        f = re.search(r'<w:rFonts\b[^>]*/>', rpr)
        if f:
            ascii_ = re.search(r'w:ascii="([^"]+)"', f.group(0))
            if not (ascii_ and ascii_.group(1) in SYMBOL_FONTS):
                rpr = rpr.replace(f.group(0), '')
        return rpr
    return re.sub(r'(?s)<w:lvl\b.*?</w:lvl>',
                  lambda lvl: re.sub(r'(?s)<w:rPr>.*?</w:rPr>', fix_rpr,
                                     lvl.group(0)), xml)


def set_margins(xml):
    return re.sub(r'<w:pgMar[^/]*/>', GL_PGMAR, xml)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--template", default=DEFAULT_TEMPLATE,
                    help="GL reference doc (default: md2docx templates/gl-print.docx, true print sizes)")
    ap.add_argument("--strip-direct", action="store_true",
                    help="strip run-level font/size/color overrides from the "
                         "body, footnotes and endnotes")
    ap.add_argument("--keep-margins", action="store_true",
                    help="leave the target's page geometry untouched")
    args = ap.parse_args()

    if not os.path.exists(args.template):
        sys.exit(f"GL template not found: {args.template}")

    with zipfile.ZipFile(args.template) as z:
        gl_theme = z.read("word/theme/theme1.xml")
        gl_styles = z.read("word/styles.xml").decode("utf-8")

    strip_parts = {"word/document.xml", "word/footnotes.xml",
                   "word/endnotes.xml"}
    tmp = args.output + ".tmp"
    kept = []

    with zipfile.ZipFile(args.input) as zin, \
         zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        names = set(zin.namelist())
        used_ids = collect_used_style_ids(zin)
        for item in zin.infolist():
            data = zin.read(item.filename)

            if item.filename == "word/theme/theme1.xml":
                data = gl_theme
            elif item.filename == "word/styles.xml":
                merged, kept = merge_styles(gl_styles,
                                            data.decode("utf-8"), used_ids)
                data = merged.encode("utf-8")
            elif item.filename == "word/document.xml":
                xml = data.decode("utf-8")
                if not args.keep_margins:
                    xml = set_margins(xml)
                if args.strip_direct:
                    xml = strip_auto_leading(strip_direct_formatting(xml))
                    xml, n_p, n_br = strip_page_breaks(xml)
                    if n_p or n_br:
                        print(f"Manual page breaks removed: {n_p} break-only "
                              f"paragraph(s), {n_br} break(s) in text")
                data = xml.encode("utf-8")
            elif args.strip_direct and item.filename == "word/numbering.xml":
                data = strip_numbering_fonts(
                    data.decode("utf-8")).encode("utf-8")
            elif item.filename == "word/settings.xml":
                data = embed_fonts(data.decode("utf-8")).encode("utf-8")
            elif args.strip_direct and item.filename in strip_parts:
                data = strip_auto_leading(strip_direct_formatting(
                    data.decode("utf-8"))).encode("utf-8")

            zout.writestr(item, data)

        if "word/theme/theme1.xml" not in names:
            print("warning: target has no theme part; GL theme not added")

    shutil.move(tmp, args.output)
    print(f"Rethemed: {args.output}")
    if kept:
        print(f"Target-only styles kept (review whether their paragraphs "
              f"should be remapped to GL styles): {', '.join(sorted(kept))}")


if __name__ == "__main__":
    main()
