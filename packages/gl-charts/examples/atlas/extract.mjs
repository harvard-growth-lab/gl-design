/**
 * extract.mjs — pull the examples page's datasets out of a local Atlas release.
 *
 * The examples page ships **real Atlas of Economic Complexity data, committed**.
 * That decision has three consequences this script exists to honour:
 *
 * 1. **The 11 GB release stays in `atlas-ai`.** Nothing here depends on Parquet
 *    at page-build time. This script runs occasionally, by hand, and writes small
 *    JSON files that `examples/build.mjs` inlines. A contributor without the
 *    release mounted can still build the page.
 *
 * 2. **Every file carries its own provenance.** Release id, classification,
 *    level, year(s) and the Dataverse DOI travel *with the rows*, because a
 *    figure that cites "Atlas of Economic Complexity" and nothing else is not
 *    reproducible. `atlas-data.ts` turns that block into the source line under
 *    each chart, so a demo cannot render without saying where its numbers came
 *    from.
 *
 * 3. **Ids never reach the page.** `country_id` / `product_id` / `sector_id` are
 *    join keys, and the Atlas skill is explicit that they must be resolved to
 *    names before they reach a reader. Every query below joins the catalog and
 *    projects `iso3` / `code` / `name` / `name_short`; the ids are dropped on the
 *    way out unless a chart genuinely needs one to join two committed files
 *    (the product space needs `code` on both ends of an edge, so it keeps codes,
 *    not ids).
 *
 * ## Why HS92
 *
 * It is the only classification that spans the whole record (1962–2024) *and*
 * carries the product-space proximity edges. HS12 stops at 2012 and HS22 at
 * 2022, so a 30-year composition chart is not expressible in either. Where a
 * demo wants the most recent detail rather than a long run, it still reads HS92
 * so that two charts on the same page can never disagree about what a product is.
 *
 * ## Usage
 *
 *   node examples/atlas/extract.mjs            # writes examples/data/*.json
 *   ATLAS_HOME=/path/to/atlas-ai node examples/atlas/extract.mjs
 *   node examples/atlas/extract.mjs --check    # re-extract into memory, diff, exit non-zero on drift
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'data');

const ATLAS_HOME =
  process.env.ATLAS_HOME ?? join(HERE, '..', '..', '..', '..', '..', 'atlas-ai');
const ATLAS_CLI = join(ATLAS_HOME, 'apps', 'cli', 'dist', 'index.js');

const CHECK = process.argv.includes('--check');

// ── The editorial spine ─────────────────────────────────────────────────────
//
// One country carries the page. Every demo that needs "a country" uses this one,
// so a hundred and five charts read as one argument rather than a hundred and five unrelated
// facts. Vietnam because the thing the Atlas is *for* — a shift in what a place
// is capable of making — is visible in its numbers at every grain this page
// draws: the ECI series, the export basket, the product-level ranks, the map.
const LEAD = 'VNM';

/** The comparison set: Vietnam's regional cohort, for every multi-series chart. */
const COHORT = ['VNM', 'THA', 'MYS', 'PHL', 'IDN', 'KOR'];

/** HS92 throughout — see the header. */
const CLS = 'HS92';

/**
 * The last year with complete coverage across every table this page reads.
 * `country_year` runs to 2024 but the complexity metrics settle a year behind
 * the trade values, so pinning one year keeps a cross-section chart and a
 * timeseries chart from ending on different years for no visible reason.
 */
const LATEST = 2023;
const FIRST = 1995; // country_year's complexity metrics start here

// ── CLI plumbing ────────────────────────────────────────────────────────────

