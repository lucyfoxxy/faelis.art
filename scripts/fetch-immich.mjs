import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import 'dotenv/config';
// ──────────────────────────────────────────────────────────────────────────────
// Configuration ----------------------------------------------------------------

const { target: TARGET, quiet: QUIET } = parseCliArgs(process.argv.slice(2));
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const PATHS = createPathConfig(REPO_ROOT, TARGET);

const BASE = process.env.IMMICH_BASE_URL || process.env.IMMICH_URL;
const KEY = process.env.IMMICH_API_KEY;
const MAP = (process.env.IMMICH_ALBUMS || '').trim();
const BESTOF_ID = (process.env.IMMICH_BESTOF_ALBUM || '').trim();

if (!['dev', 'prod'].includes(TARGET)) { console.error(`Invalid TARGET "${TARGET}". Exiting.`);  process.exit(1); }
if (!BASE || !KEY || !MAP) { console.error('.env not found, exiting:', { BASE, hasKEY: Boolean(KEY), MAPlen: MAP.length }); process.exit(1); }

const ALBUM_MAP = parseAlbumMap(MAP);
const CLR = '\x1b[2K';
const UP1 = '\x1b[1A';
let barsActive = false;


function barsInit() {
  if (!process.stdout.isTTY || barsActive) return;
  process.stdout.write('\n\n');
  process.stdout.write(UP1 + UP1);
  barsActive = true;
}
function barsUpdate({ slug, albumCurrent, albumTotal, allCurrent, allTotal }) {
  if (!process.stdout.isTTY) return;
  if (!barsActive) barsInit();
  const pct = (c, t) => (t ? Math.floor((c / t) * 100) : 100);
  const bar = (p, w = 28) =>
    '█'.repeat(Math.floor((p * w) / 100)).padEnd(w, '░');
  const pad = (s, w = 16) => String('['+s+']').padEnd(w, ' ');

  const pctAll = pct(allCurrent, allTotal);
  const pctAlbum = pct(albumCurrent, albumTotal);
  const lineAll = `🔄 [TOTAL]          [${bar(pctAll)}] ${String(pctAll).padStart(
    3
  )}% (${allCurrent}/${allTotal})`;
  const lineCur = `🔄 ${pad(slug)} [${bar(pctAlbum)}] ${String(
    pctAlbum
  ).padStart(3)}% (${albumCurrent}/${albumTotal})`;

  process.stdout.write('\r' + CLR + lineAll + '\n' + CLR + lineCur);
  process.stdout.write(UP1);
 

}
function barsRelease() {
  if (!process.stdout.isTTY || !barsActive) return;
  process.stdout.write('\n\n');
  
  barsActive = false;
}

const assetsCache = new Map();
function getAssetsCached(id) {
  if (!assetsCache.has(id)) assetsCache.set(id, listAssets(id));
  return assetsCache.get(id);
}

// ──────────────────────────────────────────────────────────────────────────────
// Main workflow ----------------------------------------------------------------

async function main() {
  await fs.mkdir(PATHS.srcRoot, { recursive: true });
  if(!QUIET){
    console.log(`→ fetch-immich target: ${TARGET}`);
    console.log(`   assets:   ${PATHS.assetsPath}`);
    console.log(`   entries: ${PATHS.albumData}`);
  }
  const allAlbumIds = [
    ...Object.values(ALBUM_MAP),
    ...(BESTOF_ID ? [BESTOF_ID] : [])
  ];

  const totals = await Promise.all(
    allAlbumIds.map(async (id) => (await getAssetsCached(id)).length)
  );
  const grandTotal = totals.reduce((acc, len) => acc + len, 0);
  const counters = { processedAll: 0, grandTotal };

  for (const [slug, albumId] of Object.entries(ALBUM_MAP)) {
    const assets = await getAssetsCached(albumId);
    await processAlbum({
      slug,
      albumId,
      assets,
      counters,
      paths: PATHS,
      baseUrl: BASE
    });
    if(QUIET){await new Promise(r => setTimeout(r, 1500));}

  }

  if (BESTOF_ID) {
    const assets = await getAssetsCached(BESTOF_ID);
    await processAlbum({
      slug: 'bestof',
      albumId: BESTOF_ID,
      assets,
      counters,
      paths: PATHS,
      baseUrl: BASE
    });

  }
  barsRelease();
}

main().catch((error) => {
  console.error('[fetch-immich] ERROR', error);
  process.exit(1);
});

// ──────────────────────────────────────────────────────────────────────────────
// Album processing -------------------------------------------------------------

