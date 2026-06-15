import { describe, it, expect } from 'vitest';
import { attachedSpellNames, grantedSpellsFromItems } from './grantedSpells.js';
import { createCharacter } from './schema.js';
import type { NamedEntry } from '../data/catalog.js';

describe('attachedSpellNames', () => {
  it('collects names from flat arrays and nested usage buckets', () => {
    expect(attachedSpellNames(['fireball', 'enlarge/reduce'])).toEqual(['fireball', 'enlarge/reduce']);
    expect(attachedSpellNames({ daily: { '1': ['fabricate', 'move earth'] } }).sort()).toEqual([
      'fabricate',
      'move earth'
    ]);
  });

  it('strips concentration / source suffixes', () => {
    expect(attachedSpellNames(['friends#c', 'message|phb'])).toEqual(['friends', 'message']);
  });
});

describe('grantedSpellsFromItems', () => {
  const fabricate: NamedEntry = { name: 'Fabricate', source: 'PHB', level: 4 };
  const tome: NamedEntry = {
    name: 'Tome of Making',
    source: 'HB',
    attachedSpells: { daily: { '1': ['fabricate'] } }
  };
  const lookup = {
    getItem: (n: string, s: string) => (n === tome.name && s === tome.source ? tome : undefined),
    getSpellByName: (n: string) => (n.toLowerCase() === 'fabricate' ? fabricate : undefined)
  };

  it('derives granted spells from equipped items, resolved to catalog spells', () => {
    const c = createCharacter({
      inventory: [{ name: 'Tome of Making', source: 'HB', quantity: 1, equipped: true }]
    });
    const granted = grantedSpellsFromItems(c, lookup);
    expect(granted).toEqual([{ name: 'Fabricate', source: 'PHB', grantedBy: 'Tome of Making' }]);
  });

  it('ignores unequipped items', () => {
    const c = createCharacter({
      inventory: [{ name: 'Tome of Making', source: 'HB', quantity: 1, equipped: false }]
    });
    expect(grantedSpellsFromItems(c, lookup)).toEqual([]);
  });
});
