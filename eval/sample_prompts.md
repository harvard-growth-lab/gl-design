# Sample prompts — chart-generation smoke test

A battery of prompts simulating a Growth Lab research fellow asking Claude Code to make
a chart. Each prompt is sent verbatim to a fresh headless session (see `run_eval.sh`)
that runs **fully isolated**: no user or project CLAUDE.md, no user-level skills or
agents — only the gl-design plugin, loaded explicitly via `--plugin-dir`. The plugin is
the sole thing standing between the prompt and a non-compliant chart, which is exactly
what this test measures. **The prompt text never mentions the design system** — if a
prompt had to say "use the GL theme" to get a compliant chart, the skill has failed.

Because the session inherits no lab context, every prompt carries its own dataset path,
the way a fellow pastes a path into a fresh session. Data is limited to two files so
runs stay cheap:

- the macro dataset: `~/dev/shared-data/growth-lab/glmacro_master_alldata.parquet`
  (variable dictionary `macro_data_dictionary.md` alongside)
- the Atlas trade data: `~/dev/shared-data/growth-lab/atlas/hs92_country_product_year_4.parquet`

## Format contract (parsed by `run_eval.sh`)

- Each prompt lives under a heading `### Pnn — Title` (zero-padded two-digit id).
- The **first fenced `text` block** after the heading is the prompt, sent verbatim.
- The bullets after the fence (**Expect** / **Stresses**) are evaluator-only notes —
  they are never sent, and they tell the reviewer which rules this prompt was designed
  to exercise. Check those rules first, but flag anything else you see.

---

## Tier 1 — Specific requests (fellow knows exactly what they want)

### P01 — Savings vs income scatter

```text
Using the macro dataset at ~/dev/shared-data/growth-lab/glmacro_master_alldata.parquet
(variable dictionary in macro_data_dictionary.md alongside), make a scatter plot of
GDP per capita against gross national savings as a share of GDP for all countries in
2019. Save it as a PNG.
```

- **Expect:** scatter, GDP per capita on one axis, one point per country.
- **Stresses:** log scale when GDP per capita is on x (rule 6); scatter defaults —
  shape-21 fill+stroke, size 3, 0.8 alpha (rules 3, 8); `save_fig()` named size;
  no per-chart theme overrides.

### P02 — Single-country inflation line

```text
Plot Türkiye's inflation rate (average consumer prices, percent change) from 2000
through 2024 as a line chart. Data: the macro dataset at
~/dev/shared-data/growth-lab/glmacro_master_alldata.parquet, with a variable
dictionary in macro_data_dictionary.md alongside.
```

- **Expect:** one line, one country.
- **Stresses:** the single-series rule — a lone series is drawn in `highlight` blue,
  not left in the muted default and not `accent` (rules 3, 12); year-only x-axis
  omits its title (rule 13).

### P03 — Debt top-10 horizontal bars

```text
From the macro dataset (~/dev/shared-data/growth-lab/glmacro_master_alldata.parquet;
variable dictionary alongside), chart the ten countries with the highest general
government gross debt as a share of GDP in 2023 — horizontal bars, ordered, with
Japan highlighted.
```

- **Expect:** ordered horizontal bar chart, one bar popped.
- **Stresses:** mute-then-paint on bars (`c_muted` backdrop + `highlight` focus,
  rule 2); the horizontal-bar gridline flip (rule 13); bar ordering.

### P04 — Four-country unemployment lines

```text
I need a line chart comparing unemployment rates in Spain, Greece, Italy, and
Portugal from 2005 to 2023. Data: the macro dataset at
~/dev/shared-data/growth-lab/glmacro_master_alldata.parquet (variable dictionary
alongside).
```

- **Expect:** four coequal series.
- **Stresses:** direct line-end labels preferred over a legend for 1–4 series
  (`gl_endlabel()` + `gl_endlabel_room()`, rule 13); palette assigned in order
  c_1→c_4 (rule 3); any series label in the series' **dark** tone (rule 7).

