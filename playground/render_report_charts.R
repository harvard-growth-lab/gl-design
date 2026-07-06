#!/usr/bin/env Rscript
#
# render_report_charts.R
#
# Re-renders the FM meeting charts at report dimensions (recipes/report.md sizes)
# with title/subtitle/caption suppressed (handled by document styles).
#
# Run from the pakistan-explore directory:
#   cd ~/dev/pakistan-explore
#   Rscript ~/dev/gl-design/playground/render_report_charts.R
#
# Output: ~/dev/gl-design/playground/imgs/fm_meeting/*.png

library(tidyverse)
library(ggrepel)
library(arrow)
library(jsonlite)
library(readxl)
library(scales)

source('utils.R')

# ---- Growth Lab design system ------------------------------------------------

source("~/dev/gl-design/skills/gl-ggplot/assets/theme_gl.R")
gl_setup(mode = "report")

# Atlas-style sector palette, kept locally for this report's specific buckets.
gl_cluster_colors <- c(
    "Agriculture"      = "#e5c21a",
    "Mineral Products" = "#a88b7d",
    "Chemicals"        = "#b07ac9",
    "Metals"           = "#c9656b",
    "Machinery"        = "#6e8fc3",
    "Vehicles"         = "#7a6cc3",
    "Electronics"      = "#74c5c6",
    "Textiles"         = "#7bc8a4",
    "Stone"            = "#caa46b",
    "Other"            = "#2f5d74",
    "Financial"        = "#b23c6f",
    "ICT"              = "#b23c6f",
    "Transport"        = "#b23c6f",
    "Travel"           = "#b23c6f",
    "Unspecified"      = "#b23c6f"
)

# Route save_fig output into the playground's image directory instead of the
# default `imgs/` next to the working directory. (Never redefine save_fig —
# that loses the ragg device and tabular figures with it.)
options(gl.fig.dir = file.path(Sys.getenv("HOME"), "dev/gl-design/playground/imgs/fm_meeting"))

# ---- Data (same as consolidated Rmd) -----------------------------------------

main_country     <- "PAK"
main_comparators <- c("BGD", "EGY", "IND", "IDN", "LKA", "MAR", "MMR", "NPL", "PHL", "VNM")

macro_df      <- read_parquet("data/shared-data/growth-lab/glmacro_master_alldata.parquet")
atlas_data    <- read_parquet("data/shared-data/growth-lab/atlas/hs92_country_product_year_4.parquet") |>
    mutate(
        category = as.numeric(substr(product_hs92_code, 1, 2)),
        catlabel = case_when(
            category >= 1  & category <= 24 ~ "Agriculture",
            category >= 25 & category <= 27 ~ "Mineral Products",
            category >= 28 & category <= 40 ~ "Chemicals",
            category >= 41 & category <= 49 ~ "Agriculture",
            category >= 50 & category <= 67 ~ "Textiles",
            category >= 68 & category <= 71 ~ "Stone",
            category >= 72 & category <= 83 ~ "Metals",
            category == 84                  ~ "Machinery",
            category == 85                  ~ "Electronics",
            category >= 86 & category <= 89 ~ "Vehicles",
            TRUE                            ~ "Other"
        )
    )
atlas_services_data <- read_parquet('data/shared-data/growth-lab/atlas/services_unilateral_country_product_year_4.parquet')

world_rev <- read_excel("~/dev/shared-data/world-imf2026.xlsx", sheet = "Data")

read_weo <- function(indicator) {
    j <- fromJSON(sprintf("data/cache/weo_%s_PAK.json", indicator))
    vals <- j$values[[indicator]]$PAK
    tibble(year = as.integer(names(vals)), value = as.numeric(unlist(vals)))
}

usd_deflator <- macro_df |>
    filter(countrycodeiso == 'USA', !is.na(wdi_ny_gdp_defl_zs_ad)) |>
    select(year, usd_deflator = wdi_ny_gdp_defl_zs_ad) |>
    mutate(usd_deflator = usd_deflator / usd_deflator[year == 2023] * 100)

pak_population <- macro_df |>
    filter(countrycodeiso == 'PAK', !is.na(weo_lp)) |>
    select(year, weo_lp) |>
    mutate(pop = weo_lp * 1e6)

cat("Data loaded. Rendering report charts...\n\n")

# ==============================================================================
# CHARTS
# ==============================================================================

