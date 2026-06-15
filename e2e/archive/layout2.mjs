import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.setViewportSize({ width: 1000, height: 1000 });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

const count = () => p.$$eval('.grid > .cell', els => els.length);
console.log('initial cells:', await count());

await p.click('button.edit');
await p.waitForSelector('.controls');

await p.selectOption('.tools select', 'skills');
await p.waitForTimeout(150);
console.log('after add skills:', await count());

await p.locator('.cell', { hasText: 'Spells' }).locator('button[title="Remove"]').click();
await p.waitForTimeout(150);
console.log('after remove spells:', await count());

// Change ability variant + move defenses up, then reload (no storage clear).
await p.locator('.cell', { hasText: 'Ability Scores' }).locator('.controls select').selectOption('compact');
await p.locator('.cell', { hasText: 'Defenses' }).locator('button[title="Move up"]').click();
await p.waitForTimeout(150);
const orderPre = await p.$$eval('.grid > .cell .block h3', els => els.slice(0,2).map(e=>e.textContent));

await p.reload({ waitUntil: 'networkidle' });
const orderPost = await p.$$eval('.grid > .cell .block h3', els => els.slice(0,2).map(e=>e.textContent));
const variantPost = await p.locator('.cell', { hasText: 'Ability Scores' }).locator('.block').getAttribute('data-variant');
console.log('order before reload:', orderPre.join(' | '));
console.log('order after reload :', orderPost.join(' | '), '| ability variant:', variantPost);
console.log('errors:', errors.length ? errors.slice(0,3) : 'none');
await b.close();