### P05 — Current account scatter with a focus country

```text
Scatter current account balance (% of GDP) against GDP per capita for all countries
in 2022, and highlight Pakistan with a label. Data: the macro dataset at
~/dev/shared-data/growth-lab/glmacro_master_alldata.parquet (variable dictionary
alongside).
```

- **Expect:** muted cloud, one labeled blue point.
- **Stresses:** the paint-once highlight point — focus excluded from the 0.8-alpha
  backdrop, drawn once at `alpha = 1` with `fill = highlight, color = highlight_dark`
  (rule 2); label in `highlight_dark`, at `gl_text_size` (rules 7, 11);
  log-x for GDP per capita; `gl_zero_line()` where y = 0 is in frame (rule 12).

---

## Tier 2 — Comparison and focus requests (moderately open)

### P06 — Vietnam vs regional peers

```text
How has Vietnam's economic growth compared with other East and Southeast Asian
economies since 2000? Make a chart that makes Vietnam's path easy to see against its
neighbors. Data: the macro dataset at
~/dev/shared-data/growth-lab/glmacro_master_alldata.parquet (variable dictionary
alongside).
```

- **Expect:** muted peer lines, Vietnam popped; peer set and growth measure are the
  session's judgment call.
- **Stresses:** the canonical mute-then-highlight line chart (rule 2); focus line at
  `highlight_sz` (1.2×, not 2×); end label or annotation in the dark tone.

### P07 — Colombia in the regional investment distribution

```text
Show where Colombia sits in the distribution of investment rates (total investment,
% of GDP) across Latin American countries over the past 15 years — the spread of the
region each year, with Colombia drawn on top. Data: the macro dataset at
~/dev/shared-data/growth-lab/glmacro_master_alldata.parquet (variable dictionary
alongside).
```

- **Expect:** per-year distribution (box plots or similar) with a highlighted country
  line/points over it.
- **Stresses:** background distributions **recede** — `c_muted_light` fill, `c_muted`
  outline (rule 14); country drawn as `highlight` line with an opaque
  `fill = highlight, color = highlight_dark` point.

### P08 — Egypt's fiscal gap

```text
Chart Egypt's general government revenue and expenditure, both as shares of GDP, on
one chart over time so the gap between them is visible. Data: the macro dataset at
~/dev/shared-data/growth-lab/glmacro_master_alldata.parquet (variable dictionary
alongside).
```

- **Expect:** two related series on one panel, possibly with the gap shaded.
- **Stresses:** two categories sharing a parent → tones of one hue considered before
  two unrelated colors (rule 7); direct labels over a legend; labels in dark tones.

### P09 — G20 current account bars

```text
Make a bar chart of current account balances (% of GDP) in 2023 for the G20
economies, ordered, so surpluses and deficits read clearly at a glance. Data: the
macro dataset at ~/dev/shared-data/growth-lab/glmacro_master_alldata.parquet
(variable dictionary alongside).
```

- **Expect:** ordered bars crossing zero.
- **Stresses:** `gl_zero_line()` — solid ink, never dashed (rule 12); data with a real
  midpoint, so a surplus/deficit color split is legitimate (rule 4) — but it must use
  framework tokens (c_1/c_2 or a centered diverging ramp), not `"red"`/`"green"`.

### P10 — Inflation small multiples

```text
Give me small multiples of annual inflation since 2010 for Egypt, Türkiye, Argentina,
Nigeria, Pakistan, and Ghana — one panel per country. Data: the macro dataset at
~/dev/shared-data/growth-lab/glmacro_master_alldata.parquet (variable dictionary
alongside).
```

- **Expect:** six facets, one series each.
- **Stresses:** facet sizing — `full_tall` / `full_square`, not `full` (rule 5 /
  chart-audit §3); per-panel single series drawn as the focus (blue), not six
  rainbow colors; the Argentina outlier forces a scales judgment call worth noting.

