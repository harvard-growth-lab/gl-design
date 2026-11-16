#!/usr/bin/env python3
"""make_word_fonts.py — static Regular/Italic/Bold/Bold Italic instances of the GL
variable fonts (Inter, Source Serif 4) for Word, which links styles by family
name and does not handle the variable fonts reliably. "Bold" is instanced at
weight 600, the recipe's heaviest text weight.

Also cuts "Source Serif 4 Display" Regular at opsz 60, the optical size Nil's
spec sets the cover title in (md2pdf uses it through the variable font). The
default text cut is 9% wider, so a 56pt title wraps a line early in Word.

Usage: py -3 make_word_fonts.py <gl-design>/assets/fonts <out-dir>
Then install the nine .ttf files for the current user (right-click > Install).
"""
import sys, os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

src, out = sys.argv[1], sys.argv[2]
FAMS = {
    "Inter": ("inter/ttf/InterVariable.ttf", "inter/ttf/InterVariable-Italic.ttf"),
    "Source Serif 4": ("source-serif-4/ttf/SourceSerif4Variable-Roman.ttf",
                       "source-serif-4/ttf/SourceSerif4Variable-Italic.ttf"),
    # display cut: Regular only, opsz 60 (cover title)
    "Source Serif 4 Display": ("source-serif-4/ttf/SourceSerif4Variable-Roman.ttf", None),
}
EXTRA = {"Source Serif 4 Display": {"opsz": 60}}
for fam, (roman, italic) in FAMS.items():
    for italic_flag, path in ((False, roman), (True, italic)):
        if path is None:
            continue
        for bold in (False, True):
            if fam in EXTRA and bold:
                continue
            f = TTFont(os.path.join(src, path))
            axes = {a.axisTag: a for a in f["fvar"].axes}
            loc = {"wght": 600 if bold else 400, **EXTRA.get(fam, {})}
            for tag, a in axes.items():
                if tag not in loc:
                    loc[tag] = a.defaultValue
            f = instantiateVariableFont(f, loc)
            for t in ("STAT", "avar"):
                if t in f: del f[t]
            sub = ("Bold " if bold else "") + ("Italic" if italic_flag else "")
            sub = sub.strip() or "Regular"
            full = f"{fam} {sub}" if sub != "Regular" else f"{fam} Regular"
            ps = (fam.replace(" ", "") + "GL-" + sub.replace(" ", ""))
            name = f["name"]
            name.names = [n for n in name.names if n.nameID not in (1, 2, 3, 4, 6, 16, 17, 21, 22, 25)]
            for nid, val in ((1, fam), (2, sub), (3, f"{ps};GL-static"), (4, full), (6, ps)):
                name.setName(val, nid, 3, 1, 0x409)
                name.setName(val, nid, 1, 0, 0)
            os2 = f["OS/2"]
            os2.usWeightClass = 700 if bold else 400
            fs = os2.fsSelection & ~(0b1100001)   # clear ITALIC, BOLD, REGULAR
            if bold: fs |= 0b100000
            if italic_flag: fs |= 0b1
            if not bold and not italic_flag: fs |= 0b1000000
            os2.fsSelection = fs
            f["head"].macStyle = (1 if bold else 0) | (2 if italic_flag else 0)
            fn = os.path.join(out, ps + ".ttf")
            f.save(fn)
            print(fn, os.path.getsize(fn))
