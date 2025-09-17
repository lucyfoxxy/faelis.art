// scripts/fetch-immich.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
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
const argvTarget = process.argv.find(a => a.startsWith('--target='))?.split('=')[1];
const TARGET = (argvTarget || process.env.TARGET || 'dev').toLowerCase();
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const REPO_ROOT  = path.resolve(__dirname, '..');
if (!['dev','prod'].includes(TARGET)) {
  console.error(`Invalid TARGET "${TARGET}". Use "dev" or "prod".`);
  process.exit(1);
}
try {
  const dotenv = await import('dotenv');
  dotenv.config({ path: path.join(REPO_ROOT, 'app', TARGET, '.env') });
} catch { /* dotenv optional */ }
const APP_ROOT = path.join(REPO_ROOT, 'app', TARGET);
const OUT_ROOT = path.join(APP_ROOT, 'public', 'assets');               // z.B. app/dev/public/assets/<slug>/
const MANIFEST = path.join(APP_ROOT, 'src', 'data', 'galleries-manifest.json'); // z.B. app/dev/src/data/galleries-manifest.json
const BASE = process.env.IMMICH_BASE_URL || process.env.IMMICH_URL; // z.B. https://i.faelis.art
const KEY  = process.env.IMMICH_API_KEY;
const MAP  = (process.env.IMMICH_ALBUMS || '').trim(); // "sketch:uuid,line-art:uuid,…"
const ALBUM_MAP = MAP.split(',')
  .map(s => s.split(':'))
  .reduce((acc,[slug,id]) => (acc[slug]=id, acc), {});
if (!BASE || !KEY || !MAP) {
  console.error('[fetch-immich] ENV fehlt:', { BASE, hasKEY: !!KEY, MAPlen: MAP.length });
  process.exit(1);
}

console.log(`→ fetch-immich target: ${TARGET}`);
console.log(`   assets:   ${OUT_ROOT}`);
console.log(`   manifest: ${MANIFEST}`);const LABEL_WIDTH =
  Math.max(...Object.keys((process.env.IMMICH_ALBUMS || '')
    .split(',').map(s => s.split(':')[0]).filter(Boolean)).map(s => s.length), 16);

const BAR_WIDTH = 28; // Fortschrittsbalken-Breite

function isTTY() {
  return !!(process.stdout && process.stdout.isTTY);
}
function padLabel(slug) {
  return String(slug).padEnd(LABEL_WIDTH, ' ');
}
function drawBar(pct, current, total, slug) {
  const filled = Math.floor((pct * BAR_WIDTH) / 100);
  const bar = '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled);
  const line = `${padLabel(slug)} [${bar}] ${String(pct).padStart(3, ' ')}% (${current}/${total})`;

  if (isTTY()) {
    // Cursor an Zeilenanfang + restliche Zeichen der Zeile löschen
    process.stdout.write(`\r\x1b[K${line}`);
    if (pct >= 100) process.stdout.write('\n');
  } else {
    if (pct % 10 === 0 || pct === 100) console.log(line);
  }
}
// ===========================================================================

// ... dein Code bleibt ...

async function processAlbum(slug, albumId) {
  const outDir = path.join(OUT_ROOT, slug);
  await fs.mkdir(outDir, { recursive: true });

  const assets = await listAssets(albumId);
  const total = assets.length;

  if (total === 0) {
    console.log(`${padLabel(slug)} [${'░'.repeat(BAR_WIDTH)}]   0% (0/0)`);
    await fs.writeFile(path.join(outDir, 'index.json'),
      JSON.stringify({ album: slug, count: 0, items: [] }, null, 2), 'utf-8');
    return slug;
  }

  let lastPct = -1;
  const list = [];

  drawBar(0, 0, total, slug);

  for (let i = 0; i < total; i++) {
    const a = assets[i];
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
    }

    const pct = Math.max(0, Math.min(100, Math.floor(((i + 1) / total) * 100)));
    if (pct !== lastPct) {
      drawBar(pct, i + 1, total, slug);
      lastPct = pct;
    }
  }

  // Abschlusszeile: gleicher linker Block, hübsch symmetrisch
  console.log(`✓ ${padLabel(slug)} ${list.length}/${total} Dateien verarbeitet`);

  const index = { album: slug, count: list.length, items: list };
  await fs.writeFile(path.join(outDir, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');

  return slug;
}

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
