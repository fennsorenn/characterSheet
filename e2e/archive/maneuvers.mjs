import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.setViewportSize({ width: 1100, height: 1600 });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.setInputFiles('input[type=file]', '/tmp/5etools.zip');
await p.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });

const feat = p.locator('.cell', { hasText: 'Features & Traits' });

// Set Fighter level 7 so Battle Master gives 5 maneuvers.
const lvl = p.locator('.cell', { hasText: 'Defenses' }).locator('.stat', { hasText: 'Level' }).locator('input');
await lvl.click(); await lvl.fill('7'); await lvl.press('Enter'); await p.waitForTimeout(200);

// Pick Battle Master subclass.
const sub = feat.locator('.line', { hasText: 'subclass' }).locator('select').first();
await sub.selectOption({ label: 'Battle Master' }).catch(async () => {
  // fall back: choose by value
  const opts = await sub.locator('option').allInnerTexts();
  console.log('subclass options:', opts);
});
await p.waitForTimeout(300);

// Maneuvers progression row.
const manRow = feat.locator('.features li', { hasText: 'Maneuvers' }).first();
const manCount = await manRow.count();
const slots = await manRow.locator('.pill').count();
const pendingBadge = await manRow.locator('.pbadge').innerText().catch(()=>'(none)');
console.log('Maneuvers row present:', manCount, '| pick pills:', slots, '| pending badge:', pendingBadge);

// Open the picker on the first empty maneuver pill.
await manRow.locator('.pill.empty').first().click();
await p.waitForSelector('.modal h2', { timeout: 5000 });
const pickerTitle = await p.locator('.modal h2').innerText();
const optCount = await p.locator('.modal .row').count();
console.log('picker title:', pickerTitle, '| options:', optCount);
const firstName = await p.locator('.modal .row .nm').first().innerText();
await p.locator('.modal .row').first().click();
await p.waitForTimeout(250);

const pickedNames = await manRow.locator('.pill.picked .pname').allInnerTexts();
const remainingEmpty = await manRow.locator('.pill.empty').count();
console.log('after pick — picked:', pickedNames, '| empty left:', remainingEmpty, '| (picked first option:', firstName, ')');

// Re-open picker on another empty slot; the just-picked one should be excluded.
await manRow.locator('.pill.empty').first().click();
await p.waitForSelector('.modal .row', { timeout: 5000 });
const namesInPicker = await p.locator('.modal .row .nm').allInnerTexts();
console.log('dedup — first pick still offered?', namesInPicker.includes(firstName));
await p.keyboard.press('Escape');

await feat.screenshot({ path: '/tmp/maneuvers.png' });
console.log('errors:', errors.length ? errors.slice(0,3) : 'none');
await b.close();
