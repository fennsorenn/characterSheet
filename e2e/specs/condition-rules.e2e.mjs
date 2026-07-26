import { assert, assertEqual, cell } from '../harness.mjs';

const tip = (page) => page.locator('#rules-tip');
const chip = (page, name) => cell(page, 'Conditions').locator('button.chip', { hasText: name }).first();

/** Press and hold, the way a finger does — the mouse path never reaches this code. */
async function hold(page, locator, ms = 600) {
  const box = await locator.boundingBox();
  const at = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  await locator.evaluate((el, p) => {
    const opts = { pointerType: 'touch', bubbles: true, clientX: p.x, clientY: p.y, pointerId: 1 };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
  }, at);
  await page.waitForTimeout(ms);
  await locator.evaluate((el, p) => {
    const opts = { pointerType: 'touch', bubbles: true, clientX: p.x, clientY: p.y, pointerId: 1 };
    el.dispatchEvent(new PointerEvent('pointerup', opts));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }, at);
  await page.waitForTimeout(150);
}

const conditionsOf = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('cs.char.test')).conditions ?? []);

// Condition chips explain themselves: hover with a mouse, hold with a finger.
// The rules text is catalog content, not something the app ships.
export default async function ({ page }) {
  const blinded = chip(page, 'Blinded');

  // --- Hover ---
  assertEqual(await tip(page).count(), 0, 'no tooltip until asked for');
  await blinded.hover();
  await page.waitForSelector('#rules-tip', { timeout: 3000 });
  const text = await tip(page).innerText();
  assert(/blinded/i.test(text), `the tooltip names the condition (${text.slice(0, 60)}…)`);
  assert(/can't see|cannot see/i.test(text), `and carries its rules text (${text.slice(0, 120)}…)`);

  // It is placed against the chip, on screen, and clear of it.
  const geom = await page.evaluate(() => {
    const t = document.querySelector('#rules-tip').getBoundingClientRect();
    return { t: { l: t.left, r: t.right, top: t.top, b: t.bottom }, w: innerWidth, h: innerHeight };
  });
  assert(geom.t.l >= 0 && geom.t.r <= geom.w, `stays inside the viewport (${geom.t.l}–${geom.t.r} of ${geom.w})`);
  assert(geom.t.top >= 0 && geom.t.b <= geom.h, 'vertically too');
  assert(
    await page.evaluate(() => getComputedStyle(document.querySelector('#rules-tip')).visibility === 'visible'),
    'and is actually visible, not still waiting to be placed'
  );

  // Hovering does not change the sheet, and leaving puts it away.
  assertEqual(await conditionsOf(page), [], 'hovering toggles nothing');
  await cell(page, 'Conditions').locator('h3').hover();
  await page.waitForTimeout(300);
  assertEqual(await tip(page).count(), 0, 'the tooltip closes when the pointer leaves');

  // --- Escape closes it ---
  await blinded.hover();
  await page.waitForSelector('#rules-tip', { timeout: 3000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  assertEqual(await tip(page).count(), 0, 'Escape closes it too');

  // --- A click still toggles the condition ---
  await blinded.click();
  await page.waitForTimeout(300);
  assertEqual(await conditionsOf(page), ['Blinded'], 'clicking a chip still toggles it');
  await blinded.click();
  await page.waitForTimeout(300);
  assertEqual(await conditionsOf(page), [], 'and toggles it back off');

  // --- Hold: opens the rules, and does not toggle ---
  await hold(page, chip(page, 'Poisoned'));
  assert((await tip(page).count()) === 1, 'holding a chip opens its rules');
  assert(/poisoned/i.test(await tip(page).innerText()), 'for the one held');
  assertEqual(
    await conditionsOf(page),
    [],
    'and the press that opened it does not also toggle the condition'
  );

  // A tap elsewhere dismisses a held-open tooltip.
  await page.mouse.click(5, 5);
  await page.waitForTimeout(200);
  assertEqual(await tip(page).count(), 0, 'tapping away closes it');

  // A short press is an ordinary tap: it toggles and opens nothing.
  await hold(page, chip(page, 'Poisoned'), 120);
  assertEqual(await tip(page).count(), 0, 'a quick tap opens no tooltip');
  assertEqual(await conditionsOf(page), ['Poisoned'], 'it just toggles');
  await chip(page, 'Poisoned').click();
  await page.waitForTimeout(200);

  // --- Exhaustion has no other job, so a plain click opens its rules ---
  await cell(page, 'Conditions').locator('button.lbl').click();
  await page.waitForTimeout(250);
  const exh = await tip(page).innerText();
  assert(/exhaustion/i.test(exh), 'the exhaustion label opens its rules');
  assert(/level/i.test(exh), 'which are the ones about levels');
  // The entries tree is rendered, not flattened to one blob: 2024 exhaustion is
  // four named sections, 2014 is prose plus a table. Either way it has parts.
  assert(
    (await tip(page).locator('.tb p, .tb li, .tb table').count()) > 1,
    'rendered as structured rules rather than a single run-on paragraph'
  );
  await page.keyboard.press('Escape');

  // --- Read mode: locked is not mute ---
  const modeBtn = page.locator('aside.dock .db.mode').first();
  for (let i = 0; i < 4; i++) {
    if ((await modeBtn.locator('.lb').innerText()).toLowerCase() === 'read') break;
    await modeBtn.click();
    await page.waitForTimeout(200);
  }
  assertEqual((await modeBtn.locator('.lb').innerText()).toLowerCase(), 'read', 'reached read mode');
  await chip(page, 'Charmed').hover();
  await page.waitForSelector('#rules-tip', { timeout: 3000 });
  assert(/charmed/i.test(await tip(page).innerText()), 'a locked chip still explains itself');
  // force: Playwright treats aria-disabled as not-enabled, which is the point —
  // the chip advertises that it is locked, so the click has to be forced past it.
  await chip(page, 'Charmed').click({ force: true });
  await page.waitForTimeout(300);
  assertEqual(await conditionsOf(page), [], 'but clicking it changes nothing in read mode');

  // Back to edit for whatever runs next.
  for (let i = 0; i < 4; i++) {
    if ((await modeBtn.locator('.lb').innerText()).toLowerCase() === 'edit') break;
    await modeBtn.click();
    await page.waitForTimeout(200);
  }
  await page.keyboard.press('Escape');
}
