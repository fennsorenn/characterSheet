import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.setViewportSize({ width: 1100, height: 1000 });
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.setInputFiles('input[type=file]', '/tmp/5etools.zip');
await p.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });
async function attune(q, label) {
  await p.fill('.search input', q);
  await p.waitForSelector('.results li .add');
  await p.locator('.results li', { hasText: label }).first().locator('.add').click();
  await p.waitForTimeout(150);
  const it = p.locator('.cell', { hasText: 'Inventory' }).locator('li', { hasText: label }).first();
  await it.locator('input[type=checkbox]').check();
  await it.locator('button.attune').click();
  await p.waitForTimeout(150);
}
await attune('headband of intellect', 'Headband of Intellect');
await attune('belt of hill giant', 'Belt of Hill Giant Strength');
await p.waitForTimeout(250);
await p.locator('.cell', { hasText: 'Ability Scores' }).first().screenshot({ path: '/tmp/icon3.png' });
await b.close();
