import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const p = await b.newPage();
await p.setViewportSize({ width: 950, height: 880 });
await p.addInitScript(() => { localStorage.clear(); indexedDB.deleteDatabase('charactersheet'); });
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.setInputFiles('input[type=file]', '/tmp/5etools.zip');
await p.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });
// Build a small loadout.
const dex = p.locator('.ability', { hasText: 'Dex' }).locator('input');
await dex.click(); await dex.fill('14'); await dex.press('Enter');
for (const [q, label] of [['plate armor','Plate Armor'], ['ring of protection','Ring of Protection'], ['fireball','Fireball']]) {
  await p.fill('.search input', q);
  await p.waitForSelector('.results li .add');
  await p.locator('.results li', { hasText: label }).first().locator('.add').click();
  await p.waitForTimeout(120);
}
// Equip the armor + ring.
const inv = p.locator('.block', { hasText: 'Inventory' });
await inv.locator('li', { hasText: 'Plate Armor' }).locator('input[type=checkbox]').check();
await inv.locator('li', { hasText: 'Ring of Protection' }).locator('input[type=checkbox]').check();
await p.fill('.search input', '');
await p.waitForTimeout(200);
await p.screenshot({ path: '/tmp/sheet-phase3.png' });
await b.close();
