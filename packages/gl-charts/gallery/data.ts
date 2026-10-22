/**
 * Datasets for the gallery plates.
 *
 * These are digitized off the spec PDF's own worked examples — read from the
 * plots, not sourced from Comtrade. They exist so the generated plate and the
 * reference plate show the *same picture*, which is what makes a visual diff
 * about the design system rather than about the numbers. Do not cite them.
 *
 * Anything random is generated from a fixed-seed LCG so successive renders are
 * byte-identical and a diff only ever shows a real change.
 */

/** Deterministic PRNG — same contract as the one in reference/build-reference.mjs. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

// ── Figure 1 — scatter, complexity vs. income ───────────────────────────────

export interface ScatterPoint {
  region: string;
  gdp: number;
  eci: number;
}

/**
 * Region order matters: the color scale spends the palette in order of first
 * appearance, so the series the reader meets first takes c-1.
 */
const RAW_SCATTER: ReadonlyArray<[region: string, gdp: number, eci: number]> = [
  ['East Asia', 3_100, -0.82],
  ['East Asia', 4_900, -0.53],
  ['East Asia', 5_900, -0.45],
  ['East Asia', 7_000, -0.33],
  ['East Asia', 9_700, 0.02],
  ['East Asia', 10_900, 0.18],
  ['East Asia', 11_400, 0.26],
  ['East Asia', 15_200, 0.42],
  ['East Asia', 21_000, 0.68],
  ['East Asia', 29_000, 1.08],
  ['Europe', 10_600, 0.85],
  ['Europe', 14_200, 1.33],
  ['Europe', 24_000, 1.67],
  ['Europe', 35_000, 2.0],
  ['Europe', 48_000, 2.33],
  ['Europe', 61_000, 2.53],
  ['Europe', 70_000, 2.75],
  ['Europe', 82_000, 2.87],
  ['South Asia', 1_950, -1.15],
  ['South Asia', 2_600, -0.86],
  ['South Asia', 4_200, -0.64],
  ['South Asia', 6_400, -0.36],
  ['South Asia', 8_100, -0.25],
  ['South Asia', 10_400, 0.05],
];

export const scatterData: readonly ScatterPoint[] = RAW_SCATTER.map(([region, gdp, eci]) => ({
  region,
  gdp,
  eci,
}));

// ── Figure 2 — line, four series ────────────────────────────────────────────

export interface SeriesPoint {
  year: number;
  category: string;
  share: number;
}

const LINE_SERIES: Record<string, readonly number[]> = {
  // 2003 … 2024, biennial control points interpolated to every year below.
  Copper: [25, 30, 38, 45, 50, 52, 48, 50, 52, 54, 49, 47, 46, 51],
  Coal: [5, 8, 14, 22, 29, 35, 34, 32, 37, 42, 40, 37, 40, 44],
  Cashmere: [17, 18, 18, 19, 20, 21, 20, 18, 19, 19, 17, 16, 17, 18],
  Other: [13, 12, 11, 10, 9, 8, 7, 7, 6, 6, 6, 6, 5, 5],
};

/** Control points sit every 1.6 years; expand them onto the real year grid. */
function interpolateOntoYears(values: readonly number[], from: number, to: number) {
  const span = to - from;
  return Array.from({ length: span + 1 }, (_, i) => {
    const t = (i / span) * (values.length - 1);
    const lo = Math.floor(t);
    const hi = Math.min(lo + 1, values.length - 1);
    return {
      year: from + i,
      value: values[lo] + (values[hi] - values[lo]) * (t - lo),
    };
  });
}

export const lineData: readonly SeriesPoint[] = Object.entries(LINE_SERIES).flatMap(
  ([category, values]) =>
    interpolateOntoYears(values, 2003, 2024).map(({ year, value }) => ({
      year,
      category,
      share: Math.round(value * 10) / 10,
    })),
);

// ── Figure 3 — stacked bar, four sectors ────────────────────────────────────

export interface StackedPoint {
  year: number;
  sector: string;
  share: number;
}

const STACK_YEARS = [2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024];

/** Bottom-to-top: largest mean share first, as the spec requires. */
export const stackedOrder = ['Minerals', 'Agri.', 'Manuf.', 'Services'] as const;

