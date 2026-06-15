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

// Level 4 Fighter → one ASI.
const lvl = p.locator('.cell', { hasText: 'Defenses' }).locator('.stat', { hasText: 'Level' }).locator('input');
await lvl.click(); await lvl.fill('4'); await lvl.press('Enter'); await p.waitForTimeout(300);

const asiRow = feat.locator('.features li', { hasText: 'Ability Score Improvement' }).first();
console.log('ASI row present:', await asiRow.count());

// Switch the ASI mode select to "Feat".
const modeSel = asiRow.locator('select.opt').first();
await modeSel.selectOption('feat');
await p.waitForSelector('.modal h2', { timeout: 5000 });
console.log('feat picker title:', await p.locator('.modal h2').innerText());

// Pick Magic Initiate (it grants a spell choice → should cascade).
await p.fill('.modal .search', 'Magic Initiate');
await p.waitForTimeout(200);
const names = await p.locator('.modal .row .nm').allInnerTexts();
console.log('feat search results sample:', names.slice(0, 4));
await p.locator('.modal .row', { hasText: 'Magic Initiate' }).first().click();
await p.waitForTimeout(300);

// The ASI row should now show the feat pill.
const pill = await asiRow.locator('.pill.picked .pname').innerText().catch(()=>'(none)');
console.log('ASI slot feat pill:', pill);

// And a separate Feat-group feature row should appear with its own choices.
const featRow = feat.locator('.features li', { hasText: 'Magic Initiate' }).first();
console.log('Magic Initiate Feat row present:', await featRow.count());
// Its source-choice select + spell pills (the cascade).
const optSel = await featRow.locator('select.opt').count();
const spellPills = await featRow.locator('.pill').count();
console.log('cascade — option selects:', optSel, '| spell-choice pills:', spellPills);

// Toggle back to Ability; feat pill should disappear, AsiEditor returns.
await asiRow.locator('select.opt').first().selectOption('ability');
await p.waitForTimeout(200);
const asiSelects = await asiRow.locator('.asi select').count();
const featRowAfter = await feat.locator('.features li', { hasText: 'Magic Initiate' }).count();
console.log('after switch back — AsiEditor selects:', asiSelects, '| Magic Initiate row gone?', featRowAfter === 0);

await feat.screenshot({ path: '/tmp/asifeat.png' });
console.log('errors:', errors.length ? errors.slice(0,3) : 'none');
await b.close();