# 1. Reserves in months of imports
macro_df %>%
    filter(countrycodeiso == main_country) %>%
    filter(year > 1990) %>%
    rename(`Reserves (months of imports)` = wdi_fi_res_totl_mo) %>%
    filter(!is.na(`Reserves (months of imports)`)) %>%
    ggplot(aes(x = year, y = `Reserves (months of imports)`)) +
    # Reference threshold: dashed ink_3 (theme default — annotates a threshold, not data)
    geom_hline(yintercept = 3, linetype = 'dashed') +
    # Single-series primary line: c_1 blue is the spec default for single-series charts.
    geom_line(color = highlight, linewidth = highlight_sz) +
    geom_point(fill = highlight, color = highlight_dark, alpha = 1, size = 2) +
    labs(title = "Pakistan: Reserves in Months of Imports",
         subtitle = "unused in report mode",
         x = NULL, y = "Reserves (months of imports)")
save_fig("full", "reserves-time-series.png")

# 2. GDP per capita growth vs change in current account
weo_rgdp <- read_weo("NGDP_RPCH") |> rename(rgdp_growth = value)
weo_pop  <- read_weo("LP") |> rename(pop = value) |>
    arrange(year) |> mutate(pop_growth = 100 * (pop / lag(pop) - 1))
weo_ca   <- read_weo("BCA_NGDPD") |> rename(ca = value)

weo_scatter <- weo_rgdp |>
    left_join(weo_pop, by = "year") |>
    left_join(weo_ca, by = "year") |>
    mutate(gdppc_growth = rgdp_growth - pop_growth) |>
    arrange(year) |>
    mutate(ca_change = ca - lag(ca)) |>
    filter(year > 1995, year <= 2025, !is.na(gdppc_growth), !is.na(ca_change))

weo_scatter |>
    ggplot(aes(x = gdppc_growth, y = ca_change)) +
    # Zero baselines: solid 1px ink_2 (spec §4)
    gl_zero_line() +
    gl_zero_line("x") +
    # Reference threshold: dashed ink_3 (theme default)
    geom_vline(xintercept = 2, linetype = 'dashed') +
    geom_smooth(method = 'lm', se = TRUE) +
    geom_point() +
    labs(title = "unused", subtitle = "unused",
         x = "GDP per capita growth (annual %)",
         y = "Change in Current Account Balance (% GDP)",
         caption = "unused")
save_fig("full", "gdp-growth-vs-cab-change.png")

# 3. Current account decomposition
weo_hist <- macro_df |>
    filter(countrycodeiso == main_country, year > 1990) |>
    select(year, ca = weo_bca_ngdpd, fiscal = weo_ggxcnl_ngdp)

weo_latest <- tribble(
    ~year, ~ca,  ~fiscal,
    2024,  -0.6, -6.8,
    2025,   0.5, -5.3
)

weo_combined <- weo_hist |>
    filter(!year %in% weo_latest$year) |>
    bind_rows(weo_latest) |>
    filter(!is.na(ca) & !is.na(fiscal), year <= 2025) |>
    arrange(year) |>
    mutate(private = ca - fiscal) |>
    pivot_longer(cols = c(ca, fiscal, private), names_to = "component", values_to = "value") |>
    mutate(component = factor(component,
        levels = c("ca", "fiscal", "private"),
        labels = c("Current Account", "Fiscal Balance", "Private Balance (residual)")))

# Direct line-end labels in each series' dark tone (Nil §3 / §11) — no legend.
# GL palette in order (Nil decision rule 1): c_1, c_2, c_3.
ca_main <- c("Current Account"            = gl$c_1,
             "Fiscal Balance"             = gl$c_2,
             "Private Balance (residual)" = gl$c_3)
ca_dark <- c("Current Account"            = gl$c_1_dark,
             "Fiscal Balance"             = gl$c_2_dark,
             "Private Balance (residual)" = gl$c_3_dark)
ca_lab  <- c("Current Account"            = "Current account",
             "Fiscal Balance"             = "Fiscal balance",
             "Private Balance (residual)" = "Private (residual)")

ca_ends <- weo_combined |>
    group_by(component) |>
    filter(year == max(year)) |>
    ungroup() |>
    mutate(lab = ca_lab[as.character(component)], dark = ca_dark[as.character(component)])

weo_combined |>
    ggplot(aes(x = year, y = value, color = component)) +
    # Zero baseline: solid 1px ink_2 (spec §4 — never dashed, never gridline weight)
    gl_zero_line() +
    geom_line(data = . %>% filter(component != "Current Account")) +
    geom_line(data = . %>% filter(component == "Current Account")) +
    # Direct end labels in each series' dark tone (gl_dark applied inside).
    gl_endlabel(data = ca_ends, mapping = aes(x = year, y = value, label = lab),
                color = ca_ends$dark) +
    scale_color_manual(values = ca_main) +
    scale_y_continuous(labels = percent_format(scale = 1), breaks = breaks_width(2)) +
    scale_x_continuous(expand = expansion(mult = c(0.02, 0.04))) +
    # clip = "off" + right margin for the line-end labels + no legend.
    gl_endlabel_room() +
    labs(title = "unused", subtitle = "unused",
         x = NULL, y = "% of GDP", caption = "unused")
