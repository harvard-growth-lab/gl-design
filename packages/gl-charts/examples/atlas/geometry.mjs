/**
 * geometry.mjs — the world, reduced to what a 600px choropleth can actually show.
 *
 * The Atlas has no geometry: it identifies a country by `iso3` and stops. So the
 * map demos need an outline from somewhere, and this script is the "somewhere",
 * kept next to `extract.mjs` because it has exactly the same contract — it runs
 * by hand, needs the network, and writes one committed file that the page build
 * then treats as data.
 *
 * ## Natural Earth, at 1:110m
 *
 * Public domain, no attribution required (though `world.geo.json` records the
 * source anyway), and the only widely-mirrored world outline that ships **ISO
 * alpha-3 codes in its properties**. That last part is the whole reason it is
 * this file and not `world-atlas`: the TopoJSON everyone reaches for keys its
 * features by *numeric* ISO 3166 code, and the Atlas catalog has no numeric
 * column to join on. Pairing them would mean committing a hand-maintained
 * 250-row numeric→alpha-3 crosswalk whose errors would show up as a country
 * silently rendering in the no-data fill. Natural Earth already did that work.
 *
 * ## Why it is simplified here rather than at render time
 *
 * The source is 839 KB of coordinates quoted to ~14 decimal places. At the size
 * these demos draw a world map, a coordinate is worth about 0.05° — every digit
 * past two is describing sub-pixel detail that the projection immediately throws
 * away. Rounding and de-duplicating on the way in cuts the file by roughly 80%
 * and changes nothing a reader can see. Doing it at render time instead would
 * pay that cost in every browser, forever, to get the same picture.
 *
 * Run: node examples/atlas/geometry.mjs
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'data');

const SOURCE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';

/**
 * Two decimal places ≈ 1.1 km at the equator. A 600px-wide world map covers 360°
 * of longitude, so one pixel is 0.6° — thirty times coarser than what survives
 * here. Three decimals would double the file to describe nothing.
 */
const PRECISION = 2;

/**
 * Drop rings whose bounding box is smaller than this (in degrees). At 1:110m a
 * ring this small is at most a pixel or two, and there are hundreds of them —
 * they are most of the remaining file weight and none of the visible map.
 * Whole *features* are never dropped, only sub-pixel rings within them, so no
 * country disappears from the join.
 */
const MIN_RING_EXTENT = 0.5;

const round = (n) => Number(n.toFixed(PRECISION));

/** Round, then drop points that collapsed onto their neighbour. */
function thinRing(ring) {
  const out = [];
  for (const [x, y] of ring) {
    const p = [round(x), round(y)];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  // A ring needs three distinct corners plus the closing point to enclose area.
  if (out.length < 4) return null;
  const first = out[0];
  const last = out[out.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) out.push([first[0], first[1]]);
  return out.length >= 4 ? out : null;
}

function ringExtent(ring) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return Math.max(maxX - minX, maxY - minY);
}

/** Simplify one polygon (array of rings); the outer ring decides if it survives. */
function thinPolygon(rings) {
  const thinned = rings.map(thinRing).filter(Boolean);
  if (thinned.length === 0) return null;
  if (ringExtent(thinned[0]) < MIN_RING_EXTENT) return null;
  return thinned;
}

function thinGeometry(geom) {
  if (geom.type === 'Polygon') {
    const p = thinPolygon(geom.coordinates);
    return p ? { type: 'Polygon', coordinates: p } : null;
  }
  if (geom.type === 'MultiPolygon') {
    const polys = geom.coordinates.map(thinPolygon).filter(Boolean);
    if (polys.length === 0) return null;
    // A MultiPolygon reduced to one polygon is a Polygon; keeping the wrapper
    // would make consumers branch on a distinction that no longer exists.
    return polys.length === 1
      ? { type: 'Polygon', coordinates: polys[0] }
      : { type: 'MultiPolygon', coordinates: polys };
  }
  return null;
}

