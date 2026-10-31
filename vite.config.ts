import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works on GitHub Pages under /game/.
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: { environment: 'node' },
});
