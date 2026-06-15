import { cell, addClassFromCatalog, assert, assertEqual } from '../harness.mjs';

async function classNames(page) {
  return cell(page, 'Features & Traits').locator('.line.classes .classchip .cname').allInnerTexts();
}
async function litSaves(page) {
  const saves = cell(page, 'Saving Throws');
  const out = [];
  for (const a of ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']) {
    if (await saves.locator('li', { hasText: a }).locator('.dot.on, .dot.granted').count()) out.push(a);
  }
  return out;
}

// Classes are reachable from the catalog: add, remove, set level — not stuck on
// the default Fighter. Saves follow the (first) class via the grant pool.
export default async function ({ page }) {
  assertEqual(await classNames(page), ['Fighter'], 'starts as a Fighter');
  assertEqual(await litSaves(page), ['Strength', 'Constitution'], 'Fighter grants Str/Con saves');

  await addClassFromCatalog(page, 'Cleric');
  assertEqual(await classNames(page), ['Fighter', 'Cleric'], 'Cleric added as a second class');

  // Remove Fighter → only Cleric remains; saves switch to Cleric's Wis/Cha.
  const line = cell(page, 'Features & Traits').locator('.line.classes');
  await line.locator('.classchip', { hasText: 'Fighter' }).locator('.x').click();
  await page.waitForTimeout(200);
  assertEqual(await classNames(page), ['Cleric'], 'Fighter removed — no longer stuck on it');
  assertEqual(await litSaves(page), ['Wisdom', 'Charisma'], 'saves now come from Cleric (grant-driven, no stale Str/Con)');

  // Set the class level directly; total level reflects it.
  const lvl = line.locator('.classchip .lvl').first();
  await lvl.fill('3');
  await lvl.press('Enter');
  await page.waitForTimeout(250);
  const total = await cell(page, 'Defenses').locator('.stat', { hasText: 'Level' }).locator('input').inputValue();
  assert(total === '3', `total level reflects the class level (got ${total})`);
}
