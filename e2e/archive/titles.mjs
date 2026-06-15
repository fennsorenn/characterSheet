import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.setViewportSize({ width: 1200, height: 1400 });
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.setInputFiles('input[type=file]', '/tmp/5etools.zip');
await p.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });
async function add(q,l){ await p.fill('.search input', q); await p.waitForSelector('.results li .add'); await p.locator('.results li',{hasText:l}).first().locator('.add').click(); await p.waitForTimeout(110); }
// item with override, a weapon (equipped), spells
await add('belt of hill giant','Belt of Hill Giant Strength');
const inv = p.locator('.cell', { hasText: 'Inventory' });
await inv.locator('li',{hasText:'Belt of Hill Giant'}).first().locator('input[type=checkbox]').check();
await inv.locator('li',{hasText:'Belt of Hill Giant'}).first().locator('button.attune').click();
await add('longsword','Longsword');
await inv.locator('li',{hasText:'Longsword'}).first().locator('input[type=checkbox]').check();
await add('fireball','Fireball'); await add('bless','Bless');
await p.waitForTimeout(300);

// Every rendered icon must have an ancestor (or self) with a non-empty title.
const report = await p.evaluate(() => {
  const icons = [...document.querySelectorAll('svg.icon')];
  const missing = [];
  for (const ic of icons) {
    const titled = ic.closest('[title]');
    if (!titled || !titled.getAttribute('title')) {
      // describe location
      const block = ic.closest('.cell')?.querySelector('h3')?.textContent || 'unknown';
      missing.push(block + ' :: ' + (ic.closest('span,button,div')?.className || ''));
    }
  }
  return { total: icons.length, missing };
});
console.log('total icons on screen:', report.total);
console.log('icons WITHOUT a titled ancestor:', report.missing.length);
report.missing.slice(0,10).forEach(m => console.log('  MISSING:', m));
await b.close();
