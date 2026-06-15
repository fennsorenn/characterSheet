import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const p = await (await b.newContext({ deviceScaleFactor: 2 })).newPage();
await p.setViewportSize({ width: 760, height: 520 });
await p.goto('file:///tmp/gi3/show.html', { waitUntil: 'networkidle' });
await p.screenshot({ path: '/tmp/newicons.png' });
await b.close();
