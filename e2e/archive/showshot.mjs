import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const p = await (await b.newContext({ deviceScaleFactor: 2 })).newPage();
await p.setViewportSize({ width: 640, height: 430 });
await p.goto('file:///tmp/showcase.html', { waitUntil: 'networkidle' });
await p.screenshot({ path: '/tmp/sloticons.png' });
await b.close();
