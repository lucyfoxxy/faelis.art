// Usage: node scripts/fetch-immich-bestof.mjs <albumIdsCommaSep> src/data/home_bestof.json
// Env: IMMICH_BASE_URL, IMMICH_API_KEY
import fs from "node:fs/promises";

const BASE = process.env.IMMICH_BASE_URL || process.env.IMMICH_URL;
const KEY  = process.env.IMMICH_API_KEY;
if (!BASE || !KEY) {
  console.error("Set IMMICH_BASE_URL and IMMICH_API_KEY"); process.exit(1);
}
const albumIds = (process.argv[2] || "").split(",").map(s=>s.trim()).filter(Boolean);
const outFile  = process.argv[3] || "src/data/home_bestof.json";

const fetchJson = (url, init={}) =>
  fetch(url, { ...init, headers: { "x-api-key": KEY, ...(init.headers||{}) } }).then(r => r.json());

async function assetsFromAlbum(id){
  // Immich REST: /api/albums/:id
  const album = await fetchJson(`${BASE}/api/albums/${id}`);
  // Prefer web-sized preview; fall back to original if needed
  return (album.assets || []).map(a => ({
    id: a.id,
    // public endpoints vary by config; usually /api/assets/{id}/thumbnail?size=preview|webp
    // try both; keep it simple and use thumbnail 'preview'
    src: `${BASE}/api/assets/${a.id}/thumbnail?size=preview`,
    alt: a.exifInfo?.description || a.originalFileName || "Artwork",
    w: a.exifInfo?.imageWidth || undefined,
    h: a.exifInfo?.imageHeight || undefined
  }));
}

const all = [];
for (const id of albumIds){
  try { all.push(...await assetsFromAlbum(id)); }
  catch(e){ console.error("Album fetch failed:", id, e.message); }
}

// de-dup + cap to ~12 for homepage
const dedup = [];
const seen = new Set();
for (const x of all){
  if (!seen.has(x.id)) { seen.add(x.id); dedup.push(x); }
}
const bestof = dedup.slice(0, 12);

await fs.mkdir("src/data", { recursive: true });
await fs.writeFile(outFile, JSON.stringify({ updated: new Date().toISOString(), items: bestof }, null, 2));
console.log("Wrote", outFile, bestof.length, "items");
