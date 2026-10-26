import { defineConfig } from 'vite';

// Relative base so the build works under any GitHub Pages path (user.github.io/repo/)
export default defineConfig({
  base: './',
  build: { outDir: 'dist', chunkSizeWarningLimit: 1500 }
});
