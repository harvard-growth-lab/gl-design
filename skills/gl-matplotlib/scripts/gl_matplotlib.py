"""Growth Lab chart theme for **Python / matplotlib**.

The Python counterpart of `gl-ggplot`'s `theme_gl.R`: the same tokens, the same palettes,
the same axis conventions, the same named figure sizes — so a matplotlib chart and a ggplot
chart of the same data look like siblings.

    import gl_matplotlib as gm
    gm.gl_setup()                                  # 'report' mode
    fig, ax = gm.subplots("full")
    ax.plot(x, y)                                  # muted by default
    ax.plot(x, y_focus, color=gm.gl["highlight"], linewidth=gm.FOCUS_LW)
    gm.style_axes(ax, ylabel="Share of exports (%)")
    gm.save_fig(fig, "full", "exports.png")

This file is a downstream encoding of `grammar.md` section 3 (see the README's drift
table). It carries its own copy of the palette exactly as `theme_gl.R` carries the R copy;
`check_token_drift()` verifies every hex against `grammar.md`, so a divergence fails loudly
instead of silently.

Two conventions worth knowing:

  1. **Geoms default to muted.** The prop cycle is a single `c-muted` grey, not the
     categorical palette, so "highlight by muting" (grammar section 3.1 / rule 4) is the
     path of least resistance: paint the focus series explicitly and leave the rest alone.
     Opt into distinct hues with `ax.set_prop_cycle(**gm.cycle(n))`.
  2. **Mode picks the base size and who owns the titles.** `report` (default, base 9 pt)
     assumes the document prints the figure label, title and source — so don't draw them
     into the image. `slide` (base 12 pt) is for a chart read at distance; if it travels
     alone, `chart_text()` draws the figure block into the image. A chart headed for a
     `gl-pptx` deck uses `slide` sizing but leaves `chart_text()` alone — the slide's own
     placeholders carry the title and source.
"""
from __future__ import annotations

import os
import warnings
from pathlib import Path

import matplotlib as mpl
import matplotlib.pyplot as plt
import matplotlib.patheffects as pe
from matplotlib.colors import LinearSegmentedColormap, TwoSlopeNorm
from matplotlib.ticker import FuncFormatter

# ───────────────────────── grammar tokens (grammar.md section 1) ─────────────────────────
INK = {"ink": "#1A1714", "ink-2": "#2C2823", "ink-3": "#4F4A42", "ink-4": "#9A9389"}
ACCENT = {"accent": "#1A5A8E", "accent-deep": "#003E6B",
          "accent-soft": "#3A85B8", "accent-tint": "#E1F0FA"}
PAPER = {"paper": "#FFFFFF", "cover-bg": "#F3F2EA", "cover-disk": "#ECEBE0",
         "paper-warm": "#F4F1EA", "rule": "#DDDDDD", "gridline": "#D8D4CC"}

CAT = {
    "c-1": {"light": "#B5D5EA", "main": "#2F87C8", "dark": "#1A5A8E"},
    "c-2": {"light": "#E89C9C", "main": "#CC4948", "dark": "#8A2C2B"},
    "c-3": {"light": "#92D6BF", "main": "#2AA584", "dark": "#1A6B53"},
    "c-4": {"light": "#B5A0CC", "main": "#7554A3", "dark": "#4A3470"},
    "c-5": {"light": "#F4BC8A", "main": "#EA822D", "dark": "#A8580F"},
    "c-6": {"light": "#E6E2A8", "main": "#CDC86B", "dark": "#8A8638"},
}
MUTED = {"light": "#CDD2D9", "main": "#AFB5BE", "dark": "#5F6773"}