const STACK_SHARES: Record<(typeof stackedOrder)[number], readonly number[]> = {
  Minerals: [54, 49, 43, 37, 31, 26, 21, 17],
  'Agri.': [25, 24, 22, 20, 18, 15, 14, 12],
  'Manuf.': [12, 14, 16, 18, 20, 22, 24, 26],
  Services: [9, 13, 19, 25, 31, 37, 41, 45],
};

export const stackedData: readonly StackedPoint[] = stackedOrder.flatMap((sector) =>
  STACK_YEARS.map((year, i) => ({ year, sector, share: STACK_SHARES[sector][i] })),
);

// ── Figure 3B — two tones of one hue ────────────────────────────────────────

export interface TonePoint {
  year: number;
  group: string;
  share: number;
}

const GOODS = [69, 67, 63, 60, 55, 50, 43, 38];

export const twoToneOrder = ['Goods', 'Services'] as const;

export const twoToneData: readonly TonePoint[] = STACK_YEARS.flatMap((year, i) => [
  { year, group: 'Goods', share: GOODS[i] },
  { year, group: 'Services', share: 100 - GOODS[i] },
]);

// ── Figure 3C — three tones of one hue, stacked area ────────────────────────

const AREA_YEARS = [2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024];
const LOW = [60, 56, 52, 47, 43, 38, 34, 29];
const MEDIUM = [30, 30, 30, 30, 30, 31, 34, 41];

export const threeToneOrder = ['Low', 'Medium', 'High complexity'] as const;

export const threeToneData: readonly TonePoint[] = AREA_YEARS.flatMap((year, i) => [
  { year, group: 'Low', share: LOW[i] },
  { year, group: 'Medium', share: MEDIUM[i] },
  { year, group: 'High complexity', share: 100 - LOW[i] - MEDIUM[i] },
]);

// ── Figures 4 & 11 — treemap ────────────────────────────────────────────────

export interface Product {
  name: string;
  /** USD billions. */
  value: number;
}

export const treemapData: readonly Product[] = [
  { name: 'Copper', value: 6.2 },
  { name: 'Coal', value: 3.0 },
  { name: 'Iron ore', value: 2.4 },
  { name: 'Everything else', value: 2.0 },
  { name: 'Cashmere', value: 1.0 },
  { name: 'Gold', value: 0.7 },
  { name: 'Meat', value: 0.5 },
  { name: 'Other', value: 0.4 },
];

export const treemapTotal = treemapData.reduce((sum, d) => sum + d.value, 0);

// ── Figure 5 — radar, six-dimension capability profile ──────────────────────

export interface CapabilityPoint {
  dimension: string;
  /** Normalized 0–1 against the cross-country maximum on that axis. */
  value: number;
}

/**
 * Row order is spoke order — `glRadarChart` takes its dimension order from the
 * data, and the plate runs clockwise from the top: Complexity, Diversity,
 * Sophistication, Growth, Stability, Openness. Values read off the plate's own
 * vertices against its 0.2-interval rings.
 */
export const radarData: readonly CapabilityPoint[] = [
  { dimension: 'Complexity', value: 0.82 },
  { dimension: 'Diversity', value: 0.62 },
  { dimension: 'Sophistication', value: 0.95 },
  { dimension: 'Growth', value: 0.42 },
  { dimension: 'Stability', value: 0.55 },
  { dimension: 'Openness', value: 0.78 },
];

// ── Figure 6 — boxplot, Pakistan against regional peers ─────────────────────

export interface IncomePoint {
  year: number;
  country: string;
  /** GDP per capita, current USD. */
  gdpPerCapita: number;
}

export const BOX_YEARS = [2019, 2020, 2021, 2022, 2023] as const;

/**
 * Eleven peers, chosen so the 2019 order statistics land on the plate's own box:
 * p10 2.4k, Q1 4.1k, median 6.5k, Q3 10.0k, p90 13.9k.
 *
 * With n = 11 and R type-7 quantiles, h = (n−1)p puts p10 on `sorted[1]`, the
 * median on `sorted[5]` and p90 on `sorted[9]`, with Q1 and Q3 interpolated
 * halfway between the pairs either side. So the five numbers the spec draws are
 * a direct consequence of this list rather than of a fitted distribution — which
 * is what lets the generated box be compared against the plate's box at all.
 */
