import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.setViewportSize({ width: 1100, height: 760 });
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
const strBox = p.locator('.ability', { hasText: 'Str' }).first();
const si = strBox.locator('input'); await si.click(); await si.fill('14'); await si.press('Enter');
await p.click('button.buff');
await p.waitForSelector('.buff-banner');
// buff a couple values
const sb = strBox.locator('.buff-field'); await sb.click(); await sb.fill('+2'); await sb.press('Enter');
const acf = p.locator('.cell', { hasText: 'Defenses' }).locator('.stat.big .buff-field'); await acf.click(); await acf.fill('+3'); await acf.press('Enter');
await p.waitForTimeout(200);
await p.screenshot({ path: '/tmp/buff.png', clip: { x: 0, y: 0, width: 1100, height: 470 } });
await b.close();
