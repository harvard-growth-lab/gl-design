/**
 * Networks and Hierarchies — six forms whose geometry has to be computed before
 * any mark exists, drawn from the Atlas's own graphs.
 *
 * This is the family where the Atlas has the most to offer and the library the
 * least, and both halves of that are worth naming up front.
 *
 * 1. **The Atlas ships a real network.** `product-space-edges` is the proximity
 *    graph the Atlas is built on — 4,316 edges between HS92 products, weighted
 *    by the probability of co-export. Nothing here is a synthetic adjacency
 *    matrix shaped to make three tidy communities. The communities the force
 *    layout finds below are the ones the trade data has, and they are *not*
 *    quite the Atlas's own sector classification, which is the finding.
 *
 * 2. **The Atlas does not ship a joint distribution.** A Sankey wants
 *    sector × destination; the extract carries sector totals and destination
 *    totals and no cross-tabulation of the two. Inventing that join is the one
 *    thing this page will not do, so the flow diagram is drawn on a hierarchy
 *    the data genuinely has — region, then market — and the residual that the
 *    twelve largest markets leave over is drawn as its own terminating node
 *    rather than dropped. That residual is where the data stops, made visible.
 *
 * 3. **Real names break every layout that reserves room for a label.** Atlas
 *    product names run to fifty characters. A tidy tree can size its right
 *    gutter from them (`estimateTextWidth` is exported, so the margin here is
 *    computed rather than guessed); a force layout cannot, because its nodes are
 *    placed in the middle of the plot. That asymmetry is most of this family's
 *    gaps.
 *
 * Contract, unchanged: no hex, no font size, no stroke width, no opacity. Data
 * preparation is authored; appearance never is.
 */

import type { ReactNode } from 'react';
import { Chart } from '@tanstack/react-charts';
import { hierarchy, tree } from 'd3-hierarchy';

import {
  LABEL_GAP,
  clearance,
  geometry,
  glAxisLog,
  glAxisX,
  glAxisY,
  glChart,
  glLabel,
  glLink,
  glPoint,
  minTextSize,
  resolveTone,
  seriesKeyAt,
  typeRoles,
} from '../src/index.js';
import {
  estimateTextWidth,
  glDelaunayEdges,
  glForceLayout,
  glSankeyChart,
  glTreemapChart,
} from '../src/shapes.js';
import { GLFigure, GLLegend } from '../src/figure.js';

import {
  LATEST_YEAR,
  LEAD,
  SECTOR_ORDER,
  countries,
  countryName,
  countryYearTable,
  crossSection,
  defined,
  leadPartnersTable,
  leadProducts,
  leadProductYearTable,
  partnersIn,
  productEdges,
  productSpaceEdgesTable,
  sectorRank,
  seriesFor,
  sourceOf,
  topProducts,
  usd,
  withNote,
} from './atlas-data.js';
import type { Demo, Family } from './demo.js';

const BASKET = sourceOf(leadProductYearTable);
const PANEL = sourceOf(countryYearTable);
const SPACE = sourceOf(leadProductYearTable, productSpaceEdgesTable);
const MARKETS = sourceOf(leadPartnersTable, countryYearTable);

/** The lead country, by name — every title in this family is about one basket. */
const LEAD_NAME = countryName(LEAD);

/**
 * The plot box the force layout settles inside.
 *
 * Layout units are pixels: the field is sized to the plate it is drawn on, so
 * the domain padding below can be read straight off the geometry tokens instead
 * of being converted from data units to pixels and back.
 */
const FIELD = { width: 760, height: 320 };

// ════════════════════════════════════════════════════════════════════════════

// #region demo:ts-74-treemap
/**
 * The whole export basket as area, two levels deep.
 *
 * The data preparation is the argument. A treemap is a composition of a WHOLE,
 * so the leaves have to add up to one: for each of the nine Atlas sectors this
 * takes the three largest products by name and folds that sector's remaining
 * products into one "Everything else" tile. Thirty-six tiles, and their sum is
 * exactly the classified basket the Atlas publishes — no top-N truncation
 * quietly redefining the denominator.
 *
 * §3.4.1: the tiers are separated by two widths of PAPER GUTTER and no stroke at
 * either depth. That is the one thing about a GL treemap people try to "fix"
 * back, and on nine blocks it is doing real work — the sector boundaries are
 * drawn entirely in negative space.
 *
 * ONE hue, not the palette, and here the real data forces what the specimen only
 * illustrated: nine sectors against six categorical tones means three sectors
 * would silently go muted and read as a residual bucket they are not. With
 * `tone` the gutters carry the structure colour would otherwise have to, and
 * `residual` keeps the nine leftover tiles grey without spending a hue on them.
 */