/**
 * The CLI returns the full Atlas envelope: `{data:{items,pagination},provenance}`.
 * We keep both halves — the rows to draw and the provenance to cite.
 *
 * The CLI caps a single `sql` call at 1000 rows and applies that cap *outside*
 * the SQL, so a `LIMIT 100000` in the query gets you an envelope with
 * `hasMore: true` and a truncated `items`. Paging is therefore not optional, and
 * it has to happen here rather than be avoided by keeping every dataset small: a
 * truncated panel renders as a chart whose lines simply stop, which reads as
 * data rather than as a bug.
 *
 * **1000, not the advertised 10 000.** `atlas sql --limit <n>` accepts values up
 * to 10 000 and then ignores them — every call comes back with
 * `pagination.limit: 1000` whatever you pass. So the flag is not sent at all and
 * `PAGE` is pinned to the cap the CLI actually enforces. Raising this to match
 * the flag would silently drop nine rows in ten, because the loop below stops as
 * soon as a page comes back short.
 */
const PAGE = 1000;

/** Guard against a mis-specified query paging forever. */
const MAX_PAGES = 600;

function atlasOnce(sql) {
  if (!existsSync(ATLAS_CLI)) {
    throw new Error(
      `Atlas CLI not found at ${ATLAS_CLI}.\n` +
        `Set ATLAS_HOME, or build it with: cd ${ATLAS_HOME} && pnpm build`,
    );
  }
  // `--mode full` resolves the release pointer relative to the working
  // directory, so the CLI has to run from inside the Atlas checkout — not from
  // this package, where it would look for a `data/full/releases` that is
  // deliberately not here.
  const raw = execFileSync(
    process.execPath,
    [ATLAS_CLI, '--mode', 'full', 'sql', sql, '--format', 'json'],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 * 512, cwd: ATLAS_HOME },
  );
  const env = JSON.parse(raw);
  if (env.error) throw new Error(`Atlas query failed: ${JSON.stringify(env.error)}`);
  return env;
}

/**
 * Page a dataset query to completion.
 *
 * The window goes in the SQL, not in a CLI flag, because the `sql` subcommand
 * has no `--offset`. The inner query keeps its own `ORDER BY`, which is what
 * makes the windows disjoint and the concatenation deterministic — an unordered
 * inner query would let two pages return the same row.
 */
function atlas(sql) {
  const inner = sql.trim().replace(/;$/, '');
  const items = [];
  let provenance;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const env = atlasOnce(`SELECT * FROM (${inner}) LIMIT ${PAGE} OFFSET ${page * PAGE}`);
    provenance ??= env.provenance;
    const batch = env.data?.items ?? [];
    items.push(...batch);
    if (batch.length < PAGE) return { data: { items }, provenance };
  }

  throw new Error(
    `Query still returning rows after ${MAX_PAGES} pages (${MAX_PAGES * PAGE} rows). ` +
      `That is almost certainly a missing filter rather than a dataset this page should ship.\n${inner}`,
  );
}

/** Round a float to `n` significant decimals; leave integers and nulls alone. */
const r = (v, n = 3) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? null
    : Number.isInteger(v)
      ? v
      : Number(v.toFixed(n));

/** Money in millions of current USD, one decimal — the grain every chart draws at. */
const usdM = (v) => (v === null || v === undefined ? null : Number((v / 1e6).toFixed(1)));

/**
 * The bookkeeping rows, excluded from every product and sector dataset below.
 *
 * HS92's tenth sector, "Other", contains exactly two entries and neither is a
 * product: `XXXX` "Trade data discrepancies" is the residual that reconciles
 * mirrored trade statistics, and `9999` "Commodities not specified according to
 * kind" is the unclassified remainder. They are legitimate accounting and the
 * Atlas is right to carry them — but they are not things a country makes.
 *
 * This matters more than it sounds. In the lead country's ${LATEST} basket,
 * "Trade data discrepancies" is the single **largest** line at roughly $45bn.
 * A treemap or a ranked bar built without this filter puts a reconciliation
 * residual at the top of the chart, and a reader learns something false about
 * both the country and the chart type. Dropping it moves every composition
 * total down by that residual, which is the standard treatment and is stated in
 * each affected dataset's note rather than left for someone to discover.
 */
const EXCLUDED_CODES = ['XXXX', '9999'];
const EXCLUDED_SECTOR = 'Other';

const notBookkeeping = (col) =>
  `${col} NOT IN (${EXCLUDED_CODES.map((c) => `'${c}'`).join(', ')})`;

