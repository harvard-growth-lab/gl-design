/**
 * The GL figure block.
 *
 * The spec treats a chart as five elements, not one: figure label, title,
 * subtitle, the plot, and the source line. Only the plot is a TanStack chart —
 * the other four are chrome that TanStack has no opinion about and no place to
 * put. So the figure block is the wrapper, and `<Chart>` goes inside it.
 *
 * This is also where the serif/sans split lives: the title and the source are
 * Source Serif 4, everything else is Inter. Nothing else in the figure is serif.
 */

import type { ReactNode } from 'react';

import { warn } from './dev.js';
import { geometry, ink, opacity } from './tokens.js';
import { resolveTone, type GLToneRef, type GLToneStep } from './tone.js';

export interface GLFigureProps {
  /** Figure number. Rendered as "FIGURE 4". Figures are numbered sequentially. */
  number?: number | string;
  /**
   * The finding. Always ends in a period — it reads as a statement, not a
   * label. "Copper exporters cluster by complexity, not size."
   */
  title: string;
  /**
   * Units, time period, and unit of analysis. Omit when it would only restate
   * the title.
   */
  subtitle?: string;
  /**
   * Provenance. Required by the spec on every figure — there is no
   * source-less chart.
   */
  source: string;
  /** The plot. Normally a TanStack `<Chart>`. */
  children: ReactNode;
  /**
   * The legend, normally a `<GLLegend>`. Pass it HERE rather than as a child:
   * §3.11 makes placement a property of the system, not of the call site, and
   * a legend dropped into `children` lands wherever the caller happened to put
   * it in the JSX — which is how this package ended up with legends above some
   * plots, below others and beside a third set.
   */
  legend?: ReactNode;
  /**
   * Where the legend goes (§3.11).
   *
   *   `below`  the default — centred under the plot, one horizontal row
   *   `right`  beside the plot, stacked vertically. For STACKED BANDS only,
   *            where the legend's top-to-bottom order mirrors the stack's, and
   *            for a radial chart that cannot take direct slice labels
   *
   * There is no `above`: a legend between the subtitle and the data reads as
   * part of the sentence.
   */
  legendPlacement?: 'below' | 'right';
  className?: string;
}

