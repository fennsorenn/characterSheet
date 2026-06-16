import { execSync, spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Tiny browser-test harness for the character sheet.
 *
 * The app loads its (user-supplied, copyrighted) 5etools data at runtime, so the
 * e2e suite is seeded from a zip pointed to by the `E2E_DATA_ZIP` env var — a URL
 * (downloaded) or a local path. With it unset the suite skips, so the repo stays
 * data-free and CI without data is a no-op rather than a failure.
 *
 * Playwright is expected to be resolvable (preinstalled globally in the dev
 * container; elsewhere `npm i -D playwright`). We don't add it to the manifest.
 *
 * Env:
 *   E2E_DATA_ZIP   URL or path to the 5etools data zip (required; else skip)
 *   E2E_BASE_URL   use an already-running server instead of spawning vite
 *   E2E_PORT       port to spawn vite on (default 4321)
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Resolve Playwright (CommonJS) from a local dep or the global install. */
export async function loadPlaywright() {
  // playwright is CJS; ESM interop puts the exports on `.default`.
  const pick = (m) => (m && m.chromium ? m : m?.default ?? m);
  try {
    return pick(await import('playwright'));
  } catch {
    const root = execSync('npm root -g').toString().trim();
    return pick(await import(pathToFileURL(join(root, 'playwright', 'index.js')).href));
  }
}

/** Resolve the data zip to a local file path, downloading a URL if needed. Null when unset. */
export async function resolveZip() {
  const src = process.env.E2E_DATA_ZIP;
  if (!src) return null;
  if (!/^https?:\/\//.test(src)) return src;
  const dir = await mkdtemp(join(tmpdir(), 'charsheet-e2e-'));
  const dest = join(dir, 'data.zip');
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Failed to download E2E_DATA_ZIP (HTTP ${res.status})`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

async function waitForServer(url, timeout = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(300);
  }
  throw new Error(`Dev server never became reachable at ${url}`);
}

/** Use E2E_BASE_URL if given, else spawn `vite` and tear it down on stop(). */
export async function ensureServer() {
  if (process.env.E2E_BASE_URL) {
    await waitForServer(process.env.E2E_BASE_URL);
    return { url: process.env.E2E_BASE_URL, stop: async () => {} };
  }
  const port = Number(process.env.E2E_PORT || 4321);
  const url = `http://localhost:${port}`;
  const proc = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
    stdio: 'ignore',
    detached: false,
    // Isolate the auth/character store for the test run.
    env: { ...process.env, CS_DATA_FILE: process.env.CS_DATA_FILE || '/tmp/cs-e2e-data.json' }
  });
  await waitForServer(url);
  return {
    url,
    stop: async () => {
      try {
        proc.kill('SIGTERM');
      } catch {
        /* already gone */
      }
    }
  };
}

const TEST_SLUG = 'test';
const sheetUrl = (baseUrl) => `${baseUrl.replace(/\/$/, '')}/local/${TEST_SLUG}`;

/** Open a fresh local character sheet at /local/test and load the dataset into it. */
export async function seed(page, baseUrl, zipPath) {
  await page.goto(sheetUrl(baseUrl), { waitUntil: 'networkidle' });
  await page.setInputFiles('input[type=file]', zipPath);
  await page.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });
  await page.waitForSelector('.cell', { timeout: 10000 });
}

/** Replace the test character document and reopen its sheet (data stays cached). */
export async function seedCharacter(page, baseUrl, doc) {
  await page.evaluate(
    ({ slug, d }) => {
      localStorage.setItem(`cs.char.${slug}`, JSON.stringify(d));
      localStorage.setItem('cs.local.index', JSON.stringify([{ slug, name: d.name || 'Test', updatedAt: Date.now() }]));
    },
    { slug: TEST_SLUG, d: doc }
  );
  await page.goto(sheetUrl(baseUrl), { waitUntil: 'networkidle' });
  await page.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });
}

/** Merge a patch into the test character (abilities merged) and reopen its sheet. */
export async function patchCharacter(page, baseUrl, patch) {
  await page.evaluate(
    ({ slug, pt }) => {
      const cur = JSON.parse(localStorage.getItem(`cs.char.${slug}`) || '{}');
      Object.assign(cur, pt, { abilities: { ...(cur.abilities || {}), ...(pt.abilities || {}) } });
      localStorage.setItem(`cs.char.${slug}`, JSON.stringify(cur));
      localStorage.setItem('cs.local.index', JSON.stringify([{ slug, name: cur.name || 'Test', updatedAt: Date.now() }]));
    },
    { slug: TEST_SLUG, pt: patch }
  );
  await page.goto(sheetUrl(baseUrl), { waitUntil: 'networkidle' });
  await page.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });
}

// --- assertions -------------------------------------------------------------

export function assert(cond, message) {
  if (!cond) throw new Error(`assertion failed: ${message}`);
}
export function assertEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`assertion failed: ${message}\n  expected ${e}\n  actual   ${a}`);
}

// --- shared UI helpers ------------------------------------------------------

export const cell = (page, title) => page.locator('.cell', { hasText: title });

/** Add a race or feat via the Features block's browse overlay. */
export async function browseAdd(page, kind, name) {
  const features = cell(page, 'Features & Traits');
  if (kind === 'race') await features.locator('.line', { hasText: 'Race' }).locator('.choose').click();
  else await features.locator('.line.feats .choose', { hasText: 'Feat' }).click();
  await page.waitForSelector('.overlay', { timeout: 5000 });
  await page.fill('.overlay input.search', name);
  await page.waitForTimeout(350);
  await page.locator('.overlay .results li', { hasText: name }).first().locator('.add').click({ force: true });
  await page.waitForTimeout(150);
  await page.locator('.overlay .close').click();
  await page.waitForSelector('.overlay', { state: 'detached', timeout: 5000 });
  await page.waitForTimeout(150);
}

/** Add a class from the catalog via the Features block's "+ Class" browse. */
export async function addClassFromCatalog(page, name) {
  const line = cell(page, 'Features & Traits').locator('.line.classes');
  await line.locator('.choose', { hasText: 'Class' }).click();
  await page.waitForSelector('.overlay', { timeout: 5000 });
  await page.fill('.overlay input.search', name);
  await page.waitForTimeout(300);
  await page.locator('.overlay .results li', { hasText: name }).first().locator('.add').click({ force: true });
  await page.waitForTimeout(150);
  await page.locator('.overlay .close').click();
  await page.waitForSelector('.overlay', { state: 'detached', timeout: 5000 });
  await page.waitForTimeout(150);
}

/** Multiclass into a catalog class via the Level Up modal's class picker. */
export async function multiclass(page, name, source = 'PHB') {
  await cell(page, 'Rest & Level Up').locator('button.levelup').click();
  await page.waitForSelector('.modal', { timeout: 5000 });
  await page.locator('.modal .row select').first().selectOption('new');
  await page.locator('.modal .newclass select').selectOption(`${name}|${source}`);
  await page.locator('.modal .confirm').click();
  await page.waitForTimeout(300);
}

/** Set an ability score's base value. */
export async function setAbility(page, label, value) {
  const input = page.locator('.ability', { hasText: label }).first().locator('input').first();
  await input.click();
  await input.fill(String(value));
  await input.press('Enter');
  await page.waitForTimeout(150);
}

/** Set the character's (first class) level via the Defenses block. */
export async function setLevel(page, value) {
  const input = cell(page, 'Defenses').locator('.stat', { hasText: 'Level' }).locator('input');
  await input.click();
  await input.fill(String(value));
  await input.press('Enter');
  await page.waitForTimeout(200);
}
