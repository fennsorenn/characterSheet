import { describe, it, expect } from 'vitest';
import { flattenRaces, mergeSubrace, subraceDisplayName } from './mergeRace.js';
import type { NamedEntry } from './catalog.js';

describe('subraceDisplayName', () => {
  it('composes "RaceName (Subrace)" for a named subrace', () => {
    expect(subraceDisplayName('Human', 'Variant')).toBe('Human (Variant)');
    expect(subraceDisplayName('Aasimar', 'Protector')).toBe('Aasimar (Protector)');
  });

  it('is just the race name for a nameless subrace', () => {
    expect(subraceDisplayName('Human', undefined)).toBe('Human');
    expect(subraceDisplayName('Human', '')).toBe('Human');
    expect(subraceDisplayName('Human', null)).toBe('Human');
  });
});

describe('mergeSubrace', () => {
  const elf: NamedEntry = { name: 'Elf', source: 'PHB', ability: [{ dex: 2 }], speed: 30, size: ['M'] };

  it('concatenates ability blocks from base and subrace', () => {
    const merged = mergeSubrace(elf, { name: 'High', source: 'PHB', raceName: 'Elf', ability: [{ int: 1 }] });
    expect(merged.name).toBe('Elf (High)');
    expect(merged.ability).toEqual([{ dex: 2 }, { int: 1 }]);
  });

  it('concatenates additive list props (proficiencies)', () => {
    const base: NamedEntry = { name: 'Dwarf', source: 'PHB', skillProficiencies: [{ history: true }] };
    const merged = mergeSubrace(base, {
      name: 'Hill', source: 'PHB', raceName: 'Dwarf', skillProficiencies: [{ insight: true }]
    });
    expect(merged.skillProficiencies).toEqual([{ history: true }, { insight: true }]);
  });

  it('lets a scalar subrace prop override the base, else inherits', () => {
    const merged = mergeSubrace(elf, { name: 'Wood', source: 'PHB', raceName: 'Elf', speed: 35 });
    expect(merged.speed).toBe(35); // overridden
    expect(merged.size).toEqual(['M']); // inherited from base
  });

  it('carries source from the subrace', () => {
    const merged = mergeSubrace(elf, { name: 'Sea', source: 'MPMM', raceName: 'Elf' });
    expect(merged.source).toBe('MPMM');
  });

  it('handles a missing base race gracefully', () => {
    const merged = mergeSubrace(undefined, { name: 'Orphan', source: 'X', raceName: 'Lost', ability: [{ str: 1 }] });
    expect(merged.name).toBe('Lost (Orphan)');
    expect(merged.ability).toEqual([{ str: 1 }]);
  });
});

describe('flattenRaces', () => {
  // The real Human case: a base with no ability, a nameless "standard" subrace
  // carrying +1-all, and a named "Variant" subrace.
  const races: NamedEntry[] = [{ name: 'Human', source: 'PHB', entries: ['Human traits.'] }];
  const subraces: Record<string, unknown>[] = [
    { source: 'PHB', raceName: 'Human', raceSource: 'PHB', ability: [{ str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }] },
    { name: 'Variant', source: 'PHB', raceName: 'Human', raceSource: 'PHB', ability: [{ choose: { from: ['str', 'dex'], count: 2 } }], feats: ['{@feat any}'] }
  ];

  it('produces standard "Human" and "Human (Variant)" as complete entries', () => {
    const out = flattenRaces(races, subraces);
    const names = out.map((r) => r.name).sort();
    expect(names).toEqual(['Human', 'Human (Variant)']);
  });

  it('merges base traits into standard Human and carries its +1-all', () => {
    const out = flattenRaces(races, subraces);
    const human = out.find((r) => r.name === 'Human')!;
    expect(human.entries).toEqual(['Human traits.']); // base traits present
    expect(human.ability).toEqual([{ str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }]);
  });

  it('does not emit a bare "Human" base entry alongside the merged ones', () => {
    const out = flattenRaces(races, subraces);
    // Exactly two entries: no duplicate/uncustomised base Human leaking through.
    expect(out).toHaveLength(2);
  });

  it('passes base races that have no subrace through unchanged', () => {
    const out = flattenRaces([{ name: 'Goliath', source: 'PHB', ability: [{ str: 2 }] }], []);
    expect(out).toEqual([{ name: 'Goliath', source: 'PHB', ability: [{ str: 2 }] }]);
  });
});
