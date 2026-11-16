#!/usr/bin/env python3
"""
gl_pages.py — the GL cover page and page chrome for a rethemed .docx, matching
what md2pdf renders for the PDF (recipes/report.md §5 "Cover page" and
"Page chrome").

  Cover (replaces the original's cover paragraphs):
    - cover paper (#F3F2EA) and the pattern artwork (Report circle or Working
      Paper rect) as one full-page picture behind the text, page 1 only
    - meta row: series eyebrow + date at left; GL logo plus partner logos
      (hairline-separated) at right
    - display title, the 3px accent title rule at 50% width, subtitle,
      authors, cover note (partnership / disclaimer / affiliations)
    - its own section, so it carries no running head or folio
  Chrome (every section after the cover):
    - running head: text flush left (Inter 9px UPPER ink-3), GL logo flush
      right, hairline below
    - folio: page number bottom right (Inter 9px ink-3)

All cover text comes from the spec, verbatim; nothing is invented.

Usage:
    python gl_pages.py list   input.docx            # number the first body blocks
    python gl_pages.py build  input.docx output.docx --spec cover.json
                              [--drop N] [--running-head TEXT] [--no-chrome]

  --drop N  removes the first N top-level body blocks (the original cover);
            run `list` first and pick N by judgment.

cover.json:
    {
      "series": "Draft for comments",          # optional eyebrow
      "date": "September 29, 2026",
      "title": "City Growth Diagnostic:\\nBen Guerir",   # \\n = line break
      "subtitle": "Optional subtitle",
      "authors": ["Adeline Hipps, Jesús Daboin, Tim O'Brien and Issam Samiri"],
      "note": ["This report is part of a research partnership ...", "..."],
      "partner_logos": [{"src": "cover/ecu_logo.png", "alt": "ECU, UM6P"}],
      "pattern": "report"                      # report | working-paper | none
    }
Paths in the spec are relative to the spec file.
"""

import argparse
import io
import json
import math
import os
import re
import shutil
import sys
import zipfile

from lxml import etree

try:
    import fitz  # PyMuPDF, renders the SVG pattern
    from PIL import Image
except ImportError:  # pragma: no cover
    fitz = None

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, "..", "..", "..", "assets",
                                       "design-library"))
GL_LOGO = os.path.join(ASSETS, "logos", "GL_logo_black.png")
PATTERNS = {
    "report": os.path.join(ASSETS, "cover-patterns", "circle-pattern.svg"),
    "working-paper": os.path.join(ASSETS, "cover-patterns", "rect-pattern.svg"),
}

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
PIC = "http://schemas.openxmlformats.org/drawingml/2006/picture"
PKG_R = "http://schemas.openxmlformats.org/package/2006/relationships"
CT = "http://schemas.openxmlformats.org/package/2006/content-types"
REL_IMAGE = R + "/image"
REL_HEADER = R + "/header"
REL_FOOTER = R + "/footer"
NS = {"w": W, "r": R, "wp": WP}
NSDECL = (f'xmlns:w="{W}" xmlns:r="{R}" xmlns:wp="{WP}" '
          f'xmlns:a="{A}" xmlns:pic="{PIC}"')

EMU = 914400            # per inch
TW = 1440               # twips per inch
COVER_BG = (0xF3, 0xF2, 0xEA)
ACCENT = "1A5A8E"
RULE = "DDDDDD"

# Recipe geometry (Letter, 1/1/1/1.25in margins -> 6.5 x 8.75in live area)
PAGE_W, PAGE_H = 8.5, 11.0
MARGIN_L, MARGIN_T, MARGIN_B = 1.0, 1.0, 1.25
LIVE_W, LIVE_H = 6.5, 8.75

# Points per spec px. Nil's spec is in px; the gl theme prints her numbers as
# points (PX = 1.0), the older gl-print theme at 0.75pt per px. build reads it
# from the document's Normal style (12pt body -> 1.0, 9pt -> 0.75).
PX = 1.0


def px_pt(v):
    return v * PX


