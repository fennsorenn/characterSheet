import { describe, it, expect } from 'vitest';
import { spellClassesFromLookup, annotateSpellClasses } from './spellSources.js';
import type { NamedEntry } from './catalog.js';

// Mirrors the real gendata-spell-source-lookup.json shape for Fireball.
const fireballEntry = {
  class: { PHB: { Sorcerer: true, Wizard: true } },
  subclass: {
    TCE: { Artificer: { TCE: { Artillerist: { name: 'Artillerist' } } } },
    XPHB: {
      Bard: { XPHB: { Lore: { name: 'College of Lore' } } },
      Fighter: { XPHB: { 'Eldritch Knight': { name: 'Eldritch Knight' } } }
    }
  }
};

describe('spellClassesFromLookup', () => {
  it('flattens base classes and subclass display names', () => {
    const { classes, subclasses } = spellClassesFromLookup(fireballEntry);
    expect(classes).toEqual(['Sorcerer', 'Wizard']);
    expect(subclasses).toEqual(['Artillerist', 'College of Lore', 'Eldritch Knight']);
  });

  it('handles a missing entry', () => {
    expect(spellClassesFromLookup(undefined)).toEqual({ classes: [], subclasses: [] });
  });
});

describe('annotateSpellClasses', () => {
  it('annotates spells from the lookup, keyed by source+name (case-insensitive)', () => {
    const spells: NamedEntry[] = [
      { name: 'Fireball', source: 'PHB' },
      { name: 'Unknown Spell', source: 'PHB' }
    ];
    annotateSpellClasses(spells, { phb: { fireball: fireballEntry } });
    expect(spells[0]._classes).toEqual(['Sorcerer', 'Wizard']);
    expect(spells[0]._subclasses).toContain('Eldritch Knight');
    expect(spells[1]._classes).toEqual([]); // not in lookup
  });
});