/** Dev-only nudges for the two rules a type can't express. */
function audit({ title, source }: Pick<GLFigureProps, 'title' | 'source'>) {
  if (title && !/[.?!]["')\]]?$/.test(title.trim())) {
    warn(
      `Chart title should end with a period — it reads as a finding, ` +
        `not a label (Decision Rule 10). Got: ${JSON.stringify(title)}`,
    );
  }
  if (!source || !source.trim()) {
    warn('Every figure requires a source line.');
  }
}

export function GLFigure({
  number,
  title,
  subtitle,
  source,
  children,
  legend,
  legendPlacement = 'below',
  className,
}: GLFigureProps) {
  audit({ title, source });

  const plot = <div className="gl-figure__plot">{children}</div>;

  return (
    <figure className={className ? `gl-figure ${className}` : 'gl-figure'}>
      {number != null && (
        <p className="gl-figure__label">
          {typeof number === 'number' ? `Figure ${number}` : number}
        </p>
      )}
      <h3 className="gl-figure__title">{title}</h3>
      {subtitle && <p className="gl-figure__subtitle">{subtitle}</p>}
      {legend && legendPlacement === 'right' ? (
        <div className="gl-figure__body gl-figure__body--legend-right">
          {plot}
          <div className="gl-figure__legend gl-figure__legend--right">{legend}</div>
        </div>
      ) : (
        <>
          {plot}
          {legend && <div className="gl-figure__legend">{legend}</div>}
        </>
      )}
      <figcaption className="gl-figure__source">{source}</figcaption>
    </figure>
  );
}

// ── Legend ──────────────────────────────────────────────────────────────────

/**
 * What the series is drawn as — which decides what its legend entry is drawn
 * as (§3.11, Decision Rule 11).
 *
 * A legend entry is not a colour swatch. It is a small drawing of the mark it
 * stands for, in the same tone, stroke and weight the plot uses, because that
 * is the only thing that lets a reader match entry to mark without decoding a
 * convention. A filled square standing for a 2px line says "area"; a square
 * standing for a scatter dot drops the stroke §3.4 requires on overlapping
 * circles.
 *
 *   `fill`       bar, stacked band, area, treemap tile, choropleth bin, arc
 *   `point`      scatter point or bubble
 *   `line`       line series
 *   `derived`    moving average, fit, forecast (§3.10) — the same rule, dashed
 *   `band`       band, interval, fan (§3.9) — light fill, NO stroke
 *   `polygon`    radar polygon — translucent main fill AND a main stroke
 *   `reference`  threshold, target, identity line (§3.4.2) — chrome, `ink-3`
 *
 * `band` and `polygon` are separate because §3.4 draws them differently, and a
 * legend that flattens them is the exact failure this type exists to prevent: a
 * band is the light tone at full opacity with **no stroke**, while a radar
 * polygon is the main tone at 0.25 with a full-opacity main stroke. One square
 * cannot be both, and the stroke is what tells the reader which they are
 * looking at.
 */
export type GLLegendMark =
  | 'fill'
  | 'point'
  | 'line'
  | 'derived'
  | 'band'
  | 'polygon'
  | 'reference';

export interface GLLegendItem {
  label: string;
  /** A palette key, `'muted'`, or an explicit tone triple. */
  tone: GLToneRef;
  /**
   * How the series is drawn. Defaults to `fill` — right for the bars, stacks
   * and treemaps that are most of what needs a legend, wrong for everything
   * else, so a line series has to say so.
   */
  mark?: GLLegendMark;
  /**
   * Which step of the triple the mark shows. Defaults to `main`.
   *
   * A stack painted in tones of one hue needs its legend to say which tone is
   * which, so a two-tone stack reads `{ tone: 'c-1' }` and
   * `{ tone: 'c-1', step: 'light' }`. The label text stays in the DARK tone
   * either way — that is Decision Rule 6 and it does not vary with the mark.
   */
  step?: GLToneStep;
  /**
   * This series is the focus series, so its rule takes `lineWidthFocus` — the
   * same 2.4px the plot gives it. On a context-versus-finding pair (§3.10) the
   * weight difference IS the encoding, and a legend that flattens both to one
   * width throws it away.
   */
  focus?: boolean;
  /** The line also carries point markers, so the legend rule carries one too. */
  dot?: boolean;
}

export interface GLLegendProps {
  items: readonly GLLegendItem[];
  /**
   * Stack vertically. Normally left unset: pass the legend to `GLFigure` and
   * let `legendPlacement` decide, so placement stays a system decision (§3.11).
   */
  vertical?: boolean;
  className?: string;
}

const MARK_SIZE = geometry.legendMarkSize;
const RULE_LENGTH = geometry.legendRuleLength;
const MID = MARK_SIZE / 2;

/** The mark, drawn at the size and weight the plot draws it. */
function LegendMark({ item }: { item: GLLegendItem }) {
  const kind = item.mark ?? 'fill';
  const tone = resolveTone(item.tone);
  const fill = tone[item.step ?? 'main'];
  const isRule = kind === 'line' || kind === 'derived' || kind === 'reference';
  const width = isRule ? RULE_LENGTH : MARK_SIZE;

  return (
    <svg
      className="gl-legend__mark"
      width={width}
      height={MARK_SIZE}
      viewBox={`0 0 ${width} ${MARK_SIZE}`}
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'fill' && <rect width={MARK_SIZE} height={MARK_SIZE} fill={fill} />}

      {/* §3.4: a band is the LIGHT tone at full opacity with no stroke. */}
      {kind === 'band' && (
        <rect
          width={MARK_SIZE}
          height={MARK_SIZE}
          fill={tone[item.step ?? 'light']}
        />
      )}

      {/* §3.4: a radar polygon is the MAIN tone at 0.25 under a main stroke. */}
      {kind === 'polygon' && (
        <rect
          x={geometry.legendBandStrokeWidth / 2}
          y={geometry.legendBandStrokeWidth / 2}
          width={MARK_SIZE - geometry.legendBandStrokeWidth}
          height={MARK_SIZE - geometry.legendBandStrokeWidth}
          fill={tone[item.step ?? 'main']}
          fillOpacity={opacity.radarFill}
          stroke={tone[item.step ?? 'main']}
          strokeWidth={geometry.legendBandStrokeWidth}
        />
      )}

      {/* The scatter circle of §3.4: main fill, 1px dark stroke, both at 0.8. */}
      {kind === 'point' && (
        <circle
          cx={MID}
          cy={MID}
          r={MID - geometry.pointStrokeWidth / 2}
          fill={fill}
          stroke={tone.dark}
          strokeWidth={geometry.pointStrokeWidth}
          opacity={opacity.overlap}
        />
      )}

      {isRule && (
        <line
          x1={0}
          y1={MID}
          x2={width}
          y2={MID}
          stroke={kind === 'reference' ? ink[3] : fill}
          strokeWidth={
            kind === 'reference'
              ? geometry.gridlineWidth
              : item.focus
                ? geometry.lineWidthFocus
                : geometry.lineWidth
          }
          {...(kind === 'derived' || kind === 'reference'
            ? { strokeDasharray: geometry.ruleDash }
            : { strokeLinecap: 'round' as const })}
        />
      )}

      {item.dot && (
        <circle
          cx={width / 2}
          cy={MID}
          r={geometry.radarVertexRadius}
          fill={fill}
          stroke={tone.dark}
          strokeWidth={geometry.pointStrokeWidth}
        />
      )}
    </svg>
  );
}

