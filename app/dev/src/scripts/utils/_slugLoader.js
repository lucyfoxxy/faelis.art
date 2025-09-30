export function createGalleryItemsBySlug(metaModules, assetModules) {
  const urlByFile = {};
  for (const [abs, url] of Object.entries(assetModules)) {
    const name = abs.split('/').pop();
    if (!name) continue;
    urlByFile[name] = url;
  }

  const urlFromId = (id, kind) =>
    urlByFile[`${kind}-${id}.webp`]
    || urlByFile[`${kind}-${id}.avif`]
    || urlByFile[`${kind}-${id}.jpg`]
    || urlByFile[`${kind}-${id}.jpeg`]
    || urlByFile[`${kind}-${id}.png`];

  const urlFromJsonPath = (p) => (p ? urlByFile[p.split('/').pop()] : undefined);

  const itemsBySlug = new Map();
  for (const [path, data] of Object.entries(metaModules)) {
    const match = path.match(/\/albumData\/([^/]+)\.json$/);
    if (!match) continue;

    const slug = match[1];
    const items = (data?.items ?? []).map((item) => {
      const id = item.id
         || item.full?.match(/full-(.+)\.\w+$/)?.[1]
        || item.thumb?.match(/thumb-(.+)\.\w+$/)?.[1];
 
      const fullUrl = id ? urlFromId(id, 'full') : urlFromJsonPath(item.full);
      const thumbUrl = id ? urlFromId(id, 'thumb') : urlFromJsonPath(item.thumb);
 
      if (!fullUrl) console.warn('[gallery] missing full asset for', id ?? item.full);
      if (!thumbUrl) console.warn('[gallery] missing thumb asset for', id ?? item.thumb);
 
      return {
        ...item,
        id,
        full: fullUrl || item.full,
        thumb: thumbUrl || item.thumb,
      };
    });
 
    itemsBySlug.set(slug, items);
  }
 
  return itemsBySlug;
}