save_fig("full", "ca-decomposition.png")

# 4. SBP balance sheet decomposition
gdp_annual <- macro_df |>
    filter(countryname == "Pakistan") |>
    select(year, ngdp_bn = weo_ngdp) |>
    filter(!is.na(ngdp_bn))

gdp_monthly <- tibble(date = seq(as.Date("2000-01-01"), as.Date("2026-12-01"), by = "month")) |>
    left_join(gdp_annual |> transmute(date = as.Date(paste0(year, "-07-01")), ngdp_bn), by = "date") |>
    mutate(ngdp_pkr = approx(date, ngdp_bn * 1e9, xout = date, rule = 2)$y) |>
    select(date, ngdp_pkr)

sbp <- readRDS("data/sbp/imf_mfs_cbs_pak.rds") |>
    mutate(date = as.Date(paste0(sub("M", "", TIME_PERIOD), "-01"))) |>
    left_join(gdp_monthly, by = "date") |>
    mutate(
        value_pct = OBS_VALUE / ngdp_pkr,
        series = factor(label,
            levels = c("NFA", "NCG", "Claims_ODC", "Claims_PS", "CIC"),
            labels = c("Net foreign assets", "Net claims on central government",
                       "Claims on banks (ODCs)", "Claims on private sector",
                       "Currency in circulation"))
    ) |>
    filter(series != "Currency in circulation")

# Pop-up effect (Nil §11): the two non-story series recede to muted grey; the
# alarm (NFA, red) and its cause (NCG, blue) carry the finding, each labeled
# directly at the line end in its dark tone — no legend.
sbp_focus <- c("Net foreign assets", "Net claims on central government")
# Every series labeled directly at the line end; the two non-focus series keep
# the muted grey and a muted-dark label so they read as background context.
sbp_lab  <- c("Net foreign assets"               = "Net foreign assets",
              "Net claims on central government" = "Net claims on govt",
              "Claims on banks (ODCs)"           = "Claims on banks",
              "Claims on private sector"         = "Claims on private sector")
sbp_dark <- c("Net foreign assets"               = gl$c_2_dark,
              "Net claims on central government" = gl$c_1_dark,
              "Claims on banks (ODCs)"           = gl$c_muted_dark,
              "Claims on private sector"         = gl$c_muted_dark)

# Claims on private sector hugs zero with no story — leave it grey and unlabeled.
sbp_ends <- sbp |>
    filter(!is.na(value_pct), series != "Claims on private sector") |>
    group_by(series) |>
    filter(date == max(date)) |>
    ungroup() |>
    mutate(lab = sbp_lab[as.character(series)], dark = sbp_dark[as.character(series)])

sbp |>
    ggplot(aes(x = date, y = value_pct, group = series)) +
    # Zero baseline: solid 1px ink_2 (spec §4)
    gl_zero_line() +
    geom_line(data = . %>% filter(!series %in% sbp_focus)) +   # muted backdrop (default)
    geom_line(data = . %>% filter(series == "Net foreign assets"),
              color = gl$c_2, linewidth = highlight_sz) +
    geom_line(data = . %>% filter(series == "Net claims on central government"),
              color = gl$c_1, linewidth = highlight_sz) +
    # Direct end labels in each series' dark tone; nudge in days (date axis).
    gl_endlabel(data = sbp_ends, mapping = aes(x = date, y = value_pct, label = lab),
                color = sbp_ends$dark, nudge_x = 120) +
    scale_y_continuous(labels = percent) +
    scale_x_date(expand = expansion(mult = c(0.02, 0.04))) +
    # clip = "off" + right margin for the line-end labels + no legend.
    gl_endlabel_room() +
    labs(title = "unused", subtitle = "unused",
         x = NULL, y = "% of GDP", caption = "unused")
save_fig("full", "sbp-balance-sheet-decomposition.png")

# 5. Private credit vs comparators
private_credit <- macro_df |>
    filter(year > 1990, year < 2025) |>
    filter(countrycodeiso %in% c(main_country, main_comparators)) |>
    select(countrycodeiso, year, value = wdi_fs_ast_prvt_gd_zs) |>
    filter(!is.na(value))

