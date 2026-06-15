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
async function add(q,l){ await p.fill('.search input', q); await p.waitForSelector('.results li .add'); await p.locator('.results li',{hasText:l}).first().locator('.add').click(); await p.waitForTimeout(110); }
for (const [q,l] of [['fireball','Fireball'],['cure wounds','Cure Wounds'],['hold person','Hold Person'],
  ['fire bolt','Fire Bolt'],['bless','Bless'],['fear','Fear'],['fly','Fly'],['mage armor','Mage Armor'],
  ['sleep','Sleep'],['shield','Shield']]) { try{await add(q,l);}catch{} }
await p.waitForTimeout(300);
const sl = p.locator('.cell', { hasText: 'Spells' });
const spellCount = await sl.locator('ul > li').count();
const tagIcons = await sl.locator('li .tags svg').count();
const filterCount = await sl.locator('.filterbar .ftag').count();
await sl.screenshot({ path: '/tmp/spelltags.png' });

// Filter: click the concentration filter (find by title) and count results.
const concBtn = sl.locator('.ftag[title="Concentration"]');
const hasConc = await concBtn.count();
let filtered = -1, total = spellCount;
if (hasConc) { await concBtn.first().click(); await p.waitForTimeout(150); filtered = await sl.locator('ul > li').count(); }
await sl.screenshot({ path: '/tmp/spellfilter.png' });

console.log('spells:', spellCount, '| total tag icons:', tagIcons, '| filter chips:', filterCount);
console.log('concentration filter:', total, '->', filtered, 'spells');
console.log('errors:', errors.length ? errors.slice(0,3) : 'none');
await b.close();
