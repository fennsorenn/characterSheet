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

// CORS-bypass proxy so the frontend can load a release zip supplied by URL.
// We only proxy https URLs and stream the body straight back to the browser.
app.get('/api/fetch', async (req, res) => {
  const url = req.query.url;
  if (typeof url !== 'string' || !/^https:\/\//i.test(url)) {
    res.status(400).json({ error: 'A valid https url is required.' });
    return;
  }
  try {
    const upstream = await fetch(url, { redirect: 'follow' });
    if (!upstream.ok || !upstream.body) {
      res.status(502).json({ error: `Upstream responded ${upstream.status}` });
      return;
    }
    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') ?? 'application/octet-stream'
    );
    const length = upstream.headers.get('content-length');
    if (length) res.setHeader('Content-Length', length);
    // Stream the Web ReadableStream body to the Node response.
    const reader = upstream.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (err) {
    res.status(502).json({ error: `Proxy fetch failed: ${err.message}` });
  }
});

app.use(express.static(dist));

// SPA fallback: serve index.html for any non-asset route.
app.get('*', (_req, res) => {
  res.sendFile(join(dist, 'index.html'));
});

app.listen(port, () => {
  console.log(`Character sheet running at http://localhost:${port}`);
});
