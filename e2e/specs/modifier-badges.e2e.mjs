import { cell, assert } from '../harness.mjs';

// Persistent build changes (ASI/feat/racial) show as plain numbers; only
// fleeting effects badge — equipment grey, buffs green.
export default async function ({ page, baseUrl }) {
  async function setC(patch) {
    await page.evaluate((pt) => {
      const c = JSON.parse(localStorage.getItem('charactersheet.character'));
      Object.assign(c, pt, { abilities: { ...c.abilities, ...(pt.abilities ?? {}) } });
      localStorage.setItem('charactersheet.character', JSON.stringify(c));
    }, patch);
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });
  }
  const strCell = () => page.locator('.ability', { hasText: 'Str' }).first();

  // 1) Pure ASI +2 STR (15→17): plain number, no badge.
  await setC({ abilities: { str: 15 }, abilityChoices: { 'ASI|PHB|F4': { str: 2 } }, inventory: [], buffs: [] });
  assert((await strCell().locator('.persistent').first().innerText()) === '17', 'ASI shows STR 17 plainly');
  assert((await strCell().locator('.eff').count()) === 0, 'ASI shows no fleeting badge');

  // 2) Equipment that sets STR (Belt of Hill Giant Strength → 21): grey badge, not green.
  await setC({
    abilities: { str: 15 },
    abilityChoices: {},
    inventory: [{ name: 'Belt of Hill Giant Strength', source: 'DMG', quantity: 1, equipped: true, attuned: true }]
  });
  assert((await strCell().locator('.eff .value').first().innerText()).trim().startsWith('21'), 'equipment sets STR 21');
  assert((await strCell().locator('.eff.buff').count()) === 0, 'equipment badge is NOT the green buff style');
  assert((await strCell().locator('.badge').count()) > 0, 'equipment shows a badge');

  // 3) Shield → AC grey badge; buff → AC green badge.
  await setC({ inventory: [{ name: 'Shield', source: 'PHB', quantity: 1, equipped: true }], buffs: [] });
  const ac = cell(page, 'Defenses');
  assert((await ac.locator('.ac-badge').count()) === 1, 'shield gives AC a badge');
  assert((await ac.locator('.ac-badge.buff').count()) === 0, 'shield AC badge is grey, not green');

  await setC({ inventory: [], buffs: [{ id: 'b', name: 'Shield of Faith', active: true, modifiers: [{ target: 'ac', value: 2 }] }] });
  assert((await ac.locator('.ac-badge.buff').count()) === 1, 'a temporary AC buff shows a green badge');
}
