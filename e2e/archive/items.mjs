import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.setViewportSize({ width: 1200, height: 1200 });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.setInputFiles('input[type=file]', '/tmp/5etools.zip');
await p.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });

// STR 16 (+3), level 1 (prof +2).
const str = p.locator('.ability', { hasText: 'Str' }).first().locator('input');
await str.click(); await str.fill('16'); await str.press('Enter');

async function addAndEquip(query, label) {
  await p.fill('.search input', query);
  await p.waitForSelector('.results li .add');
  await p.locator('.results li', { hasText: label }).first().locator('.add').click();
  await p.waitForTimeout(150);
  await p.locator('.cell', { hasText: 'Inventory' }).locator('li', { hasText: label }).first().locator('input[type=checkbox]').check();
  await p.waitForTimeout(150);
}

// Equip a Longsword → Attacks shows +5 to hit (str+3, prof+2), 1d8+3 slashing.
await addAndEquip('longsword', 'Longsword');
const atkRow = p.locator('.cell', { hasText: 'Attacks' }).locator('li').first();
const hit = await atkRow.locator('.stat-value').textContent();
const dmg = await atkRow.locator('.dmg').innerText();

// Explain the to-hit.
await atkRow.locator('.stat-value').click();
await p.waitForSelector('.modal');
const explainTitle = await p.textContent('.modal h2');
await p.keyboard.press('Escape');

// Ability-setting + attunement: Belt of Hill Giant Strength sets STR 21 (+5) when attuned.
const strModBefore = await p.locator('.ability', { hasText: 'Str' }).first().locator('.stat-value').textContent();
await addAndEquip('belt of hill giant', 'Belt of Hill Giant Strength');
const strModUnattuned = await p.locator('.ability', { hasText: 'Str' }).first().locator('.stat-value').textContent();
// Attune it.
await p.locator('.cell', { hasText: 'Inventory' }).locator('li', { hasText: 'Belt of Hill Giant' }).first().locator('button.attune').click();
await p.waitForTimeout(200);
const strModAttuned = await p.locator('.ability', { hasText: 'Str' }).first().locator('.stat-value').textContent();
const attuneCount = await p.locator('.attune-count').innerText();

console.log('Longsword: to-hit', hit, '| damage', dmg);
console.log('explain to-hit title:', explainTitle);
console.log('STR mod: base', strModBefore, '| belt unattuned', strModUnattuned, '| belt attuned', strModAttuned);
console.log('attunement:', attuneCount.trim());
console.log('errors:', errors.length ? errors.slice(0,3) : 'none');
await p.screenshot({ path: '/tmp/items.png', fullPage: false });
await b.close();
