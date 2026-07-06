#!/usr/bin/env Rscript
#
# sample_viz_test.R
#
# Self-contained style test: synthetic data, no external sources.
# Exercises every major chart type from docs/nil/data-vis-rules.md.
#
# Run from gl-design root:
#   Rscript playground/sample_viz_test.R
#
# Output: playground/imgs/sample_viz/*.png

library(ggplot2)
library(dplyr)
library(tidyr)
library(forcats)
library(ggrepel)

source("skills/gl-ggplot/assets/theme_gl.R")
gl_setup(mode = "slide")  # slide mode keeps title / subtitle / caption

# Route save_fig output to the playground image directory.
options(gl.fig.dir = "playground/imgs/sample_viz")

set.seed(42)

# ==============================================================================
# 1. SINGLE-SERIES LINE — plain time series, no highlight needed
# ==============================================================================
reserves <- tibble(
    year  = 1995:2024,
    value = cumsum(c(3.2, rnorm(29, 0, 0.4))) + 3
) |> mutate(value = pmax(value, 0.5))

ggplot(reserves, aes(x = year, y = value)) +
    geom_hline(yintercept = 3) +                 # reference threshold: dashed ink_3 default
    geom_line(color = highlight) +               # single series opts into c_1; standard 2px default
    geom_point(fill = highlight, color = highlight_dark, alpha = 1, size = 2) +
    annotate("text", x = 1998, y = 3.35, label = "Safety threshold",
             family = "gl_sans", color = gl$ink_3, size = gl_text_size, hjust = 0) +
    scale_x_continuous(breaks = seq(1995, 2025, 5)) +
    labs(
        title    = "Reserves have repeatedly dipped below the safety threshold.",
        subtitle = "Months of import cover, 1995–2024",
        caption  = "Source: World Development Indicators.",
        x = NULL, y = "Months of imports"
    )
save_fig("full", "01-single-series-line.png")

# ==============================================================================
# 2. MULTI-LINE — pop-up effect: one focus, rest muted
# ==============================================================================
countries <- c("Focus", "Peer A", "Peer B", "Peer C", "Peer D")
ml <- expand.grid(year = 2000:2023, country = countries) |>
    as_tibble() |>
    arrange(country, year) |>
    group_by(country) |>
    mutate(
        value = cumsum(rnorm(n(), mean = if_else(country == "Focus", 0.3, 0.1), sd = 0.8)) + 40
    ) |>
    ungroup()

ml_ends <- ml |> group_by(country) |> filter(year == max(year)) |> ungroup()

ggplot(ml, aes(x = year, y = value, group = country)) +
    geom_line(data = \(d) filter(d, country != "Focus")) +     # muted backdrop (c_muted default)
    geom_line(data = \(d) filter(d, country == "Focus"),
              color = highlight, linewidth = highlight_sz) +
    # Direct end labels in each series' dark tone — pass the MAIN tones,
    # gl_endlabel() applies the dark partner (decision rule 2).
    gl_endlabel(
        data    = ml_ends,
        mapping = aes(x = year, y = value, label = country),
        color   = if_else(ml_ends$country == "Focus", highlight, c_muted)
    ) +
    scale_x_continuous(expand = expansion(mult = c(0.02, 0.1))) +
    gl_endlabel_room(right = 80) +
    labs(
        title    = "Focus country has grown consistently faster than peers.",
        subtitle = "GDP per capita index (2000 = 40), 2000–2023",
        caption  = "Source: Synthetic data.",
        x = NULL, y = "Index"
    )
save_fig("full", "02-multi-line-popup.png")

# ==============================================================================
# 3. MULTI-LINE — categorical palette, 3 series, legend
# ==============================================================================
three_series <- expand.grid(year = 2005:2023, series = c("Current Account", "Fiscal Balance", "Private Balance")) |>
    as_tibble() |>
    arrange(series, year) |>
    group_by(series) |>
    mutate(value = cumsum(rnorm(n(), mean = c(-0.15, -0.1, 0.05)[cur_group_id()], sd = 0.5))) |>
    ungroup()