private_credit |>
    ggplot(aes(x = year, y = value, group = year)) +
    geom_boxplot(data = . %>% filter(countrycodeiso %in% main_comparators), outlier.shape = NA) +
    geom_line(data = . %>% filter(countrycodeiso == main_country),
              aes(group = NA), color = highlight, linewidth = highlight_sz) +
    geom_point(data = . %>% filter(countrycodeiso == main_country),
               aes(group = NA), fill = highlight, color = highlight_dark, alpha = 1, size = 2) +
    labs(title = "unused", y = "Private credit (% of GDP)", x = NULL)
save_fig("full", "private-credit-comparators.png")

# 6. Exports per capita
percap_trade <- atlas_data |>
    filter(country_iso3_code == 'PAK') |>
    group_by(catlabel, year) |>
    summarise(import_value = as.numeric(sum(import_value, na.rm = TRUE)),
              export_value = as.numeric(sum(export_value, na.rm = TRUE))) |>
    rbind(
        atlas_services_data |>
            filter(country_iso3_code == 'PAK', year >= 1995) |>
            mutate(catlabel = case_when(
                product_services_unilateral_code == 'ict' ~ 'ICT',
                TRUE ~ str_to_title(product_services_unilateral_code)
            )) |>
            group_by(catlabel, year) |>
            summarise(import_value = as.numeric(sum(import_value, na.rm = TRUE)),
                      export_value = as.numeric(sum(export_value, na.rm = TRUE)))
    ) |>
    left_join(pak_population, by = 'year') |>
    left_join(usd_deflator, by = 'year') |>
    mutate(exports_percap_constant = (export_value / pop) / (usd_deflator / 100)) |>
    group_by(year) |>
    mutate(total_exports_percap_constant = sum(export_value, na.rm = TRUE) / pop / (usd_deflator / 100)) |>
    ungroup()

remittances_percap <- macro_df |>
    filter(countrycodeiso == main_country) |>
    select(year, remittances = wdi_bx_trf_pwkr_cd_dt) |>
    filter(!is.na(remittances)) |>
    left_join(pak_population, by = 'year') |>
    left_join(usd_deflator, by = 'year') |>
    mutate(remit_percap_constant = (remittances / pop) / (usd_deflator / 100)) |>
    select(year, remit_percap_constant)

hl_years    <- c(2001, 2011, 2024)
shared_xlim <- c(1995, 2025)
shared_ylim <- c(0, max(
    (percap_trade |> filter(year >= 1995) |> left_join(remittances_percap, by = 'year') |>
        mutate(total_plus_remit = total_exports_percap_constant + remit_percap_constant))$total_plus_remit,
    na.rm = TRUE) * 1.1)

percap_trade |>
    filter(year >= 1995) |>
    ggplot(aes(x = year, y = exports_percap_constant, fill = catlabel)) +
    geom_area() +    # stacked areas sit edge-to-edge, no stroke (spec §6)
    geom_line(aes(y = total_exports_percap_constant)) +
    geom_vline(xintercept = hl_years, linetype = 'dashed') +
    geom_label_repel(
        data = . %>% filter(year %in% hl_years, catlabel == 'Agriculture'),
        aes(y = total_exports_percap_constant,
            label = paste0('$', round(total_exports_percap_constant, 0))),
        fill = gl$paper
    ) +
    scale_x_continuous(n.breaks = 10, limits = shared_xlim) +
    scale_y_continuous(limits = shared_ylim) +
    scale_fill_manual(values = gl_cluster_colors) +
    theme(legend.position = "right") +
    labs(title = "unused", y = 'Per Capita, constant 2023 USD', x = NULL, fill = '', caption = "unused")
save_fig("full", "exports-per-capita.png")

# 6b. Export decline drivers
export_decline <- percap_trade |>
    filter(year %in% c(2011, 2024)) |>
    select(catlabel, year, exports_percap_constant) |>
    pivot_wider(names_from = year, values_from = exports_percap_constant, names_prefix = 'y') |>
    mutate(change = y2024 - y2011) |>
    arrange(change)

export_decline |>
    mutate(catlabel = fct_reorder(catlabel, change)) |>
    ggplot(aes(x = change, y = catlabel, fill = catlabel)) +
    geom_col() +
    gl_zero_line("x") +   # spans negative and positive — zero baseline (spec §4)
    scale_fill_manual(values = gl_cluster_colors) +
    guides(fill = 'none') +
    # Horizontal bars estimate along X — flip the gridlines (spec §4).
    theme(panel.grid.major.x = element_line(color = gl$gridline, linewidth = 0.35),
          panel.grid.major.y = element_blank()) +
    labs(title = "unused", subtitle = "unused",
         x = 'Change in per capita exports (USD)', y = '', caption = "unused")
save_fig("full", "exports-decline-drivers.png")

