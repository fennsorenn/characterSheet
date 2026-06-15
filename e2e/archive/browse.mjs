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
const totalItems = await p.locator('.count').innerText();

// Filter items: Rarity=rare AND Requires attunement.
await p.locator('.facet', { hasText: 'Rarity' }).locator('.chip', { hasText: 'Rare' }).first().click();
await p.waitForTimeout(150);
const afterRare = await p.locator('.count').innerText();
await p.locator('.facet', { hasText: 'Attunement' }).locator('.chip', { hasText: 'Requires attunement' }).click();
await p.waitForTimeout(150);
const afterAttune = await p.locator('.count').innerText();
// name search
await p.fill('.filters input.search', 'ring');
await p.waitForTimeout(150);
const afterName = await p.locator('.count').innerText();
const firstResult = await p.locator('.results li .nm').first().innerText();
// add the first result
await p.locator('.results li .add').first().click();
await p.waitForTimeout(100);
const addedLabel = await p.locator('.results li .add').first().innerText();

// Switch to spells, filter by school + level.
await p.locator('.cat', { hasText: 'spell' }).click();
await p.waitForTimeout(150);
const spellTotal = await p.locator('.count').innerText();
await p.locator('.facet', { hasText: 'School' }).locator('.chip', { hasText: 'Evocation' }).click();
await p.locator('.facet', { hasText: 'Level' }).locator('.chip', { hasText: 'Cantrip' }).click();
await p.waitForTimeout(150);
const spellFiltered = await p.locator('.count').innerText();
const spellNames = await p.locator('.results li .nm').evaluateAll(els => els.slice(0,6).map(e=>e.textContent));

console.log('items total:', totalItems.trim());
console.log('  + rare:', afterRare.trim(), '| + attune:', afterAttune.trim(), '| + name "ring":', afterName.trim());
console.log('  first result:', firstResult, '| add button after click:', addedLabel.trim());
console.log('spells total:', spellTotal.trim(), '| evocation cantrips:', spellFiltered.trim());
console.log('  ->', spellNames.join(', '));
console.log('errors:', errors.length ? errors.slice(0,3) : 'none');
await p.screenshot({ path: '/tmp/browse.png' });
await b.close();
