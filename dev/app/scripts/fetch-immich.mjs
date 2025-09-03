// scripts/fetch-immich.mjs
// Lädt .env über `node -r dotenv/config` (siehe package.json unten) ODER aktiviere hier:
// import 'dotenv/config';

import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.IMMICH_BASE_URL || process.env.IMMICH_URL;
const KEY  = process.env.IMMICH_API_KEY;
const MAP  = (process.env.IMMICH_ALBUMS || '').trim();

if (!BASE || !KEY || !MAP) {
  console.error('[fetch-immich] Fehlende ENV:', { BASE, KEY: !!KEY, MAPlen: MAP.length });
  process.exit(1);
}

const ALBUM_MAP = MAP.split(',')
  .map(s => s.split(':'))
  .reduce((acc,[slug,id]) => (acc[slug]=id, acc), {});

const OUT_DIR = path.join('public', 'data', 'galleries');
const MANIFEST_PUBLIC = path.join('public', 'data', 'galleries', '_manifest.json');
const MANIFEST_SRC    = path.join('src', 'data', 'galleries-manifest.json'); // für Build-Imports


async function trySearchAssets(albumId, size=500) {
  // neuerer Weg – bei dir 404
  const body = { albumIds: [albumId], page: 1, size };
  const res = await fetch(`${BASE}/api/search/assets`, {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`SEARCH ${res.status}`);
  const data = await res.json();
  const items = data.assets?.items || data.items || [];
  return items;
}

async function fetchAlbumPage(albumId, page=1, size=500) {
  // älterer Weg – funktioniert bei dir
  // viele Instanzen akzeptieren diese Query-Parameter:
  // ?withAssets=true&assetPagination[page]=1&assetPagination[size]=500
  const url = `${BASE}/api/albums/${albumId}` +
    `?withAssets=true&assetPagination[page]=${page}&assetPagination[size]=${size}`;
  const res = await fetch(url, { headers: { 'x-api-key': KEY } });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`ALBUM ${res.status}: ${txt}`);
  }
  return res.json();
}

async function listAssetsByAlbum(albumId) {
  // 1) versuch Search-API
  try {
    const items = await trySearchAssets(albumId, 500);
    if (items.length) return items;
  } catch (e) {
    if (!String(e.message).startsWith('SEARCH')) throw e;
    // 404/405 → einfach auf Album-Endpoint fallen
  }

  // 2) Album-Endpoint mit möglicher Pagination
  const all = [];
  let page = 1;
  for (;;) {
    const data = await fetchAlbumPage(albumId, page, 500);
    // viele Builds liefern die Liste unter data.assets (Array) + evtl. data.assetsPagination
    const items = Array.isArray(data.assets) ? data.assets : [];
    all.push(...items);
    const total = data.assetsPagination?.totalItems ?? data.totalItems ?? null;
    if (!total || all.length >= total || items.length === 0) break;
    page += 1;
  }
  return all;
}

function mapItem(a) {
  // Felder nachrüsten, falls deine Galerie mehr braucht
  const id = a.id;
  const width  = a.exifInfo?.exifImageWidth ?? a.exifInfo?.imageWidth ?? null;
  const height = a.exifInfo?.exifImageHeight ?? a.exifInfo?.imageHeight ?? null;
  return {
    id,
    filename: a.originalFileName,
    type: a.type,
    width, height,
    thumb: `${BASE}/api/assets/${id}/thumbnail?size=preview`,
    src:   `${BASE}/api/assets/${id}/original`,
  };
}

(async () => {
  console.log('[fetch-immich] BASE=', BASE);
  console.log('[fetch-immich] Alben=', Object.keys(ALBUM_MAP));

  await fs.mkdir(OUT_DIR, { recursive: true });
  // alte Sammeldatei entsorgen, damit Astro nicht verwirrt ist
  try { await fs.unlink(path.join('src','content','galleries.json')); } catch {}

  for (const [slug, albumId] of Object.entries(ALBUM_MAP)) {
    console.log(`[fetch-immich] → ${slug} (${albumId})`);
    const raw = await listAssetsByAlbum(albumId);
    const items = raw.map(mapItem);

    const doc = { album: slug, source: 'album', sourceId: albumId, count: items.length, assets: items };
    const outFile = path.join(OUT_DIR, `${slug}.json`);
    await fs.writeFile(outFile, JSON.stringify(doc, null, 2), 'utf-8');
    console.log(`  ✓ wrote ${outFile} (${items.length} assets)`);
  }
  
  const slugs = Object.keys(ALBUM_MAP);
  await fs.writeFile(MANIFEST_PUBLIC, JSON.stringify({ slugs }, null, 2), 'utf-8');
  await fs.mkdir(path.dirname(MANIFEST_SRC), { recursive: true });
  await fs.writeFile(MANIFEST_SRC, JSON.stringify({ slugs }, null, 2), 'utf-8');
  console.log(`✓ wrote manifest for ${slugs.length} galleries`); 
})().catch(e => {
  console.error('[fetch-immich] ERROR:', e);
  process.exit(1);
});
