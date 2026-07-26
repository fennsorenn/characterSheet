import { assert, seedCharacter } from '../harness.mjs';

// Every editable number must fit its own value. The fields are sized in `ch`,
// which is easy to get wrong by a few pixels — the app is border-box, so a
// declared width would otherwise be eaten by the padding and focus border and
// silently shave a digit off a score, an AC, or a resource maximum.
export default async function ({ page, baseUrl }) {
  await seedCharacter(page, baseUrl, {
    name: 'Bram Ironfell',
    classes: [{ name: 'Fighter', source: 'PHB', level: 12, hitDie: 10 }],
    // Two digits everywhere it matters, three where the field allows them.
    abilities: { str: 18, dex: 14, con: 16, int: 10, wis: 12, cha: 20 },
    acBase: 18,
    hp: { max: 128, current: 104, temp: 12 },
    hitDice: [{ die: 10, max: 12, used: 2 }],
    inventory: [{ name: 'Handaxe', source: 'PHB', quantity: 120, equipped: false }],
    resources: [{ id: 'r1', name: 'Superiority Dice', max: 12, used: 2, recharge: 'short' }],
    spellSlotsAuto: false,
    spellSlots: [4, 3, 3, 3, 1, 1, 1, 1, 0].map((max) => ({ max, expended: 0 }))
  });
  await page.waitForSelector('.cell', { timeout: 20000 });

  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll('input.number-field')]
      // scrollWidth exceeding clientWidth means the text is being cut off. Both
      // are integers rounded from a fractional layout, so a single pixel of
      // disagreement is rounding, not a clipped digit — real clipping here ran
      // to several pixels.
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => `${el.value} (declared ${el.style.width}, needs ${el.scrollWidth}px in ${el.clientWidth}px)`)
  );
  assert(clipped.length === 0, `number fields clip their value: ${JSON.stringify(clipped)}`);

  // The values really are on screen — a field could also "fit" by being empty.
  const shown = await page.evaluate(() =>
    [...document.querySelectorAll('input.number-field')].map((el) => el.value)
  );
  for (const v of ['18', '16', '104', '128', '12']) {
    assert(shown.includes(v), `${v} is rendered somewhere (got ${JSON.stringify(shown)})`);
  }
}
