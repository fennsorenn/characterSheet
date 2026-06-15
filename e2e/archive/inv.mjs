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

async function add(query, label) {
  await p.fill('.search input', query);
  await p.waitForSelector('.results li .add');
  await p.locator('.results li', { hasText: label }).first().locator('.add').click();
  await p.waitForTimeout(120);
}
for (const [q,l] of [
  ['longsword','Longsword'],['dagger','Dagger'],['battleaxe','Battleaxe'],['longbow','Longbow'],
  ['arrows','Arrow'],['plate armor','Plate Armor'],['shield','Shield'],
  ['potion of healing','Potion of Healing'],['wand of magic missiles','Wand of Magic Missiles'],
  ['lute','Lute'],['belt of hill giant','Belt of Hill Giant Strength'],["thieves' tools",'Thieves']
]) { try { await add(q,l); } catch(e){ console.log('skip', q); } }

// Equip the longsword so Attacks shows it with an icon.
const inv = p.locator('.cell', { hasText: 'Inventory' });
await inv.locator('li', { hasText: 'Longsword' }).first().locator('input[type=checkbox]').check();
await p.waitForTimeout(200);

const items = await inv.locator('li').count();
const iconCount = await inv.locator('li .itemicon svg').count();
console.log('inventory items:', items, '| icons rendered:', iconCount);
console.log('errors:', errors.length ? errors.slice(0,3) : 'none');
await inv.screenshot({ path: '/tmp/inv.png' });
await p.locator('.cell', { hasText: 'Attacks' }).screenshot({ path: '/tmp/atk.png' });
await b.close();
