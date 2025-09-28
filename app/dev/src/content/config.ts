import { defineCollection, z } from 'astro:content';

const priceItem = z.object({
  name: z.string(),
  price: z.number().optional(),
  from: z.number().optional(),
  to: z.number().optional(),
  unit: z.string().optional(),
  note: z.string().optional(),
  link: z.string().optional(),
});

const priceCategory = z.object({
  title: z.string(),
  slug: z.string().optional(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  items: z.array(priceItem),
});

const categories = defineCollection({
  type: 'data',
  schema: z.object({
    currency: z.string().default('EUR'),
    categories: z.array(priceCategory),
  }),
});

export const collections = { categories };
