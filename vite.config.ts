import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';

/** Build id shown in the parent dashboard and stored with every launch event. */
function build(): string {
  const date = new Date().toISOString().slice(0, 10);
  try {
    return `${date}-${execSync('git rev-parse --short HEAD').toString().trim()}`;
  } catch {
    return date;
  }
}

export default defineConfig({
  // Relative base so the build works on GitHub Pages under /game/.
  base: './',
  define: { 'import.meta.env.VITE_BUILD': JSON.stringify(build()) },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: { environment: 'node' },
});
