"""Growth Lab chart theme for **Python / matplotlib** — the slide-bound chart path.

The design kit's chart tooling is R/ggplot (`gl-ggplot`'s `theme_gl.R`). This module is
its Python counterpart, scoped to what a slide needs: the same tokens, the same palettes,
the same axis conventions, the same named figure sizes — so a matplotlib chart and a
ggplot chart land on a slide looking like siblings.

It is a downstream encoding of `grammar.md` section 3 and `recipes/slide.md`; colors are
imported from `gl_pptx.py` rather than re-copied, so there is exactly one Python copy of
the palette to keep in sync.

Usage:

    import gl_chart as gc
    gc.gl_setup()                                  # slide mode (the default here)
    fig, ax = gc.subplots()
    ax.plot(x, y)                                  # inherits the muted default
    ax.plot(x, y_focus, color=gc.gl["highlight"], linewidth=gc.FOCUS_LW)
    gc.style_axes(ax, ylabel="Share of exports (%)")
    gc.save_fig(fig, "slide", "exports.png")

Two conventions worth knowing:

  1. **Geoms default to muted.** Lines and bars start in `c-muted`, so "highlight by
     muting" (grammar section 3.1 / rule 4) is the path of least resistance: paint the
     focus series explicitly, leave the rest alone.
  2. **In-chart text uses the deck's font.** A chart headed for a gl-pptx deck matches the
     template master (Source Sans Pro) so the slide reads as one artifact — the same
     documented pptx exception as the deck builders. For a chart headed for a REPORT, pass
     `gl_setup(family="Inter")` to get the grammar's default in-chart family.
"""
from __future__ import annotations

import warnings
from pathlib import Path

import matplotlib as mpl
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap, TwoSlopeNorm
from matplotlib.ticker import FuncFormatter
import matplotlib.patheffects as pe

from gl_pptx import (INK, ACCENT, PAPER, CAT, MUTED, SEQUENTIAL, DIVERGING,
                     FIG_SIZES, label_color, categorical, emphasis)

# ───────────────────────── tokens, R-compatible names ─────────────────────────
# Mirrors theme_gl.R's `gl` list so a Python and an R chart script read the same.
gl = {
    "ink": INK["ink"], "ink_2": INK["ink-2"], "ink_3": INK["ink-3"], "ink_4": INK["ink-4"],
    "accent": ACCENT["accent"], "accent_tint": ACCENT["accent-tint"],
    "paper": PAPER["paper"], "paper_warm": PAPER["paper-warm"],
    "rule": PAPER["rule"], "gridline": PAPER["gridline"],
    "c_muted": MUTED["main"], "c_muted_light": MUTED["light"], "c_muted_dark": MUTED["dark"],
}
for _i in range(1, 7):
    _k = "c-" + str(_i)
    gl["c_" + str(_i)] = CAT[_k]["main"]
    gl["c_" + str(_i) + "_light"] = CAT[_k]["light"]
    gl["c_" + str(_i) + "_dark"] = CAT[_k]["dark"]
gl["highlight"] = gl["c_1"]              # the institutional voice
gl["lead_finding"] = gl["c_2"]           # the stark-emphasis red

# ───────────────────────── line weights (grammar section 3.4) ─────────────────────────
# The grammar specifies px; matplotlib linewidth is in points, and 1 px at 96 DPI =
# 0.75 pt (the same x0.75 the deck uses for type).
HAIRLINE_LW = 0.75          # 1px — axis line, ticks, gridlines, zero baseline
LINE_LW = 1.50              # 2px — standard series line
FOCUS_LW = 1.80             # 2.4px — the highlighted focus line
MAP_LW = 0.375              # 0.5px — choropleth polygon borders

