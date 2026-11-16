"""Standard table of contents for a GL Word report (Nil §9; same rules as md2pdf).

    python gl_toc.py in.docx out.docx [--keep-exec-subheads] [--update [--pdf out.pdf]]

What it does (XML pass):
  - removes the document's existing TOC: the TOC field or TOC content control
    and its title paragraph ("Table of Contents", "Contents");
  - inserts the standard TOC in its own section right after the cover (after
    any colophon page), before the first Heading 1: title "Contents" (style
    TOC Heading), field  TOC \\o "1-2" \\h \\z \\u, then a section break;
  - the TOC section has empty header and footer parts (no running head or
    folio on TOC pages, Nil §10);
  - page numbering is made continuous (cover = page 1, as md2pdf), so TOC
    numbers equal the printed folios: pgNumType start values are removed and
    sections that only existed to restart numbering are merged;
  - Heading 2s inside the Executive Summary move to "Heading 2 (not in
    contents)" (looks like Heading 2, body outline level), because in the city
    diagnostics they repeat the chapter titles (--keep-exec-subheads to skip);
  - writes Nil's TOC styles: TOC Heading = Heading 1 look; TOC 1 serif 14pt
    600 ink with a 1pt ink rule above; TOC 2 Inter 12pt ink-2, 18pt indent;
    TOC 3 Inter italic ink-3, 36pt indent; page numbers on a right tab at the
    text width, no dot leaders.

--update (Windows + Word): opens the result in its own Word instance, updates
the TOC field, sets the page numbers to Inter 11pt (TOC 1: bold, ink; TOC 2:
regular, ink-2), saves, and with --pdf saves a PDF copy (SaveAs2, format 17).
Word's Bold is the static 600 cut, so major numbers print at 600, not 700, and
sub numbers at 400, not 500. If an author updates the TOC later in Word, the
numbers take the entry's font until this step is run again.
"""
import argparse
import os
import re
import shutil
import sys
import zipfile

INK, INK2, INK3 = "1A1714", "2C2823", "4F4A42"
SERIF, SANS = "Source Serif 4", "Inter"
LINE_RATIO = {SANS: 1.21, SERIF: 1.371}   # Word "auto" leading multiplies the font's own line height


def wline(css_line, font):
    return round(css_line / LINE_RATIO[font])


def fonts(f):
    return f'<w:rFonts w:ascii="{f}" w:hAnsi="{f}" w:eastAsia="{f}" w:cs="{f}"/>'


