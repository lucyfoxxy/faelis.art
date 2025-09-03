(function () {
  function init() {
    document.querySelectorAll('.thumb[data-slug]').forEach(async (el) => {
      const slug = el.getAttribute('data-slug');
      try {
        const r = await fetch(`/assets/${slug}/index.json`, { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        const first = j.assets && j.assets[0];
        if (first) {
          const img = document.createElement('img');
          img.src = first.thumb || first.src;
          img.loading = 'lazy';
          img.alt = '';
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
          el.replaceWith(img);
        }
      } catch (e) {
        console.warn('thumb failed', slug, e);
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