# 6d. Decomposition of export per capita change
global_goods <- atlas_data |>
    filter(year %in% c(2011, 2024)) |>
    mutate(category = as.numeric(substr(product_hs92_code, 1, 2)),
           catlabel = case_when(
               category >= 1  & category <= 24 ~ "Agriculture",
               category >= 25 & category <= 27 ~ "Mineral Products",
               category >= 28 & category <= 40 ~ "Chemicals",
               category >= 41 & category <= 49 ~ "Agriculture",
               category >= 50 & category <= 67 ~ "Textiles",
               category >= 68 & category <= 71 ~ "Stone",
               category >= 72 & category <= 83 ~ "Metals",
               category == 84                  ~ "Machinery",
               category == 85                  ~ "Electronics",
               category >= 86 & category <= 89 ~ "Vehicles",
               TRUE                            ~ "Other"
           )) |>
    group_by(catlabel, year) |>
    summarise(global_export = as.numeric(sum(export_value, na.rm = TRUE)),
              pak_export = as.numeric(sum(export_value[country_iso3_code == 'PAK'], na.rm = TRUE)),
              .groups = 'drop')

global_services <- atlas_services_data |>
    filter(year %in% c(2011, 2024)) |>
    mutate(catlabel = case_when(
        product_services_unilateral_code == 'ict' ~ 'ICT',
        TRUE ~ str_to_title(product_services_unilateral_code)
    )) |>
    group_by(catlabel, year) |>
    summarise(global_export = as.numeric(sum(export_value, na.rm = TRUE)),
              pak_export = as.numeric(sum(export_value[country_iso3_code == 'PAK'], na.rm = TRUE)),
              .groups = 'drop')

global_wide <- bind_rows(global_goods, global_services) |>
    mutate(share = pak_export / global_export) |>
    pivot_wider(names_from = year, values_from = c(share, global_export, pak_export), names_sep = '_')

pop_2011 <- pak_population |> filter(year == 2011) |> pull(pop)
pop_2024 <- pak_population |> filter(year == 2024) |> pull(pop)
defl_2011 <- usd_deflator |> filter(year == 2011) |> pull(usd_deflator)
defl_2024 <- usd_deflator |> filter(year == 2024) |> pull(usd_deflator)

# Log decomposition: Δlog(x_i/P) = Δlog(s_i) + Δlog(G_i) - Δlog(P)
# Population term is identical for all sectors; components are additive in pp.
pop_growth <- log(pop_2024 / pop_2011) * 100          # pp (positive = drag)
decomp <- global_wide |>
    filter(share_2011 > 0, share_2024 > 0,
           global_export_2011 > 0, global_export_2024 > 0) |>
    mutate(
        # Real global exports growth (in constant USD)
        global_trade_effect    = log((global_export_2024 / (defl_2024/100)) /
                                     (global_export_2011 / (defl_2011/100))) * 100,
        competitiveness_effect = log(share_2024 / share_2011) * 100,
        population_effect      = -pop_growth,
        total = global_trade_effect + competitiveness_effect + population_effect
    ) |>
    select(catlabel, population_effect, global_trade_effect, competitiveness_effect, total) |>
    pivot_longer(cols = c(population_effect, global_trade_effect, competitiveness_effect),
                 names_to = 'component', values_to = 'value') |>
    mutate(component = factor(component,
        levels = c('population_effect', 'global_trade_effect', 'competitiveness_effect'),
        labels = c('Population growth', 'Global trade growth', 'Competitiveness (market share)')
    ))

# Use same y-axis order as export decline drivers (USD per capita change)
sector_order <- export_decline |> arrange(change) |> pull(catlabel)
decomp |>
    mutate(catlabel = factor(catlabel, levels = sector_order)) |>
    ggplot(aes(x = value, y = catlabel, fill = component)) +
    geom_col() +
    # Marker sits on top of saturated stacked bars → lightest muted tone with a
    # white stroke so it reads against the strong-vs-white bar colors.
    geom_point(aes(x = total), fill = gl$c_muted_light, color = gl$paper,
               size = 2.2, stroke = 0.7, show.legend = FALSE) +
    # Zero baseline: solid 1px ink_2 (spec §4)
    gl_zero_line("x") +
    # Horizontal bars estimate along X — flip the gridlines (spec §4).
    theme(panel.grid.major.x = element_line(color = gl$gridline, linewidth = 0.35),
          panel.grid.major.y = element_blank()) +
    scale_x_continuous(labels = function(x) paste0(x, '%')) +
    labs(title = "unused", subtitle = "unused",
         x = 'Change in per capita exports (log pp)', y = '', fill = '', caption = "unused")
save_fig("full", "exports-decomposition.png")


