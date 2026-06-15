import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));

await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
console.log('title:', await page.title());

// Import via the hidden file input using the real release zip.
await page.setInputFiles('input[type=file]', '/tmp/5etools.zip');

// Wait for the loaded summary to appear (parsing ~5s).
await page.waitForSelector('.loaded', { timeout: 60000 });
const counts = await page.$$eval('.counts li', els => els.map(e => e.textContent.trim()));
console.log('counts:', counts.join('  '));

// Exercise quick search.
await page.fill('.search input', '+1 longsword');
await page.waitForSelector('.results li .name', { timeout: 5000 });
const names = await page.$$eval('.results li .name', els => els.slice(0,3).map(e => e.textContent));
console.log('search "+1 longsword":', names.join(' | '));

console.log('console errors:', errors.length ? errors.slice(0,5) : 'none');
await page.screenshot({ path: '/tmp/sheet-smoke.png', fullPage: true });
await browser.close();
