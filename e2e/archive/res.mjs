import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.setViewportSize({ width: 1000, height: 1100 });
const errors = [];
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

// HP delta: current 10 -> -3 -> 7.
const hp = p.locator('.cell', { hasText: 'Hit Points' });
const cur = hp.locator('input').first();
await cur.click(); await cur.fill('-3'); await cur.press('Enter');
await p.waitForTimeout(120);
const hpNow = await cur.inputValue();

// Spell slots: set level 1 max to 4, expend two pips.
const ss = p.locator('.cell', { hasText: 'Spell Slots' });
const lvl1Max = ss.locator('.maxcell', { hasText: '1' }).first().locator('input');
await lvl1Max.click(); await lvl1Max.fill('4'); await lvl1Max.press('Enter');
await p.waitForTimeout(120);
const pipsBefore = await ss.locator('li .pip.on').count();
// click the 3rd pip (index2) to spend down to remaining=2.
await ss.locator('li .pip').nth(2).click();
await p.waitForTimeout(120);
const pipsAfter = await ss.locator('li .pip.on').count();

// Resources: add "Action Surge" max 1 short rest, spend it, then short rest restores.
const res = p.locator('.cell', { hasText: 'Resources' });
await res.locator(".add input[placeholder=\"Feature name\"]").fill('Action Surge');
await res.locator('.add button').click();
await p.waitForTimeout(120);
const availBefore = await res.locator('li .pip.on').count();
await res.locator('li .pip.on').first().click(); // spend
await p.waitForTimeout(120);
const availSpent = await res.locator('li .pip.on').count();
await res.locator('.rests button', { hasText: 'Short rest' }).click();
await p.waitForTimeout(120);
const availRested = await res.locator('li .pip.on').count();

// Long rest restores HP and slots.
await res.locator('.rests button', { hasText: 'Long rest' }).click();
await p.waitForTimeout(150);
const hpAfterLong = await cur.inputValue();
const slotsAfterLong = await ss.locator('li .pip.on').count();

console.log('HP after -3:', hpNow);
console.log('slot pips: set4 ->', pipsBefore, 'after spend ->', pipsAfter);
console.log('resource avail: added ->', availBefore, 'spent ->', availSpent, 'short-rest ->', availRested);
console.log('long rest: HP ->', hpAfterLong, '| slot pips full ->', slotsAfterLong);
console.log('errors:', errors.length ? errors.slice(0,3) : 'none');
await p.screenshot({ path: '/tmp/sheet-resources.png' });
await b.close();