ggplot(three_series, aes(x = year, y = value, color = series)) +
    gl_zero_line() +                 # zero baseline: solid 1px ink_2 (Nil §4)
    geom_line() +
    scale_color_gl("categorical") +
    scale_x_continuous(breaks = seq(2005, 2023, 3)) +
    scale_y_continuous(labels = \(x) paste0(x, "%")) +
    labs(
        title    = "Fiscal and current account deficits have widened together.",
        subtitle = "% of GDP, 2005–2023",
        caption  = "Source: Synthetic data.",
        x = NULL, y = "% of GDP", color = NULL
    )
save_fig("full", "03-multi-line-categorical.png")

# ==============================================================================
# 4. HORIZONTAL BAR — pop-up: one bar highlighted, rest muted
# ==============================================================================
bar_data <- tibble(
    country = c("Vietnam", "Philippines", "Bangladesh", "Indonesia",
                "Morocco", "Egypt", "Pakistan", "Nepal", "Sri Lanka", "Myanmar"),
    value   = c(28.4, 22.1, 17.8, 15.6, 13.2, 11.8, 9.4, 7.1, 14.3, 6.2)
) |>
    mutate(
        focus   = country == "Pakistan",
        country = fct_reorder(country, value)
    )

ggplot(bar_data, aes(x = value, y = country)) +
    geom_col() +                                              # muted default
    geom_col(data = \(d) filter(d, focus), fill = highlight) +
    geom_text(aes(label = paste0(value, "%")), hjust = -0.2,  # family/size from defaults
              color = gl_dark(if_else(bar_data$focus, highlight, c_muted))) +
    scale_x_continuous(expand = expansion(mult = c(0, 0.15))) +
    # Horizontal bars estimate along X — flip the gridlines (Nil §4).
    theme(panel.grid.major.x = element_line(color = gl$gridline, linewidth = 0.35),
          panel.grid.major.y = element_blank()) +
    labs(
        title    = "Pakistan trails regional peers in export share.",
        subtitle = "Goods exports as % of GDP, latest year",
        caption  = "Source: Synthetic data.",
        x = "% of GDP", y = NULL
    )
save_fig("full", "04-horizontal-bar-popup.png")

# ==============================================================================
# 5. SCATTER — muted backdrop + focus + smooth
# ==============================================================================
n <- 120
scatter_df <- tibble(
    iso3      = paste0("C", seq_len(n)),
    gdppc     = exp(rnorm(n, log(12000), 0.9)),
    complexity = rnorm(n, 0, 1) + 0.4 * log(gdppc / 1000),
    focus     = iso3 == "C42"
) |>
    mutate(complexity = complexity + rnorm(n, 0, 0.3))

ggplot(scatter_df, aes(x = gdppc, y = complexity)) +
    geom_smooth(method = "lm", se = TRUE) +
    geom_point(data = \(d) filter(d, !focus)) +   # muted backdrop at the 0.8 default (Nil §5)
    geom_point(data = \(d) filter(d, focus),      # focus painted once, opaque
               fill = highlight, color = highlight_dark, alpha = 1, size = 4) +
    geom_text_repel(data = \(d) filter(d, focus),
                    aes(label = "Pakistan"), color = highlight_dark,
                    family = "gl_sans", fontface = "bold", size = gl_text_size) +
    scale_x_log10(labels = scales::dollar) +
    labs(
        title    = "Pakistan lags in economic complexity given its income level.",
        subtitle = "Economic Complexity Index vs. GDP per capita (PPP), 2023",
        caption  = "Source: Synthetic data.",
        x = "GDP per capita, PPP (log scale)", y = "Economic Complexity Index"
    )
save_fig("full", "05-scatter-popup.png")

