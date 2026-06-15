import { cell, setLevel, assert } from '../harness.mjs';

// Optional-feature progressions: a Battle Master at level 7 has 5 maneuver
// slots, the picker filters to maneuvers, and picks dedupe across slots.
export default async function ({ page }) {
  const features = cell(page, 'Features & Traits');
  await setLevel(page, 7);

  const sub = features.locator('.line', { hasText: 'subclass' }).locator('select').first();
  await sub.selectOption({ label: 'Battle Master' });
  await page.waitForTimeout(300);

  const manRow = features.locator('.features li', { hasText: 'Maneuvers' }).first();
  assert((await manRow.count()) === 1, 'Maneuvers progression row present');
  assert((await manRow.locator('.pill').count()) === 5, 'Battle Master 7 grants 5 maneuver slots');

  await manRow.locator('.pill.empty').first().click();
  await page.waitForSelector('.modal h2', { timeout: 5000 });
  assert(/maneuver/i.test(await page.locator('.modal h2').innerText()), 'maneuver picker opens');

  const first = await page.locator('.modal .row .nm').first().innerText();
  await page.locator('.modal .row').first().click();
  await page.waitForTimeout(200);
  assert((await manRow.locator('.pill.empty').count()) === 4, 'one slot is filled after a pick');

  await manRow.locator('.pill.empty').first().click();
  await page.waitForSelector('.modal .row', { timeout: 5000 });
  const names = await page.locator('.modal .row .nm').allInnerTexts();
  assert(!names.includes(first), 'already-picked maneuver is excluded from the next slot');
  await page.keyboard.press('Escape');
}
