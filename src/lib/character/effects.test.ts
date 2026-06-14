import { describe, it, expect } from 'vitest';
import { buildGraph } from './buildGraph.js';
import { createCharacter } from './schema.js';
import { exhaustionModifiers } from './effects.js';

describe('buff effects', () => {
  it('applies only active buffs and explains them by name', () => {
    const c = createCharacter({
      abilities: { dex: 10 } as never,
      acBase: 12,
      buffs: [
        {
          id: '1',
          name: 'Shield of Faith',
          active: true,
          concentration: true,
          modifiers: [{ target: 'ac', value: 2 }]
        },
        { id: '2', name: 'Haste', active: false, modifiers: [{ target: 'ac', value: 2 }] }
      ]
    });
    const g = buildGraph(c);
    expect(g.get('ac')).toBe(12 + 2); // only the active buff
    expect(g.explain('ac').modifiers.map((m) => m.source)).toEqual(['Shield of Faith']);
  });
});

describe('exhaustion (2024)', () => {
  it('penalises all d20 tests by -2 per level', () => {
    const c = createCharacter({
      abilities: { dex: 14, con: 14 } as never,
      saveProficiencies: [],
      exhaustion: 2
    });
    const g = buildGraph(c);
    // dex save = +2 normally, -4 from exhaustion (2 levels) => -2
    expect(g.get('save.dex')).toBe(2 - 4);
    expect(g.get('initiative')).toBe(2 - 4);
  });

  it('produces no modifiers at level 0', () => {
    expect(exhaustionModifiers(createCharacter())).toEqual([]);
  });
});
