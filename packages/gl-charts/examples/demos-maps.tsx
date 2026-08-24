/**
 * Maps and Spatial — ten catalog forms, drawn on the Atlas country panel and
 * Natural Earth's 1:110m outlines.
 *
 * Geography is where the difference between a synthetic specimen and a real
 * dataset is least about *style* and most about *coverage*, and four things
 * recur below that the gallery's seventeen tidy synthetic regions could not
 * produce:
 *
 * 1. **The join misses in both directions.** The boundary file carries 177
 *    countries and the Atlas ranks 146. Thirty-five outlines have no Atlas row,
 *    and four Atlas economies — Bahrain, Hong Kong, Mauritius and Singapore —
 *    have no outline at all, because Natural Earth drops micro-states at
 *    1:110m. Every one of those renders in the no-data fill, which sits OUTSIDE
 *    the ramp. Two of the missing four are top-forty exporters, so the bubble
 *    map cannot place them at any radius.
 *
 * 2. **Equal-width bins meet a log-normal world.** §12 asks for five equal-width
 *    steps because that is what keeps the legend honest, and on Atlas export
 *    counts it puts three quarters of the world in the two palest bins. That is
 *    the rule working as designed and it is still a legibility cost; it is
 *    recorded rather than fixed with a quantile scale.
 *
 * 3. **`glGeoShape` is a choropleth polygon mark.** It takes no `tone`, so the
 *    three plates that put a point or a line on a map name their fills through
 *    `resolveTone` at the call site. Every value is still a token — but reaching
 *    past the vocabulary to get there is the finding the gallery already
 *    recorded, and the real data does nothing to soften it.
 *
 * 4. **A projected chart has no axes to label.** `geoShape` declares its scale
 *    value types as `never`, so every chart here runs `guides: false`. On a
 *    world map that is correct. On the contour plate — whose two axes are income
 *    and complexity, not longitude and latitude — it means the only way to put a
 *    scale on the picture is to draw one as geometry.
 *
 * Contract, unchanged: no hex, no font size, no stroke width, no opacity below.
 * Data preparation is authored; appearance never is.
 */

import type { ReactNode } from 'react';
import { Chart } from '@tanstack/react-charts';
import {
  geoAzimuthalEqualArea,
  geoEquirectangular,
  geoIdentity,
  geoMercator,
  geoNaturalEarth1,
  geoOrthographic,
} from 'd3-geo';

import {
  geometry,
  glAxisLog,
  glAxisX,
  glChart,
  glSequentialColor,
  glVector,
  ink,
  muted,
  resolveTone,
  surface,
} from '../src/index.js';
import type { GLContourFeature, GLProjectionFactory } from '../src/shapes.js';
import { glChoroplethChart, glContourGrid, glGeoShape } from '../src/shapes.js';
import { GLFigure, GLLegend } from '../src/figure.js';

import {
  FIRST_YEAR,
  LATEST_YEAR,
  LEAD,
  countries,
  countryName,
  countryYear,
  countryYearTable,
  crossSection,
  defined,
  leadPartnersTable,
  partnersIn,
  sourceOf,
  usd,
  withNote,
  worldFeatures,
  worldGeo,
  type WorldFeature,
} from './atlas-data.js';
import type { Demo, Family } from './demo.js';

const PANEL = sourceOf(countryYearTable);
const PARTNERS = sourceOf(leadPartnersTable);

/**
 * The boundary file is a second source and has to be cited as one — it is not
 * the Atlas, it has its own licence, and its resolution is the reason four
 * economies are missing from every map on this page.
 */
const OUTLINES = `Country outlines: ${worldGeo.meta.source}`;

/**
 * Everything the multi-layer plates fit their projection to.
 *
 * `fit: 'data'` frames the features a mark is drawing, so two marks over one map
 * fit to two different bounding boxes and silently render at two different
 * scales — the failure that slides a bubble layer off its basemap. Passing the
 * same explicit collection to every mark in a chart is what prevents it.
 */
const WORLD = { type: 'FeatureCollection' as const, features: worldFeatures };

/** Feature → Atlas join key. The boundary file was re-keyed to ISO3 for this. */
const featureIso = (f: WorldFeature) => f.properties.iso3;

/** Outlines by ISO3 — the lookup three plates need to place a mark at a country. */
const outlineOf = new Map(worldFeatures.map((f) => [f.properties.iso3, f]));

// ════════════════════════════════════════════════════════════════════════════

// #region demo:spec-07-vector-field
/**
 * A vector field, where the field is a decade of movement rather than a wind.
 *
 * The Atlas has no gridded field of anything — no wind, no elevation, no
 * lattice. What it does have is a plane every economy sits in (complexity
 * against income) and a second observation of every economy ten years later, so
 * the honest field is the DRIFT: one arrow per country, planted where it stood
 * in 2013 and pointing where it had moved to by 2023.
 *
 * §3.4.2 gives a field chrome WEIGHT with a data TONE — 145 arrows at line
 * weight would be a smear — and `glVector` carries that default, so nothing is
 * asked for here.
 *
 * The bearing is the part real data made awkward, and it is recorded as a gap:
 * `rotate` is screen degrees, the movement is in index points and log dollars,
 * and the two only agree if the plot is square.
 */
