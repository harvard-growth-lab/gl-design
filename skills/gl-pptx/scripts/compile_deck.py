#!/usr/bin/env python
"""Compile finished section decks into one presentation.

Each input is assumed to be already on the GL template (built by gl-pptx). The compiler
opens a fresh deck on the template, adds a Title Slide, stitches every input deck's slides
in order — preserving text, images and LIVE charts — and adds a Closing Slide.

It does not audit or restyle its inputs: a section deck is the author's, and the compiled
deck gets a human review before it goes anywhere.

Usage:
    compile_deck.py part1.pptx part2.pptx part3.pptx \
        --title "Pakistan's Path to Growth" \
        --subtitle "MAY 2026" \
        --closing "Thank you." --contact "CONTACT - name@host.edu" \
        --name pakistan-fm-briefing

    compile_deck.py sections/*.pptx --title "..." --no-closing --out-dir build/
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from pptx import Presentation

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gl_pptx as gp                                            # noqa: E402


def compile_decks(inputs, title=None, subtitle="", footer="", closing=None, contact="",
                  name="compiled-deck", out_dir=None, fit=False, add_title=True,
                  add_closing=True):
    """Stitch `inputs` (paths to .pptx) into one deck. Returns the output path."""
    inputs = [Path(p) for p in inputs]
    missing = [p for p in inputs if not p.exists()]
    if missing:
        raise FileNotFoundError("input deck(s) not found: "
                                + ", ".join(str(m) for m in missing))

    prs = gp.new_deck()
    if add_title and title:
        gp.add_title_slide(prs, title, subtitle=subtitle, footer=footer)

    counts = []
    for path in inputs:
        src = Presentation(str(path))
        n = 0
        for slide in src.slides:
            dest = gp.copy_slide(slide, prs)
            if fit:
                gp.fit_above_footer(dest)
            n += 1
        counts.append((path.name, n))
        print("  + " + path.name + ": " + str(n) + " slide(s)")

    if add_closing and (closing or contact):
        gp.add_closing_slide(prs, message=closing or "", contact=contact)

    out = gp.save_deck(prs, name, out_dir=out_dir)
    print("compiled " + str(sum(c for _, c in counts)) + " section slide(s) from "
          + str(len(inputs)) + " deck(s) -> " + str(out))
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inputs", nargs="+", help="section decks, in presentation order")
    ap.add_argument("--title", help="deck title for the Title Slide")
    ap.add_argument("--subtitle", default="", help="cover meta - the date, per the recipe")
    ap.add_argument("--footer", default="", help="optional cover footer (authors)")
    ap.add_argument("--closing", help="closing message (e.g. 'Thank you.')")
    ap.add_argument("--contact", default="", help="closing contact line")
    ap.add_argument("--name", default="compiled-deck", help="output file name")
    ap.add_argument("--out-dir", default=None, help="output directory (default: cwd)")
    ap.add_argument("--fit", action="store_true",
                    help="nudge/shrink copied shapes off the footer band")
    ap.add_argument("--no-title", action="store_true", help="do not add a Title Slide")
    ap.add_argument("--no-closing", action="store_true", help="do not add a Closing Slide")
    ap.add_argument("--no-validate", action="store_true", help="skip the final check")
    a = ap.parse_args(argv)

    if not a.no_title and not a.title:
        ap.error("--title is required (or pass --no-title)")

    out = compile_decks(a.inputs, title=a.title, subtitle=a.subtitle, footer=a.footer,
                        closing=a.closing, contact=a.contact, name=a.name,
                        out_dir=a.out_dir, fit=a.fit,
                        add_title=not a.no_title, add_closing=not a.no_closing)
    if not a.no_validate:
        gp.validate_deck(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