---

## Tier 3 — Mini-analyses (open-ended; the session picks the chart)

### P11 — Investment and subsequent growth

```text
Is there a relationship between how much countries invest and how fast they grow?
Look at investment rates versus subsequent GDP growth and give me one chart that
summarizes what you find. Data: the macro dataset at
~/dev/shared-data/growth-lab/glmacro_master_alldata.parquet (variable dictionary
alongside).
```

- **Expect:** a scatter with a trend, aggregation choices made by the session.
- **Stresses:** `geom_smooth` defaults — `ink_4` trend line, muted ribbon (rule 12);
  muted point cloud; any annotation at `gl_text_size` in the right tone.

### P12 — Sri Lanka fiscal picture

```text
Put together a quick fiscal health picture for Sri Lanka — debt, deficits, whatever
tells the story best. One or two charts. Data: the macro dataset at
~/dev/shared-data/growth-lab/glmacro_master_alldata.parquet (variable dictionary
alongside).
```

- **Expect:** 1–2 charts, composition chosen by the session.
- **Stresses:** multi-chart discipline — consistent sizing via `save_fig()`;
  `lead_finding` red reserved for a genuinely stark finding (the 2022 crisis
  qualifies — does the session use it well, or splash red everywhere?);
  zero baselines on deficit charts.

### P13 — US Phillips curve

```text
I'm curious whether the inflation–unemployment tradeoff shows up in US data. Chart
it however makes the most sense. Data: the macro dataset at
~/dev/shared-data/growth-lab/glmacro_master_alldata.parquet (variable dictionary
alongside).
```

- **Expect:** a connected scatter, era-split scatter, or dual time series — judgment.
- **Stresses:** if eras are colored: sequential vs categorical choice (rule 4);
  if connected: path + point defaults; era/point labels at `gl_text_size`, dark tones.

---

## Tier 4 — Narrow sectoral analyses (Atlas trade data)

### P14 — Bangladesh export composition

```text
Using the Atlas trade data at
~/dev/shared-data/growth-lab/atlas/hs92_country_product_year_4.parquet (HS92 4-digit
by country and year), show how the composition of Bangladesh's goods exports by
broad sector has shifted since 1995.
```

- **Expect:** stacked area or 100% stacked bars by sector over time; requires mapping
  HS 4-digit codes to broad sectors (chapter ranges) — legitimate work, watch whether
  it's done sensibly.
- **Stresses:** `scale_fill_gl("hs_sectors")` for the Atlas taxonomy (rule 4); stacked
  bars get the 1px paper gap and largest-at-bottom order, stacked areas stay
  edge-to-edge (rule 10); legend handling for a many-category chart.

### P15 — Kenya export treemap

```text
Make a treemap of Kenya's goods exports in 2022 — sectors as the top level, with the
biggest products visible inside each sector. Data: the Atlas trade data at
~/dev/shared-data/growth-lab/atlas/hs92_country_product_year_4.parquet (HS92 4-digit
by country and year).
```

- **Expect:** a treemap (likely `treemapify`), sector-grouped.
- **Stresses:** treemap rules (rule 16 / Nil §8): tiles at full opacity with **no
  stroke**, labels white on dark tiles with a dark fallback on light tiles, sector
  palette; in-tile text at or above the 12px floor.

### P16 — Colombia export gains and losses

```text
Which sectors drove the change in Colombia's exports between 2012 and 2022? Chart
the gains and losses by sector. Data: the Atlas trade data at
~/dev/shared-data/growth-lab/atlas/hs92_country_product_year_4.parquet (HS92 4-digit
by country and year).
```

- **Expect:** signed bar chart by sector around zero.
- **Stresses:** a real midpoint → gains/losses split in framework tokens, centered on
  zero (rule 4); `gl_zero_line("x")` if bars run horizontal (rule 12); the
  horizontal-bar gridline flip; sector mapping again.