def px_in(v):
    return v * PX / 72


def px_tw(v):
    return round(v * PX * 20)


def detect_px(pkg):
    st = pkg.parts.get("word/styles.xml", b"").decode("utf-8", "replace")
    m = re.search(r'<w:style [^>]*w:styleId="Normal"[^>]*>.*?</w:style>', st, re.S)
    sz = re.search(r'<w:sz w:val="(\d+)"', m.group(0)) if m else None
    if not sz:
        sz = re.search(r'<w:rPrDefault>.*?<w:sz w:val="(\d+)"', st, re.S)
    return int(sz.group(1)) / 24 if sz else 1.0


def q(tag):
    p, t = tag.split(":")
    return "{%s}%s" % ({"w": W, "r": R, "wp": WP}[p], t)


def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;")
             .replace(">", "&gt;").replace('"', "&quot;"))


# ---------------------------------------------------------------------------
# Package helpers
# ---------------------------------------------------------------------------

class Package:
    def __init__(self, path):
        with zipfile.ZipFile(path) as z:
            self.infos = z.infolist()
            self.parts = {i.filename: z.read(i.filename) for i in self.infos}
        self.doc = etree.fromstring(self.parts["word/document.xml"])
        self.rels = etree.fromstring(
            self.parts["word/_rels/document.xml.rels"])
        self.ct = etree.fromstring(self.parts["[Content_Types].xml"])
        ids = [int(x) for x in re.findall(
            rb'<wp:docPr id="(\d+)"', self.parts["word/document.xml"])]
        self._docpr = max(ids + [0]) + 1000

    def docpr_id(self):
        self._docpr += 1
        return self._docpr

    def _rid(self, rels):
        used = {r.get("Id") for r in rels}
        n = 1
        while f"rIdGL{n}" in used:
            n += 1
        return f"rIdGL{n}"

    def add_rel(self, rels, rtype, target):
        rid = self._rid(rels)
        el = etree.SubElement(rels, "{%s}Relationship" % PKG_R)
        el.set("Id", rid)
        el.set("Type", rtype)
        el.set("Target", target)
        return rid

    def add_media(self, data, ext, rels):
        n = 1
        while f"word/media/gl_{n}.{ext}" in self.parts:
            n += 1
        name = f"word/media/gl_{n}.{ext}"
        self.parts[name] = data
        self.ensure_default(ext, {"png": "image/png", "jpeg": "image/jpeg",
                                  "jpg": "image/jpeg"}[ext])
        return self.add_rel(rels, REL_IMAGE, f"media/gl_{n}.{ext}")

    def ensure_default(self, ext, ctype):
        for d in self.ct.findall("{%s}Default" % CT):
            if d.get("Extension", "").lower() == ext:
                return
        el = etree.SubElement(self.ct, "{%s}Default" % CT)
        el.set("Extension", ext)
        el.set("ContentType", ctype)

    def add_override(self, partname, ctype):
        el = etree.SubElement(self.ct, "{%s}Override" % CT)
        el.set("PartName", "/" + partname)
        el.set("ContentType", ctype)

    def save(self, path):
        self.parts["word/document.xml"] = etree.tostring(
            self.doc, xml_declaration=True, encoding="UTF-8", standalone=True)
        self.parts["word/_rels/document.xml.rels"] = etree.tostring(
            self.rels, xml_declaration=True, encoding="UTF-8", standalone=True)
        self.parts["[Content_Types].xml"] = etree.tostring(
            self.ct, xml_declaration=True, encoding="UTF-8", standalone=True)
        tmp = path + ".tmp"
        written = set()
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
            for info in self.infos:            # keep original order first
                if info.filename in self.parts:
                    z.writestr(info, self.parts[info.filename])
                    written.add(info.filename)
            for name, data in self.parts.items():
                if name not in written:
                    z.writestr(name, data)
        shutil.move(tmp, path)


# ---------------------------------------------------------------------------
# Drawing XML
# ---------------------------------------------------------------------------

