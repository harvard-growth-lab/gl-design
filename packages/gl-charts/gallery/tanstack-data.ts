/**
 * Datasets for the TanStack-catalog specimens.
 *
 * `data.ts` carries numbers digitized off the spec PDF's plates, so a generated
 * plate and a reference plate show the same picture. `specimen-data.ts` carries
 * the first twenty-five specimens'. This file carries the rest — the eighty
 * catalog entries the gallery had no answer for — and it inherits
 * `specimen-data.ts`'s obligation rather than `data.ts`'s:
 *
 *   **shaped like real data, never tidy.** A right skew where economics has one,
 *   a series that goes backwards, groups with unequal n, a gap where an
 *   observation genuinely is missing. A specimen drawn from a smooth sine wave
 *   proves the mark renders; it proves nothing about whether the mark stays
 *   legible when the data is awkward, which is the only question worth asking of
 *   a design system.
 *
 * Everything random comes from the same fixed-seed LCG the other two files use,
 * so two renders are byte-identical and a diff only ever shows a real change.
 * Seeds are literal dates, chosen once and never tuned to make a plate look
 * better — a dataset re-rolled until the chart is pretty is a chart that has
 * stopped testing anything.
 *
 * None of this is real. Every specimen's source line says so.
 */

/** Deterministic PRNG — same contract as `data.ts` and `specimen-data.ts`. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** Box–Muller on top of the LCG. */
function gaussian(random: () => number): number {
  const u = Math.max(random(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

const round = (value: number, places = 2): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

// ════════════════════════════════════════════════════════════════════════════
// Multi-series time — the spine of the Trend, Composition and Ranking families
// ════════════════════════════════════════════════════════════════════════════

export interface SectorPoint {
  sector: string;
  year: number;
  /** Employment, thousands. */
  value: number;
}

/**
 * Five sectors, twenty-one years.
 *
 * One dataset backs eleven specimens — stacked area, streamgraph, indexed lines,
 * bump ranking, end-labelled lines, the percentile ribbon, and five of the
 * interaction plates. That is deliberate: the catalog's point is that the *same*
 * numbers support a dozen forms, and reusing one table is what makes the
 * comparison between those forms mean something. A different dataset per plate
 * would let a form look better than it is because its data flattered it.
 *
 * Shaped so the ranking genuinely churns — Construction overtakes Manufacturing
 * in the middle of the span and gives it back — because a bump chart drawn over
 * series that never cross is a bump chart that proves nothing.
 */
export const SECTORS = [
  'Manufacturing',
  'Construction',
  'Retail',
  'Services',
  'Agriculture',
] as const;

export const SECTOR_YEARS: readonly number[] = Array.from({ length: 21 }, (_, i) => 2004 + i);

export const sectorData: readonly SectorPoint[] = (() => {
  const random = lcg(20040101);
  // Level, trend, and the amplitude/phase of one slow cycle per sector. The
  // cycles are what make the stack churn: shared amplitude with different phase
  // is how real sectoral employment behaves through a business cycle.
  const shape: Record<(typeof SECTORS)[number], [number, number, number, number]> = {
    Manufacturing: [820, -9.5, 60, 0.2],
    Construction: [540, 6.2, 150, 1.9],
    Retail: [610, 1.4, 45, 3.4],
    Services: [700, 18.5, 40, 0.9],
    Agriculture: [240, -3.1, 22, 2.6],
  };

  return SECTORS.flatMap((sector) => {
    const [level, trend, amplitude, phase] = shape[sector];
    return SECTOR_YEARS.map((year, i) => ({
      sector,
      year,
      value: Math.max(
        40,
        round(
          level + trend * i + Math.sin(i / 3.2 + phase) * amplitude + gaussian(random) * 14,
          1,
        ),
      ),
    }));
  });
})();

// ── A single series with genuine holes ──────────────────────────────────────

export interface GappedPoint {
  t: number;
  /** `null` where the exchange was closed. Not zero, and not interpolated. */
  value: number | null;
}

/**
 * Two years of a daily index with two multi-week outages.
 *
 * The gaps are `null`, never a missing row, and that distinction is the whole
 * specimen: a line drawn over absent rows interpolates straight across the hole
 * and invents a trend nobody measured. A `null` breaks the path.
 */
export const gappedSeries: readonly GappedPoint[] = (() => {
  const random = lcg(20180903);
  const start = Date.UTC(2022, 0, 3);
  const rows: GappedPoint[] = [];
  let value = 148;
  for (let d = 0; d < 520; d += 1) {
    value += gaussian(random) * 1.6 + Math.sin(d / 74) * 0.55;
    const date = new Date(start + d * 86_400_000);
    const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    // Two deliberate suspensions, on top of the weekends.
    const suspended = (d >= 168 && d < 196) || (d >= 340 && d < 356);
    rows.push({
      t: date.getTime(),
      value: weekend || suspended ? null : round(value, 1),
    });
  }
  return rows;
})();

// ── Monthly range ───────────────────────────────────────────────────────────

export interface MonthRange {
  month: string;
  index: number;
  low: number;
  high: number;
  mean: number;
  /** Rainfall, mm — the second encoding on the composed chart. */
  precipitation: number;
}

export const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * A seasonal band whose width is not constant — winter spreads wider than
 * summer, which is what a flat ribbon drawn at a fixed offset would hide.
 */
export const monthlyRange: readonly MonthRange[] = MONTHS.map((month, index) => {
  const seasonal = Math.cos(((index - 6.4) / 12) * Math.PI * 2);
  const mean = 14.2 - seasonal * 7.1;
  const spread = 4.6 + (seasonal + 1) * 2.4;
  return {
    month,
    index,
    mean: round(mean, 1),
    low: round(mean - spread, 1),
    high: round(mean + spread, 1),
    precipitation: round(Math.max(2, 96 + seasonal * 74), 0),
  };
});

// ════════════════════════════════════════════════════════════════════════════
// Bars
// ════════════════════════════════════════════════════════════════════════════

export interface RankedRow {
  name: string;
  value: number;
}

/**
 * Deliberately long names, one of them very long.
 *
 * This is the dataset the horizontal orientation exists for: on a vertical axis
 * these labels rotate 90° and the chart becomes unreadable, which is the
 * argument `bar-horizontal-ranking` is making and cannot make with three-letter
 * categories.
 */
export const longRankData: readonly RankedRow[] = [
  { name: 'Mineral fuels and lubricants', value: 41.8 },
  { name: 'Machinery and transport equipment', value: 33.2 },
  { name: 'Crude materials, inedible', value: 24.7 },
  { name: 'Manufactured goods by material', value: 19.4 },
  { name: 'Chemicals and related products', value: 14.1 },
  { name: 'Food and live animals', value: 11.6 },
  { name: 'Beverages and tobacco', value: 4.3 },
];

export interface GroupedBarRow {
  region: string;
  period: string;
  value: number;
}

export const GROUPED_PERIODS = ['2014', '2019', '2024'] as const;

/** Three periods per region, and one region that falls rather than rises. */
export const groupedBars: readonly GroupedBarRow[] = [
  ['East Asia', [38, 47, 58]],
  ['South Asia', [21, 29, 34]],
  ['Latin America', [33, 31, 27]],
  ['Sub-Saharan Africa', [14, 19, 26]],
].flatMap(([region, values]) =>
  GROUPED_PERIODS.map((period, i) => ({
    region: region as string,
    period,
    value: (values as number[])[i],
  })),
);

export interface SpecimenObservation {
  species: string;
  sex: string;
  /** Body mass, grams. */
  mass: number;
}

/**
 * Raw observations for the reducer specimen — unequal group sizes on purpose.
 *
 * A grouped mean drawn from equal-n groups looks identical whether the reducer
 * weights by count or not. These do not, so the bar heights depend on the
 * reduction actually running.
 */
export const specimenObservations: readonly SpecimenObservation[] = (() => {
  const random = lcg(20070914);
  const groups: [string, string, number, number, number][] = [
    ['Adelie', 'female', 3_368, 269, 73],
    ['Adelie', 'male', 4_043, 347, 73],
    ['Chinstrap', 'female', 3_527, 285, 34],
    ['Chinstrap', 'male', 3_939, 362, 34],
    ['Gentoo', 'female', 4_680, 282, 58],
    ['Gentoo', 'male', 5_485, 313, 61],
  ];
  return groups.flatMap(([species, sex, mean, sd, n]) =>
    Array.from({ length: n }, () => ({
      species,
      sex,
      mass: Math.round(mean + gaussian(random) * sd),
    })),
  );
})();

export interface PyramidRow {
  band: string;
  sex: string;
  /** Signed for the pyramid: female left of the axis, male right. */
  count: number;
}

export const AGE_BANDS = [
  '0–9', '10–19', '20–29', '30–39', '40–49', '50–59', '60–69', '70+',
] as const;

/** A pyramid with a genuine bulge — the cohort that is 30–39 today. */
export const pyramidData: readonly PyramidRow[] = AGE_BANDS.flatMap((band, i) => {
  const base = [9.4, 9.1, 9.8, 11.2, 8.6, 6.9, 4.8, 3.1][i];
  return [
    { band, sex: 'Female', count: -round(base * 0.99, 2) },
    { band, sex: 'Male', count: round(base * 1.03, 2) },
  ];
});

// ════════════════════════════════════════════════════════════════════════════
// Scatter
// ════════════════════════════════════════════════════════════════════════════

export interface BubbleRow {
  country: string;
  income: number;
  complexity: number;
  /** Population, millions — the size channel. */
  population: number;
  region: string;
}

export const bubbleRows: readonly BubbleRow[] = [
  { country: 'Vietnam', income: 4_100, complexity: 0.42, population: 98, region: 'East Asia' },
  { country: 'Indonesia', income: 4_800, complexity: -0.18, population: 276, region: 'East Asia' },
  { country: 'Thailand', income: 7_100, complexity: 1.02, population: 72, region: 'East Asia' },
  { country: 'Malaysia', income: 11_400, complexity: 1.14, population: 33, region: 'East Asia' },
  { country: 'India', income: 2_400, complexity: 0.58, population: 1_417, region: 'South Asia' },
  { country: 'Pakistan', income: 1_600, complexity: -0.44, population: 236, region: 'South Asia' },
  { country: 'Bangladesh', income: 2_700, complexity: -0.9, population: 171, region: 'South Asia' },
  { country: 'Brazil', income: 8_900, complexity: 0.11, population: 215, region: 'Latin America' },
  { country: 'Mexico', income: 11_500, complexity: 1.21, population: 128, region: 'Latin America' },
  { country: 'Chile', income: 15_400, complexity: -0.09, population: 20, region: 'Latin America' },
  { country: 'Peru', income: 7_000, complexity: -0.62, population: 34, region: 'Latin America' },
  { country: 'Nigeria', income: 2_100, complexity: -1.51, population: 218, region: 'Africa' },
  { country: 'Kenya', income: 2_100, complexity: -0.51, population: 54, region: 'Africa' },
  { country: 'Ghana', income: 2_400, complexity: -0.98, population: 33, region: 'Africa' },
  { country: 'South Africa', income: 6_800, complexity: 0.29, population: 60, region: 'Africa' },
  { country: 'Poland', income: 18_700, complexity: 1.24, population: 37, region: 'Europe' },
  { country: 'Türkiye', income: 10_600, complexity: 0.72, population: 85, region: 'Europe' },
  { country: 'Germany', income: 48_700, complexity: 2.09, population: 84, region: 'Europe' },
  { country: 'Korea, Rep.', income: 32_400, complexity: 2.35, population: 52, region: 'East Asia' },
  { country: 'Japan', income: 34_000, complexity: 2.28, population: 125, region: 'East Asia' },
];

export interface LogSizeRow {
  name: string;
  /** Spans four orders of magnitude — the case for a log axis. */
  size: number;
  depth: number;
}

/**
 * File sizes across four decades of magnitude.
 *
 * On a linear axis, 91% of these points stack on the left edge in a band a few
 * pixels wide and the chart says nothing. That collapse is the specimen.
 */
export const logSizes: readonly LogSizeRow[] = (() => {
  const random = lcg(20130621);
  return Array.from({ length: 140 }, (_, i) => ({
    name: `module-${i}`,
    size: Math.round(Math.exp(5.4 + gaussian(random) * 2.05)),
    depth: 1 + Math.floor(random() * 5),
  }));
})();

export interface PathPoint {
  year: number;
  /** Unemployment rate, %. */
  unemployment: number;
  /** Inflation, %. */
  inflation: number;
}

/**
 * Twenty-two years of a Phillips-curve loop.
 *
 * The path crosses itself twice, which is the reason a connected scatter needs
 * arrowheads: without direction, a self-crossing path is genuinely ambiguous
 * about which way time runs.
 */
export const phillipsPath: readonly PathPoint[] = [
  { year: 2003, unemployment: 6.0, inflation: 2.3 },
  { year: 2004, unemployment: 5.5, inflation: 2.7 },
  { year: 2005, unemployment: 5.1, inflation: 3.4 },
  { year: 2006, unemployment: 4.6, inflation: 3.2 },
  { year: 2007, unemployment: 4.6, inflation: 2.9 },
  { year: 2008, unemployment: 5.8, inflation: 3.8 },
  { year: 2009, unemployment: 9.3, inflation: -0.4 },
  { year: 2010, unemployment: 9.6, inflation: 1.6 },
  { year: 2011, unemployment: 8.9, inflation: 3.2 },
  { year: 2012, unemployment: 8.1, inflation: 2.1 },
  { year: 2013, unemployment: 7.4, inflation: 1.5 },
  { year: 2014, unemployment: 6.2, inflation: 1.6 },
  { year: 2015, unemployment: 5.3, inflation: 0.1 },
  { year: 2016, unemployment: 4.9, inflation: 1.3 },
  { year: 2017, unemployment: 4.4, inflation: 2.1 },
  { year: 2018, unemployment: 3.9, inflation: 2.4 },
  { year: 2019, unemployment: 3.7, inflation: 1.8 },
  { year: 2020, unemployment: 8.1, inflation: 1.2 },
  { year: 2021, unemployment: 5.4, inflation: 4.7 },
  { year: 2022, unemployment: 3.6, inflation: 8.0 },
  { year: 2023, unemployment: 3.6, inflation: 4.1 },
  { year: 2024, unemployment: 4.1, inflation: 2.9 },
];

export interface CarRow {
  weight: number;
  economy: number;
  cylinders: number;
}

/**
 * ~400 observations with heavy overplotting in the middle.
 *
 * The pile-up is the point: this is the dataset that shows why §3.4 puts scatter
 * fill AND stroke at 0.8 rather than reducing one of them, because only matched
 * opacities darken together into a density signal.
 */
export const carRows: readonly CarRow[] = (() => {
  const random = lcg(19700401);
  return Array.from({ length: 406 }, () => {
    const cylinders = [4, 4, 4, 4, 6, 6, 8, 8][Math.floor(random() * 8)];
    const weight = 1_600 + cylinders * 340 + gaussian(random) * 320;
    return {
      cylinders,
      weight: Math.round(weight),
      economy: round(Math.max(8, 52 - weight / 105 + gaussian(random) * 3.4), 1),
    };
  });
})();

// ════════════════════════════════════════════════════════════════════════════
// Distributions
// ════════════════════════════════════════════════════════════════════════════

export interface GroupedObservation {
  region: string;
  country: string;
  /** Economic complexity index. */
  complexity: number;
}

export const DISTRIBUTION_REGIONS = [
  'East Asia',
  'Europe',
  'Latin America',
  'South Asia',
  'Sub-Saharan Africa',
] as const;

/**
 * Five regions with unequal n and genuinely different *shapes* — Europe is
 * tight and high, Latin America is bimodal, Sub-Saharan Africa has a long right
 * tail with three outliers.
 *
 * The bimodality is what separates the specimens that use this: a boxplot draws
 * Latin America's two modes as one box with a median between them, and the
 * violin is the only form that shows they are there. That contrast is the whole
 * reason the catalog has both.
 */
export const groupedObservations: readonly GroupedObservation[] = (() => {
  const random = lcg(20150612);
  const spec: [string, number, number, number, boolean][] = [
    // region, mean, sd, n, bimodal
    ['East Asia', 0.72, 0.78, 24, false],
    ['Europe', 1.34, 0.52, 38, false],
    ['Latin America', 0.02, 0.63, 27, true],
    ['South Asia', -0.34, 0.55, 16, false],
    ['Sub-Saharan Africa', -0.92, 0.61, 41, false],
  ];
  const rows: GroupedObservation[] = [];
  for (const [region, mean, sd, n, bimodal] of spec) {
    for (let i = 0; i < n; i += 1) {
      const shift = bimodal ? (random() < 0.45 ? -0.68 : 0.72) : 0;
      rows.push({
        region,
        country: `${region.slice(0, 2).toUpperCase()}-${i + 1}`,
        complexity: round(mean + shift + gaussian(random) * sd, 3),
      });
    }
  }
  // Three genuine outliers, so the whisker rule has something to reach past.
  rows.push({ region: 'Sub-Saharan Africa', country: 'SU-out-1', complexity: 1.42 });
  rows.push({ region: 'Sub-Saharan Africa', country: 'SU-out-2', complexity: 1.18 });
  rows.push({ region: 'South Asia', country: 'SO-out-1', complexity: 1.31 });
  return rows;
})();

// ════════════════════════════════════════════════════════════════════════════
// Matrix, calendar
// ════════════════════════════════════════════════════════════════════════════

export interface OrdinalCell {
  row: string;
  column: string;
  value: number;
}

export const MATRIX_ROWS = ['Very high', 'High', 'Medium', 'Low', 'Very low'] as const;
export const MATRIX_COLUMNS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'] as const;

/**
 * A 5×5 transition matrix, values as percentages of each row.
 *
 * Strongly diagonal, because mobility matrices are — which is exactly the case
 * where a labelled heatmap earns its labels: the reader wants the number on the
 * diagonal, not a colour they have to take back to a legend.
 */
export const ordinalMatrix: readonly OrdinalCell[] = MATRIX_ROWS.flatMap((row, r) =>
  MATRIX_COLUMNS.map((column, c) => {
    const distance = Math.abs(r - c);
    return {
      row,
      column,
      value: Math.round(Math.max(2, 54 - distance * 15 + (r === c ? 6 : 0))),
    };
  }),
);

export interface CalendarDay {
  date: Date;
  /** Day of week, 0 = Monday. */
  weekday: number;
  /** Weeks since the first Monday of the span. */
  week: number;
  month: string;
  value: number;
}

/**
 * One year of daily counts on a week × weekday lattice.
 *
 * Weekends are genuinely near-zero and there is a fortnight of shutdown in
 * August. Both matter: a calendar heatmap whose only structure is noise is
 * indistinguishable from a random grid, and the two structures here are the two
 * a reader actually looks for — the weekly rhythm and the outage.
 */
export const calendarData: readonly CalendarDay[] = (() => {
  const random = lcg(20230102);
  // 2 Jan 2023 was a Monday, so week 0 starts clean and the lattice has no
  // ragged first column to explain away.
  const start = Date.UTC(2023, 0, 2);
  const rows: CalendarDay[] = [];
  for (let d = 0; d < 364; d += 1) {
    const date = new Date(start + d * 86_400_000);
    const weekday = (date.getUTCDay() + 6) % 7;
    const shutdown = d >= 208 && d < 222;
    const weekend = weekday >= 5;
    const seasonal = 1 + Math.sin((d / 364) * Math.PI * 2 - 1.1) * 0.32;
    const base = weekend ? 4 : 48 * seasonal;
    rows.push({
      date,
      weekday,
      week: Math.floor(d / 7),
      month: MONTHS[date.getUTCMonth()],
      value: shutdown ? 0 : Math.max(0, Math.round(base + gaussian(random) * (weekend ? 3 : 11))),
    });
  }
  return rows;
})();

// ════════════════════════════════════════════════════════════════════════════
// Survey, multivariate, change
// ════════════════════════════════════════════════════════════════════════════

export interface LikertRow {
  question: string;
  response: string;
  /** Share of respondents, 0–1. Signed by `LIKERT_SIGN`. */
  share: number;
}

export const LIKERT_RESPONSES = [
  'Strongly disagree',
  'Disagree',
  'Agree',
  'Strongly agree',
] as const;

/** Which side of the neutral line each response stacks on. */
export const LIKERT_SIGN: Record<string, -1 | 1> = {
  'Strongly disagree': -1,
  Disagree: -1,
  Agree: 1,
  'Strongly agree': 1,
};

/**
 * Six statements, four responses, ordered worst-to-best.
 *
 * The last statement is net-negative and the first strongly net-positive, so the
 * diverging baseline does real work — a Likert chart whose bars all lean the
 * same way could have been a plain stack.
 */
export const likertData: readonly LikertRow[] = (
  [
    ['Regulations are predictable', [0.09, 0.18, 0.44, 0.29]],
    ['Customs clearance is timely', [0.14, 0.22, 0.41, 0.23]],
    ['Credit is accessible', [0.21, 0.29, 0.34, 0.16]],
    ['Skilled labour is available', [0.18, 0.31, 0.36, 0.15]],
    ['Electricity supply is reliable', [0.27, 0.24, 0.32, 0.17]],
    ['Contracts are enforceable', [0.31, 0.33, 0.26, 0.10]],
  ] as [string, number[]][]
).flatMap(([question, shares]) =>
  LIKERT_RESPONSES.map((response, i) => ({
    question,
    response,
    share: round(shares[i] * LIKERT_SIGN[response], 3),
  })),
);

export interface ParallelRow {
  country: string;
  dimension: string;
  /** Raw value in the dimension's own units. */
  value: number;
}

export const PARALLEL_DIMENSIONS = [
  'Income',
  'Complexity',
  'Diversity',
  'Openness',
  'Schooling',
] as const;

/**
 * Six countries across five dimensions in five different unit systems.
 *
 * The mismatched units are the specimen: parallel coordinates only work once
 * every axis is normalized, and a plate that normalized the data before it got
 * here would be hiding the step that makes the form correct.
 */
export const parallelData: readonly ParallelRow[] = (
  [
    ['Korea, Rep.', [32_400, 2.35, 121, 0.82, 12.6]],
    ['Poland', [18_700, 1.24, 98, 1.06, 12.5]],
    ['Türkiye', [10_600, 0.72, 84, 0.61, 8.1]],
    ['Brazil', [8_900, 0.11, 63, 0.33, 8.3]],
    ['Kenya', [2_100, -0.51, 41, 0.29, 6.7]],
    ['Nigeria', [2_100, -1.51, 22, 0.27, 7.2]],
  ] as [string, number[]][]
).flatMap(([country, values]) =>
  PARALLEL_DIMENSIONS.map((dimension, i) => ({ country, dimension, value: values[i] })),
);

export interface SlopeRow {
  country: string;
  period: string;
  value: number;
}

export const SLOPE_PERIODS = ['2014', '2024'] as const;

/**
 * Eight economies over two periods, with two crossings and one pair that ends
 * within a rounding error of each other.
 *
 * The near-tie is deliberate — it is the case TanStack's own slopegraph lets
 * collide, and the case §3.1 answers by muting seven of the eight.
 */
export const slopeData: readonly SlopeRow[] = (
  [
    ['Vietnam', 18, 47],
    ['Poland', 44, 52],
    ['Morocco', 22, 39],
    ['Ghana', 31, 36],
    ['Chile', 37, 35],
    ['Bolivia', 34, 27],
    ['Venezuela', 41, 16],
    ['Türkiye', 39, 36],
  ] as [string, number, number][]
).flatMap(([country, then, now]) => [
  { country, period: SLOPE_PERIODS[0], value: then },
  { country, period: SLOPE_PERIODS[1], value: now },
]);

// ════════════════════════════════════════════════════════════════════════════
// Hierarchy — treemap, tidy tree, sunburst, nested donut
// ════════════════════════════════════════════════════════════════════════════

export interface HierarchyNode {
  name: string;
  value?: number;
  children?: HierarchyNode[];
}

/**
 * Three levels, unbalanced on purpose.
 *
 * `Services` has one deep branch and one shallow one, and `Agriculture` is a
 * leaf at depth 1. A tidy tree drawn from a perfectly balanced hierarchy is a
 * grid; the layout only has to prove itself on a ragged one.
 */
export const exportHierarchy: HierarchyNode = {
  name: 'Exports',
  children: [
    {
      name: 'Minerals',
      children: [
        { name: 'Copper', value: 1_840 },
        { name: 'Coal', value: 1_120 },
        { name: 'Iron ore', value: 760 },
        { name: 'Gold', value: 460 },
      ],
    },
    {
      name: 'Manufactures',
      children: [
        {
          name: 'Machinery',
          children: [
            { name: 'Engines', value: 540 },
            { name: 'Pumps', value: 280 },
            { name: 'Turbines', value: 190 },
          ],
        },
        { name: 'Textiles', value: 620 },
        { name: 'Chemicals', value: 410 },
      ],
    },
    {
      name: 'Services',
      children: [
        {
          name: 'Travel',
          children: [
            { name: 'Tourism', value: 690 },
            { name: 'Transport', value: 310 },
          ],
        },
        { name: 'Business', value: 480 },
      ],
    },
    { name: 'Agriculture', value: 880 },
  ],
};

/** Depth-1 totals, for the flat forms (treemap, pie, radial bars, waffle). */
export const exportTotals: readonly { part: string; value: number }[] = (() => {
  const total = (node: HierarchyNode): number =>
    node.value ?? (node.children ?? []).reduce((sum, child) => sum + total(child), 0);
  return (exportHierarchy.children ?? []).map((child) => ({
    part: child.name,
    value: total(child),
  }));
})();

// ════════════════════════════════════════════════════════════════════════════
// Part-to-whole — waffle, pie variants, radial bars
// ════════════════════════════════════════════════════════════════════════════

export interface ShareRow {
  label: string;
  /** Share of the whole, 0–1. */
  share: number;
}

/**
 * Seven categories, so the four-slice cap of §3.8 is genuinely exceeded.
 *
 * Kept at seven on purpose: the pie specimens exist to show what the rule
 * refuses, and a compliant four-slice pie would show nothing. The plates that
 * use this either group the tail (and say so) or draw all seven and carry the
 * warning as a recorded gap.
 */
export const shareRows: readonly ShareRow[] = [
  { label: 'Minerals', share: 0.312 },
  { label: 'Agriculture', share: 0.201 },
  { label: 'Machinery', share: 0.158 },
  { label: 'Textiles', share: 0.112 },
  { label: 'Chemicals', share: 0.089 },
  { label: 'Services', share: 0.078 },
  { label: 'Other', share: 0.05 },
];

// ════════════════════════════════════════════════════════════════════════════
// Radar
// ════════════════════════════════════════════════════════════════════════════

export interface CapabilityRow {
  country: string;
  dimension: string;
  /** Normalized 0–1 against the cross-country maximum in each dimension. */
  value: number;
}

export const CAPABILITY_DIMENSIONS = [
  'Complexity',
  'Diversity',
  'Institutions',
  'Human capital',
  'Infrastructure',
  'Openness',
] as const;

/**
 * Two profiles that cross rather than nest.
 *
 * A comparison radar where one polygon contains the other says only "bigger",
 * and would be a bar chart. These trade places on two dimensions, which is the
 * one finding the form is actually good at.
 */
export const capabilityData: readonly CapabilityRow[] = (
  [
    ['Peer median', [0.52, 0.61, 0.58, 0.66, 0.49, 0.71]],
    ['This economy', [0.74, 0.44, 0.63, 0.51, 0.72, 0.42]],
  ] as [string, number[]][]
).flatMap(([country, values]) =>
  CAPABILITY_DIMENSIONS.map((dimension, i) => ({ country, dimension, value: values[i] })),
);

// ════════════════════════════════════════════════════════════════════════════
// Timelines and lanes
// ════════════════════════════════════════════════════════════════════════════

export interface LaneEvent {
  lane: string;
  label: string;
  /** Days from the start of the programme. */
  start: number;
  end: number;
  phase: string;
}

/**
 * Six lanes with overlapping bars, one lane carrying three events and one
 * carrying a single long one.
 *
 * The uneven occupancy matters: a lane chart drawn from one event per lane is a
 * ranged bar chart, and would not show the collision handling the form exists
 * for.
 */
export const laneEvents: readonly LaneEvent[] = [
  { lane: 'Diagnostic', label: 'Scoping', start: 0, end: 45, phase: 'Delivered' },
  { lane: 'Diagnostic', label: 'Fieldwork', start: 52, end: 138, phase: 'Delivered' },
  { lane: 'Diagnostic', label: 'Report', start: 145, end: 176, phase: 'Delivered' },
  { lane: 'Data', label: 'Collection', start: 20, end: 210, phase: 'Delivered' },
  { lane: 'Modelling', label: 'Baseline', start: 96, end: 188, phase: 'Delivered' },
  { lane: 'Modelling', label: 'Scenarios', start: 190, end: 268, phase: 'In progress' },
  { lane: 'Engagement', label: 'Workshops', start: 130, end: 300, phase: 'In progress' },
  { lane: 'Publication', label: 'Drafting', start: 250, end: 330, phase: 'In progress' },
  { lane: 'Publication', label: 'Launch', start: 336, end: 358, phase: 'Planned' },
  { lane: 'Follow-up', label: 'Advisory', start: 300, end: 400, phase: 'Planned' },
];

// ════════════════════════════════════════════════════════════════════════════
// Geography
// ════════════════════════════════════════════════════════════════════════════

export type GeoFeature<G> = {
  type: 'Feature';
  id: string;
  properties: { id: string; name: string };
  geometry: G;
};

export type PolygonFeature = GeoFeature<{ type: 'Polygon'; coordinates: number[][][] }>;
export type PointFeature = GeoFeature<{ type: 'Point'; coordinates: [number, number] }>;
export type LineFeature = GeoFeature<{ type: 'LineString'; coordinates: [number, number][] }>;
export type MultiLineFeature = GeoFeature<{
  type: 'MultiLineString';
  coordinates: [number, number][][];
}>;

/**
 * A stylized world: eighteen blobby landmasses on a lat/lon grid.
 *
 * Synthetic rather than a real boundary file, and that is a deliberate cost.
 * Shipping Natural Earth would add megabytes to a repo whose gallery is a
 * development artifact, and the specimens do not test cartographic accuracy —
 * they test that a projection is fitted, that a ramp bins correctly, and that
 * `ink-3` hairlines separate same-bin neighbours. Blobs test all three.
 *
 * **Rings are wound clockwise.** `d3-geo` reads polygons on the sphere and
 * treats a counter-wound exterior ring as the whole world minus the region,
 * which floods the map and destroys the `fit` bounds. The generator below emits
 * clockwise vertices by walking the angle backwards; that is the one thing in
 * this function that is not free to change.
 */
export const worldFeatures: readonly PolygonFeature[] = (() => {
  const random = lcg(19921005);
  // [name, centre lon, centre lat, lon radius, lat radius]
  const blobs: [string, number, number, number, number][] = [
    ['Northwest', -108, 48, 26, 13],
    ['Northeast', -74, 44, 15, 9],
    ['Midlands', -96, 33, 20, 9],
    ['Isthmus', -88, 16, 11, 6],
    ['Andes North', -74, -4, 10, 12],
    ['Andes South', -66, -28, 12, 15],
    ['Plate', -50, -14, 15, 12],
    ['Iberia', -5, 40, 8, 6],
    ['Nordics', 16, 61, 14, 8],
    ['Central', 16, 48, 12, 6],
    ['Maghreb', 4, 30, 18, 8],
    ['Sahel', 12, 12, 22, 8],
    ['Congo', 22, -6, 13, 10],
    ['Cape', 25, -28, 11, 8],
    ['Levant', 44, 30, 14, 9],
    ['Steppe', 76, 50, 30, 12],
    ['Subcontinent', 79, 22, 12, 11],
    ['Archipelago', 118, -4, 18, 8],
  ];

  return blobs.map(([name, lon, lat, rx, ry], index) => {
    const id = `w-${String(index).padStart(2, '0')}`;
    const vertices: [number, number][] = [];
    const sides = 14;
    for (let i = 0; i <= sides; i += 1) {
      // Backwards, so the exterior ring comes out clockwise. See the note above.
      const angle = -(i / sides) * Math.PI * 2;
      const wobble = 0.72 + random() * 0.5;
      vertices.push([
        round(lon + Math.cos(angle) * rx * wobble, 3),
        round(Math.max(-82, Math.min(82, lat + Math.sin(angle) * ry * wobble)), 3),
      ]);
    }
    vertices[vertices.length - 1] = vertices[0];
    return {
      type: 'Feature' as const,
      id,
      properties: { id, name },
      geometry: { type: 'Polygon' as const, coordinates: [vertices] },
    };
  });
})();

export interface WorldValue {
  id: string;
  /** Learning poverty, % of ten-year-olds — sequential. */
  learningPoverty: number;
  /** Change in export share, percentage points — diverging. */
  shareChange: number;
  /** Population, millions — the bubble-map size channel. */
  population: number;
}

/**
 * Values for seventeen of the eighteen regions.
 *
 * `w-09` is absent so every map on this data exercises the join's miss path.
 * A choropleth that paints an unmatched region as its palest bin is making a
 * claim the data does not support, and the only way to keep that honest is to
 * always have one hole in the table.
 */
export const worldValues: readonly WorldValue[] = [
  { id: 'w-00', learningPoverty: 8, shareChange: 1.2, population: 38 },
  { id: 'w-01', learningPoverty: 11, shareChange: -2.4, population: 92 },
  { id: 'w-02', learningPoverty: 14, shareChange: -0.6, population: 141 },
  { id: 'w-03', learningPoverty: 42, shareChange: 0.9, population: 47 },
  { id: 'w-04', learningPoverty: 51, shareChange: 2.8, population: 88 },
  { id: 'w-05', learningPoverty: 36, shareChange: -3.1, population: 64 },
  { id: 'w-06', learningPoverty: 48, shareChange: 4.6, population: 218 },
  { id: 'w-07', learningPoverty: 9, shareChange: -1.1, population: 58 },
  { id: 'w-08', learningPoverty: 4, shareChange: 0.4, population: 27 },
  { id: 'w-10', learningPoverty: 63, shareChange: -4.2, population: 104 },
  { id: 'w-11', learningPoverty: 87, shareChange: 1.8, population: 196 },
  { id: 'w-12', learningPoverty: 91, shareChange: 3.3, population: 132 },
  { id: 'w-13', learningPoverty: 74, shareChange: -0.8, population: 71 },
  { id: 'w-14', learningPoverty: 58, shareChange: 5.4, population: 149 },
  { id: 'w-15', learningPoverty: 12, shareChange: -5.6, population: 83 },
  { id: 'w-16', learningPoverty: 55, shareChange: 6.1, population: 1_612 },
  { id: 'w-17', learningPoverty: 39, shareChange: 2.2, population: 344 },
];

/** Region centroids as Point features, for the bubble map. */
export const worldCentroids: readonly PointFeature[] = worldFeatures.map((feature) => {
  const ring = feature.geometry.coordinates[0];
  const lon = ring.reduce((sum, [x]) => sum + x, 0) / ring.length;
  const lat = ring.reduce((sum, [, y]) => sum + y, 0) / ring.length;
  return {
    type: 'Feature' as const,
    id: feature.id,
    properties: feature.properties,
    geometry: { type: 'Point' as const, coordinates: [round(lon, 3), round(lat, 3)] },
  };
});

/**
 * A five-year survey voyage as one LineString, plus its ports of call.
 *
 * Crosses the Atlantic twice and rounds the southern cape, so the route genuinely
 * needs a projection rather than an x/y plot — on a linear axis the two Atlantic
 * legs overlap and the path reads as one crossing.
 */
export const voyageRoute: LineFeature = {
  type: 'Feature',
  id: 'voyage',
  properties: { id: 'voyage', name: 'Survey voyage' },
  geometry: {
    type: 'LineString',
    coordinates: [
      [-1.4, 50.8], [-16.6, 28.3], [-23.6, 15.0], [-38.5, -12.9], [-43.2, -22.9],
      [-56.2, -34.9], [-62.3, -38.7], [-65.0, -42.8], [-68.3, -54.8], [-70.9, -53.2],
      [-75.0, -46.0], [-71.6, -33.4], [-70.4, -23.6], [-77.0, -12.0], [-89.6, -0.8],
      [-140.0, -17.5], [-149.6, -17.5], [174.8, -41.3], [151.2, -33.9], [115.9, -32.0],
      [72.4, -7.3], [57.5, -20.2], [18.4, -33.9], [-5.8, -16.0], [-38.5, -12.9],
      [-23.6, 15.0], [-25.7, 37.7], [-1.4, 50.8],
    ],
  },
};

export const voyagePorts: readonly PointFeature[] = (
  [
    ['Plymouth', -1.4, 50.8],
    ['Bahia', -38.5, -12.9],
    ['Montevideo', -56.2, -34.9],
    ['Tierra del Fuego', -68.3, -54.8],
    ['Valparaíso', -71.6, -33.4],
    ['Galápagos', -89.6, -0.8],
    ['Sydney', 151.2, -33.9],
    ['Cape Town', 18.4, -33.9],
  ] as [string, number, number][]
).map(([name, lon, lat], i) => ({
  type: 'Feature' as const,
  id: `port-${i}`,
  properties: { id: `port-${i}`, name },
  geometry: { type: 'Point' as const, coordinates: [lon, lat] as [number, number] },
}));

/**
 * A 30°/30° graticule as one MultiLineString.
 *
 * Generated rather than imported because `d3-geo`'s `geoGraticule` is not
 * reachable from here — the library never writes `from 'd3-geo'` (see the header
 * of `src/shapes/geo.ts`), and a gallery plate should not be the one place that
 * does. Meridians carry enough vertices to bend correctly under a curved
 * projection; a four-point meridian draws as a straight chord on a globe.
 */
export const graticule: MultiLineFeature = {
  type: 'Feature',
  id: 'graticule',
  properties: { id: 'graticule', name: 'Graticule' },
  geometry: {
    type: 'MultiLineString',
    coordinates: [
      // Meridians every 30°, sampled every 5° of latitude.
      ...Array.from({ length: 12 }, (_, i) => {
        const lon = -180 + i * 30;
        return Array.from(
          { length: 37 },
          (_, j) => [lon, -90 + j * 5] as [number, number],
        );
      }),
      // Parallels every 30°, sampled every 5° of longitude.
      ...Array.from({ length: 5 }, (_, i) => {
        const lat = -60 + i * 30;
        return Array.from(
          { length: 73 },
          (_, j) => [-180 + j * 5, lat] as [number, number],
        );
      }),
    ],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// Graphs — Sankey, force network, triangulation
// ════════════════════════════════════════════════════════════════════════════

export interface FlowNodeRow {
  id: string;
  /** Which stage of the chain the node sits in — only used for the caption. */
  stage: string;
}

export interface FlowLinkRow {
  source: string;
  target: string;
  value: number;
}

/**
 * A four-stage value chain, deliberately not a tree.
 *
 * `Concentrate` feeds both a domestic smelter and an export stream, and
 * `Smelting` feeds back into export — so two paths reconverge. A Sankey drawn
 * over a strict tree is a treemap with extra steps; the reconvergence is the
 * only structure the form shows that a hierarchy cannot.
 *
 * Flows balance at every interior node, because a Sankey's whole claim is
 * conservation and a diagram that quietly loses 3% of its throughput is making
 * a claim it cannot support.
 */
export const flowNodes: readonly FlowNodeRow[] = [
  { id: 'Copper ore', stage: 'Extraction' },
  { id: 'Bauxite', stage: 'Extraction' },
  { id: 'Concentrate', stage: 'Processing' },
  { id: 'Alumina', stage: 'Processing' },
  { id: 'Smelting', stage: 'Refining' },
  { id: 'Domestic use', stage: 'Destination' },
  { id: 'Export', stage: 'Destination' },
];

export const flowLinks: readonly FlowLinkRow[] = [
  { source: 'Copper ore', target: 'Concentrate', value: 68 },
  { source: 'Bauxite', target: 'Alumina', value: 44 },
  { source: 'Concentrate', target: 'Smelting', value: 41 },
  { source: 'Concentrate', target: 'Export', value: 27 },
  { source: 'Alumina', target: 'Smelting', value: 30 },
  { source: 'Alumina', target: 'Export', value: 14 },
  { source: 'Smelting', target: 'Domestic use', value: 26 },
  { source: 'Smelting', target: 'Export', value: 45 },
];

export interface NetworkNodeRow {
  id: string;
  group: string;
}

export interface NetworkLinkRow {
  source: string;
  target: string;
  value: number;
}

/**
 * A co-export network: three communities, sparsely bridged.
 *
 * Built as three dense-ish cliques plus four bridge edges, because that is the
 * structure a force layout exists to reveal — a graph with uniform density
 * settles into a blob and shows nothing, and one with no bridges settles into
 * three disconnected blobs that a grouped scatter would show more cheaply.
 */
const NETWORK_COMMUNITIES: readonly (readonly string[])[] = [
  ['Copper', 'Nickel', 'Zinc', 'Cobalt', 'Lead'],
  ['Cotton', 'Textiles', 'Apparel', 'Leather'],
  ['Engines', 'Turbines', 'Pumps', 'Valves', 'Bearings'],
];

export const networkNodes: readonly NetworkNodeRow[] = NETWORK_COMMUNITIES.flatMap(
  (members, i) => members.map((id) => ({ id, group: ['Minerals', 'Textiles', 'Machinery'][i] })),
);

export const networkLinks: readonly NetworkLinkRow[] = (() => {
  const links: NetworkLinkRow[] = [];
  for (const members of NETWORK_COMMUNITIES) {
    for (let a = 0; a < members.length; a += 1) {
      for (let b = a + 1; b < members.length; b += 1) {
        // Near-complete: drop the single longest chord in each community. A
        // complete clique settles into a perfect polygon, which reads as a
        // decoration rather than as a found structure; dropping one edge breaks
        // the symmetry without breaking the cluster. Dropping a THIRD of them —
        // the first attempt — left communities that were paths, and a force
        // layout over paths produces string, not clusters.
        if (a === 0 && b === members.length - 1) continue;
        links.push({ source: members[a], target: members[b], value: 2 });
      }
    }
  }
  // The bridges. Four of them, so the communities hold together without fusing.
  links.push(
    { source: 'Copper', target: 'Engines', value: 1 },
    { source: 'Zinc', target: 'Bearings', value: 1 },
    { source: 'Leather', target: 'Valves', value: 1 },
    { source: 'Cotton', target: 'Lead', value: 1 },
  );
  return links;
})();

export interface StationRow {
  name: string;
  x: number;
  y: number;
  /** Observed value at the station — what the Voronoi cells encode. */
  reading: number;
}

/**
 * Irregularly spaced measurement stations.
 *
 * Irregular on purpose: a Voronoi diagram over a regular lattice is a grid, and
 * a Delaunay triangulation over one is degenerate — four cocircular points have
 * no unique triangulation, so the result depends on floating-point tie-breaks.
 * Both forms only mean anything over scattered points.
 */
export const stations: readonly StationRow[] = (() => {
  const random = lcg(19850317);
  const names = [
    'Aran', 'Beck', 'Cairn', 'Dell', 'Esker', 'Fen', 'Garth', 'Holt',
    'Ings', 'Kirk', 'Lea', 'Moss', 'Nab', 'Otter', 'Peat', 'Quarry',
    'Ridge', 'Scar', 'Tarn', 'Vale', 'Wold', 'Yew',
  ];
  return names.map((name) => ({
    name,
    x: round(random() * 100, 2),
    y: round(random() * 68, 2),
    reading: round(4 + random() * 14, 1),
  }));
})();

/**
 * A wind-speed field on a 48×32 grid — two lows and a ridge between them.
 *
 * Smooth, because marching squares over a noisy field produces hundreds of tiny
 * disconnected rings that read as texture rather than as structure. The
 * structure here is deliberate and checkable: two minima and a saddle.
 */
export const WIND_GRID = { width: 48, height: 32 } as const;

export const windField: readonly number[] = (() => {
  const values: number[] = [];
  for (let y = 0; y < WIND_GRID.height; y += 1) {
    for (let x = 0; x < WIND_GRID.width; x += 1) {
      // Far enough apart that the two wells do not merge into one basin. At the
      // first spacing they did, and the plate's own caption — "a ridge between
      // them" — described a saddle the field did not contain.
      const lowA = Math.hypot(x - 10, y - 9) / 7;
      const lowB = Math.hypot(x - 38, y - 23) / 8;
      // Two Gaussian lows over a gentle south-westerly gradient.
      const speed =
        22 - 13 * Math.exp(-lowA * lowA) - 11 * Math.exp(-lowB * lowB) + (x + y) * 0.09;
      values.push(round(speed, 3));
    }
  }
  return values;
})();
