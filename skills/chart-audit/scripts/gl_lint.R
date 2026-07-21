#!/usr/bin/env Rscript
#
# gl_lint.R — static lint for Growth Lab chart scripts.
#
# Catches the mechanically detectable violations of the GL data-vis grammar
# (grammar.md §3; docs/nil/data-vis-rules.md) before a chart ever renders.
# Complements the judgment checks in skills/chart-audit/SKILL.md — a clean
# lint is necessary, not sufficient.
#
# Usage:
#   Rscript gl_lint.R chart_script.R [more_scripts.R ...]
#
# Output: one line per finding — file:line: [check-id] message.
# Exit status 1 if anything was flagged, 0 if clean.
#
# Checks are line-based regex heuristics: multi-line calls can slip through,
# and an occasional false positive is possible. Read the message; it says
# what the rule is so you can judge.

# ---- Token allowlist (grammar.md + Atlas sector palettes) --------------------

GL_HEX <- toupper(c(
    # Ink ramp / accent / paper & chrome
    "#1A1714", "#2C2823", "#4F4A42", "#9A9389",
    "#1A5A8E", "#003E6B", "#3A85B8", "#E1F0FA",
    "#FFFFFF", "#F4F1EA", "#F3F2EA", "#ECEBE0", "#DDDDDD", "#D8D4CC",
    # Categorical light / main / dark
    "#B5D5EA", "#2F87C8",            "#E89C9C", "#CC4948", "#8A2C2B",
    "#92D6BF", "#2AA584", "#1A6B53", "#B5A0CC", "#7554A3", "#4A3470",
    "#F4BC8A", "#EA822D", "#A8580F", "#E6E2A8", "#CDC86B", "#8A8638",
    # Muted
    "#CDD2D9", "#AFB5BE", "#5F6773",
    # Sequential / diverging intermediate steps
    "#E5F0F9", "#6FA5CE", "#F4D5D5", "#DC6F6E", "#D5EFE7", "#5BC0A0",
    "#E5DDF0", "#9276BA", "#FBE5D5", "#EE9A52", "#FBF8DC", "#DCD68E",
    "#EFC7C0", "#C5DCEC", "#BDE5D8",
    # Cover pattern palette (artwork, not charts — allowed in cover tooling)
    "#578CC9", "#5DC4E2", "#E55D5C", "#F2C32F", "#5CA75B", "#2D2D2C",
    # Atlas HS / SITC sector palettes (external standard)
    "#B23C6F", "#7BC8A4", "#E5C21A", "#CAA46B", "#A88B7D", "#C9656B",
    "#B07AC9", "#7A6CC3", "#6E8FC3", "#74C5C6", "#2F5D74",
    "#E76F8F", "#CF6F6F", "#B39183", "#F39C12", "#D73027", "#1F9D9A",
    "#355F73",
    # Product space clusters (external standard)
    "#E0B614", "#C77C2B", "#5CC7C6", "#9C3BD6", "#C43D3D", "#7A6A63",
    "#8A8A8A", "#2FA84F"
))

GL_TEXT_FLOOR <- 9 / 2.845276      # geom text size for 12px (= gl_text_size)

flags <- 0L

flag <- function(file, line_no, id, msg) {
    cat(sprintf("%s:%d: [%s] %s\n", file, line_no, id, msg))
    flags <<- flags + 1L
}

# Strip R comments without eating "#RRGGBB" literals: only treat a '#' as a
# comment opener when it is NOT immediately followed by 6 hex digits.
strip_comments <- function(x) sub("#(?![0-9A-Fa-f]{6}).*$", "", x, perl = TRUE)