def _graphic(rid, name, cx, cy):
    return (f'<a:graphic><a:graphicData uri="{PIC}">'
            f'<pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="{esc(name)}"/>'
            '<pic:cNvPicPr/></pic:nvPicPr>'
            f'<pic:blipFill><a:blip r:embed="{rid}"/>'
            '<a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
            f'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/>'
            '</a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
            '</pic:spPr></pic:pic></a:graphicData></a:graphic>')


def inline_pic(pkg, rid, name, alt, w_in, h_in):
    cx, cy = round(w_in * EMU), round(h_in * EMU)
    return ('<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">'
            f'<wp:extent cx="{cx}" cy="{cy}"/>'
            f'<wp:docPr id="{pkg.docpr_id()}" name="{esc(name)}" descr="{esc(alt)}"/>'
            '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/>'
            f'</wp:cNvGraphicFramePr>{_graphic(rid, name, cx, cy)}'
            '</wp:inline></w:drawing></w:r>')


def page_background(pkg, rid, alt):
    cx, cy = round(PAGE_W * EMU), round(PAGE_H * EMU)
    return ('<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" '
            'simplePos="0" relativeHeight="0" behindDoc="1" locked="1" '
            'layoutInCell="0" allowOverlap="1"><wp:simplePos x="0" y="0"/>'
            '<wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset>'
            '</wp:positionH><wp:positionV relativeFrom="page">'
            '<wp:posOffset>0</wp:posOffset></wp:positionV>'
            f'<wp:extent cx="{cx}" cy="{cy}"/>'
            '<wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>'
            f'<wp:docPr id="{pkg.docpr_id()}" name="GL cover background" '
            f'descr="{esc(alt)}"/><wp:cNvGraphicFramePr/>'
            f'{_graphic(rid, "cover-background.png", cx, cy)}'
            '</wp:anchor></w:drawing></w:r>')


# ---------------------------------------------------------------------------
# Cover
# ---------------------------------------------------------------------------

def _display_font():
    """The static display cut Word sets the cover title in, for measuring."""
    try:
        from fontTools.ttLib import TTFont
    except ImportError:
        return None
    for d in (os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "fonts"),
              os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "Windows", "Fonts"),
              os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts"),
              os.path.expanduser("~/.local/share/fonts"),
              os.path.expanduser("~/Library/Fonts")):
        f = os.path.join(d, "SourceSerif4DisplayGL-Regular.ttf")
        if os.path.exists(f):
            try:
                return TTFont(f)
            except Exception:
                return None
    return None


def title_lines(text, size_pt, width_pt, tracking_em=-0.025):
    """Greedy word wrap of the cover title in the display cut, or None when
    that font is not installed."""
    font = _display_font()
    if font is None:
        return None
    cmap, hm, upm = font.getBestCmap(), font["hmtx"], font["head"].unitsPerEm

    def w(t):
        return (sum(hm[cmap[ord(c)]][0] if ord(c) in cmap else upm * 0.5
                    for c in t) / upm * size_pt
                + len(t) * tracking_em * size_pt)

    n = 0
    for seg in text.split("\n"):
        n += 1
        line = ""
        for word in seg.split():
            trial = (line + " " + word).strip()
            if line and w(trial) > width_pt:
                n += 1
                line = word
            else:
                line = trial
    return n


