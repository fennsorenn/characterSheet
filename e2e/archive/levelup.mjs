import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.setViewportSize({ width: 1200, height: 1100 });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

const block = p.locator('.cell', { hasText: 'Rest & Level Up' });
const hpText = () => p.locator('.cell', { hasText: 'Hit Points' }).first().locator('.grp').first().innerText();

// Set CON 14 (mod +2) and damage to 5/10 to test hit-die healing.
const con = p.locator('.ability', { hasText: 'Con' }).first().locator('input');
await con.click(); await con.fill('14'); await con.press('Enter');
const hpcur = p.locator('.cell', { hasText: 'Hit Points' }).first().locator('input').first();
await hpcur.click(); await hpcur.fill('5'); await hpcur.press('Enter');
await p.waitForTimeout(100);
const hpBefore = await hpcur.inputValue();

// Spend a hit die (d10 avg 6 + con 2 = +8) → heals, clamped to max 10.
await block.locator('button.spend').first().click();
await p.waitForTimeout(150);
const hpAfterSpend = await hpcur.inputValue();
const diceUsed = await block.locator('.pip').evaluateAll(els => els.filter(e=>!e.classList.contains('on')).length);

// Long rest restores HP and recovers the hit die.
await block.locator('button:has-text("Long rest")').click();
await p.waitForTimeout(150);
const hpAfterLong = await hpcur.inputValue();
const diceAvailAfterRest = await block.locator('.pip.on').count();

// Level up: open modal, confirm (average). Level 1 Fighter -> 2, +8 HP (d10 avg6 + con2).
const levelBefore = await p.locator('.cell', { hasText: 'Defenses' }).locator('.stat', { hasText: 'Level' }).locator('input').inputValue();
await block.locator('button:has-text("Level Up")').click();
await p.waitForSelector('.modal');
const gainText = await p.locator('.modal .result').innerText();
await p.locator('.modal .confirm').click();
await p.waitForTimeout(150);
const levelAfter = await p.locator('.cell', { hasText: 'Defenses' }).locator('.stat', { hasText: 'Level' }).locator('input').inputValue();
const hpMaxAfter = await p.locator('.cell', { hasText: 'Hit Points' }).first().locator('input').nth(1).inputValue();
const profAfter = await p.locator('.cell', { hasText: 'Defenses' }).locator('.stat', { hasText: 'Prof' }).locator('.stat-value').textContent();

console.log('HP: start', hpBefore, '-> spend d10', hpAfterSpend, '(clamped to 10) ->', diceUsed, 'dice spent');
console.log('after long rest: HP', hpAfterLong, '| dice available', diceAvailAfterRest);
console.log('level up: level', levelBefore, '->', levelAfter, '|', gainText.replace(/\n/g,' '), '| HP max now', hpMaxAfter, '| prof', profAfter);
console.log('errors:', errors.length ? errors.slice(0,3) : 'none');
await p.screenshot({ path: '/tmp/levelup.png' });
await b.close();
