/**
 * The Atlas datasets, typed, with their provenance attached.
 *
 * Every demo on the examples page draws **real numbers from the Atlas of
 * Economic Complexity**. This module is the only place they enter: it imports
 * the committed JSON that `atlas/extract.mjs` wrote, gives each table a type,
 * and turns each file's `meta` block into the source line the figure is required
 * to carry.
 *
 * ## Three rules this module exists to enforce
 *
 * 1. **No figure without a source.** `sourceOf()` builds the line from the same
 *    metadata the rows travelled with — release id, classification, level, year.
 *    A demo cannot cite a dataset it did not read, and cannot forget to cite one
 *    it did, because the source string is derived rather than typed by hand.
 *
 * 2. **Names, never ids.** The extract already dropped `country_id` and
 *    `product_id`. What reaches a chart is `iso3`, a product `code`, and a
 *    `name` / `nameShort` pair. Axes and legends take `nameShort`; the full
 *    `name` is for first mention and tooltips. Atlas product names run long
 *    ("Transmission apparatus for radio, telephone and TV"), which is exactly
 *    why the short form exists.
 *
 * 3. **Nulls are not zeros.** `eci` is absent before a country enters the
 *    rankings; `gdpPerCapita` is missing for a few economies; `rca` is null
 *    where a country exports none of a product. Every one of those is typed
 *    `number | null` and none is coalesced to 0 here — a zero that means "no
 *    data" is the single most common way a chart starts lying. Use `defined()`
 *    at the point of use, where you can see what dropping a row does to the
 *    picture.
 *
 * ## What this module does NOT do
 *
 * It does not shape data for particular charts. A demo's own source is the
 * thing the page is shipping, so the interesting work — pivoting to a stack,
 * ranking a year, binning a distribution — belongs *in the demo*, visible, not
 * hidden behind a helper imported from here. Only shaping that is genuinely
 * shared by many demos and carries a correctness risk (sector order, the
 * cohort, cross-sections) lives below.
 */

import countriesJson from './data/countries.json';
import countrySectorYearJson from './data/country-sector-year.json';
import countryYearJson from './data/country-year.json';
import indexJson from './data/index.json';
import leadPartnersJson from './data/lead-partners.json';
import leadProductPanelJson from './data/lead-product-panel.json';
import leadProductYearJson from './data/lead-product-year.json';
import leadThresholdsJson from './data/lead-thresholds.json';
import productSpaceEdgesJson from './data/product-space-edges.json';
import productSpaceNodesJson from './data/product-space-nodes.json';
import sectorsJson from './data/sectors.json';
import worldGeoJson from './data/world.geo.json';
import worldSectorYearJson from './data/world-sector-year.json';

// ── Row types ───────────────────────────────────────────────────────────────

/** A country the Atlas ranks. `region` / `incomeGroup` are the grouping keys. */
export interface Country {
  iso3: string;
  name: string;
  nameShort: string;
  region: string;
  subregion: string;
  incomeGroup: string | null;
}

/** One of the nine classified HS92 sectors. */
export interface Sector {
  sectorId: number;
  name: string;
}

/** Complexity and macro panel, one row per country-year. */
export interface CountryYear {
  iso3: string;
  year: number;
  /** Economic Complexity Index. Null before the country enters the rankings. */
  eci: number | null;
  eciRank: number | null;
  /** Complexity Opportunity Index. */
  coi: number | null;
  /** Count of products exported with revealed comparative advantage. */
  diversity: number | null;
  gdpPerCapita: number | null;
  population: number | null;
  /** Total exports, millions of current USD. */
  exportValueM: number | null;
  growthProjection: number | null;
}

/** Export value by sector, one row per country-year-sector. */
export interface CountrySectorYear {
  iso3: string;
  year: number;
  sector: string;
  exportValueM: number | null;
}

/** World export value by sector, one row per year-sector. */
export interface WorldSectorYear {
  year: number;
  sector: string;
  exportValueM: number | null;
}

/** One product in the lead country's basket, in the latest year. */
export interface LeadProduct {
  /** HS92 4-digit code. */
  code: string;
  name: string;
  nameShort: string;
  sector: string;
  exportValueM: number | null;
  /** Product Complexity Index. */
  pci: number | null;
  /** Distance to the product from the country's current capabilities: 0 near, 1 far. */
  distance: number | null;
  /** Complexity Outlook Gain — what acquiring this product opens up. */
  cog: number | null;
  /** Revealed Comparative Advantage. >1 means the country specialises in it. */
  rca: number | null;
  globalMarketShare: number | null;
}

/** One product-year for the lead country's twelve largest products. */
export interface LeadProductYear {
  code: string;
  nameShort: string;
  sector: string;
  year: number;
  exportValueM: number | null;
  rca: number | null;
}

/**
 * Atlas-computed distribution summary for the lead country's products, per year
 * and variable. Percentiles come from the Atlas rather than being re-derived
 * here, so a fan chart and the Atlas agree by construction.
 */