def estimate_text_height_pt(spec):
    """Rough height of the cover's text stack, in pt, at the document's sizes, to
    size the pattern artwork into the space left (as md2pdf's flex layout
    does). Errs on the tall side."""
    def lines(text, size_pt, width_pt, char_em):
        per_line = max(1, int(width_pt / (size_pt * char_em)))
        return sum(max(1, math.ceil(len(seg) / per_line))
                   for seg in text.split("\n"))

    # char_em is a deliberately wide average glyph width (Word's static Source
    # Serif 4 sets wider than the PDF's optically-sized display cut), and
    # leading follows Word's actual metrics, so the estimate errs tall and
    # the artwork never collides with the text.
    W = LIVE_W * 72
    h = 0.25 * 72 + px_pt(40) + 6           # top padding + meta row (logos)
    h += 72                                 # 1in gap below the meta row (as md2pdf)
    # the title is kerned (template default), ~1% narrower than the advances
    tl = title_lines(spec["title"], px_pt(56), W * 1.01) or \
        lines(spec["title"], px_pt(56), W, 0.52)
    h += tl * px_pt(56) * 1.2 + px_pt(24)
    h += px_pt(3) + px_pt(32)               # title rule + space below
    if spec.get("subtitle"):
        h += lines(spec["subtitle"], px_pt(18), W, 0.5) * px_pt(18) * 1.5 + px_pt(24)
    for a in spec.get("authors", []):
        h += lines(a, px_pt(14), W, 0.52) * px_pt(14) * 1.6 + 4
    if spec.get("note"):
        h += px_pt(24)
        for para in spec["note"]:
            h += lines(para, px_pt(11), W * 0.75, 0.5) * px_pt(11) * 1.6 + 4
    return h + 24                # safety


def find_chromium():
    """The headless Chromium md2pdf uses (Puppeteer's cache), if present."""
    import glob
    home = os.path.expanduser("~")
    for pat in (".cache/puppeteer/chrome-headless-shell/*/*/chrome-headless-shell*",
                ".cache/puppeteer/chrome/*/*/chrome*"):
        for p in sorted(glob.glob(os.path.join(home, pat)), reverse=True):
            if os.path.isfile(p) and os.access(p, os.X_OK) and \
                    re.search(r"chrome(-headless-shell)?(\.exe)?$", p):
                return p
    return shutil.which("chromium") or shutil.which("google-chrome")


def rasterize_svg(svg_path, w_px, h_px):
    """SVG -> RGBA PIL image at w x h px. Chromium honours the SVG's <style>
    classes (the pattern's colours live there); PyMuPDF does not, so it is
    only the fallback."""
    import subprocess
    import tempfile
    chrome = find_chromium()
    if chrome:
        with tempfile.TemporaryDirectory() as td:
            html = os.path.join(td, "p.html")
            png = os.path.join(td, "p.png")
            src = "file:///" + os.path.abspath(svg_path).replace("\\", "/")
            open(html, "w", encoding="utf-8").write(
                '<html><body style="margin:0;background:transparent">'
                f'<img src="{src}" style="display:block;width:{w_px}px;'
                f'height:{h_px}px;object-fit:contain;object-position:center bottom">'
                '</body></html>')
            subprocess.run([chrome, "--headless", "--disable-gpu", "--no-sandbox",
                            "--hide-scrollbars", "--allow-file-access-from-files",
                            "--default-background-color=00000000",
                            f"--window-size={w_px},{h_px}",
                            f"--screenshot={png}",
                            "file:///" + html.replace("\\", "/")],
                           capture_output=True, timeout=120)
            if os.path.exists(png):
                im = Image.open(png).convert("RGBA")
                im.load()
                return im
    doc = fitz.open(svg_path)
    r = doc[0].rect
    zoom = min(w_px / r.width, h_px / r.height)
    pix = doc[0].get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=True)
    print("warning: no Chromium found; pattern rasterized without its colours")
    return Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGBA")


def render_background(spec):
    """Cover paper + pattern artwork as one 8.5x11in PNG (200 dpi)."""
    if fitz is None:
        sys.exit("gl_pages.py needs PyMuPDF and Pillow (pip install pymupdf pillow)")
    dpi = 200
    bg = Image.new("RGB", (int(PAGE_W * dpi), int(PAGE_H * dpi)), COVER_BG)
    pattern = spec.get("pattern", "report")
    note = "Cover paper"
    if pattern in PATTERNS:
        room_in = (LIVE_H * 72 - estimate_text_height_pt(spec)) / 72
        h_in = min(2.5, room_in)
        if h_in >= 1.25:          # under that it prints as a speck: omit
            # the live width x available height box, artwork contained and
            # bottom-centred in it (md2pdf's object-fit: contain)
            w_px, h_px = int(LIVE_W * dpi), int(h_in * dpi)
            art = rasterize_svg(PATTERNS[pattern], w_px, h_px)
            x = int(MARGIN_L * dpi)
            y = int((PAGE_H - MARGIN_B) * dpi) - art.height
            bg.paste(art, (x, y), art)
            note = f"Cover paper with the {pattern} pattern artwork"
        else:
            print(f"note: only {max(room_in, 0):.2f}in left under the cover "
                  "text; pattern artwork omitted (as md2pdf does)")
    out = io.BytesIO()
    bg.save(out, "PNG", optimize=True)
    return out.getvalue(), note


