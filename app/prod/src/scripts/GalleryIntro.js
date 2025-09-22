const metas = import.meta.glob('@Content/galleries/index/bestof.json', {
  query: '?json',
  eager: true,
});

const assetModules = import.meta.glob('@Assets/galleries/bestof/*', {
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

export default function initGalleryIntro() {
  const root = document.querySelector('.gallery[data-slug]');
  if (!root) return;

  const slug     = root.getAttribute('data-slug');
  const autoplay = root.getAttribute('data-autoplay') === 'true';
  const random   = root.getAttribute('data-random') === 'true';
  const interval = parseInt(root.getAttribute('data-interval') || '5000', 10);

  const viewer    = root.querySelector('.gallery-viewer');
  const imgEl     = viewer.querySelector('.gallery-viewer-image');
  const progress  = viewer.querySelector('.gallery-viewer-progress');


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
  if (autoplay) run();
}
