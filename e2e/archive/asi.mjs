import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.setViewportSize({ width: 1000, height: 1500 });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.setInputFiles('input[type=file]', '/tmp/5etools.zip');
await p.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });
// STR base 14, level 4
const str = p.locator('.ability', { hasText: 'Str' }).first().locator('input');
await str.click(); await str.fill('14'); await str.press('Enter');
const lvl = p.locator('.cell', { hasText: 'Defenses' }).locator('.stat', { hasText: 'Level' }).locator('input');
await lvl.click(); await lvl.fill('4'); await lvl.press('Enter'); await p.waitForTimeout(200);

const feat = p.locator('.cell', { hasText: 'Features & Traits' });
const hdrPending = await feat.locator('.hdr-pending').innerText().catch(()=>'(none)');
// ASI feature should be visible + highlighted (not hidden) because pending
const asiVisible = await feat.locator('.features li.pending', { hasText: 'Ability Score Improvement' }).count();

// set +2 STR
const asiRow = feat.locator('.features li', { hasText: 'Ability Score Improvement' }).first();
await asiRow.locator('.asi select').nth(0).selectOption('one'); // +2 to one
await asiRow.locator('.asi select').nth(1).selectOption('str');
await p.waitForTimeout(250);

// STR effective should now show 16 with override badge
const strEff = await p.locator('.ability', { hasText: 'Str' }).first().locator('.eff .value').innerText().catch(()=>'(no override)');
const strMod = await p.locator('.ability', { hasText: 'Str' }).first().locator('.modbig .stat-value').innerText();
const strBase = await p.locator('.ability', { hasText: 'Str' }).first().locator('.eff .base input').inputValue().catch(()=>'?');

// pending now 0; ASI moved to hidden section
const hdrAfter = await feat.locator('.hdr-pending').count();
const asiInVisible = await feat.locator('.features li', { hasText: 'Ability Score Improvement' }).count();
await feat.locator('.hidetoggle').click().catch(()=>{});
await p.waitForTimeout(150);
const asiInHidden = await feat.locator('.hiddenlist li', { hasText: 'Ability Score Improvement' }).count();

console.log('header pending before:', hdrPending.trim(), '| ASI visible+highlighted:', asiVisible);
console.log('after +2 STR: effective', strEff, '| mod', strMod, '| base still', strBase);
console.log('header pending after:', hdrAfter===0?'0 (gone)':'present', '| ASI in visible:', asiInVisible, '| in hidden:', asiInHidden);
console.log('errors:', errors.length ? errors.slice(0,3):'none');
await feat.screenshot({ path: '/tmp/asi.png' });
await b.close();
