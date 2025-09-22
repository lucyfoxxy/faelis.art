const metas = import.meta.glob('@Content/galleries/index/*.json', {
  query: '?json',
  eager: true,
});

const assetModules = import.meta.glob('@Assets/galleries/**/*', {
  query: '?url',
  import: 'default',
  eager: true,
});

const urlByFile = {};
for (const [abs, url] of Object.entries(assetModules)) {
  const name = abs.split('/').pop(); // z.B. 'full-<id>.webp'
  urlByFile[name] = url;
}

const urlFromBasename = (name) => urlByFile[name];
const urlFromId = (id, kind) =>
  urlByFile[`${kind}-${id}.webp`]
  || urlByFile[`${kind}-${id}.avif`]
  || urlByFile[`${kind}-${id}.jpg`]
  || urlByFile[`${kind}-${id}.jpeg`]
  || urlByFile[`${kind}-${id}.png`];

const urlFromJsonPath = (p) => p ? urlByFile[p.split('/').pop()] : undefined;

const itemsBySlug = new Map();
for (const [path, data] of Object.entries(metas)) {
  const m = path.match(/\/index\/([^/]+)\.json$/);
  if (!m) continue;
  const slug = m[1];
  const items = (data?.items ?? []).map((it) => {
    // id bevorzugen; sonst aus Dateinamen extrahieren
    const id = it.id
      || it.full?.match(/full-(.+)\.\w+$/)?.[1]
      || it.thumb?.match(/thumb-(.+)\.\w+$/)?.[1];

    const fullUrl  = id ? urlFromId(id, 'full')  : urlFromJsonPath(it.full);
    const thumbUrl = id ? urlFromId(id, 'thumb') : urlFromJsonPath(it.thumb);

    // Warnung beim Debuggen hilft, Tippfehler sofort zu sehen
    if (!fullUrl)  console.warn('[gallery] missing full asset for', id ?? it.full);
    if (!thumbUrl) console.warn('[gallery] missing thumb asset for', id ?? it.thumb);

    return {
      ...it,
      id,
      full:  fullUrl  || it.full,   // Fallback: originaler String
      thumb: thumbUrl || it.thumb,
    };
  });

  itemsBySlug.set(slug, items);
}

export default function initGalleryPage() {
  const root = document.querySelector('.gallery[data-slug]');
  if (!root) return;

  const slug     = root.getAttribute('data-slug');
  const autoplay = root.getAttribute('data-autoplay') === 'true';
  const random   = root.getAttribute('data-random') === 'true';
  const interval = parseInt(root.getAttribute('data-interval') || '5000', 10);

  const viewer    = root.querySelector('.gallery-viewer');
  const imgEl     = viewer.querySelector('.gallery-viewer-image');
  const btnPrev   = viewer.querySelector('.gallery-viewer-prev');
  const btnNext   = viewer.querySelector('.gallery-viewer-next');
  const btnPlay   = viewer.querySelector('.gallery-viewer-playpause');
  const progress  = viewer.querySelector('.gallery-viewer-progress');
  const thumbsWrap= root.querySelector('.gallery-viewer-thumbs');

  // hier: items kommen bereits mit gehashten URLs aus itemsBySlug
  let items = itemsBySlug.get(slug) || [];
  let order = Array.from(items.keys());
  if (random) order.sort(() => Math.random() - 0.5);

  let i = 0;
  let timer = null;
  let playing = autoplay;

  const setProgress = (p) => progress.style.setProperty('--p', String(p));

  const show = (idx) => {
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
  thumbsWrap.innerHTML = '';
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
    thumbsWrap.appendChild(a);
  });

  // Galerie starten
  show(0);
  if (autoplay) run();
}
