// scripts/fetch-immich.mjs
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.IMMICH_BASE_URL || process.env.IMMICH_URL; // z.B. https://i.faelis.art
const KEY  = process.env.IMMICH_API_KEY;
const MAP  = (process.env.IMMICH_ALBUMS || '').trim(); // "sketch:uuid,line-art:uuid,…"

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

async function downloadToFile(url, filePath) {
  const r = await fetch(url, { headers: { 'x-api-key': KEY } });
  if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  await fs.writeFile(filePath, buf);
}

async function processAlbum(slug, albumId, { saveOriginal=false } = {}) {
  const outDir = path.join(OUT_ROOT, slug);
  await fs.mkdir(outDir, { recursive: true });

  const assets = await listAssets(albumId);
  const list = [];

  for (const a of assets) {
    const id = a.id;
    const ext = extFromMime(a.originalMimeType || '');
    const thumbName = `thumb-${id}.${ext}`;
    const fullName  = `full-${id}.${ext}`;

    const thumbUrl = `${BASE}/api/assets/${id}/thumbnail?size=preview`;
    const fullUrl  = `${BASE}/api/assets/${id}/original`;

    // thumbnail speichern
    try {
      await downloadToFile(thumbUrl, path.join(outDir, thumbName));
    } catch (e) {
      console.warn(`[thumb fail] ${slug}/${id}:`, e.message);
      continue; // ohne Thumb nicht listen
    }

    // optional original speichern
    if (saveOriginal) {
      try { await downloadToFile(fullUrl, path.join(outDir, fullName)); }
      catch { /* nicht kritisch */ }
    }

    list.push({
      id,
      thumb: `/assets/${slug}/${thumbName}`,
      src:   saveOriginal ? `/assets/${slug}/${fullName}` : `/assets/${slug}/${thumbName}`,
      filename: a.originalFileName,
      width: a.exifInfo?.exifImageWidth ?? null,
      height: a.exifInfo?.exifImageHeight ?? null
    });
  }

  // index.json schreiben
  const index = { album: slug, count: list.length, assets: list };
  await fs.writeFile(path.join(outDir, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
  console.log(`✓ ${slug}: ${list.length} Dateien`);

  return slug;
}

async function main() {
  await fs.mkdir(OUT_ROOT, { recursive: true });

  const slugs = [];
  for (const [slug, id] of Object.entries(ALBUM_MAP)) {
    const done = await processAlbum(slug, id, { saveOriginal: process.env.IMMICH_SAVE_ORIGINAL === 'true' });
    slugs.push(done);
  }

  // Manifest für Routen
  await fs.mkdir(path.dirname(MANIFEST), { recursive: true });
  await fs.writeFile(MANIFEST, JSON.stringify({ slugs }, null, 2), 'utf-8');
  console.log(`✓ Manifest aktualisiert (${slugs.length} Galerien)`);
}

main().catch(e => { console.error('[fetch-immich] ERROR', e); process.exit(1); });
