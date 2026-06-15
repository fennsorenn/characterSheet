import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.setViewportSize({ width: 1200, height: 1000 });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

// Give the HP a value so redaction is observable.
const hp = p.locator('.cell', { hasText: 'Hit Points' }).first();
const cur = hp.locator('input').first();
await cur.click(); await cur.fill('22'); await cur.press('Enter');

// Open print view.
await p.click('button:has-text("Print / PDF")');
await p.waitForSelector('.print-pages');
const pageWidth = await p.$eval('.print-pages', e => Math.round(e.getBoundingClientRect().width));

// vis() returns visibility of a selector inside print-pages.
const vis = (sel) => p.$eval(`.print-pages ${sel}`, e => getComputedStyle(e).visibility);

// Default prefill 'all': HP visible.
const hpAll = await vis('[data-volatile="frequent"]');

// Switch to omit-frequent: HP hidden, scores (occasional) still visible.
await p.selectOption('.print-toolbar select >> nth=1', 'omit-frequent');
await p.waitForTimeout(100);
const hpFreq = await vis('[data-volatile="frequent"]');
const scoreFreq = await vis('[data-volatile="occasional"]');

// omit-occasional: scores hidden too.
await p.selectOption('.print-toolbar select >> nth=1', 'omit-occasional');
await p.waitForTimeout(100);
const scoreOcc = await vis('[data-volatile="occasional"]');

// blank: computed values hidden.
await p.selectOption('.print-toolbar select >> nth=1', 'blank');
await p.waitForTimeout(100);
const statBlank = await vis('.stat-value');

await p.screenshot({ path: '/tmp/print-preview.png' });

// Generate an actual PDF under print emulation (verifies print isolation + paging).
await p.selectOption('.print-toolbar select >> nth=1', 'all');
await p.emulateMedia({ media: 'print' });
await p.pdf({ path: '/tmp/sheet.pdf', format: 'Letter', printBackground: true });
const pdfSize = fs.statSync('/tmp/sheet.pdf').size;

console.log('page width px (letter ~816):', pageWidth);
console.log('HP visibility: all =', hpAll, '| omit-frequent =', hpFreq, '| score@omit-frequent =', scoreFreq);
console.log('score visibility @ omit-occasional =', scoreOcc, '| stat-value @ blank =', statBlank);
console.log('generated PDF bytes:', pdfSize);
console.log('errors:', errors.length ? errors.slice(0,3) : 'none');
await b.close();
