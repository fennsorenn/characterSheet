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

const presetOptions = await p.$$eval('.preset option', els => els.map(e=>e.textContent));
const firstBlock = () => p.$eval('.grid > .cell:first-child .block h3', e=>e.textContent);
const order = () => p.$$eval('.grid > .cell .block h3', els => els.map(e=>e.textContent));

console.log('preset options:', presetOptions.join(', '));
const defFirst = await firstBlock();

// Switch to Caster preset → order differs (spell slots high up).
await p.selectOption('.preset', { label: 'Caster' });
await p.waitForTimeout(150);
const casterOrder = await order();

// Enter edit mode, move a block, save as a new preset.
await p.click('button.edit');
await p.locator('.cell', { hasText: 'Inventory' }).locator('button[title="Move up"]').click();
await p.fill('.presetname', 'My Mix');
await p.click('button:has-text("Save as")');
await p.waitForTimeout(150);
const optsAfterSave = await p.$$eval('.preset option', els => els.map(e=>e.textContent));
const activeAfterSave = await p.$eval('.preset', e => e.selectedOptions[0].textContent);

// Reload → preset library + active selection persist.
await p.reload({ waitUntil: 'networkidle' });
const activeAfterReload = await p.$eval('.preset', e => e.selectedOptions[0].textContent);
const optsAfterReload = await p.$$eval('.preset option', els => els.map(e=>e.textContent));

// Delete the custom preset.
await p.click('button.edit');
await p.click('button.danger');
await p.waitForTimeout(150);
const optsAfterDelete = await p.$$eval('.preset option', els => els.map(e=>e.textContent));

console.log('default first block:', defFirst);
console.log('caster order[0..3]:', casterOrder.slice(0,4).join(' | '));
console.log('after save-as options:', optsAfterSave.join(', '), '| active:', activeAfterSave);
console.log('after reload active:', activeAfterReload, '| options count:', optsAfterReload.length);
console.log('after delete options:', optsAfterDelete.join(', '));
console.log('errors:', errors.length ? errors.slice(0,3) : 'none');
await b.close();
