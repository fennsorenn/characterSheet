import { cell, assert } from '../harness.mjs';

// Auto-computed spell slots (multiclass table + separate Warlock pact) and
// weapon-proficiency presets derived from the character's proficiencies.
export default async function ({ page, baseUrl }) {
  await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('cs.char.test') || '{}');
    c.classes = [
      { name: 'Cleric', source: 'PHB', level: 5, hitDie: 8 },
      { name: 'Warlock', source: 'PHB', level: 3, hitDie: 8 }
    ];
    c.inventory = [
      { name: 'Longsword', source: 'PHB', quantity: 1, equipped: true }, // martial
      { name: 'Mace', source: 'PHB', quantity: 1, equipped: true } // simple
    ];
    localStorage.setItem('cs.char.test', JSON.stringify(c));
  });
  await page.goto(baseUrl + '/local/test', { waitUntil: 'networkidle' });
  await page.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });

  // Spell slots: Cleric 5 → levels 1-3, plus a separate Warlock pact row.
  const slots = cell(page, 'Spell Slots');
  const rows = await slots.locator('ul li .lvl').allInnerTexts();
  const flat = rows.map((r) => r.replace(/\s+/g, ' ').trim());
  assert(flat.includes('Level 1') && flat.includes('Level 3'), `leveled slots present; got ${JSON.stringify(flat)}`);
  assert(!flat.includes('Level 4'), `Cleric 5 has no 4th-level slots; got ${JSON.stringify(flat)}`);
  assert(flat.some((r) => /^Pact/.test(r)), `Warlock pact row present; got ${JSON.stringify(flat)}`);

  // Weapon proficiency: Cleric is proficient with simple (Mace) not martial (Longsword).
  const attacks = cell(page, 'Attacks');
  const longProf = await attacks.locator('li', { hasText: 'Longsword' }).locator('.prof.on').count();
  const maceProf = await attacks.locator('li', { hasText: 'Mace' }).locator('.prof.on').count();
  assert(longProf === 0, 'Longsword (martial) is not proficient for a Cleric');
  assert(maceProf === 1, 'Mace (simple) is proficient for a Cleric');
}
