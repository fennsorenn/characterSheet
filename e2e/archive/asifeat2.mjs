import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.setViewportSize({ width: 1100, height: 1700 });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.setInputFiles('input[type=file]', '/tmp/5etools.zip');
await p.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });

const feat = p.locator('.cell', { hasText: 'Features & Traits' });
const lvl = p.locator('.cell', { hasText: 'Defenses' }).locator('.stat', { hasText: 'Level' }).locator('input');
await lvl.click(); await lvl.fill('4'); await lvl.press('Enter'); await p.waitForTimeout(300);

// ASI is pending → visible + highlighted.
let asiRow = feat.locator('.features li', { hasText: 'Ability Score Improvement' }).first();
console.log('ASI pending+visible:', await feat.locator('.features li.pending', { hasText: 'Ability Score Improvement' }).count());

await asiRow.locator('select.opt').first().selectOption('feat');
await p.waitForSelector('.modal h2', { timeout: 5000 });
await p.fill('.modal .search', 'Magic Initiate');
await p.waitForTimeout(200);
await p.locator('.modal .row', { hasText: 'Magic Initiate' }).first().click();
await p.waitForTimeout(300);

// ASI now resolved → auto-hides into "Hidden / applied". Open it.
const stillVisible = await feat.locator('.features li', { hasText: 'Ability Score Improvement' }).count();
await feat.locator('.hidetoggle').click().catch(()=>{});
await p.waitForTimeout(150);
const hiddenAsi = feat.locator('.hiddenlist li', { hasText: 'Ability Score Improvement' }).first();
const pill = await hiddenAsi.locator('.pill.picked .pname').innerText().catch(()=>'(none)');
console.log('ASI auto-hid after feat pick:', stillVisible === 0, '| feat pill in hidden row:', pill);

// The cascade: Magic Initiate Feat row + its source select; choosing a class reveals spell pills.
const featRow = feat.locator('.features li', { hasText: 'Magic Initiate' }).first();
const optSel = featRow.locator('select.opt').first();
console.log('Magic Initiate row + option select:', await optSel.count());
const classOpts = (await optSel.locator('option').allInnerTexts()).filter(t => t && !/choose/i.test(t));
console.log('class options sample:', classOpts.slice(0, 4));
await optSel.selectOption({ label: classOpts[0] });
await p.waitForTimeout(300);
const spellPills = await featRow.locator('.pill').count();
const spellEmpty = await featRow.locator('.pill.empty').allInnerTexts();
console.log('cascade after picking', classOpts[0], '— spell pills:', spellPills, '| labels:', spellEmpty);

// Pick one cascaded spell.
if (spellPills > 0) {
  await featRow.locator('.pill.empty').first().click();
  await p.waitForSelector('.modal .row', { timeout: 5000 });
  const spName = await p.locator('.modal .row .nm').first().innerText();
  await p.locator('.modal .row').first().click();
  await p.waitForTimeout(250);
  console.log('picked cascaded spell:', spName, '| now-picked pills:', await featRow.locator('.pill.picked').count());
}

await feat.screenshot({ path: '/tmp/asifeat.png' });
console.log('errors:', errors.length ? errors.slice(0,3) : 'none');
await b.close();
