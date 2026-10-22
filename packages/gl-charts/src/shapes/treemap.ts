/**
 * Treemap — composition of a whole across many categories with very uneven
 * shares.
 *
 * It is a whole-chart function, not a composed snippet, for the same reason the
 * radar is: almost none of the Cartesian machinery applies. A treemap has no
 * Cartesian axes, no `glMargin`, no `glAxis*` preset and no data-driven scale —
 * tiles are placed by a layout algorithm and the scales exist only to map that
 * placement onto pixels. What it *does* share is the pop-up effect, so
 * `highlight` behaves exactly as it does on a composed bar chart, down to
 * reusing `popUp` from `compose.ts`.
 *
 * **The layout is `d3-hierarchy`'s, not ours.** TanStack Charts ships no
 * hierarchical layout of any kind, and its own treemap catalog entry reaches for
 * `d3-hierarchy` too — so this follows the library's canonical shape rather than
 * carrying a hand-rolled squarifier. `reference/tanstack-treemap.md` records what
 * that entry does, what we take from it, and the two places we deliberately
 * diverge. The most important divergence: the layout runs at the chart's
 * RESOLVED PIXEL SIZE, not in a fixed square. Squarifying in a unit square and
 * scaling the result afterwards stretches every tile by the plot's aspect ratio,
 * which is the one thing squarification exists to prevent.
 *
 * The *tiling* half of that layout is injectable — see `tile` on the options —
 * because which tiling to use is an editorial decision d3 already models as a
 * swappable function, and squarified is only the right default.
 *
 * Three values here look like mistakes and are not:
 *
 * 1. **Tiles are full opacity with no stroke.** The spec PDF's treemap page
 *    (§9, p. 17) asks for 0.8 opacity and a matching darker stroke. That page
 *    contradicts its own marks page — which lists the treemap under "full
 *    opacity, no stroke" — and Decision Rule 3, which says single-layer marks
 *    stay at full opacity. `grammar.md` adjudicates in favour of the marks page.
 *    See `docs/data-vis-spec-core.md` §0 #1. Do not "fix" this back.
 *
 * 2. **Tiles are separated by a GAP, not a stroke** — at every depth, including
 *    a flat single-level treemap. `SPEC.md` §3.4.1 rules it, and the ruling
 *    came from measuring the spec's own plates: Figures 4 (p. 17) and 11 (p. 24)
 *    both run a uniform 4.8px paper channel on both axes. Figure 11 is the case
 *    that forces it — its seven supporting tiles are all `c-muted`, so without
 *    the gutter they render as one grey mass with no boundaries. The gap is cut
 *    by `paddingInner`, so tiles arrive here already at their painted size.
 *
 * 3. **In-tile labels are not always `paper`.** See `glLabelInkOn` below; the
 *    short version is that white text on `c-muted` measures about 2:1, and a
 *    pop-up treemap is mostly `c-muted`.
 *
 * The 12px floor is enforced by measurement, not by hope: a label whose text
 * box would not fit inside its tile is DROPPED. It is never shrunk, and it is
 * never drawn anyway — TanStack does not clip a text mark to the rect it sits
 * on, so an optimistic guess renders as a label running out across its
 * neighbour.
 */

import type { ChartAxisOptions } from '@tanstack/charts';
import { scaleLinear } from '@tanstack/charts-scales/linear';
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';
import type { HierarchyRectangularNode } from 'd3-hierarchy';

import { glChart, type GLChart } from '../chart.js';
import { popUp, type GLChannel } from '../compose.js';
import { warn } from '../dev.js';
import { glAnnotation, glLabel, glTile } from '../marks.js';
import { resolveTone, series as toneAt, type GLToneRef } from '../tone.js';
import {
  geometry,
  ink,
  minTextSize,
  muted,
  paletteOrder,
  surface,
  typeRoles,
  type GLTone,
} from '../tokens.js';

/**
 * Read a GL channel.
 *
 * Doubles as the adapter between the two calling conventions in play: `GLChannel`'s
 * accessor takes `(datum, { index, data })`, TanStack's takes
 * `(datum, index, data)`. Nothing a caller supplies is handed to a mark
 * directly — every channel is read through here into this module's own row
 * objects, and the marks only ever see field names on those rows. That is
 * deliberate: it makes an accessor-form channel work, and it keeps the tile
 * geometry (which the caller never sees) out of the caller's datum type.
 */
function channel<T>(ref: GLChannel<T>): (datum: T, index: number, data: readonly T[]) => any {
  if (typeof ref === 'function') return ref;
  return (d) => (d as Record<string, unknown>)[ref as string];
}

// ── Text metrics ────────────────────────────────────────────────────────────

/**
 * Approximate advance widths in Inter, as a fraction of the font size.
 *
 * Only the classes that differ enough to change a fit decision are listed;
 * everything else takes `BASE_EM`. The numbers are eyeballed off Inter's
 * metrics rather than read from the font — which is the point, see
 * `estimateTextWidth`.
 */
const NARROW_EM = 0.3;
const WIDE_EM = 0.9;
const CAP_EM = 0.62;
const SPACE_EM = 0.28;
const BASE_EM = 0.55;

const NARROW = new Set("iljtfrI.,:;'`!|()[]{}/\\-·");
const WIDE = new Set('MWmw@%');

