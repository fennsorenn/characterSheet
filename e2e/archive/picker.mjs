import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.setViewportSize({ width: 1000, height: 1400 });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.setInputFiles('input[type=file]', '/tmp/5etools.zip');
await p.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });
const feat = p.locator('.cell', { hasText: 'Features & Traits' });
// add a feat with choose spells
await feat.locator('.line.feats .choose').click();
await p.waitForSelector('.overlay');
// browse opened on race? we want feat. The choose button calls openBrowse('feat')
await p.fill('.filters input.search', 'aberrant dragonmark');
await p.waitForTimeout(300);
await p.locator('.overlay .results li', { hasText: 'Aberrant Dragonmark' }).first().locator('.add').click();
await p.locator('.overlay .close').click();
await p.waitForTimeout(300);

// expand the feat & count choice pills
const fli = feat.locator('.features li', { hasText: 'Aberrant Dragonmark' });
await fli.locator('.fhead').click();
await p.waitForTimeout(200);
const emptyPills = await fli.locator('.pill.empty').count();
console.log('choice pills (empty):', emptyPills);

// click first "+ choose spell" → picker opens
await fli.locator('.pill.empty').first().click();
await p.waitForSelector('.modal h2');
const pickerLabel = await p.locator('.modal h2').innerText();
const matchCount = await p.locator('.modal .count').innerText();
const firstSpell = await p.locator('.modal .row .nm').first().innerText();
await p.locator('.modal .row').first().click();
await p.waitForTimeout(200);

// pill now shows the picked spell
const pickedName = await fli.locator('.pill.picked .pname').first().innerText().catch(()=>'(none)');
// spell appears as granted in spell list
const granted = await p.locator('.cell', { hasText: 'Spells' }).locator('li.granted .name').evaluateAll(els=>els.map(e=>e.textContent));
const grantedBy = await p.locator('.cell', { hasText: 'Spells' }).locator('li.granted .src.gby').evaluateAll(els=>[...new Set(els.map(e=>e.textContent))]);

console.log('picker label:', pickerLabel, '|', matchCount.trim(), '| first option:', firstSpell);
console.log('picked pill:', pickedName);
console.log('granted in spell list:', granted.join(', '), '| from:', grantedBy.join(', '));
console.log('errors:', errors.length ? errors.slice(0,3):'none');
await fli.screenshot({ path: '/tmp/picker.png' });
await b.close();
