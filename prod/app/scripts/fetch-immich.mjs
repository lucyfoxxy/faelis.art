// scripts/fetch-immich.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const BASE = process.env.IMMICH_BASE_URL || process.env.IMMICH_URL; // z.B. https://i.faelis.art
const KEY  = process.env.IMMICH_API_KEY;
const MAP  = (process.env.IMMICH_ALBUMS || '').trim(); // "sketch:uuid,line-art:uuid,…"
const TITLES = {
  "full-art-sfw": "Full Art (SFW)",
  "full-art-nsfw": "Full Art (NSFW)",
  "line-art": "Line Art",
  "sketch": "Sketches",
  "sticker-packs": "Sticker Packs (Telegram)",
  "badges": "Badges",
  "prints": "Button- & Sticker-Prints",
  "ref-sheets": "Reference Sheets",
  "logos-tribals": "Logos & Tribals"
};

if (!BASE || !KEY || !MAP) {
  console.error('[fetch-immich] ENV fehlt:', { BASE, hasKEY: !!KEY, MAPlen: MAP.length });
  process.exit(1);
}

const ALBUM_MAP = MAP.split(',')
  .map(s => s.split(':'))
  .reduce((acc,[slug,id]) => (acc[slug]=id, acc), {});

const OUT_ROOT = path.join('public', 'assets'); // ziel: public/assets/<slug>/
const MANIFEST  = path.join('src','data','galleries-manifest.json'); // für Routen

async function fetchAlbum(albumId, page=1, size=500) {
  const url = `${BASE}/api/albums/${albumId}?withAssets=true&assetPagination[page]=${page}&assetPagination[size]=${size}`;
  const res = await fetch(url, { headers: { 'x-api-key': KEY } });
  if (!res.ok) throw new Error(`ALBUM ${res.status}`);
  return res.json();
}

async function listAssets(albumId) {
  const all = [];
  let page = 1;
  for (;;) {
    const data = await fetchAlbum(albumId, page, 500);
    const items = Array.isArray(data.assets) ? data.assets : [];
    all.push(...items);
    const total = data.assetsPagination?.totalItems ?? data.totalItems ?? null;
    if (!total || all.length >= total || items.length === 0) break;
    page += 1;
  }
  return all;
}

function extFromMime(m) {
  if (!m) return 'jpg';
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('gif')) return 'gif';
  return 'jpg';
}



// Download: gibt Buffer zurück
async function downloadBuffer(url) {
  const r = await fetch(url, { headers: { 'x-api-key': KEY } });
  if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

// Bildvarianten rendern
async function renderVariants(buf, outDir, baseName, ext) {
  // Thumb (~256px, transparent erhalten)
  const thumbName = `thumb-${baseName}.webp`;
  await sharp(buf)
    .rotate()
    .resize({ width: 256, height: 256, fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } })
    .webp({ lossless: true })
    .toFile(path.join(outDir, thumbName));

  // Full (max 1920px lange Kante)
  const fullName = `full-${baseName}.webp`;
  await sharp(buf)
    .rotate()
    .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 90 })
    .toFile(path.join(outDir, fullName));

  return { thumbName, fullName };
}

async function processAlbum(slug, albumId) {
  const outDir = path.join(OUT_ROOT, slug);
  await fs.mkdir(outDir, { recursive: true });

  const assets = await listAssets(albumId);
  const list = [];

  for (const a of assets) {
    try {
      const buf = await downloadBuffer(`${BASE}/api/assets/${a.id}/original`);
      const { thumbName, fullName } = await renderVariants(buf, outDir, a.id);

      list.push({
        id: a.id,
        thumb: `/assets/${slug}/${thumbName}`,
        full:  `/assets/${slug}/${fullName}`,
        filename: a.originalFileName,
        width: a.exifInfo?.exifImageWidth ?? null,
        height: a.exifInfo?.exifImageHeight ?? null
      });
    } catch (e) {
      console.warn(`[asset fail] ${slug}/${a.id}:`, e.message);
      continue;
    }
  }

  const index = { album: slug, count: list.length, items: list };
  await fs.writeFile(path.join(outDir, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
  console.log(`✓ ${slug}: ${list.length} Dateien`);

  return slug;
}




async function main() {
  await fs.mkdir(OUT_ROOT, { recursive: true });

  const slugs = [];
  for (const [slug, id] of Object.entries(ALBUM_MAP)) {
    const done = await processAlbum(slug, id );
    slugs.push(done);
  }

  // Manifest mit Slug + Title
  const galleries = slugs.map(slug => ({
    slug,
    title: TITLES[slug] ?? slug
  }));

  await fs.mkdir(path.dirname(MANIFEST), { recursive: true });
  await fs.writeFile(
    MANIFEST,
    JSON.stringify({ galleries }, null, 2),
    "utf-8"
  );
  console.log(`✓ Manifest aktualisiert (${galleries.length} Galerien)`);
}


main().catch(e => { console.error('[fetch-immich] ERROR', e); process.exit(1); });
