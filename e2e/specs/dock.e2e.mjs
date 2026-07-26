import { assert, assertEqual, cell, dock, openDock, closeDock, dockControl, dockMenu } from '../harness.mjs';

// One dock replaces three bars: the app-bar actions, the sheet's tools row and
// the pinned-creature dock. Its first layer is what you touch mid-session; the
// rest is behind an expand, and buff mode shows what it is actually doing.
export default async function ({ page }) {
  // --- The bars it replaces are gone ---
  assertEqual(await page.locator('.sheet .tools').count(), 0, 'the sheet tools row is gone');
  assertEqual(await page.locator('header.top .actions').count(), 0, 'the app-bar actions are gone');
  assert((await dock(page).count()) === 1, 'and there is exactly one dock');

  // --- Layer one works without expanding anything ---
  assertEqual(await page.locator('.roller').count(), 0, 'the roller starts closed');
  await dockControl(page, 'Dice');
  assert((await page.locator('.roller').count()) === 1, 'Dice opens the roller');
  // It must not open underneath the dock, which draws above it.
  const clear = await page.evaluate(() => {
    const r = document.querySelector('.roller').getBoundingClientRect();
    const d = document.querySelector('aside.dock').getBoundingClientRect();
    return r.right <= d.left || r.left >= d.right || r.bottom <= d.top || r.top >= d.bottom;
  });
  assert(clear, 'the roller opens clear of the dock');
  await dockControl(page, 'Dice');
  assertEqual(await page.locator('.roller').count(), 0, 'and closes again');

  await dockControl(page, 'Notes');
  assert((await page.locator('.reminder-banner').count()) > 0, 'Notes turns reminder mode on');
  await dockControl(page, 'Notes');
  assertEqual(await page.locator('.reminder-banner').count(), 0, 'and off again');

  // --- Buff mode lists the buffs it is applying ---
  await dockControl(page, 'Buff');
  const buffs = () => dock(page).locator('.buff');
  assert((await dock(page).locator('.empty').count()) === 1, 'it says when nothing is buffed yet');

  // Type a delta into AC: buff mode turns that into a modifier on the node.
  // In buff mode every adjustable value becomes a `.buff-field`.
  const acField = cell(page, 'Defenses & Core').locator('.stat', { hasText: 'AC' }).locator('input.buff-field').first();
  await acField.fill('+2');
  await acField.press('Enter');
  await page.waitForTimeout(400);
  assertEqual(await buffs().count(), 1, 'the buff is listed');
  assertEqual(await buffs().first().locator('.wh').innerText(), 'Armour Class', 'named, not a node id');
  assertEqual(await buffs().first().locator('.d').innerText(), '+2', 'with its signed delta');
  assert((await dock(page).locator('.ct').first().innerText()) === '1', 'and the control badges the count');

  // Clearing one clears exactly that one.
  const skill = cell(page, 'Skills').locator('li', { hasText: 'Stealth' }).first().locator('input.buff-field').first();
  if (await skill.count()) {
    await skill.fill('-1');
    await skill.press('Enter');
    await page.waitForTimeout(400);
  }
  const before = await buffs().count();
  await buffs().first().locator('.x').click();
  await page.waitForTimeout(300);
  assertEqual(await buffs().count(), before - 1, 'the × clears just that buff');

  await dock(page).locator('.clr').first().click(); // Clear all
  await page.waitForTimeout(300);
  assertEqual(await buffs().count(), 0, 'clear all empties the list');
  await dockControl(page, 'Buff'); // back off

  // --- The rest is one expand away ---
  assertEqual(await dock(page).locator('select.preset').count(), 0, 'the menu is closed to start');
  await openDock(page);
  assert((await dock(page).locator('select.preset').count()) === 1, 'the template switcher is in the menu');
  assert((await dock(page).locator('.db', { hasText: 'Print / PDF' }).count()) === 1, 'so is Print');
  await closeDock(page);
  assertEqual(await dock(page).locator('select.preset').count(), 0, 'Escape puts it away');

  await dockMenu(page, 'Edit layout');
  assert((await page.locator('.editbar').count()) === 1, 'Edit layout turns edit mode on');
  await dockMenu(page, 'Done editing layout');
  assertEqual(await page.locator('.editbar').count(), 0, 'and off again');

  // --- The edge follows the viewport ---
  assert(
    await dock(page).evaluate((el) => el.classList.contains('side')),
    'a desktop viewport docks to the side'
  );
  await page.setViewportSize({ width: 420, height: 900 });
  await page.waitForTimeout(400);
  assert(
    await dock(page).evaluate((el) => el.classList.contains('bottom')),
    'a phone viewport docks to the bottom'
  );
  assert((await dock(page).locator('.tabs .db').count()) >= 5, 'with the controls as a tab row');

  // --- On a phone the roller is *in* the dock, not floating over it ---
  await dockControl(page, 'Dice');
  assertEqual(await page.locator('.roller').count(), 0, 'no floating window on a phone');
  assert((await dock(page).locator('.quick button').count()) > 0, 'the dice live in the dock panel');
  assert((await dock(page).locator('.modes button[title="Advantage"]').count()) === 1, 'with its modes');

  await dockControl(page, 'Dice');
  assertEqual(await dock(page).locator('.quick').count(), 0, 'closing puts it away');
  // Opening another panel takes the roller down with it, so the tab is honest.
  await dockControl(page, 'Dice');
  assert((await dock(page).locator('.quick button').count()) > 0, 'roller showing again');
  await dock(page).locator('.db', { hasText: 'More' }).first().click();
  await page.waitForTimeout(300);
  assertEqual(await dock(page).locator('.quick').count(), 0, 'switching panels closes the roller');
  assert(
    !(await dock(page).locator('.db', { hasText: 'Dice' }).first().evaluate((el) => el.classList.contains('on'))),
    'and the Dice tab stops looking lit'
  );

  await page.setViewportSize({ width: 1200, height: 2100 });
  await page.waitForTimeout(400);
  await dockControl(page, 'Dice');
  assert((await page.locator('.roller').count()) === 1, 'back on a desktop it floats again');
  await dockControl(page, 'Dice');
}