/**
 * Weight 600 is about 5% wider than weight 400 in Inter. The spec's in-chart
 * label sizes are the same at both weights, so this is the only correction the
 * two roles need.
 *
 * The two weights are the two type roles a tile label uses — `seriesLabel` for
 * the name line, `annotation` for `value · share` — read from the tokens rather
 * than written as 600 and 400, so a change to either role reaches the fit test.
 * Only the ratio is a font metric.
 */
const BOLD_FACTOR = 0.58 / 0.55;
const NAME_WEIGHT = typeRoles.seriesLabel.weight;
const DETAIL_WEIGHT = typeRoles.annotation.weight;

/**
 * Estimate the rendered width of a string, in px.
 *
 * A treemap tile has to decide whether its own label fits *before* the chart is
 * defined, and neither TanStack nor `gl-charts` will answer that: the build
 * context carries a width, a height and a theme, and nothing that can measure a
 * glyph. (`<Chart>` does take a `measureText` host option, but it is used for
 * axis-label layout and is not reachable from a chart definition.)
 *
 * This deliberately does NOT measure through a canvas, even though a canvas
 * gives real Inter metrics in a browser. The layout runs again on every resize,
 * on the server during SSR and in the client after hydration; a measurement
 * that exists in one of those and not the others makes the *set of labels*
 * differ between renders, which is a hydration mismatch that shows up as tiles
 * losing their names on mount. A pure function is worth more here than a few
 * percent of accuracy, and the error is spent conservatively — the fit test
 * demands padding on all four sides, so a label near the boundary is dropped
 * rather than drawn into its neighbour.
 */
export function estimateTextWidth(
  text: string,
  weight: number = DETAIL_WEIGHT,
  fontSize: number = minTextSize,
): number {
  let em = 0;
  for (const char of text) {
    if (char === ' ') em += SPACE_EM;
    else if (NARROW.has(char)) em += NARROW_EM;
    else if (WIDE.has(char)) em += WIDE_EM;
    else if (char >= 'A' && char <= 'Z') em += CAP_EM;
    else if (char >= '0' && char <= '9') em += CAP_EM;
    else em += BASE_EM;
  }
  return em * fontSize * (weight >= NAME_WEIGHT ? BOLD_FACTOR : 1);
}

// ── In-tile label ink ───────────────────────────────────────────────────────

