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
const feat = p.locator('.cell', { hasText: 'Features' });

// Race via browse
await feat.locator('.line', { hasText: 'Race' }).locator('.choose').click();
await p.waitForSelector('.overlay', { timeout: 5000 });
await p.fill('.filters input.search', 'tiefling');
await p.waitForTimeout(250);
await p.locator('.overlay .results li', { hasText: 'Tiefling' }).first().locator('.add').click();
// Feat
await p.locator('.overlay .cat', { hasText: 'feat' }).click();
await p.waitForTimeout(150);
await p.fill('.filters input.search', 'magic initiate');
await p.waitForTimeout(250);
await p.locator('.overlay .results li', { hasText: 'Magic Initiate' }).first().locator('.add').click();
await p.locator('.overlay .close').click();
await p.waitForTimeout(300);

const raceSet = await feat.locator('.line', { hasText: 'Race' }).locator('.v').innerText().catch(()=>'(none)');
const feats = await feat.locator('.line.feats .chip').evaluateAll(els=>els.map(e=>e.textContent.replace('×','').trim()));
const names = await feat.locator('.features li .fname').evaluateAll(els=>els.map(e=>e.textContent));
const granted = await p.locator('.cell', { hasText: 'Spells' }).locator('li.granted .name').evaluateAll(els=>els.map(e=>e.textContent));
const grantedBy = await p.locator('.cell', { hasText: 'Spells' }).locator('li.granted .src.gby').evaluateAll(els=>[...new Set(els.map(e=>e.textContent))]);
// expand a feature
await feat.locator('.features li', { hasText: 'Tiefling' }).locator('.fhead').click().catch(()=>{});
await p.waitForTimeout(150);
console.log('race set:', raceSet, '| feats:', feats.join(', '));
console.log('feature names:', names.join(', '));
console.log('granted spells:', granted.join(', '), '| from:', grantedBy.join(', '));
console.log('errors:', errors.length ? errors.slice(0,3):'none');
await feat.screenshot({ path: '/tmp/features.png' });
await b.close();
