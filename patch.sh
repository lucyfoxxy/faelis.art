cat <<'EOF' > app/dev/src/content/config.ts
import { defineCollection, z } from "astro:content";

/** === Preis-/Katalog-Struktur (albumCatalog) === */
const priceItem = z.object({
  name: z.string(),
  price: z.number().optional(),
  from: z.number().optional(),
  to: z.number().optional(),
  unit: z.string().optional(),
  note: z.enum(["each","from","extra"]).optional(),
  link: z.string().url().optional(),
});

const priceCategory = z.object({
  title: z.string(),
  slug: z.string(),                 // required: URL/Datei-Name muss matchen
  subtitle: z.string().optional(),
  description: z.string().optional(),
  items: z.array(priceItem),
});

const albumCatalog = defineCollection({
  type: "data",
  schema: z.object({
    currency: z.string().default("EUR"),
    categories: z.array(priceCategory),
  }),
});

/** === Galerie-Datenstruktur (albumData) === */
const albumItem = z.object({
  id: z.string(),
  thumb: z.string(),
  full: z.string(),
  filename: z.string(),
  width: z.number(),
  height: z.number(),
});

const albumData = defineCollection({
  type: "data",
  schema: z.object({
    album: z.string(),          // sollte == slug sein
    count: z.number(),
    items: z.array(albumItem),
  }),
});

export const collections = { albumCatalog, albumData };
EOF
