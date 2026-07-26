import { assert, assertEqual, cell, buildCell, addClassFromCatalog } from '../harness.mjs';

// Hit dice follow the classes. They used to be stored whole and grown only by
// the level-up flow, so every other way of changing a class left them behind —
// a Fighter 5 / Cleric 1 still showed a single d10.
export default async function ({ page }) {
  const restCell = () => cell(page, 'Rest & Level Up');
  const pools = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('cs.char.test')).hitDice);
  const shownDice = async () => restCell().locator('.pool .die').allInnerTexts();

  assertEqual(await pools(), [{ die: 10, max: 1, used: 0 }], 'a level-1 Fighter has one d10');

  // --- Typing a level in the build block ---
  const level = buildCell(page).locator('.classchip .lvl').first();
  await level.fill('5');
  await level.press('Enter');
  await page.waitForTimeout(400);
  assertEqual(await pools(), [{ die: 10, max: 5, used: 0 }], 'raising the level adds dice');
  assertEqual(await shownDice(), ['d10'], 'still one pool, shown once');

  // --- Adding a class from the catalog ---
  await addClassFromCatalog(page, 'Cleric');
  await page.waitForTimeout(400);
  assertEqual(
    await pools(),
    [
      { die: 10, max: 5, used: 0 },
      { die: 8, max: 1, used: 0 }
    ],
    'a second class brings its own die'
  );
  assertEqual(await shownDice(), ['d10', 'd8'], 'and its own row, biggest die first');

  // --- Spending one, which needs damage to be allowed at all ---
  const hp = cell(page, 'Hit Points').locator('input').first();
  await hp.fill('20');
  await hp.press('Enter');
  await page.waitForTimeout(200);
  await hp.fill('4');
  await hp.press('Enter');
  await page.waitForTimeout(300);

  const d10Pool = restCell().locator('.pool', { hasText: 'd10' }).first();
  const spend = d10Pool.locator('button.spend').first();
  assert(!(await spend.isDisabled()), 'a damaged character can spend a die');
  await spend.click();
  await page.waitForTimeout(400);
  assertEqual((await pools())[0].used, 1, 'spending marks the die used');
  assert(
    Number(await hp.inputValue()) > 4,
    `spending heals (hp is now ${await hp.inputValue()})`
  );

  // --- A spent die survives a level change, and is clamped by losing levels ---
  await level.fill('8');
  await level.press('Enter');
  await page.waitForTimeout(400);
  assertEqual((await pools())[0], { die: 10, max: 8, used: 1 }, 'levelling keeps the spent die');

  await level.fill('1');
  await level.press('Enter');
  await page.waitForTimeout(400);
  assertEqual((await pools())[0], { die: 10, max: 1, used: 1 }, 'losing levels clamps the spent count');

  // --- A long rest gives them back ---
  await restCell().locator('button.long').click();
  await page.waitForTimeout(400);
  assertEqual((await pools())[0].used, 0, 'a long rest recovers hit dice');

  // --- Removing the class removes its dice ---
  await buildCell(page).locator('.classchip', { hasText: 'Fighter' }).locator('.x').click();
  await page.waitForTimeout(400);
  assertEqual(await pools(), [{ die: 8, max: 1, used: 0 }], 'the gone class takes its dice with it');
  assertEqual(await shownDice(), ['d8'], 'and the sheet agrees');
}
