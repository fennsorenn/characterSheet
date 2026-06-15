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
for (const [q,l] of [['bless','Bless'],['haste','Haste'],['fly','Fly'],['longstrider','Longstrider'],
  ['enhance ability','Enhance Ability'],['protection from energy','Protection from Energy'],
  ['darkvision','Darkvision'],['fireball','Fireball']]) { try{await add(q,l);}catch{} }
await p.waitForTimeout(300);
const sl = p.locator('.cell', { hasText: 'Spells' });
// collect, for each spell, the tag tooltips (titles) to verify buff tags present
const data = await sl.locator('ul > li').evaluateAll(lis => lis.map(li => ({
  name: li.querySelector('.name')?.textContent,
  tags: [...li.querySelectorAll('.tags .tag')].map(t => t.getAttribute('title'))
})));
for (const d of data) console.log(`${d.name}: ${d.tags.join(' | ')}`);
const filterTitles = await sl.locator('.filterbar .ftag').evaluateAll(els => els.map(e=>e.getAttribute('title')));
console.log('FILTERS:', filterTitles.join(', '));
console.log('errors:', errors.length ? errors.slice(0,3) : 'none');
await sl.screenshot({ path: '/tmp/bufftags.png' });
await b.close();
