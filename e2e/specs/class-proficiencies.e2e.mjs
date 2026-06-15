import { cell, multiclass, assert, assertEqual } from '../harness.mjs';

async function litSaves(page) {
  const saves = cell(page, 'Saving Throws');
  const out = [];
  for (const a of ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']) {
    if (await saves.locator('li', { hasText: a }).locator('.dot.on, .dot.granted').count()) out.push(a);
  }
  return out;
}

// Class starting proficiencies + 5e multiclass rules through the grant pool.
export default async function ({ page }) {
  const traits = cell(page, 'Traits & Proficiencies');
  const rows = (await traits.locator('.row').allInnerTexts()).join(' | ');
  assert(/Simple/.test(rows) && /Martial/.test(rows), 'Fighter simple+martial weapon proficiencies');
  assert(/Heavy/.test(rows), 'Fighter heavy armor proficiency');
  assert((await traits.locator('.choice .gc select').count()) === 2, 'Fighter "choose 2 skills" picker');

  assertEqual(await litSaves(page), ['Strength', 'Constitution'], 'Fighter grants Str & Con saves');

  const sels = traits.locator('.choice .gc select');
  await sels.nth(0).selectOption('athletics').catch(() => {});
  await page.waitForTimeout(150);
  await sels.nth(1).selectOption('perception').catch(() => {});
  await page.waitForTimeout(250);

  const skills = cell(page, 'Skills');
  const athLit = await skills.locator('li', { hasText: 'Athletics' }).locator('.dot.proficient, .dot.expertise').count();
  assert(athLit > 0, 'a chosen class skill (Athletics) lights up proficient');

  // Multiclass into Cleric: gains its armor subset, but NO new saving throws.
  await multiclass(page, 'Cleric', 'PHB');
  assert(
    (await cell(page, 'Features & Traits').locator('.line', { hasText: 'Cleric subclass' }).count()) === 1,
    'Cleric was added as a second class'
  );
  assertEqual(await litSaves(page), ['Strength', 'Constitution'], 'multiclassing adds no saving-throw proficiencies');
}
