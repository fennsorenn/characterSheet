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
const chaCell = () => p.locator('.ability', { hasText: 'Cha' }).first();
async function readCha() {
  const eff = await chaCell().locator('.eff .value').innerText().catch(()=>null);
  const mod = await chaCell().locator('.modbig .stat-value').innerText().catch(()=>'?');
  const base = await chaCell().locator('input').first().inputValue().catch(()=>'?');
  return { eff, mod, base };
}
async function addFeat(name) {
  await feat.locator('.line.feats .choose', { hasText: 'Feat' }).click();
  await p.waitForSelector('.overlay', { timeout: 5000 });
  await p.fill('.overlay input.search', name);
  await p.waitForTimeout(300);
  await p.locator('.overlay .results li', { hasText: name }).first().locator('.add').click();
  await p.waitForTimeout(200);
  // close overlay
  await p.keyboard.press('Escape').catch(()=>{});
  await p.locator('.overlay .close, .overlay .x').first().click().catch(()=>{});
  await p.waitForTimeout(300);
}

const cha = chaCell().locator('input').first();
await cha.click(); await cha.fill('13'); await cha.press('Enter'); await p.waitForTimeout(200);
console.log('CHA before any feat:', await readCha());

// Fixed half-feat: Actor (+1 Cha) applies automatically.
await addFeat('Actor');
console.log('CHA after Actor (+1 fixed):', await readCha(), '(base must stay 13)');

// Choose half-feat: Resilient (+1 to a chosen ability).
await addFeat('Resilient');
const resRow = feat.locator('.features li', { hasText: 'Resilient' }).first();
const pendingBefore = await resRow.locator('.pbadge').innerText().catch(()=>'(none)');
const sel = resRow.locator('.fae select').first();
const opts = await sel.locator('option').allInnerTexts();
console.log('Resilient pending badge:', pendingBefore, '| picker options:', opts);
await sel.selectOption('cha');
await p.waitForTimeout(300);
console.log('CHA after Resilient +1 Cha:', await readCha());
const pendingAfter = await resRow.locator('.pbadge').count();
console.log('Resilient pending after pick:', pendingAfter === 0 ? '0 (gone)' : 'present');

// Explain modal should credit both feats on CHA.
await chaCell().locator('.modbig').click().catch(()=>{});
await p.waitForTimeout(200);
const explainSources = await p.locator('.explain, .popover, .modal').first().innerText().catch(()=>'(no explain)');
console.log('explain mentions Actor:', /Actor/.test(explainSources), '| Resilient:', /Resilient/.test(explainSources));

await feat.screenshot({ path: '/tmp/halffeat.png' });
console.log('errors:', errors.length ? errors.slice(0,3) : 'none');
await b.close();
