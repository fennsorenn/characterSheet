import { cell, assert } from '../harness.mjs';

// Persistent build changes (ASI/feat/racial) show as plain numbers; only
// fleeting effects badge — equipment grey, buffs green.
export default async function ({ page, baseUrl }) {
  async function setC(patch) {
    await page.evaluate((pt) => {
      const c = JSON.parse(localStorage.getItem('cs.char.test') || '{}');
      Object.assign(c, pt, { abilities: { ...c.abilities, ...(pt.abilities ?? {}) } });
      localStorage.setItem('cs.char.test', JSON.stringify(c));
    }, patch);
    await page.goto(baseUrl + '/local/test', { waitUntil: 'networkidle' });
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

  // 2b) Flat-bonus item (Belt of Dwarvenkind +2 Con): the badge uses the item's
  // slot icon (waist), matching the inventory icon — not a generic shield.
  await setC({
    abilities: { con: 10 },
    inventory: [
      { name: 'Belt of Dwarvenkind', source: 'DMG', quantity: 1, equipped: true, attuned: true },
      { name: 'Shield', source: 'PHB', quantity: 1, equipped: true }
    ]
  });
  const conCell = page.locator('.ability', { hasText: 'Con' }).first();
  assert((await conCell.locator('.eff .value').first().innerText()).trim().startsWith('12'), 'flat-bonus belt applies +2 Con');
  const badgeSvg = await conCell.locator('.badge svg').first().innerHTML();
  const inv = cell(page, 'Inventory');
  const beltSvg = await inv.locator('li', { hasText: 'Belt of Dwarvenkind' }).locator('.itemicon svg').innerHTML();
  const shieldSvg = await inv.locator('li', { hasText: 'Shield' }).locator('.itemicon svg').innerHTML();
  assert(badgeSvg === beltSvg, 'Con badge icon matches the belt (waist) inventory icon');
  assert(badgeSvg !== shieldSvg, 'Con badge icon is NOT the generic shield icon');

  // 3) Shield → AC grey badge; buff → AC green badge.
  await setC({ inventory: [{ name: 'Shield', source: 'PHB', quantity: 1, equipped: true }], buffs: [] });
  const ac = cell(page, 'Defenses');
  assert((await ac.locator('.ac-badge').count()) === 1, 'shield gives AC a badge');
  assert((await ac.locator('.ac-badge.buff').count()) === 0, 'shield AC badge is grey, not green');

  await setC({ inventory: [], buffs: [{ id: 'b', name: 'Shield of Faith', active: true, modifiers: [{ target: 'ac', value: 2 }] }] });
  assert((await ac.locator('.ac-badge.buff').count()) === 1, 'a temporary AC buff shows a green badge');
}
