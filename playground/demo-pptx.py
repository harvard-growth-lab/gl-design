#!/usr/bin/env python
"""Dogfood example for the `gl-pptx` skill — the pptx twin of `demo-deck.md`.

Builds charts with `gl_chart.py`, exports them through the figs/ pipeline (including a
Spanish variant, to exercise the language feature), then assembles a deck that uses every
slide class and validates it.

    python playground/demo-pptx.py                 # -> playground/build/
    python playground/demo-pptx.py --out /tmp/x    # elsewhere

Everything it writes is derived output — regenerate rather than commit it.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "skills" / "gl-pptx" / "scripts"))

import gl_pptx as gp            # noqa: E402
import gl_chart as gc           # noqa: E402


def build_figures(figs_root: Path):
    """Three charts, each exported deck-ready. The export call sits with the code that
    builds the chart — that is the rule, so figures regenerate with the analysis."""
    gc.gl_setup()                                       # slide mode
    rng = np.random.default_rng(11)
    years = np.arange(2010, 2025)

    # 1. Highlight by muting: one focus series against a muted backdrop.
    fig, ax = gc.subplots("slide")
    for _ in range(7):
        ax.plot(years, 100 + np.cumsum(rng.normal(0, 4, len(years))))
    focus = 100 + np.cumsum(rng.normal(2.4, 3, len(years)))
    ax.plot(years, focus, color=gc.gl["highlight"], linewidth=gc.FOCUS_LW)
    gc.endlabel(ax, years[-1] + 0.2, focus[-1], "Sindh", gc.gl["highlight"])
    gc.style_axes(ax, ylabel="Index (2010 = 100)", year_axis=True)
    gp.export_fig(fig, "demo", "exports-index", title="Exports pull away after 2018.",
                  source="Source: Growth Lab analysis of example data.",
                  root=figs_root)

    # Same chart, Spanish labels -> a second language variant of the same `name`.
    fig, ax = gc.subplots("slide")
    for _ in range(7):
        ax.plot(years, 100 + np.cumsum(rng.normal(0, 4, len(years))))
    ax.plot(years, focus, color=gc.gl["highlight"], linewidth=gc.FOCUS_LW)
    gc.endlabel(ax, years[-1] + 0.2, focus[-1], "Sindh", gc.gl["highlight"])
    gc.style_axes(ax, ylabel="Índice (2010 = 100)", year_axis=True)
    gp.export_fig(fig, "demo", "exports-index", lang="es",
                  title="Las exportaciones se despegan después de 2018.",
                  source="Fuente: análisis del Growth Lab con datos de ejemplo.",
                  root=figs_root)

    # 2 & 3. A pair for a cols slide: two tones of one hue, not two unrelated colors.
    for i, (name, label) in enumerate([("composition", "Goods vs. services"),
                                       ("wages", "Wage premium")]):
        fig, ax = gc.subplots("slide_half")
        cats = ["Goods", "Services"]
        vals = rng.uniform(20, 60, (2, 5))
        bottom = np.zeros(5)
        x = np.arange(2020, 2025)
        for j, cat in enumerate(cats):
            ax.bar(x, vals[j], bottom=bottom, label=cat,
                   color=gp.CAT["c-1"]["main" if j == 0 else "light"])
            bottom += vals[j]
        ax.legend(loc="upper left")
        gc.style_axes(ax, ylabel=label, year_axis=True)
        gp.export_fig(fig, "demo", name, size="slide_half",
                      title=label + ".", source="Source: example data.", root=figs_root)


def build_deck(figs_root: Path, out_dir: Path, lang: str = "en") -> Path:
    """Assemble a section deck, one slide class at a time."""
    f = gp.find_fig("demo", "exports-index", lang=lang, root=figs_root)
    left = gp.find_fig("demo", "composition", lang=lang, root=figs_root)
    right = gp.find_fig("demo", "wages", lang=lang, root=figs_root)

    prs = gp.new_deck()
    gp.add_title_slide(prs, "A demonstration deck", subtitle="MAY 2026",
                       footer="Growth Lab")
    gp.add_break_slide(prs, "Where the economy stands")
    gp.add_content_slide(
        prs, "A macroeconomic recovery is underway",
        ["Inflation has fallen sharply and reserves have rebuilt",
         "The current account is moving toward balance",
         ("But the recovery rests on a narrow industrial base", 1)],
        source="Source: Growth Lab analysis.")
    # The figure's title/source come from the manifest per language; text the DECK supplies
    # (eyebrows, body copy, table headers) is the caller's to localise.
    gp.add_chart_slide(prs, f["title"], f["path"], source=f["source"],
                       eyebrow="Figure 1" if lang == "en" else "Figura 1")
    gp.add_cols_slide(prs, "Composition and wages move together",
                      left["path"], right["path"], source="Source: example data.")
    # An image + text column wants a HALF-width figure, not the full-slide one — a
    # 10 x 5.625 in image contained in a half-width box leaves most of the box empty.
    gp.add_cols_slide(prs, "One chart, one argument", left["path"],
                      ["Exports concentrate in three provinces",
                       "The rest have flat trajectories"],
                      source="Source: example data.")
    gp.add_map_slide(prs, "Two views, tight padding",
                     left["path"], right["path"], source="Source: example data.")
    df = pd.DataFrame({"Province": ["Sindh", "Punjab", "KP", "Balochistan"],
                       "Exports (USD m)": [12480, 9310, 2140, 870],
                       "Share (%)": [49.2, 36.7, 8.4, 3.4]})
    gp.add_table_slide(prs, "Exports concentrate in two provinces", df,
                       source="Source: Growth Lab analysis of example data.")
    gp.add_closing_slide(prs, "Thank you.", contact="CONTACT - growthlab@hks.harvard.edu")
    return gp.save_deck(prs, "demo-pptx-" + lang, out_dir=out_dir)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(ROOT / "playground" / "build"))
    ap.add_argument("--lang", default="en", help="which figure language to build with")
    a = ap.parse_args(argv)
    out_dir = Path(a.out)
    figs_root = out_dir / "figs"

    drift = gp.check_token_drift()
    print("token drift: " + ("OK (" + str(drift["checked"]) + " hexes match grammar.md)"
                             if drift["ok"] else str(drift["missing"])))
    build_figures(figs_root)
    deck = build_deck(figs_root, out_dir, lang=a.lang)
    print("built " + str(deck))
    rep = gp.validate_deck(deck)
    return 0 if rep["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