async function processAlbum({
  slug,
  albumId,
  assets = null,
  counters,
  paths,
  baseUrl
}) {
  const outDir = path.join(paths.assetsPath, slug);
  await fs.mkdir(outDir, { recursive: true });

  const albumAssets = assets ?? (await listAssets(albumId));
  const totalAlbum = albumAssets.length;

  const removed = await pruneRemovedFiles(outDir, albumAssets.map((asset) => asset.id));
  if (removed) {
    console.log(`• ${slug}: removed ${removed} stale file(s)`);
  }

    barsUpdate({ slug, albumCurrent: 0, albumTotal: totalAlbum, allCurrent: counters.processedAll, allTotal: counters.grandTotal });


  const items = [];

  if (totalAlbum === 0) {

    await writeAlbumIndex({
      albumData: paths.albumData,
      slug,
      items
    });

    if(!QUIET){ console.log(`✓ ${slug}: 0/0 Dateien verarbeitet`); }

    return { slug };
  }

  for (let i = 0; i < totalAlbum; i += 1) {
    const asset = albumAssets[i];
    try {
      const { thumbName, fullName } = await ensureAssetVariants({
        asset,
        outDir,
        baseUrl
      });

      items.push({
        id: asset.id,
        thumb: `albums/${slug}/${thumbName}`,
        full: `albums/${slug}/${fullName}`,
        filename: asset.originalFileName,
        width: asset.exifInfo?.exifImageWidth ?? null,
        height: asset.exifInfo?.exifImageHeight ?? null
      });
    } catch (error) {
      console.warn(`[asset fail] ${slug}/${asset.id}:`, error.message);
    }

    counters.processedAll += 1;

    barsUpdate({ slug, albumCurrent: i + 1, albumTotal: totalAlbum, allCurrent: counters.processedAll, allTotal: counters.grandTotal });
  
    
  }

  
  await writeAlbumIndex({
    albumData: paths.albumData,
    slug,
    items
  });
  

  if(!QUIET){ console.log(`\n\n✓ ${slug}: ${items.length}/${totalAlbum} Dateien verarbeitet`); }

  return { slug };
}

async function writeAlbumIndex({ albumData, slug, items }) {
  await fs.mkdir(albumData, { recursive: true });
  const index = { slug: slug, count: items.length, items };
  await fs.writeFile(
    path.join(albumData, `${slug}.json`),
    JSON.stringify(index, null, 2),
    'utf-8'
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// API helpers ------------------------------------------------------------------

async function fetchAlbum(albumId, page = 1, size = 500) {
  const url = `${BASE}/api/albums/${albumId}?withAssets=true&assetPagination[page]=${page}&assetPagination[size]=${size}`;
  const response = await fetch(url, { headers: { 'x-api-key': KEY } });
  if (!response.ok) throw new Error(`ALBUM ${response.status}`);
  return response.json();
}

async function listAssets(albumId) {
  const all = [];
  let page = 1;
  for (;;) {
    const data = await fetchAlbum(albumId, page, 500);
    const items = Array.isArray(data.assets) ? data.assets : [];
    all.push(...items);
    const totalItems =
      data.assetsPagination?.totalItems ?? data.totalItems ?? null;
    if (!totalItems || all.length >= totalItems || items.length === 0) break;
    page += 1;
  }
  return all;
}

async function downloadBuffer(url) {
  const response = await fetch(url, { headers: { 'x-api-key': KEY } });
  if (!response.ok) throw new Error(`GET ${url} -> ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

// ──────────────────────────────────────────────────────────────────────────────
// File helpers -----------------------------------------------------------------

async function ensureAssetVariants({ asset, outDir, baseUrl }) {
  const baseId = asset.id;
  const thumbName = `thumb-${baseId}.webp`;
  const fullName = `full-${baseId}.webp`;
  const thumbPath = path.join(outDir, thumbName);
  const fullPath = path.join(outDir, fullName);

  const needThumb = !(await exists(thumbPath));
  const needFull = !(await exists(fullPath));

  if (needThumb || needFull) {
    const buffer = await downloadBuffer(
      `${baseUrl}/api/assets/${asset.id}/original`
    );
    await renderVariants({
      buffer,
      thumbPath,
      fullPath,
      needThumb,
      needFull
    });
  }

  return { thumbName, fullName };
}

async function renderVariants({ buffer, thumbPath, fullPath, needThumb, needFull }) {
  if (needThumb) {
    await sharp(buffer)
      .rotate()
      .resize({
        width: 196,
        height: 196,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .webp({ lossless: true })
      .toFile(thumbPath);
  }

  if (needFull) {
    await sharp(buffer)
      .rotate()
      .resize({
        width: 1920,
        height: 1920,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 90 })
      .toFile(fullPath);
  }
}

async function pruneRemovedFiles(outDir, validIds) {
  const keep = new Set(validIds.map((id) => String(id)));
  let removed = 0;
  try {
    const files = await fs.readdir(outDir);
    for (const file of files) {
      const match = file.match(/^(?:thumb|full)-(.+?)\.webp$/);
      if (!match) continue;
      const id = match[1];
      if (!keep.has(id)) {
        await fs.unlink(path.join(outDir, file));
        removed += 1;
      }
    }
  } catch {
    // Directory may not exist yet.
  }
  return removed;
}

async function exists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// CLI / utility helpers --------------------------------------------------------

function parseCliArgs(argv) {
  const args = { target: 'dev', quiet: false };
  for (const entry of argv) {
    if (entry === '--quiet') args.quiet = true;
    else if (entry.startsWith('--target=')) {
      args.target = entry.split('=')[1]?.toLowerCase() ?? args.target;
    }
  }

  if (!argv.some((arg) => arg.startsWith('--target=')) && process.env.TARGET) {
    args.target = process.env.TARGET.toLowerCase();
  }

  return args;
}

function createPathConfig(repoRoot, target) {
  const appRoot = path.join(repoRoot, 'app', target);
  const srcRoot = path.join(appRoot, 'src');
  return {
    repoRoot,
    appRoot,
    srcRoot,
    assetsPath: path.join(srcRoot, 'assets', 'albums'),
    
    albumData: path.join(srcRoot, 'content', 'albumData'),
    envFile: path.join(appRoot, '.env')
  };
}


function parseAlbumMap(map) {
  return map
    .split(',')
    .map((segment) => segment.split(':').map((part) => part.trim()))
    .filter(([slug, id]) => slug && id)
    .reduce((acc, [slug, id]) => {
      acc[slug] = id;
      return acc;
    }, {});
}