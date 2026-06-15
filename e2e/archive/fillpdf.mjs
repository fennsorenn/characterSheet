import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext({ acceptDownloads: true });
const p = await ctx.newPage();
await p.setViewportSize({ width: 1200, height: 1000 });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

// Name + DEX 16 so the PDF has recognizable values.
const name = p.locator('.char-name');
await name.fill('Test Hero');
const dex = p.locator('.ability', { hasText: 'Dex' }).first().locator('input');
await dex.click(); await dex.fill('16'); await dex.press('Enter');

await p.click('button:has-text("Print / PDF")');
await p.waitForSelector('.print-toolbar');

const [ download ] = await Promise.all([
  p.waitForEvent('download'),
  p.click('button:has-text("Fillable PDF")')
]);
const path = '/tmp/fillable.pdf';
await download.saveAs(path);
const size = fs.statSync(path).size;
console.log('downloaded:', download.suggestedFilename(), '| bytes:', size);
console.log('header:', new TextDecoder().decode(fs.readFileSync(path).slice(0,8)));
console.log('errors:', errors.length ? errors.slice(0,3) : 'none');
await b.close();
