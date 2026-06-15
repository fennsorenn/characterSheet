import { cell, assert } from '../harness.mjs';

async function setCharacter(page, baseUrl, patch) {
  await page.evaluate((p) => {
    const c = JSON.parse(localStorage.getItem('charactersheet.character'));
    Object.assign(c, p, { abilities: { ...c.abilities, ...(p.abilities ?? {}) } });
    localStorage.setItem('charactersheet.character', JSON.stringify(c));
  }, patch);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });
}
const counts = (page) => cell(page, 'Spells').locator('.counts').innerText();

// Spell counters show class-granted denominators, per class for a multiclass.
export default async function ({ page, baseUrl }) {
  // 1) Single prepared caster: Cleric 5, WIS 16 → 4 cantrips, 8 prepared limit.
  await setCharacter(page, baseUrl, {
    classes: [{ name: 'Cleric', source: 'PHB', level: 5, hitDie: 8 }],
    abilities: { wis: 16 },
    spells: [
      { name: 'Guidance', source: 'PHB', status: 'known' },
      { name: 'Sacred Flame', source: 'PHB', status: 'known' },
      { name: 'Bless', source: 'PHB', status: 'prepared' },
      { name: 'Cure Wounds', source: 'PHB', status: 'prepared' }
    ]
  });
  let text = (await counts(page)).replace(/\s+/g, ' ').trim();
  assert(/2\/4 cantrips/.test(text), `Cleric cantrips 2/4; got "${text}"`);
  assert(/2\/8 prep/.test(text), `Cleric prepared 2/8 (level 5 + WIS +3); got "${text}"`);

  // 2) Multiclass Cleric 5 / Bard 4: separate per-class denominators.
  await setCharacter(page, baseUrl, {
    classes: [
      { name: 'Cleric', source: 'PHB', level: 5, hitDie: 8 },
      { name: 'Bard', source: 'PHB', level: 4, hitDie: 8 }
    ],
    abilities: { wis: 16, cha: 16 },
    spells: [
      { name: 'Vicious Mockery', source: 'PHB', status: 'known' },
      { name: 'Bless', source: 'PHB', status: 'prepared' },
      { name: 'Cure Wounds', source: 'PHB', status: 'known' }
    ]
  });
  text = (await counts(page)).replace(/\s+/g, ' ').trim();
  assert(/Cleric/.test(text) && /Bard/.test(text), `per-class breakdown names both classes; got "${text}"`);
  // Cleric prepared limit = 5 + 3 = 8; Bard known limit at L4 follows its table.
  assert(/Cleric .*\/8 prep/.test(text), `Cleric shows /8 prepared; got "${text}"`);
  assert(/Bard .*known/.test(text), `Bard shows a known denominator; got "${text}"`);
}
