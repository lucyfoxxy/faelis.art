import { defineCollection, z } from 'astro:content';

const priceItem = z.object({
  name: z.string(),
  price: z.number(),
  note: z.string().optional(),
});

const priceCategory = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  items: z.array(priceItem),
});

const tables = defineCollection({
  type: 'data',
  schema: z.object({
    currency: z.string().default('EUR'),
    categories: z.array(priceCategory)
  })
});

const galleries = defineCollection({
  type: 'data',
  schema: z.any(),
});
export const collections = { tables, galleries };