def logo_size(path, height_in):
    with Image.open(path) as im:
        w, h = im.size
    return height_in * w / h, height_in


def run(text, extra=""):
    return (f'<w:r>{extra}<w:t xml:space="preserve">{esc(text)}</w:t></w:r>')


def para(style, inner, ppr_extra=""):
    return (f'<w:p><w:pPr><w:pStyle w:val="{style}"/>{ppr_extra}</w:pPr>'
            f'{inner}</w:p>')


def lines_with_breaks(text):
    segs = text.split("\n")
    return "".join(run(s) + ('<w:r><w:br/></w:r>' if i < len(segs) - 1 else "")
                   for i, s in enumerate(segs))


def build_cover(pkg, spec, spec_dir, sect_pr_xml):
    rels = pkg.rels
    bg_png, bg_alt = render_background(spec)
    bg_rid = pkg.add_media(bg_png, "png", rels)

    # Meta row: eyebrow + date | GL logo | partner logos
    left = ""
    if spec.get("series"):
        left += para("CoverSeries", run(spec["series"]))
    if spec.get("date"):
        left += para("Date", run(spec["date"]), '<w:spacing w:after="0"/>')
    left = left or para("Date", "")
    # The background anchor gets its own 1pt paragraph ahead of the meta
    # table: Word 2013+ lays out anything anchored inside a table cell
    # relative to the cell, whatever layoutInCell says.
    anchor_p = ('<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" '
                'w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr>'
                + page_background(pkg, bg_rid, bg_alt) + '</w:p>')

    gl_rid = pkg.add_media(open(GL_LOGO, "rb").read(), "png", rels)
    partners = spec.get("partner_logos", [])
    # Nil: 36px GL logo. With partner logos the pair steps down (GL 28px,
    # partner 30px) as md2pdf does, then shrinks further if the row would
    # still be wider than its cell (Word would wrap it onto a second line).
    gl_h, p_h = (px_in(28), px_in(30)) if partners else (px_in(36), 0)
    # separator run: em space + bar + em space, at sep_pt
    sep_pt = (p_h * 72 * 0.6) if partners else 0
    sep_in = sep_pt * 2.4 / 72
    cell_in = LIVE_W - 3600 / TW - 0.15
    need = logo_size(GL_LOGO, gl_h)[0] + sum(
        logo_size(os.path.join(spec_dir, lg["src"]), p_h)[0] + sep_in
        for lg in partners)
    k = min(1.0, cell_in / need)
    gw, gh = logo_size(GL_LOGO, gl_h * k)
    logos = inline_pic(pkg, gl_rid, "GL logo", "Growth Lab", gw, gh)
    for lg in partners:
        src = os.path.join(spec_dir, lg["src"])
        ext = os.path.splitext(src)[1].lower().lstrip(".")
        rid = pkg.add_media(open(src, "rb").read(), ext, rels)
        pw, ph = logo_size(src, p_h * k)
        # hairline separator in `rule` grey, as on the PDF cover
        logos += (run(" | ", '<w:rPr><w:color w:val="DDDDDD"/>'
                      f'<w:sz w:val="{round(sep_pt * k * 2)}"/></w:rPr>')
                  + inline_pic(pkg, rid, os.path.basename(src),
                               lg.get("alt", ""), pw, ph))
    right = (f'<w:p><w:pPr><w:pStyle w:val="Date"/><w:spacing w:after="0"/>'
             f'<w:jc w:val="right"/></w:pPr>{logos}</w:p>')

    def cell(w, inner):
        return (f'<w:tc><w:tcPr><w:tcW w:w="{w}" w:type="dxa"/>'
                '<w:vAlign w:val="top"/></w:tcPr>' + inner + '</w:tc>')

    live = round(LIVE_W * TW)
    meta = (f'<w:tbl><w:tblPr><w:tblW w:w="{live}" w:type="dxa"/>'
            '<w:tblLayout w:type="fixed"/>'
            '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/>'
            '<w:bottom w:val="nil"/><w:right w:val="nil"/>'
            '<w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>'
            '<w:tblCellMar><w:left w:w="0" w:type="dxa"/>'
            '<w:right w:w="0" w:type="dxa"/></w:tblCellMar>'
            '<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" '
            'w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/>'
            '</w:tblPr><w:tblGrid><w:gridCol w:w="3600"/>'
            f'<w:gridCol w:w="{live - 3600}"/></w:tblGrid><w:tr>'
            + cell(3600, left) + cell(live - 3600, right) + '</w:tr></w:tbl>')

    body = anchor_p + meta
    # Display title: 1in below the meta row (md2pdf's gap), 24px to the rule; the
    # style's own full-width rule is switched off in favour of the 50% rule.
    # Leading is set exactly (56px x 1.2): Source Serif 4's tall
    # ascender/descender metrics make Word's "auto" leading far looser.
    body += para("Title", lines_with_breaks(spec["title"]),
                 '<w:pBdr><w:bottom w:val="nil"/></w:pBdr>'
                 f'<w:spacing w:before="{TW}" w:after="{px_tw(24)}" '
                 f'w:line="{px_tw(56 * 1.2)}" w:lineRule="exact"/>')
    # Title rule: 3px accent, 50% of the live width, left-anchored, 32px below.
    body += ('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" '
             f'w:sz="{round(px_pt(3) * 8)}" w:space="1" w:color="{ACCENT}"/></w:pBdr>'
             f'<w:spacing w:before="0" w:after="{px_tw(32)}" w:line="240" w:lineRule="exact"/>'
             f'<w:ind w:right="{round(LIVE_W * TW / 2)}"/><w:rPr><w:sz w:val="4"/></w:rPr></w:pPr></w:p>')
    if spec.get("subtitle"):
        body += para("Subtitle", lines_with_breaks(spec["subtitle"]),
                     f'<w:spacing w:after="{px_tw(24)}"/>')
    for a in spec.get("authors", []):
        body += para("Author", lines_with_breaks(a))
    for i, n in enumerate(spec.get("note", [])):
        extra = f'<w:ind w:right="{round(LIVE_W * TW / 4)}"/>' + (
            '' if i == 0 else '<w:spacing w:before="0"/>')
        body += para("CoverNote", lines_with_breaks(n), extra)

    # Close the cover section: same page geometry, no header/footer refs,
    # so page 1 has no running head or folio.
    body += f'<w:p><w:pPr>{sect_pr_xml}</w:pPr></w:p>'
    return body