const PEER_2019 = [1_900, 2_400, 3_600, 4_600, 5_400, 6_500, 8_200, 9_400, 10_600, 13_900, 17_500];

/** Common shock and recovery: 2020 down, then a rising path through 2023. */
const PEER_YEAR_FACTOR: Record<(typeof BOX_YEARS)[number], number> = {
  2019: 1.0,
  2020: 0.945,
  2021: 1.048,
  2022: 1.098,
  2023: 1.163,
};

/** Pakistan's own track, read off the plate's five focus markers. */
const PAKISTAN: Record<(typeof BOX_YEARS)[number], number> = {
  2019: 3_750,
  2020: 3_450,
  2021: 3_900,
  2022: 4_050,
  2023: 4_300,
};

/**
 * The peers move together but not in lockstep — a ±4% seeded wobble on each
 * country-year, so the boxes are not exact scalings of one another and the
 * quantiles wander the way the plate's do.
 */
export const incomeData: readonly IncomePoint[] = (() => {
  const random = lcg(20260806);
  const rows: IncomePoint[] = [];
  for (const year of BOX_YEARS) {
    PEER_2019.forEach((base, i) => {
      const wobble = 1 + (random() - 0.5) * 0.08;
      rows.push({
        year,
        country: `Peer ${i + 1}`,
        gdpPerCapita: Math.round(base * PEER_YEAR_FACTOR[year] * wobble),
      });
    });
    rows.push({ year, country: 'Pakistan', gdpPerCapita: PAKISTAN[year] });
  }
  return rows;
})();

// ── Figures 7 & 8 — stylized provinces ──────────────────────────────────────

/**
 * A synthetic province tessellation.
 *
 * The plate's own source line says "Provinces stylized for illustration", and so
 * are these: a 4×3 lattice of lon/lat points with each interior vertex jittered,
 * then one quadrilateral per cell. Because neighbouring cells read the SAME
 * jittered lattice points, every internal edge is shared exactly — which is what
 * makes the 0.5px ink-3 stroke a boundary between two regions rather than two
 * strokes with a sliver of paper between them.
 *
 * Rings are wound top-left → top-right → bottom-right → bottom-left, which with
 * latitude decreasing down the rows is CLOCKWISE. That is d3-geo's requirement
 * for an exterior ring and the opposite of RFC 7946; a counter-wound ring is
 * read as the whole sphere minus the province, which floods the map and destroys
 * the `fit: 'data'` bounds.
 */
export type ProvinceFeature = {
  type: 'Feature';
  id: string;
  properties: { id: string; name: string };
  geometry: { type: 'Polygon'; coordinates: number[][][] };
};

const GRID_COLS = 4;
const GRID_ROWS = 3;

/** Roughly a 3:1 lon/lat box, which projects to the plate's wide landmass. */
const WEST = 60;
const EAST = 84;
const NORTH = 36;
const SOUTH = 28;

export const provinces: readonly ProvinceFeature[] = (() => {
  const random = lcg(19710101);
  const lattice: [number, number][][] = [];
  for (let r = 0; r <= GRID_ROWS; r += 1) {
    const row: [number, number][] = [];
    for (let c = 0; c <= GRID_COLS; c += 1) {
      row.push([
        WEST + ((EAST - WEST) * c) / GRID_COLS + (random() - 0.5) * 2.2,
        NORTH - ((NORTH - SOUTH) * r) / GRID_ROWS + (random() - 0.5) * 1.1,
      ]);
    }
    lattice.push(row);
  }

  const features: ProvinceFeature[] = [];
  for (let r = 0; r < GRID_ROWS; r += 1) {
    for (let c = 0; c < GRID_COLS; c += 1) {
      const id = `p-${r}${c}`;
      features.push({
        type: 'Feature',
        id,
        properties: { id, name: `Province ${r * GRID_COLS + c + 1}` },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              lattice[r][c],
              lattice[r][c + 1],
              lattice[r + 1][c + 1],
              lattice[r + 1][c],
              lattice[r][c],
            ],
          ],
        },
      });
    }
  }
  return features;
})();

export interface ProvinceValue {
  province: string;
  /** Economic Complexity Index — Figure 7. */
  eci: number;
  /** Change in share of national exports, percentage points — Figure 8. */
  shareChange: number;
}

