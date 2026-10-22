/**
 * The examples page.
 *
 * A roster you can scan on the left, and on the right the charts themselves —
 * nothing between the reader and the plot. This page is the one that gets handed
 * to people outside the project, so it carries no working notes: no source
 * panels, no §-citations, no library gaps, no coverage badges. Those live in the
 * gallery report and in `gallery/specimens-meta.mjs`, which is where the people
 * who need them already look.
 *
 * ## Why the charts are live rather than screenshots
 *
 * `gallery/render.mjs` screenshots its plates because it is comparing them to a
 * raster crop of a PDF. This page has nothing to compare against; its job is to
 * be a thing you can read and check. A live mount also means the axis gutters on
 * screen are the ones TanStack computed from *measured* text in the reader's own
 * browser, which is the only version that is true for them.
 *
 * ## What is interactive here, and what deliberately is not
 *
 * The page chrome is interactive: navigation. **The charts are not.** TanStack
 * 0.6.5 ships no interaction API, and more to the point `grammar.md` does not
 * rule on interaction at all — no hover state, no tooltip type scale, no focus
 * ring. The sixteen Interaction demos therefore render their *resting state*,
 * exactly as the specimens do, using only marks §3.4.2 already decides.
 * Inventing a hover style to make this page feel modern would be inventing spec,
 * which is the one thing neither this page nor the gallery is allowed to do.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../src/theme.css';
import './examples.css';

import { FAMILIES } from './demos.js';
import { LATEST_YEAR, RELEASE, leadCountry } from './atlas-data.js';
import type { Demo } from './demo.js';

/** Every demo, flattened, for the count in the masthead. */
const ALL = FAMILIES.flatMap((f) => f.demos);

// ── One demo ────────────────────────────────────────────────────────────────

/**
 * The card is a frame and a caption, and nothing else.
 *
 * `data-plate` stays even though nothing on the page reads it: `gallery/audit.mjs`
 * and `examples/check.mjs` walk that attribute to find the figures they measure
 * against the tokens.
 */
function DemoCard({ demo }: { demo: Demo }) {
  return (
    <article className="ex-demo" id={demo.id} data-plate={demo.id}>
      <header className="ex-demo__head">
        <h3 className="ex-demo__name">{demo.name}</h3>
        <p className="ex-demo__question">{demo.question}</p>
      </header>

      <div className="ex-demo__plot">{demo.render()}</div>
    </article>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

function Sidebar() {
  return (
    <nav className="ex-nav" aria-label="Examples">
      <a className="ex-nav__home" href="#top">
        gl-charts <span>&middot;</span> Atlas examples
      </a>
      {FAMILIES.map((family) => (
        <section className="ex-nav__family" key={family.slug}>
          <h2 className="ex-nav__heading">
            <a href={`#${family.slug}`}>{family.title}</a>
            <span className="ex-nav__count">{family.demos.length}</span>
          </h2>
          <ul className="ex-nav__list">
            {family.demos.map((demo) => (
              <li key={demo.id}>
                <a href={`#${demo.id}`}>{demo.name}</a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}

function Masthead() {
  return (
    <header className="ex-masthead" id="top">
      <p className="ex-masthead__eyebrow">Growth Lab design system</p>
      <h1 className="ex-masthead__title">
        {ALL.length} charts, drawn from Atlas data.
      </h1>
      <p className="ex-masthead__lede">
        Every one is built to the Growth Lab data visualization specification and drawn from
        the Atlas of Economic Complexity — no synthetic data anywhere on this page.
      </p>
      <dl className="ex-masthead__facts">
        <div>
          <dt>Release</dt>
          <dd>{RELEASE.releaseId}</dd>
        </div>
        <div>
          <dt>Lead economy</dt>
          <dd>
            {leadCountry.name} through {LATEST_YEAR}
          </dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>
            <span className="ex-doi">{RELEASE.doi}</span>
          </dd>
        </div>
      </dl>
    </header>
  );
}

function App() {
  return (
    <div className="ex-shell">
      <Sidebar />
      <main className="ex-main">
        <Masthead />
        {FAMILIES.map((family) => (
          <section className="ex-family" id={family.slug} key={family.slug}>
            <div className="ex-family__head">
              <h2 className="ex-family__title">{family.title}</h2>
              <p className="ex-family__blurb">{family.blurb}</p>
            </div>
            {family.demos.map((demo) => (
              <DemoCard demo={demo} key={demo.id} />
            ))}
          </section>
        ))}
        <footer className="ex-footer">
          <p>
            Data from the Atlas of Economic Complexity, Growth Lab at Harvard University,
            release {RELEASE.releaseId} ({RELEASE.doi}). Country outlines from Natural Earth
            (public domain).
          </p>
        </footer>
      </main>
    </div>
  );
}

const root = document.getElementById('root')!;
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// The render driver waits on this, same signal the gallery uses: React has
// committed, web fonts have loaded, and the browser has painted with them.
Promise.all([document.fonts.ready, new Promise((r) => requestAnimationFrame(() => r(null)))]).then(
  () => {
    requestAnimationFrame(() => {
      document.documentElement.dataset.examplesReady = 'true';
    });
  },
);