/**
 * Natural Earth carries several alpha-3 fields and they disagree, on purpose.
 * `ISO_A3` is -99 for disputed or partially-recognised territories; `ISO_A3_EH`
 * resolves some of those; `ADM0_A3` always has a value because it is Natural
 * Earth's own administrative key. Preferring them in that order gets the
 * standards-blessed code where one exists and still leaves every feature with
 * something to join on, rather than dropping France's overseas arrangement or
 * Kosovo because a field was -99.
 */
function iso3Of(props) {
  for (const key of ['ISO_A3_EH', 'ISO_A3', 'ADM0_A3']) {
    const v = props[key];
    if (typeof v === 'string' && v.length === 3 && v !== '-99') return v;
  }
  return null;
}

async function main() {
  process.stdout.write(`fetching ${SOURCE}\n`);
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`Natural Earth fetch failed: ${res.status} ${res.statusText}`);
  const source = await res.json();
  const sourceBytes = Number(res.headers.get('content-length') ?? 0);

  const features = [];
  const dropped = [];

  for (const f of source.features) {
    const iso3 = iso3Of(f.properties);
    if (!iso3) {
      dropped.push(f.properties.NAME ?? '(unnamed)');
      continue;
    }
    const geometry = thinGeometry(f.geometry);
    if (!geometry) {
      dropped.push(`${f.properties.NAME} (no ring survived simplification)`);
      continue;
    }
    features.push({
      type: 'Feature',
      properties: { iso3, name: f.properties.NAME ?? iso3 },
      geometry,
    });
  }

  features.sort((a, b) => a.properties.iso3.localeCompare(b.properties.iso3));

  // How much of the Atlas can actually be drawn? This is the number that matters:
  // a country the Atlas ranks but the map cannot place renders as no-data, and
  // that has to be a known quantity rather than a surprise on the page.
  const countriesFile = join(OUT, 'countries.json');
  let coverage = null;
  if (existsSync(countriesFile)) {
    const atlasCountries = JSON.parse(readFileSync(countriesFile, 'utf8')).rows;
    const drawn = new Set(features.map((f) => f.properties.iso3));
    const unmatched = atlasCountries.filter((c) => !drawn.has(c.iso3)).map((c) => c.iso3);
    coverage = {
      atlasCountries: atlasCountries.length,
      matched: atlasCountries.length - unmatched.length,
      unmatched,
    };
  }

  const out = {
    type: 'FeatureCollection',
    meta: {
      dataset: 'world.geo',
      note:
        'Natural Earth 1:110m country outlines, keyed by ISO alpha-3 to join the Atlas country catalog. ' +
        'A handful of Atlas economies have no outline at this resolution — Natural Earth omits micro-states ' +
        'from its 110m set, so Singapore and Hong Kong in particular are absent from the source rather than ' +
        'dropped here. See coverage.unmatched for the list. They must render in the no-data fill, which sits ' +
        'outside the colour ramp: "no data" and "lowest value" are different claims.',
      source: 'Natural Earth (naturalearthdata.com), ne_110m_admin_0_countries',
      license: 'Public domain',
      simplification: { precision: PRECISION, minRingExtent: MIN_RING_EXTENT },
      features: features.length,
      coverage,
    },
    features,
  };

  const text = `${JSON.stringify(out)}\n`;
  writeFileSync(join(OUT, 'world.geo.json'), text);

  console.log(
    `wrote  world.geo.json  ${features.length} features  ` +
      `${Math.round(text.length / 1024)} KB (from ${Math.round(sourceBytes / 1024)} KB)`,
  );
  if (dropped.length) console.log(`  dropped ${dropped.length}: ${dropped.join(', ')}`);
  if (coverage) {
    console.log(
      `  joins ${coverage.matched}/${coverage.atlasCountries} Atlas countries` +
        (coverage.unmatched.length ? ` — unmatched: ${coverage.unmatched.join(', ')}` : ''),
    );
  }
}

await main();
