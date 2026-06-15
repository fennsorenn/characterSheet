import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.setViewportSize({ width: 1200, height: 1000 });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

// Baseline: STR 14 (+2), AC 10. Set STR base.
const strBox = p.locator('.ability', { hasText: 'Str' }).first();
const si = strBox.locator('input'); await si.click(); await si.fill('14'); await si.press('Enter');
await p.waitForTimeout(100);
const acBox = p.locator('.cell', { hasText: 'Defenses' }).locator('.stat.big');
const acBefore = await acBox.locator('.stat-value, .buff-field').first().textContent().catch(()=>null) || await acBox.locator('input').first().inputValue().catch(()=>'?');
const dexSave = () => p.locator('.cell', { hasText: 'Saving Throws' }).locator('li', { hasText: 'Dexterity' });

// Enter buff mode.
await p.click('button.buff');
await p.waitForSelector('.buff-banner');

// Buff STR score +2 (buff field replaces the score input). STR mod was +2 -> +3.
const strBuff = strBox.locator('.buff-field');
await strBuff.click(); await strBuff.fill('+2'); await strBuff.press('Enter');
await p.waitForTimeout(150);
const strMod = await strBox.locator('.modbig .stat-value').first().textContent();

// Buff AC +3 (a CALCULATED value). AC field is now a buff-field.
const acField = acBox.locator('.buff-field');
await acField.click(); await acField.fill('+3'); await acField.press('Enter');
await p.waitForTimeout(150);
const acAfter = await acBox.locator('.buff-field').inputValue();

// Buff Dexterity save -1.
const dexSaveField = dexSave().locator('.buff-field');
const dexSaveBefore = await dexSaveField.inputValue();
await dexSaveField.click(); await dexSaveField.fill('-1'); await dexSaveField.press('Enter');
await p.waitForTimeout(150);
const dexSaveAfter = await dexSave().locator('.buff-field').inputValue();

// Count shown in toggle / banner.
const countLabel = await p.locator('button.buff').textContent();

// Exit buff mode: base STR must still be 14 (untouched).
await p.click('button.buff');
await p.waitForTimeout(150);
const strBaseAfter = await strBox.locator('input').inputValue();
const strModNormal = await strBox.locator('.modbig .stat-value').textContent();

// Explain AC shows the manual buff.
await acBox.locator('.stat-value').click();
await p.waitForSelector('.modal');
const acMods = await p.$$eval('.modal .mod', els => els.map(e=>e.textContent.trim()));

console.log('STR mod after +2 buff:', strMod, '(was +2)');
console.log('AC (calculated) after +3 buff:', acAfter);
console.log('Dex save:', dexSaveBefore, '-> after -1 buff:', dexSaveAfter);
console.log('buff toggle label:', countLabel.trim());
console.log('after exit buff mode: STR base still', strBaseAfter, '| STR mod normal', strModNormal, '(base untouched, buff still applied)');
console.log('AC explain modifiers:', acMods);
console.log('errors:', errors.length ? errors.slice(0,3) : 'none');
await b.close();
