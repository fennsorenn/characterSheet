import { describe, it, expect } from 'vitest';
import { spellSlotInfo } from './spellSlots.js';
import { createCharacter } from './schema.js';
import { emptyCatalog, type Catalog } from '../data/catalog.js';

function catalog(): Catalog {
  const c = emptyCatalog('test');
  c.entries.class = [
    { name: 'Wizard', source: 'PHB', casterProgression: 'full' },
    { name: 'Cleric', source: 'PHB', casterProgression: 'full' },
    { name: 'Paladin', source: 'PHB', casterProgression: '1/2' },
    { name: 'Artificer', source: 'PHB', casterProgression: 'artificer' },
    { name: 'Warlock', source: 'PHB', casterProgression: 'pact' },
    { name: 'Fighter', source: 'PHB' }
  ] as never;
  return c;
}
const slots = (c: ReturnType<typeof createCharacter>) => spellSlotInfo(c, catalog());

describe('spellSlotInfo', () => {
  it('full caster uses the standard table', () => {
    expect(slots(createCharacter({ classes: [{ name: 'Wizard', source: 'PHB', level: 5 }] })).slots)
      .toEqual([4, 3, 2, 0, 0, 0, 0, 0, 0]);
  });

  it('single half-caster rounds up and grants nothing at level 1', () => {
    expect(slots(createCharacter({ classes: [{ name: 'Paladin', source: 'PHB', level: 1 }] })).slots)
      .toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(slots(createCharacter({ classes: [{ name: 'Paladin', source: 'PHB', level: 5 }] })).slots)
      .toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0]); // caster level 3
  });

  it('Artificer gets slots at level 1 (rounds up)', () => {
    expect(slots(createCharacter({ classes: [{ name: 'Artificer', source: 'PHB', level: 1 }] })).slots)
      .toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('multiclass sums contributions (full + half rounded down)', () => {
    // Cleric 3 (full → 3) + Paladin 2 (half → 1) = caster level 4 → [4,3]
    const c = createCharacter({
      classes: [
        { name: 'Cleric', source: 'PHB', level: 3 },
        { name: 'Paladin', source: 'PHB', level: 2 }
      ]
    });
    expect(slots(c).slots).toEqual([4, 3, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('tracks Warlock pact slots separately from leveled slots', () => {
    const c = createCharacter({
      classes: [
        { name: 'Cleric', source: 'PHB', level: 5 },
        { name: 'Warlock', source: 'PHB', level: 5 }
      ]
    });
    const info = slots(c);
    expect(info.slots).toEqual([4, 3, 2, 0, 0, 0, 0, 0, 0]); // Cleric 5 only; warlock excluded
    expect(info.pact).toEqual({ count: 2, level: 3 }); // warlock 5 → two 3rd-level pact slots
  });

  it('no slots for a non-caster', () => {
    expect(slots(createCharacter({ classes: [{ name: 'Fighter', source: 'PHB', level: 5 }] })))
      .toEqual({ slots: [0, 0, 0, 0, 0, 0, 0, 0, 0], pact: null });
  });
});