// ── Datasets ────────────────────────────────────────────────────────────────
//
// Each entry is one committed file. `note` is not decoration: it is what the
// dataset means, and `atlas-data.ts` surfaces it so a demo author cannot pick a
// dataset without reading what it is.

const DATASETS = [
  // ── Catalog ──────────────────────────────────────────────────────────────
  {
    name: 'countries',
    note: 'Every country the Atlas ranks, with the region / income grouping used for colour and facets.',
    sql: `
      SELECT iso3, name, name_short AS "nameShort", region, subregion,
             income_group AS "incomeGroup"
      FROM countries
      WHERE in_rankings AND NOT former_country
      ORDER BY iso3`,
    shape: (rows) => rows,
  },
  {
    name: 'sectors',
    note: `The nine classified HS92 sectors, in Atlas order. The page's categorical key: a sector's position here fixes its tone in every chart, so the same sector is the same colour on the treemap, the stack and the map. "${EXCLUDED_SECTOR}" is dropped for the reason given at EXCLUDED_CODES — leaving it in would reserve a hue for a category no chart draws.`,
    provenance: { classification: CLS, excludes: EXCLUDED_SECTOR },
    sql: `
      SELECT DISTINCT sector_id AS "sectorId", name
      FROM sectors WHERE classification = '${CLS}' AND name <> '${EXCLUDED_SECTOR}'
      ORDER BY sector_id`,
    shape: (rows) => rows,
  },

  // ── Country panel ────────────────────────────────────────────────────────
  {
    name: 'country-year',
    note: `Complexity and macro panel, every ranked country, ${FIRST}-${LATEST}. The workhorse: trends, scatters, distributions, rankings, maps.`,
    provenance: { years: [FIRST, LATEST] },
    sql: `
      SELECT c.iso3, cy.year, cy.eci, cy.eci_rank AS "eciRank", cy.coi,
             cy.diversity, cy.gdp_per_capita AS "gdpPerCapita",
             cy.population, cy.export_value AS "exportValue",
             cy.growth_projection AS "growthProjection"
      FROM country_year cy
      JOIN countries c USING (country_id)
      WHERE c.in_rankings AND NOT c.former_country
        AND cy.year BETWEEN ${FIRST} AND ${LATEST}
      ORDER BY c.iso3, cy.year`,
    shape: (rows) =>
      rows.map((d) => ({
        iso3: d.iso3,
        year: d.year,
        eci: r(d.eci),
        eciRank: d.eciRank,
        coi: r(d.coi),
        diversity: d.diversity,
        gdpPerCapita: r(d.gdpPerCapita, 0),
        population: d.population,
        exportValueM: usdM(d.exportValue),
        growthProjection: r(d.growthProjection, 4),
      })),
  },

  // ── Composition ──────────────────────────────────────────────────────────
  {
    name: 'country-sector-year',
    note: `Export value by sector for the cohort (${COHORT.join(', ')}), ${FIRST}-${LATEST}. Stacks, streams, marimekko, normalised shares. Excludes the "${EXCLUDED_SECTOR}" sector (trade discrepancies and unclassified), so shares sum to classified exports.`,
    provenance: { classification: CLS, level: 1, years: [FIRST, LATEST], excludes: EXCLUDED_SECTOR },
    sql: `
      SELECT c.iso3, cpy.year, s.name AS sector, cpy.export_value AS "exportValue"
      FROM country_product_year cpy
      JOIN countries c USING (country_id)
      JOIN products p ON p.product_id = cpy.product_id AND p.classification = cpy.classification
      JOIN sectors s ON s.sector_id = p.sector_id AND s.classification = p.classification
      WHERE cpy.classification = '${CLS}' AND cpy.level = 1
        AND c.iso3 IN (${COHORT.map((x) => `'${x}'`).join(',')})
        AND cpy.year BETWEEN ${FIRST} AND ${LATEST}
        AND s.name <> '${EXCLUDED_SECTOR}'
      ORDER BY c.iso3, cpy.year, s.sector_id`,
    shape: (rows) =>
      rows.map((d) => ({
        iso3: d.iso3,
        year: d.year,
        sector: d.sector,
        exportValueM: usdM(d.exportValue),
      })),
  },
  {
    name: 'world-sector-year',
    note: `World exports by sector, ${FIRST}-${LATEST}. The backdrop a country's share is read against. Excludes the "${EXCLUDED_SECTOR}" sector, matching country-sector-year so the two are comparable.`,
    provenance: { classification: CLS, level: 1, years: [FIRST, LATEST], excludes: EXCLUDED_SECTOR },
    sql: `
      SELECT py.year, s.name AS sector, py.export_value AS "exportValue"
      FROM product_year py
      JOIN products p ON p.product_id = py.product_id AND p.classification = py.classification
      JOIN sectors s ON s.sector_id = p.sector_id AND s.classification = p.classification
      WHERE py.classification = '${CLS}' AND py.level = 1
        AND py.year BETWEEN ${FIRST} AND ${LATEST}
        AND s.name <> '${EXCLUDED_SECTOR}'
      ORDER BY py.year, s.sector_id`,
    shape: (rows) =>
      rows.map((d) => ({ year: d.year, sector: d.sector, exportValueM: usdM(d.exportValue) })),
  },

  // ── Product detail, lead country ─────────────────────────────────────────
  {
    name: 'lead-product-year',
    note: `${LEAD}'s export basket at HS92 4-digit, ${LATEST}. Treemaps, rankings, opportunity scatters, the product space overlay. Excludes trade discrepancies and unclassified commodities — see EXCLUDED_CODES.`,
    provenance: {
      classification: CLS,
      level: 4,
      year: LATEST,
      country: LEAD,
      excludes: EXCLUDED_CODES,
    },
    sql: `
      SELECT p.code, p.name, p.name_short AS "nameShort", s.name AS sector,
             cpy.export_value AS "exportValue", cpy.pci, cpy.distance, cpy.cog,
             cpy.export_rca AS "rca", cpy.global_market_share AS "globalMarketShare"
      FROM country_product_year cpy
      JOIN countries c USING (country_id)
      JOIN products p ON p.product_id = cpy.product_id AND p.classification = cpy.classification
      JOIN sectors s ON s.sector_id = p.sector_id AND s.classification = p.classification
      WHERE cpy.classification = '${CLS}' AND cpy.level = 4
        AND c.iso3 = '${LEAD}' AND cpy.year = ${LATEST}
        AND cpy.export_value > 0
        AND ${notBookkeeping('p.code')}
      ORDER BY cpy.export_value DESC`,
    shape: (rows) =>
      rows.map((d) => ({
        code: d.code,
        name: d.name,
        nameShort: d.nameShort,
        sector: d.sector,
        exportValueM: usdM(d.exportValue),
        pci: r(d.pci),
        distance: r(d.distance),
        cog: r(d.cog),
        rca: r(d.rca),
        globalMarketShare: r(d.globalMarketShare, 6),
      })),
  },
  {
    name: 'lead-product-panel',
    note: `${LEAD}'s twelve largest ${LATEST} products traced back to ${FIRST}. Bump ranks, slopegraphs, small multiples, playback.`,
    provenance: { classification: CLS, level: 4, years: [FIRST, LATEST], country: LEAD },
    sql: `
      WITH top AS (
        SELECT cpy.product_id
        FROM country_product_year cpy
        JOIN countries c USING (country_id)
        JOIN products p ON p.product_id = cpy.product_id AND p.classification = cpy.classification
        WHERE cpy.classification = '${CLS}' AND cpy.level = 4
          AND c.iso3 = '${LEAD}' AND cpy.year = ${LATEST} AND ${notBookkeeping('p.code')}
        ORDER BY cpy.export_value DESC
        LIMIT 12
      )
      SELECT p.code, p.name_short AS "nameShort", s.name AS sector,
             cpy.year, cpy.export_value AS "exportValue", cpy.export_rca AS "rca"
      FROM country_product_year cpy
      JOIN countries c USING (country_id)
      JOIN products p ON p.product_id = cpy.product_id AND p.classification = cpy.classification
      JOIN sectors s ON s.sector_id = p.sector_id AND s.classification = p.classification
      WHERE cpy.classification = '${CLS}' AND cpy.level = 4
        AND c.iso3 = '${LEAD}' AND cpy.product_id IN (SELECT product_id FROM top)
        AND cpy.year BETWEEN ${FIRST} AND ${LATEST}
      ORDER BY p.code, cpy.year`,
    shape: (rows) =>
      rows.map((d) => ({
        code: d.code,
        nameShort: d.nameShort,
        sector: d.sector,
        year: d.year,
        exportValueM: usdM(d.exportValue),
        rca: r(d.rca),
      })),
  },

  // ── Distribution shapes the Atlas computes for you ───────────────────────
  {
    name: 'lead-thresholds',
    note: `Atlas-computed percentiles of ${LEAD}'s product-level distributions, by year and variable. Percentile fans and boxplots without re-deriving quantiles here.`,
    provenance: { years: [FIRST, LATEST], country: LEAD },
    sql: `
      SELECT t.year, t.variable, t.mean, t.median, t.min, t.max, t.std,
             t.percentile_10 AS "p10", t.percentile_25 AS "p25",
             t.percentile_50 AS "p50", t.percentile_75 AS "p75",
             t.percentile_90 AS "p90"
      FROM country_year_thresholds t
      JOIN countries c USING (country_id)
      WHERE c.iso3 = '${LEAD}' AND t.year BETWEEN ${FIRST} AND ${LATEST}
      ORDER BY t.variable, t.year`,
    shape: (rows) =>
      rows.map((d) => ({
        year: d.year,
        variable: d.variable,
        mean: r(d.mean),
        median: r(d.median),
        min: r(d.min),
        max: r(d.max),
        std: r(d.std),
        p10: r(d.p10),
        p25: r(d.p25),
        p50: r(d.p50),
        p75: r(d.p75),
        p90: r(d.p90),
      })),
  },

  // ── The product space ────────────────────────────────────────────────────
  {
    name: 'product-space-nodes',
    note: `HS92 4-digit products with their ${LATEST} world trade value and complexity. Nodes for the proximity network, points for the PCI scatters.`,
    provenance: { classification: CLS, level: 4, year: LATEST },
    sql: `
      SELECT p.code, p.name_short AS "nameShort", s.name AS sector,
             py.pci, py.export_value AS "exportValue"
      FROM products p
      JOIN sectors s ON s.sector_id = p.sector_id AND s.classification = p.classification
      LEFT JOIN product_year py ON py.product_id = p.product_id
        AND py.classification = p.classification AND py.year = ${LATEST}
      WHERE p.classification = '${CLS}' AND p.level = 4
        AND ${notBookkeeping('p.code')}
      ORDER BY p.code`,
    shape: (rows) =>
      rows.map((d) => ({
        code: d.code,
        nameShort: d.nameShort,
        sector: d.sector,
        pci: r(d.pci),
        exportValueM: usdM(d.exportValue),
      })),
  },
  {
    name: 'product-space-edges',
    note: 'Proximity edges between HS92 4-digit products — the Atlas\'s own product-space graph. Matrix heatmaps and adjacency views.',
    provenance: { classification: CLS, level: 4 },
    sql: `
      SELECT src.code AS source, tgt.code AS target, ps.proximity
      FROM product_space ps
      JOIN products src ON src.product_id = ps.source_id AND src.classification = ps.classification
      JOIN products tgt ON tgt.product_id = ps.target_id AND tgt.classification = ps.classification
      WHERE ps.classification = '${CLS}'
      ORDER BY ps.proximity DESC`,
    shape: (rows) =>
      rows.map((d) => ({ source: d.source, target: d.target, proximity: r(d.proximity) })),
  },

  // ── Bilateral ────────────────────────────────────────────────────────────
  {
    name: 'lead-partners',
    note: `Where ${LEAD}'s exports go: the twelve largest destination markets, ${FIRST}-${LATEST}. Flows, routes, ranked bars, rank changes.`,
    provenance: { years: [FIRST, LATEST], country: LEAD },
    sql: `
      WITH top AS (
        SELECT b.importer_id
        FROM country_country_year b
        JOIN countries e ON e.country_id = b.exporter_id
        WHERE e.iso3 = '${LEAD}' AND b.year = ${LATEST}
        ORDER BY b.export_value DESC
        LIMIT 12
      )
      SELECT i.iso3 AS partner, i.name_short AS "partnerShort", i.region,
             b.year, b.export_value AS "exportValue"
      FROM country_country_year b
      JOIN countries e ON e.country_id = b.exporter_id
      JOIN countries i ON i.country_id = b.importer_id
      WHERE e.iso3 = '${LEAD}' AND b.importer_id IN (SELECT importer_id FROM top)
        AND b.year BETWEEN ${FIRST} AND ${LATEST}
      ORDER BY i.iso3, b.year`,
    shape: (rows) =>
      rows.map((d) => ({
        partner: d.partner,
        partnerShort: d.partnerShort,
        region: d.region,
        year: d.year,
        exportValueM: usdM(d.exportValue),
      })),
  },
];

