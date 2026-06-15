import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.setViewportSize({ width: 1200, height: 1000 });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

const screenOrder = () => p.$$eval('main .grid > .cell .block h3', els => els.map(e=>e.textContent));
const printOrder = () => p.$$eval('.print-pages .grid > .cell .block h3', els => els.map(e=>e.textContent));

const screen0 = await screenOrder();

// Open print; default print layout differs from screen and is its own thing.
await p.click('button:has-text("Print / PDF")');
await p.waitForSelector('.print-pages');
const print0 = await printOrder();

// Edit print layout: remove "Spells" from print only.
await p.click('button:has-text("Edit print layout")');
await p.waitForSelector('.print-pages .controls');
await p.locator('.print-pages .cell', { hasText: 'Spells' }).locator('button[title="Remove"]').click();
await p.waitForTimeout(150);
const printAfterRemove = await printOrder();

// Back to screen — screen layout must be unaffected by the print edit.
await p.click('button:has-text("Done editing")');
await p.click('button:has-text("← Back to sheet")');
await p.waitForSelector('main .grid');
const screenAfter = await screenOrder();

// Reopen print, reload page first to confirm persistence of the print edit.
await p.reload({ waitUntil: 'networkidle' });
await p.click('button:has-text("Print / PDF")');
await p.waitForSelector('.print-pages');
const printAfterReload = await printOrder();

// Copy screen layout into print.
await p.click('button:has-text("Edit print layout")');
await p.click('button:has-text("Copy screen layout")');
await p.waitForTimeout(150);
const printAfterCopy = await printOrder();

console.log('screen blocks:', screen0.length, '| print default blocks:', print0.length);
console.log('print has Spells initially:', print0.includes('Spells'), '| after remove:', printAfterRemove.includes('Spells'));
console.log('screen still has Spells (unaffected):', screenAfter.includes('Spells'));
console.log('print Spells after reload (persisted removal):', printAfterReload.includes('Spells'));
console.log('after copy-from-screen, print matches screen length:', printAfterCopy.length === screen0.length, `(${printAfterCopy.length} vs ${screen0.length})`);
console.log('errors:', errors.length ? errors.slice(0,3) : 'none');
await b.close();
