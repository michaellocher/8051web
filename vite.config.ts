import { defineConfig } from 'vite';

// Rein statische Seite – `vite build` erzeugt dist/ für jeden Static-Host.
export default defineConfig({
  base: './',
  build: {
    target: 'es2024',
    outDir: 'dist',
  },
  server: { port: 4321 },
  preview: { port: 4321 },
});