# Base font sizes: slide charts are read at distance (recipe: body 24px). The R theme uses
# base_size 12 for slide, 9 for report; matched here.
BASE_SIZE = {"slide": 12, "report": 9}
FONT_STACK = {
    # Deck-matching stack (default) then the grammar's in-chart family, then fallbacks.
    "Source Sans Pro": ["Source Sans Pro", "Source Sans 3", "Inter", "DejaVu Sans"],
    "Inter": ["Inter", "Source Sans Pro", "Source Sans 3", "DejaVu Sans"],
}
_MODE = "slide"


def available_font(family: str = "Source Sans Pro") -> str:
    """First font in the stack actually installed, so a missing font degrades to a
    readable fallback instead of matplotlib's silent box-glyph substitution."""
    try:
        from matplotlib import font_manager
        installed = {f.name for f in font_manager.fontManager.ttflist}
    except Exception:
        return family
    for cand in FONT_STACK.get(family, [family]):
        if cand in installed:
            return cand
    warnings.warn(
        "None of " + str(FONT_STACK.get(family, [family])) + " is installed; matplotlib "
        "will use its default face. Install the fonts (scripts/install-fonts.sh) or the "
        "chart will not match the deck.")
    return family


def gl_setup(mode: str = "slide", family: str = "Source Sans Pro", base_size: int = None):
    """Apply the GL chart theme globally. `mode` is 'slide' (default here — charts headed
    for a deck) or 'report'. Only these two exist; anything else is an error, matching
    `theme_gl.R`'s `match.arg`."""
    global _MODE
    if mode not in BASE_SIZE:
        raise ValueError("mode must be 'slide' or 'report', not " + repr(mode))
    _MODE = mode
    size = base_size or BASE_SIZE[mode]
    fam = available_font(family)
    mpl.rcParams.update({
        "font.family": fam,
        "font.size": size,
        "text.color": gl["ink_2"],
        "figure.facecolor": gl["paper"],
        "figure.dpi": 100,
        "savefig.facecolor": gl["paper"],
        "savefig.bbox": "tight",
        "axes.facecolor": gl["paper"],
        "axes.edgecolor": gl["ink_2"],
        "axes.linewidth": HAIRLINE_LW,
        "axes.labelcolor": gl["ink_2"],
        "axes.labelsize": size,
        "axes.labelweight": "medium",              # grammar: axis label Inter 500
        "axes.titlesize": size * 1.3,
        "axes.titlecolor": gl["ink"],
        "axes.titlelocation": "left",
        "axes.titleweight": "medium",
        "axes.spines.top": False,                  # grammar section 3.5
        "axes.spines.right": False,
        "axes.grid": False,                        # opt in per chart, never both axes
        # The cycle is a SINGLE muted grey, not the categorical palette: an unpainted
        # series must recede so "highlight by muting" is the default outcome (grammar
        # rule 4). Reach for distinct hues explicitly — `ax.set_prop_cycle(**cycle(n))`
        # — and only when the categories are genuinely unrelated (rule 5, ceiling of 6).
        "axes.prop_cycle": mpl.cycler(color=[MUTED["main"]]),
        "grid.color": gl["gridline"],
        "grid.linewidth": HAIRLINE_LW,
        "grid.linestyle": "-",
        "xtick.color": gl["ink_2"], "ytick.color": gl["ink_2"],
        "xtick.labelcolor": gl["ink_2"], "ytick.labelcolor": gl["ink_2"],
        "xtick.labelsize": size * 0.92, "ytick.labelsize": size * 0.92,
        "xtick.direction": "out", "ytick.direction": "out",   # never inward
        "xtick.major.size": 3.0, "ytick.major.size": 3.0,     # 4px
        "xtick.major.width": HAIRLINE_LW, "ytick.major.width": HAIRLINE_LW,
        "xtick.major.pad": 4.5, "ytick.major.pad": 4.5,       # 6px offset
        "lines.linewidth": LINE_LW,
        "lines.solid_joinstyle": "round",
        "lines.color": gl["c_muted"],              # default series = muted
        "patch.edgecolor": gl["paper"],
        "patch.linewidth": HAIRLINE_LW,
        "legend.frameon": False,
        "legend.fontsize": size * 0.92,
        "legend.labelcolor": gl["ink_2"],
        "svg.fonttype": "none",
    })
    return mpl.rcParams