# ==============================================================================
# 6. STACKED AREA — categorical palette
# ==============================================================================
sectors   <- c("Agriculture", "Textiles", "Minerals", "Chemicals", "Machinery", "Other")
area_data <- expand.grid(year = 1995:2023, sector = sectors) |>
    as_tibble() |>
    arrange(sector, year) |>
    group_by(sector) |>
    mutate(
        base  = c(35, 22, 12, 10, 8, 13)[match(first(sector), sectors)],
        trend = c(-0.5, -0.1, 0.1, 0.2, 0.3, 0.05)[match(first(sector), sectors)],
        value = pmax(base + trend * (year - 1995) + cumsum(rnorm(n(), 0, 0.5)), 0)
    ) |>
    ungroup()

ggplot(area_data, aes(x = year, y = value, fill = sector)) +
    geom_area() +    # stacked areas sit edge-to-edge, no stroke (Nil §6)
    scale_fill_gl("categorical") +
    scale_x_continuous(breaks = seq(1995, 2023, 4)) +
    labs(
        title    = "Export composition has shifted toward manufactures.",
        subtitle = "Goods exports by sector, USD bn, 1995–2023",
        caption  = "Source: Synthetic data.",
        x = NULL, y = "USD bn", fill = NULL
    )
save_fig("full", "06-stacked-area.png")

# ==============================================================================
# 7. BOXPLOT + HIGHLIGHT LINE — background distribution + focus
# ==============================================================================
box_data <- expand.grid(year = 2000:2023, country = paste0("P", 1:10)) |>
    as_tibble() |>
    mutate(value = rnorm(n(), mean = 14 + 0.2 * (year - 2000), sd = 4))

focus_line <- tibble(
    year  = 2000:2023,
    value = 8 + 0.15 * (year - 2000) + cumsum(rnorm(24, 0, 0.3))
)

ggplot(box_data, aes(x = year, y = value, group = year)) +
    geom_boxplot(outlier.shape = NA) +
    geom_line(data = focus_line,
              mapping = aes(x = year, y = value, group = NA),
              color = highlight, linewidth = highlight_sz, inherit.aes = FALSE) +
    geom_point(data = focus_line,
               aes(x = year, y = value, group = NA),
               fill = highlight, color = highlight_dark,
               alpha = 1, size = 2, inherit.aes = FALSE) +
    scale_x_continuous(breaks = seq(2000, 2023, 4)) +
    labs(
        title    = "Tax revenue has persistently trailed the peer median.",
        subtitle = "Total revenue, % of GDP; boxes = peer range, line = Pakistan, 2000–2023",
        caption  = "Source: Synthetic data.",
        x = NULL, y = "% of GDP"
    )
save_fig("full", "07-boxplot-highlight.png")

# ==============================================================================
# 8. DIVERGING BAR — two-tone diverging palette
# ==============================================================================
div_data <- tibble(
    sector  = c("Machinery", "Electronics", "Chemicals", "Textiles",
                "Agriculture", "Minerals", "Stone", "Other"),
    change  = c(12.4, 8.1, 3.2, -2.1, -5.4, -8.9, -1.3, 2.7)
) |>
    mutate(
        pos    = change >= 0,
        sector = fct_reorder(sector, change)
    )

ggplot(div_data, aes(x = change, y = sector, fill = pos)) +
    geom_col() +
    gl_zero_line("x") +              # zero baseline: solid 1px ink_2 (Nil §4)
    scale_fill_manual(values = c("TRUE" = gl$c_1, "FALSE" = gl$c_2)) +
    scale_x_continuous(labels = \(x) paste0(x, "%")) +
    # Horizontal bars estimate along X — flip the gridlines (Nil §4).
    theme(panel.grid.major.x = element_line(color = gl$gridline, linewidth = 0.35),
          panel.grid.major.y = element_blank(), legend.position = "none") +
    labs(
        title    = "Gains in machinery offset by losses in agriculture and minerals.",
        subtitle = "Change in export share by sector, 2011–2023 (percentage points)",
        caption  = "Source: Synthetic data.",
        x = "Change (pp)", y = NULL
    )
