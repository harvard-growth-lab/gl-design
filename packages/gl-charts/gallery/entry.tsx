/**
 * Browser entry for the gallery page.
 *
 * The plates are mounted in a real browser rather than server-rendered, because
 * axis layout in TanStack depends on measured text — server-side SVG would size
 * the axis gutters off a metrics stub and quietly diverge from what a user sees.
 * Rendering in Chrome with the real Source Serif 4 / Inter is the only way the
 * diff means anything.
 *
 * Which is why `fonts.css` is imported here and not left to the machine. This
 * page used to rely on the faces `scripts/install-fonts.sh` puts in the user
 * font directory, but that script installs the VARIABLE files, which register
 * as `Inter Variable` and `Source Serif 4 Variable` — while the tokens ask for
 * `Inter` and `Source Serif 4`. The names never matched, so every plate rendered
 * in Georgia and San Francisco, and TanStack sized every axis gutter against
 * them. Inlining the faces makes the page independent of what is installed.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../src/fonts.css';
import '../src/theme.css';
import './gallery.css';

import { PLATE_WIDTH, gallery } from './catalog.js';
import { SPECIMEN_WIDTH, specimens } from './specimens.js';

function Plate({
  id,
  width,
  render,
}: {
  id: string;
  width: number;
  render: () => React.ReactNode;
}) {
  return (
    <div className="gl-plate" data-plate={id} style={{ width }}>
      {render()}
    </div>
  );
}

/**
 * Plates and specimens mount into the same page under the same `data-plate`
 * attribute, which is what makes `audit.mjs` measure both without knowing the
 * difference. That is the point of the specimen track: a chart type with no
 * reference figure still gets held to the tokens.
 */
function App() {
  return (
    <>
      {gallery
        .filter((p) => p.render)
        .map((p) => (
          <Plate key={p.id} id={p.id} width={PLATE_WIDTH} render={p.render!} />
        ))}
      {specimens
        .filter((s) => s.render)
        .map((s) => (
          <Plate key={s.id} id={s.id} width={SPECIMEN_WIDTH} render={s.render!} />
        ))}
    </>
  );
}

const root = document.getElementById('root')!;
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// The screenshot driver waits on this: React has committed, web fonts have
// loaded, and the browser has painted at least once with them.
Promise.all([document.fonts.ready, new Promise((r) => requestAnimationFrame(() => r(null)))]).then(
  () => {
    requestAnimationFrame(() => {
      document.documentElement.dataset.galleryReady = 'true';
    });
  },
);
