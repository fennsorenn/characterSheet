import { assert, assertEqual, cell } from '../harness.mjs';

const dial = (page) => page.locator('.dial[role=dialog]');
const hpCurrent = (page) => cell(page, 'Hit Points').locator('[aria-label="Current hit points"]');
const storedHp = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('cs.char.test')).hp.current);

async function setDialMode(page, want) {
  await page.locator('aside.dock button[title="More"]').click();
  await page.waitForTimeout(200);
  const btn = page.locator('aside.dock .db', { hasText: 'Dial' }).first();
  for (let i = 0; i < 4; i++) {
    if ((await btn.innerText()).toLowerCase().includes(want)) break;
    await btn.click();
    await page.waitForTimeout(200);
  }
  assert((await btn.innerText()).toLowerCase().includes(want), `reached dial mode ${want}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

// Editing a number without the on-screen keyboard: a window of per-digit arrows
// that shows the new value and what it changes. Off by default on a desktop,
// where a keyboard costs nothing; forced on here to exercise it.
export default async function ({ page }) {
  // --- Default on a fine pointer: type, as before ---
  assertEqual(
    await hpCurrent(page).evaluate((el) => el.tagName.toLowerCase()),
    'input',
    'a desktop types its numbers'
  );
  assertEqual(await dial(page).count(), 0, 'and no dial is open');

  await setDialMode(page, 'always');

  // --- With the dial on, the field is a button, not an input ---
  assertEqual(
    await hpCurrent(page).evaluate((el) => el.tagName.toLowerCase()),
    'button',
    'the field stops being an input, so nothing raises a keyboard'
  );
  assertEqual(
    await page.locator('.cell input[inputmode=numeric]').count(),
    0,
    'no numeric inputs are left on the sheet'
  );

  const before = await storedHp(page);
  await hpCurrent(page).click();
  await page.waitForSelector('.dial[role=dialog]', { timeout: 5000 });
  assert(/current hit points/i.test(await dial(page).innerText()), 'the dial names the field');

  // Three digits for hit points, one arrow above and below each.
  assertEqual(await dial(page).locator('.col .digit').count(), 3, 'a digit per place');
  assertEqual(await dial(page).locator('.arrow.up').count(), 3, 'an arrow above each');
  assertEqual(await dial(page).locator('.arrow.down').count(), 3, 'and below');
  assertEqual(
    await dial(page).locator('.arrow.up').first().getAttribute('aria-label'),
    'Increase by 100',
    'the leftmost arrow moves the hundreds'
  );
  assertEqual(await dial(page).locator('.delta').innerText(), '±0', 'no change yet');

  // --- Stepping carries rather than cycling ---
  await dial(page).locator('.arrow.up').nth(1).click(); // tens
  await page.waitForTimeout(150);
  await dial(page).locator('.arrow.up').nth(2).click(); // ones
  await page.waitForTimeout(150);
  const shown = Number(await dial(page).locator('.val').inputValue());
  assertEqual(shown, before + 11, 'the arrows added ten and one');
  assertEqual(await dial(page).locator('.delta').innerText(), '+11', 'and the delta says so');

  // Nothing has reached the sheet yet — the delta is only honest if it hasn't.
  assertEqual(await storedHp(page), before, 'the sheet is untouched until Apply');

  await dial(page).locator('.arrow.down').nth(2).click();
  await page.waitForTimeout(150);
  assertEqual(await dial(page).locator('.delta').innerText(), '+10', 'down steps back');

  // --- Apply writes it; the field shows it ---
  await dial(page).locator('button.primary').click();
  await page.waitForTimeout(400);
  assertEqual(await dial(page).count(), 0, 'the dial closes');
  assertEqual(await storedHp(page), before + 10, 'and the value is applied');
  assertEqual((await hpCurrent(page).innerText()).trim(), String(before + 10), 'the field agrees');

  // --- Cancel leaves the value alone ---
  await hpCurrent(page).click();
  await page.waitForSelector('.dial[role=dialog]', { timeout: 5000 });
  await dial(page).locator('.arrow.up').nth(1).click();
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  assertEqual(await dial(page).count(), 0, 'Escape closes the dial');
  assertEqual(await storedHp(page), before + 10, 'without applying the change');

  // --- A keyboard still works where there is one ---
  await hpCurrent(page).click();
  await page.waitForSelector('.dial[role=dialog]', { timeout: 5000 });
  const field = dial(page).locator('input.val');
  await field.fill('33');
  await dial(page).locator('button.primary').click();
  await page.waitForTimeout(400);
  assertEqual(await storedHp(page), 33, 'typing into the dial works on a desktop');

  // --- Bounds are respected, and dead arrows say so ---
  const score = cell(page, 'Ability Scores').locator('.ability', { hasText: 'Str' }).locator('.number-field').first();
  await score.click();
  await page.waitForSelector('.dial[role=dialog]', { timeout: 5000 });
  assertEqual(await dial(page).locator('.col .digit').count(), 2, 'an ability score is two digits');
  // 10 by default: the tens can go up (20) but the hundreds do not exist, and
  // down from 10 would leave 0, below the floor of 1.
  await dial(page).locator('.arrow.down').first().click();
  await page.waitForTimeout(150);
  assertEqual(Number(await dial(page).locator('.val').inputValue()), 1, 'clamped to the minimum');
  assert(
    await dial(page).locator('.arrow.down').first().isDisabled(),
    'an arrow with nowhere to go is disabled rather than silent'
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // --- The mode is remembered ---
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.cell', { timeout: 20000 });
  assertEqual(
    await hpCurrent(page).evaluate((el) => el.tagName.toLowerCase()),
    'button',
    'the dial setting survives a reload'
  );

  await setDialMode(page, 'touch'); // back to the default for the specs that follow
  assertEqual(
    await hpCurrent(page).evaluate((el) => el.tagName.toLowerCase()),
    'input',
    'and auto goes back to typing on a desktop'
  );
}
