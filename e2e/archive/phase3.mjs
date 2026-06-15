import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const p = await b.newPage();
await p.setViewportSize({ width: 950, height: 1000 });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));
await p.addInitScript(() => { localStorage.clear(); indexedDB.deleteDatabase('charactersheet'); });
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

// Load the dataset (file import).
await p.setInputFiles('input[type=file]', '/tmp/5etools.zip');
await p.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });

const acStart = await p.textContent('.stat.big .v .stat-value');

// Quick-import: search Plate, add it.
await p.fill('.search input', 'plate armor');
await p.waitForSelector('.results li .add');
await p.locator('.results li', { hasText: 'Plate Armor' }).first().locator('.add').click();
await p.waitForTimeout(150);

// Equip it in inventory.
await p.locator('.block', { hasText: 'Inventory' }).locator('input[type=checkbox]').first().check();
await p.waitForTimeout(200);
const acEquipped = await p.textContent('.stat.big .v .stat-value');

// Add a Ring of Protection and equip → AC +1 and saves +1.
await p.fill('.search input', 'ring of protection');
await p.waitForSelector('.results li .add');
await p.locator('.results li', { hasText: 'Ring of Protection' }).first().locator('.add').click();
await p.waitForTimeout(150);
await p.locator('.block', { hasText: 'Inventory' }).locator('li', { hasText: 'Ring of Protection' }).locator('input[type=checkbox]').check();
await p.waitForTimeout(200);
const acRing = await p.textContent('.stat.big .v .stat-value');

// Open explain on AC to confirm sources show.
await p.click('.stat.big .v .stat-value');
await p.waitForSelector('.modal');
const mods = await p.$$eval('.modal .mod', els => els.map(e => e.textContent.trim()));
const title = await p.textContent('.modal h2');

console.log('AC unarmored:', acStart, '| after Plate:', acEquipped, '| after Ring:', acRing);
console.log('explain:', title);
console.log('AC modifiers in explain:', mods);
console.log('console errors:', errors.length ? errors.slice(0,3) : 'none');
await p.screenshot({ path: '/tmp/sheet-phase3.png', fullPage: true });
await b.close();
