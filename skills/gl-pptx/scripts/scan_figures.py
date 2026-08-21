#!/usr/bin/env python
"""Find the figures in an analysis file, and say which are deck-ready.

Given a `.py`, `.ipynb` or `.R` file, this reports every place a figure is built or
written, and whether it goes through `export_fig(...)` (deck-ready, with a manifest entry)
or just `savefig`/`ggsave`/`show` (not deck-ready). It reads only — it never executes the
file, because running someone's analysis to get a picture is not a safe side effect.

Use it to answer "what figures does this analysis already have, and what do I still need?"
before building a deck.

Usage:
    scan_figures.py analysis.py
    scan_figures.py notebooks/exports.ipynb --group exports     # cross-check figs/<group>
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gl_pptx as gp                                            # noqa: E402

# kind -> (regex, deck_ready)
PATTERNS = {
    "export_fig":  (re.compile(r"\bexport_fig\s*\("), True),
    "gl_save_fig": (re.compile(r"\bsave_fig\s*\("), False),
    "savefig":     (re.compile(r"\.savefig\s*\("), False),
    "ggsave":      (re.compile(r"\bggsave\s*\("), False),
    "show":        (re.compile(r"\bplt\.show\s*\(|\bprint\s*\(\s*p\s*\)"), False),
    # `subplots(` unqualified catches plt.subplots, gc.subplots and a bare import
    "builds":      (re.compile(r"\bsubplots\s*\(|\bplt\.figure\s*\(|\bggplot\s*\("), False),
}
_NAME = re.compile(r"""["']([^"']+?)["']""")


def _lines(path: Path):
    """(lineno, text) for a .py/.R file, or for every code cell of a notebook."""
    if path.suffix == ".ipynb":
        nb = json.loads(path.read_text(encoding="utf-8"))
        out = []
        for ci, cell in enumerate(nb.get("cells", []), start=1):
            if cell.get("cell_type") != "code":
                continue
            for li, line in enumerate(cell.get("source", []), start=1):
                out.append(("cell " + str(ci) + ":" + str(li), line.rstrip("\n")))
        return out
    return [(str(i), t) for i, t in
            enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), 1)]


def scan(path: Path) -> dict:
    hits = []
    for loc, text in _lines(path):
        if text.lstrip().startswith("#"):
            continue
        for kind, (rx, ready) in PATTERNS.items():
            if rx.search(text):
                names = _NAME.findall(text)
                hits.append({"loc": loc, "kind": kind, "deck_ready": ready,
                             "name": names[0] if names else None,
                             "code": text.strip()[:90]})
    return {"path": str(path), "hits": hits}


def report(path: Path, group: str = None, figs_root=None) -> int:
    res = scan(path)
    hits = res["hits"]
    print("[scan_figures] " + res["path"])
    if not hits:
        print("  no figure-producing code found.")
    builds = [h for h in hits if h["kind"] == "builds"]
    exported = [h for h in hits if h["kind"] == "export_fig"]
    other = [h for h in hits if h["kind"] not in ("builds", "export_fig")]
    print("  figures built: " + str(len(builds))
          + " | export_fig calls: " + str(len(exported))
          + " | other saves/shows: " + str(len(other)))
    for h in hits:
        flag = "deck-ready" if h["deck_ready"] else "not deck-ready"
        name = " " + repr(h["name"]) if h["name"] else ""
        print("    " + h["loc"].rjust(10) + "  " + h["kind"].ljust(11)
              + name.ljust(28) + flag)

    if group:
        found = gp.find_fig(group, root=figs_root) or []
        print("  figs/" + group + ": " + str(len(found)) + " exported image(s)")
        for e in found:
            langs = e.get("lang") or "-"
            print("    - " + str(e.get("name")) + " [" + str(langs) + "] " + e["file"])

    if builds and not exported:
        print("\n  Next step: the figures here are built but never exported. Add an "
              "export_fig(...)\n  call in the cell/function that BUILDS each one, so "
              "they regenerate with the analysis:\n"
              "      import gl_pptx as gp\n"
              "      gp.export_fig(fig, \"<group>\", \"<chart-name>\", "
              "title=\"Finding.\", source=\"Source: ...\")")
    elif other and not exported:
        print("\n  Next step: these figures are saved with savefig/ggsave, so the deck "
              "cannot look up\n  their title/source/language. Switch them to "
              "export_fig(...) to make them deck-ready.")
    return 0 if hits else 1


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("path", help=".py, .ipynb or .R file to scan (never executed)")
    ap.add_argument("--group", default=None,
                    help="cross-check against the exported figures in figs/<group>")
    ap.add_argument("--figs-root", default=None, help="override the figs/ root")
    a = ap.parse_args(argv)
    p = Path(a.path)
    if not p.exists():
        ap.error("file not found: " + str(p))
    return report(p, a.group, a.figs_root)


if __name__ == "__main__":
    raise SystemExit(main())
