import { createGalleryItemsBySlug } from './utils/_slugLoader.js';
import { loadImageWithTransition } from './utils/_transitionLoader.js';

const metas = import.meta.glob('@Content/albumData/bestof.json', {
  query: '?json',
  eager: true,
});

const assetModules = import.meta.glob('@Assets/albums/bestof/*', {
  query: '?url',
  import: 'default',
  eager: true,
});

const itemsBySlug = createGalleryItemsBySlug(metas, assetModules);

export default function initGalleryIntro() {
  const root = document.querySelector('.media-gallery__hook[data-slug]');
  if (!root) return;

  const slug     = root.getAttribute('data-slug');
  const autoplay = root.getAttribute('data-autoplay') === 'true';
  const random   = root.getAttribute('data-random') === 'true';
  const interval = parseInt(root.getAttribute('data-interval') || '7000', 10);

  const viewer    = root.querySelector('.media-gallery');
  const frame     = viewer?.querySelector('.media-gallery__frame');
  const imgEl     = frame?.querySelector('.media-gallery__image');
  const progress  = frame?.querySelector('.media-gallery__progress');

  if (!viewer || !frame || !imgEl || !progress) return;

  // hier: items kommen bereits mit gehashten URLs aus itemsBySlug
  const items = itemsBySlug.get(slug) ?? [];
  const order = items.map((_, index) => index);
  if (random) order.sort(() => Math.random() - 0.5);

  if (order.length === 0) {
    viewer.remove();
    return;
  }

  const hasMultiple = order.length > 1;
  if (!hasMultiple) progress.hidden = true;

  imgEl.decoding = 'async';

  let i = 0;
  let timer = null;
  let playing = hasMultiple && autoplay;

  const setProgress = (p) => progress.style.setProperty('--p', String(p));

  const show = (idx) => {
    if (order.length === 0) return;
    i = (idx + order.length) % order.length;
    const item = items[order[i]];
    if (!item) return;

    loadImageWithTransition(imgEl, {
      src: item.full,
      alt: item.alt || '',
      fallbackSrc: item.full,
    });

    setProgress(0);
  };

  const next = () => show(i + 1);


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



  // Galerie starten
  show(0);
  if (playing) run();
}