/**
 * Twelve provinces, eleven with data.
 *
 * `p-11` is deliberately absent from this table so both maps exercise the join's
 * miss path — the plate has a white gap in the same part of the map, and a
 * choropleth that paints an unmatched region as its palest bin is making a claim
 * the data does not support.
 */
export const provinceValues: readonly ProvinceValue[] = [
  { province: 'p-00', eci: -0.62, shareChange: -4.2 },
  { province: 'p-01', eci: 0.35, shareChange: -3.6 },
  { province: 'p-02', eci: 0.88, shareChange: -1.8 },
  { province: 'p-03', eci: 0.42, shareChange: 0.6 },
  { province: 'p-10', eci: -0.3, shareChange: -3.9 },
  { province: 'p-12', eci: 1.28, shareChange: -0.9 },
  { province: 'p-13', eci: 0.62, shareChange: 2.8 },
  { province: 'p-20', eci: -0.45, shareChange: -2.4 },
  { province: 'p-21', eci: -0.85, shareChange: -1.2 },
  { province: 'p-22', eci: 0.18, shareChange: 3.4 },
  { province: 'p-23', eci: 0.3, shareChange: 5.6 },
];

// ── Figure 9 — bubble scatter, pop-up ───────────────────────────────────────

export interface BubblePoint {
  country: string;
  gdp: number;
  eci: number;
  /** Export value, USD billions — the size channel. */
  exports: number;
}

const RAW_BUBBLES: ReadonlyArray<[gdp: number, eci: number, exports: number]> = [
  [1_600, -0.48, 6], [2_300, -0.4, 11], [3_100, -0.6, 8], [3_600, -0.14, 7],
  [5_000, 0.02, 22], [5_900, 0.1, 9], [6_900, -0.26, 7], [8_500, 0.28, 14],
  [9_400, 0.1, 10], [11_800, 0.62, 12], [14_000, 0.78, 26], [18_500, 0.68, 9],
  [20_500, 1.02, 16], [24_500, 1.14, 13], [27_500, 0.4, 8], [33_000, 1.48, 19],
  [38_000, 1.3, 10], [44_000, 0.86, 8], [49_000, 1.24, 14], [55_000, 1.66, 11],
  [66_000, 1.9, 12], [72_000, 2.14, 15], [78_000, 1.76, 9], [92_000, 2.46, 10],
];

export const bubbleData: readonly BubblePoint[] = [
  ...RAW_BUBBLES.map(([gdp, eci, exports], i) => ({
    country: `Peer ${i + 1}`,
    gdp,
    eci,
    exports,
  })),
  { country: 'South Korea', gdp: 58_000, eci: 2.42, exports: 42 },
];

// ── Figure 10 — line, pop-up over twelve peers ──────────────────────────────

export interface IndexPoint {
  year: number;
  country: string;
  index: number;
}

const INDEX_YEARS = Array.from({ length: 15 }, (_, i) => 2010 + i);

/** Ten flat peers plus the two the finding is about. */
function peerIndexSeries(): IndexPoint[] {
  const random = lcg(20260806);
  const rows: IndexPoint[] = [];

  for (let p = 0; p < 10; p += 1) {
    let level = 100;
    const drift = (random() - 0.5) * 0.9;
    for (const year of INDEX_YEARS) {
      rows.push({ year, country: `Peer ${p + 1}`, index: Math.round(level * 10) / 10 });
      level += drift + (random() - 0.5) * 4;
    }
  }
  return rows;
}

/** Ease-out so the climb flattens near the end, matching the PDF's shape. */
function climb(to: number) {
  return INDEX_YEARS.map((year, i) => {
    const t = i / (INDEX_YEARS.length - 1);
    return { year, value: 100 + (to - 100) * (1 - (1 - t) ** 1.7) };
  });
}

export const indexData: readonly IndexPoint[] = [
  ...peerIndexSeries(),
  ...climb(240).map(({ year, value }) => ({
    year,
    country: 'Mongolia',
    index: Math.round(value * 10) / 10,
  })),
  ...climb(210).map(({ year, value }) => ({
    year,
    country: 'Chile',
    index: Math.round(value * 10) / 10,
  })),
];
