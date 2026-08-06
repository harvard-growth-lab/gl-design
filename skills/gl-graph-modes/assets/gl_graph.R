# gl_graph.R — entry point for the gl-graph-modes skill (research + production)
#
# Layers on top of the gl-ggplot design system (skills/gl-ggplot/assets/
# theme_gl.R — sourced from this repo, not duplicated):
#
#   - Extended 12-hue research palette: c_7..c_12 in the same
#     light / main / dark structure as Nil's c_1..c_6. The first six hues are
#     identical to the production palette, so a research chart is a draft of a
#     production chart, not a different visual world.
#   - gl_setup_graph(mode): "research" (default), "report", or "slide".
#     Research = slide-mode theme + extended palette as the discrete default +
#     colorful (c_1) untyped geom defaults instead of muted grey.
#     Report / slide = delegated straight to upstream gl_setup().
#   - save_graph(): 2000x1000 px PNG into plots/ — the PowerPoint convention
#     (10 x 5 in at 200 dpi, so all theme proportions stay correct).
#
# Usage:
#   source(paste0(Sys.getenv("CLAUDE_PLUGIN_ROOT"),
#                 "/skills/gl-graph-modes/assets/gl_graph.R"))
#   gl_setup_graph()                     # research mode (default)
#   gl_setup_graph(mode = "report")      # production, chart goes into a document
#   gl_setup_graph(mode = "slide")       # production, standalone PNG / deck

# ---- Locate the repo root and source the upstream theme ----------------------
# Root resolution: this file's own location (works for git clones and symlink
# installs), then CLAUDE_PLUGIN_ROOT (installed plugin). GL_DESIGN_ROOT is set
# so theme_gl.R resolves the bundled fonts from the same root.
local({
    self <- NA_character_
    for (i in rev(seq_len(sys.nframe()))) {          # innermost source() first
        of <- sys.frame(i)$ofile
        if (!is.null(of) && grepl("gl_graph\\.R$", of)) {
            self <- normalizePath(of, mustWork = FALSE); break
        }
    }
    root <- if (!is.na(self)) {
        # <root>/skills/gl-graph-modes/assets/gl_graph.R -> <root>
        dirname(dirname(dirname(dirname(self))))
    } else {
        Sys.getenv("CLAUDE_PLUGIN_ROOT", "")
    }
    theme <- file.path(root, "skills", "gl-ggplot", "assets", "theme_gl.R")
    if (!nzchar(root) || !file.exists(theme)) {
        stop("gl_graph.R: cannot locate the gl-design repo root ",
             "(looked for skills/gl-ggplot/assets/theme_gl.R under '", root,
             "'). Set CLAUDE_PLUGIN_ROOT or source gl_graph.R by its real path.")
    }
    Sys.setenv(GL_DESIGN_ROOT = root)
    source(theme)
})

# ---- Extended palette: six extra hues for research mode ----------------------
# Same tone grammar as upstream: main = fills, dark = strokes + all text tied
# to the series, light = backgrounds / faded states.
gl$c_7_light  <- "#F0B5CF"; gl$c_7  <- "#D4679F"; gl$c_7_dark  <- "#8F3A68"  # Pink
gl$c_8_light  <- "#B9DCA2"; gl$c_8  <- "#67A544"; gl$c_8_dark  <- "#3F6B27"  # Green
gl$c_9_light  <- "#A9DCE8"; gl$c_9  <- "#3FAAC8"; gl$c_9_dark  <- "#226B80"  # Cyan
gl$c_10_light <- "#B9C0E8"; gl$c_10 <- "#5D6DC4"; gl$c_10_dark <- "#3A4585"  # Indigo
gl$c_11_light <- "#D9BCA3"; gl$c_11 <- "#A3714A"; gl$c_11_dark <- "#6B472A"  # Brown
gl$c_12_light <- "#F0DCA0"; gl$c_12 <- "#D9A93E"; gl$c_12_dark <- "#8F6C1E"  # Gold

gl_palettes$categorical_ext <- c(
    gl_palettes$categorical,
    gl$c_7, gl$c_8, gl$c_9, gl$c_10, gl$c_11, gl$c_12
)
gl_palettes$categorical_ext_dark <- c(
    gl_palettes$categorical_dark,
    gl$c_7_dark, gl$c_8_dark, gl$c_9_dark, gl$c_10_dark, gl$c_11_dark, gl$c_12_dark
)
gl_palettes$categorical_ext_light <- c(
    gl_palettes$categorical_light,
    gl$c_7_light, gl$c_8_light, gl$c_9_light, gl$c_10_light, gl$c_11_light, gl$c_12_light
)