def subplots(size: str = "slide", **kw):
    """`plt.subplots` at one of the named figure sizes (default the 16:9 slide size)."""
    wh = FIG_SIZES[size] if isinstance(size, str) else size
    return plt.subplots(figsize=wh, **kw)


# ───────────────────────── axes conventions (grammar section 3.5) ─────────────────────────
def style_axes(ax, ylabel: str = None, xlabel: str = None, grid: str = "y",
               zero_line: bool = None, thousands: bool = True, year_axis: bool = False):
    """Apply the grammar's axis conventions to one Axes.

      - gridlines on ONE axis only (default y), 1px `gridline`, behind the data;
      - y tick labels right-aligned (flush to the axis), x labels top-aligned;
      - the zero baseline drawn at axis weight, not gridline weight;
      - thousands separators on numeric ticks (tabular figures come from the font);
      - `year_axis=True` drops the x label entirely — the ticks already say 'years'.
    """
    if grid in ("y", "both"):
        ax.yaxis.grid(True, color=gl["gridline"], linewidth=HAIRLINE_LW)
    if grid in ("x", "both"):
        ax.xaxis.grid(True, color=gl["gridline"], linewidth=HAIRLINE_LW)
    ax.set_axisbelow(True)
    if ylabel:
        ax.set_ylabel(ylabel, labelpad=15)          # ~20px from the tick labels
    if xlabel and not year_axis:
        ax.set_xlabel(xlabel, labelpad=15)
    if year_axis:
        ax.set_xlabel("")
    for lbl in ax.get_yticklabels():
        lbl.set_horizontalalignment("right")
    for lbl in ax.get_xticklabels():
        lbl.set_verticalalignment("top")
    if thousands:
        ax.yaxis.set_major_formatter(FuncFormatter(
            lambda v, _p: "{:,.0f}".format(v) if abs(v) >= 1000 else "{:g}".format(v)))
    lo, hi = ax.get_ylim()
    if zero_line is None:
        zero_line = lo < 0 < hi
    if zero_line:
        ax.axhline(0, color=gl["ink_2"], linewidth=HAIRLINE_LW, zorder=2)
    return ax


def chart_text(ax, eyebrow: str = None, title: str = None, subtitle: str = None,
               source: str = None):
    """Draw the figure-block text roles that belong INSIDE the image.

    In `slide` mode this is on by default: a standalone PNG going onto a slide carries its
    own title and source. In `report` mode the document owns them, so pass them to the
    document instead and leave this alone. Chart titles end with a period — they are
    findings, not labels (grammar rule 10).
    """
    fig = ax.figure
    # Built bottom-up so the block reads, top to bottom, eyebrow -> title -> subtitle
    # (recipe section 4). In figure coords a larger y sits higher on the page.
    y = 1.01
    if subtitle:
        fig.text(0.0, y, subtitle, color=gl["ink_3"],
                 size=mpl.rcParams["font.size"], ha="left", va="bottom")
        y += 0.055
    if title:
        if not title.rstrip().endswith((".", "?", "!")):
            warnings.warn("chart titles end with a period (they read as findings): "
                          + repr(title))
        fig.text(0.0, y, title, color=gl["ink"], weight="medium",
                 size=mpl.rcParams["font.size"] * 1.3, ha="left", va="bottom")
        y += 0.075
    if eyebrow:
        fig.text(0.0, y, eyebrow.upper(), color=gl["accent"], weight="semibold",
                 size=mpl.rcParams["font.size"] * 0.72, ha="left", va="bottom")
    if source:
        fig.text(0.0, -0.08, source, color=gl["ink_2"], style="italic",
                 size=mpl.rcParams["font.size"] * 0.88, ha="left", va="top")
    return ax