# 7. Exports + remittances per capita
percap_with_remit <- percap_trade |>
    filter(year >= 1995) |>
    left_join(remittances_percap, by = 'year') |>
    mutate(total_plus_remit = total_exports_percap_constant + remit_percap_constant)

percap_with_remit |>
    ggplot(aes(x = year, y = exports_percap_constant, fill = catlabel)) +
    geom_area() +    # stacked areas sit edge-to-edge, no stroke (spec §6)
    geom_line(aes(y = total_exports_percap_constant)) +
    geom_ribbon(
        data = . %>% filter(catlabel == catlabel[1]),
        aes(ymin = total_exports_percap_constant, ymax = total_plus_remit),
        fill = gl$c_muted_light, color = NA, alpha = 1
    ) +
    geom_line(data = . %>% filter(catlabel == catlabel[1]), aes(y = total_plus_remit)) +
    geom_vline(xintercept = hl_years, linetype = 'dashed') +
    geom_label_repel(
        data = . %>% filter(year %in% hl_years, catlabel == 'Agriculture'),
        aes(y = total_plus_remit, label = paste0('$', round(total_plus_remit, 0))),
        fill = gl$paper
    ) +
    scale_x_continuous(n.breaks = 10, limits = shared_xlim) +
    scale_y_continuous(limits = shared_ylim) +
    scale_fill_manual(values = gl_cluster_colors) +
    theme(legend.position = "right") +
    labs(title = "unused", y = 'Per Capita, constant 2023 USD', x = NULL, fill = '', caption = "unused")
save_fig("full", "exports-plus-remittances-per-capita.png")

# 8. Revenue vs peers
rev_peers <- world_rev |>
    filter(ISO3 %in% c(main_country, main_comparators), !is.na(TotRev)) |>
    select(ISO3, year, TotRev)

rev_peers |>
    filter(year >= 1990) |>
    ggplot(aes(x = year, y = TotRev, group = year)) +
    geom_boxplot(data = . %>% filter(ISO3 %in% main_comparators), outlier.shape = NA) +
    geom_line(data = . %>% filter(ISO3 == main_country),
              aes(group = NA), color = highlight, linewidth = highlight_sz) +
    geom_point(data = . %>% filter(ISO3 == main_country),
               aes(group = NA), fill = highlight, color = highlight_dark, alpha = 1, size = 2) +
    labs(title = "unused", subtitle = "unused", x = NULL, y = "% of GDP", caption = "unused")
save_fig("full", "revenue-vs-peers.png")

# 9. Revenue composition vs peers
rev_components <- world_rev |>
    filter(ISO3 %in% c(main_country, main_comparators), !is.na(TotRev), TotRev > 0) |>
    select(ISO3, year, TotRev, TaxInc, TaxSal, TaxTra, TaxOth, Grants, RevOth) |>
    pivot_longer(cols = c(TaxInc, TaxSal, TaxTra, TaxOth, Grants, RevOth),
                 names_to = "source", values_to = "value") |>
    filter(!is.na(value)) |>
    mutate(share = value / TotRev * 100) |>
    mutate(source = factor(source,
        levels = c("TaxInc", "TaxSal", "TaxTra", "TaxOth", "Grants", "RevOth"),
        labels = c("Income Tax", "Sales & Excise", "Trade Taxes",
                   "Other Taxes", "Grants", "Other Revenue")
    ))

rev_components |>
    filter(year >= 1990) |>
    ggplot(aes(x = year, y = share, group = year)) +
    geom_boxplot(data = . %>% filter(ISO3 %in% main_comparators), outlier.shape = NA) +
    geom_line(data = . %>% filter(ISO3 == main_country),
              aes(group = NA), color = highlight, linewidth = highlight_sz) +
    geom_point(data = . %>% filter(ISO3 == main_country),
               aes(group = NA), fill = highlight, color = highlight_dark, alpha = 1, size = 1.5) +
    facet_wrap(~source, scales = "free_y") +
    labs(title = "unused", subtitle = "unused", x = NULL, y = "% of Total Revenue", caption = "unused")
save_fig("full_tall", "revenue-composition-vs-peers.png")

# 10. Expenditure vs peers
exp_peers <- macro_df |>
    filter(countrycodeiso %in% c(main_country, main_comparators), !is.na(weo_ggx_ngdp)) |>
    select(countrycodeiso, year, weo_ggx_ngdp)

