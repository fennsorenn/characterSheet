import { cell, browseAdd, assert } from '../harness.mjs';

// Fixed half-feat ability bonus (Actor +1 Cha) applies automatically and is
// credited by source in the ability-score explanation.
export default async function ({ page }) {
  await browseAdd(page, 'feat', 'Actor');

  const eff = page.locator('.ability', { hasText: 'Cha' }).first().locator('.eff');
  const chaEff = await eff.locator('.value').innerText();
  assert(chaEff.trim().startsWith('11'), `Actor grants +1 Cha (10 -> ${chaEff})`);

  // The effective-score tooltip credits the source ("Actor → 11 (base 10)").
  const detail = await eff.getAttribute('title');
  assert(/Actor/.test(detail ?? ''), `Actor credited as the source (title: ${detail})`);
}
