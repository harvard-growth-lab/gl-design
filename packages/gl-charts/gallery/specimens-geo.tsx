/**
 * Catalog specimens — Geography, and the two spatial forms that reach it.
 *
 * ## The one import from outside `gl-charts`
 *
 * `d3-geo`'s projection factories, and taking them here rather than inside the
 * library is a deliberate design decision documented at length in
 * `src/shapes/geo.ts`: the projection is editorial (equal-area for a quantity,
 * orthographic for a hemisphere, identity for pre-projected tiles) and no
 * default is right for every figure, so the caller supplies it — and the caller
 * is already the one holding the dependency that produced their GeoJSON. The
 * library never writes `from 'd3-geo'` and this file is a caller.
 *
 * ## `fit` is the thing to get right
 *
 * Every plate below pins it. `fit: 'data'` frames the features a mark is
 * drawing, which means TWO marks over the same map fit to two different bounds
 * and silently render at two different scales — the failure that makes a bubble
 * layer drift off its basemap. So the multi-layer plates fit both marks to one
 * explicit collection, and the globe fits to `'sphere'` so the frame is the
 * whole world rather than whatever landmasses happen to be facing us.
 *
 * Same contract as every specimen file: nothing is styled by hand.
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

import { glChart, ink, muted, resolveTone } from '../src/index.js';
import { glChoroplethChart, glGeoShape } from '../src/shapes.js';
import { GLFigure } from '../src/figure.js';

import { provinceValues, provinces } from './data.js';
import {
  graticule,
  voyagePorts,
  voyageRoute,
  worldCentroids,
  worldFeatures,
  worldValues,
} from './tanstack-data.js';

const SYNTHETIC =
  'Source: Synthetic geometry and values for illustration. Not a Growth Lab estimate.';

/** Everything the multi-layer plates fit their projection to — see the header. */
const WORLD = {
  type: 'FeatureCollection' as const,
  features: worldFeatures as unknown as never[],
};

const featureId = (f: { properties: { id: string } }) => f.properties.id;

// ════════════════════════════════════════════════════════════════════════════
// Choropleths
// ════════════════════════════════════════════════════════════════════════════

/**
 * `102-world-choropleth` — §12, and the rule is one sentence: darker is higher,
 * always.
 *
 * Five equal-width bins on one hue. Equal width rather than equal count because
 * it keeps the legend honest — a reader decoding a choropleth assumes each step
 * covers the same range of values, and `quantile` binning quietly breaks that
 * assumption to make the map look better distributed.
 *
 * One region is deliberately absent from the value table. It renders in the
 * no-data fill, which sits OUTSIDE the ramp rather than being its palest step:
 * "no data" and "the lowest value" are different claims and must not share a
 * swatch.
 */
function WorldChoropleth() {
  const chart = glChoroplethChart(worldFeatures, {
    projection: geoNaturalEarth1,
    id: featureId,
    values: {
      rows: worldValues,
      id: (r) => r.id,
      value: (r) => r.learningPoverty,
    },
    domain: [0, 100],
    legend: { label: 'Learning poverty (% of ten-year-olds)' },
  });

  return (
    <GLFigure
      title="Learning poverty is above half across most of the tropics."
      subtitle="Share of ten-year-olds unable to read an age-appropriate text"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={320} ariaLabel="Learning poverty by region" />
    </GLFigure>
  );
}

/**
 * `108-country-choropleth` — the diverging case, and Decision Rule 9.
 *
 * A diverging ramp is legitimate ONLY where a midpoint genuinely exists; here it
 * does, because the variable is a change against a baseline and zero means "no
 * change". `glChoroplethChart` enforces the half of that rule it can see — a
 * diverging domain sitting entirely on one side of its own midpoint warns,
 * because the reader would decode the hue boundary as a threshold the data never
 * crosses.
 *
 * `symmetric` stays on. It leaves the deepest red unused here, and that is the
 * trade it is meant to make: equal distances from the midpoint have to look
 * equally intense, or a −1.8 region reads as dark as a +7.5 one.
 */
function CountryChoropleth() {
  const chart = glChoroplethChart(worldFeatures, {
    kind: 'diverging',
    projection: geoNaturalEarth1,
    id: featureId,
    values: {
      rows: worldValues,
      id: (r) => r.id,
      value: (r) => r.shareChange,
    },
    midpoint: 0,
    legend: { label: 'Δ share of world exports (pp), 2014–2024' },
  });

  return (
    <GLFigure
      title="Export share moved toward South and East Asia."
      subtitle="Change in share of world merchandise exports, 2014 to 2024, percentage points"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={320} ariaLabel="Change in export share by region" />
    </GLFigure>
  );
}