export interface GLRampLegendProps {
  /**
   * The stepped scale the chart paints with. The legend reads its bins and cut
   * points back off it rather than being handed a second copy — a legend that
   * carries its own colours is a legend that can disagree with the plot, which
   * is the bug `glGeoShape` already documents at length.
   */
  scale: {
    (value: number): string;
    thresholds: () => readonly number[];
    domain?: () => readonly number[] | undefined;
  };
  /**
   * The value extent, when the scale cannot report its own. `domain()` is
   * optional on TanStack's configured-scale shape, and without the two ends the
   * bar can only print its interior cut points — which leaves the reader no
   * idea what the palest and darkest steps mean.
   */
  domain?: readonly [number, number];
  /** What the ramp measures. Sentence case, no period. */
  label?: string;
  /**
   * Bound formatter. The default picks its precision from the SPAN, not from
   * each value — a density ramp over `[0, 0.0018]` rounded to integers prints
   * `0 0 0 0 1 1`, which is worse than no legend because it looks like a scale
   * and is not one.
   */
  format?: (value: number) => string;
  /** Bar width in px. 240 matches the choropleth legend of §12. */
  width?: number;
}

/**
 * A stepped ramp with its cut points printed beneath (§3.11, §12).
 *
 * The legend form for a BINNED OR CONTINUOUS encoding — a heatmap, a hexbin, a
 * calendar, a choropleth. A set of categorical swatches is the wrong instrument
 * for these: it can only name the ends ("Lower", "Higher"), which tells the
 * reader the scale has a direction but not where any particular cell falls on
 * it. The bar shows every step the chart can actually paint, and the numbers
 * under it say where each one starts.
 */
/**
 * Enough decimals that adjacent cut points differ, capped at four.
 *
 * A stepped ramp's bounds are evenly spaced, so one precision serves all of
 * them, and the span is what decides it: `[0, 87]` wants integers, `[0, 0.0018]`
 * wants four places. Rounding each value on its own merits would print a ragged
 * column and still collapse the small ones.
 */
function boundFormat(span: number): (value: number) => string {
  if (!(span > 0)) return (v) => String(v);
  // One step of a five-bin ramp is span/5; show two significant digits of it.
  const step = span / 5;
  const places = Math.min(4, Math.max(0, Math.ceil(-Math.log10(step)) + 1));
  return (v) => v.toFixed(places);
}

export function GLRampLegend({
  scale,
  domain,
  label,
  format,
  width = 240,
}: GLRampLegendProps) {
  const thresholds = scale.thresholds();
  const extent = domain ?? scale.domain?.();

  if (!extent || extent.length < 2) {
    warn(
      'GLRampLegend needs the value extent to label its ends: the scale did ' +
        'not report a domain, so pass `domain={[lo, hi]}`. Printing the ' +
        'interior cut points alone leaves the first and last steps unlabelled.',
    );
  }

  const lo = Number(extent?.[0] ?? thresholds[0]);
  const hi = Number(extent?.[extent.length - 1] ?? thresholds[thresholds.length - 1]);
  const bounds = [lo, ...thresholds, hi];
  const print = format ?? boundFormat(hi - lo);
  // Sample each bin at its midpoint: asking the scale for the colour AT a cut
  // point lands on whichever side of the boundary the scale rounds to.
  const bins = bounds
    .slice(0, -1)
    .map((start, i) => scale((Number(start) + Number(bounds[i + 1])) / 2));

  return (
    <div className="gl-ramp-legend" style={{ width }}>
      {label && <p className="gl-ramp-legend__label">{label}</p>}
      <div className="gl-ramp-legend__steps">
        {bins.map((fill, i) => (
          <span key={i} className="gl-ramp-legend__step" style={{ background: fill }} />
        ))}
      </div>
      <div className="gl-ramp-legend__bounds">
        {bounds.map((bound, i) => (
          <span
            key={i}
            className="gl-ramp-legend__bound"
            style={{ left: `${(i / (bounds.length - 1)) * 100}%` }}
          >
            {print(Number(bound))}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Legend marks are miniatures of the marks they name (§3.11); legend text takes
 * the series' DARK tone. The tone rule is Decision Rule 6 and it holds for
 * every series including the muted grey — `c-muted` (#AFB5BE) fails WCAG AA
 * against paper, `c-muted-dark` (#5F6773) clears it.
 *
 * Prefer direct end-labels over a legend where the chart allows it.
 */
export function GLLegend({ items, vertical, className }: GLLegendProps) {
  return (
    <ul
      className={['gl-legend', vertical && 'gl-legend--vertical', className]
        .filter(Boolean)
        .join(' ')}
    >
      {items.map((item) => {
        // A reference rule is chrome and takes no categorical hue (§3.4.2), so
        // its label is ink-2 rather than a series dark tone.
        const color = item.mark === 'reference' ? ink[2] : resolveTone(item.tone).dark;
        return (
          <li className="gl-legend__item" key={item.label}>
            <LegendMark item={item} />
            <span className="gl-legend__label" style={{ color }}>
              {item.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
