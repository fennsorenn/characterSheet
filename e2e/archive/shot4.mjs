import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.setViewportSize({ width: 1000, height: 820 });
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
// Give some shape: DEX 14, a proficient skill, enter edit mode.
const dex = p.locator('.ability', { hasText: 'Dex' }).locator('input');
await dex.click(); await dex.fill('14'); await dex.press('Enter');
await p.locator('.cell', { hasText: 'Skills' }).locator('li', { hasText: 'Perception' }).locator('.dot').click();
await p.click('button.edit');
await p.waitForSelector('.controls');
await p.waitForTimeout(200);
await p.screenshot({ path: '/tmp/sheet-layout-edit.png' });
// Exit edit mode for a clean view with a compact ability row.
await p.locator('.cell', { hasText: 'Ability Scores' }).locator('.controls select').selectOption('compact');
await p.click('button.edit');
await p.waitForTimeout(200);
await p.screenshot({ path: '/tmp/sheet-layout-view.png' });
await b.close();