export interface Threshold {
  year: number;
  /** `pci` | `cog` | `distance` | `exportRca` */
  variable: string;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  std: number | null;
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
}

/** A node in the product space: an HS92 4-digit product. */
export interface ProductNode {
  code: string;
  nameShort: string;
  sector: string;
  pci: number | null;
  /** World trade in this product, millions of current USD. */
  exportValueM: number | null;
}

/** A proximity edge between two products. Both ends are HS92 4-digit codes. */
export interface ProductEdge {
  source: string;
  target: string;
  /** 0–1. The probability of co-export, and the product space's only weight. */
  proximity: number | null;
}

/** Lead country exports to one destination market, one row per partner-year. */
export interface Partner {
  partner: string;
  partnerShort: string;
  region: string;
  year: number;
  exportValueM: number | null;
}

/** A country outline, keyed by the same `iso3` the Atlas tables use. */
export interface WorldFeature {
  type: 'Feature';
  properties: { iso3: string; name: string };
  geometry:
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] };
}

// ── Provenance ──────────────────────────────────────────────────────────────

interface DatasetMeta {
  dataset: string;
  note: string;
  rows: number;
  classification?: string;
  level?: number;
  year?: number;
  years?: number[];
  country?: string;
  excludes?: string | string[];
  release: {
    datasetId: string;
    releaseId: string;
    doi: string;
    methodologyVersion: string | null;
  };
}

interface Table<Row> {
  meta: DatasetMeta;
  rows: Row[];
}

const table = <Row>(json: unknown): Table<Row> => json as Table<Row>;

/** The release every dataset on this page came from. */
export const RELEASE = indexJson.release as DatasetMeta['release'];

/** The country the page is built around, and its regional comparison set. */
export const LEAD = indexJson.lead as string;
export const COHORT = indexJson.cohort as string[];

/** The classification and year span every dataset shares. */
export const CLASSIFICATION = indexJson.classification as string;
export const [FIRST_YEAR, LATEST_YEAR] = indexJson.years as [number, number];

/**
 * Build the figure's source line from a dataset's own metadata.
 *
 * The spec requires a source on every figure, and requires it to be specific
 * enough to reproduce the number. "Atlas of Economic Complexity" alone is not:
 * the same country-product-year has different values under HS92 and HS12, and
 * different values across releases. So the line carries classification, level
 * and year whenever the dataset is scoped by them.
 *
 * Pass `note` to append a caveat the chart itself needs to disclose — a filter
 * applied, a subset taken. It goes at the end, after the provenance, because it
 * qualifies the figure rather than identifying the data.
 */
export function sourceOf(...tables: { meta: DatasetMeta }[]): string {
  const metas = tables.map((t) => t.meta);

  // Scope: what slice of the Atlas this is. Comma-joined, because classification
  // and year qualify the same thing — "HS92 4-digit, 2023" is one clause, not
  // two sentences.
  const scope: string[] = [];
  const classification = metas.find((m) => m.classification)?.classification;
  const level = metas.find((m) => m.level != null)?.level;
  if (classification) {
    scope.push(level != null ? `${classification} ${level}-digit` : classification);
  }

  // The widest year span across the cited tables — a chart drawing two of them
  // is showing the union, so that is what it has to declare.
  const years = metas.flatMap((m) => m.years ?? (m.year != null ? [m.year] : []));
  if (years.length) {
    const lo = Math.min(...years);
    const hi = Math.max(...years);
    scope.push(lo === hi ? `${lo}` : `${lo}–${hi}`);
  }

  const sentences = ['Source: Atlas of Economic Complexity, Growth Lab at Harvard University'];
  if (scope.length) sentences.push(scope.join(', '));
  sentences.push(`Release ${metas[0].release.releaseId}`);
  return `${sentences.join('. ')}.`;
}

/** Append a caveat to a source line — a filter, a subset, a deviation. */
export const withNote = (source: string, note: string): string =>
  `${source.replace(/\.$/, '')}. ${note.replace(/\.?$/, '.')}`;

// ── The tables ──────────────────────────────────────────────────────────────

export const countriesTable = table<Country>(countriesJson);
export const sectorsTable = table<Sector>(sectorsJson);
export const countryYearTable = table<CountryYear>(countryYearJson);
export const countrySectorYearTable = table<CountrySectorYear>(countrySectorYearJson);
export const worldSectorYearTable = table<WorldSectorYear>(worldSectorYearJson);
export const leadProductYearTable = table<LeadProduct>(leadProductYearJson);
export const leadProductPanelTable = table<LeadProductYear>(leadProductPanelJson);
export const leadThresholdsTable = table<Threshold>(leadThresholdsJson);
export const productSpaceNodesTable = table<ProductNode>(productSpaceNodesJson);
export const productSpaceEdgesTable = table<ProductEdge>(productSpaceEdgesJson);
export const leadPartnersTable = table<Partner>(leadPartnersJson);

