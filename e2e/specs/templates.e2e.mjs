import { assert } from '../harness.mjs';

// Layout templates: user-created (no fixed built-ins), preferred per screen-size
// category and per character, and synced between devices once signed in.
// Self-contained: drives the local sheet and the auth routes (no data needed).
export default async function ({ page, baseUrl }) {
  const activeName = () => page.locator('select.preset option:checked').innerText();
  const options = (p = page) => p.locator('select.preset option').allInnerTexts();
  const prefRow = (label) => page.locator(`tr:has(th:has-text("${label}")) td select`);

  await page.goto(`${baseUrl}/local`, { waitUntil: 'networkidle' });
  await page.fill('.new input', 'Template Tester');
  await page.click('.new button.primary');
  await page.waitForSelector('select.preset', { timeout: 10000 });

  // A fresh library seeds the shipped set: one template per screen size × play
  // style, all user-owned (nothing pins or refreshes them).
  const shipped = await options();
  assert(shipped.length === 8, `a fresh library seeds eight templates; got ${shipped.length}`);
  assert(shipped.includes('Desktop — Martial'), 'the shipped names are per size and style');
  // …and it opens on the one preferred for this viewport.
  assert((await activeName()) === 'Desktop — Martial', 'a desktop viewport opens the desktop template');

  // --- Create templates from starting points ---
  await page.click('.tools button:has-text("Templates…")');
  await page.waitForSelector('.manager');
  for (const [name, starter] of [['Phone', 'mobile-caster'], ['Big Screen', 'ultrawide-caster']]) {
    await page.fill('.manager .new input', name);
    await page.selectOption('.manager .new select', starter);
    await page.click('.manager .new button');
    await page.waitForTimeout(200);
  }
  assert((await options()).length === shipped.length + 2, 'created templates join the library');
  assert((await activeName()) === 'Big Screen', 'a new template becomes active');

  // --- Preferred template per screen-size category ---
  await prefRow('Mobile').first().selectOption({ label: 'Phone' });
  await prefRow('Desktop').first().selectOption({ label: 'Big Screen' });
  await page.waitForTimeout(200);

  await page.setViewportSize({ width: 500, height: 1400 });
  await page.waitForTimeout(300);
  assert((await activeName()) === 'Phone', 'a mobile viewport switches to the mobile template');
  await page.setViewportSize({ width: 1200, height: 2100 });
  await page.waitForTimeout(300);
  assert((await activeName()) === 'Big Screen', 'a desktop viewport switches back');

  // --- A character's own choice overrides the library-wide preference ---
  await prefRow('Desktop').nth(1).selectOption({ label: 'Phone' });
  await page.waitForTimeout(300);
  assert((await activeName()) === 'Phone', "the character's own template wins");
  const doc = await page.evaluate(() => JSON.parse(localStorage.getItem('cs.char.template-tester')));
  assert(Object.keys(doc.layoutPrefs ?? {}).length === 1, 'the choice is stored on the character');

  // --- Both survive a reload ---
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('select.preset');
  await page.waitForTimeout(300);
  assert((await options()).length === shipped.length + 2, 'templates survive a reload');
  assert((await activeName()) === 'Phone', 'preferences survive a reload');

  // --- Sign up: the library is pushed to the server ---
  const user = 'tpl' + Math.floor(Math.random() * 1e9);
  await page.goto(`${baseUrl}/signup`, { waitUntil: 'networkidle' });
  await page.fill('input[autocomplete=username]', user);
  await page.fill('input[type=password]', 'secret123');
  await page.click('button.primary');
  await page.waitForTimeout(1500); // the push is debounced
  const stored = await page.evaluate(() =>
    fetch('/api/templates', { credentials: 'same-origin' }).then((r) => r.json())
  );
  assert(
    stored.templates?.library?.layouts?.length === shipped.length + 2,
    'the library reaches the server'
  );

  // --- Another device signs in and inherits templates *and* preferences ---
  const ctx = await page.context().browser().newContext({ viewport: { width: 1200, height: 2100 } });
  const other = await ctx.newPage();
  try {
    await other.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
    await other.fill('input[autocomplete=username]', user);
    await other.fill('input[type=password]', 'secret123');
    await other.click('button.primary');
    await other.waitForTimeout(800);
    await other.fill('.new input', 'Remote Hero');
    await other.click('.new button.primary');
    await other.waitForSelector('select.preset', { timeout: 10000 });
    await other.waitForTimeout(400);

    const remote = await options(other);
    assert(remote.includes('Phone') && remote.includes('Big Screen'), 'templates follow the user');
    await other.setViewportSize({ width: 500, height: 1400 });
    await other.waitForTimeout(400);
    const remoteActive = await other.locator('select.preset option:checked').innerText();
    assert(remoteActive === 'Phone', 'screen-size preferences follow the user');

    // --- An edit there flows back to the server for the first device ---
    await other.setViewportSize({ width: 1200, height: 2100 });
    await other.click('.tools button:has-text("Templates…")');
    await other.fill('.manager .new input', 'From Device Two');
    await other.click('.manager .new button');
    await other.waitForTimeout(1500);
    const after = await page.evaluate(() =>
      fetch('/api/templates', { credentials: 'same-origin' }).then((r) => r.json())
    );
    assert(
      after.templates.library.layouts.length === shipped.length + 3,
      "the other device's edit is saved"
    );
  } finally {
    await ctx.close();
  }
}