save_fig("full", "08-diverging-bar.png")

# ==============================================================================
# 9. FACETED SMALL MULTIPLES — same axis scale, boxplot + highlight per panel
# ==============================================================================
components <- c("Income Tax", "Trade Taxes", "Sales & Excise", "Other Revenue")
facet_df <- expand.grid(
    year      = 2000:2023,
    country   = paste0("P", 1:8),
    component = components
) |>
    as_tibble() |>
    mutate(value = rnorm(n(), mean = 25, sd = 8))

focus_facet <- expand.grid(year = 2000:2023, component = components) |>
    as_tibble() |>
    group_by(component) |>
    mutate(value = 18 + 0.2 * (year - 2000) + cumsum(rnorm(n(), 0, 0.4))) |>
    ungroup()

ggplot(facet_df, aes(x = year, y = value, group = year)) +
    geom_boxplot(outlier.shape = NA) +
    geom_line(data = focus_facet,
              mapping = aes(x = year, y = value, group = NA),
              color = highlight, linewidth = highlight_sz, inherit.aes = FALSE) +
    geom_point(data = focus_facet,
               aes(x = year, y = value, group = NA),
               fill = highlight, color = highlight_dark,
               alpha = 1, size = 1.2, inherit.aes = FALSE) +
    facet_wrap(~component) +
    scale_x_continuous(breaks = seq(2000, 2022, 6)) +
    labs(
        title    = "Revenue from trade taxes has declined across all categories.",
        subtitle = "% of total revenue by component; boxes = peer range, line = focus country, 2000–2023",
        caption  = "Source: Synthetic data.",
        x = NULL, y = "% of total revenue"
    )
save_fig("full_tall", "09-facet-boxplot-highlight.png")

# ==============================================================================
# 10. COLOR PALETTE SWATCH — visual identity check
# ==============================================================================
swatches <- tibble(
    name = c(
        "c_1 (blue)", "c_2 (red)", "c_3 (teal)", "c_4 (purple)", "c_5 (orange)", "c_6 (yellow)", "c_muted",
        "c_1_light", "c_2_light", "c_3_light", "c_4_light", "c_5_light", "c_6_light", "c_muted_light",
        "c_1_dark", "c_2_dark", "c_3_dark", "c_4_dark", "c_5_dark", "c_6_dark", "c_muted_dark"
    ),
    hex = c(
        gl$c_1, gl$c_2, gl$c_3, gl$c_4, gl$c_5, gl$c_6, gl$c_muted,
        gl$c_1_light, gl$c_2_light, gl$c_3_light, gl$c_4_light, gl$c_5_light, gl$c_6_light, gl$c_muted_light,
        gl$c_1_dark, gl$c_2_dark, gl$c_3_dark, gl$c_4_dark, gl$c_5_dark, gl$c_6_dark, gl$c_muted_dark
    ),
    tone = rep(c("main", "light", "dark"), each = 7),
    hue  = rep(c("c_1", "c_2", "c_3", "c_4", "c_5", "c_6", "muted"), 3)
) |>
    mutate(
        name = factor(name, levels = rev(name)),
        tone = factor(tone, levels = c("light", "main", "dark"))
    )

ggplot(swatches, aes(x = tone, y = name, fill = hex)) +
    geom_tile(width = 0.9, height = 0.9) +
    geom_text(aes(label = hex), color = gl$ink_2) +   # family/size (12px floor) from defaults
    scale_fill_identity() +
    scale_x_discrete(position = "top") +
    theme(
        panel.grid  = element_blank(),
        axis.line   = element_blank(),
        axis.ticks  = element_blank()
    ) +
    labs(
        title    = "GL categorical palette — all 21 color tokens.",
        subtitle = "Light · Main · Dark tones for each of the 7 hues",
        caption  = "Reference: grammar.md",
        x = NULL, y = NULL
    )
save_fig("full_tall", "10-palette-swatch.png")

cat("\nDone. Charts saved to:", getOption("gl.fig.dir"), "\n")
