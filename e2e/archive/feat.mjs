import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.setViewportSize({ width: 1300, height: 1400 });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.setInputFiles('input[type=file]', '/tmp/5etools.zip');
await p.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });

// Level 3 Fighter
const lvl = p.locator('.cell', { hasText: 'Defenses' }).locator('.stat', { hasText: 'Level' }).locator('input');
await lvl.click(); await lvl.fill('3'); await lvl.press('Enter');
await p.waitForTimeout(150);

const feat = p.locator('.cell', { hasText: 'Features' });
// subclass select for Fighter
const subSel = feat.locator('.line', { hasText: 'Fighter subclass' }).locator('select');
const subCount = await subSel.locator('option').count();
await subSel.selectOption({ label: 'Eldritch Knight' }).catch(()=>subSel.selectOption({ index: 1 }));
await p.waitForTimeout(150);

// race via browse
await feat.locator('.line', { hasText: 'Race' }).locator('.choose').click();
await p.waitForSelector('.overlay');
await p.fill('.filters input.search', 'tiefling');
await p.waitForTimeout(200);
await p.locator('.overlay .results li', { hasText: 'Tiefling' }).first().locator('.add').click();
// feat via browse (switch category)
await p.locator('.overlay .cat', { hasText: 'feat' }).click();
await p.fill('.filters input.search', 'magic initiate');
await p.waitForTimeout(200);
await p.locator('.overlay .results li', { hasText: 'Magic Initiate' }).first().locator('.add').click();
await p.locator('.overlay .close').click();
await p.waitForTimeout(250);

// resolved features
const featList = await feat.locator('.features li .fname').evaluateAll(els=>els.map(e=>e.textContent));
const groups = await feat.locator('.features li .grp').evaluateAll(els=>[...new Set(els.map(e=>e.textContent))]);
// granted spells in spell list
const granted = await p.locator('.cell', { hasText: 'Spells' }).locator('li.granted .name').evaluateAll(els=>els.map(e=>e.textContent));
const grantedBy = await p.locator('.cell', { hasText: 'Spells' }).locator('li.granted .src.gby').evaluateAll(els=>[...new Set(els.map(e=>e.textContent))]);

console.log('subclass options:', subCount);
console.log('resolved feature count:', featList.length, '| groups:', groups.join(', '));
console.log('feature names (first 10):', featList.slice(0,10).join(', '));
console.log('granted spells:', granted.join(', '), '| sources:', grantedBy.join(', '));
console.log('errors:', errors.length ? errors.slice(0,3):'none');
// expand first feature to verify body renders
await feat.locator('.features li .fhead').first().click();
await p.waitForTimeout(150);
await feat.screenshot({ path: '/tmp/features.png' });
await b.close();