SEQUENTIAL = {
    "sequential-1": ["#E5F0F9", "#B5D5EA", "#6FA5CE", "#2F87C8", "#1A5A8E"],
    "sequential-2": ["#F4D5D5", "#E89C9C", "#DC6F6E", "#CC4948", "#8A2C2B"],
    "sequential-3": ["#D5EFE7", "#92D6BF", "#5BC0A0", "#2AA584", "#1A6B53"],
    "sequential-4": ["#E5DDF0", "#B5A0CC", "#9276BA", "#7554A3", "#4A3470"],
    "sequential-5": ["#FBE5D5", "#F4BC8A", "#EE9A52", "#EA822D", "#A8580F"],
    "sequential-6": ["#FBF8DC", "#E6E2A8", "#DCD68E", "#CDC86B", "#8A8638"],
}
DIVERGING = {
    "div-2-1": ["#8A2C2B", "#DC6F6E", "#EFC7C0", "#C5DCEC", "#6FA5CE", "#1A5A8E"],
    "div-3-1": ["#1A6B53", "#5BC0A0", "#BDE5D8", "#C5DCEC", "#6FA5CE", "#1A5A8E"],
    "div-5-1": ["#A8580F", "#EE9A52", "#F4BC8A", "#C5DCEC", "#6FA5CE", "#1A5A8E"],
    "div-6-1": ["#8A8638", "#DCD68E", "#E6E2A8", "#C5DCEC", "#6FA5CE", "#1A5A8E"],
}

# The `gl` dict mirrors theme_gl.R's `gl` list, name for name, so an R script and a Python
# script read the same. Never hardcode a hex — reach for these.
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


def token(name: str) -> str:
    """Resolve a grammar token name to its hex: 'ink-2', 'accent', 'c-3.dark', 'c-muted',
    'paper', 'gridline', 'sequential-1.2'."""
    for group in (INK, ACCENT, PAPER):
        if name in group:
            return group[name]
    if name == "c-muted":
        return MUTED["main"]
    if name in ("c-muted-light", "c-muted-dark"):
        return MUTED[name.rsplit("-", 1)[1]]
    if "." in name:
        base, part = name.rsplit(".", 1)
        if base in CAT:
            return CAT[base][part]
        if base in SEQUENTIAL:
            return SEQUENTIAL[base][int(part)]
        if base in DIVERGING:
            return DIVERGING[base][int(part)]
    if name in CAT:
        return CAT[name]["main"]
    raise KeyError("unknown grammar token: " + repr(name))


def categorical(n: int, tone: str = "main") -> list:
    """First `n` categorical colors in grammar order (c-1 first). Six is a hard ceiling
    (grammar rule 5) — past that, mute the rest instead of adding hues."""
    if n > 6:
        raise ValueError(
            str(n) + " categorical colors requested; grammar rule 5 caps a chart at 6. "
            "Mute the rest with MUTED and let one or two focus series carry the story.")
    return [CAT["c-" + str(i)][tone] for i in range(1, n + 1)]


def cycle(n: int, tone: str = "main") -> dict:
    """Explicit categorical cycling for genuinely unrelated categories:
    `ax.set_prop_cycle(**gm.cycle(3))`. Prefer tones of one hue when the categories share
    a parent (grammar rule 7)."""
    return {"color": categorical(n, tone)}


def mute_and_highlight(categories, focus, focus_token: str = "c-1") -> dict:
    """{category: color} with the focus series in c-1 (or c-2 for a lead finding) and
    everything else in c-muted (grammar section 3.1 / rule 4)."""
    focus_set = {focus} if isinstance(focus, str) else set(focus)
    hi = CAT[focus_token]["main"]
    return {c: (hi if c in focus_set else MUTED["main"]) for c in categories}


def dark(hex_color: str) -> str:
    """The dark tone required for any text or stroke naming a mark of this color
    (grammar rule 6 — no exceptions, including the muted grey)."""
    up = hex_color.upper()
    for tones in list(CAT.values()) + [MUTED]:
        if up in (tones["main"].upper(), tones["light"].upper(), tones["dark"].upper()):
            return tones["dark"]
    return INK["ink-2"]


def design_root() -> Path | None:
    """Locate the gl-design plugin root (holds grammar.md). GL_DESIGN_ROOT ->
    CLAUDE_PLUGIN_ROOT -> this script's own location, mirroring theme_gl.R."""
    here = Path(__file__).resolve()
    for cand in (os.environ.get("GL_DESIGN_ROOT"),
                 os.environ.get("CLAUDE_PLUGIN_ROOT"),
                 here.parents[3]):
        if cand and (Path(cand) / "grammar.md").exists():
            return Path(cand)
    return None


