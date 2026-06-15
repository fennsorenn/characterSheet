import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.setViewportSize({ width: 1200, height: 1400 });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.setInputFiles('input[type=file]', '/tmp/5etools.zip');
await p.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });
async function add(q,l){ await p.fill('.search input', q); await p.waitForSelector('.results li .add'); await p.locator('.results li',{hasText:l}).first().locator('.add').click(); await p.waitForTimeout(120); }
// spells across schools
for (const [q,l] of [['fireball','Fireball'],['shield','Shield'],['mage armor','Mage Armor'],
  ['charm person','Charm Person'],['cure wounds','Cure Wounds'],['fire bolt','Fire Bolt'],
  ['invisibility','Invisibility'],['chill touch','Chill Touch']]) { try{await add(q,l);}catch{} }
// weapons across damage types
for (const [q,l] of [['longsword','Longsword'],['warhammer','Warhammer'],['rapier','Rapier'],['longbow','Longbow']]) { try{await add(q,l);}catch{} }
const inv = p.locator('.cell', { hasText: 'Inventory' });
for (const w of ['Longsword','Warhammer','Rapier','Longbow']) {
  try { await inv.locator('li',{hasText:w}).first().locator('input[type=checkbox]').check(); } catch{}
}
await p.waitForTimeout(300);
const schoolIcons = await p.locator('.cell', { hasText: 'Spells' }).locator('li .school svg').count();
const dmgIcons = await p.locator('.cell', { hasText: 'Attacks' }).locator('li .dicon svg').count();
console.log('spell school icons:', schoolIcons, '| attack damage icons:', dmgIcons);
console.log('errors:', errors.length ? errors.slice(0,3) : 'none');
await p.locator('.cell', { hasText: 'Spells' }).screenshot({ path: '/tmp/spells.png' });
await p.locator('.cell', { hasText: 'Attacks' }).screenshot({ path: '/tmp/atk2.png' });
await b.close();
