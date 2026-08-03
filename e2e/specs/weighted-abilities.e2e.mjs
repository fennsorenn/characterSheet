import { assert, assertEqual, buildCell, cell } from '../harness.mjs';

/** The effective score shown for an ability (persistent bonuses read as plain numbers). */
async function score(page, abil) {
  const box = cell(page, 'Ability Scores').locator('.ability', { hasText: abil }).first();
  const persistent = box.locator('.persistent').first();
  if (await persistent.count()) return Number(await persistent.innerText());
  return Number(await box.locator('input.number-field').first().inputValue());
}

/** The picker for the background's ability spread. */
const spread = (page) => page.locator('.gc', { has: page.locator('select.alt') }).first();

// A 2024 background hands out an uneven, either/or spread — +2 and +1 to two of
// three named abilities, or +1 to each of the three. Both halves of that were
// lost: the sizes (it offered +1 twice) and the pool (it offered all six).
export default async function ({ page }) {
  const build = buildCell(page);
  await build.locator('.line', { hasText: 'Background' }).locator('.choose').click();
  await page.waitForSelector('.overlay', { timeout: 5000 });
  await page.fill('.overlay input.search', 'Hermit');
  await page.waitForTimeout(400);
  // The 2024 printing specifically: the 2014 one grants no ability scores.
  await page.locator('.overlay .results li', { hasText: 'XPHB' }).first().locator('.add').click({ force: true });
  await page.waitForTimeout(200);
  await page.locator('.overlay .close').click();
  await page.waitForSelector('.overlay', { state: 'detached', timeout: 5000 });
  await page.waitForTimeout(400);

  // --- The spread is offered as a spread, not as two loose +1s ---
  const alt = spread(page).locator('select.alt');
  assertEqual(
    await alt.locator('option').allInnerTexts(),
    ['+2/+1', '+1/+1/+1'],
    'both spreads the background allows are offered'
  );

  const slots = spread(page).locator('select:not(.alt)');
  assertEqual(await slots.count(), 2, 'the default spread has two picks');
  assertEqual(
    (await slots.nth(0).locator('option').first().innerText()).trim(),
    '+2…',
    'the first is worth +2'
  );
  assertEqual((await slots.nth(1).locator('option').first().innerText()).trim(), '+1…', 'the second +1');
  assertEqual(
    (await slots.nth(0).locator('option').allInnerTexts()).slice(1),
    ['Con', 'Wis', 'Cha'],
    'and only the abilities the background names can be picked'
  );

  // --- Picking gives what was picked ---
  const before = { con: await score(page, 'Con'), wis: await score(page, 'Wis'), cha: await score(page, 'Cha') };
  await slots.nth(0).selectOption('con');
  await page.waitForTimeout(250);
  await spread(page).locator('select:not(.alt)').nth(1).selectOption('wis');
  await page.waitForTimeout(350);
  assertEqual(await score(page, 'Con'), before.con + 2, 'the +2 slot is worth two');
  assertEqual(await score(page, 'Wis'), before.wis + 1, 'the +1 slot one');
  assertEqual(await score(page, 'Cha'), before.cha, 'and nothing else moves');

  // --- The other spread replaces it rather than stacking with it ---
  await spread(page).locator('select.alt').selectOption('1');
  await page.waitForTimeout(400);
  assertEqual(await spread(page).locator('select:not(.alt)').count(), 3, 'three picks now');
  assertEqual(
    (await spread(page).locator('select:not(.alt)').first().locator('option').first().innerText()).trim(),
    '+1…',
    'each worth one'
  );
  // The picks made against the other spread are not in force while it is not.
  assertEqual(await score(page, 'Con'), before.con, 'the +2/+1 picks stop applying');
  assertEqual(await score(page, 'Wis'), before.wis, 'both of them');

  for (const [i, abil] of [[0, 'con'], [1, 'wis'], [2, 'cha']]) {
    await spread(page).locator('select:not(.alt)').nth(i).selectOption(abil);
    await page.waitForTimeout(250);
  }
  assertEqual(await score(page, 'Con'), before.con + 1, 'each of the three gains one');
  assertEqual(await score(page, 'Wis'), before.wis + 1, 'wisdom too');
  assertEqual(await score(page, 'Cha'), before.cha + 1, 'and charisma');

  // --- Switching back finds the earlier picks where they were left ---
  await spread(page).locator('select.alt').selectOption('0');
  await page.waitForTimeout(400);
  assertEqual(await score(page, 'Con'), before.con + 2, 'the +2 is back');
  assertEqual(await score(page, 'Cha'), before.cha, 'and the third pick is not');

  // --- It survives a reload ---
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.cell', { timeout: 20000 });
  await page.waitForTimeout(500);
  assertEqual(await score(page, 'Con'), before.con + 2, 'the spread survives a reload');
  assert(
    (await spread(page).locator('select.alt').inputValue()) === '0',
    'along with which spread is in force'
  );

  // Leave the character as it was found.
  await page.evaluate(() => {
    const key = 'cs.char.test';
    const c = JSON.parse(localStorage.getItem(key));
    delete c.background;
    c.abilityChoices = {};
    c.featureOptions = {};
    c.grantChoices = {};
    localStorage.setItem(key, JSON.stringify(c));
  });
}