def toc_styles(width):
    tab = f'<w:tabs><w:tab w:val="right" w:leader="none" w:pos="{width}"/></w:tabs>'
    rule = f'w:val="single" w:sz="8" w:space="6" w:color="{INK}"'
    return {
        "TOCHeading": (
            '<w:style w:type="paragraph" w:styleId="TOCHeading"><w:name w:val="TOC Heading"/>'
            '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="39"/>'
            '<w:unhideWhenUsed/><w:qFormat/>'
            f'<w:pPr><w:keepNext/><w:keepLines/><w:pageBreakBefore/>'
            f'<w:spacing w:before="0" w:after="480" w:line="{wline(259, SERIF)}" w:lineRule="auto"/>'
            '<w:ind w:left="0" w:right="0" w:firstLine="0"/><w:jc w:val="left"/><w:outlineLvl w:val="9"/></w:pPr>'
            f'<w:rPr>{fonts(SERIF)}<w:b/><w:bCs/><w:color w:val="{INK}"/><w:spacing w:val="-12"/>'
            '<w:sz w:val="68"/><w:szCs w:val="68"/></w:rPr></w:style>'),
        "TOC1": (
            '<w:style w:type="paragraph" w:styleId="TOC1"><w:name w:val="toc 1"/>'
            '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="39"/><w:unhideWhenUsed/>'
            f'<w:pPr><w:keepNext/><w:keepLines/><w:pBdr><w:top {rule}/><w:between {rule}/></w:pBdr>{tab}'
            f'<w:spacing w:before="200" w:after="100" w:line="{wline(312, SERIF)}" w:lineRule="auto"/>'
            '<w:ind w:left="0" w:right="0" w:firstLine="0"/><w:jc w:val="left"/></w:pPr>'
            f'<w:rPr>{fonts(SERIF)}<w:b/><w:bCs/><w:color w:val="{INK}"/>'
            '<w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>'),
        "TOC2": (
            '<w:style w:type="paragraph" w:styleId="TOC2"><w:name w:val="toc 2"/>'
            '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="39"/><w:unhideWhenUsed/>'
            f'<w:pPr><w:keepLines/>{tab}'
            f'<w:spacing w:before="40" w:after="40" w:line="{wline(324, SANS)}" w:lineRule="auto"/>'
            '<w:ind w:left="360" w:right="0" w:firstLine="0"/><w:jc w:val="left"/></w:pPr>'
            f'<w:rPr>{fonts(SANS)}<w:b w:val="0"/><w:bCs w:val="0"/><w:color w:val="{INK2}"/>'
            '<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>'),
        "TOC3": (
            '<w:style w:type="paragraph" w:styleId="TOC3"><w:name w:val="toc 3"/>'
            '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="39"/><w:unhideWhenUsed/>'
            f'<w:pPr><w:keepLines/>{tab}'
            f'<w:spacing w:before="40" w:after="40" w:line="{wline(324, SANS)}" w:lineRule="auto"/>'
            '<w:ind w:left="720" w:right="0" w:firstLine="0"/><w:jc w:val="left"/></w:pPr>'
            f'<w:rPr>{fonts(SANS)}<w:b w:val="0"/><w:bCs w:val="0"/><w:i/><w:iCs/><w:color w:val="{INK3}"/>'
            '<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>'),
        "Heading2Unlisted": (
            '<w:style w:type="paragraph" w:customStyle="1" w:styleId="Heading2Unlisted">'
            '<w:name w:val="Heading 2 (not in contents)"/><w:basedOn w:val="Heading2"/>'
            '<w:next w:val="Normal"/><w:uiPriority w:val="9"/>'
            '<w:pPr><w:outlineLvl w:val="9"/></w:pPr></w:style>'),
    }


def set_style(styles, sid, block):
    pat = re.compile(r'<w:style\b[^>]*w:styleId="%s".*?</w:style>' % re.escape(sid), re.S)
    if pat.search(styles):
        return pat.sub(lambda m: block, styles, count=1)
    return styles.replace("</w:styles>", block + "</w:styles>")


# ---- body tokenizer: top-level children of <w:body> -------------------------
TAG = re.compile(r'<(/?)w:(p|tbl|sdt)\b[^>]*?(/?)>')


def split_body(doc):
    b0 = doc.index("<w:body>") + len("<w:body>")
    b1 = doc.rindex("</w:body>")
    body = doc[b0:b1]
    final = re.search(r'<w:sectPr\b(?:(?!<w:sectPr\b).)*</w:sectPr>\s*$', body, re.S)
    tail = body[final.start():] if final else ""
    body = body[:final.start()] if final else body
    elems, depth, start, pos = [], 0, None, 0
    for m in TAG.finditer(body):
        closing, selfclose = m.group(1) == "/", m.group(3) == "/"
        if depth == 0 and not closing:
            if m.start() > pos and body[pos:m.start()].strip():
                elems.append(body[pos:m.start()])
            start = m.start()
        if selfclose and not closing:
            if depth == 0:
                elems.append(body[start:m.end()])
                pos = m.end()
            continue
        depth += -1 if closing else 1
        if depth == 0:
            elems.append(body[start:m.end()])
            pos = m.end()
    return doc[:b0], elems, tail, doc[b1:]


def style_of(e):
    m = re.search(r'<w:pStyle w:val="([^"]+)"', e[:600])
    return m.group(1) if e.startswith("<w:p") and m else None


def text_of(e):
    return "".join(re.findall(r'<w:t(?:\s[^>]*)?>([^<]*)</w:t>', e))


