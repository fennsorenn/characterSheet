import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { apiMiddleware } from './api.mjs';

// Static server for the built SPA + the auth/character-sync API.
const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, '..', 'dist');
const port = process.env.PORT || 3000;

const app = express();

// Auth + character sync (shared with the Vite dev server).
app.use(apiMiddleware);

if (!existsSync(dist)) {
  console.warn('dist/ not found — run `npm run build` first.');
}

// Note: the `/api/fetch` CORS-bypass proxy is handled by apiMiddleware (above),
// so it works under both the Vite dev server and this Express server.

app.use(express.static(dist));

// SPA fallback: serve index.html for any non-asset route.
app.get('*', (_req, res) => {
  res.sendFile(join(dist, 'index.html'));
});

app.listen(port, () => {
  console.log(`Character sheet running at http://localhost:${port}`);
});
