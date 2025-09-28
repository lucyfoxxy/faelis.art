import { defineCollection, z } from "astro:content";

const albumCatalog = defineCollection({
  type: "data",
  schema: z.object({
    currency: z.string().default("EUR"),
    categories: z.array(
      z.object({
        title: z.string(),
        slug: z.string(),
        subtitle: z.string().optional(),
        description: z.string().optional(),
        items: z.array(
          z.object({
            name: z.string(),
            price: z.number().optional(),
            note: z.enum(["each","from","extra"]).optional(),            
          })
        ),
      }),
    ),
  }),
});


const albumData = defineCollection({
  type: "data",
  schema: z.object({
    slug: z.string(),
    count: z.number(),
    items: z.array(
      z.object({
        id: z.string().optional(),
        thumb: z.string(),
        full: z.string(),
        filename: z.string().optional(),
        width: z.number().nullable().optional(),
        height: z.number().nullable().optional(),
      }),
    ),
  }),
});

export const collections = { albumCatalog, albumData };