def sect_of(e):
    m = re.search(r'<w:sectPr\b.*?</w:sectPr>', e, re.S)
    return m.group(0) if m else None


def standardize(src, dst, keep_exec=False):
    z = zipfile.ZipFile(src)
    parts = {n: z.read(n) for n in z.namelist()}
    infos = {i.filename: i for i in z.infolist()}
    doc = parts["word/document.xml"].decode("utf-8")
    head, elems, final_sect, foot = split_body(doc)
    log = []

    # 1. remove the old TOC (content control, or field + title paragraph)
    i = 0
    while i < len(elems):
        e = elems[i]
        if e.startswith("<w:sdt") and ('w:val="Table of Contents"' in e or re.search(r'instrText[^>]*>\s*TOC\s', e)):
            log.append("removed TOC content control")
            del elems[i]
            continue
        if e.startswith("<w:p") and re.search(r'<w:instrText[^>]*>\s*TOC\s', e):
            begins = ends = 0
            j = i
            while j < len(elems):
                begins += elems[j].count('w:fldCharType="begin"')
                ends += elems[j].count('w:fldCharType="end"')
                if ends >= begins:
                    break
                j += 1
            keep = [f"<w:p><w:pPr>{sect_of(x)}</w:pPr></w:p>" for x in elems[i:j + 1] if sect_of(x)]
            elems[i:j + 1] = keep
            log.append(f"removed TOC field ({j - i + 1} paragraphs)")
            continue
        i += 1
    # titles and end markers of the old TOC
    i = 0
    while i < len(elems):
        e = elems[i]
        st, tx = style_of(e), text_of(e).strip().lower()
        if e.startswith("<w:p") and (st in ("TOCHeading", "TOCEnd") or
                                     (st and st.startswith("Heading") and tx in ("table of contents", "contents"))):
            s = sect_of(e)
            if s:
                elems[i] = f"<w:p><w:pPr>{s}</w:pPr></w:p>"
                i += 1
            else:
                del elems[i]
            log.append(f"removed old TOC title/marker ({st}: {tx[:20]!r})")
            continue
        i += 1

    # 2. executive-summary subheads leave the TOC
    if not keep_exec:
        in_es, n = False, 0
        for i, e in enumerate(elems):
            st = style_of(e)
            if st == "Heading1":
                in_es = text_of(e).strip().lower() == "executive summary"
            elif in_es and st == "Heading2":
                elems[i] = e.replace('<w:pStyle w:val="Heading2"/>', '<w:pStyle w:val="Heading2Unlisted"/>', 1)
                n += 1
        if n:
            log.append(f"{n} executive-summary Heading 2s -> Heading 2 (not in contents)")

    # 3. continuous page numbers; merge sections that only restarted numbering
    def strip_start(s):
        return re.sub(r'<w:pgNumType\b[^>]*/>', lambda m: re.sub(r'\s*w:start="\d+"', "", m.group(0)), s)

    def geometry(s):
        return re.sub(r'\s+', '', "".join(re.findall(r'<w:(?:header|footer)Reference[^>]*/>|<w:pgSz[^>]*/>|<w:pgMar[^>]*/>', s)))

    final_sect = strip_start(final_sect)
    first_sect_idx = next(i for i, e in enumerate(elems) if sect_of(e))
    for i, e in enumerate(elems):
        s = sect_of(e)
        if not s:
            continue
        s2 = strip_start(s)
        if i != first_sect_idx and geometry(s2) == geometry(final_sect) and "titlePg" not in s2:
            elems[i] = e.replace(s, "")
            log.append("merged a section that only restarted page numbers")
        elif s2 != s:
            elems[i] = e.replace(s, s2)

    # 4. insert the standard TOC before the first Heading 1 after the cover
    at = next(i for i, e in enumerate(elems) if i > first_sect_idx and style_of(e) == "Heading1")
    toc_sect = re.sub(r'<w:(?:header|footer)Reference[^>]*/>', "", final_sect)
    toc_sect = re.sub(r'<w:titlePg[^>]*/>', "", toc_sect)
    toc_sect = re.sub(r'<w:type [^>]*/>', "", toc_sect)
    toc_sect = re.sub(r'(<w:sectPr\b[^>]*>)',
                      r'\1<w:headerReference w:type="default" r:id="rIdGLTOCh"/>'
                      r'<w:footerReference w:type="default" r:id="rIdGLTOCf"/>', toc_sect, count=1)
    block = [
        '<w:p><w:pPr><w:pStyle w:val="TOCHeading"/></w:pPr><w:r><w:t>Contents</w:t></w:r></w:p>',
        '<w:p><w:pPr><w:pStyle w:val="TOC1"/></w:pPr>'
        '<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r>'
        '<w:r><w:instrText xml:space="preserve"> TOC \\o "1-2" \\h \\z \\u </w:instrText></w:r>'
        '<w:r><w:fldChar w:fldCharType="separate"/></w:r>'
        '<w:r><w:t>Update this field to build the table of contents.</w:t></w:r>'
        '<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>',
        f'<w:p><w:pPr><w:spacing w:before="0" w:after="0"/>{toc_sect}</w:pPr></w:p>',
    ]
    elems[at:at] = block
    log.append(f"inserted standard TOC before {text_of(elems[at + 3])[:30]!r}")
    parts["word/document.xml"] = (head + "".join(elems) + final_sect + foot).encode("utf-8")

    # 5. empty header/footer parts for the TOC section
    ns = ('xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
          'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"')
    parts["word/headerGLTOC.xml"] = f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr {ns}><w:p/></w:hdr>'.encode()
    parts["word/footerGLTOC.xml"] = f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr {ns}><w:p/></w:ftr>'.encode()
    rels = parts["word/_rels/document.xml.rels"].decode("utf-8")
    if "rIdGLTOCh" not in rels:
        base = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/"
        rels = rels.replace("</Relationships>",
                            f'<Relationship Id="rIdGLTOCh" Type="{base}header" Target="headerGLTOC.xml"/>'
                            f'<Relationship Id="rIdGLTOCf" Type="{base}footer" Target="footerGLTOC.xml"/></Relationships>')
    parts["word/_rels/document.xml.rels"] = rels.encode("utf-8")
    ct = parts["[Content_Types].xml"].decode("utf-8")
    if "headerGLTOC" not in ct:
        mime = "application/vnd.openxmlformats-officedocument.wordprocessingml."
        ct = ct.replace("</Types>",
                        f'<Override PartName="/word/headerGLTOC.xml" ContentType="{mime}header+xml"/>'
                        f'<Override PartName="/word/footerGLTOC.xml" ContentType="{mime}footer+xml"/></Types>')
    parts["[Content_Types].xml"] = ct.encode("utf-8")

    # 6. styles (right tab at the text width of the body section)
    pw = int(re.search(r'<w:pgSz[^>]*w:w="(\d+)"', final_sect).group(1))
    ml = int(re.search(r'<w:pgMar[^>]*w:left="(\d+)"', final_sect).group(1))
    mr = int(re.search(r'<w:pgMar[^>]*w:right="(\d+)"', final_sect).group(1))
    styles = parts["word/styles.xml"].decode("utf-8")
    for sid, blk in toc_styles(pw - ml - mr).items():
        styles = set_style(styles, sid, blk)
    parts["word/styles.xml"] = styles.encode("utf-8")

    # 7. auto-numbered headings: a space after the number, as md2pdf prints them
    #    ("4.1 Current…"), not Word's default tab, so TOC entries with typed
    #    and with list numbers line up the same way. Only the list levels that
    #    headings use are changed.
    if "word/numbering.xml" in parts:
        used = set()
        for e in elems:
            if style_of(e) in ("Heading1", "Heading2", "Heading2Unlisted"):
                n = re.search(r'<w:numId w:val="(\d+)"', e[:1500])
                lv = re.search(r'<w:ilvl w:val="(\d+)"', e[:1500])
                if n and n.group(1) != "0":
                    used.add((n.group(1), lv.group(1) if lv else "0"))
        num = parts["word/numbering.xml"].decode("utf-8")
        absof = dict(re.findall(r'<w:num w:numId="(\d+)"[^>]*>\s*<w:abstractNumId w:val="(\d+)"', num))
        targets = {(absof[n], lv) for n, lv in used if n in absof}
        changed = 0
        for a, lv in targets:
            am = re.search(r'<w:abstractNum\b[^>]*w:abstractNumId="%s".*?</w:abstractNum>' % a, num, re.S)
            if not am:
                continue
            block = am.group(0)
            lm = re.search(r'<w:lvl w:ilvl="%s".*?</w:lvl>' % lv, block, re.S)
            if not lm:
                continue
            lvl = re.sub(r'<w:suff\b[^>]*/>', "", lm.group(0))
            lvl = lvl.replace("<w:lvlText", '<w:suff w:val="space"/><w:lvlText', 1)
            block2 = block.replace(lm.group(0), lvl, 1)
            num = num.replace(block, block2, 1)
            changed += 1
        if changed:
            parts["word/numbering.xml"] = num.encode("utf-8")
            log.append(f"{changed} heading list level(s): space after the number")

    tmp = dst + ".tmp"
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as out:
        for n, data in parts.items():
            info = infos.get(n) or zipfile.ZipInfo(n)
            info.compress_type = zipfile.ZIP_DEFLATED
            out.writestr(info, data)
    shutil.move(tmp, dst)
    return log


