import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.setViewportSize({ width: 1280, height: 900 });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.setInputFiles('input[type=file]', '/tmp/5etools.zip');
await p.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });
await p.click('button.browse');
await p.waitForSelector('.overlay');
await p.locator('.cat', { hasText: 'spell' }).click();
await p.waitForTimeout(200);
const total = await p.locator('.count').innerText();
// Class = Druid
await p.locator('.facet', { hasText: 'Class' }).first().locator('.chip', { hasText: 'Druid' }).click();
await p.waitForTimeout(200);
const druid = await p.locator('.count').innerText();
// add a subclass on top: Land (a druid subclass) if present in narrowed options
const subOpts = await p.locator('.facet', { hasText: 'Subclass' }).locator('.chip').evaluateAll(els=>els.slice(0,8).map(e=>e.textContent.replace(/\d+$/,'').trim()));
console.log('spells total:', total.trim());
console.log('Druid class spells:', druid.trim());
console.log('Subclass options (cross-filtered to Druid):', subOpts.join(', '));
console.log('errors:', errors.length ? errors.slice(0,3):'none');
await p.locator('.overlay').screenshot({ path: '/tmp/classfacet.png' });
await b.close();