/** WCAG 2.1 relative luminance of a `#rrggbb` string. */
function relativeLuminance(hex: string): number {
  const packed = Number.parseInt(hex.slice(1), 16);
  const linear = [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255].map((byte) => {
    const channelValue = byte / 255;
    return channelValue <= 0.04045
      ? channelValue / 12.92
      : ((channelValue + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/**
 * The ink for a label sitting ON a tile: `paper` on a dark fill, `ink` on a
 * light one, split at 0.4 relative luminance.
 *
 * Decision Rule 6 ("the dark tone is for all text tied to a colored mark") is a
 * rule about text on *paper* — its stated justification is WCAG AA against
 * white — and it does not reach text drawn on top of a saturated fill. Applying
 * it there is actively wrong: `c-1-dark` on `c-1` measures 2.5:1. So the tile
 * label follows the fill's lightness instead, which is what `docs/nil/` asks for
 * in prose ("white text on dark tiles, with a dark-text fallback on light
 * tiles") and what the plates do in practice. `SPEC.md` §3.4.1 carries it.
 *
 * The threshold is not a taste call. Sampled off Figure 4 at 200dpi, the plate's
 * dark-tile text is near-black (`#1A1A1A`, i.e. `ink`), and the split between
 * the fills it gives paper and the fills it gives ink lands in a wide empty
 * band:
 *
 * | Fill          | luminance | plate | this |
 * |---------------|----------:|-------|------|
 * | `c-4`         |     0.128 | paper | paper |
 * | `c-2`         |     0.181 | paper | paper |
 * | `c-1`         |     0.221 | paper | paper |
 * | `c-3`         |     0.291 | ink   | paper |
 * | `c-5`         |     0.336 | paper | paper |
 * | -- 0.4 -------|-----------|-------|------|
 * | `c-muted`     |     0.459 | ink   | ink   |
 * | `c-6`         |     0.553 | ink   | ink   |
 * | `c-muted-light`|    0.641 | —     | ink   |
 *
 * Every `light` tone sits at 0.57-0.64 and takes ink too. The one disagreement
 * is `c-3`, and the plate is the inconsistent party there: it gives ink to `c-3`
 * at 0.291 while giving paper to `c-5`, which is *lighter* at 0.336. A rule that
 * followed it would not be a rule.
 *
 * **Known shortfall, filed as `SPEC.md` C3.** At the 12px/600 the
 * spec pins — not WCAG "large text", which starts at 18.66px bold, so the bar is
 * 4.5:1 — paper does not clear AA on every main:
 *
 * | Fill  | paper | ink  |
 * |-------|------:|-----:|
 * | `c-1` |  3.87 | 4.61 |
 * | `c-2` |  4.55 | 3.92 |
 * | `c-3` |  3.08 | 5.79 |
 * | `c-4` |  5.91 | 3.02 |
 * | `c-5` |  2.72 | 6.57 |
 *
 * Picking the higher ratio per fill would clear 4.5:1 everywhere, and the
 * library did that for a while. It is not what this does, for two reasons: it
 * inverts the spec on `c-1` and `c-5`, which is a change to the spec and belongs
 * upstream rather than inside a downstream encoding; and it renders a six-hue
 * treemap as an alternating checkerboard of white and near-black labels. The
 * shortfall is real and recorded with the numbers; the fix is a palette
 * question for Nil, not a silent override here.
 *
 * No paper halo is applied. The halo in §3 exists to rescue a label crossing an
 * *unpredictable* background; a tile label sits on one known flat fill.
 */
const LIGHT_FILL_LUMINANCE = 0.4;

/**
 * Exported because a treemap is not the only mark that puts a label on a fill.
 *
 * A labelled heatmap cell, a Marimekko segment and a stacked-bar value label all
 * ask the identical question, and until this was reachable each of them had to
 * either re-derive the luminance split or settle for `ink-2` and hope the ramp
 * stayed pale. Both are worse than one rule in one place — the treemap's own
 * docstring above is the argument, and it does not become a different argument
 * when the mark is a rectangle from `glCell` rather than one from the tiling.
 *
 * Takes the resolved fill, not a tone reference, precisely so a ramp step works:
 * a sequential ramp's fourth bin has no tone triple to ask about.
 */
export function glLabelInkOn(fill: string): string {
  return relativeLuminance(fill) < LIGHT_FILL_LUMINANCE ? surface.paper : ink.DEFAULT;
}

// ── Geometry ────────────────────────────────────────────────────────────────

/**
 * Inset from the tile's top-left corner to its label block, and the two
 * baselines below the tile's top edge. All four are measured values, not
 * invented ones — `SPEC.md` §3.4.1 carries them, and they came off the
 * spec's own Figure 4 at 200dpi:
 *
 * | Tile               | left pad | line 1 cap-top | line 2 cap-top |
 * |--------------------|---------:|---------------:|---------------:|
 * | Cashmere (111x87)  |     12.0 |           16.3 |           31.2 |
 * | Everything (102x283)|    11.5 |           16.8 |           33.1 |
 * | Iron ore (185x137) |     14.4 |           18.7 |           36.0 |
 * | Gold (93x49)       |      9.6 |           11.5 |           25.4 |
 *
 * The plate's padding drifts with tile size — a designer's eye, not a system —
 * so this takes the mid-size tiles as the intent and applies one number
 * everywhere. 12px padding puts the name's cap-top at 16px, which is the
 * measured value on both mid-size tiles.
 */
const LABEL_PAD = geometry.treemapLabelPad;

/** Baseline of the name line, below the tile's top edge. */
const NAME_BASELINE = geometry.treemapLabelBaseline;

/** Baseline-to-baseline for the two label lines. */
const LABEL_LINE = geometry.treemapLabelLine;

/**
 * TanStack draws a text mark with `dominant-baseline: middle` and no way to
 * change it, so `dy` positions the vertical CENTRE of the line rather than its
 * baseline — and SVG puts that centre half an x-height ABOVE the baseline, not
 * half an em. Inter's x-height is 0.517em, so at the 12px floor the correction
 * is ~3.1px. Getting this wrong is a silent 3px lift on every tile label.
 */
const X_HEIGHT_EM = 0.517;
const MIDDLE_TO_BASELINE = (minTextSize * X_HEIGHT_EM) / 2;

/** Centre of the name line, measured down from the tile's top edge. */
const NAME_DY = NAME_BASELINE - MIDDLE_TO_BASELINE;

/** Centre of the `value · share` line. */
const DETAIL_DY = NAME_DY + LABEL_LINE;

/**
 * Tile height needed to hold each label form.
 *
 * The bottom of a line is its baseline plus a descender (0.24em); the tile has
 * to clear that and still leave the padding it gave at the top. A label that
 * only fits by touching an edge has not fitted — text is not clipped to its
 * rect, so an optimistic guess renders as a label running out over a neighbour.
 */
const DESCENDER = minTextSize * 0.24;
const TWO_LINE_HEIGHT = NAME_BASELINE + LABEL_LINE + DESCENDER + LABEL_PAD;
const ONE_LINE_HEIGHT = NAME_BASELINE + DESCENDER + LABEL_PAD;

// ── Rows ────────────────────────────────────────────────────────────────────

/**
 * How much of a tile's label survived the fit test.
 *
 * A ladder, not a switch. `SPEC.md` §3.4.1 has a tile shorten its label
 * before it drops it, which is what the plates do — Figure 4 gives its two
 * smallest tiles `0.7B` and `0.5B`, dropping the unit prefix and the share
 * rather than going anonymous. `value` is that rung: the name over a bare value,
 * no share.
 */
type LabelFit = 'full' | 'value' | 'name' | 'none';

/**
 * One laid-out tile. This is what the marks actually see: every channel a mark
 * reads is a plain field here, so nothing the caller passed — accessor or field
 * name — has to be re-read inside TanStack.
 */
interface TreemapRow<T> {
  datum: T;
  key: string;
  name: string;
  group: string;
  value: number;
  detail: string;
  /**
   * The tile in PIXELS, y measured DOWN from the top of the plot — d3's
   * convention, kept rather than converted. The y scale's domain is reversed to
   * turn it over, which is how TanStack's own treemap example does it and is
   * one fewer coordinate transform to get wrong.
   */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  toneKey: string;
  fill: string;
  labelInk: string;
  fit: LabelFit;
}

interface Entry<T> {
  datum: T;
  key: string;
  name: string;
  group: string;
  value: number;
}

/**
 * The tree `d3-hierarchy` is handed. A flat treemap is the degenerate case —
 * one root whose children are all leaves — which is why there is no separate
 * flat path below.
 */
interface LayoutNode<T> {
  name: string;
  entry?: Entry<T>;
  children?: LayoutNode<T>[];
  /**
   * True for a leftover bucket. It no longer affects the ORDER — the sort is
   * strictly by value, see `layOut` — it only records what `assignTones` mutes.
   */
  residual?: boolean;
}

/**
 * A d3 tiling function — what `d3.treemap().tile()` takes. It receives a node
 * whose children are already summed and sorted, plus the rectangle to divide,
 * and writes `x0/y0/x1/y1` onto each child.
 *
 * Exposed as an option because the choice of tiling is editorial, not internal:
 * squarified reads best for a static figure, but `treemapResquarify` keeps tiles
 * in place across a resize or a transition and `treemapSliceDice` preserves a
 * given order at the cost of aspect ratio. d3 already models the choice as a
 * swappable function and `d3-hierarchy` is a declared dependency of this package
 * (`package.json` explains why it is a real one and not a transitive), so
 * carrying the option costs a line and forking this module to change one call is
 * the alternative.
 */
export type GLTreemapTiling = (
  node: HierarchyRectangularNode<any>,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) => void;

/**
 * Lay the entries out at the chart's resolved pixel size.
 *
 * Pixels, not a unit square, and that is the whole point. A squarified layout
 * computed in the unit square and then scaled onto a 596x300 plot comes out
 * stretched by 2:1 — every tile twice as wide as the algorithm intended, which
 * defeats the only thing squarification is for. Feeding `size([width, height])`
 * the real numbers costs nothing and gets tiles that are square on screen.
 *
 * It also puts the gutter in real units. `paddingInner` is the separation
 * between a node's adjacent children, so one accessor expresses both tiers of
 * `SPEC.md` §3.4.1: the root separates blocks (10px), a block separates its
 * own children (5px), and a flat treemap only ever asks the root, which
 * separates siblings (5px). There is deliberately no `paddingOuter` — the spec's
 * plates run their tiles flush to the plot edge.
 *
 * Sorting largest-first is what makes the tiles come out near-square, and it is
 * also the reading order the plates use. Strictly by value, with no exception
 * for residual buckets: the plate puts "Everything else" in the far column
 * despite it being the fourth-largest tile, but that is hand placement, and
 * reproducing it by feeding squarify a non-descending list breaks the
 * algorithm's precondition — measurably, the tiles either side of the
 * out-of-order entry come out long and thin. A residual bucket is marked out by
 * being grey, which is the part of the plate's treatment that costs nothing.
 *
 * `tile` is the caller's tiling function, defaulted to `treemapSquarify` by
 * `glTreemapChart`. Everything above — pixel sizing, the two-tier gutter, the
 * descending sort — holds whichever tiling is passed; only the shape of the
 * resulting rectangles changes.
 */
function layOut<T>(
  entries: readonly Entry<T>[],
  grouped: boolean,
  width: number,
  height: number,
  isResidual: (entry: Entry<T>) => boolean,
  tile: GLTreemapTiling,
) {
  const root: LayoutNode<T> = { name: '', children: [] };

  if (grouped) {
    const groups = new Map<string, LayoutNode<T>>();
    for (const entry of entries) {
      let block = groups.get(entry.group);
      if (!block) {
        block = { name: entry.group, children: [], residual: true };
        groups.set(entry.group, block);
        root.children!.push(block);
      }
      const residual = isResidual(entry);
      // A block is only residual if everything in it is — one real category is
      // enough to keep the whole block in the reading order.
      if (!residual) block.residual = false;
      block.children!.push({ name: entry.name, entry, residual });
    }
  } else {
    root.children = entries.map((entry) => ({
      name: entry.name,
      entry,
      residual: isResidual(entry),
    }));
  }

  // A gutter wider than the space it divides makes d3 hand back inverted
  // rectangles. That only happens at sizes nothing is legible at anyway — the
  // pre-mount placeholder, a collapsed flex parent — so drop the gutter rather
  // than draw garbage.
  const room = Math.min(width, height);
  const gutter = room > geometry.treemapBlockGutter * 4 ? geometry.treemapGutter : 0;
  const blockGutter = gutter === 0 ? 0 : geometry.treemapBlockGutter;

  const laidOut = treemap<LayoutNode<T>>()
    .tile(tile)
    .size([Math.max(0, width), Math.max(0, height)])
    .paddingInner((node) => (grouped && node.depth === 0 ? blockGutter : gutter))
    .round(false)(
    hierarchy<LayoutNode<T>>(root)
      .sum((node) => node.entry?.value ?? 0)
      .sort((left, right) => (right.value ?? 0) - (left.value ?? 0)),
  );

  // Only leaves are drawn. A parent block used to get a thicker paper border of
  // its own; it no longer needs one, because the doubled gutter between blocks
  // already draws the boundary in negative space.
  return {
    tiles: laidOut
      .leaves()
      .flatMap((leaf) =>
        leaf.data.entry
          ? [{ entry: leaf.data.entry, x0: leaf.x0, y0: leaf.y0, x1: leaf.x1, y1: leaf.y1 }]
          : [],
      ),
  };
}

/**
 * Assign a tone to every entry.
 *
 * Three paths, in the order the spec would have you consider them:
 *
 * - `highlight` → the pop-up effect. One or two focus tones over a `c-muted`
 *   backdrop, resolved by the same `popUp` every other GL chart uses, so the
 *   "more than two highlighted" warning is shared rather than re-invented — and
 *   so is the tone assignment: `popUp` hands each focus series the tone it is
 *   owed, which is why nothing here indexes the palette by hand.
 *   This is the spec's default move and the form of its Figure 11.
 * - `group` → one hue per parent block, shared by all of that block's children.
 *   This is *why* two-level treemaps get two widths of paper gutter: the hue says
 *   which sector a tile belongs to and the gutter says where one tile ends, so
 *   colour is not asked to do both jobs.
 * - otherwise → the palette spent in order across tiles, largest first.
 *
 * Past six hues everything goes muted, per Decision Rule 1. On a treemap that
 * ceiling bites early and by design: "composition across many categories" plus
 * "at most six colours" is the spec telling you to reach for the pop-up
 * instead, so the warning says so.
 *
 * `residual` cuts across all three: a leftover bucket is muted whatever path is
 * taken, and it never consumes a hue. That matters more than it sounds — the
 * spec's Figure 4 has eight tiles, two of which are "Everything else" and
 * "Other", and spending the palette on those two is what pushes two real
 * categories over the six-hue ceiling and into the grey.
 */
function assignTones<T>(
  entries: readonly Entry<T>[],
  grouped: boolean,
  highlight: string | readonly string[] | undefined,
  tone: GLToneRef | undefined,
  isResidual: (entry: Entry<T>) => boolean,
): Map<string, { key: string; tone: GLTone }> {
  const assignment = new Map<string, { key: string; tone: GLTone }>();
  const colored = entries.filter((entry) => !isResidual(entry));
  const mute = (entry: Entry<T>) => assignment.set(entry.key, { key: 'muted', tone: muted });

  if (highlight != null) {
    // Residuals are excluded from the split, not just re-muted afterwards:
    // highlighting the leftover bucket is a mistake worth surfacing as "that
    // category was not found" rather than silently honouring.
    const { focus } = popUp(colored, { by: 'name', highlight });
    const focusByName = new Map(
      focus.map(({ key, tone: focusTone }) => [
        key,
        // `toneKey` only has to be stable per tone — it is what `treemapMarks`
        // buckets tiles by — so a caller-supplied triple collapses to one key,
        // exactly as on the `tone` path below.
        { key: typeof focusTone === 'string' ? focusTone : 'tone', tone: resolveTone(focusTone) },
      ]),
    );
    for (const entry of entries) {
      assignment.set(entry.key, focusByName.get(entry.name) ?? { key: 'muted', tone: muted });
    }
    return assignment;
  }

  if (tone != null) {
    const resolved = resolveTone(tone);
    const key = typeof tone === 'string' ? tone : 'tone';
    for (const entry of entries) {
      if (isResidual(entry)) mute(entry);
      else assignment.set(entry.key, { key, tone: resolved });
    }
    return assignment;
  }

  for (const entry of entries) if (isResidual(entry)) mute(entry);

  const order = grouped
    ? [...new Set(colored.map((e) => e.group))]
    : [...new Set(colored.map((e) => e.name))];

  if (order.length > paletteOrder.length) {
    warn(
      `A treemap spends the palette in order and it runs out after ${paletteOrder.length} ` +
        `${grouped ? 'groups' : 'categories'}; ${order.length} were given, so the rest are muted. ` +
        'A treemap of many uneven shares is the case the pop-up effect exists for — ' +
        'pass `highlight` and let one tile carry the finding.',
    );
  }

  const toneOf = new Map(
    order.map((name, i) => [
      name,
      i < paletteOrder.length
        ? { key: paletteOrder[i] as string, tone: toneAt(i) }
        : { key: 'muted', tone: muted },
    ]),
  );

  for (const entry of colored) {
    assignment.set(entry.key, toneOf.get(grouped ? entry.group : entry.name)!);
  }
  return assignment;
}

// ── Formatting ──────────────────────────────────────────────────────────────

/**
 * Default value format. Grouped thousands, at most one decimal, pinned to
 * `en-US` so a render is byte-identical wherever it runs — the gallery diffs
 * plates, and a locale-dependent separator would show up as a change.
 *
 * Units belong in the subtitle, not on every tile, so this adds none. Pass
 * `valueFormat` when the unit has to travel with the number.
 */
const defaultValueFormat = (value: number): string =>
  value.toLocaleString('en-US', { maximumFractionDigits: 1 });

/**
 * Default share format. Below half a percent, "<1%" rather than "0%" — a tile
 * that rounds to zero is still visibly there, and "0%" reads as a data error.
 */
const defaultShareFormat = (share: number): string =>
  share < 0.005 ? '<1%' : `${Math.round(share * 100)}%`;

/**
 * The pixel space the tiles live in.
 *
 * The layout already ran at the chart's resolved size, so the domain IS the
 * plot: `[0, width]` across and `[height, 0]` down. The reversed y domain is
 * what turns d3's top-down rectangles the right way up — the same move
 * TanStack's own treemap example makes (`scaleLinear().domain([100, 0])`), and
 * better than flipping the rectangles themselves, because the fit test, the
 * label offsets and the layout then all read in one direction.
 *
 * The domain is pinned by passing a *configured scale instance* rather than the
 * `scaleLinear` factory. TanStack treats a factory as an instruction to infer
 * the domain from the mark channels, and only an instance keeps the domain it
 * was given. Inference would land close to this anyway, but not exactly: with a
 * gutter the outermost tiles stop short of the plot edge, so an inferred domain
 * would quietly scale the whole treemap back up and eat the gutter it just cut.
 *
 * `axis: false` and the spec-level `guides: false` are both set. `guides` is
 * the one that matters ("omit all Cartesian axes and grids"); `axis: false`
 * keeps the scale while dropping the visible axis, so the chart still renders
 * correctly if a pre-alpha bump changes what `guides` covers.
 */
function pixelAxis(extent: number, descending: boolean): ChartAxisOptions<number> {
  return {
    scale: scaleLinear().domain(descending ? [extent, 0] : [0, extent]),
    nice: false,
    grid: false,
    axis: false,
  };
}

// ── Marks ───────────────────────────────────────────────────────────────────

/**
 * Build the mark stack: tiles, then block borders, then labels.
 *
 * Tiles are grouped by tone into one mark per tone — at most seven — rather
 * than one mark per tile. `RectOptions.fill` is a plain string, not a channel,
 * so per-tile paint has to come either from splitting the marks or from routing
 * a `color` channel through a chart-level colour scale. Splitting is the same
 * shape `glBarChart` uses for its backdrop-and-focus split, and it keeps the
 * definition free of a colour scale that exists only to re-state constants.
 *
 * Order is paint order. Tiles never overlap so their order among themselves is
 * cosmetic, but the borders must land on top of the tiles they enclose and the
 * labels on top of everything.
 */
function treemapMarks<T>(rows: readonly TreemapRow<T>[]): unknown[] {
  const marks: unknown[] = [];

  const byTone = new Map<string, TreemapRow<T>[]>();
  for (const row of rows) {
    const bucket = byTone.get(row.toneKey);
    if (bucket) bucket.push(row);
    else byTone.set(row.toneKey, [row]);
  }

  // Muted first, so the pop-up's backdrop is laid down before its focus tiles —
  // the same ordering `glBarChart` uses, and the one that reads correctly if a
  // future change ever lets tiles overlap.
  const toneKeys = [...byTone.keys()].sort((a, b) =>
    a === 'muted' ? -1 : b === 'muted' ? 1 : 0,
  );

  for (const toneKey of toneKeys) {
    const bucket = byTone.get(toneKey)!;
    marks.push(
      glTile(bucket, {
        x1: 'x0',
        x2: 'x1',
        y1: 'y0',
        y2: 'y1',
        key: 'key',
        fill: bucket[0].fill,
        // No stroke, at either depth. The separation between tiles is a gutter
        // the layout already cut (`paddingInner`), so these rectangles are
        // painted exactly as they arrive.
      }),
    );
  }

  const named = rows.filter((r) => r.fit !== 'none');
  const detailed = rows.filter((r) => r.fit === 'full' || r.fit === 'value');

  if (named.length) {
    marks.push(
      glLabel(named, {
        // Top-left corner of the tile. y0 is its top: the layout measures y
        // downward and the y scale's domain is reversed to match, so the
        // smaller y is the higher edge.
        x: 'x0',
        y: 'y0',
        text: 'name',
        // Per-tile ink. `TextOptions.fill` is a visual channel — unlike
        // `RectOptions.fill` — so unlike the tiles this needs no mark split.
        fill: (d: TreemapRow<T>) => d.labelInk,
        anchor: 'start',
        dx: LABEL_PAD,
        dy: NAME_DY,
      }),
    );
  }

  if (detailed.length) {
    // The detail line is weight 400 against the name's 600. `glLabel` pins 600
    // because it exists for series labels, so the secondary line comes from
    // `glAnnotation`, which is the 12/400 role.
    marks.push(
      glAnnotation(detailed, {
        x: 'x0',
        y: 'y0',
        text: 'detail',
        fill: (d: TreemapRow<T>) => d.labelInk,
        anchor: 'start',
        dx: LABEL_PAD,
        dy: DETAIL_DY,
      }),
    );
  }

  return marks;
}

// ── Preset ──────────────────────────────────────────────────────────────────

export interface GLTreemapChartOptions<T> {
  /** The tile's name — the first label line, and what `highlight` matches. */
  category: GLChannel<T>;
  /** Tile area. Non-positive values have no area to draw and are dropped. */
  value: GLChannel<T>;
  /**
   * Parent group. Supplying it makes the treemap two-level: children are tiled
   * inside their parent's rectangle, and the two tiers are separated by two
   * widths of PAPER GUTTER — `geometry.treemapGutter` between siblings,
   * `geometry.treemapBlockGutter` (double) between blocks. No strokes and no
   * parent border at either depth; the boundary is drawn in negative space.
   */
  group?: GLChannel<T>;
  /**
   * Categories to paint in a saturated hue over a `c-muted` backdrop. One or
   * two. This is the spec's default move on a treemap, not a variant of it —
   * Figure 11 is a pop-up treemap where only the focus tile carries colour.
   *
   * Matches the CATEGORY, never the group, so that it behaves exactly as it
   * does on `glBarChart`. To pop a whole sector out of a two-level treemap,
   * make the sector the `category` of a flat one — that chart is a composition
   * of sectors, and drawing it as such is more honest than lighting up a block.
   */
  highlight?: string | readonly string[];
  /**
   * Paint every tile one hue instead of spending the palette. Only sensible on
   * a two-level treemap, where the paper separators carry the structure that
   * colour would otherwise have to; on a flat treemap it warns, because tiles
   * abut directly and one hue renders as one shape.
   *
   * Ignored when `highlight` is set — the pop-up effect owns the palette.
   */
  tone?: GLToneRef;
  /**
   * Categories that are the leftover bucket rather than a finding — "Everything
   * else", "Other", "Rest of world".
   *
   * They take `c-muted` and never consume a palette hue. A residual is not a
   * category competing for attention; it is the part of the whole that is not
   * being talked about. Letting it take `c-4` also costs a real category its
   * colour — exactly what happens in the spec's Figure 4, whose eight tiles
   * include two leftover buckets, so without this two real products get muted
   * while "Other" gets a hue.
   *
   * It does NOT change the layout order. The plate puts "Everything else" in
   * the far column despite it being the fourth-largest tile; that is hand
   * placement, and reproducing it by sorting residuals last hands squarify a
   * non-descending list and visibly degrades every tile around it.
   *
   * Matched against the CATEGORY, exactly like `highlight`.
   */
  residual?: string | readonly string[];
  /** Formats the value in the `value · share` line. */
  valueFormat?: (value: number) => string;
  /** Formats the share (0–1) in the `value · share` line. */
  shareFormat?: (share: number) => string;
  /** Draw in-tile labels at all. On by default. */
  labels?: boolean;
  /**
   * The tiling function `d3.treemap()` divides each rectangle with. Defaults to
   * `treemapSquarify`, which is the spec's shape: tiles near-square, so area is
   * comparable by eye rather than confounded with aspect ratio.
   *
   * Swap it in one line when the chart needs something squarify cannot give:
   *
   * ```ts
   * import { treemapResquarify } from 'd3-hierarchy';
   * glTreemapChart(rows, { …, tile: treemapResquarify }); // stable across resize
   * ```
   *
   * `treemapResquarify` is the one worth knowing about: because the layout here
   * re-runs at every resolved pixel size (see below), a squarified treemap
   * reshuffles its tiles as the container changes width, and resquarify keeps
   * them put. `treemapSliceDice` preserves the input order outright, at the cost
   * of the aspect ratio squarification exists to protect — reach for it only when
   * order is the finding.
   *
   * This is the same convention `geo.ts` uses for the map projection: the
   * package takes the d3-shaped decision as an argument instead of hard-coding
   * one, because it is editorial and no default is right for every figure.
   * Everything else about the layout — pixel sizing, the two-tier gutter, the
   * descending sort — is unaffected by the choice.
   */
  tile?: GLTreemapTiling;
}

/**
 * Treemap — composition of a whole across many categories with very uneven
 * shares.
 *
 * Tiles are main-tone fills at full opacity with no stroke (see the module
 * header for why the PDF's treemap page disagrees and loses). Labels are the
 * category name over `value · share`, and a label that will not fit inside its
 * tile at the 12px floor is dropped — never shrunk, never drawn over the
 * neighbour.
 *
 * With `highlight`, this is the spec's Figure 11: everything `c-muted`, the
 * category carrying the finding in `c-1`.
 *
 * The definition is DYNAMIC — `glChart` is handed a `(ctx) => spec` build
 * function rather than a spec object, and passes it through to `defineChart` in
 * that form. That is the only way to see the rendered size, and the rendered size
 * is the whole label question: the same treemap at 596px labels eight tiles and
 * at 300px labels three. One consequence worth knowing: the pre-mount prerender
 * pass uses TanStack's 640x320 placeholder, so the first paint can label a
 * slightly different set of tiles than the mounted chart.
 *
 * **`variant: { treemap: true }`, and nothing else.** The class is set here
 * rather than at the call site because it is not a per-figure decision — every
 * treemap needs it. Flat tiles abut with no stroke, which leaves faint
 * antialiased seams where two tiles share an edge, and `shape-rendering:
 * crispEdges` snaps those edges onto the pixel grid. `labelHalo` is deliberately
 * NOT set: a tile label sits on one known flat fill and takes its ink from that
 * fill's luminance (`glLabelInkOn`), so there is no unpredictable background for a
 * halo to rescue it from — and a paper stroke around `ink` text on `c-muted`
 * would read as an outline fighting the flat tile. See the module header, §3.
 */
export function glTreemapChart<T>(
  data: readonly T[],
  o: GLTreemapChartOptions<T>,
): GLChart<T, number, number> {
  const rows = [...data];
  const readCategory = channel(o.category);
  const readValue = channel(o.value);
  const readGroup = o.group ? channel(o.group) : undefined;
  const grouped = readGroup != null;

  const entries: Entry<T>[] = [];
  let dropped = 0;
  rows.forEach((datum, index) => {
    const value = Number(readValue(datum, index, rows));
    if (!Number.isFinite(value) || value <= 0) {
      dropped += 1;
      return;
    }
    const name = String(readCategory(datum, index, rows));
    entries.push({
      datum,
      // Names can repeat across groups, and two tiles with the same key make
      // TanStack reconcile them as one mark. The index makes it unique.
      key: `${index} ${name}`,
      name,
      group: grouped ? String(readGroup(datum, index, rows)) : '',
      value,
    });
  });

  if (dropped > 0) {
    warn(
      `${dropped} row${dropped === 1 ? '' : 's'} had a zero, negative or non-numeric value ` +
        'and were dropped: a treemap encodes magnitude as area, and there is no area to ' +
        'draw. If the negative values are the finding, a bar chart is the chart type.',
    );
  }

  const residualNames = new Set(
    o.residual == null ? [] : typeof o.residual === 'string' ? [o.residual] : o.residual,
  );
  const isResidual = (entry: Entry<T>) => residualNames.has(entry.name);

  const total = entries.reduce((sum, e) => sum + e.value, 0);
  const tones = assignTones(entries, grouped, o.highlight, o.tone, isResidual);

  const valueFormat = o.valueFormat ?? defaultValueFormat;
  const shareFormat = o.shareFormat ?? defaultShareFormat;
  const wantsLabels = o.labels ?? true;
  // Squarified unless the caller says otherwise. Resolved once, outside the
  // build closure, so a resize does not re-read the option.
  const tiling = o.tile ?? treemapSquarify;

  // The `(ctx) => spec` form, and the one chart in the library that needs it.
  //
  // The variant goes in the SECOND argument, not in the returned spec. `glChart`
  // hands back `className` synchronously, but the spec here does not exist until
  // TanStack resolves a size — so a `variant` inside the closure would be read
  // after the class was already built, and the treemap would silently render
  // without `gl-chart--treemap`. `glChart` warns if you get this wrong.
  //
  // `<T, number, number>`: both scales are pixel positions in the plot, so they
  // are genuinely numeric.
  return glChart<T, number, number>(({ width, height }) => {
    // The layout runs HERE, not once outside, because it needs the resolved
    // size to tile against the real aspect ratio and to cut the gutter in
    // real pixels. That makes it re-run on resize, which is the cost of tiles
    // that are square on screen rather than square in an abstract unit box.
    const layout = layOut(entries, grouped, width, height, isResidual, tiling);

    const built: TreemapRow<T>[] = layout.tiles.map((tile) => {
      const entry = tile.entry;
      const assigned = tones.get(entry.key)!;
      const value = valueFormat(entry.value);
      const full = `${value} · ${shareFormat(entry.value / total)}`;

      // The tile is already in pixels, and already gutter-inset — so this
      // measures the rectangle the reader actually sees.
      const widthPx = tile.x1 - tile.x0;
      const heightPx = tile.y1 - tile.y0;
      const room = widthPx - 2 * LABEL_PAD;

      const nameFits = room >= estimateTextWidth(entry.name, NAME_WEIGHT);
      const fullFits = room >= estimateTextWidth(full, DETAIL_WEIGHT);
      const valueFits = room >= estimateTextWidth(value, DETAIL_WEIGHT);

      // Shorten, then drop. The floor rule is about never taking type below
      // 12px, not about a label being whole or absent — and the plates agree:
      // Figure 4's two smallest tiles carry a bare `0.7B` and `0.5B` rather
      // than going anonymous. A tile that can hold its name but not its
      // numbers is better named than unlabelled.
      const fit: LabelFit = !wantsLabels
        ? 'none'
        : !nameFits || heightPx < ONE_LINE_HEIGHT
          ? 'none'
          : heightPx < TWO_LINE_HEIGHT
            ? 'name'
            : fullFits
              ? 'full'
              : valueFits
                ? 'value'
                : 'name';

      return {
        datum: entry.datum,
        key: entry.key,
        name: entry.name,
        group: entry.group,
        value: entry.value,
        detail: fit === 'value' ? value : full,
        x0: tile.x0,
        x1: tile.x1,
        y0: tile.y0,
        y1: tile.y1,
        toneKey: assigned.key,
        fill: assigned.tone.main,
        labelInk: glLabelInkOn(assigned.tone.main),
        fit,
      };
    });

    return {
      marks: treemapMarks(built),
      x: pixelAxis(width, false),
      // Reversed: d3 measures y downward from the top, and turning it over in
      // the scale keeps the layout, the fit test and the label offsets all
      // reading the same direction.
      y: pixelAxis(height, true),
      // Omit all Cartesian axes and grids: a treemap's plot space is a
      // placement device, and drawing pixel counts down the side of it would
      // be labelling the device rather than the data.
      guides: false,
      // Locked to zero on all four sides, which pins the plot area to the
      // chart size the build function was handed. Any automatic margin would
      // silently invalidate both the layout and every fit decision above.
      // Stated side by side rather than as `margin: 0` so that `glChart`'s
      // merge over `glMargin` cannot leave a side unzeroed.
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    };
    // crispEdges on the abutting tiles — see the doc comment above for why this
    // is the treemap's own decision and not the call site's.
  }, { variant: { treemap: true } });
}
