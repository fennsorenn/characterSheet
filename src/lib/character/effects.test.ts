import { describe, it, expect } from 'vitest';
import { buildGraph } from './buildGraph.js';
import { createCharacter } from './schema.js';
import { exhaustionModifiers } from './effects.js';
import type { CatalogLookup } from './equipment.js';
import type { NamedEntry } from '../data/catalog.js';

/** A lookup backed by a fixed set of catalog items. */
function lookupOf(...items: NamedEntry[]): CatalogLookup {
  const map = new Map(items.map((i) => [`${i.name}|${i.source}`, i]));
  return { getItem: (n, s) => map.get(`${n}|${s}`) };
}

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

  it('penalises saves and skills by -2 per level (level 3 => -6)', () => {
    const c = createCharacter({
      abilities: { dex: 14 } as never,
      saveProficiencies: [],
      skillProficiencies: {},
      exhaustion: 3
    });
    const g = buildGraph(c);
    // dex save = +2 normally, -6 from exhaustion (3 levels) => -4
    expect(g.get('save.dex')).toBe(2 - 6);
    // acrobatics (dex skill) = +2 normally, -6 => -4
    expect(g.get('skill.acrobatics')).toBe(2 - 6);
  });

  it('penalises weapon attack rolls and explains the source', () => {
    const longsword: NamedEntry = {
      name: 'Longsword',
      source: 'PHB',
      type: 'M',
      dmg1: '1d8',
      dmgType: 'S',
      weaponCategory: 'martial'
    };
    const c = createCharacter({
      abilities: { str: 16 } as never,
      classes: [{ name: 'Fighter', source: 'PHB', level: 5 }], // prof +3
      inventory: [{ name: 'Longsword', source: 'PHB', quantity: 1, equipped: true }],
      exhaustion: 3
    });
    const g = buildGraph(c, lookupOf(longsword));
    // str +3 + prof +3 = +6 base, minus 6 from exhaustion 3 => 0
    expect(g.get('attack.w0.hit')).toBe(3 + 3 - 6);
    const ex = g.explain('attack.w0.hit');
    expect(ex.modifiers.map((m) => m.source)).toContain('Exhaustion 3');
    expect(ex.modifiers.find((m) => m.source === 'Exhaustion 3')?.value).toBe(-6);
    // damage is NOT a d20 test, so it stays unpenalised
    expect(g.get('attack.w0.dmg')).toBe(3);
  });

  it('produces no modifiers at level 0', () => {
    expect(exhaustionModifiers(createCharacter())).toEqual([]);
  });
});