def cover_sect_pr(body):
    last = body.find("w:sectPr", NS)
    pgsz = last.find("w:pgSz", NS) if last is not None else None
    pgsz_xml = (etree.tostring(pgsz).decode() if pgsz is not None
                else '<w:pgSz w:w="12240" w:h="15840"/>')
    pgsz_xml = re.sub(r'\sxmlns:\w+="[^"]+"', "", pgsz_xml)
    return (f'<w:sectPr>{pgsz_xml}'
            '<w:pgMar w:top="1440" w:right="1440" w:bottom="1800" '
            'w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>'
            '<w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr>')


def frag(xml):
    root = etree.fromstring(f'<w:body {NSDECL}>{xml}</w:body>')
    return list(root)


# ---------------------------------------------------------------------------
# Running head + folio
# ---------------------------------------------------------------------------

HDR_CT = "application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"
FTR_CT = "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"


def add_chrome(pkg, head_text):
    n = 1
    while f"word/headerGL{n}.xml" in pkg.parts:
        n += 1
    hname, fname = f"headerGL{n}.xml", f"footerGL{n}.xml"

    hrels = etree.Element("{%s}Relationships" % PKG_R, nsmap={None: PKG_R})
    pkg.parts["word/media/gl_head_logo.png"] = open(GL_LOGO, "rb").read()
    pkg.ensure_default("png", "image/png")
    logo_rid = pkg.add_rel(hrels, REL_IMAGE, "media/gl_head_logo.png")
    lw, lh = logo_size(GL_LOGO, px_in(25))       # Nil: 25px running-head logo
    logo = inline_pic(pkg, logo_rid, "GL logo", "Growth Lab", lw, lh)

    header = (f'<w:hdr {NSDECL}><w:p><w:pPr><w:pStyle w:val="Header"/>'
              f'<w:pBdr><w:bottom w:val="single" w:sz="2" w:space="6" '
              f'w:color="{RULE}"/></w:pBdr>'
              f'<w:tabs><w:clear w:val="center" w:pos="{round(LIVE_W * TW / 2)}"/>'
              f'<w:clear w:val="right" w:pos="{round(LIVE_W * TW)}"/>'
              f'<w:tab w:val="right" w:pos="{round(LIVE_W * TW)}"/></w:tabs>'
              '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>'
              '<w:jc w:val="left"/></w:pPr>'
              f'{run(head_text)}<w:r><w:tab/></w:r>{logo}</w:p></w:hdr>')
    footer = (f'<w:ftr {NSDECL}><w:p><w:pPr><w:pStyle w:val="Footer"/>'
              '<w:jc w:val="right"/></w:pPr>'
              '<w:r><w:fldChar w:fldCharType="begin"/></w:r>'
              '<w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>'
              '<w:r><w:fldChar w:fldCharType="separate"/></w:r>'
              '<w:r><w:t>2</w:t></w:r>'
              '<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>')

    pkg.parts["word/" + hname] = header.encode("utf-8")
    pkg.parts["word/" + fname] = footer.encode("utf-8")
    pkg.parts[f"word/_rels/{hname}.rels"] = etree.tostring(
        hrels, xml_declaration=True, encoding="UTF-8", standalone=True)
    pkg.add_override("word/" + hname, HDR_CT)
    pkg.add_override("word/" + fname, FTR_CT)
    hrid = pkg.add_rel(pkg.rels, REL_HEADER, hname)
    frid = pkg.add_rel(pkg.rels, REL_FOOTER, fname)
    return hrid, frid