exp_peers |>
    filter(year >= 1990) |>
    ggplot(aes(x = year, y = weo_ggx_ngdp, group = year)) +
    geom_boxplot(data = . %>% filter(countrycodeiso %in% main_comparators), outlier.shape = NA) +
    geom_line(data = . %>% filter(countrycodeiso == main_country),
              aes(group = NA), color = highlight, linewidth = highlight_sz) +
    geom_point(data = . %>% filter(countrycodeiso == main_country),
               aes(group = NA), fill = highlight, color = highlight_dark, alpha = 1, size = 2) +
    labs(title = "unused", subtitle = "unused", x = NULL, y = "% of GDP", caption = "unused")
save_fig("full", "expenditure-vs-peers.png")

# 12. Interest expense vs peers
interest_exp <- macro_df |>
    filter(countrycodeiso %in% c(main_country, main_comparators),
           !is.na(weo_ggxonlb_ngdp), !is.na(weo_ggxcnl_ngdp)) |>
    mutate(interest_gdp = weo_ggxonlb_ngdp - weo_ggxcnl_ngdp) |>
    select(countrycodeiso, year, interest_gdp) |>
    filter(year <= 2025)

interest_exp |>
    ggplot(aes(x = year, y = interest_gdp, group = year)) +
    geom_boxplot(data = . %>% filter(countrycodeiso %in% main_comparators), outlier.shape = NA) +
    geom_line(data = . %>% filter(countrycodeiso == main_country),
              aes(group = NA), color = highlight, linewidth = highlight_sz) +
    geom_point(data = . %>% filter(countrycodeiso == main_country),
               aes(group = NA), fill = highlight, color = highlight_dark, alpha = 1, size = 2) +
    labs(title = "unused", subtitle = "unused", x = NULL, y = "% of GDP", caption = "unused")
save_fig("full", "interest-expense-vs-peers.png")

# 14. External debt stocks vs peers (single year — ordered bar chart)
ext_debt <- macro_df |>
    filter(countrycodeiso %in% c(main_country, main_comparators),
           !is.na(wdi_dt_dod_pvlx_ex_zs)) |>
    select(countrycodeiso, year, wdi_dt_dod_pvlx_ex_zs) |>
    filter(year == max(year)) |>
    mutate(is_pak = countrycodeiso == main_country)

ext_debt |>
    ggplot(aes(y = reorder(countrycodeiso, wdi_dt_dod_pvlx_ex_zs), x = wdi_dt_dod_pvlx_ex_zs)) +
    geom_col() +                                              # muted default
    geom_col(data = . %>% filter(is_pak), fill = highlight) +
    # Horizontal bars estimate along X — flip the gridlines (spec §4).
    theme(panel.grid.major.x = element_line(color = gl$gridline, linewidth = 0.35),
          panel.grid.major.y = element_blank()) +
    labs(title = "unused", subtitle = "unused",
         x = "% of exports", y = NULL, caption = "unused")
save_fig("full", "external-debt-exports-vs-peers.png")

# 15b. Energy imports vs GDP per capita scatter
latest_year <- 2023

fuel_all <- atlas_data |>
    filter(category == 27, year == latest_year) |>
    group_by(country_iso3_code) |>
    summarise(fuel_imports = as.numeric(sum(import_value, na.rm = TRUE)), .groups = 'drop')

gdppc_all <- macro_df |>
    filter(year == latest_year, !is.na(weo_ngdprppppc)) |>
    select(countrycodeiso, gdppc_ppp = weo_ngdprppppc)

pop_all <- macro_df |>
    filter(year == latest_year, !is.na(weo_lp)) |>
    select(countrycodeiso, pop = weo_lp) |>
    mutate(pop = pop * 1e6)

scatter_energy <- fuel_all |>
    inner_join(pop_all, by = c('country_iso3_code' = 'countrycodeiso')) |>
    inner_join(gdppc_all, by = c('country_iso3_code' = 'countrycodeiso')) |>
    filter(pop >= 1e6) |>
    mutate(fuel_percap = fuel_imports / pop)

scatter_energy |>
    ggplot(aes(x = gdppc_ppp, y = fuel_percap)) +
    geom_point(data = . %>% filter(country_iso3_code != main_country)) +  # muted backdrop (0.8 default), focus out
    geom_smooth() +                                              # trend
    geom_point(data = . %>% filter(country_iso3_code == main_country),                # highlight, painted once
               fill = highlight, color = highlight_dark, alpha = 1, size = 3) +
    geom_text_repel(data = . %>% filter(country_iso3_code == main_country),
                    aes(label = 'Pakistan'), color = highlight_dark) +
    scale_x_log10(labels = dollar) +
    scale_y_log10(labels = dollar) +
    labs(title = "unused", subtitle = "unused",
         x = 'GDP per capita (PPP, log scale)', y = 'Fuel imports per capita (USD, log scale)',
         caption = "unused")
save_fig("full", "energy-imports-vs-gdppc-scatter.png")

