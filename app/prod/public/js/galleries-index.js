// /public/js/galleries-index.js
(async () => {
  const slots = document.querySelectorAll('.gallery-card .thumb[data-slug]');
  await Promise.all([...slots].map(async (el) => {
    const slug = el.getAttribute('data-slug');
    const coverUrl = `/assets/${slug}/_cover.webp`;
    const idxUrl   = `/assets/${slug}/index.json`;

    const render = (src) => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.decoding = 'async';
      img.loading = 'lazy';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      el.replaceChildren(img);
    };

    // 1) Versuche _cover.webp
    const probe = new Image();
    const ok = await new Promise((resolve) => {
      probe.onload = () => resolve(true);
      probe.onerror = () => resolve(false);
      probe.src = coverUrl;
    });
    if (ok) { render(coverUrl); return; }

    // 2) Fallback: erstes Asset aus index.json
    try {
      const r = await fetch(idxUrl, { cache: 'no-store' });
      if (!r.ok) throw 0;
      const j = await r.json();
      const first = j?.items?.[0];
      if (first) render(first.thumb || first.src);
    } catch { /* Platzhalter behalten */ }
  }));
})();
