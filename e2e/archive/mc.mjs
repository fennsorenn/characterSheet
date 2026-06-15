import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
await p.setViewportSize({ width: 1200, height: 2100 });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.setInputFiles('input[type=file]', '/tmp/5etools.zip');
await p.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });
await p.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });

const saves = p.locator('.cell', { hasText: 'Saving Throws' });
async function litSaves() {
  const out = [];
  for (const a of ['Strength','Dexterity','Constitution','Intelligence','Wisdom','Charisma']) {
    const lit = await saves.locator('li', { hasText: a }).locator('.dot.on, .dot.granted').count();
    if (lit) out.push(a);
  }
  return out;
}
console.log('Fighter-only lit saves:', await litSaves());

// Multiclass into Cleric via the Level Up modal.
await p.locator('.cell', { hasText: 'Rest & Level Up' }).locator('button.levelup').click();
await p.waitForSelector('.modal', { timeout: 5000 });
await p.locator('.modal select').first().selectOption('new');
await p.locator('.modal .newclass input').first().fill('Cleric');
await p.locator('.modal .newclass input.src').fill('PHB');
await p.locator('.modal .confirm').click();
await p.waitForTimeout(400);

console.log('After multiclass into Cleric — lit saves:', await litSaves(), '(should still be just Strength/Constitution)');
const traits = p.locator('.cell', { hasText: 'Traits & Proficiencies' });
const armorRow = await traits.locator('.row', { hasText: 'Armor' }).innerText().catch(()=>'(none)');
console.log('Armor row:', armorRow.replace(/\n+/g,' ').trim());
// Confirm no Cleric save proficiency choices/grants leaked in.
const clericChoice = await traits.locator('.choice', { hasText: 'Cleric' }).count();
console.log('Cleric proficiency-choice rows (skills are full-only, multiclass has none):', clericChoice);

await traits.screenshot({ path: '/tmp/multiclass.png' });
console.log('errors:', errors.length ? errors.slice(0,3) : 'none');
await b.close();
