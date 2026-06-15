import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.setViewportSize({ width: 1100, height: 1000 });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.setInputFiles('input[type=file]', '/tmp/5etools.zip');
await p.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });

// STR 16 base.
const strBox = p.locator('.ability', { hasText: 'Str' }).first();
const strInput = strBox.locator('input');
await strInput.click(); await strInput.fill('16'); await strInput.press('Enter');

// Add + equip + attune Belt of Hill Giant Strength (sets STR 21).
await p.fill('.search input', 'belt of hill giant');
await p.waitForSelector('.results li .add');
await p.locator('.results li', { hasText: 'Belt of Hill Giant Strength' }).first().locator('.add').click();
await p.waitForTimeout(150);
const invItem = p.locator('.cell', { hasText: 'Inventory' }).locator('li', { hasText: 'Belt of Hill Giant' }).first();
await invItem.locator('input[type=checkbox]').check();
await invItem.locator('button.attune').click();
await p.waitForTimeout(250);

// Now the STR box should show an EffectiveScore.
const eff = strBox.locator('.eff');
const present = await eff.count();
const effVal = present ? await eff.locator('.value').textContent() : '(none)';
const badge = present ? await eff.locator('.badge').textContent() : '(none)';
const valColor = present ? await eff.locator('.value').evaluate(e => getComputedStyle(e).color) : '';
const baseField = present ? await eff.locator('.base input').inputValue() : '';
// Click value to reveal detail (touch path).
if (present) await eff.locator('.value').click();
await p.waitForTimeout(100);
const note = present ? await eff.locator('.note').textContent().catch(()=>'(none)') : '(none)';

console.log('EffectiveScore present:', present === 1);
console.log('effective value shown:', effVal && effVal.trim(), '| color:', valColor);
console.log('badge:', badge && badge.trim());
console.log('base still editable, value:', baseField);
console.log('detail on click:', note && note.trim());
console.log('errors:', errors.length ? errors.slice(0,3) : 'none');
await p.screenshot({ path: '/tmp/override.png', clip: { x: 0, y: 240, width: 700, height: 230 } });
await b.close();
