// app/dev/src/content/config.ts
import { defineCollection, z } from "astro:content";

const priceItem = z.object({
  name: z.string(),
  price: z.number().optional(),
  from: z.number().optional(),
  to: z.number().optional(),
  unit: z.string().optional(),
  note: z.string().optional(), // "each" | "from" | "extra" etc.
  link: z.string().url().optional(),
});

const priceCategory = z.object({
  title: z.string(),
  slug: z.string().optional(),   // kebab-case; optional falls reine Preistabelle ohne Gallery
  subtitle: z.string().optional(),
  description: z.string().optional(),
  items: z.array(priceItem),     // <— konsistent zu PricingPage.astro
});

// Optional: Typen für die Gallery-Entry-JSONs (entries/<slug>.json)
const albumItem = z.object({
  id: z.string(),
  thumb: z.string(),
  full: z.string(),
  filename: z.string(),
  width: z.number(),
  height: z.number(),
});
const albums = z.object({
  slug: z.string(),
  count: z.number(),
  items: z.array(albumItem),
});

const categories = defineCollection({
  type: "data",
  schema: z.object({
    currency: z.string().default("EUR"),
    categories: z.array(priceCategory),
  }),
});

export const collections = { categories };
// export type AlbumItem = z.infer<typeof albumItem>;
// export type Albums = z.infer<typeof albums>;