def check_token_drift(root: Path | None = None) -> dict:
    """Verify every hex in this file still appears in grammar.md. A mismatch is a bug
    HERE, never in grammar.md (README, "Auditing for drift")."""
    root = root or design_root()
    out = {"ok": True, "checked": 0, "missing": [], "grammar": None}
    if root is None:
        out["ok"] = False
        out["missing"].append("grammar.md not found - set GL_DESIGN_ROOT")
        return out
    text = (root / "grammar.md").read_text(encoding="utf-8").upper()
    out["grammar"] = str(root / "grammar.md")
    hexes = {}
    for gname, group in (("ink", INK), ("accent", ACCENT), ("paper", PAPER),
                         ("muted", MUTED)):
        for k, v in group.items():
            hexes[gname + "." + k] = v
    for k, tones in CAT.items():
        for t, v in tones.items():
            hexes[k + "." + t] = v
    for name, ramp in dict(**SEQUENTIAL, **DIVERGING).items():
        for i, v in enumerate(ramp):
            hexes[name + "[" + str(i) + "]"] = v
    for name, v in hexes.items():
        out["checked"] += 1
        if v.upper() not in text:
            out["missing"].append(name + " = " + v)
    out["ok"] = not out["missing"]
    return out


# ───────────────────────── line weights (grammar section 3.4) ─────────────────────────
# The grammar specifies px; matplotlib linewidth is in points, and 1 px at 96 DPI = 0.75 pt.
HAIRLINE_LW = 0.75          # 1px   — axis line, ticks, gridlines, zero baseline
LINE_LW = 1.50              # 2px   — standard series line
FOCUS_LW = 1.80             # 2.4px — the highlighted focus line
MAP_LW = 0.375              # 0.5px — choropleth polygon borders

# ───────────────────────── figure sizes ─────────────────────────
# Mirrors theme_gl.R's `gl_fig`, plus the two slide-composition sizes gl-pptx needs.
FIG_SIZES = {
    "full": (6.5, 4.0), "full_tall": (6.5, 6.0), "full_square": (6.5, 6.5),
    "major": (4.278, 4.0), "half": (3.167, 3.0), "half_tall": (3.167, 5.0),
    "slide": (10, 5.625),          # 16:9 — the whole slide's aspect
    "slide_half": (4.9, 5.0),      # one side of a two-up slide
    "slide_wide": (11.5, 4.4),     # wide and short, e.g. ranked bars
    # The Single Visual chart area is 12.4 x 5.42 in (the slide minus the title and
    # footer bands), an aspect of 2.29 — WIDER than 16:9. So a `slide` figure can never
    # fill it: contained, it fits by height and leaves a margin each side. `slide_fill`
    # matches the chart area, for a chart meant to occupy the whole slide.
    "slide_fill": (12.4, 5.4),
}

BASE_SIZE = {"report": 9, "slide": 12}
FONT_STACK = {
    "Inter": ["Inter", "Source Sans Pro", "Source Sans 3", "DejaVu Sans"],
    "Source Sans Pro": ["Source Sans Pro", "Source Sans 3", "Inter", "DejaVu Sans"],
}
_MODE = "report"


def available_font(family: str = "Inter") -> str:
    """First font in the stack actually installed, so a missing font degrades to a
    readable fallback rather than matplotlib's silent box glyphs."""
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
        "will fall back to its default face. Register the bundled fonts with "
        "scripts/install-fonts.sh.")
    return family