// ── Runner ──────────────────────────────────────────────────────────────────

function buildOne(ds, releaseProvenance) {
  const env = atlas(ds.sql.trim());
  const rows = ds.shape(env.data.items);
  if (rows.length === 0) throw new Error(`Dataset "${ds.name}" came back empty.`);
  return {
    meta: {
      dataset: ds.name,
      note: ds.note,
      rows: rows.length,
      ...(ds.provenance ?? {}),
      release: releaseProvenance,
    },
    rows,
  };
}

function main() {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

  // One probe establishes the release identity every file then carries.
  const probe = atlas('SELECT 1 AS ok');
  const p = probe.provenance ?? {};
  const releaseProvenance = {
    datasetId: p.datasetId,
    releaseId: p.releaseId,
    doi: p.sourcePersistentId,
    methodologyVersion: p.methodologyVersion ?? null,
  };

  const index = {
    release: releaseProvenance,
    lead: LEAD,
    cohort: COHORT,
    classification: CLS,
    years: [FIRST, LATEST],
    datasets: [],
  };

  let drift = 0;
  for (const ds of DATASETS) {
    const built = buildOne(ds, releaseProvenance);
    const file = join(OUT, `${ds.name}.json`);
    const text = `${JSON.stringify(built, null, 0)}\n`;

    if (CHECK) {
      const existing = existsSync(file) ? readFileSync(file, 'utf8') : '';
      if (existing !== text) {
        console.error(`drift: ${ds.name}.json differs from a fresh extract`);
        drift += 1;
      }
    } else {
      writeFileSync(file, text);
    }

    const kb = Math.round(text.length / 1024);
    index.datasets.push({ name: ds.name, rows: built.rows.length, kb, note: ds.note });
    console.log(`${CHECK ? 'checked' : 'wrote'}  ${ds.name.padEnd(22)} ${String(built.rows.length).padStart(7)} rows  ${String(kb).padStart(5)} KB`);
  }

  const indexText = `${JSON.stringify(index, null, 2)}\n`;
  if (CHECK) {
    const existing = existsSync(join(OUT, 'index.json'))
      ? readFileSync(join(OUT, 'index.json'), 'utf8')
      : '';
    if (existing !== indexText) {
      console.error('drift: index.json differs from a fresh extract');
      drift += 1;
    }
  } else {
    writeFileSync(join(OUT, 'index.json'), indexText);
  }

  const total = index.datasets.reduce((a, d) => a + d.kb, 0);
  console.log(`\n${index.datasets.length} datasets, ${total} KB, release ${releaseProvenance.releaseId}`);

  if (CHECK && drift > 0) {
    console.error(`\n${drift} file(s) drifted. Re-run without --check to update.`);
    process.exit(1);
  }
}

main();