# 15c. Fuel burden vs GDP per capita scatter
total_exp_all <- atlas_data |>
    filter(year == latest_year) |>
    group_by(country_iso3_code) |>
    summarise(all_exports = as.numeric(sum(export_value, na.rm = TRUE)), .groups = 'drop')

scatter_fuel_burden <- fuel_all |>
    inner_join(total_exp_all, by = 'country_iso3_code') |>
    inner_join(gdppc_all, by = c('country_iso3_code' = 'countrycodeiso')) |>
    inner_join(pop_all, by = c('country_iso3_code' = 'countrycodeiso')) |>
    mutate(fuel_pct_exports = fuel_imports / all_exports * 100) |>
    filter(is.finite(fuel_pct_exports), pop >= 1e6)

scatter_fuel_burden |>
    ggplot(aes(x = gdppc_ppp, y = fuel_pct_exports)) +
    geom_point(data = . %>% filter(country_iso3_code != main_country)) +  # muted backdrop (0.8 default), focus out
    geom_smooth() +                                              # trend
    geom_point(data = . %>% filter(country_iso3_code == main_country),                # highlight, painted once
               fill = highlight, color = highlight_dark, alpha = 1, size = 3) +
    geom_text_repel(data = . %>% filter(country_iso3_code == main_country),
                    aes(label = 'Pakistan'), color = highlight_dark) +
    scale_x_log10(labels = dollar) +
    scale_y_continuous(limits = c(0, 100)) +
    labs(title = "unused", subtitle = "unused",
         x = 'GDP per capita (PPP, log scale)', y = 'Fuel imports (% of goods exports)',
         caption = "unused")
save_fig("full", "fuel-burden-vs-gdppc-scatter.png")

# 18. Fossil electricity vs peers
fossil_elc <- macro_df |>
    filter(countrycodeiso %in% c(main_country, main_comparators), !is.na(wdi_eg_elc_petr_zs)) |>
    select(countrycodeiso, year, wdi_eg_elc_petr_zs)

fossil_elc |>
    filter(year >= 1990) |>
    ggplot(aes(x = year, y = wdi_eg_elc_petr_zs, group = year)) +
    geom_boxplot(data = . %>% filter(countrycodeiso %in% main_comparators), outlier.shape = NA) +
    geom_line(data = . %>% filter(countrycodeiso == main_country),
              aes(group = NA), color = highlight, linewidth = highlight_sz) +
    geom_point(data = . %>% filter(countrycodeiso == main_country),
               aes(group = NA), fill = highlight, color = highlight_dark, alpha = 1, size = 2) +
    labs(title = "unused", subtitle = "unused", x = NULL, y = "% of total generation", caption = "unused")
save_fig("full", "fossil-electricity-vs-peers.png")

# 19. Electricity price vs GDP per capita scatter
elc_price <- read_csv('data/cache/wb_electricity_price_country_2019.csv', show_col_types = FALSE)

gdppc_2019 <- macro_df |>
    filter(year == 2019, !is.na(weo_ngdprppppc)) |>
    select(countrycodeiso, gdppc_ppp = weo_ngdprppppc)

pop_2019 <- macro_df |>
    filter(year == 2019, !is.na(weo_lp)) |>
    select(countrycodeiso, pop = weo_lp) |>
    mutate(pop = pop * 1e6)

elc_scatter <- elc_price |>
    inner_join(gdppc_2019, by = c('iso3c' = 'countrycodeiso')) |>
    inner_join(pop_2019, by = c('iso3c' = 'countrycodeiso')) |>
    filter(pop >= 1e6)

elc_scatter |>
    filter(gdppc_ppp >= 1000) |>
    filter(elc_price_cents_kwh <= 100) |>
    ggplot(aes(x = gdppc_ppp, y = elc_price_cents_kwh)) +
    geom_point(data = . %>% filter(iso3c != main_country)) +     # muted backdrop (0.8 default), focus out
    geom_smooth() +                                              # trend
    geom_point(data = . %>% filter(iso3c == main_country),       # highlight, painted once
               fill = highlight, color = highlight_dark, alpha = 1, size = 3) +
    geom_text_repel(data = . %>% filter(iso3c == main_country),
                    aes(label = 'Pakistan'), color = highlight_dark) +
    scale_x_log10(labels = dollar) +
    labs(title = "unused", subtitle = "unused",
         x = 'GDP per capita (PPP, log scale)', y = 'Electricity price (US cents/kWh)',
         caption = "unused")
save_fig("full", "electricity-price-vs-gdppc.png")

cat("\nDone! All report charts saved to:", getOption("gl.fig.dir"), "\n")