def gl_setup(mode: str = "report", family: str = "Inter", base_size: int = None):
    """Apply the GL chart theme globally.

    `mode` is `report` (base 9 pt — the document owns the figure label, title and source)
    or `slide` (base 12 pt — read at distance). Only these two exist; anything else raises,
    matching `theme_gl.R`'s `match.arg`, because invented modes used to fall through
    silently.

    `family` defaults to the grammar's in-chart family, Inter. Pass
    `family="Source Sans Pro"` for a chart going into a **gl-pptx deck**, so the chart
    matches the template master and the slide reads as one artifact.
    """
    global _MODE
    if mode not in BASE_SIZE:
        raise ValueError("mode must be 'report' or 'slide', not " + repr(mode))
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
        "axes.labelweight": "medium",               # grammar: axis label Inter 500
        "axes.titlesize": size * 1.3,
        "axes.titlecolor": gl["ink"],
        "axes.titlelocation": "left",
        "axes.titleweight": "medium",
        "axes.spines.top": False,                   # grammar section 3.5
        "axes.spines.right": False,
        "axes.grid": False,                         # opt in per chart, never both axes
        # A single muted grey, NOT the categorical palette: an unpainted series must
        # recede, so highlight-by-muting is the default outcome (grammar rule 4).
        "axes.prop_cycle": mpl.cycler(color=[MUTED["main"]]),
        "grid.color": gl["gridline"],
        "grid.linewidth": HAIRLINE_LW,
        "grid.linestyle": "-",
        "xtick.color": gl["ink_2"], "ytick.color": gl["ink_2"],
        "xtick.labelcolor": gl["ink_2"], "ytick.labelcolor": gl["ink_2"],
        "xtick.labelsize": size * 0.92, "ytick.labelsize": size * 0.92,
        "xtick.direction": "out", "ytick.direction": "out",    # never inward
        "xtick.major.size": 3.0, "ytick.major.size": 3.0,      # 4px
        "xtick.major.width": HAIRLINE_LW, "ytick.major.width": HAIRLINE_LW,
        "xtick.major.pad": 4.5, "ytick.major.pad": 4.5,        # 6px offset
        "lines.linewidth": LINE_LW,
        "lines.solid_joinstyle": "round",
        "lines.color": gl["c_muted"],
        "patch.edgecolor": gl["paper"],
        "patch.linewidth": HAIRLINE_LW,
        "legend.frameon": False,
        "legend.fontsize": size * 0.92,
        "legend.labelcolor": gl["ink_2"],
        "svg.fonttype": "none",
    })
    return mpl.rcParams


def subplots(size: str = "full", **kw):
    """`plt.subplots` at one of the named figure sizes."""
    wh = FIG_SIZES[size] if isinstance(size, str) else size
    return plt.subplots(figsize=wh, **kw)


# ───────────────────────── axes conventions (grammar section 3.5) ─────────────────────────
def _is_categorical(axis) -> bool:
    """True when matplotlib is drawing string categories on this axis (bar/barh with
    text labels). Their formatter must never be replaced — doing so relabels the
    categories with their integer positions."""
    try:
        import matplotlib.category as mcat
        return isinstance(axis.get_major_formatter(), mcat.StrCategoryFormatter)
    except Exception:
        return False


def style_axes(ax, ylabel: str = None, xlabel: str = None, grid: str = "y",
               zero_line: bool = None, thousands: bool = True, year_axis: bool = False,
               value_axis: str = None):
    """Apply the grammar's axis conventions to one Axes.

      - gridlines on ONE axis only (default y), 1px `gridline`, behind the data;
      - y tick labels right-aligned (flush to the axis), x labels top-aligned;
      - the zero baseline at axis weight, not gridline weight;
      - thousands separators on the value axis (tabular figures come from the font);
      - integer ticks on a year axis, and `year_axis=True` drops the x label — the tick
        labels already say what the dimension is.

    `value_axis` is where the numbers live: 'y' for a normal chart, 'x' for `barh`. It
    defaults to whichever axis carries the gridlines (they coincide — gridlines belong on
    the axis the reader estimates values against), so `grid="x"` implies `value_axis="x"`.
    The category axis is left alone regardless, so a `barh`'s labels survive.
    """
    if grid in ("y", "both"):
        ax.yaxis.grid(True, color=gl["gridline"], linewidth=HAIRLINE_LW)
    if grid in ("x", "both"):
        ax.xaxis.grid(True, color=gl["gridline"], linewidth=HAIRLINE_LW)
    ax.set_axisbelow(True)
    if ylabel:
        ax.set_ylabel(ylabel, labelpad=15)          # ~20px clear of the tick labels
    if xlabel and not year_axis:
        ax.set_xlabel(xlabel, labelpad=15)
    if year_axis:
        ax.set_xlabel("")
        # Years are integers: a numeric axis would otherwise offer 2007.5, 2010.0, ...
        ax.xaxis.set_major_locator(mpl.ticker.MaxNLocator(integer=True))
        ax.xaxis.set_major_formatter(FuncFormatter(lambda v, _p: "{:.0f}".format(v)))
    for lbl in ax.get_yticklabels():
        lbl.set_horizontalalignment("right")
    for lbl in ax.get_xticklabels():
        lbl.set_verticalalignment("top")

    va = value_axis or ("x" if grid == "x" else "y")
    axis = ax.xaxis if va == "x" else ax.yaxis
    if thousands and not _is_categorical(axis) and not (va == "x" and year_axis):
        axis.set_major_formatter(FuncFormatter(
            lambda v, _p: "{:,.0f}".format(v) if abs(v) >= 1000 else "{:g}".format(v)))

    lo, hi = ax.get_xlim() if va == "x" else ax.get_ylim()
    if zero_line is None:
        zero_line = lo < 0 < hi
    if zero_line:
        # On a barh the zero baseline is VERTICAL; drawing it horizontally puts a rule
        # under the bottom category instead of at the origin.
        draw = ax.axvline if va == "x" else ax.axhline
        draw(0, color=gl["ink_2"], linewidth=HAIRLINE_LW, zorder=2)
    return ax


