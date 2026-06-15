import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const p = await b.newPage();
await p.setViewportSize({ width: 900, height: 1000 });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));
await p.addInitScript(() => localStorage.clear());
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

// Read AC before, set DEX score to 18, read AC after (should jump by +4 over base 10/14...).
const acBefore = await p.textContent('.stat.big .v .stat-value');
// DEX is the 2nd ability score field.
const dexInput = p.locator('.ability', { hasText: 'Dex' }).locator('input');
await dexInput.click();
await dexInput.fill('18');
await dexInput.press('Enter');
await p.waitForTimeout(150);
const dexMod = await p.locator('.ability', { hasText: 'Dex' }).locator('.stat-value').textContent();
const acAfter = await p.textContent('.stat.big .v .stat-value');

// Test delta entry: +2 on STR.
const strInput = p.locator('.ability', { hasText: 'Str' }).locator('input');
await strInput.click(); await strInput.fill('+4'); await strInput.press('Enter');
await p.waitForTimeout(100);
const strMod = await p.locator('.ability', { hasText: 'Str' }).locator('.stat-value').textContent();

// Open the explain popover on AC.
await p.click('.stat.big .v .stat-value');
await p.waitForSelector('.modal', { timeout: 3000 });
const modalTitle = await p.textContent('.modal h2');
const treeLabels = await p.$$eval('.modal .node .label', els => els.map(e=>e.textContent).slice(0,6));

console.log('AC before:', acBefore, '| DEX mod now:', dexMod, '| AC after:', acAfter);
console.log('STR mod after +4 delta:', strMod);
console.log('explain title:', modalTitle);
console.log('explain tree:', treeLabels.join(' / '));
console.log('console errors:', errors.length ? errors.slice(0,3) : 'none');
await p.screenshot({ path: '/tmp/sheet-phase2.png' });
await b.close();
