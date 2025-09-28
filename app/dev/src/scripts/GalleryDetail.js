import { createGalleryItemsBySlug } from './galleryData';

const metas = import.meta.glob('@Content/_albums/_entries/*.json', {
  query: '?json',
  eager: true,
});

const assetModules = import.meta.glob('@Assets/albums/**/*', {
  query: '?url',
  import: 'default',
  eager: true,
});

const itemsBySlug = createGalleryItemsBySlug(metas, assetModules);

export default function initGalleryPage() {
  const root = document.querySelector('.gallery[data-slug]');
  if (!root) return;

  const slug     = root.getAttribute('data-slug');
  const autoplay = root.getAttribute('data-autoplay') === 'true';
  const random   = root.getAttribute('data-random') === 'true';
  const interval = parseInt(root.getAttribute('data-interval') || '5000', 10);

  const viewer    = root.querySelector('.gallery-viewer');
  const imgEl     = viewer?.querySelector('.gallery-viewer-image');
  const btnPrev   = viewer?.querySelector('.gallery-viewer-prev');
  const btnNext   = viewer?.querySelector('.gallery-viewer-next');
  const btnPlay   = viewer?.querySelector('.gallery-viewer-playpause');
  const progress  = viewer?.querySelector('.gallery-viewer-progress');
  const thumbsWrap= root.querySelector('.gallery-viewer-thumbs');

 if (!viewer || !imgEl || !btnPrev || !btnNext || !btnPlay || !progress || !thumbsWrap) return;

  // hier: items kommen bereits mit gehashten URLs aus itemsBySlug
  const items = itemsBySlug.get(slug) ?? [];
  const order = items.map((_, index) => index);
  if (random) order.sort(() => Math.random() - 0.5);

  imgEl.decoding = 'async';

  if (order.length === 0) {
    progress.hidden = true;
    btnPrev.disabled = true;
    btnNext.disabled = true;
    btnPlay.disabled = true;
    btnPlay.hidden = true;
    const empty = document.createElement('p');
    empty.className = 'gallery-empty';
    empty.textContent = 'No artworks available yet.';
    thumbsWrap.removeAttribute('role');
    thumbsWrap.replaceChildren(empty);
    return;
  }

  const hasMultiple = order.length > 1;
  btnPrev.disabled = btnNext.disabled = !hasMultiple;
  btnPlay.hidden = !hasMultiple;
  progress.hidden = !hasMultiple;

  let i = 0;
  let timer = null;
  let playing = hasMultiple && autoplay;

  const setProgress = (p) => progress.style.setProperty('--p', String(p));

  const show = (idx) => {
    if (order.length === 0) return;
    i = (idx + order.length) % order.length;
    const item = items[order[i]];
    if (!item) return;

    // benutze die bereits gemappten, gehashten URLs
    imgEl.src = item.full;
    imgEl.alt = item.alt || '';

    thumbsWrap.querySelectorAll('.gallery-viewer-thumb').forEach((t, k) => {
      t.classList.toggle('active', k === i);
    });
    setProgress(0);
  };

  const next = () => show(i + 1);
  const prev = () => show(i - 1);

  const tick = () => {
    const started = performance.now();
    const step = () => {
      if (!playing) return;
      const dt = performance.now() - started;
      const p = Math.min(1, dt / interval);
      setProgress(p);
      if (p >= 1) {
        next();
        run();
      } else {
        timer = requestAnimationFrame(step);
      }
    };
    timer = requestAnimationFrame(step);
  };

  const run = () => {
    if (timer) cancelAnimationFrame(timer);
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

  // Thumbnails rendern
  const fragment = document.createDocumentFragment();
  order.forEach((itemIdx, orderIdx) => {
    const item = items[itemIdx];
    const a = document.createElement('button');
    a.className = 'gallery-viewer-thumb';
    a.type = 'button';
    a.setAttribute('aria-label', item.alt || `Image ${orderIdx + 1}`);
 
    const t = document.createElement('img');
    t.src = item.thumb;
    t.alt = '';
    t.loading = 'lazy';
    t.decoding = 'async';

 
    a.appendChild(t);
    a.addEventListener('click', () => { show(orderIdx); run(); });
    fragment.appendChild(a);
  });
  thumbsWrap.replaceChildren(fragment);
  // Galerie starten
  show(0);
  if (autoplay) run();
}
