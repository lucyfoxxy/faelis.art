(function () {
  /** utils */
  const $ = (sel, el=document) => el.querySelector(sel);
  const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));
  const clampMod = (i, n) => (i % n + n) % n;
  const shuffle = (arr) => { for (let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; };

  /** lightbox (einmal global) */
  function ensureLightbox() {
    if ($('.fae-lightbox')) return;
    const lb = document.createElement('div');
    lb.className = 'fae-lightbox';
    lb.innerHTML = `
      <button class="close" aria-label="Schließen">✕</button>
      <button class="nav prev" aria-label="Vorheriges">❮</button>
      <img alt="" />
      <button class="nav next" aria-label="Nächstes">❯</button>
    `;
    document.body.appendChild(lb);
  }
  ensureLightbox();

  /** pro Galerie-Section eigener Zustand */
  function initSection(root) {
    const slug = root.dataset.slug;
    if (!slug) return;

    const autoplay = root.dataset.autoplay === 'true';
    const interval = Math.max(1000, Number(root.dataset.interval || 5000));
    const random   = root.dataset.random === 'true';

    const viewerImg   = $('.fae-viewer .image', root);
    const prevBtn     = $('.fae-viewer .prev', root);
    const nextBtn     = $('.fae-viewer .next', root);
    const playPause   = $('.fae-viewer .playpause', root);
    const progressBar = $('.fae-viewer .progress', root);
    const thumbsEl    = $('.fae-thumbs', root);

    let assets = [];
    let index = 0;
    let timer = null;
    let playing = false;
    let progressTimer = null;
    let progressStart = 0;

    function setIndex(i) {
      if (!assets.length) return;
      index = clampMod(i, assets.length);
      const a = assets[index];
      viewerImg.src = a.src || a.thumb;
      viewerImg.alt = a.filename || '';

      $$('.fae-thumbs button', root).forEach((b, bi) =>
        b.setAttribute('aria-current', String(bi === index)));
      resetProgressAnim();
    }

    function next(n=1){ setIndex(index + n); }
    function prev(){ next(-1); }

    function start() {
      if (playing || !assets.length) return;
      playing = true;
      playPause.textContent = '⏸';
      resetProgressAnim();
      timer = setInterval(() => next(1), interval);
    }

    function stop() {
      playing = false;
      playPause.textContent = '▶';
      if (timer) clearInterval(timer), timer = null;
      if (progressTimer) cancelAnimationFrame(progressTimer), progressTimer = null;
      if (progressBar) progressBar.style.setProperty('--w', '0%');
      const bar = progressBar?.querySelector('::after'); // no-op: purely visual
    }

    function resetProgressAnim() {
      if (!progressBar) return;
      const bar = progressBar; // container; we animate its ::after via width transition
      // Force reflow to restart CSS transition
      const after = bar.querySelector(':scope > .__dummy__'); // none, hack unnecessary
      // Manually animate with JS for full control:
      const startTs = performance.now();
      progressStart = startTs;
      function step(now) {
        if (!playing) return;
        const elapsed = now - startTs;
        const pct = Math.min(1, elapsed / interval);
        bar.style.setProperty('--w', (pct*100).toFixed(2) + '%');
        bar.style.setProperty('--w'); // ensure style set
        bar.style.setProperty('--w'); // noop
        bar.firstElementChild;        // noop reflow hint
        bar.style.setProperty('--w', (pct*100).toFixed(2) + '%');
        bar.style.setProperty('--w'); // again noop
        bar.querySelector;            // noop
        // We can't address ::after directly; alternative: set width on a child
      }
      // Simpler: inject a child bar we can control:
      let inner = bar.querySelector('.bar');
      if (!inner) {
        inner = document.createElement('div');
        inner.className = 'bar';
        inner.style.cssText = 'height:100%;width:0;background:var(--accent,#8ad);';
        bar.innerHTML = '';
        bar.appendChild(inner);
      }
      let last = 0;
      function raf(t){
        if (!playing) return;
        const dt = t - last; last = t;
        const elapsed = t - startTs;
        inner.style.width = Math.min(100, (elapsed/interval)*100) + '%';
        progressTimer = requestAnimationFrame(raf);
      }
      inner.style.width = '0%';
      if (playing) progressTimer = requestAnimationFrame(raf);
    }

    function openLightbox() {
      const lb = $('.fae-lightbox');
      const img = $('img', lb);
      img.src = (assets[index].src || assets[index].thumb);
      lb.classList.add('open');
      stop();
    }
    function closeLightbox() {
      $('.fae-lightbox').classList.remove('open');
      if (autoplay) start();
    }

    // Bind LB controls (global, aber ok)
    (function bindLightboxOnce(){
      const lb = $('.fae-lightbox');
      if (lb.dataset.bound) return;
      lb.dataset.bound = 'true';
      $('.close', lb).addEventListener('click', closeLightbox);
      $('.prev', lb).addEventListener('click', () => { prev(); $('img', lb).src = (assets[index].src || assets[index].thumb); });
      $('.next', lb).addEventListener('click', () => { next(); $('img', lb).src = (assets[index].src || assets[index].thumb); });
      lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
      document.addEventListener('keydown', (e) => {
        if (!lb.classList.contains('open')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') $('.prev', lb).click();
        if (e.key === 'ArrowRight') $('.next', lb).click();
      });
    })();

    // Events
    nextBtn.addEventListener('click', () => { stop(); next(); });
    prevBtn.addEventListener('click', () => { stop(); prev(); });
    playPause.addEventListener('click', () => playing ? stop() : start());
    viewerImg.addEventListener('click', openLightbox);

    $('.fae-viewer', root).addEventListener('mouseenter', () => playing && stop());
    $('.fae-viewer', root).addEventListener('mouseleave', () => autoplay && start());

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else if (autoplay) start();
    });

    // Daten laden
    fetch(`/assets/${slug}/index.json`, { cache: 'no-store' })
      .then(r => { if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(j => {
        assets = Array.isArray(j.assets) ? j.assets.slice() : [];
        if (!assets.length) {
          root.insertAdjacentHTML('beforeend', '<p>Keine Bilder gefunden.</p>');
          return;
        }

        // Reihenfolge mischen?
        if (random) shuffle(assets);

        // Thumbs bauen
        thumbsEl.innerHTML = '';
        assets.forEach((a, i) => {
          const btn = document.createElement('button');
          btn.setAttribute('role','listitem');
          btn.innerHTML = `<img src="${a.thumb || a.src}" alt="">`;
          btn.addEventListener('click', () => { stop(); setIndex(i); });
          thumbsEl.appendChild(btn);
        });

        // Startindex zufällig, wenn random; sonst 0
        setIndex(random ? Math.floor(Math.random()*assets.length) : 0);

        // Autoplay?
        if (autoplay) start();
        else playPause.textContent = '▶';
      })
      .catch(e => {
        console.error('Gallery load failed', e);
        root.insertAdjacentHTML('beforeend', '<p>Fehler beim Laden der Galerie.</p>');
      });
  }

  function boot() {
    document.querySelectorAll('.fae-gallery[data-slug]').forEach(initSection);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
