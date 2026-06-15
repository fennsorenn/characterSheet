import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const p = await (await b.newContext({ deviceScaleFactor: 2 })).newPage();
await p.goto('file:///tmp/legend.html', { waitUntil: 'networkidle' });
const el = await p.$('body');
await el.screenshot({ path: '/tmp/legend.png' });
await b.close();
