/**
 * What a demo is.
 *
 * The examples page is a roster of small, complete, self-contained charts, every
 * one of them drawn from real Atlas of Economic Complexity data.
 *
 * ## Authored here, not all of it printed
 *
 * A demo records more than the page shows. `rule` and `gaps` are working notes —
 * which clause of `grammar.md` the chart applies, and where the library or the
 * data falls short — and the examples page prints neither: it is the artifact
 * that gets handed to people outside the project, and it shows charts. The notes
 * are still worth carrying, because they are what a reviewer reads beside
 * `gallery/specimens-meta.mjs` and what the gallery report prints in full.
 *
 * ## A demo is a specimen with the data swapped
 *
 * The `id` of every demo matches a specimen in `gallery/specimens-meta.mjs`.
 * That is the point of the exercise and it is worth being explicit about: the
 * gallery proves each chart type can be drawn on-spec from synthetic data shaped
 * to be awkward; this page proves the same chart type survives contact with a
 * real dataset that was not designed to flatter it. When the two disagree — a
 * label collides, a stack has nine categories instead of five, a distribution is
 * far more skewed than the synthetic one — the real data is right and the
 * shortfall is a `gap`.
 *
 * ## The contract, which is the gallery's contract
 *
 * **No demo may style a chart by hand.** No hex, no font size, no stroke width,
 * no opacity. Every value on screen comes from `tokens.json` by way of a `gl*`
 * mark, an axis preset, or a compose helper. A demo that reaches for a style
 * attribute to look right has disproved the thing this page exists to show.
 *
 * What a demo *does* author is data preparation — pivoting a panel into a stack,
 * ranking a year, binning a distribution, rebasing an index. That decides where
 * a mark goes and never what it looks like, and unlike the gallery it is the
 * interesting half here: the reader is looking at the code precisely to see how
 * an Atlas table becomes a chart.
 *
 * ## The roster markers
 *
 * Every demo's body sits between
 *
 *     // #region demo:<id>
 *     ...
 *     // #endregion
 *
 * markers in its family file. `build.mjs` reads them to build the roster of ids
 * that `check.mjs` holds the mounted page against — a `.mjs` script cannot
 * import the `.tsx` families, and a demo that quietly stopped rendering would
 * otherwise be invisible on a page a hundred charts long.
 */

import type { ReactNode } from 'react';

export interface Demo {
  /** Matches the specimen id in `gallery/specimens-meta.mjs`. */
  id: string;

  /** Family heading, used for the sidebar grouping. */
  family: string;

  /**
   * The chart's name in the roster — "Stacked area", "Bump ranking". This is the
   * navigation label, so it names the *form*, not the finding.
   */
  name: string;

  /**
   * The Atlas question this demo answers, in one line. "Which sectors did
   * Vietnam's exports shift between?" This is what makes the page readable as a
   * document rather than a type specimen: the form is the answer to a question,
   * and the question is worth stating.
   */
  question: string;

  /**
   * The rule from `grammar.md` the chart is applying, carried over from the
   * specimen. A working note: it records *why* the chart looks the way it does,
   * and is not printed on the page.
   */
  rule?: string;

  /** The chart. A `GLFigure` wrapping a TanStack `<Chart>`, normally. */
  render: () => ReactNode;

  /**
   * Where the library or the data falls short, recorded rather than worked
   * around — a working note like `rule`, not printed on the page. Two kinds
   * show up:
   *
   * - **Library gaps**, inherited from the specimen — a mark gl-charts cannot
   *   express, a rule `grammar.md` has not made.
   * - **Data gaps**, new here — a form the Atlas cannot honestly fill. A
   *   candlestick needs open/high/low/close and the Atlas is annual; a calendar
   *   heatmap needs daily observations and the Atlas has none. Where that
   *   happens the demo draws the nearest *honest* Atlas framing and says so.
   *   It never fabricates a column to complete a shape.
   */
  gaps?: readonly string[];
}

/** A family of demos, in roster order. */
export interface Family {
  /** Stable slug, used for the anchor and the sidebar. */
  slug: string;
  /** Display heading, matching the specimen roster's family names. */
  title: string;
  /** What this family of charts is for — one or two sentences, shown once. */
  blurb: string;
  demos: readonly Demo[];
}
