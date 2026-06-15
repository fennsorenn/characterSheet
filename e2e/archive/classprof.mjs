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

const traits = p.locator('.cell', { hasText: 'Traits & Proficiencies' });
const rows = await traits.locator('.row').evaluateAll(els => els.map(e => e.innerText.replace(/\n+/g,' ').trim()));
console.log('Default Fighter — Traits rows:');
rows.forEach(r => console.log('   ', r));

// Class skill choice selects in the Proficiency Choices section.
const choiceSel = traits.locator('.choice');
console.log('class proficiency choices:', await choiceSel.count());
const selects = traits.locator('.choice .gc select');
const nSel = await selects.count();
console.log('skill choice selects:', nSel, '| options sample:', (await selects.first().locator('option').allInnerTexts()).slice(0,5));

// Saves: STR & CON should be granted-lit from the Fighter class.
const saves = p.locator('.cell', { hasText: 'Saving Throws' });
const strLit = await saves.locator('li', { hasText: 'Strength' }).locator('.dot.on, .dot.granted').count();
console.log('Fighter STR save lit:', strLit > 0);

// Pick two skills; they should light up in the Skills block.
if (nSel >= 2) {
  await selects.nth(0).selectOption('athletics').catch(()=>{});
  await p.waitForTimeout(150);
  await selects.nth(1).selectOption('perception').catch(()=>{});
  await p.waitForTimeout(250);
}
const skills = p.locator('.cell', { hasText: 'Skills' });
const athLit = await skills.locator('li', { hasText: 'Athletics' }).locator('.dot.proficient, .dot.expertise').count();
const athVal = await skills.locator('li', { hasText: 'Athletics' }).locator('.val').innerText();
console.log('Athletics granted-proficient:', athLit > 0, '| Athletics value:', athVal);
console.log('choices pending after picks:', await traits.locator('.choice.pending').count());

await traits.screenshot({ path: '/tmp/classprof.png' });
console.log('errors:', errors.length ? errors.slice(0,3) : 'none');
await b.close();
