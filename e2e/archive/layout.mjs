import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const p = await b.newPage();
await p.setViewportSize({ width: 1000, height: 1000 });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));
await p.addInitScript(() => { localStorage.clear(); });
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

// Default layout: count blocks and their order.
const order0 = await p.$$eval('.grid .cell .block', els => els.map(e => e.querySelector('h3')?.textContent));
console.log('default block order:', order0.join(' | '));

// Enter edit mode.
await p.click('button.edit');
await p.waitForSelector('.controls');
const controlsCount = await p.$$eval('.controls', els => els.length);
console.log('edit mode: control bars =', controlsCount);

// Switch Ability Scores to compact variant via its select.
const abilCell = p.locator('.cell', { hasText: 'Ability Scores' });
await abilCell.locator('.controls select').selectOption('compact');
await p.waitForTimeout(150);
const abilVariant = await abilCell.locator('.block').getAttribute('data-variant');
console.log('ability scores variant now:', abilVariant);

// Resize Saves (cycle size button) and read class.
const savesCell = p.locator('.cell', { hasText: 'Saving Throws' });
const sizeBefore = await savesCell.getAttribute('class');
await savesCell.locator('.controls button[title="Resize"]').click();
await p.waitForTimeout(100);
const sizeAfter = await savesCell.getAttribute('class');
console.log('saves size:', sizeBefore.match(/size-\w+/)[0], '->', sizeAfter.match(/size-\w+/)[0]);

// Move Defenses up (above Ability Scores).
await p.locator('.cell', { hasText: 'Defenses' }).locator('button[title="Move up"]').click();
await p.waitForTimeout(100);
const order1 = await p.$$eval('.grid .cell .block', els => els.map(e => e.querySelector('h3')?.textContent));
console.log('after move-up:', order1.slice(0,2).join(' | '));

// Add a block (Skills again) and remove one (Spells).
await p.selectOption('.tools select', 'skills');
await p.waitForTimeout(100);
await p.locator('.cell', { hasText: 'Spells' }).locator('button[title="Remove"]').click();
await p.waitForTimeout(100);
const count1 = await p.$$eval('.grid .cell', els => els.length);
console.log('block count after +skills -spells:', count1);

// Reload to verify persistence.
await p.reload({ waitUntil: 'networkidle' });
const order2 = await p.$$eval('.grid .cell .block', els => els.map(e => e.querySelector('h3')?.textContent));
const abilVariant2 = await p.locator('.cell', { hasText: 'Ability Scores' }).locator('.block').getAttribute('data-variant');
console.log('after reload order[0..1]:', order2.slice(0,2).join(' | '), '| ability variant persisted:', abilVariant2);

console.log('console errors:', errors.length ? errors.slice(0,3) : 'none');
await b.close();
