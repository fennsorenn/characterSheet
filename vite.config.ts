import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Vitest config lives alongside Vite config so the calc engine and Svelte
// components share one toolchain.
export default defineConfig({
  plugins: [svelte()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts']
  }
});
