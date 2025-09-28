const covers = import.meta.glob('@Assets/albums/_covers/*.webp', {
  query: '?url',
  import: 'default',
  eager: true,
});

// Map: "slug" → Bild-URL
const coverBySlug = new Map();
for (const [path, url] of Object.entries(covers)) {
  // z.B. /src/assets/albums/_covers/full-art.webp
  const match = path.match(/_covers\/([^/]+)\.webp$/);
  if (match) coverBySlug.set(match[1], url);
}

// Fallback (muss existieren)
const fallback = coverBySlug.get('_default');

export default function initGalleryCovers() {
  const slots = document.querySelectorAll('.media-galleries__thumb[data-slug]');
  slots.forEach((el) => {
    const slug = el.getAttribute('data-slug');
    const src = (slug && coverBySlug.get(slug)) || fallback;
    if (!src) return;

    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.decoding = 'async';
    img.loading = 'lazy';
    el.replaceChildren(img);
  });
}
