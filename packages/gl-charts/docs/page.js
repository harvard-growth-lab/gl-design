/**
 * page.js — the only behaviour the reference has: find a symbol, know where you
 * are.
 *
 * Inlined by `build-docs.mjs`, so it is plain ES2022 with no imports and no
 * build step of its own. Two hundred symbols is past the point where scrolling
 * finds anything, and it is well short of the point where a search index earns
 * its weight — a substring match over the nav links is the whole feature.
 */

(() => {
  const filter = document.getElementById('filter');
  const nav = document.getElementById('nav');
  const links = [...nav.querySelectorAll('a[data-name]')];
  const groups = [...nav.querySelectorAll('details')];

  // ── Filter ────────────────────────────────────────────────────────────────

  const apply = () => {
    const q = filter.value.trim().toLowerCase();
    for (const a of links) {
      a.classList.toggle('hidden', q !== '' && !a.dataset.name.toLowerCase().includes(q));
    }
    for (const g of groups) {
      const hit = g.querySelector('a:not(.hidden)');
      g.classList.toggle('empty', !hit);
      // A search should show its results, but closing the groups again on an
      // empty query would undo a reader's own expansion — so only the search
      // opens them.
      if (q) g.open = true;
    }
  };

  filter.addEventListener('input', apply);
  filter.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      filter.value = '';
      apply();
    }
    if (e.key === 'Enter') {
      const first = links.find((a) => !a.classList.contains('hidden'));
      if (first) first.click();
    }
  });

  // `/` is the one shortcut worth having, and only when the reader is not
  // already typing somewhere.
  addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== filter && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      filter.focus();
      filter.select();
    }
  });

  // ── Current symbol ────────────────────────────────────────────────────────
  //
  // IntersectionObserver rather than a scroll handler: the cards are of wildly
  // different heights, and the observer reports the ones actually on screen
  // without measuring anything on every frame.

  const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const visible = new Set();
  let current = null;

  const mark = () => {
    if (!visible.size) return;
    // Topmost visible card wins, so the highlight tracks reading position
    // rather than whichever card happened to fire last.
    const top = [...visible].sort((a, b) => a.top - b.top)[0];
    const link = byId.get(top.id);
    if (!link || link === current) return;
    current?.classList.remove('on');
    link.classList.add('on');
    current = link;
    // Only scroll the sidebar when the entry has actually left it; nudging it on
    // every card makes the list feel like it is fighting the reader.
    const box = link.getBoundingClientRect();
    if (box.top < 60 || box.bottom > innerHeight - 40) {
      link.scrollIntoView({ block: 'center' });
    }
  };

  const observer = new IntersectionObserver(
    (records) => {
      for (const r of records) {
        const entry = { id: r.target.id, top: r.boundingClientRect.top };
        for (const v of visible) if (v.id === entry.id) visible.delete(v);
        if (r.isIntersecting) visible.add(entry);
      }
      mark();
    },
    { rootMargin: '-10% 0px -70% 0px' },
  );

  for (const card of document.querySelectorAll('article.sym[id]')) observer.observe(card);
})();