def register_fonts():
    """Word loses per-user fonts at times and falls back to Cambria: re-register them."""
    import ctypes
    d = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "Windows", "Fonts")
    if os.path.isdir(d):
        for f in os.listdir(d):
            if re.search(r"(Inter|SourceSerif)", f, re.I) and f.lower().endswith((".ttf", ".otf")):
                ctypes.windll.gdi32.AddFontResourceW(os.path.join(d, f))
    ctypes.windll.user32.SendMessageTimeoutW(0xFFFF, 0x001D, 0, 0, 0x0002, 2000, None)


def bgr(hexrgb):
    r, g, b = int(hexrgb[0:2], 16), int(hexrgb[2:4], 16), int(hexrgb[4:6], 16)
    return r + g * 256 + b * 65536


def update_in_word(path, pdf=None):
    import pythoncom
    import win32com.client
    register_fonts()
    pythoncom.CoInitialize()
    word = win32com.client.DispatchEx("Word.Application")   # our own instance; never touch others
    word.Visible = False
    word.DisplayAlerts = 0
    try:
        doc = word.Documents.Open(os.path.abspath(path), False, False, False)
        toc = doc.TablesOfContents(1)
        toc.Update()
        toc = doc.TablesOfContents(1)
        # Word copies a heading's direct run formatting into its TOC entry;
        # clear it so every entry takes its TOC style.
        toc.Range.Font.Reset()
        n = 0
        for f in toc.Range.Fields:
            if f.Type != 37:          # wdFieldPageRef: the entry's page number
                continue
            level = f.Result.Paragraphs(1).Style.NameLocal.lower()
            # Word re-formats a refreshed field result from the first character
            # of its code, so the code carries the same formatting as the result
            # (page-number refreshes in Word then keep it too).
            for r in (f.Code, f.Result):
                r.Font.Name = SANS
                r.Font.Size = 11
                r.Font.Italic = False
                r.Font.Bold = level == "toc 1"
                r.Font.Color = bgr(INK if level == "toc 1" else INK2)
            n += 1
        doc.Save()
        if pdf:
            doc.SaveAs2(os.path.abspath(pdf), 17)
        doc.Close(False)
        return n
    finally:
        word.Quit()


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--keep-exec-subheads", action="store_true")
    ap.add_argument("--update", action="store_true", help="update the field in Word (Windows)")
    ap.add_argument("--pdf", help="with --update: also save a PDF copy here")
    a = ap.parse_args()
    for line in standardize(a.src, a.dst, a.keep_exec_subheads):
        print("toc:", line)
    if a.update:
        print(f"toc: {update_in_word(a.dst, a.pdf)} entries numbered in Word")