def apply_chrome(body, hrid, frid, skip_first):
    sects = body.findall(".//w:sectPr", NS)
    for i, s in enumerate(sects):
        if skip_first and i == 0:
            continue
        for el in s.findall("w:headerReference", NS) + \
                s.findall("w:footerReference", NS) + s.findall("w:titlePg", NS):
            s.remove(el)
        f = etree.Element(q("w:footerReference"))
        f.set(q("w:type"), "default")
        f.set(q("r:id"), frid)
        h = etree.Element(q("w:headerReference"))
        h.set(q("w:type"), "default")
        h.set(q("r:id"), hrid)
        s.insert(0, f)
        s.insert(0, h)
        pg = s.find("w:pgNumType", NS)
        if pg is not None and i == (1 if skip_first else 0):
            pg.attrib.pop(q("w:start"), None)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def block_text(el):
    return "".join(el.itertext()).strip()


def cmd_list(args):
    pkg = Package(args.input)
    body = pkg.doc.find("w:body", NS)
    for i, el in enumerate(list(body)[:args.n]):
        tag = etree.QName(el).localname
        style = el.find("w:pPr/w:pStyle", NS)
        flags = []
        if el.find(".//w:sectPr", NS) is not None:
            flags.append("SECTION-BREAK")
        if el.find(".//w:br[@w:type='page']", NS) is not None:
            flags.append("PAGE-BREAK")
        if el.find(".//w:drawing", NS) is not None or \
                el.find(".//w:pict", NS) is not None:
            flags.append("picture")
        print(f"{i:3d}  {tag:4s} {(style.get(q('w:val')) if style is not None else ''):16s} "
              f"{' '.join(flags):28s} {block_text(el)[:70]!r}")


