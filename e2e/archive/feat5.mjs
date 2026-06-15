import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.setViewportSize({ width: 920, height: 1500 });
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.setInputFiles('input[type=file]', '/tmp/5etools.zip');
await p.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });
// level 3
const lvl = p.locator('.cell', { hasText: 'Defenses' }).locator('.stat', { hasText: 'Level' }).locator('input');
await lvl.click(); await lvl.fill('3'); await lvl.press('Enter'); await p.waitForTimeout(150);
const feat = p.locator('.cell', { hasText: 'Features' });
// subclass
await feat.locator('.line', { hasText: 'Fighter subclass' }).locator('select').selectOption({ index: 2 });
// race Duergar
await feat.locator('.line', { hasText: 'Race' }).locator('.choose').click();
await p.waitForSelector('.overlay');
await p.fill('.filters input.search', 'duergar');
await p.waitForTimeout(300);
await p.locator('.overlay .results li', { hasText: 'Duergar' }).first().locator('.add').click();
await p.locator('.overlay .close').click();
await p.waitForTimeout(300);
const granted = await p.locator('.cell', { hasText: 'Spells' }).locator('li.granted .name').evaluateAll(els=>els.map(e=>e.textContent));
const grantedBy = await p.locator('.cell', { hasText: 'Spells' }).locator('li.granted .src.gby').evaluateAll(els=>[...new Set(els.map(e=>e.textContent))]);
await feat.locator('.features li .fhead').nth(1).click();
await p.waitForTimeout(150);
console.log('granted at L3:', granted.join(', '), '| from:', grantedBy.join(', '));
await feat.screenshot({ path: '/tmp/features.png' });
await b.close();
