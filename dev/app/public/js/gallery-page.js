(function () {
  function init() {
    const root = document.getElementById('gallery');
    if (!root) return;
    const slug = root.dataset.slug;
    if (!slug) { root.textContent = 'Kein Album-Slug.'; return; }

    const url = `/assets/${slug}/index.json`;
    fetch(url, { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(({ assets = [] }) => {
        if (!assets.length) { root.textContent = 'Keine Bilder gefunden.'; return; }
        for (const a of assets) {
          const fig = document.createElement('figure');
          fig.style.cssText = 'aspect-ratio:4/3;border-radius:12px;overflow:hidden;background:#111;margin:0';
          const img = document.createElement('img');
          img.src = a.thumb || a.src;
          img.alt = a.filename || '';
          img.loading = 'lazy';
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
          fig.appendChild(img);
          root.appendChild(fig);
        }
      })
      .catch(e => { console.error(e); root.textContent = 'Fehler beim Laden der Galerie.'; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