def cmd_build(args):
    spec_dir = os.path.dirname(os.path.abspath(args.spec))
    spec = json.load(open(args.spec, encoding="utf-8"))
    for k in ("title",):
        if not spec.get(k):
            sys.exit(f"cover spec needs '{k}'")
    if isinstance(spec.get("note"), str):
        spec["note"] = [p for p in spec["note"].split("\n\n") if p.strip()]

    pkg = Package(args.input)
    global PX
    PX = args.px or detect_px(pkg)
    print(f"  sizes: {PX:g}pt per spec px")
    body = pkg.doc.find("w:body", NS)
    children = list(body)
    final_sect = children[-1] if etree.QName(children[-1]).localname == "sectPr" else None
    # Cover paper fills the document's own page (A4 originals stay A4).
    global PAGE_W, PAGE_H, LIVE_W, LIVE_H
    pgsz = final_sect.find("w:pgSz", NS) if final_sect is not None else None
    if pgsz is not None and pgsz.get(q("w:w")) and pgsz.get(q("w:h")):
        PAGE_W = int(pgsz.get(q("w:w"))) / TW
        PAGE_H = int(pgsz.get(q("w:h"))) / TW
        LIVE_W, LIVE_H = PAGE_W - 2 * MARGIN_L, PAGE_H - MARGIN_T - MARGIN_B
    droppable = [c for c in children if c is not final_sect]
    if args.drop_gl_cover:
        for n, c in enumerate(droppable):
            if c.find("w:pPr/w:sectPr", NS) is not None:
                args.drop = n + 1
                break
        else:
            sys.exit("--drop-gl-cover: no cover section break found")
    if args.drop > len(droppable):
        sys.exit("--drop exceeds the number of body blocks")
    dropped = droppable[:args.drop]
    # A dropped block that closed a section takes the section's geometry
    # with it; harmless, the cover section defines its own.
    for el in dropped:
        body.remove(el)

    cover_xml = build_cover(pkg, spec, spec_dir, cover_sect_pr(body))
    for i, el in enumerate(frag(cover_xml)):
        body.insert(i, el)

    if not args.no_chrome:
        head = args.running_head or spec["title"].replace("\n", " ")
        hrid, frid = add_chrome(pkg, head)
        apply_chrome(body, hrid, frid, skip_first=True)
        st = pkg.parts.get("word/settings.xml")
        if st:
            pkg.parts["word/settings.xml"] = re.sub(
                rb"<w:evenAndOddHeaders[^>]*/>", b"", st)

    pkg.save(args.output)
    print(f"Cover + chrome written: {args.output}")
    print(f"  dropped {len(dropped)} original cover block(s): "
          + "; ".join(repr(block_text(d)[:40]) for d in dropped if block_text(d)))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("list")
    a.add_argument("input")
    a.add_argument("-n", type=int, default=30)
    b = sub.add_parser("build")
    b.add_argument("input")
    b.add_argument("output")
    b.add_argument("--spec", required=True)
    b.add_argument("--drop", type=int, default=0)
    b.add_argument("--drop-gl-cover", action="store_true",
                   help="remove a GL cover an earlier build added (through its section break)")
    b.add_argument("--px", type=float, default=None,
                   help="pt per spec px (default: read from the Normal style; 12pt body -> 1)")
    b.add_argument("--running-head")
    b.add_argument("--no-chrome", action="store_true")
    args = ap.parse_args()
    {"list": cmd_list, "build": cmd_build}[args.cmd](args)


if __name__ == "__main__":
    main()
