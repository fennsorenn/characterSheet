import { describe, it, expect } from 'vitest';
import { buildGraph } from './buildGraph.js';
import { createCharacter } from './schema.js';
import type { CatalogLookup } from './equipment.js';
import type { NamedEntry } from '../data/catalog.js';

/** A lookup backed by a fixed set of catalog items. */
function lookupOf(...items: NamedEntry[]): CatalogLookup {
  const map = new Map(items.map((i) => [`${i.name}|${i.source}`, i]));
  return { getItem: (n, s) => map.get(`${n}|${s}`) };
}

const leather: NamedEntry = { name: 'Leather Armor', source: 'PHB', type: 'LA', ac: 11 };
const chainShirt: NamedEntry = { name: 'Chain Shirt', source: 'PHB', type: 'MA', ac: 13 };
const plate: NamedEntry = { name: 'Plate', source: 'PHB', type: 'HA', ac: 18 };
const shield: NamedEntry = { name: 'Shield', source: 'PHB', type: 'S', ac: 2 };
const ringProt: NamedEntry = {
  name: 'Ring of Protection',
  source: 'DMG',
  type: 'RG',
  bonusAc: '+1',
  bonusSavingThrow: '+1'
};
const plate1: NamedEntry = { name: '+1 Plate', source: 'DMG', type: 'HA', ac: 18, bonusAc: '+1' };

function equip(item: NamedEntry) {
  return { name: item.name, source: item.source, quantity: 1, equipped: true };
}

describe('equipment effects on AC', () => {
  it('light armor adds full dex', () => {
    const c = createCharacter({ abilities: { dex: 16 } as never, inventory: [equip(leather)] });
    expect(buildGraph(c, lookupOf(leather)).get('ac')).toBe(11 + 3);
  });

  it('medium armor caps dex at +2', () => {
    const c = createCharacter({ abilities: { dex: 18 } as never, inventory: [equip(chainShirt)] });
    expect(buildGraph(c, lookupOf(chainShirt)).get('ac')).toBe(13 + 2); // dex +4 capped to +2
  });

  it('heavy armor ignores dex entirely', () => {
    const c = createCharacter({ abilities: { dex: 16 } as never, inventory: [equip(plate)] });
    expect(buildGraph(c, lookupOf(plate)).get('ac')).toBe(18);
  });

  it('stacks a shield on top of armor', () => {
    const c = createCharacter({
      abilities: { dex: 12 } as never,
      inventory: [equip(leather), equip(shield)]
    });
    expect(buildGraph(c, lookupOf(leather, shield)).get('ac')).toBe(11 + 1 + 2);
  });

  it('applies magic armor bonuses and explains the source', () => {
    const c = createCharacter({ abilities: { dex: 10 } as never, inventory: [equip(plate1)] });
    const g = buildGraph(c, lookupOf(plate1));
    expect(g.get('ac')).toBe(18 + 1);
    const ex = g.explain('ac');
    expect(ex.modifiers.map((m) => m.source)).toContain('+1 Plate');
  });

  it('only counts equipped items', () => {
    const c = createCharacter({
      abilities: { dex: 10 } as never,
      inventory: [{ ...equip(plate), equipped: false }]
    });
    expect(buildGraph(c, lookupOf(plate)).get('ac')).toBe(10); // unarmored base
  });
});

describe('equipment effects on saves', () => {
  it('Ring of Protection adds +1 to AC and every save', () => {
    const c = createCharacter({
      abilities: { dex: 14, con: 12 } as never,
      saveProficiencies: [],
      inventory: [equip(ringProt)]
    });
    const g = buildGraph(c, lookupOf(ringProt));
    expect(g.get('ac')).toBe(10 + 2 + 1);
    expect(g.get('save.con')).toBe(1 + 1); // con mod + ring
    expect(g.get('save.dex')).toBe(2 + 1);
  });
});

describe('buildGraph without a lookup', () => {
  it('ignores item effects gracefully', () => {
    const c = createCharacter({ abilities: { dex: 16 } as never, inventory: [equip(plate)] });
    // No lookup → items contribute nothing; falls back to unarmored base + dex.
    expect(buildGraph(c).get('ac')).toBe(10 + 3);
  });
});
