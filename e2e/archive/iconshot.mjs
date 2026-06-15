import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const p = await (await b.newContext({ deviceScaleFactor: 2 })).newPage();
await p.setViewportSize({ width: 720, height: 460 });
await p.goto('file:///tmp/icons.html', { waitUntil: 'networkidle' });
await p.screenshot({ path: '/tmp/iconset.png' });
await b.close();