def endlabel(ax, x, y, text, color, size=None, halo=True):
    """A direct end-label on a series. The glyphs take the series' **dark** tone (grammar
    rule 6) and carry a thin `paper` halo so they stay legible over marks (section 3.5)."""
    t = ax.text(x, y, text, color=label_color(color), va="center", ha="left",
                size=size or mpl.rcParams["font.size"] * 0.92, weight="semibold")
    if halo:
        t.set_path_effects([pe.withStroke(linewidth=2.0, foreground=gl["paper"])])
    return t


# ───────────────────────── color helpers ─────────────────────────
def dark(hex_color: str) -> str:
    """The dark tone to use for any text or stroke naming a mark of this color."""
    return label_color(hex_color)


def cmap(palette: str = "sequential-1", n: int = 256):
    """A matplotlib colormap from a grammar ramp. Darker = higher (grammar section 3.6)."""
    stops = SEQUENTIAL.get(palette) or DIVERGING.get(palette)
    if stops is None:
        raise KeyError("unknown ramp " + repr(palette) + "; have "
                       + str(list(SEQUENTIAL) + list(DIVERGING)))
    return LinearSegmentedColormap.from_list(palette, stops, N=n)


def diverging_norm(vmin: float, vmax: float, midpoint: float = 0.0):
    """Pin a diverging ramp's hue boundary to the data's real reference point. Without
    this the boundary lands mid-RANGE and the chart lies (grammar section 3.6)."""
    return TwoSlopeNorm(vmin=vmin, vcenter=midpoint, vmax=vmax)


def cycle(n: int, tone: str = "main") -> dict:
    """Explicit categorical cycling for genuinely unrelated categories:
    `ax.set_prop_cycle(**gc.cycle(3))`. Raises past 6 (grammar rule 5). Prefer tones of
    one hue when the categories share a parent (rule 7)."""
    return {"color": categorical(n, tone)}


def mute_and_highlight(categories, focus, focus_token: str = "c-1") -> dict:
    """{category: color} with the focus series in c-1 (or c-2 for a lead finding) and
    everything else in c-muted."""
    return emphasis(categories, focus, focus_token)


# ───────────────────────── output ─────────────────────────
def save_fig(fig, size: str = "slide", filename: str = "figure.png", dpi: int = 300,
             out_dir: Path | str = None):
    """Save at one of the named sizes (`gl_pptx.FIG_SIZES`, which mirror gl-ggplot's).

    For a deck, prefer `gl_pptx.export_fig(...)` — it saves at these same sizes AND
    records the title/source/language in `figures.json` so the deck builder can find it.
    """
    wh = FIG_SIZES[size] if isinstance(size, str) else size
    fig.set_size_inches(*wh)
    out = Path(out_dir) / filename if out_dir else Path(filename)
    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(str(out), dpi=dpi, bbox_inches="tight", facecolor=gl["paper"])
    return out


if __name__ == "__main__":
    import numpy as np
    gl_setup()
    x = np.arange(2010, 2025)
    rng = np.random.default_rng(7)
    fig, ax = subplots("slide")
    for i in range(6):                              # backdrop: muted by default
        ax.plot(x, 100 + np.cumsum(rng.normal(0, 4, len(x))))
    focus = 100 + np.cumsum(rng.normal(2.2, 3, len(x)))
    ax.plot(x, focus, color=gl["highlight"], linewidth=FOCUS_LW)
    endlabel(ax, x[-1] + 0.2, focus[-1], "Focus", gl["highlight"])
    style_axes(ax, ylabel="Index (2010 = 100)", year_axis=True)
    chart_text(ax, eyebrow="Figure 1", title="The focus series pulls away after 2018.",
               source="Source: Growth Lab analysis of example data.")
    print("wrote", save_fig(fig, "slide", "_gl_chart_smoke.png",
                            out_dir=Path(__file__).parent))