# Upstream gl_dark() only knows hues 1..6 — redefine over all 12 + muted so
# label/stroke derivation works for the extended palette too.
gl_dark <- function(x) {
    m <- character(0)
    for (i in 1:12) {
        dark <- gl[[paste0("c_", i, "_dark")]]
        m[toupper(gl[[paste0("c_", i)]])]           <- dark
        m[toupper(gl[[paste0("c_", i, "_light")]])] <- dark
        m[toupper(dark)]                            <- dark
    }
    m[toupper(gl$c_muted)]       <- gl$c_muted_dark
    m[toupper(gl$c_muted_light)] <- gl$c_muted_dark
    m[toupper(gl$c_muted_dark)]  <- gl$c_muted_dark
    out <- unname(m[toupper(as.character(x))])
    unknown <- is.na(out)
    if (any(unknown)) {
        warning("gl_dark(): no dark partner for ",
                paste(unique(as.character(x)[unknown]), collapse = ", "),
                " - returning input unchanged.")
        out[unknown] <- as.character(x)[unknown]
    }
    out
}

# ---- Mode-aware setup --------------------------------------------------------

#' Initialize the GL design system for the gl-graph-modes skill
#'
#' @param mode "research" (default): slide-mode theme, extended 12-hue palette
#'   as the discrete default, colorful untyped geoms (c_1 blue instead of muted
#'   grey), bottom legend without title. "report" / "slide": production modes,
#'   delegated straight to upstream gl_setup() — muted-by-default geoms, 6-hue
#'   palette, full Nil grammar.
#' @param base_size Passed through to gl_setup(); leave NULL for the mode default.
gl_setup_graph <- function(mode = c("research", "report", "slide"),
                           base_size = NULL) {
    mode <- match.arg(mode)
    if (mode != "research") {
        return(gl_setup(mode = mode, base_size = base_size))
    }

    gl_setup(mode = "slide", base_size = base_size)

    # Research: every discrete mapping draws from the full 12-hue palette.
    options(
        ggplot2.discrete.colour = gl_palettes$categorical_ext,
        ggplot2.discrete.fill   = gl_palettes$categorical_ext
    )

    # Research: untyped geoms are colorful (c_1), not muted — a bare
    # geom_line()/geom_col() on a single series comes out in the house blue
    # with zero ceremony. Muting stays available explicitly via gl$c_muted.
    update_geom_defaults("line",  list(colour = gl$c_1, linewidth = 0.70))
    update_geom_defaults("path",  list(colour = gl$c_1, linewidth = 0.70))
    update_geom_defaults("step",  list(colour = gl$c_1, linewidth = 0.70))
    update_geom_defaults("point", list(shape = 21, fill = gl$c_1,
                                       colour = gl$c_1_dark, stroke = 0.53,
                                       size = 3, alpha = 0.8))
    update_geom_defaults("col",   list(fill = gl$c_1, colour = gl$paper,
                                       linewidth = 0.35))
    update_geom_defaults("bar",   list(fill = gl$c_1, colour = gl$paper,
                                       linewidth = 0.35))
    update_geom_defaults("area",  list(fill = gl$c_1, colour = NA))

    # Slide convention: legend at bottom, no title.
    theme_update(legend.position      = "bottom",
                 legend.title         = element_blank(),
                 legend.justification = "left",
                 legend.margin        = margin(t = 4))

    invisible(NULL)
}

# ---- Export: 16:9-slide-ready PNG --------------------------------------------

#' Save the current plot as a 2000x1000 px PNG (16:9-slide-ready)
#'
#' Renders at 10 x 5 inches, 200 dpi — exactly 2000x1000 px, with every theme
#' proportion (12pt text, line weights) intact. Lands in plots/ by default.
#'
#' @param filename Output filename (snake_case, .png)
#' @param plot Plot object (defaults to last_plot())
#' @param dir Output directory (default "plots")
save_graph <- function(filename, plot = last_plot(), dir = "plots") {
    dir.create(dir, showWarnings = FALSE, recursive = TRUE)
    dev <- if (grepl("\\.png$", filename, ignore.case = TRUE) &&
               requireNamespace("ragg", quietly = TRUE)) ragg::agg_png else NULL
    ggsave(file.path(dir, filename), plot = plot,
           width = 10, height = 5, dpi = 200, device = dev)
}
