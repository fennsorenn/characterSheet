import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));

async function shot(w, h, file, label) {
  await p.setViewportSize({ width: w, height: h });
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await p.waitForSelector('.grid > .cell');
  // Measure how many distinct top offsets (rows) and the grid's used width.
  const stats = await p.evaluate(() => {
    const grid = document.querySelector('.grid');
    const cells = [...grid.querySelectorAll(':scope > .cell')];
    const gridW = grid.getBoundingClientRect().width;
    const tops = new Set(cells.map(c => Math.round(c.getBoundingClientRect().top)));
    const firstRow = cells.filter(c => Math.round(c.getBoundingClientRect().top) === Math.min(...tops));
    return { gridW: Math.round(gridW), cells: cells.length, rows: tops.size, firstRowCount: firstRow.length };
  });
  await p.screenshot({ path: file });
  console.log(`${label}: viewport ${w} | grid width ${stats.gridW} | ${stats.cells} blocks in ${stats.rows} rows | first row ${stats.firstRowCount} blocks`);
}

await shot(1440, 900, '/tmp/grid-desktop.png', 'desktop');
await shot(2200, 1000, '/tmp/grid-ultrawide.png', 'ultrawide');
await shot(820, 1100, '/tmp/grid-tablet.png', 'tablet');
console.log('errors:', errors.length ? errors.slice(0,3) : 'none');
await b.close();
