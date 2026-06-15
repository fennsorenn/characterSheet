import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.setViewportSize({ width: 1200, height: 1300 });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.setInputFiles('input[type=file]', '/tmp/5etools.zip');
await p.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });
async function add(q,l){ await p.fill('.search input', q); await p.waitForSelector('.results li .add'); await p.locator('.results li',{hasText:l}).first().locator('.add').click(); await p.waitForTimeout(110); }

// manual spells
for (const [q,l] of [['fireball','Fireball'],['bless','Bless'],['cure wounds','Cure Wounds'],['shield','Shield'],['guidance','Guidance']]) { try{await add(q,l);}catch{} }
// equip Staff of Fire (grants burning hands, fireball, wall of fire)
await add('staff of fire','Staff of Fire');
await p.locator('.cell', { hasText: 'Inventory' }).locator('li',{hasText:'Staff of Fire'}).first().locator('input[type=checkbox]').check();
await p.waitForTimeout(250);

const sl = p.locator('.cell', { hasText: 'Spells' });
const countsText = await sl.locator('.counts').innerText();
// granted rows: items derived
const grantedRows = await sl.locator('li.granted .name').evaluateAll(els=>els.map(e=>e.textContent));
const grantedBy = await sl.locator('li.granted .src.gby').first().innerText().catch(()=>'');

// toggle Fireball prepared (it's a manual spell). Find its prep button.
const fbRow = sl.locator('li', { hasText: 'Fireball' }).filter({ hasNot: p.locator('.gicon') }).first();
await fbRow.locator('.status.prep').click();
await p.waitForTimeout(120);
const countsAfterPrep = await sl.locator('.counts').innerText();
// favorite Bless
await sl.locator('li', { hasText: 'Bless' }).first().locator('.status.fav').click();
await p.waitForTimeout(120);

// status filter: Granted
await sl.locator('.statusfilter button', { hasText: 'Granted' }).click();
await p.waitForTimeout(120);
const grantedFilterCount = await sl.locator('ul > li').count();
await sl.locator('.statusfilter button', { hasText: 'Prepared' }).click();
await p.waitForTimeout(120);
const prepFilter = await sl.locator('ul > li .name').evaluateAll(els=>els.map(e=>e.textContent));

console.log('counts:', countsText.replace(/\n/g,' '));
console.log('granted spells (from Staff of Fire):', grantedRows.join(', '), '| source:', grantedBy);
console.log('counts after preparing Fireball:', countsAfterPrep.replace(/\n/g,' '));
console.log('Granted filter row count:', grantedFilterCount);
console.log('Prepared filter shows:', prepFilter.join(', '));
console.log('errors:', errors.length ? errors.slice(0,3):'none');
await sl.locator('.statusfilter button', { hasText: 'All' }).click();
await p.waitForTimeout(100);
await sl.screenshot({ path: '/tmp/spellmgmt.png' });
await b.close();
