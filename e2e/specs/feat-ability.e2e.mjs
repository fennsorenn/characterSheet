import { cell, browseAdd, assert } from '../harness.mjs';

// Fixed half-feat ability bonus (Actor +1 Cha) applies automatically. As a
// PERSISTENT build change it shows as a plain number (no green/fleeting badge).
export default async function ({ page }) {
  await browseAdd(page, 'feat', 'Actor');

  const cha = page.locator('.ability', { hasText: 'Cha' }).first();
  const plain = await cha.locator('.persistent').first().innerText();
  assert(plain.trim() === '11', `Actor grants +1 Cha (10 -> ${plain}), shown plain`);
  // No fleeting override badge for a persistent feat bonus.
  assert((await cha.locator('.eff').count()) === 0, 'persistent feat bonus shows no fleeting/green badge');
  // The base score stays the raw 10 underneath.
  assert((await cha.locator('.base input').first().inputValue()) === '10', 'editable base Cha stays 10');
}
