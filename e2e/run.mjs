import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadPlaywright, resolveZip, ensureServer, seed } from './harness.mjs';

/**
 * Runs every `specs/*.e2e.mjs` against a real browser. Each spec is a default
 * export `async ({ page, baseUrl, errors }) => {}` that throws on failure. The
 * page is freshly seeded (dataset loaded, character/layout reset) per spec.
 *
 *   E2E_DATA_ZIP=/path/to/5etools.zip npm run e2e
 *   E2E_DATA_ZIP=https://…/data.zip   npm run e2e        # downloaded
 *   E2E_DATA_ZIP=… E2E_BASE_URL=http://localhost:3000 npm run e2e   # reuse server
 *   E2E_DATA_ZIP=… E2E_SPEC=grants npm run e2e           # filter specs by name
 */

const here = dirname(fileURLToPath(import.meta.url));

const zip = await resolveZip();
if (!zip) {
  console.log('⚠ e2e skipped — set E2E_DATA_ZIP to a 5etools data zip (URL or path).');
  process.exit(0);
}

const { chromium } = await loadPlaywright();
const filter = process.env.E2E_SPEC;
const specs = (await readdir(join(here, 'specs')))
  .filter((f) => f.endsWith('.e2e.mjs'))
  .filter((f) => !filter || f.includes(filter))
  .sort();

if (!specs.length) {
  console.log('No matching specs.');
  process.exit(0);
}

const server = await ensureServer();
const browser = await chromium.launch();
let failed = 0;

for (const file of specs) {
  const mod = await import(pathToFileURL(join(here, 'specs', file)).href);
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 2100 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    // Ignore failed network responses (e.g. expected 401s in the auth flow);
    // they're HTTP statuses, not JavaScript errors.
    if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text());
  });
  const t0 = Date.now();
  try {
    await seed(page, server.url, zip);
    await mod.default({ page, baseUrl: server.url, errors });
    if (errors.length) throw new Error(`console/page errors:\n  ${errors.slice(0, 3).join('\n  ')}`);
    console.log(`✓ ${file} (${Date.now() - t0}ms)`);
  } catch (e) {
    failed++;
    console.error(`✗ ${file}\n  ${e.message}`);
  }
  await ctx.close();
}

await browser.close();
await server.stop();

console.log(failed ? `\n${failed}/${specs.length} spec(s) failed` : `\nall ${specs.length} specs passed`);
process.exit(failed ? 1 : 0);
