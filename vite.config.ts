import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { apiMiddleware } from './server/api.mjs';

// Vitest config lives alongside Vite config so the calc engine and Svelte
// components share one toolchain. A tiny plugin mounts the auth/character API
// during dev so the SPA talks to the same `/api/*` endpoints as in prod.
export default defineConfig({
  plugins: [
    svelte(),
    {
      name: 'character-api',
      configureServer(server) {
        server.middlewares.use(apiMiddleware);
      }
    }
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'server/**/*.test.mjs']
  }
});
