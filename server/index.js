import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

// Minimal static server for the built SPA. The app is frontend-only today;
// this is where an optional cloud-sync API would later attach.
const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, '..', 'dist');
const port = process.env.PORT || 3000;

const app = express();

if (!existsSync(dist)) {
  console.warn('dist/ not found — run `npm run build` first.');
}

app.use(express.static(dist));

// SPA fallback: serve index.html for any non-asset route.
app.get('*', (_req, res) => {
  res.sendFile(join(dist, 'index.html'));
});

app.listen(port, () => {
  console.log(`Character sheet running at http://localhost:${port}`);
});
