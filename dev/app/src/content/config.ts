// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const pages = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().optional(),
    layout: z.string().optional(),
    description: z.string().optional(),
  }),
});

const tables = defineCollection({
  type: 'data',
  schema: z.any(), // gern später enger tippen
});

export const collections = { pages, tables };