function ComplexityDrift() {
  const FROM = LATEST_YEAR - 10;
  const start = crossSection(FROM);
  const end = new Map(crossSection(LATEST_YEAR).map((d) => [d.iso3, d]));

  // Both ends of the move must exist. `gdpPerCapita` is the column with gaps —
  // 53 nulls across the panel — and a null income is not a zero income, so the
  // country drops out of the field rather than being planted at $0.
  const moves = start
    .map((from) => {
      const to = end.get(from.iso3);
      if (!to) return null;
      if (from.eci == null || to.eci == null) return null;
      if (from.gdpPerCapita == null || to.gdpPerCapita == null) return null;
      return {
        country: countryName(from.iso3),
        eci: from.eci,
        gdpPerCapita: from.gdpPerCapita,
        dEci: to.eci - from.eci,
        // Income sits on a log axis, so the *displacement* is a ratio, not a
        // difference. Taking it in log space here is what makes a doubling from
        // $1,000 and a doubling from $20,000 the same arrow.
        dIncome: Math.log10(to.gdpPerCapita) - Math.log10(from.gdpPerCapita),
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  // Each component is normalised by its own axis span before the two are
  // combined — otherwise ECI, which runs about five units wide, would swamp log
  // income, which runs about two and a half.
  const span = (values: number[]) => Math.max(...values) - Math.min(...values);
  const eciSpan = span(moves.map((d) => d.eci));
  const incomeSpan = span(moves.map((d) => Math.log10(d.gdpPerCapita)));

  const rows = moves.map((d) => {
    const sx = d.dEci / eciSpan;
    const sy = d.dIncome / incomeSpan;
    return {
      ...d,
      // Clockwise from up, which is what `rotate` means: up is "got richer",
      // right is "got more complex".
      bearing: (Math.atan2(sx, sy) * 180) / Math.PI,
      length: Math.hypot(sx, sy) * 150,
    };
  });

  const chart = glChart({
    marks: [
      glVector(rows, {
        x: 'eci',
        y: 'gdpPerCapita',
        length: 'length',
        rotate: 'bearing',
        anchor: 'start',
      }),
    ],
    x: glAxisX({ label: `Economic Complexity Index, ${FROM}` }),
    y: glAxisLog({ label: `GDP per capita, ${FROM} (current USD)` }),
  });

  return (
    <GLFigure
      title="Most economies got richer over the past decade; only half of those got more complex."
      subtitle={`Each arrow starts at an economy's position in ${FROM} and points to where it stood in ${LATEST_YEAR}; ${rows.length} economies with income measured in both years`}
      source={withNote(PANEL, 'Economies missing GDP per capita in either year are not drawn')}
    >
      <Chart {...chart.props} height={300} ariaLabel="Decade drift in complexity and income" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-102-world-choropleth
/**
 * The sequential choropleth, and §12's one sentence: darker is higher, always.
 *
 * Five equal-width bins on one hue, over a pinned `[0, 600]` domain rather than
 * the observed extent, so the legend's breaks are round numbers a reader can
 * hold. Equal width rather than equal count is the rule and it is the rule for a
 * reason — a quantile scale would distribute the map beautifully and quietly
 * break the reader's assumption that each step covers the same range of values.
 *
 * What real data adds is the cost of keeping that promise: export diversity is
 * right-skewed, so three quarters of the world lands in the two palest bins.
 * Recorded rather than fixed.
 *
 * The join misses in both directions and both misses are correct: 35 outlines
 * have no Atlas row, and four Atlas economies have no outline. All of them take
 * the no-data fill, which sits OUTSIDE the ramp — "no data" and "the lowest
 * value" are different claims and must not share a swatch.
 */
function ExportDiversity() {
  const rows = defined(crossSection(LATEST_YEAR), 'diversity');

  const chart = glChoroplethChart(worldFeatures, {
    projection: geoNaturalEarth1,
    id: featureIso,
    values: { rows, id: (r) => r.iso3, value: (r) => r.diversity },
    domain: [0, 600],
    legend: { label: 'Products exported with comparative advantage' },
  });

  return (
    <GLFigure
      title="Half the world exports fewer than 160 products competitively; China exports 568."
      subtitle={`Count of HS92 4-digit products exported with revealed comparative advantage, ${LATEST_YEAR}`}
      source={withNote(PANEL, OUTLINES)}
    >
      <Chart {...chart.props} height={340} ariaLabel="Export diversity by country" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-108-country-choropleth
/**
 * The diverging choropleth, and Decision Rule 9: a diverging ramp is legitimate
 * only where a midpoint genuinely means something.
 *
 * Here it does. The variable is places gained in the Atlas complexity ranking
 * between 1995 and 2023, so zero is "ended where it started" — a real reference
 * the data straddles in both directions, which is exactly the test
 * `glChoroplethChart` warns on when it fails.
 *
 * Rank is inverted before it is subtracted. Climbing the table means the rank
 * NUMBER falls, and a map whose blues meant "got worse" would be the easiest
 * possible way to make this chart lie.
 *
 * `symmetric` stays on. Vietnam's +71 and Venezuela's −83 are not equal, so the
 * deepest blue goes unused — that is the trade the option is meant to make, and
 * the alternative is a −40 economy reading as intensely as a +70 one.
 */
function ComplexityRankChange() {
  const rankIn = (year: number) =>
    new Map(defined(crossSection(year), 'eciRank').map((d) => [d.iso3, d.eciRank]));
  const first = rankIn(FIRST_YEAR);
  const last = rankIn(LATEST_YEAR);

  const moves = [...first].flatMap(([iso3, from]) => {
    const to = last.get(iso3);
    // Ranked in one year and not the other is not a movement of zero.
    return to == null ? [] : [{ iso3, climb: from - to }];
  });

  const chart = glChoroplethChart(worldFeatures, {
    kind: 'diverging',
    projection: geoNaturalEarth1,
    id: featureIso,
    values: { rows: moves, id: (r) => r.iso3, value: (r) => r.climb },
    midpoint: 0,
    legend: { label: `Places gained in the complexity ranking, ${FIRST_YEAR}–${LATEST_YEAR}` },
  });

  return (
    <GLFigure
      title="Vietnam climbed further up the complexity ranking than any other economy."
      subtitle={`Change in Economic Complexity Index rank, ${FIRST_YEAR} to ${LATEST_YEAR}; positive is a climb. ${moves.length} economies ranked in both years`}
      source={withNote(PANEL, OUTLINES)}
    >
      <Chart {...chart.props} height={340} ariaLabel="Change in complexity rank by country" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-109-us-state-choropleth
/**
 * The same preset, a smaller geography and a different projection — which is the
 * whole point of the entry: the projection is one argument, so zooming from the
 * world to a continent is a one-line change rather than a different chart.
 *
 * The catalog's plate is sub-national. The Atlas has no sub-national table of
 * anything, so this is drawn at the finest grain the Atlas actually publishes —
 * one region's countries — and the deviation is recorded rather than papered
 * over with invented provinces.
 *
 * The feature list is filtered by the country CATALOG rather than by the
 * boundary file's own continent field, so the map shows exactly the economies
 * the Atlas ranks: no outline appears that could never have carried a value.
 */
function AfricanComplexity() {
  const inRegion = new Set(countries.filter((c) => c.region === 'Africa').map((c) => c.iso3));
  const shapes = worldFeatures.filter((f) => inRegion.has(featureIso(f)));
  const rows = defined(crossSection(LATEST_YEAR), 'eci').filter((d) => inRegion.has(d.iso3));
  const unplaceable = rows.filter((d) => !outlineOf.has(d.iso3));

  const chart = glChoroplethChart(shapes, {
    projection: geoMercator,
    id: featureIso,
    values: { rows, id: (r) => r.iso3, value: (r) => r.eci },
    domain: [-2.6, 0.6],
    legend: { label: 'Economic Complexity Index' },
  });

  return (
    <GLFigure
      title="Five of Africa's forty-two ranked economies sit above the world's median complexity."
      subtitle={`Economic Complexity Index, ${LATEST_YEAR}; the world median that year is 0.09. ${rows.length} economies ranked, ${shapes.length} drawn — ${unplaceable
        .map((d) => countryName(d.iso3))
        .join(' and ')} has no outline at this resolution`}
      source={withNote(PANEL, OUTLINES)}
    >
      <Chart {...chart.props} height={340} ariaLabel="Economic complexity across Africa" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-103-bubble-map
/**
 * The point at which a country's outline balances — what the two plates that put
 * a mark AT a place need, and what a boundary file never ships.
 *
 * NOT the mean of the vertices, which is what the gallery's synthetic regions
 * could get away with: a real boundary file samples a fjord far more densely
 * than a straight desert border, so a vertex mean drags toward whichever edge is
 * craggiest. Not the bounding-box centre either — Norway's box is mostly sea.
 * This is the polygon centroid of the LARGEST ring, so Alaska does not pull the
 * United States into the Pacific and the Canaries do not pull Spain out to sea.
 */
function centroidOfOutline(feature: WorldFeature): [number, number] {
  const rings: number[][][] =
    feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates[0]]
      : feature.geometry.coordinates.map((polygon) => polygon[0]);

  // One shoelace pass per ring: the signed area picks the mainland out of a
  // MultiPolygon, and the first moments of the same sum give its centroid.
  const measure = (ring: number[][]) => {
    let area = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      area += cross;
      cx += (ring[j][0] + ring[i][0]) * cross;
      cy += (ring[j][1] + ring[i][1]) * cross;
    }
    const point: [number, number] =
      area === 0 ? [ring[0][0], ring[0][1]] : [cx / (3 * area), cy / (3 * area)];
    return { area: Math.abs(area / 2), point };
  };

  let best = measure(rings[0]);
  for (const ring of rings.slice(1)) {
    const candidate = measure(ring);
    if (candidate.area > best.area) best = candidate;
  }
  return best.point;
}

/**
 * A quantity AT a place, rather than a quantity OF a place.
 *
 * Two layers, both fitted to the same explicit collection — the trick the whole
 * geo family turns on. With `fit: 'data'` the bubble layer would fit to the
 * bounding box of the bubbles and drift off the basemap under it.
 *
 * The radius passes through a square root, because a radius set to the quantity
 * encodes it as area squared and a reader decodes a circle by area.
 *
 * Forty economies rather than all 146: total goods exports run 4,400:1 across
 * the panel, so an honest area encoding puts the bottom half below one pixel.
 * The forty drawn are 90% of the panel's trade, and the cut is stated on the
 * figure rather than buried in the shaping.
 */
function ExportBubbles() {
  const largest = defined(crossSection(LATEST_YEAR), 'exportValueM')
    .slice()
    .sort((a, b) => b.exportValueM - a.exportValueM)
    .slice(0, 40);

  // Two of the forty are entrepôts too small for Natural Earth's 110m set, so
  // they have no outline, no centroid, and no way onto this map at any radius.
  const unplaceable = largest.filter((d) => !outlineOf.has(d.iso3));

  const bubbles = largest
    .filter((d) => outlineOf.has(d.iso3))
    .map((d) => ({
      type: 'Feature' as const,
      id: d.iso3,
      properties: { name: countryName(d.iso3), exportValueM: d.exportValueM },
      geometry: {
        type: 'Point' as const,
        coordinates: centroidOfOutline(outlineOf.get(d.iso3)!),
      },
    }));

  const projection = { type: geoNaturalEarth1, fit: WORLD, inset: 6 };

  const chart = glChart({
    marks: [
      glGeoShape(worldFeatures, { projection, fill: muted.light }),
      glGeoShape(bubbles, {
        projection,
        fill: resolveTone('c-1').main,
        stroke: resolveTone('c-1').dark,
        r: (f) => 2 + Math.sqrt(f.properties.exportValueM) * 0.012,
      }),
    ],
    guides: false,
    margin: { left: 8, right: 8, top: 8, bottom: 8 },
  });

  return (
    <GLFigure
      title="Three economies ship nearly a third of the ranked world's goods exports."
      subtitle={`Total goods exports, ${LATEST_YEAR}; the forty largest exporters, bubble area proportional to value. ${unplaceable
        .map((d) => countryName(d.iso3))
        .join(' and ')} have no outline at this resolution and cannot be placed`}
      source={withNote(PANEL, OUTLINES)}
    >
      <Chart {...chart.props} height={320} ariaLabel="The forty largest goods exporters" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-105-route-map
/**
 * A path on the sphere — here a trade flow rather than a voyage.
 *
 * Each route is one two-point `LineString`, and that is enough: `d3-geo`'s path
 * generator resamples along the geodesic between adjacent vertices, so the leg
 * to the United States comes out as the great circle over the North Pacific and
 * is split correctly at the antimeridian. Drawn as an x/y segment it would run
 * backwards across the whole map.
 *
 * §3.1 on a map: the geography is context (`c-muted-light`) and the tracks are
 * the finding, so they take the series tone. All three layers share one explicit
 * fit for the same reason the bubble map's two do.
 *
 * `centroidOfOutline` is the bubble map's helper, reused — a route needs the
 * same "where is this country" answer a proportional symbol does.
 */
function PartnerRoutes() {
  const home = outlineOf.get(LEAD)!;
  const from = centroidOfOutline(home);

  const all = defined(partnersIn(LATEST_YEAR), 'exportValueM');
  const markets = all.filter((p) => outlineOf.has(p.partner));
  const unplaceable = all.filter((p) => !outlineOf.has(p.partner));

  const routes = markets.map((p) => ({
    type: 'Feature' as const,
    id: p.partner,
    properties: { name: p.partnerShort, exportValueM: p.exportValueM },
    geometry: {
      type: 'LineString' as const,
      coordinates: [from, centroidOfOutline(outlineOf.get(p.partner)!)],
    },
  }));

  const ports = [home, ...markets.map((p) => outlineOf.get(p.partner)!)].map((f) => ({
    type: 'Feature' as const,
    id: featureIso(f),
    properties: { name: f.properties.name },
    geometry: { type: 'Point' as const, coordinates: centroidOfOutline(f) },
  }));

  const projection = { type: geoEquirectangular, fit: WORLD, inset: 6 };

  const chart = glChart({
    marks: [
      // The basemap's internal borders take PAPER, not `glGeoShape`'s ink-3
      // default. That default is written for a choropleth, where a hairline
      // separates two encoded regions; here nothing is encoded on the land, so
      // ink-3 puts the heaviest ink on the figure around every country in the
      // world and the map reads as a political atlas with scratches on it —
      // the exact inversion of the §3.1 rule this demo cites.
      glGeoShape(worldFeatures, { projection, fill: muted.light, stroke: surface.paper }),
      // `strokeWidth` is passed because `glGeoShape` defaults to `mapStrokeWidth`
      // (0.5px, the region-separator hairline) for every geometry it is handed,
      // including a LineString. A route is a line layer, so it takes line weight
      // — a quarter-weight finding is not a finding.
      glGeoShape(routes, {
        projection,
        fill: 'none',
        stroke: resolveTone('c-1').main,
        strokeWidth: geometry.lineWidth,
      }),
      glGeoShape(ports, {
        projection,
        fill: resolveTone('c-1').main,
        stroke: resolveTone('c-1').dark,
      }),
    ],
    guides: false,
    margin: { left: 8, right: 8, top: 8, bottom: 8 },
  });

  return (
    <GLFigure
      title="Vietnam's two largest markets sit on opposite sides of the Pacific."
      subtitle={`Great-circle routes from Vietnam to its twelve largest destination markets, ${LATEST_YEAR}. ${unplaceable
        .map((p) => `${p.partnerShort}, ${usd(p.exportValueM)}`)
        .join('; ')} — no outline at this resolution, so the route cannot be drawn`}
      source={withNote(PARTNERS, OUTLINES)}
    >
      <Chart {...chart.props} height={320} ariaLabel="Vietnam's largest export destinations" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-104-orthographic-globe
/**
 * A hemisphere, with the graticule that makes it readable as one.
 *
 * `fit: 'sphere'` is what keeps the frame the whole globe. Under `fit: 'data'`
 * the projection would frame whichever landmasses happen to be facing us, so the
 * disc would be cropped and changing the rotation would change the scale.
 *
 * Rotated onto Vietnam, which turns the projection into an argument about trade:
 * the markets on the far hemisphere are not drawn small, they are not drawn at
 * all — and one of them is the largest of the twelve. So the demo computes the
 * angular distance itself and names the missing ones in the subtitle, because
 * the projection will not.
 *
 * The graticule goes through `glGeoShape`, whose default stroke is the `ink-3`
 * hairline §5 gives a map, so a meridian comes out as chrome without this plate
 * asking for it. That is the defaults table doing its job on a mark nobody
 * designed it for.
 */
function VietnamHemisphere() {
  const centre = centroidOfOutline(outlineOf.get(LEAD)!);
  const markets = defined(partnersIn(LATEST_YEAR), 'exportValueM').filter((p) =>
    outlineOf.has(p.partner),
  );

  // An orthographic projection shows the hemisphere within 90° of its centre and
  // silently drops the rest, so which markets survive is a property of the
  // projection and has to be worked out here to be sayable.
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const arcFromCentre = (point: [number, number]) => {
    const [lon, lat] = point.map(radians);
    const [lon0, lat0] = centre.map(radians);
    const cosine =
      Math.sin(lat0) * Math.sin(lat) + Math.cos(lat0) * Math.cos(lat) * Math.cos(lon - lon0);
    return (Math.acos(Math.min(1, Math.max(-1, cosine))) * 180) / Math.PI;
  };
  const hidden = markets.filter(
    (p) => arcFromCentre(centroidOfOutline(outlineOf.get(p.partner)!)) >= 90,
  );

  const highlighted = new Set(markets.map((p) => p.partner));

  // A 30° graticule, built here rather than taken from `d3-geo`'s `geoGraticule`
  // for the reason the library gives for never importing d3-geo itself. Each
  // meridian carries 37 vertices so it bends under the projection — a four-point
  // meridian draws as a straight chord on a globe.
  const graticule = {
    type: 'Feature' as const,
    id: 'graticule',
    properties: { name: 'Graticule' },
    geometry: {
      type: 'MultiLineString' as const,
      coordinates: [
        ...Array.from({ length: 12 }, (_, i) =>
          Array.from({ length: 37 }, (_, j): [number, number] => [-180 + i * 30, -90 + j * 5]),
        ),
        ...Array.from({ length: 5 }, (_, i) =>
          Array.from({ length: 73 }, (_, j): [number, number] => [-180 + j * 5, -60 + i * 30]),
        ),
      ],
    },
  };

  const projection = {
    type: () => geoOrthographic().rotate([-centre[0], -centre[1]]).clipAngle(90),
    fit: 'sphere' as const,
    inset: 8,
  };

  const chart = glChart({
    marks: [
      // `fill: 'none'` is the polygon mark telling you it was designed for
      // regions: a meridian is a line and has no interior to paint.
      glGeoShape([graticule], { projection, fill: 'none' }),
      glGeoShape(worldFeatures, { projection, fill: muted.light }),
      glGeoShape(
        worldFeatures.filter((f) => highlighted.has(featureIso(f))),
        { projection, fill: resolveTone('c-1').main },
      ),
    ],
    guides: false,
    margin: { left: 8, right: 8, top: 8, bottom: 8 },
  });

  return (
    <GLFigure
      title="Vietnam's largest market is on the far side of the world from it."
      subtitle={`Vietnam's largest destination markets on an orthographic projection centred on Vietnam, ${LATEST_YEAR}. ${hidden
        .map((p) => p.partnerShort)
        .join(', ')} fall on the hidden hemisphere and are not drawn`}
      source={withNote(PARTNERS, OUTLINES)}
      legend={
        <GLLegend
          items={[
            { label: 'A top-twelve market', tone: 'c-1' },
            { label: 'Everywhere else', tone: 'muted', step: 'light' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={340} ariaLabel="Vietnam's export markets on a globe" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-40-geojson-map
/**
 * Geometry treated as already projected.
 *
 * `geoIdentity` is the case the library's "the caller picks the projection" rule
 * was written for: a floor plan, a site layout or a set of pre-projected tiles
 * has coordinates in a plane already, and running a spherical projection over
 * them would be actively wrong. `reflectY` handles the one thing that always
 * differs — screen coordinates count downward and GeoJSON counts upward.
 *
 * The Atlas ships no pre-projected geometry, so this plate does the honest next
 * thing and takes the world's own longitude and latitude AS plane coordinates.
 * The result is not a trick: reading lon/lat off a plane is the plate carrée,
 * and putting this beside the projection gallery's equirectangular panel shows
 * they are the same map. That is the finding — "unprojected" is a projection,
 * and a chart that forgets to choose one has still chosen.
 */
function PlanarWorld() {
  const projection = {
    type: () => geoIdentity().reflectY(true),
    fit: 'data' as const,
    inset: 8,
  };

  const chart = glChart({
    marks: [
      glGeoShape(worldFeatures, {
        projection,
        fill: resolveTone('c-1').light,
        stroke: ink[3],
      }),
    ],
    guides: false,
    margin: { left: 8, right: 8, top: 8, bottom: 8 },
  });

  return (
    <GLFigure
      title="Treating longitude and latitude as plane coordinates is itself a projection."
      subtitle="Natural Earth outlines through geoIdentity with the y axis reflected — the plate carrée, arrived at by declining to choose"
      source={withNote(PANEL, OUTLINES)}
    >
      <Chart
        {...chart.props}
        height={280}
        ariaLabel="World outlines through the identity transform"
      />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-110-projection-gallery
/**
 * The same world under four projections.
 *
 * The point of the entry is comparison, and comparison only works if nothing
 * else varies — same features, same fill, same inset, four `type` functions.
 * That the demo is four near-identical calls IS the finding: the projection is
 * one argument, and every other GL rule holds across all four.
 *
 * Recorded `partial`, and the real data does not change it: the panels are
 * placed by this demo's own markup and each carries an HTML caption, because a
 * map has no axis to label. `facet` cannot help — it splits one dataset by a
 * channel, and this is one dataset drawn four ways.
 */
function ProjectionGallery() {
  const panels: [string, GLProjectionFactory][] = [
    ['Natural Earth', geoNaturalEarth1],
    ['Equirectangular', geoEquirectangular],
    ['Mercator', geoMercator],
    ['Azimuthal equal-area', geoAzimuthalEqualArea],
  ];

  return (
    <GLFigure
      title="Every projection trades one property away; none of them is neutral."
      subtitle="The same Natural Earth outlines under four standard projections, each fitted to its own frame"
      source={withNote(PANEL, OUTLINES)}
    >
      <div className="gl-plate__panels">
        {panels.map(([name, factory]) => {
          const chart = glChart({
            marks: [
              glGeoShape(worldFeatures, {
                projection: { type: factory, fit: WORLD, inset: 4 },
                fill: resolveTone('c-1').light,
              }),
            ],
            guides: false,
            margin: { left: 4, right: 4, top: 4, bottom: 4 },
          });
          return (
            <figure key={name} className="gl-plate__panel">
              <Chart {...chart.props} height={170} ariaLabel={`World outlines in ${name}`} />
              <figcaption>{name}</figcaption>
            </figure>
          );
        })}
      </div>
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-38-contour-topography
/**
 * Filled contours over a value grid — a topography whose two axes are income and
 * complexity rather than eastings and northings.
 *
 * The Atlas publishes no raster of anything, and inventing one would be the
 * exact failure this page exists to avoid. What it does have is 4,156
 * country-years with both income and complexity measured, and a two-dimensional
 * HISTOGRAM of those is a genuine regular grid: every cell is a count of real
 * observations, nothing is smoothed, nothing is interpolated between them. That
 * is also the honest difference from the density-contour plate, which estimates
 * a surface and can therefore claim density where nothing was observed.
 *
 * `thresholds` is pinned rather than estimated for the reason the option exists:
 * a contour interval should be a round number, and 4/10/18/28/40 country-years
 * is readable in a way 7.3 is not. Five levels, because §12's ramp has five
 * authored steps and `glSequentialColor` would INTERPOLATE a sixth into a fill
 * the tokens do not enumerate.
 *
 * The graticule is not decoration — it is the only scale this chart can carry.
 * `geoShape` types its scale values as `never`, so a projected chart runs
 * `guides: false` and there is nowhere to put an axis; on a world map that is
 * right and here it is a real loss, so the plane's own gridlines are drawn as
 * geometry, at the same 1-2-5 income steps `glAxisLog` would have chosen. They
 * still cannot be labelled. Both layers fit to one explicit frame.
 */
function ComplexityIncomeSurface() {
  const observations = defined(defined(countryYear, 'eci'), 'gdpPerCapita').map((d) => ({
    income: Math.log10(d.gdpPerCapita),
    eci: d.eci,
  }));

  const WIDTH = 32;
  const HEIGHT = 22;
  const incomes = observations.map((d) => d.income);
  const ecis = observations.map((d) => d.eci);
  const x0 = Math.min(...incomes);
  const x1 = Math.max(...incomes);
  const y0 = Math.min(...ecis);
  const y1 = Math.max(...ecis);

  // Row-major, which is `d3-contour`'s convention: values[y * width + x].
  const grid = new Array<number>(WIDTH * HEIGHT).fill(0);
  for (const d of observations) {
    const i = Math.min(WIDTH - 1, Math.floor(((d.income - x0) / (x1 - x0)) * WIDTH));
    const j = Math.min(HEIGHT - 1, Math.floor(((d.eci - y0) / (y1 - y0)) * HEIGHT));
    grid[j * WIDTH + i] += 1;
  }

  const LEVELS = [4, 10, 18, 28, 40];
  const { features, domain, thresholds } = glContourGrid(grid, {
    width: WIDTH,
    height: HEIGHT,
    thresholds: LEVELS,
    // Data units rather than cell indices, so the rings come back in log dollars
    // and index points — the same space the gridlines below are authored in.
    extent: [x0, y0, x1, y1],
  });

  // The 1-2-5 income steps and whole index points the axis presets would have
  // picked, drawn as geometry because there is no axis to put them on.
  const gridlines = [
    ...[200, 500, 1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5]
      .map(Math.log10)
      .filter((x) => x > x0 && x < x1)
      .map((x) => ({
        type: 'Feature' as const,
        id: `income-${x}`,
        properties: { axis: 'income' },
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [x, y0],
            [x, y1],
          ] as [number, number][],
        },
      })),
    ...[-3, -2, -1, 0, 1, 2]
      .filter((y) => y > y0 && y < y1)
      .map((y) => ({
        type: 'Feature' as const,
        id: `eci-${y}`,
        properties: { axis: 'eci' },
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [x0, y],
            [x1, y],
          ] as [number, number][],
        },
      })),
  ];

  // The frame both marks fit to. `fit: 'data'` would fit the contours to their
  // own bounds and the gridlines to theirs, and the two would not line up.
  const frame = {
    type: 'Polygon' as const,
    coordinates: [
      [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
        [x0, y0],
      ],
    ] as [number, number][][],
  };
  const projection = { type: () => geoIdentity().reflectY(true), fit: frame, inset: 2 };

  const chart = glChart({
    marks: [
      glGeoShape(gridlines, { projection, fill: 'none' }),
      glGeoShape(features, {
        projection,
        color: (f: GLContourFeature) => f.properties.value,
      }),
    ],
    guides: false,
    // The breaks are the contour levels, so they have to be handed over rather
    // than re-derived. Equal-width bins across [4, 40] cut at 11.2/18.4/25.6/32.8,
    // which puts the 4- and 10-observation rings in ONE fill and never uses the
    // middle step — five bands, four colours, and the two innermost rings of the
    // ridge indistinguishable. `glContourGrid` already returns the levels; the
    // class breaks are the levels above the first.
    color: {
      scale: glSequentialColor({ domain, thresholds: thresholds.slice(1) }),
    },
    margin: { left: 8, right: 8, top: 8, bottom: 8 },
  });

  return (
    <GLFigure
      title="Complexity rises with income along one broad ridge, and at every income the spread is more than a full index point."
      subtitle={`Density of country-years in the income–complexity plane, ${FIRST_YEAR}–${LATEST_YEAR}. Income runs $${Math.round(
        10 ** x0,
      ).toLocaleString('en-US')} to $${Math.round(10 ** x1).toLocaleString(
        'en-US',
      )} a head left to right on a log scale; complexity runs ${y0
        .toFixed(1)
        .replace('-', '−')} to +${y1.toFixed(
        1,
      )} bottom to top. Contoured at ${LEVELS.join(', ')} observations per cell`}
      source={withNote(
        PANEL,
        `${observations.length.toLocaleString('en-US')} country-years with both income and complexity measured`,
      )}
      legend={
        <GLLegend
          items={[
            { label: `${LEVELS[0]} country-years`, tone: 'c-1', step: 'light' },
            { label: `${LEVELS[LEVELS.length - 1]} or more`, tone: 'c-1', step: 'dark' },
          ]}
        />
      }
    >
      <Chart
        {...chart.props}
        height={300}
        ariaLabel="Density of country-years by income and complexity"
      />
    </GLFigure>
  );
}
// #endregion

// ════════════════════════════════════════════════════════════════════════════

const demos: Demo[] = [
  {
    id: 'spec-07-vector-field',
    family: 'Maps and Spatial',
    name: 'Vector field',
    question: 'Which way did the world’s economies move over the past decade?',
    rule: '§3.4.2 — chrome WEIGHT with a data TONE, so a dense field stays readable.',
    render: ComplexityDrift,
    gaps: [
      '`glVector` takes `rotate` in SCREEN degrees and gives the caller no access to the resolved scales, so a field whose direction lives in data units can only be drawn correctly on a square plot. The bearing here is computed from each component normalised by its own axis span — the closest an author can get without knowing the plot’s pixel aspect — and it is off by the aspect ratio. The catalog specimen hid this because its lattice was longitude against latitude on a near-square domain.',
      'The Atlas has no gridded field of any kind, so the lattice is not a lattice: one arrow per economy at its own position, 145 of them, rather than a regular sampling of a continuous field. The form is exercised; the regular grid is not.',
      '`length` is a pixel quantity multiplied by a constant at the call site. That is an encoding decision rather than a style one, but there is no size-scale helper for it the way there is for colour, so the constant is a magic number no audit can check.',
    ],
  },
  {
    id: 'ts-102-world-choropleth',
    family: 'Maps and Spatial',
    name: 'World choropleth, sequential',
    question: 'How many products does each economy export competitively?',
    rule: '§12 — five equal-width bins on one hue; darker is higher, always.',
    render: ExportDiversity,
    gaps: [
      'Equal-width bins on a right-skewed Atlas count put 111 of 146 economies in the two palest steps and four in the darkest. §12 requires equal width because that is what keeps the legend honest, so this is the rule working — but the map loses almost all of its discrimination across the range where most of the world sits, and there is no on-spec way to recover it. A quantile option would break the legend’s promise; a log-spaced sequential ramp is not something `grammar.md` has ruled on.',
      'Four Atlas economies — Bahrain, Hong Kong, Mauritius and Singapore — have no outline at 1:110m and so cannot appear on any map on this page, however large their trade. They are indistinguishable from the 35 outlines that carry no Atlas row: both take the no-data fill, and the figure has no way to say that one is "not measured" and the other "too small to draw".',
    ],
  },
  {
    id: 'ts-108-country-choropleth',
    family: 'Maps and Spatial',
    name: 'World choropleth, diverging',
    question: 'Who climbed the complexity ranking between 1995 and 2023, and who fell?',
    rule: 'Decision Rule 9 — a diverging ramp needs a midpoint that means something.',
    render: ComplexityRankChange,
    gaps: [
      'Rank change is bounded by how many economies the Atlas ranked in each year, and that count moved from 142 to 146 over the period. A country can therefore gain or lose a place without moving, and the map cannot show which. The alternative — differencing ECI itself — has no fixed reference either, because ECI is standardised within each year.',
    ],
  },
  {
    id: 'ts-109-us-state-choropleth',
    family: 'Maps and Spatial',
    name: 'Sub-national choropleth',
    question: 'Where is complexity concentrated within Africa?',
    rule: '§12 — the projection is an argument, so the scale change is one line.',
    render: AfricanComplexity,
    gaps: [
      'The Atlas has no sub-national table of anything — its finest geographic grain is the country — so the catalog’s state-level plate is drawn one level up, as one region’s countries. The projection change the entry exists to demonstrate is exercised exactly as written; the sub-national join is not, and nothing in this dataset can exercise it.',
      'Mercator inflates the far north and south, which on an Africa frame is nearly harmless and on a world frame would be a misstatement about area. `glChoroplethChart` cannot tell the difference: it accepts any projection factory for any variable, and the rule that an area-encoded quantity wants an equal-area projection is unenforced.',
    ],
  },
  {
    id: 'ts-103-bubble-map',
    family: 'Maps and Spatial',
    name: 'Bubble map — a quantity at a place',
    question: 'Where does the world’s export value actually sit?',
    rule: 'Two layers must fit ONE geometry, or they render at two different scales.',
    render: ExportBubbles,
    gaps: [
      'Bubbles overlap, so §3.4’s 0.8 fill-and-stroke should apply — and `glGeoShape` has no point variant that reaches the scatter defaults. It is a choropleth POLYGON mark: full opacity, `ink-3` hairline, which is right for a region and wrong for a proportional symbol. A `glGeoPoint` routing to the `point` kind is the missing piece, and it is four lines.',
      'The fills are named through `resolveTone` at the call site because the mark takes no `tone`. Every value is a token, so the plate is on-spec, but it is reaching past the vocabulary to get there.',
      'Real export values run 4,400:1 across the panel, so a true area encoding puts the bottom half of the world below one pixel. The plate takes the forty largest exporters and says so on the figure; the catalog specimen never had to make that cut because its seventeen synthetic regions spanned a factor of thirty. There is no bubble-size floor or minimum-radius convention in `grammar.md` to appeal to, and no size legend either — a proportional-symbol map has no way to tell the reader what a given radius is worth.',
      'Two of the forty — Singapore and Hong Kong — have no outline and therefore no centroid, so a bubble map cannot place them at all. On a choropleth they at least render as no-data; here they are simply absent, and only the subtitle says so.',
    ],
  },
  {
    id: 'ts-105-route-map',
    family: 'Maps and Spatial',
    name: 'Route map — a path on the sphere',
    question: 'Where do Vietnam’s exports actually go?',
    rule: '§3.1 — the geography is context (c-muted-light); the track is the finding.',
    render: PartnerRoutes,
    gaps: [
      'Same shortfall as the bubble map: the route and its ports are painted through `resolveTone` at the call site because `glGeoShape` takes no `tone`. A LineString drawn through a polygon mark also needs `fill: \'none\'` passed explicitly, which is the mark telling you it was designed for regions.',
      '`strokeWidth` on `glGeoShape` is a scalar, not a channel, so the leg carrying $95bn to the United States is drawn at exactly the weight of the $6.6bn leg to the UAE. Magnitude is the whole reason to draw a trade flow rather than a list, and this mark cannot encode it — the catalog specimen was a single unweighted voyage, so it never had to ask.',
      'Vietnam is both the origin of every route and one of the plotted ports, so it is drawn twice at the same coordinates. There is no on-spec way to distinguish an origin from a destination in this mark: that would want a second tone, and the tone channel is the thing `glGeoShape` does not have.',
    ],
  },
  {
    id: 'ts-104-orthographic-globe',
    family: 'Maps and Spatial',
    name: 'Orthographic globe with a graticule',
    question: 'How much of Vietnam’s trade is on the hemisphere that faces it?',
    rule: '§5 — a meridian is chrome, and glGeoShape’s ink-3 default lands it correctly.',
    render: VietnamHemisphere,
    gaps: [
      'There is no sphere outline, so the globe has no edge where no landmass reaches it. Drawing one means a synthetic `{ type: "Sphere" }` feature and an ink for it, and `grammar.md` §5 rules on boundaries and graticules but not on the globe’s own limb.',
      'The graticule is generated in the demo rather than taken from `d3-geo`’s `geoGraticule`, because the library never writes `from \'d3-geo\'` and a plate should not be the one place that does. Meridians carry 37 vertices each so they bend under the projection — a four-point meridian draws as a straight chord on a globe.',
      'An orthographic projection silently deletes half the data, and the library has no way to say so. Three of Vietnam’s twelve largest markets — including the largest — sit on the hidden hemisphere and render as nothing at all, indistinguishable from a market that does not exist. This demo computes the angular distance itself so the subtitle can name them; nothing in `glGeoShape` offers to.',
      'Countries near the limb are compressed to slivers, so Germany, the Netherlands and the United Kingdom are highlighted at a few pixels each while China takes a fifth of the disc. Area on a globe encodes angular distance from the centre, not trade, and nothing in the mark warns that a highlight has been made illegible by the projection choice.',
    ],
  },
  {
    id: 'ts-40-geojson-map',
    family: 'Maps and Spatial',
    name: 'Pre-projected geometry',
    question: 'What does the world look like if you decline to choose a projection?',
    rule: 'geoIdentity is the case "the caller picks the projection" was written for.',
    render: PlanarWorld,
    gaps: [
      'The Atlas ships no genuinely pre-projected geometry — no floor plan, no tile grid, no planar layout — so the transform is exercised on longitude and latitude read as a plane. That is a legitimate use of `geoIdentity` and it is also the plate carrée, which means this demo and the projection gallery’s equirectangular panel draw the same map. The finding survives; the "coordinates that were never spherical" case is not something this dataset can test.',
    ],
  },
  {
    id: 'ts-110-projection-gallery',
    family: 'Maps and Spatial',
    name: 'The same world under four projections',
    question: 'What does each projection give up?',
    rule: 'The projection is one argument; every other GL rule holds across all four.',
    render: ProjectionGallery,
    gaps: [
      'The four panels are placed by the plate’s own grid and each carries an HTML caption, because a map has no axis to label. `facet` cannot help — it splits one dataset by a channel, and this is one dataset drawn four ways. The same linked-panel shortfall the marginal-histogram plate records.',
      'That grid was CSS living in `gallery.css`, which the examples page does not load, so here the four panels stack vertically instead of tiling. The layout was never part of the library — it was the gallery’s own stylesheet — and moving one demo to a second page is what made that visible.',
    ],
  },
  {
    id: 'ts-38-contour-topography',
    family: 'Maps and Spatial',
    name: 'Filled topographic contours',
    question: 'Where in the income–complexity plane do the world’s economies actually sit?',
    rule: '§12 — five equal-width steps of one hue; darker is higher, always.',
    render: ComplexityIncomeSurface,
    gaps: [
      'A projected chart has no axes: `geoShape` types its scale values as `never`, so `guides: false` is mandatory and there is nowhere to hang a tick. On a world map that is correct. Here the two dimensions are income and complexity, losing the axes is a real loss, and the answer is to draw the gridlines as LineString geometry at the 1-2-5 steps `glAxisLog` would have chosen — which still cannot be labelled, because a text mark needs the x/y scales this chart does not have. The catalog specimen put its units in the subtitle and had the same hole.',
      'The Atlas publishes no raster field, so the grid is a two-dimensional histogram of country-years rather than a measured surface. Every cell is a real count and nothing is interpolated, but the value being contoured is an observation density, not a quantity anyone measured at a place — the nearest honest thing the Atlas can fill this form with.',
      'Pooling 29 years means each economy contributes up to 29 correlated observations, so the ridge is denser where the panel is long rather than where the world is crowded. The subtitle names the unit as country-years for exactly that reason; the chart itself cannot qualify its own denominator.',
      'The bands carry the choropleth `ink-3` hairline, because `glGeoShape` gives every polygon the region-separating stroke §5 asks for. On nested contours that stroke is drawing a boundary between two steps of one ramp, which is not the case the rule was written for.',
    ],
  },
];

export const mapsFamily: Family = {
  slug: 'maps-and-spatial',
  title: 'Maps and Spatial',
  blurb:
    'Ten forms that put data on geometry rather than on axes. Two are the standard shaded maps; the rest layer points, flows and cartogram-style treatments over the same country outlines.',
  demos,
};

export function renderMaps(): Record<string, () => ReactNode> {
  return Object.fromEntries(demos.map((d) => [d.id, d.render]));
}
