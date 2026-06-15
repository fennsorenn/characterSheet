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
const lvl = p.locator('.cell', { hasText: 'Defenses' }).locator('.stat', { hasText: 'Level' }).locator('input');
await lvl.click(); await lvl.fill('4'); await lvl.press('Enter'); await p.waitForTimeout(150);
const feat = p.locator('.cell', { hasText: 'Features & Traits' });

// add Magic Initiate via browse
await feat.locator('.line.feats .choose').click();
await p.waitForSelector('.overlay');
await p.fill('.filters input.search', 'magic initiate');
await p.waitForTimeout(300);
await p.locator('.overlay .results li', { hasText: 'Magic Initiate' }).first().locator('.add').click();
await p.locator('.overlay .close').click();
await p.waitForTimeout(300);

const mi = feat.locator('.features li', { hasText: 'Magic Initiate' });
const optsBefore = await mi.locator('.choices .opt').count();
const fieldsBefore = await mi.locator('.choices .pill').count();
// pick a class (Wizard) in the option select
await mi.locator('.choices .opt').first().selectOption({ index: 6 });
await p.waitForTimeout(200);
const fieldsAfter = await mi.locator('.choices .pill.empty').count();
const fieldLabels = await mi.locator('.choices .pill.empty').evaluateAll(els=>els.map(e=>e.getAttribute('title')));

// hidden section: ASI auto-hidden
const hiddenToggle = await feat.locator('.hidetoggle').innerText().catch(()=>'(none)');
await feat.locator('.hidetoggle').click().catch(()=>{});
await p.waitForTimeout(150);
const hiddenNames = await feat.locator('.hiddenlist li .fname').evaluateAll(els=>els.map(e=>e.textContent));

console.log('Magic Initiate before pick: options=', optsBefore, 'spell fields=', fieldsBefore);
console.log('after picking Wizard: empty fields=', fieldsAfter, '| labels=', fieldLabels.join(' / '));
console.log('hidden section:', hiddenToggle.trim(), '| names:', hiddenNames.join(', '));
console.log('errors:', errors.length ? errors.slice(0,3):'none');
await feat.screenshot({ path: '/tmp/features2.png' });
await b.close();
