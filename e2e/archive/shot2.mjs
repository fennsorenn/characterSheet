import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const p = await b.newPage();
await p.setViewportSize({ width: 900, height: 820 });
await p.addInitScript(() => localStorage.clear());
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
// Give the character some shape: DEX 16, a couple skills, proficient saves shown.
const dex = p.locator('.ability', { hasText: 'Dex' }).locator('input');
await dex.click(); await dex.fill('16'); await dex.press('Enter');
// Mark Perception proficient and Stealth expertise.
await p.locator('li', { hasText: 'Perception' }).locator('.dot').click();
await p.locator('li', { hasText: 'Stealth' }).locator('.dot').click();
await p.locator('li', { hasText: 'Stealth' }).locator('.dot').click();
await p.waitForTimeout(150);
// Open explain on Passive Perception to show a deep tree.
await p.locator('.stat', { hasText: 'Passive' }).locator('.stat-value').click();
await p.waitForSelector('.modal');
await p.waitForTimeout(150);
await p.screenshot({ path: '/tmp/sheet-phase2.png' });
await b.close();
