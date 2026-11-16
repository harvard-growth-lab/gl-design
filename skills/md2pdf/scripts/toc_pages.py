"""Page numbers for the md2pdf table of contents.

Chromium has no CSS target-counter(), so md2pdf numbers the TOC in passes:

    toc_pages.py mark HTML       wrap each TOC entry as text + a "000"
                                 placeholder page number
    toc_pages.py fill HTML PDF   read the page each TOC link lands on from the
                                 printed PDF's link annotations, write those
                                 numbers into the HTML; exit 3 if any number
                                 changed (md2pdf then prints again), 0 if the
                                 PDF already carries the right numbers

The PDF page index + 1 is the folio md2pdf prints (counter(page), cover = 1),
so the TOC numbers match the folios. Entries are matched by link target, never
by heading text (reports repeat "Executive Summary", "References").
"""
import re
import sys
from urllib.parse import unquote

NAV = re.compile(r'(<nav id="TOC" role="doc-toc">)(.*?)(</nav>)', re.S)
# pandoc wraps long lines, so attributes may be split by any whitespace
ENTRY = re.compile(r'<a\s+href="#([^"]+)"(\s+id="[^"]*")?>(.*?)</a>', re.S)
FILLED = re.compile(r'<a\s+href="#([^"]+)"(\s+id="[^"]*")?><span class="toc-text">(.*?)</span>'
                    r'<span class="toc-pg">([^<]*)</span></a>', re.S)


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def write(p, s):
    with open(p, "w", encoding="utf-8", newline="") as f:
        f.write(s)


def mark(html):
    s = read(html)
    m = NAV.search(s)
    if not m:
        return 0
    body = ENTRY.sub(lambda e: f'<a href="#{e.group(1)}"{e.group(2) or ""}><span class="toc-text">'
                               f'{" ".join(e.group(3).split())}</span><span class="toc-pg">000</span></a>', m.group(2))
    write(html, s[:m.start(2)] + body + s[m.end(2):])
    return 0


def fill(html, pdf):
    import fitz
    doc = fitz.open(pdf)
    page_of = {}
    for pg in doc:
        for ln in pg.get_links():
            dest = ln.get("nameddest")
            if dest and ln.get("page", -1) >= 0:
                page_of.setdefault(unquote(dest), ln["page"] + 1)
    s = read(html)
    m = NAV.search(s)
    if not m:
        return 0
    changed, missing = 0, []

    def sub(e):
        nonlocal changed
        target = unquote(e.group(1))
        num = page_of.get(target)
        if num is None:
            missing.append(target)
            num_s = ""
        else:
            num_s = str(num)
        if num_s != e.group(4):
            changed += 1
        return (f'<a href="#{e.group(1)}"{e.group(2) or ""}><span class="toc-text">{e.group(3)}</span>'
                f'<span class="toc-pg">{num_s}</span></a>')

    body = FILLED.sub(sub, m.group(2))
    write(html, s[:m.start(2)] + body + s[m.end(2):])
    if missing:
        print("Warning: TOC entries with no page found: " + ", ".join(missing[:8]), file=sys.stderr)
    return 3 if changed else 0


if __name__ == "__main__":
    if sys.argv[1] == "mark":
        sys.exit(mark(sys.argv[2]))
    sys.exit(fill(sys.argv[2], sys.argv[3]))
