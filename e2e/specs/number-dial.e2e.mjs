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
  assertEqual(await dial(page).locator('input.digits').count(), 1, 'one field for the number');
  assertEqual(await dial(page).locator('input.digits').inputValue().then((v) => v.length), 3, 'three digits wide');
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

  // --- The number is one field: tapping it raises the keyboard ---
  await hpCurrent(page).click();
  await page.waitForSelector('.dial[role=dialog]', { timeout: 5000 });
  const digitField = dial(page).locator('input.digits');
  assertEqual(await digitField.getAttribute('inputmode'), 'numeric', 'a numeric field');
  assertEqual(await digitField.getAttribute('maxlength'), '3', 'holding one character per place');

  // Its digits sit under their arrows: tabular numerals at the column pitch.
  const aligned = await page.evaluate(() => {
    const inp = document.querySelector('.dial input.digits');
    const box = inp.getBoundingClientRect();
    const style = getComputedStyle(inp);
    const pitch = parseFloat(style.letterSpacing) + (box.width + 6.4) / inp.value.length - parseFloat(style.letterSpacing);
    void pitch;
    // Measure the first digit's centre from the indent, and compare with the
    // first arrow's; if the spacing is wrong they drift by a column.
    const first = document.querySelector('.dial .arrow.up').getBoundingClientRect();
    const ratio = (box.width + 6.4) / 3; // column pitch, trailing space included
    const digitCentre = box.left + parseFloat(style.textIndent) + (ratio - parseFloat(style.letterSpacing)) / 2;
    return {
      offBy: Math.abs(digitCentre - (first.left + first.width / 2)),
      lastOffBy: Math.abs(digitCentre + 2 * ratio - (
        [...document.querySelectorAll('.dial .arrow.up')].at(-1).getBoundingClientRect().left +
        first.width / 2
      ))
    };
  });
  assert(aligned.offBy < 2, `the first digit sits under its arrow (off by ${aligned.offBy.toFixed(1)}px)`);
  assert(aligned.lastOffBy < 2, `and so does the last (off by ${aligned.lastOffBy.toFixed(1)}px)`);

  // Typing replaces the digit the caret is in front of and moves on, so three
  // places take three keystrokes in the one field.
  await digitField.click();
  await digitField.evaluate((el) => el.setSelectionRange(0, 0));
  await page.keyboard.type('142');
  await page.waitForTimeout(250);
  assertEqual(await digitField.inputValue(), '142', 'the field reads what was typed');
  assertEqual(Number(await dial(page).locator('.val').inputValue()), 142, 'and that is the value');
  await dial(page).locator('button.primary').click();
  await page.waitForTimeout(400);
  assertEqual(await storedHp(page), 142, 'and Apply writes it');

  // Backspace clears a place rather than closing the gap, so the columns hold.
  await hpCurrent(page).click();
  await page.waitForSelector('.dial[role=dialog]', { timeout: 5000 });
  await dial(page).locator('input.digits').click();
  await dial(page).locator('input.digits').evaluate((el) => el.setSelectionRange(3, 3));
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(250);
  assertEqual(await dial(page).locator('input.digits').inputValue(), '140', 'the ones went to zero');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // A digit is a digit, not a step: 9 in the tens of a 1–30 score is 90, which
  // the ceiling answers rather than the tens becoming "+90".
  const str = cell(page, 'Ability Scores').locator('.ability', { hasText: 'Str' }).locator('.number-field').first();
  await str.click();
  await page.waitForSelector('.dial[role=dialog]', { timeout: 5000 });
  await dial(page).locator('input.digits').click();
  await dial(page).locator('input.digits').evaluate((el) => el.setSelectionRange(0, 0));
  await page.keyboard.type('9');
  await page.waitForTimeout(250);
  assertEqual(Number(await dial(page).locator('.val').inputValue()), 30, 'clamped to the ceiling');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // --- The value inside the dial stays a field, on every device ---
  // The dial exists so a keyboard doesn't come up unasked, not to lock it away:
  // tapping the number is the way back to typing.
  await hpCurrent(page).click();
  await page.waitForSelector('.dial[role=dialog]', { timeout: 5000 });
  const field = dial(page).locator('.val');
  assertEqual(await field.evaluate((el) => el.tagName.toLowerCase()), 'input', 'the readout is a field');
  assertEqual(
    await field.getAttribute('inputmode'),
    'numeric',
    'asking for the numeric keyboard rather than the full one'
  );
  await field.fill('33');
  await dial(page).locator('button.primary').click();
  await page.waitForTimeout(400);
  assertEqual(await storedHp(page), 33, 'typing into the dial applies that value');

  // It takes a delta the same way the plain field does.
  await hpCurrent(page).click();
  await page.waitForSelector('.dial[role=dialog]', { timeout: 5000 });
  await dial(page).locator('.val').fill('+7');
  await dial(page).locator('.arrow.up').first().click(); // blur commits the delta
  await page.waitForTimeout(200);
  assertEqual(await dial(page).locator('.delta').innerText(), '+107', 'a typed delta lands, arrows keep working');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // --- Bounds are respected, and dead arrows say so ---
  const score = cell(page, 'Ability Scores').locator('.ability', { hasText: 'Str' }).locator('.number-field').first();
  await score.click();
  await page.waitForSelector('.dial[role=dialog]', { timeout: 5000 });
  assertEqual(
    await dial(page).locator('input.digits').inputValue().then((v) => v.length),
    2,
    'an ability score is two digits wide'
  );
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
