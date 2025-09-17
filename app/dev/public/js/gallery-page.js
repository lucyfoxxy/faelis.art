// gallery-page.js
(() => {
  const root = document.querySelector('.fae-gallery');
  if (!root) return;
  const slug = root.getAttribute('data-slug');
  const autoplay = root.getAttribute('data-autoplay') === 'true';
  const random = root.getAttribute('data-random') === 'true';
  const interval = parseInt(root.getAttribute('data-interval') || '5000', 10);

  const viewer = root.querySelector('.fae-viewer');
  const imgEl  = root.querySelector('.fae-viewer .image');
  const btnPrev = root.querySelector('.fae-viewer .prev');
  const btnNext = root.querySelector('.fae-viewer .next');
  const btnPlay = root.querySelector('.fae-viewer .playpause');
  const progress = root.querySelector('.fae-viewer .progress');
  const thumbsWrap = root.querySelector('.fae-thumbs');

  let items = [];
  let order = [];
  let i = 0;
  let timer = null;
  let playing = autoplay;

  const setProgress = (p) => { progress.style.setProperty('--p', String(p)); };

  const show = (idx) => {
    i = (idx + order.length) % order.length;
    const item = items[order[i]];
    imgEl.src = item.full;
    imgEl.alt = item.alt || '';
    // Active thumb
    thumbsWrap.querySelectorAll('.thumb').forEach((t, k) => {
      t.classList.toggle('active', k === i);
    });
    setProgress(0);
  };

  const next = () => show(i + 1);
  const prev = () => show(i - 1);

  const tick = () => {
    let p = 0;
    const started = performance.now();
    const step = () => {
      if (!playing) return;
      const dt = performance.now() - started;
      p = Math.min(1, dt / interval);
      setProgress(p);
      if (p >= 1) {
        next();
        run(); // restart cycle
      } else {
        timer = requestAnimationFrame(step);
      }
    };
    timer = requestAnimationFrame(step);
  };

  const run = () => {
    cancelAnimationFrame(timer);
    setProgress(0);
    if (playing) tick();
  };

  btnPrev.addEventListener('click', () => { prev(); run(); });
  btnNext.addEventListener('click', () => { next(); run(); });
  btnPlay.addEventListener('click', () => {
    playing = !playing;
    btnPlay.textContent = playing ? '⏸' : '▶';
    run();
  });

  // init
  (async () => {
    const url = `/assets/${slug}/index.json`;
    const data = await fetch(url).then(r => r.json());
    items = data.items || [];

    // Fallback: wenn kein _cover.webp, nehmen wir erstes Bild (Viewer)
    order = Array.from(items.keys());
    if (random) order.sort(() => Math.random() - 0.5);

    // Build fixed-size thumbnails (128x128)
    thumbsWrap.innerHTML = '';
    items.forEach((item, k) => {
      const a = document.createElement('button');
      a.className = 'thumb';
      a.type = 'button';
      a.setAttribute('aria-label', item.alt || `Image ${k + 1}`);

      const t = document.createElement('img');
      t.src = item.thumb;      // <- WICHTIG: Thumb, nicht Full!
      t.alt = '';
      t.loading = 'lazy';
      t.decoding = 'async';
      t.width = 96;
      t.height = 96;
      a.appendChild(t);

      a.addEventListener('click', () => { show(k); run(); });
      thumbsWrap.appendChild(a);
    });

    show(0);
    if (autoplay) run();
  })().catch(console.error);
})();
