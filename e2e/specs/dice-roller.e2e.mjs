import { cell, assert } from '../harness.mjs';

// Floating dice roller: roll-all on an attack (advantage d20 + damage together),
// detailed/concise toggle, and the log.
export default async function ({ page, baseUrl }) {
  await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('cs.char.test') || '{}');
    c.classes = [{ name: 'Fighter', source: 'PHB', level: 5, hitDie: 10 }];
    c.abilities = { ...(c.abilities || {}), str: 16 };
    c.spellcasting = { ability: 'int' };
    c.spells = [{ name: 'Fireball', source: 'PHB', status: 'prepared' }];
    c.inventory = [{ name: 'Longsword', source: 'PHB', quantity: 1, equipped: true, proficient: true }];
    localStorage.setItem('cs.char.test', JSON.stringify(c));
  });
  await page.goto(baseUrl + '/local/test', { waitUntil: 'networkidle' });
  await page.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });

  // Open the roller and set advantage.
  await page.locator('header.top button', { hasText: 'Dice' }).click();
  await page.waitForSelector('.roller', { timeout: 5000 });
  const roller = page.locator('.roller');
  await roller.locator('.modes button[title="Advantage"]').click();

  // Roll the Longsword: attack (2 d20, one dropped) + damage together.
  await cell(page, 'Attacks').locator('button.roll').first().click();
  await page.waitForTimeout(150);
  assert((await roller.locator('.gtitle').innerText()).toUpperCase() === 'LONGSWORD', 'roll group titled by the weapon');
  const partLabels = await roller.locator('.latest .part .plabel').allInnerTexts();
  assert(partLabels.some((l) => /Attack/.test(l)), 'has an Attack part');
  assert(partLabels.some((l) => /Damage/.test(l)), 'rolls damage together with the attack');
  // Advantage rolls two d20s, one dropped.
  const attackDice = roller.locator('.latest .part', { hasText: 'Attack' }).locator('.die');
  assert((await attackDice.count()) === 2, 'advantage rolls two d20s');
  assert((await roller.locator('.latest .part', { hasText: 'Attack' }).locator('.die.dropped').count()) === 1, 'one d20 is dropped');
  // Modifier tooltip explains the bonus.
  const mod = roller.locator('.latest .part', { hasText: 'Attack' }).locator('.mod');
  assert(/prof/.test((await mod.getAttribute('title')) ?? ''), 'modifier tooltip shows the breakdown');

  // Concise mode hides the dice boxes (totals only).
  await roller.locator('.ic[title="Concise"]').click();
  assert((await roller.locator('.latest .die').count()) === 0, 'concise mode hides the dice');
  await roller.locator('.ic[title="Detailed"]').click();

  // A quick die and a custom expression land in the log.
  await roller.locator('.quick button', { hasText: 'd20' }).click();
  await roller.locator('.customrow input').fill('2d6+3');
  await roller.locator('.customrow button', { hasText: 'Roll' }).click();
  await page.waitForTimeout(100);
  await roller.locator('.logtoggle').click();
  assert((await roller.locator('.log li').count()) >= 2, 'previous rolls are kept in the log');

  // Spell damage roll (Fireball → damage only).
  await cell(page, 'Spells').filter({ has: page.locator('button.roll') }).first().locator('li', { hasText: 'Fireball' }).locator('button.roll').first().click();
  await page.waitForTimeout(150);
  assert((await roller.locator('.gtitle').innerText()).toUpperCase() === 'FIREBALL', 'spell roll works');

  // Hit-dice roll lands in the roller/log too (with the die + CON).
  await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('cs.char.test') || '{}');
    c.abilities = { ...(c.abilities || {}), con: 14 };
    c.hp = { max: 44, current: 20, temp: 0 };
    c.hitDice = [{ die: 10, max: 5, used: 0 }];
    localStorage.setItem('cs.char.test', JSON.stringify(c));
  });
  await page.goto(baseUrl + '/local/test', { waitUntil: 'networkidle' });
  await page.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });
  await page.locator('header.top button', { hasText: 'Dice' }).click();
  await cell(page, 'Rest & Level Up').locator('button.roll', { hasText: 'Roll' }).first().click();
  await page.waitForTimeout(150);
  assert((await roller.locator('.gtitle').innerText()).toUpperCase() === 'HIT DIE D10', 'hit-dice roll shows in the roller');
  assert(/CON/.test((await roller.locator('.latest .mod').getAttribute('title')) ?? ''), 'hit-dice roll includes the CON modifier');
}