function BasketComposition() {
  const REST = 'Everything else';
  const NAMED_PER_SECTOR = 3;

  const leaves = SECTOR_ORDER.flatMap((sector) => {
    // Positive values only: a treemap encodes magnitude as area and there is no
    // area to draw for a zero. 70 of Vietnam's 1,199 product lines are zero in
    // 2023 — products it exported once and no longer does.
    const inSector = defined(
      leadProducts.filter((p) => p.sector === sector),
      'exportValueM',
    )
      .filter((p) => p.exportValueM > 0)
      .sort((a, b) => b.exportValueM - a.exportValueM);

    const named = inSector.slice(0, NAMED_PER_SECTOR).map((p) => ({
      product: p.nameShort,
      sector,
      value: p.exportValueM,
    }));
    const rest = inSector
      .slice(NAMED_PER_SECTOR)
      .reduce((sum, p) => sum + p.exportValueM, 0);

    return rest > 0 ? [...named, { product: REST, sector, value: rest }] : named;
  });

  const chart = glTreemapChart(leaves, {
    category: 'product',
    group: 'sector',
    value: 'value',
    tone: 'c-1',
    residual: REST,
    valueFormat: usd,
  });

  return (
    <GLFigure
      title="Electronics and machinery are half of everything Vietnam sells abroad."
      subtitle={`Export value by sector and product, ${LATEST_YEAR}; the three largest products in each of the nine Atlas sectors, with the rest of that sector as one tile`}
      source={withNote(
        BASKET,
        'Classified goods only — the Atlas excludes trade-discrepancy and unclassified codes, which are 12% of Vietnam’s reported total',
      )}
    >
      <Chart {...chart.props} height={360} ariaLabel="Vietnam export basket by sector and product" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-36-hierarchy-tree
/**
 * The Atlas classification as a tidy tree: country, sector, product.
 *
 * The links are the specimen. A tree edge joins two nodes of one structure, so
 * §3.4.2 makes it a CONNECTOR — dark tone, line weight, butt cap. It is not a
 * series line (there is no series) and not chrome (the edges are the data).
 *
 * The one thing the real data changes is the margin. Atlas product names run to
 * fifty characters, and a leaf label reads outward to the right, so the gutter
 * that holds it is a function of the data rather than a number. It is computed
 * from `estimateTextWidth` at the type role the label is drawn in — which is the
 * library's own estimator, exported from the treemap module because a tile has
 * the same question to answer about its own label.
 */
function ClassificationTree() {
  interface BasketNode {
    name: string;
    children?: BasketNode[];
  }

  const top = defined(topProducts(12), 'exportValueM');
  // Sectors in Atlas order, not in order of size: `SECTOR_ORDER` is the page's
  // categorical key and a tree that reordered its branches by value would put
  // the same sector in a different place on every chart.
  const branches = SECTOR_ORDER.filter((sector) => top.some((p) => p.sector === sector));

  const root: BasketNode = {
    name: LEAD_NAME,
    children: branches.map((sector) => ({
      name: sector,
      children: top.filter((p) => p.sector === sector).map((p) => ({ name: p.nameShort })),
    })),
  };

  const laid = tree<BasketNode>().size([1, 1])(hierarchy(root));
  const nodes = laid.descendants().map((node) => ({
    // d3's tidy tree measures breadth in `x` and depth in `y`. Depth runs left
    // to right here, so the two are swapped on the way out.
    name: node.data.name,
    x: node.y,
    y: node.x,
    depth: node.depth,
    leaf: !node.children,
  }));
  const links = laid.links().map((link) => ({
    x1: link.source.y,
    y1: link.source.x,
    x2: link.target.y,
    y2: link.target.x,
  }));

  // Gutters sized to the text they hold, at the weight and size the label mark
  // will actually draw. The leaves read rightward from their node; the root is
  // centred over its own, so it needs half its width on the left.
  const leafGutter = Math.ceil(
    Math.max(
      ...top.map((p) => estimateTextWidth(p.nameShort, typeRoles.seriesLabel.weight, minTextSize)),
    ) +
      geometry.pointRadius +
      LABEL_GAP * 2,
  );
  const rootGutter = Math.ceil(
    estimateTextWidth(LEAD_NAME, typeRoles.seriesLabel.weight, minTextSize) / 2 + LABEL_GAP,
  );

  // The layout puts nodes ON the unit box's edges and a point mark is 6px wide,
  // so both domains are padded past it — the same reason every scatter in this
  // package pins one.
  const PAD = 0.04;

  const chart = glChart({
    marks: [
      glLink(links, { x1: 'x1', y1: 'y1', x2: 'x2', y2: 'y2', tone: 'muted' }),
      glPoint(nodes, { x: 'x', y: 'y', tone: 'c-1' }),
      glLabel(nodes, {
        x: 'x',
        y: 'y',
        text: (d) => d.name,
        tone: 'c-1',
        // Leaves read outward to the right; internal nodes sit ABOVE their own
        // circle. Putting an internal label to the left of its node — the
        // obvious first choice — lands it on top of the link arriving from the
        // parent, which is the one place on the plot guaranteed to have ink.
        anchor: (d) => (d.leaf ? 'start' : 'middle'),
        dx: (d) => (d.leaf ? geometry.pointRadius + LABEL_GAP : 0),
        dy: (d) => (d.leaf ? 0 : -(geometry.pointRadius + LABEL_GAP)),
      }),
    ],
    // `axis: false` keeps the scale and omits the visible axis, which on this
    // one chart is CORRECT rather than a shortcut: §3.5 wants an axis line where
    // the reader estimates a value off a scale, and a tidy tree's coordinates
    // are layout output — "0.62 of the way across" is not a quantity anyone
    // reads. `guides: false` would be the wrong tool: it drops the scales too,
    // and every channel would then need a configured instance.
    x: { ...glAxisX({ domain: [-PAD / 2, 1 + PAD / 2], nice: false }), axis: false as const },
    y: { ...glAxisY({ grid: false, domain: [-PAD, 1 + PAD], nice: false }), axis: false as const },
    variant: { labelHalo: true },
    margin: {
      left: rootGutter,
      right: leafGutter,
      top: minTextSize,
      bottom: minTextSize,
    },
  });

  return (
    <GLFigure
      title="Vietnam's twelve largest exports come from three of the Atlas's nine sectors."
      subtitle={`The twelve largest products of ${LEAD_NAME}'s ${LATEST_YEAR} basket, under the sector they classify to; depth runs left to right`}
      source={BASKET}
    >
      <Chart {...chart.props} height={340} ariaLabel="Vietnam export classification tree" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-37-delaunay-network
/**
 * Nearest-neighbour structure among economies, from their coordinates alone.
 *
 * The Atlas has no station grid, but it has a plane every one of its readers
 * already has in mind: complexity against income. Triangulating it answers a
 * question the scatter cannot — not "who is near Vietnam" by eye, but which
 * economies are genuinely its nearest neighbours, with no threshold to choose
 * and no k to pick. The answer is four: the Philippines, India, Armenia and
 * Lebanon.
 *
 * Every edge is emitted once, not once per incident triangle. Drawn from raw
 * triangle sides, each interior edge strokes twice and renders visibly heavier
 * than the hull — which looks like deliberate emphasis on the interior and is
 * not. `glDelaunayEdges` de-duplicates.
 *
 * §3.1 decides the colour: the four incident edges and the five economies they
 * join carry the finding, and the other 114 edges are the structure the finding
 * sits in.
 */
function ComplexityNeighbours() {
  const asia = new Set(countries.filter((c) => c.region === 'Asia').map((c) => c.iso3));
  const rows = defined(
    defined(
      crossSection(LATEST_YEAR).filter((d) => asia.has(d.iso3)),
      'eci',
    ),
    'gdpPerCapita',
  ).map((d) => ({
    iso3: d.iso3,
    country: countryName(d.iso3),
    eci: d.eci,
    income: d.gdpPerCapita,
  }));

  // The triangulation runs in the space the chart DRAWS: complexity linearly,
  // income logarithmically. Income spans 409 to 85,412 dollars, so triangulating
  // on the raw figure would make every economy below the median a neighbour of
  // every other and the diagram would say nothing.
  const edges = glDelaunayEdges(rows, { x: (d) => d.eci, y: (d) => Math.log10(d.income) });

  // Back to data units for drawing: the y axis is logarithmic, so the mark wants
  // the dollars, not their logarithm. `GLEdge` carries both endpoint rows, which
  // is what makes the round trip exact rather than an inverse transform.
  const segments = edges.map((e) => ({
    x1: e.from.eci,
    y1: e.from.income,
    x2: e.to.eci,
    y2: e.to.income,
    touchesLead: e.from.iso3 === LEAD || e.to.iso3 === LEAD,
  }));

  const neighbours = new Set(
    edges
      .filter((e) => e.from.iso3 === LEAD || e.to.iso3 === LEAD)
      .map((e) => (e.from.iso3 === LEAD ? e.to.iso3 : e.from.iso3)),
  );
  const named = rows.filter((d) => d.iso3 === LEAD || neighbours.has(d.iso3));

  const ecis = rows.map((d) => d.eci);
  const incomes = rows.map((d) => d.income);
  const pad = (Math.max(...ecis) - Math.min(...ecis)) * 0.06;

  const chart = glChart({
    marks: [
      glLink(
        segments.filter((s) => !s.touchesLead),
        { x1: 'x1', y1: 'y1', x2: 'x2', y2: 'y2', tone: 'muted' },
      ),
      glLink(
        segments.filter((s) => s.touchesLead),
        { x1: 'x1', y1: 'y1', x2: 'x2', y2: 'y2', tone: 'c-1' },
      ),
      glPoint(
        rows.filter((d) => !named.includes(d)),
        { x: 'eci', y: 'income', tone: 'muted' },
      ),
      glPoint(named, { x: 'eci', y: 'income', tone: 'c-1' }),
      glLabel(named, {
        x: 'eci',
        y: 'income',
        text: (d) => d.country,
        tone: 'c-1',
        ...clearance<(typeof named)[number]>('right'),
      }),
    ],
    x: glAxisX({
      label: 'Economic Complexity Index',
      domain: [Math.min(...ecis) - pad, Math.max(...ecis) + pad],
    }),
    y: glAxisLog({
      label: 'GDP per capita (current USD, log scale)',
      domain: [Math.min(...incomes) / 1.4, Math.max(...incomes) * 1.4],
    }),
    variant: { labelHalo: true },
  });

  return (
    <GLFigure
      title="Vietnam's nearest neighbours are the Philippines, India, Armenia and Lebanon."
      subtitle={`Delaunay triangulation of ${rows.length} Asian economies in the complexity–income plane, ${LATEST_YEAR}; ${edges.length} edges`}
      source={withNote(
        PANEL,
        `${LATEST_YEAR} cross-section, Asia only; economies with no ECI or no GDP figure are dropped`,
      )}
      legend={
        <GLLegend
          items={[
            { label: 'Vietnam and its nearest neighbours', tone: 'c-1', mark: 'point' },
            { label: 'Other Asian economies', tone: 'muted', mark: 'point' },
          ]}
        />
      }
    >
      <Chart {...chart.props} height={300} ariaLabel="Triangulation of Asian economies" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-40-force-directed-network
/**
 * The Atlas's own product space, restricted to what Vietnam actually sells.
 *
 * The nodes carry a sector, but the layout never reads it: the clumps on screen
 * are produced by the proximity edges alone. That is the whole claim a force
 * diagram makes, and here it is checkable against the Atlas's own
 * classification — and it does not entirely agree. Seats and furniture land
 * inside the electronics-and-machinery cluster, because Vietnam's assembly
 * capabilities are what both draw on, and the Atlas classifies them under
 * textiles and furniture. A layout that reproduced the classification exactly
 * would be telling you nothing you did not already have.
 *
 * `glForceLayout` runs the simulation SYNCHRONOUSLY and DETERMINISTICALLY: a
 * chart definition is data and cannot await animation frames, and a plate that
 * settled somewhere new on every render would make every diff meaningless. It
 * pins the starting positions on a circle so `d3-force`'s one use of
 * `Math.random()` — which fires only when two nodes coincide — never fires.
 *
 * Edges are `glLink`: §3.4.2 CONNECTOR, dark tone, line weight, butt cap. Nodes
 * are `glPoint`, so §3.4's 0.8 fill-and-stroke applies, and it earns its place —
 * the electronics cluster is dense enough that its nodes overlap and darken into
 * exactly the density signal the rule exists for.
 */
function ProductSpaceNetwork() {
  const POOL = 40;
  const pool = defined(topProducts(POOL), 'exportValueM');
  const inPool = new Set(pool.map((p) => p.code));

  // The Atlas ships the proximity matrix SYMMETRICALLY — every pair appears as
  // both (a,b) and (b,a). Left as-is, `d3-force` applies the link force twice
  // between every connected pair and the clusters collapse.
  const seen = new Set<string>();
  const proximity = productEdges.filter((e) => {
    if (!inPool.has(e.source) || !inPool.has(e.target)) return false;
    const key = e.source < e.target ? `${e.source}:${e.target}` : `${e.target}:${e.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Products with no proximity link to another of the forty are not drawn. They
  // are not isolated in the product space — they are isolated in this SLICE of
  // it, which is a different claim, and a ring of unconnected dots would look
  // like the former.
  const linked = new Set(proximity.flatMap((e) => [e.source, e.target]));
  const products = pool
    .filter((p) => linked.has(p.code))
    .sort(
      (a, b) => sectorRank(a.sector) - sectorRank(b.sector) || b.exportValueM - a.exportValueM,
    );
  const nameOf = new Map(products.map((p) => [p.code, p.nameShort]));

  // Sectors in Atlas order, so the palette is spent in the order `SECTOR_ORDER`
  // fixes rather than in the order the edge list happened to mention them.
  const sectors = [...new Set(products.map((p) => p.sector))];

  const { nodes, links } = glForceLayout(
    products.map((p) => ({ id: p.code, group: p.sector })),
    proximity.map((e) => ({
      source: e.source,
      target: e.target,
      // Carried because it is the edge's only content. It reaches the layout and
      // does nothing — see the gap.
      value: e.proximity ?? undefined,
    })),
    {
      ...FIELD,
      // Short edges and strong repulsion: within a near-complete cluster the
      // link force pulls every pair together, so two clusters only separate if
      // the charge between them outweighs the edges bridging them.
      distance: 34,
      charge: -420,
    },
  );

  // Six labels, not twenty-eight. The specimen named every node and argued that
  // a network where only the hubs are named makes the bridges unidentifiable;
  // that argument does not survive a fifty-character product name, and six
  // already collide. See the gap — this is the shortfall, not a preference.
  const labelled = nodes.filter((n) => topProducts(6).some((p) => p.code === n.id));

  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  // Layout units are pixels (see FIELD), so the pad is a node radius plus the
  // clearance a label is placed at.
  const pad = geometry.pointRadius + LABEL_GAP;

  const chart = glChart({
    marks: [
      glLink(links, { x1: 'x1', y1: 'y1', x2: 'x2', y2: 'y2', tone: 'muted' }),
      ...sectors.map((sector) =>
        glPoint(
          nodes.filter((n) => n.group === sector),
          { x: 'x', y: 'y', tone: nodes.find((n) => n.group === sector)!.tone },
        ),
      ),
      glLabel(labelled, {
        x: 'x',
        y: 'y',
        text: (d) => nameOf.get(d.id) ?? d.id,
        fill: (d) => resolveTone(d.tone).dark,
        ...clearance<(typeof labelled)[number]>('right'),
      }),
    ],
    x: {
      ...glAxisX({ domain: [Math.min(...xs) - pad, Math.max(...xs) + pad], nice: false }),
      axis: false as const,
    },
    y: {
      ...glAxisY({
        grid: false,
        domain: [Math.min(...ys) - pad, Math.max(...ys) + pad],
        nice: false,
      }),
      axis: false as const,
    },
    variant: { labelHalo: true },
    margin: { left: LABEL_GAP, right: LABEL_GAP, top: LABEL_GAP, bottom: LABEL_GAP },
  });

  return (
    <GLFigure
      title="Proximity alone splits Vietnam's basket into garments, footwear, electronics and steel."
      subtitle={`${nodes.length} of Vietnam's ${POOL} largest ${LATEST_YEAR} products and the ${links.length} proximity links among them; position is the layout, colour is the Atlas sector`}
      source={withNote(
        SPACE,
        `Products with no proximity link to another of the ${POOL} are not drawn`,
      )}
      // The colour is on the NODES, which are dots, so the legend marks are dots
      // (§3.11). The links carry no grouping, so they get no entry — an entry a
      // reader cannot act on is one §3.11 drops.
      legend={
        <GLLegend
          items={sectors.map((sector, i) => ({
            label: sector,
            tone: seriesKeyAt(i),
            mark: 'point' as const,
          }))}
        />
      }
    >
      <Chart {...chart.props} height={340} ariaLabel="Proximity network of Vietnam's largest exports" />
    </GLFigure>
  );
}
// #endregion

// ── The flow graph, shared by both Sankey plates ────────────────────────────
//
// Hoisted because the two Sankeys below are a CONTROLLED COMPARISON: they must
// be the same graph, or the difference between them is not the option under
// test. See `ts-111-sankey-flow`.

const OTHER_MARKETS = 'Every other market';

/**
 * Vietnam's exports as a flow: country → destination region → destination
 * market.
 *
 * The Atlas publishes sector totals and destination totals for the lead country
 * and no cross-tabulation of the two, so the sector × destination Sankey the
 * form invites cannot be drawn honestly. This is the hierarchy the data does
 * have: every one of the twelve largest markets belongs to exactly one region,
 * and the region totals are sums of their own markets rather than a second
 * measurement.
 *
 * The residual node is the point. The twelve largest markets are 75% of what
 * Vietnam sells; the other 25% goes somewhere the extract does not name, so it
 * gets its own ribbon and TERMINATES ONE COLUMN EARLY. Dropping it would make
 * the diagram's total 289bn against the Atlas's own 386bn — a Sankey whose
 * first node disagrees with the country panel is worse than one with a
 * visible hole in it.
 */
function flowGraph() {
  const markets = defined(partnersIn(LATEST_YEAR), 'exportValueM');
  const total = defined(seriesFor(LEAD), 'exportValueM').find(
    (d) => d.year === LATEST_YEAR,
  )!.exportValueM;

  const regions = [...new Set(markets.map((m) => m.region))];
  const named = markets.reduce((sum, m) => sum + m.exportValueM, 0);

  const nodes = [
    { id: LEAD_NAME },
    ...regions.map((region) => ({ id: region })),
    { id: OTHER_MARKETS },
    ...markets.map((m) => ({ id: m.partnerShort })),
  ];

  const links = [
    ...regions.map((region) => ({
      source: LEAD_NAME,
      target: region,
      value: markets
        .filter((m) => m.region === region)
        .reduce((sum, m) => sum + m.exportValueM, 0),
    })),
    { source: LEAD_NAME, target: OTHER_MARKETS, value: total - named },
    ...markets.map((m) => ({
      source: m.region,
      target: m.partnerShort,
      value: m.exportValueM,
    })),
  ];

  return { nodes, links, total, named };
}

// #region demo:ts-111-basic-sankey
/**
 * Flows between nodes, ribbon width as quantity.
 *
 * The layout runs at the RESOLVED PIXEL SIZE, which is why `glSankeyChart` is a
 * dynamic definition like the treemap: node width and inter-node padding are
 * pixel constants, and laying out in a unit box would stretch both by the plot's
 * aspect ratio — precisely what they exist to hold fixed.
 *
 * §3.3 decides the ribbons: a flow is the background of the two nodes it joins,
 * so it takes the source node's LIGHT tone and the nodes keep `main`. That is a
 * departure from §3.4.2's connector rule, it is deliberate, and the plate below
 * this one draws the literal reading so the two can be compared rather than
 * argued about.
 *
 * Read the ribbon widths against the node heights. They agree by construction,
 * which is the only claim a Sankey makes and the one it is easiest to break
 * silently — and here the leftmost node's height is Vietnam's total exports as
 * the country panel reports it, so the diagram is checkable against a figure
 * that did not come from the partner table.
 */
function ExportDestinations() {
  const { nodes, links, total, named } = flowGraph();

  const chart = glSankeyChart({ nodes, links });

  return (
    <GLFigure
      title="Two markets take nearly half of everything Vietnam exports."
      subtitle={`Goods exports by destination region and market, ${LATEST_YEAR}; ribbon width is value, and "${OTHER_MARKETS}" is the ${usd(total - named)} the twelve largest do not account for`}
      source={withNote(
        MARKETS,
        `${LATEST_YEAR}; the residual is Vietnam's total exports less the twelve largest markets, and the Atlas does not report its regional split`,
      )}
    >
      <Chart {...chart.props} height={360} ariaLabel="Vietnam exports by destination" />
    </GLFigure>
  );
}
// #endregion

// #region demo:ts-111-sankey-flow
/**
 * The same graph under the §3.4.2 reading.
 *
 * Two options apart from the plate above. `linkTone: 'c-1'` takes the connector
 * ruling back, so every ribbon is one dark tone instead of its source's light
 * one — put the two side by side and the reason a ribbon cannot be painted like
 * a hairline is not a matter of taste.
 *
 * `align: 'left'` packs each node as far left as its dependencies allow, and on
 * this graph it has exactly one visible consequence, which is the useful one:
 * the residual node is a genuine early terminus — it leaves Vietnam and the
 * Atlas does not say where it goes — so under `justify` it is pushed out to the
 * right-hand column beside the named markets, as though it were one of them, and
 * under `left` it stops in the region column where the data actually stops.
 * Everything else about the diagram is identical to the plate above, which is
 * what makes the ribbon tone the only thing under test.
 */
function ExportDestinationsAsConnectors() {
  const { nodes, links } = flowGraph();

  const chart = glSankeyChart({ nodes, links, align: 'left', linkTone: 'c-1' });

  return (
    <GLFigure
      title="Under §3.4.2 as written, every ribbon is one dark connector."
      subtitle="The same flows with the literal connector reading, and each node packed as far left as its inputs allow — see the gap"
      source={withNote(
        MARKETS,
        `${LATEST_YEAR}; the residual is Vietnam's total exports less the twelve largest markets, and the Atlas does not report its regional split`,
      )}
    >
      <Chart
        {...chart.props}
        height={360}
        ariaLabel="Vietnam exports by destination, single-tone ribbons"
      />
    </GLFigure>
  );
}
// #endregion

// ════════════════════════════════════════════════════════════════════════════

const demos: Demo[] = [
  {
    id: 'ts-74-treemap',
    family: 'Networks and Hierarchies',
    name: 'Two-level treemap',
    question: 'What is in Vietnam’s export basket, and how concentrated is it?',
    rule: '§3.4.1 — tiers are separated by paper gutter, never by a stroke.',
    render: BasketComposition,
    gaps: [
      'A two-level treemap has no mark for the BLOCK. `glTreemapChart` labels tiles and draws the group boundary entirely in negative space, which is §3.4.1 working exactly as ruled — but with nine sector blocks all in one hue there is nothing on the chart that says which block is which sector, and no legend can supply it because colour is not carrying the grouping. The synthetic specimen hid this: four blocks whose product names named their own sector. A block label (or a `groupLabel` option placing one in the gutter) is the missing piece, and it is a real addition to the form rather than a paint decision.',
      'The three-per-sector cut is the plate’s, not the library’s. `glTreemapChart` has `residual` for a leftover bucket but no way to say "name the largest N of each group and fold the rest", so the fold is done in the demo and the tile count is a hand-chosen number. On this data it is load-bearing: at five per sector the smallest blocks stop fitting any label at all.',
      'Nine sectors against six categorical tones is why `tone` is passed. That is the honest answer here, but it means the treemap cannot be read against the stacked-area and marimekko demos on this page, which DO spend the palette on sectors — the same sector is `c-3` there and `c-1` here. Nothing in `grammar.md` rules on what a chart should do when the categorical key outruns the palette, and every family on this page has answered it differently.',
    ],
  },
  {
    id: 'ts-36-hierarchy-tree',
    family: 'Networks and Hierarchies',
    name: 'Tidy hierarchy tree',
    question: 'Which sectors do Vietnam’s largest exports actually classify to?',
    rule: '§3.4.2 — a tree edge is a connector: dark tone, line weight, butt cap.',
    render: ClassificationTree,
    gaps: [
      '`tree()` is called in the demo rather than wrapped. That is a defensible place to leave it — the layout is three lines and `d3-hierarchy` is already a declared dependency for the treemap — but it means the node radius, the label side and the domain padding are all the caller’s decisions. A `glTreeChart` would own them; it would also be a whole-chart function for a form `grammar.md` has never ruled on, which is why it does not exist yet.',
      'The margins are computed from `estimateTextWidth`, which is exported from the TREEMAP module. It is the right estimator and it is reachable, but nothing in `chart.ts` or `compose.ts` offers a `marginFor(labels, role)`, so every chart with outward-reading labels either re-derives this or guesses a number. The gallery specimen guessed 96px; Atlas product names need 340.',
      'The sector labels are centred above their nodes and run to 42 characters ("Textiles, garments, footwear and furniture"), so each one crosses the links arriving from the root. The paper halo keeps them readable and nothing else can help: `glLabel` has no leader-line or dodge behaviour, and the alternative side — left of the node — is worse, because that is where the parent’s link lands.',
    ],
  },
  {
    id: 'ts-37-delaunay-network',
    family: 'Networks and Hierarchies',
    name: 'Delaunay spatial network',
    question: 'Which economies are Vietnam’s nearest neighbours in complexity and income?',
    rule: '§3.4.2 — a triangulation side is a connector, exactly like a network edge.',
    render: ComplexityNeighbours,
    gaps: [
      'The triangulation is not scale-free and this is the first dataset where that bites. The synthetic specimen’s stations were kilometres against kilometres, so "nearest" meant one thing; complexity index units against log-dollars are incommensurable, and the diagram is the nearest-neighbour structure OF THIS CHOICE OF AXES. Triangulating on raw dollars, or on both axes normalised to the unit interval, gives a different and equally defensible answer. `glDelaunayEdges` takes accessors and cannot warn about this, because it has no way to know the two are different units.',
      'The plot is not square, so the triangles on screen are not the triangles that were computed — the x span is three times the y span in pixels per data unit, which stretches every edge. Nothing in the library can pin an aspect ratio: `<Chart>` takes a height and fills its container’s width.',
      'The four labels plus Vietnam’s are placed by `clearance`, which has no collision handling — the Philippines sits up and to the right of Vietnam and the two labels overlap. Same shortfall the Lines family records for `endLabels`; a dodge pass over placed labels belongs in `compose.ts`.',
    ],
  },
  {
    id: 'ts-40-force-directed-network',
    family: 'Networks and Hierarchies',
    name: 'Force-directed network',
    question: 'Does the Atlas’s product space reproduce its own sector classification?',
    rule: '§3.4.2 — edges are connectors; §3.4 — overlapping nodes darken at 0.8.',
    render: ProductSpaceNetwork,
    gaps: [
      'The simulation is run SYNCHRONOUSLY to a fixed tick count, because a chart definition is data and nothing in the pipeline can await a layout that settles over animation frames. That is d3’s own supported path (`stop()` then `tick(n)`) and it costs the live, draggable behaviour TanStack’s version has — which is the interaction gap again, not a layout one.',
      'Determinism is bought rather than given. `glForceLayout` pins its starting positions on a circle so that `d3-force`’s one use of `Math.random()` — `jiggle()`, which fires when two nodes coincide — never fires. Two nodes sharing an id would still coincide; that warns, and `tests/network.test.ts` asserts two runs agree. Without this the gallery premise fails: a plate that lands somewhere new on every render makes every diff meaningless.',
      '`GLNetworkLink.value` is accepted and then ignored. `glForceLayout` gives every edge the same target distance and the same strength, so proximity — the product space’s only weight, and the entire content of an Atlas edge — cannot reach the layout. On synthetic unweighted data that was invisible; on this dataset it means a 0.92 link and a 0.31 link pull identically. `distance` and `strength` taking `(link) => number` is the fix.',
      'The specimen labelled all fourteen of its nodes and argued that naming only the hubs makes the bridges — which are the finding — the one thing the reader cannot identify. At Atlas name lengths that is not available: six labels of up to fifty characters already overlap each other and the nodes they are not attached to, and twenty-eight would be solid ink. `glLabel` has no dodge, no leader line and no ellipsis, and the plot cannot reserve a gutter for a label that starts in the middle of it.',
      'The forty-product slice is the demo’s. The full product space is 1,241 nodes and 4,316 edges, which is a hairball at any plate size, and `glForceLayout` has no thinning, no clustering and no level-of-detail — so choosing what to draw is entirely the caller’s, undocumented, and different on every chart that draws a network.',
    ],
  },
  {
    id: 'ts-111-basic-sankey',
    family: 'Networks and Hierarchies',
    name: 'Basic Sankey',
    question: 'Where do Vietnam’s exports actually go?',
    rule: '§3.3 — a ribbon is the background of the two nodes it joins, so it is light.',
    render: ExportDestinations,
    gaps: [
      '§3.4.2 names "a Sankey link" among its CONNECTORS, which take the series DARK tone at line weight — and `glSankeyChart` does not do that by default. The ruling was written for a dumbbell bar, a candlestick wick and a boxplot whisker: marks two pixels wide. A ribbon is the same geometry at forty, and the rule does not survive the scale change — overlapping dark ribbons at full opacity are unreadable and bury the node rectangles they are supposed to connect. The default is the source node’s LIGHT tone, which follows §3.3 (light already has the background job) and mirrors §3.9’s argument for bands: a known flat colour wherever two ribbons cross, and a lightness step that survives greyscale where an alpha does not. THE FIX BELONGS UPSTREAM — §3.4.2 should distinguish a hairline connector from a ribbon. Until it does, `linkTone` takes the literal reading back, and `ts-111-sankey-flow` draws it so the two can be compared rather than argued about.',
      'The Atlas has no sector × destination table, so the Sankey a trade page most wants — what Vietnam sells, to whom — cannot be drawn from this release without inventing the join. The columns here are a genuine hierarchy (region, then market) and the diagram is therefore a decomposition rather than a flow between different KINDS of thing, which is the form’s strongest use. Recorded as a data gap, not a library one.',
      '`glSankeyChart` reserves a fixed 92px gutter on each side for node labels. "United States of America" is the Atlas’s own short name for its largest market and needs about 140px at the series-label role, so it runs past the plot and is clipped. The gutter should be measured from the labels — the module already has `estimateTextWidth` in the package — or exposed as an option.',
      'Thirteen nodes share the last column and the smallest of them, the United Arab Emirates at $6.6bn, is under three pixels tall against a $386bn total. `nodePadding` is a fixed pixel constant, so the column’s ribbons and its gaps compete for height and nothing warns when the gaps win.',
    ],
  },
  {
    id: 'ts-111-sankey-flow',
    family: 'Networks and Hierarchies',
    name: 'Sankey flow — the literal §3.4.2 reading',
    question: 'What does the connector rule look like when a connector is forty pixels wide?',
    rule: '§3.4.2 as written — every ribbon one dark connector. Compare the plate above.',
    render: ExportDestinationsAsConnectors,
    gaps: [
      'This plate exists to make the departure ARGUABLE rather than asserted: it is the same graph under the connector rule exactly as §3.4.2 writes it, so the two can be compared side by side. §3.4.2 names "a Sankey link" among its CONNECTORS, which take the series DARK tone at line weight — and `glSankeyChart` does not do that by default. The ruling was written for a dumbbell bar, a candlestick wick and a boxplot whisker: marks two pixels wide. A ribbon is the same geometry at forty, and the rule does not survive the scale change — overlapping dark ribbons at full opacity are unreadable and bury the node rectangles they are supposed to connect. The default is the source node’s LIGHT tone, which follows §3.3 (light already has the background job) and mirrors §3.9’s argument for bands: a known flat colour wherever two ribbons cross, and a lightness step that survives greyscale where an alpha does not. THE FIX BELONGS UPSTREAM — §3.4.2 should distinguish a hairline connector from a ribbon. Until it does, `linkTone` takes the literal reading back, and `ts-111-sankey-flow` draws it so the two can be compared rather than argued about.',
      'Real data makes the comparison harder to read than the synthetic did, and in a way that supports the departure. Thirty-two ribbons in one dark tone, four of which are wider than a hundred pixels, leave the three region rectangles they pass through invisible — on the synthetic six-link graph the nodes still showed through. The rule gets worse as the graph gets bigger, which is the opposite of what a rule should do.',
      '`align: "left"` is drawn here rather than beside the default, so the two align modes are never on screen together. The comparison this plate is for is the ribbon tone; putting a second variable in it was the specimen’s choice and it is kept so the pair stays a port rather than a rewrite. On this graph its one effect — where the residual node lands — is genuinely informative, which is luck.',
    ],
  },
];

export const networksFamily: Family = {
  slug: 'networks-and-hierarchies',
  title: 'Networks and Hierarchies',
  blurb:
    'Six forms where the layout is computed before anything is drawn — a treemap tiling, a tidy tree, a triangulation, a force-directed graph and two flow diagrams. What they have in common is structure: who contains what, and what flows where.',
  demos,
};

export function renderNetworks(): Record<string, () => ReactNode> {
  return Object.fromEntries(demos.map((d) => [d.id, d.render]));
}