def chart_text(ax, eyebrow: str = None, title: str = None, subtitle: str = None,
               source: str = None):
    """Draw the figure-block text roles INSIDE the image: eyebrow, then title, then
    subtitle, with the source below the plot.

    Use it when the image travels alone (a standalone PNG, a chart pasted into an email).
    Do NOT use it for a figure in a GL document or a `gl-pptx` slide — there the document
    or the slide placeholders own those roles, and two copies is how a caption ends up
    disagreeing with its chart.
    """
    fig = ax.figure
    y = 1.01                                        # built bottom-up; larger y is higher
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
    """A direct end-label on a series: the glyphs take the series' **dark** tone (grammar
    rule 6) and carry a thin `paper` halo so they stay legible over marks (section 3.5)."""
    t = ax.text(x, y, text, color=dark(color), va="center", ha="left",
                size=size or mpl.rcParams["font.size"] * 0.92, weight="semibold")
    if halo:
        t.set_path_effects([pe.withStroke(linewidth=2.0, foreground=gl["paper"])])
    return t


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


def save_fig(fig, size: str = "full", filename: str = "figure.png", dpi: int = 300,
             out_dir=None):
    """Save at one of the named sizes. `out_dir` defaults to `$GL_FIG_DIR`, else the cwd.

    For a chart going into a **deck**, prefer `gl_pptx.export_fig(...)` — it saves at these
    same sizes AND records the title, source and language in `figures.json`, so the deck
    builder can fill the slide's own title and source placeholders.
    """
    wh = FIG_SIZES[size] if isinstance(size, str) else size
    fig.set_size_inches(*wh)
    base = Path(out_dir) if out_dir else Path(os.environ.get("GL_FIG_DIR", "."))
    out = base / filename
    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(str(out), dpi=dpi, bbox_inches="tight", facecolor=gl["paper"])
    return out


if __name__ == "__main__":
    import tempfile
    import numpy as np

    drift = check_token_drift()
    print("token drift:", "OK (" + str(drift["checked"]) + " hexes match grammar.md)"
          if drift["ok"] else drift["missing"])

    gl_setup("slide")
    x = np.arange(2010, 2025)
    rng = np.random.default_rng(7)
    fig, ax = subplots("slide")
    for _ in range(6):
        ax.plot(x, 100 + np.cumsum(rng.normal(0, 4, len(x))))
    focus = 100 + np.cumsum(rng.normal(2.2, 3, len(x)))
    ax.plot(x, focus, color=gl["highlight"], linewidth=FOCUS_LW)
    endlabel(ax, x[-1] + 0.2, focus[-1], "Focus", gl["highlight"])
    style_axes(ax, ylabel="Index (2010 = 100)", year_axis=True)
    chart_text(ax, eyebrow="Figure 1", title="The focus series pulls away after 2018.",
               source="Source: Growth Lab analysis of example data.")
    print("wrote", save_fig(fig, "slide", "_gl_matplotlib_smoke.png",
                            out_dir=tempfile.gettempdir()))
