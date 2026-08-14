/**
 * Datasets for the specimen plates.
 *
 * Separate from `data.ts` because that file's numbers are digitized off the spec
 * PDF's own plates and exist so a generated plate and a reference plate show the
 * *same picture*. These have no reference plate, so they carry the opposite
 * obligation: they only have to be **shaped like real data** — the right skew,
 * the right sign changes, a distribution with a tail — because a specimen drawn
 * from tidy synthetic numbers proves nothing about how the mark behaves when the
 * data is awkward.
 *
 * Everything random comes from the same fixed-seed LCG `data.ts` uses, so two
 * renders are byte-identical and a diff only ever shows a real change.
 *
 * None of this is real. Every specimen's source line says so.
 */

/** Deterministic PRNG — same contract as the one in `data.ts`. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** Box–Muller on top of the LCG, for the distribution specimens. */
function gaussian(random: () => number): number {
  const u = Math.max(random(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

// ── Ranked categories — lollipop, horizontal bars ───────────────────────────

export interface RankRow {
  country: string;
  share: number;
}

/** Deliberately long labels: the case a horizontal axis exists for. */
export const rankData: readonly RankRow[] = [
  { country: 'Mongolia', share: 42.4 },
  { country: 'Chile', share: 38.1 },
  { country: 'Zambia', share: 31.7 },
  { country: 'Peru', share: 24.9 },
  { country: 'Kazakhstan', share: 19.3 },
  { country: 'Indonesia', share: 12.6 },
];

// ── Dumbbell — two states per entity ────────────────────────────────────────

export interface GapRow {
  country: string;
  then: number;
  now: number;
}

/** Two entities move backwards, so the connector cannot imply a direction. */
export const gapData: readonly GapRow[] = [
  { country: 'Vietnam', then: 18, now: 47 },
  { country: 'Morocco', then: 22, now: 39 },
  { country: 'Ghana', then: 31, now: 36 },
  { country: 'Bolivia', then: 34, now: 27 },
  { country: 'Venezuela', then: 41, now: 16 },
];

// ── Error bars — point estimates with intervals ─────────────────────────────

export interface EstimateRow {
  sector: string;
  estimate: number;
  low: number;
  high: number;
}

/** Widths differ a lot, which is the whole reason to draw the interval. */
export const estimateData: readonly EstimateRow[] = [
  { sector: 'Mining', estimate: 3.2, low: 2.9, high: 3.5 },
  { sector: 'Textiles', estimate: 2.1, low: 0.7, high: 3.5 },
  { sector: 'Electronics', estimate: 4.6, low: 4.1, high: 5.1 },
  { sector: 'Agriculture', estimate: 1.4, low: -0.4, high: 3.2 },
  { sector: 'Services', estimate: 2.8, low: 2.2, high: 3.4 },
];

// ── Candlestick — OHLC ──────────────────────────────────────────────────────

export interface CandleRow {
  day: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export const candleData: readonly CandleRow[] = (() => {
  const random = lcg(20260210);
  const rows: CandleRow[] = [];
  let price = 104;
  for (let day = 1; day <= 22; day++) {
    const open = price;
    const drift = (random() - 0.48) * 6;
    const close = Math.max(80, open + drift);
    const wick = 1 + random() * 2.5;
    rows.push({
      day,
      open: Math.round(open * 10) / 10,
      close: Math.round(close * 10) / 10,
      high: Math.round((Math.max(open, close) + wick) * 10) / 10,
      low: Math.round((Math.min(open, close) - wick) * 10) / 10,
    });
    price = close;
  }
  return rows;
})();

// ── Directed change in two dimensions ───────────────────────────────────────

export interface MoveRow {
  country: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** One country moves down-left, so the arrowheads have to disambiguate. */
export const moveData: readonly MoveRow[] = [
  { country: 'Vietnam', x1: 1.2, y1: 0.4, x2: 2.6, y2: 1.5 },
  { country: 'Poland', x1: 2.4, y1: 1.6, x2: 3.4, y2: 2.2 },
  { country: 'Chile', x1: 2.0, y1: 0.9, x2: 2.4, y2: 1.1 },
  { country: 'Venezuela', x1: 2.2, y1: 1.4, x2: 1.1, y2: 0.5 },
];

// ── Vector field ────────────────────────────────────────────────────────────

export interface VectorRow {
  lon: number;
  lat: number;
  speed: number;
  bearing: number;
}

/** A smooth rotational field on a 9×7 lattice — 63 marks, the density that matters. */
export const vectorData: readonly VectorRow[] = (() => {
  const rows: VectorRow[] = [];
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 7; j++) {
      const lon = -4 + i;
      const lat = -3 + j;
      const speed = 6 + Math.hypot(lon, lat) * 1.6;
      rows.push({
        lon,
        lat,
        speed,
        bearing: (Math.atan2(lat, lon) * 180) / Math.PI + 90,
      });
    }
  }
  return rows;
})();

// ── Band, fan, moving average, date axis ────────────────────────────────────

export interface ForecastRow {
  year: number;
  value: number;
  lo50: number;
  hi50: number;
  lo90: number;
  hi90: number;
}

/** A series whose interval WIDENS with time — the case a flat band would hide. */
export const forecastData: readonly ForecastRow[] = (() => {
  const random = lcg(19940715);
  const rows: ForecastRow[] = [];
  for (let i = 0; i <= 24; i++) {
    const year = 2000 + i;
    const value = 100 + i * 3.1 + gaussian(random) * 4;
    const spread = 3 + i * 0.55;
    rows.push({
      year,
      value: Math.round(value * 10) / 10,
      lo50: Math.round((value - spread) * 10) / 10,
      hi50: Math.round((value + spread) * 10) / 10,
      lo90: Math.round((value - spread * 1.9) * 10) / 10,
      hi90: Math.round((value + spread * 1.9) * 10) / 10,
    });
  }
  return rows;
})();

export interface DailyRow {
  date: Date;
  value: number;
}

/**
 * ~14 months of daily observations. Deliberately spans more than a year, so the
 * date axis has to choose `Mon YYYY` and label both endpoints rather than
 * repeating the year on every tick.
 */
export const dailyData: readonly DailyRow[] = (() => {
  const random = lcg(20220301);
  const rows: DailyRow[] = [];
  let value = 62;
  const start = Date.UTC(2022, 2, 14);
  for (let d = 0; d < 430; d++) {
    value += gaussian(random) * 1.1 + Math.sin(d / 58) * 0.35;
    rows.push({ date: new Date(start + d * 86_400_000), value: Math.round(value * 100) / 100 });
  }
  return rows;
})();

// ── Scatter with a fit, and a distribution ──────────────────────────────────

export interface FitRow {
  x: number;
  y: number;
}

/** A real but noisy relationship: r² lands near 0.7, not 0.99. */
export const fitData: readonly FitRow[] = (() => {
  const random = lcg(20011231);
  return Array.from({ length: 90 }, () => {
    const x = 6 + random() * 5.2;
    return {
      x: Math.round(x * 100) / 100,
      y: Math.round((0.72 * x - 3.1 + gaussian(random) * 0.75) * 100) / 100,
    };
  });
})();

/** Right-skewed, like most economic distributions — the case FD binning is for. */
export const incomeSample: readonly number[] = (() => {
  const random = lcg(20190404);
  return Array.from({ length: 480 }, () =>
    Math.round(Math.exp(8.1 + gaussian(random) * 0.62)),
  );
})();

// ── Matrix heatmap ──────────────────────────────────────────────────────────

export interface MatrixCell {
  sector: string;
  year: string;
  value: number;
}

export const MATRIX_SECTORS = [
  'Minerals',
  'Agriculture',
  'Textiles',
  'Chemicals',
  'Machinery',
  'Services',
] as const;

export const matrixData: readonly MatrixCell[] = (() => {
  const random = lcg(20170808);
  const rows: MatrixCell[] = [];
  MATRIX_SECTORS.forEach((sector, s) => {
    for (let y = 0; y < 12; y++) {
      rows.push({
        sector,
        year: String(2013 + y),
        value: Math.round(Math.max(0, 20 + s * 7 + y * 2.2 + gaussian(random) * 9)),
      });
    }
  });
  return rows;
})();

// ── Hexbin ──────────────────────────────────────────────────────────────────

export interface PointRow {
  x: number;
  y: number;
}

/** Two overlapping clusters, so the density has structure to find. */
export const cloudData: readonly PointRow[] = (() => {
  const random = lcg(20240119);
  const points: PointRow[] = [];
  const cluster = (cx: number, cy: number, n: number, sd: number) => {
    for (let i = 0; i < n; i++) {
      points.push({ x: cx + gaussian(random) * sd, y: cy + gaussian(random) * sd });
    }
  };
  cluster(3.2, 3.0, 320, 0.85);
  cluster(6.1, 5.4, 240, 1.05);
  cluster(4.8, 2.2, 120, 1.4);
  return points;
})();

// ── Waterfall ───────────────────────────────────────────────────────────────

export interface BridgeRow {
  step: string;
  delta: number;
}

export const bridgeData: readonly BridgeRow[] = [
  { step: 'Minerals', delta: 18.4 },
  { step: 'Agri.', delta: 6.2 },
  { step: 'Textiles', delta: -4.8 },
  { step: 'Machinery', delta: 9.1 },
  { step: 'Services', delta: -3.3 },
];

// ── Normalized stack ────────────────────────────────────────────────────────

export interface CompositionRow {
  year: string;
  tier: string;
  value: number;
}

export const COMPOSITION_ORDER = ['Low', 'Medium', 'High complexity'] as const;

/** Totals differ a lot year to year — which is exactly what normalizing hides, and should. */
export const compositionData: readonly CompositionRow[] = (() => {
  const random = lcg(20081015);
  const rows: CompositionRow[] = [];
  for (let i = 0; i < 8; i++) {
    const year = String(2017 + i);
    const scale = 60 + random() * 90;
    COMPOSITION_ORDER.forEach((tier, t) => {
      const trend = t === 2 ? 0.18 + i * 0.028 : t === 1 ? 0.34 : 0.48 - i * 0.028;
      rows.push({ year, tier, value: Math.round(scale * trend * 10) / 10 });
    });
  }
  return rows;
})();

// ── Marimekko ───────────────────────────────────────────────────────────────

export interface MekkoRow {
  market: string;
  /** Column width — the market's share of the total. */
  weight: number;
  segment: string;
  /** Share within the column, 0–1. */
  share: number;
}

export const MEKKO_SEGMENTS = ['Agree', 'Neutral', 'Disagree'] as const;

export const mekkoData: readonly MekkoRow[] = [
  { market: 'East Asia', weight: 34, segment: 'Agree', share: 0.58 },
  { market: 'East Asia', weight: 34, segment: 'Neutral', share: 0.24 },
  { market: 'East Asia', weight: 34, segment: 'Disagree', share: 0.18 },
  { market: 'Europe', weight: 26, segment: 'Agree', share: 0.44 },
  { market: 'Europe', weight: 26, segment: 'Neutral', share: 0.31 },
  { market: 'Europe', weight: 26, segment: 'Disagree', share: 0.25 },
  { market: 'Africa', weight: 22, segment: 'Agree', share: 0.67 },
  { market: 'Africa', weight: 22, segment: 'Neutral', share: 0.19 },
  { market: 'Africa', weight: 22, segment: 'Disagree', share: 0.14 },
  { market: 'Andes', weight: 18, segment: 'Agree', share: 0.39 },
  { market: 'Andes', weight: 18, segment: 'Neutral', share: 0.28 },
  { market: 'Andes', weight: 18, segment: 'Disagree', share: 0.33 },
];

// ── Radial ──────────────────────────────────────────────────────────────────

export interface SliceRow {
  part: string;
  value: number;
}

/** Four slices — the §3.8 cap, so the specimen sits exactly on the boundary. */
export const donutData: readonly SliceRow[] = [
  { part: 'Minerals', value: 4_180 },
  { part: 'Agriculture', value: 2_240 },
  { part: 'Manufactures', value: 1_560 },
  { part: 'Services', value: 920 },
];

export const donutTotal = donutData.reduce((sum, d) => sum + d.value, 0);

export interface CyclicRow {
  hour: number;
  value: number;
}

/** A daily cycle whose peak straddles midnight — unplottable on a linear axis. */
export const cyclicData: readonly CyclicRow[] = (() => {
  const random = lcg(20200626);
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    value:
      Math.round(
        (18 + Math.cos(((hour - 1) / 24) * Math.PI * 2) * 11 + gaussian(random) * 0.9) * 10,
      ) / 10,
  }));
})();

export interface BearingRow {
  bearing: string;
  frequency: number;
}

export const roseData: readonly BearingRow[] = [
  { bearing: 'N', frequency: 12 },
  { bearing: 'NE', frequency: 7 },
  { bearing: 'E', frequency: 4 },
  { bearing: 'SE', frequency: 6 },
  { bearing: 'S', frequency: 15 },
  { bearing: 'SW', frequency: 22 },
  { bearing: 'W', frequency: 18 },
  { bearing: 'NW', frequency: 9 },
];

export interface ObservationRow {
  bearing: number;
  speed: number;
}

/** A prevailing south-westerly, so the polar scatter has a real lobe. */
export const observationData: readonly ObservationRow[] = (() => {
  const random = lcg(20211111);
  return Array.from({ length: 260 }, () => {
    const prevailing = random() < 0.62;
    const bearing = prevailing ? 225 + gaussian(random) * 28 : random() * 360;
    return {
      bearing: ((bearing % 360) + 360) % 360,
      speed: Math.max(0.4, (prevailing ? 9 : 4) + gaussian(random) * 2.6),
    };
  });
})();

/** One value against a known range, for the gauge. */
export const gaugeValue = 0.68;
