import { createGalleryItemsBySlug } from './galleryData';

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
  const interval = parseInt(root.getAttribute('data-interval') || '5000', 10);

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

  const computeFit = (item, loader) => {
    const width = item?.width ?? loader?.naturalWidth;
    const height = item?.height ?? loader?.naturalHeight;
    if (!width || !height) return 'contain';
    const rect = frame.getBoundingClientRect();
    if (!rect.width || !rect.height) return 'contain';
    const imageRatio = width / height;
    const frameRatio = rect.width / rect.height;
    const ratioDelta = Math.abs(imageRatio - frameRatio);
    const extremeAspect = imageRatio < 0.66 || imageRatio > 1.8;
    const threshold = frame.classList.contains('compact') ? 0.35 : 0.25;
    if (extremeAspect || ratioDelta > threshold) {
      return 'contain';
    }
    return 'cover';
  };

  const show = (idx) => {
    if (order.length === 0) return;
    i = (idx + order.length) % order.length;
    const item = items[order[i]];
    if (!item) return;

    const loader = new Image();
    loader.decoding = 'async';
    imgEl.classList.add('is-transitioning');

    const applyImage = () => {
      const fit = computeFit(item, loader);
      imgEl.dataset.fit = fit;
      imgEl.src = loader.src;
      imgEl.alt = item.alt || '';
      requestAnimationFrame(() => {
        imgEl.classList.remove('is-transitioning');
      });
    };

    loader.addEventListener('load', () => {
      applyImage();
    });
    loader.addEventListener('error', () => {
      imgEl.dataset.fit = 'contain';
      imgEl.src = item.full;
      imgEl.alt = item.alt || '';
      requestAnimationFrame(() => {
        imgEl.classList.remove('is-transitioning');
      });
    }, { once: true });
    loader.src = item.full;

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