lint_file <- function(path) {
    raw   <- readLines(path, warn = FALSE)
    lines <- strip_comments(raw)

    for (i in seq_along(lines)) {
        ln <- lines[i]
        if (!nzchar(trimws(ln))) next

        # -- 1. Hex literals outside the token set -----------------------------
        for (hex in regmatches(ln, gregexpr("#[0-9A-Fa-f]{6}\\b", ln))[[1]]) {
            if (!(toupper(hex) %in% GL_HEX))
                flag(path, i, "hex", paste0(hex,
                     " is not a GL token - use gl$... tokens or a named palette"))
        }

        # -- 2. Named color literals -------------------------------------------
        m <- regmatches(ln, regexpr(
            "(colou?r|fill)\\s*=\\s*['\"](red|blue|green|black|white|light\\s?gr[ae]y|dark\\s?gr[ae]y|gr[ae]y[0-9]*)['\"]",
            ln, ignore.case = TRUE))
        if (length(m) && nzchar(m))
            flag(path, i, "literal", paste0("named color in `", m,
                 "` - use tokens (gl$paper, gl$c_muted_light, highlight, lead_finding)"))

        # -- 3. accent / dark tones as data fills ------------------------------
        if (grepl("fill\\s*=\\s*(accent|gl\\$accent)\\b", ln) ||
            (grepl("geom_", ln) && grepl("colou?r\\s*=\\s*(accent|gl\\$accent)\\b", ln)))
            flag(path, i, "accent", "accent is non-data chrome only - data marks use highlight (c_1) or lead_finding (c_2)")
        if (grepl("fill\\s*=\\s*(gl\\$c_[1-6]_dark|highlight_dark|lead_finding_dark)\\b", ln))
            flag(path, i, "dark-fill", "dark tones are for strokes and text, not fills (exception: three-tone stacked area)")

        # -- 4. Zero baselines must be solid ink at axis weight ----------------
        if (grepl("geom_hline\\s*\\(\\s*yintercept\\s*=\\s*0[^.0-9]", ln) ||
            grepl("geom_vline\\s*\\(\\s*xintercept\\s*=\\s*0[^.0-9]", ln)) {
            if (!grepl("linetype\\s*=\\s*['\"]solid['\"]", ln))
                flag(path, i, "zero-line",
                     "zero baseline: use gl_zero_line() - solid 1px ink_2, never the dashed threshold default (Nil §4)")
        }

        # -- 5. Diverging gradients built by hand ------------------------------
        if (grepl("scale_(fill|colou?r)_gradient(2|n)?\\s*\\(", ln))
            flag(path, i, "gradient",
                 "use scale_*_gl_gradient() - diverging palettes auto-center on the midpoint")

        # -- 6. Text below the 12px floor --------------------------------------
        if (grepl("text|label|annotate|repel", ln, ignore.case = TRUE)) {
            m <- regmatches(ln, regexpr("size\\s*=\\s*[0-9]*\\.?[0-9]+", ln))
            if (length(m) && nzchar(m)) {
                val <- as.numeric(sub("size\\s*=\\s*", "", m))
                if (!is.na(val) && val < GL_TEXT_FLOOR - 1e-9 && val > 0.5)
                    flag(path, i, "text-size", sprintf(
                         "size = %s is below the 12px floor - use gl_text_size (%.2f)",
                         sub("size\\s*=\\s*", "", m), GL_TEXT_FLOOR))
            }
        }
        m <- regmatches(ln, regexpr("element_text\\s*\\(\\s*size\\s*=\\s*[0-9]*\\.?[0-9]+", ln))
        if (length(m) && nzchar(m)) {
            val <- as.numeric(sub(".*size\\s*=\\s*", "", m))
            if (!is.na(val) && val > 3 && val < 9)   # >3 skips rel()-like values
                flag(path, i, "text-size",
                     "element_text size below 9pt (12px) - do not shrink theme type")
        }

        # -- 7. Stacked areas are gapless --------------------------------------
        if (grepl("geom_area\\s*\\(", ln) &&
            grepl("colou?r\\s*=\\s*(?!NA)", ln, perl = TRUE))
            flag(path, i, "area-stroke",
                 "stacked areas sit edge-to-edge with no stroke (Nil §6) - drop the colour")

        # -- 8. Theme resets / mono fonts / raw devices ------------------------
        if (grepl("theme_(minimal|bw|classic|void|gr[ae]y|light|dark)\\s*\\(", ln))
            flag(path, i, "theme", "theme_gl() is set globally by gl_setup() - do not reset the theme per chart")
        if (grepl("JetBrains|Courier|family\\s*=\\s*['\"]mono", ln))
            flag(path, i, "mono", "no monospace anywhere (decision rule 11)")
        if (grepl("\\bggsave\\s*\\(", ln))
            flag(path, i, "save", "use save_fig() at a named size - raw ggsave loses sizes and the ragg device")
        if (grepl("save_fig\\s*<-\\s*function", ln))
            flag(path, i, "save", "do not redefine save_fig - use options(gl.fig.dir = ...) or the dir argument")

        # -- 9. Old backdrop idiom ---------------------------------------------
        if (grepl("geom_point", ln) && grepl("alpha\\s*=\\s*0?\\.[0-5]\\b", ln))
            flag(path, i, "backdrop-alpha",
                 "muted scatter backdrop stays at the 0.8 default (Nil §5) - drop the alpha override")

        # -- 10. shape-21 point default: colour is the 1px STROKE, not the body -
        # The point default is shape 21 (fill = tone, colour = 1px dark stroke).
        # Setting/mapping colour on a geom_point WITHOUT a fill paints the ring
        # only and leaves the dot body muted grey - the value never lands. Map
        # fill= (and scale_fill_*), set shape = 19 for a solid dot, or use
        # gl_highlight_point() for a focus point. Muted/ink strokes are exempt
        # (a legitimate backdrop); a mapped field or a saturated tone is the bug.
        if (grepl("geom_point\\s*\\(", ln) &&
            grepl("colou?r\\s*=", ln) &&
            !grepl("fill\\s*=", ln) &&
            !grepl("shape\\s*=\\s*(19|20|16)\\b", ln) &&
            !grepl("colou?r\\s*=\\s*(gl\\$c_muted|c_muted|gl\\$ink)", ln))
            flag(path, i, "shape21",
                 "geom_point colour= is the 1px stroke under the shape-21 default - map fill= (and scale_fill_*) so the tone fills the dot, set shape=19, or use gl_highlight_point() for a focus point")
    }

    # ---- File-level checks ----------------------------------------------------
    src <- paste(lines, collapse = "\n")
    if (grepl("coord_flip", src) && !grepl("panel\\.grid\\.major\\.x", src) &&
        !grepl("gl_hbar_grid", src))
        flag(path, NROW(lines), "hbar-grid",
             "horizontal bars need vertical gridlines - use gl_hbar_grid() (X on, Y off) (Nil §4)")
    # Continuous color ramp feeding geom_point strokes (shape-21 body stays grey):
    # the value is on the ring, not the fill. Points-only file (no line/segment
    # legitimately consuming the colour scale) → the ramp belongs on fill=.
    if (grepl("geom_point", src) &&
        grepl("scale_colou?r_gl_gradient", src) &&
        !grepl("geom_(line|path|segment|step)", src))
        flag(path, NROW(lines), "shape21",
             "a colour gradient feeds geom_point strokes under the shape-21 default - map aes(fill=) and use scale_fill_gl_gradient() so the ramp fills the dots")
    if (grepl("gl_setup\\s*\\(", src) == FALSE && grepl("ggplot\\s*\\(", src))
        flag(path, 1L, "setup", "no gl_setup() call found - charts will not carry the GL theme")
}

# ---- Main ---------------------------------------------------------------------

args <- commandArgs(trailingOnly = TRUE)
if (!length(args)) {
    cat("usage: Rscript gl_lint.R <script.R> [...]\n")
    quit(status = 2)
}
for (f in args) {
    if (!file.exists(f)) { cat(f, ": no such file\n"); flags <- flags + 1L; next }
    lint_file(f)
}
if (flags) {
    cat(sprintf("\n%d flag(s). See skills/chart-audit/SKILL.md for the rules.\n", flags))
    quit(status = 1)
}
cat("clean\n")
