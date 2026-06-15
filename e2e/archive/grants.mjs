import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.setViewportSize({ width: 1200, height: 2100 });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.setInputFiles('input[type=file]', '/tmp/5etools.zip');
await p.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });
// Reset character + layout (keep cached data in IndexedDB) so the default layout w/ Traits applies.
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });
await p.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });

const feat = p.locator('.cell', { hasText: 'Features & Traits' });
const traits = p.locator('.cell', { hasText: 'Traits & Proficiencies' });
console.log('Traits block present:', await traits.count());

async function browseAdd(category, name) {
  if (category === 'race') await feat.locator('.line', { hasText: 'Race' }).locator('.choose').click();
  else await feat.locator('.line.feats .choose', { hasText: 'Feat' }).click();
  await p.waitForSelector('.overlay', { timeout: 5000 });
  await p.fill('.overlay input.search', name);
  await p.waitForTimeout(350);
  await p.locator('.overlay .results li', { hasText: name }).first().locator('.add').click({ force: true });
  await p.waitForTimeout(200);
  await p.locator('.overlay .close').click();
  await p.waitForSelector('.overlay', { state: 'detached', timeout: 5000 });
  await p.waitForTimeout(200);
}

const conBefore = await p.locator('.ability', { hasText: 'Con' }).first().locator('input').first().inputValue();
await browseAdd('race', 'Dwarf');
const conEff = await p.locator('.ability', { hasText: 'Con' }).first().locator('.eff .value').innerText().catch(()=>'(none)');
const traitRows = await traits.locator('.row').evaluateAll(els => els.map(e => e.innerText.replace(/\n+/g,' ').trim()));
console.log('CON base/eff:', conBefore, '->', conEff);
console.log('Traits after Dwarf:'); traitRows.forEach(r => console.log('   ', r));

await browseAdd('feat', 'Resilient');
const resRow = feat.locator('.features li', { hasText: 'Resilient' }).first();
const pending = await resRow.locator('.pbadge').innerText().catch(()=>'(none)');
const selectCount = await resRow.locator('.gc select').count();
const labels = await resRow.locator('.grantlabel').allInnerTexts();
console.log('Resilient pending:', pending, '| grant selects:', selectCount, '| labels:', labels);
for (let i = 0; i < selectCount; i++) {
  await resRow.locator('.gc select').nth(i).selectOption('con').catch(()=>{});
  await p.waitForTimeout(150);
}
await p.waitForTimeout(300);
console.log('Resilient pending after picks:', (await resRow.locator('.pbadge').count()) === 0 ? '0 (gone)' : 'present');

const saves = p.locator('.cell', { hasText: 'Saving Throws' });
const conSaveOn = await saves.locator('li', { hasText: 'Constitution' }).locator('.dot.on, .dot.granted').count();
const conSaveVal = await saves.locator('li', { hasText: 'Constitution' }).locator('.val').innerText();
const conEff2 = await p.locator('.ability', { hasText: 'Con' }).first().locator('.eff .value').innerText().catch(()=>'?');
console.log('CON save dot lit:', conSaveOn > 0, '| CON save value:', conSaveVal, '| CON effective:', conEff2);
const profRow = await traits.locator('.row', { hasText: 'Saving' }).innerText().catch(()=>'(no save prof row)');

await traits.screenshot({ path: '/tmp/grants-traits.png' });
await feat.screenshot({ path: '/tmp/grants-features.png' });
console.log('errors:', errors.length ? errors.slice(0,3) : 'none');
await b.close();
