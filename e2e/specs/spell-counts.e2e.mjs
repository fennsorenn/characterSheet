import { cell, assert } from '../harness.mjs';

// Spell counters show class-granted denominators: cantrips known / limit,
// prepared / limit (level + ability mod), and "book" without a denominator for
// a prepared caster like the Cleric.
export default async function ({ page, baseUrl }) {
  // Set up a Cleric 5 with WIS 16 and a handful of spells.
  await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('charactersheet.character'));
    c.classes = [{ name: 'Cleric', source: 'PHB', level: 5, hitDie: 8 }];
    c.abilities.wis = 16;
    c.spellcasting = { ability: 'wis' };
    c.spells = [
      { name: 'Guidance', source: 'PHB', status: 'known' },
      { name: 'Sacred Flame', source: 'PHB', status: 'known' },
      { name: 'Bless', source: 'PHB', status: 'prepared' },
      { name: 'Cure Wounds', source: 'PHB', status: 'prepared' },
      { name: 'Healing Word', source: 'PHB', status: 'known' }
    ];
    localStorage.setItem('charactersheet.character', JSON.stringify(c));
  });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });

  const counts = (await cell(page, 'Spells').locator('.counts').innerText()).replace(/\s+/g, ' ').trim();
  assert(/2\/4 cantrips/.test(counts), `cantrips denominator 2/4 (Cleric L5); got "${counts}"`);
  assert(/2\/8 prep/.test(counts), `prepared denominator 2/8 (level 5 + WIS +3); got "${counts}"`);
  assert(/3 book/.test(counts), `prepared caster shows book without a denominator; got "${counts}"`);
}
