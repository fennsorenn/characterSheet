import { cell, setLevel, assert } from '../harness.mjs';

// An ASI slot taken as a feat: the ASI auto-hides once resolved, and the feat
// cascades into its own row with its own sub-choices (Magic Initiate's spells).
export default async function ({ page }) {
  const features = cell(page, 'Features & Traits');
  await setLevel(page, 4);

  const asiRow = features.locator('.features li', { hasText: 'Ability Score Improvement' }).first();
  assert((await asiRow.count()) === 1, 'ASI feature appears at level 4');

  await asiRow.locator('select.opt').first().selectOption('feat');
  await page.waitForSelector('.modal h2', { timeout: 5000 });
  await page.fill('.modal .search', 'Magic Initiate');
  await page.waitForTimeout(200);
  await page.locator('.modal .row', { hasText: 'Magic Initiate' }).first().click();
  await page.waitForTimeout(300);

  assert(
    (await features.locator('.features li', { hasText: 'Ability Score Improvement' }).count()) === 0,
    'resolved ASI auto-hides into the applied section'
  );

  const featRow = features.locator('.features li', { hasText: 'Magic Initiate' }).first();
  assert((await featRow.count()) === 1, 'the chosen feat cascades into its own Feat row');

  const optSel = featRow.locator('select.opt').first();
  assert((await optSel.count()) === 1, 'Magic Initiate shows its source/class select');
  const classOpts = (await optSel.locator('option').allInnerTexts()).filter((t) => t && !/choose/i.test(t));
  await optSel.selectOption({ label: classOpts[0] });
  await page.waitForTimeout(300);
  assert((await featRow.locator('.pill').count()) > 0, 'spell choices cascade once a source is chosen');
}
