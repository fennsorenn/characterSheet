import { cell, browseAdd, assert } from '../harness.mjs';

// The generic grant pool: a race's fixed bonuses + set grants, and a feat's
// `choose` blocks (ability + save proficiency) flowing to the right places.
export default async function ({ page }) {
  const traits = cell(page, 'Traits & Proficiencies');
  assert((await traits.count()) === 1, 'Traits & Proficiencies block is present');

  const conInput = page.locator('.ability', { hasText: 'Con' }).first().locator('input').first();
  await browseAdd(page, 'race', 'Dwarf');

  const conEff = await page.locator('.ability', { hasText: 'Con' }).first().locator('.eff .value').innerText();
  assert(conEff === '12', `Dwarf grants +2 Con (effective ${conEff})`);
  assert((await conInput.inputValue()) === '10', 'base Con stays 10 (non-destructive)');

  const rows = (await traits.locator('.row').allInnerTexts()).join(' | ');
  assert(/Poison/i.test(rows), 'Dwarf poison resistance is listed');
  assert(/Walk 25 ft/.test(rows), 'Dwarf walk speed (25) is listed');
  assert(/Darkvision 60 ft/.test(rows), 'Dwarf darkvision (60) is listed');

  await browseAdd(page, 'feat', 'Resilient');
  const resRow = cell(page, 'Features & Traits').locator('.features li', { hasText: 'Resilient' }).first();
  assert((await resRow.locator('.gc select').count()) === 2, 'Resilient surfaces ability + save-proficiency pickers');

  for (let i = 0; i < 2; i++) {
    await resRow.locator('.gc select').nth(i).selectOption('con').catch(() => {});
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(200);
  assert((await resRow.locator('.pbadge').count()) === 0, 'Resilient pending badge clears after both picks');

  const conEff2 = await page.locator('.ability', { hasText: 'Con' }).first().locator('.eff .value').innerText();
  assert(conEff2 === '13', `Con = 10 + 2 (Dwarf) + 1 (Resilient) = 13 (got ${conEff2})`);

  const saves = cell(page, 'Saving Throws');
  const conLit = await saves.locator('li', { hasText: 'Constitution' }).locator('.dot.on, .dot.granted').count();
  assert(conLit > 0, 'Con save proficiency granted by Resilient lights up');
}
