// astro.config.mjs
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  vite: {
    build: {
      assetsInlineLimit: 0
    },             
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@Pages': fileURLToPath(new URL('./src/components/Pages', import.meta.url)),
        '@Styles': fileURLToPath(new URL('./src/styles', import.meta.url)),
        '@Design': fileURLToPath(new URL('./src/components/Design', import.meta.url)),
        '@Content': fileURLToPath(new URL('./src/content', import.meta.url)),
        '@Assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
        '@Scripts': fileURLToPath(new URL('./src/scripts', import.meta.url)),
      }
    }
  }
});