/**
 * `109-us-state-choropleth` — a sub-national map at a projection fitted to it.
 *
 * Same preset, different geometry and a Mercator fit, which is the point: the
 * projection is an argument, so moving from a world map to a sub-national one is
 * a one-line change rather than a different chart. The province geometry is
 * reused from the spec-PDF plates rather than duplicated.
 *
 * Eleven of twelve provinces carry a value, so this map has the same no-data
 * hole the world map does. That is not an accident of the data — it is kept
 * there so every choropleth in the gallery exercises the join's miss path.
 */
function SubnationalChoropleth() {
  const chart = glChoroplethChart(provinces, {
    projection: geoMercator,
    id: (f) => f.properties.id,
    values: {
      rows: provinceValues,
      id: (r) => r.province,
      value: (r) => r.eci,
    },
    domain: [-1, 1.5],
    legend: { label: 'Economic Complexity Index' },
  });

  return (
    <GLFigure
      title="Complexity is concentrated in the central provinces."
      subtitle="Economic Complexity Index by province, 2022; one province has no data"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={300} ariaLabel="Complexity by province" />
    </GLFigure>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Point and line geometry
// ════════════════════════════════════════════════════════════════════════════

/**
 * `103-bubble-map` — a quantity at a place, rather than a quantity of a place.
 *
 * Two layers, both fitted to the SAME explicit collection. That is the whole
 * trick and the reason the plate does not use `fit: 'data'`: each mark would fit
 * to its own features, so the centroid layer would be scaled to the bounding box
 * of the centroids and drift off the basemap it is supposed to sit on.
 *
 * The radius passes through a square root, for the same reason the bubble
 * scatter's does — a radius set to the quantity encodes it as area squared.
 *
 * Recorded `partial`: bubbles overlap, so §3.4's 0.8 fill-and-stroke should
 * apply, and `glGeoShape` has no point variant that reaches the scatter
 * defaults — it is a choropleth polygon mark, full opacity and `ink-3` hairline.
 * A `glGeoPoint` routing to the `point` kind is the missing piece.
 */
function BubbleMap() {
  const populations = new Map(worldValues.map((v) => [v.id, v.population]));
  const bubbles = worldCentroids.filter((f) => populations.has(f.properties.id));
  const projection = { type: geoNaturalEarth1, fit: WORLD, inset: 6 } as never;

  const chart = glChart({
    marks: [
      glGeoShape(worldFeatures, { projection, fill: muted.light }),
      glGeoShape(bubbles, {
        projection,
        fill: resolveTone('c-1').main,
        stroke: resolveTone('c-1').dark,
        r: (f) => 3 + Math.sqrt(populations.get(f.properties.id) ?? 0) * 0.55,
      }),
    ],
    guides: false,
    margin: { left: 8, right: 8, top: 8, bottom: 8 },
  });

  return (
    <GLFigure
      title="One region holds more people than the eight smallest combined."
      subtitle="Population by region, 2024; bubble area is proportional to population"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={300} ariaLabel="Population by region" />
    </GLFigure>
  );
}

/**
 * `105-route-map` — a path on the sphere.
 *
 * The route is one `LineString`, so `d3-geo`'s path generator bends it along the
 * projection rather than drawing chords between its vertices. That matters here:
 * the voyage crosses the Pacific, and a straight segment between two points
 * forty degrees apart is visibly the wrong line.
 *
 * The route takes a series tone at line weight — it IS the data — while the
 * basemap stays `c-muted-light`. That is §3.1 on a map: the geography is context
 * and the track is the finding.
 */
function RouteMap() {
  const projection = { type: geoEquirectangular, fit: WORLD, inset: 6 } as never;

  const chart = glChart({
    marks: [
      glGeoShape(worldFeatures, { projection, fill: muted.light }),
      glGeoShape([voyageRoute], {
        projection,
        fill: 'none',
        stroke: resolveTone('c-1').main,
        strokeWidth: 2,
      }),
      glGeoShape(voyagePorts, {
        projection,
        fill: resolveTone('c-1').main,
        stroke: resolveTone('c-1').dark,
        r: 3.5,
      }),
    ],
    guides: false,
    margin: { left: 8, right: 8, top: 8, bottom: 8 },
  });

  return (
    <GLFigure
      title="The voyage rounded the southern cape twice."
      subtitle="Survey route with its ports of call, five years"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={300} ariaLabel="Survey voyage route" />
    </GLFigure>
  );
}

/**
 * `104-orthographic-globe` — a hemisphere, with the graticule that makes it
 * readable as one.
 *
 * `fit: 'sphere'` is what keeps the frame the whole globe. With `fit: 'data'`
 * the projection would frame the landmasses currently facing the viewer, so the
 * disc would be cropped and the rotation would change the scale.
 *
 * The graticule is drawn through `glGeoShape`, which defaults its stroke to the
 * `ink-3` hairline §5 gives a map — so a meridian comes out as chrome without
 * the plate asking for it, which is the defaults table doing its job on a mark
 * nobody designed it for.
 *
 * Recorded `partial`: there is no sphere outline. A GL ink for the globe's own
 * edge is unruled, and drawing it as another `glGeoShape` would need a synthetic
 * `{type: 'Sphere'}` feature the library has no opinion about.
 */
function OrthographicGlobe() {
  const projection = {
    type: () => geoOrthographic().rotate([-20, -15]).clipAngle(90),
    fit: 'sphere',
    inset: 8,
  } as never;

  const chart = glChart({
    marks: [
      glGeoShape([graticule], { projection, fill: 'none' }),
      glGeoShape(worldFeatures, { projection, fill: resolveTone('c-1').light }),
    ],
    guides: false,
    margin: { left: 8, right: 8, top: 8, bottom: 8 },
  });

  return (
    <GLFigure
      title="An orthographic projection shows one hemisphere without distorting it."
      subtitle="Landmasses on a 30° graticule, rotated to 20°E 15°N"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={320} ariaLabel="Orthographic globe" />
    </GLFigure>
  );
}

/**
 * `40-geojson-map` — geometry that is already projected.
 *
 * `geoIdentity` is the case the library's "the caller picks the projection" rule
 * was written for: a floor plan, a site layout or a set of pre-projected tiles
 * has coordinates in a plane already, and running a spherical projection over it
 * would be actively wrong. Passing the identity transform makes that explicit at
 * the call site, and `reflectY` handles the one thing that always differs —
 * screen coordinates count downward and GeoJSON counts upward.
 */
function GeoJsonMap() {
  const projection = {
    type: () => geoIdentity().reflectY(true),
    fit: 'data',
    inset: 8,
  } as never;

  const chart = glChart({
    marks: [
      glGeoShape(provinces, {
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
      title="Pre-projected geometry needs the identity transform, not a projection."
      subtitle="Plan geometry drawn through geoIdentity with the y axis reflected"
      source={SYNTHETIC}
    >
      <Chart {...chart.props} height={260} ariaLabel="Pre-projected plan geometry" />
    </GLFigure>
  );
}

/**
 * `110-projection-gallery` — the same world under four projections.
 *
 * The point of the entry is comparison, and the comparison only works if nothing
 * else varies — same features, same fill, same inset, four `type` functions.
 * That the plate is four near-identical calls is the finding: the projection is
 * one argument, and every other GL rule holds across all four.
 *
 * Recorded `partial`: the four panels are placed by the plate's own grid rather
 * than by a layout the library provides, and each carries its own caption
 * because a map has no axis to label. `facet` cannot help — it splits one
 * dataset by a channel, and here it is one dataset drawn four ways.
 */
function ProjectionGallery() {
  const panels: [string, unknown][] = [
    ['Natural Earth', geoNaturalEarth1],
    ['Equirectangular', geoEquirectangular],
    ['Mercator', geoMercator],
    ['Azimuthal equal-area', geoAzimuthalEqualArea],
  ];

  return (
    <GLFigure
      title="Every projection trades one property away; none of them is neutral."
      subtitle="The same landmasses under four standard projections, each fitted to the frame"
      source={SYNTHETIC}
    >
      <div className="gl-plate__panels">
        {panels.map(([name, factory]) => {
          const chart = glChart({
            marks: [
              glGeoShape(worldFeatures, {
                projection: { type: factory, fit: WORLD, inset: 4 } as never,
                fill: resolveTone('c-1').light,
              }),
            ],
            guides: false,
            margin: { left: 4, right: 4, top: 4, bottom: 4 },
          });
          return (
            <figure key={name} className="gl-plate__panel">
              <Chart {...chart.props} height={150} ariaLabel={`World in ${name}`} />
              <figcaption>{name}</figcaption>
            </figure>
          );
        })}
      </div>
    </GLFigure>
  );
}

// ── Renderers ───────────────────────────────────────────────────────────────

export const GEO_RENDERERS: Record<string, () => ReactNode> = {
  'ts-102-world-choropleth': WorldChoropleth,
  'ts-108-country-choropleth': CountryChoropleth,
  'ts-109-us-state-choropleth': SubnationalChoropleth,
  'ts-103-bubble-map': BubbleMap,
  'ts-105-route-map': RouteMap,
  'ts-104-orthographic-globe': OrthographicGlobe,
  'ts-40-geojson-map': GeoJsonMap,
  'ts-110-projection-gallery': ProjectionGallery,
};