/** Row shortcuts — the common case, where a demo needs the data and cites separately. */
export const countries = countriesTable.rows;
export const sectors = sectorsTable.rows;
export const countryYear = countryYearTable.rows;
export const countrySectorYear = countrySectorYearTable.rows;
export const worldSectorYear = worldSectorYearTable.rows;
export const leadProducts = leadProductYearTable.rows;
export const leadProductPanel = leadProductPanelTable.rows;
export const leadThresholds = leadThresholdsTable.rows;
export const productNodes = productSpaceNodesTable.rows;
export const productEdges = productSpaceEdgesTable.rows;
export const leadPartners = leadPartnersTable.rows;

/** Country outlines. `meta.coverage.unmatched` lists the economies with no shape. */
export const worldGeo = worldGeoJson as unknown as {
  type: 'FeatureCollection';
  meta: {
    note: string;
    source: string;
    license: string;
    coverage: { atlasCountries: number; matched: number; unmatched: string[] };
  };
  features: WorldFeature[];
};
export const worldFeatures = worldGeo.features;

// ── Shared shaping ──────────────────────────────────────────────────────────
//
// Only what many demos need AND could get subtly wrong on their own.

/**
 * Sector names in Atlas order.
 *
 * This is the page's categorical key. A sector's index here fixes its tone, so
 * "Electronics" is the same colour on the treemap, the stack, the map and the
 * legend. Deriving order from the data (by value, say) would let two charts
 * disagree about what blue means, which is the failure §3.1 is most concerned
 * with.
 */
export const SECTOR_ORDER: readonly string[] = sectors.map((s) => s.name);

/** Rank a sector for stable ordering and tone assignment. */
export const sectorRank = (name: string): number => {
  const i = SECTOR_ORDER.indexOf(name);
  return i === -1 ? SECTOR_ORDER.length : i;
};

const countryByIso = new Map(countries.map((c) => [c.iso3, c]));

/** Resolve an ISO3 to its catalog row. Every chart label goes through this. */
export const country = (iso3: string): Country | undefined => countryByIso.get(iso3);

/** The short display name for an ISO3 — what axes and legends should carry. */
export const countryName = (iso3: string): string => countryByIso.get(iso3)?.nameShort ?? iso3;

/** The lead country's catalog row. */
export const leadCountry = countryByIso.get(LEAD)!;

/** Drop rows whose measured field is null. Explicit, at the point of use. */
export const defined = <T, K extends keyof T>(rows: readonly T[], key: K): (T & Record<K, number>)[] =>
  rows.filter((r) => r[key] != null) as (T & Record<K, number>)[];

/**
 * One country's panel, ascending by year — the spine of every trend demo.
 */
export const seriesFor = (iso3: string): CountryYear[] =>
  countryYear.filter((d) => d.iso3 === iso3).sort((a, b) => a.year - b.year);

/** Every country's row for one year — the spine of every cross-section demo. */
export const crossSection = (year: number = LATEST_YEAR): CountryYear[] =>
  countryYear.filter((d) => d.year === year);

/** The lead country's sector composition for one year, in sector order. */
export const leadSectorsIn = (year: number = LATEST_YEAR): CountrySectorYear[] =>
  countrySectorYear
    .filter((d) => d.iso3 === LEAD && d.year === year)
    .sort((a, b) => sectorRank(a.sector) - sectorRank(b.sector));

/** The lead country's largest products in the latest year, already sorted. */
export const topProducts = (n: number): LeadProduct[] => leadProducts.slice(0, n);

/** Atlas percentile summaries for one variable, ascending by year. */
export const thresholdsFor = (variable: string): Threshold[] =>
  leadThresholds.filter((d) => d.variable === variable).sort((a, b) => a.year - b.year);

/** Partner markets for one year, largest first. */
export const partnersIn = (year: number = LATEST_YEAR): Partner[] =>
  leadPartners
    .filter((d) => d.year === year)
    .sort((a, b) => (b.exportValueM ?? 0) - (a.exportValueM ?? 0));

// ── Formatting ──────────────────────────────────────────────────────────────
//
// Every value on this page is one of four things. Formatting them identically
// everywhere is what makes a hundred and five charts read as one document.

/** Money, from a millions-of-USD figure: `$34.3bn`, `$912m`. */
export const usd = (millions: number | null): string => {
  if (millions == null) return 'no data';
  const abs = Math.abs(millions);
  if (abs >= 1e6) return `$${(millions / 1e6).toFixed(1)}tn`;
  if (abs >= 1e3) return `$${(millions / 1e3).toFixed(1)}bn`;
  return `$${Math.round(millions)}m`;
};

/** A share given as a fraction: `18%`, `2.4%`. */
export const pct = (fraction: number | null): string =>
  fraction == null ? 'no data' : `${(fraction * 100).toFixed(Math.abs(fraction) < 0.1 ? 1 : 0)}%`;

/** An index value: ECI, PCI, COI. Two decimals, signed. */
export const index = (v: number | null): string => (v == null ? 'no data' : v.toFixed(2));

/** A rank: `#48`. */
export const rank = (v: number | null): string => (v == null ? 'unranked' : `#${v}`);
