// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const tables = defineCollection({
  type: 'data',
  schema: z.any(), // gern später enger tippen
});

export const collections = { tables };
