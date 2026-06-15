import { describe, it, expect } from 'vitest';
import { buildGraph } from './buildGraph.js';
import { createCharacter } from './schema.js';
import { weaponAttacks, iconForItem, type CatalogLookup } from './equipment.js';
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

const longsword: NamedEntry = {
  name: 'Longsword',
  source: 'PHB',
  type: 'M',
  dmg1: '1d8',
  dmg2: '1d10',
  dmgType: 'S',
  weaponCategory: 'martial',
  property: ['V']
};
const rapier: NamedEntry = { name: 'Rapier', source: 'PHB', type: 'M', dmg1: '1d8', dmgType: 'P', property: ['F'] };
const longbow: NamedEntry = { name: 'Longbow', source: 'PHB', type: 'R', dmg1: '1d8', dmgType: 'P', property: ['A'] };
const sword1: NamedEntry = { name: '+1 Longsword', source: 'DMG', type: 'M', dmg1: '1d8', dmgType: 'S', bonusWeapon: '+1' };

describe('weapon attacks', () => {
  it('uses Strength for melee and computes to-hit / damage nodes', () => {
    const c = createCharacter({
      abilities: { str: 16 } as never,
      saveProficiencies: [],
      classes: [{ name: 'Fighter', source: 'PHB', level: 5 }], // prof +3
      inventory: [equip(longsword)]
    });
    const g = buildGraph(c, lookupOf(longsword));
    expect(g.get('attack.w0.hit')).toBe(3 + 3); // str +3 + prof +3
    expect(g.get('attack.w0.dmg')).toBe(3); // str mod
    const atk = weaponAttacks(c, lookupOf(longsword))[0];
    expect(atk.ability).toBe('str');
    expect(atk.damageDice).toBe('1d8');
    expect(atk.versatileDice).toBe('1d10');
  });

  it('uses Dexterity for ranged and the better mod for finesse', () => {
    const c = createCharacter({ abilities: { str: 10, dex: 18 } as never });
    expect(weaponAttacks({ ...c, inventory: [equip(longbow)] }, lookupOf(longbow))[0].ability).toBe('dex');
    expect(weaponAttacks({ ...c, inventory: [equip(rapier)] }, lookupOf(rapier))[0].ability).toBe('dex');
  });

  it('adds a magic weapon bonus to both attack and damage', () => {
    const c = createCharacter({ abilities: { str: 14 } as never, inventory: [equip(sword1)] });
    const g = buildGraph(c, lookupOf(sword1));
    expect(g.get('attack.w0.hit')).toBe(2 + 2 + 1); // str + prof(lvl1) + magic
    expect(g.get('attack.w0.dmg')).toBe(2 + 1);
  });

  it('drops proficiency when the character is not proficient', () => {
    const c = createCharacter({
      abilities: { str: 14 } as never,
      inventory: [{ ...equip(longsword), proficient: false }]
    });
    expect(buildGraph(c, lookupOf(longsword)).get('attack.w0.hit')).toBe(2); // str only
  });
});

describe('attunement gating', () => {
  const ring: NamedEntry = { name: 'Ring of Protection', source: 'DMG', type: 'RG', reqAttune: true, bonusAc: '+1' };

  it('withholds magic bonuses until attuned', () => {
    const unattuned = createCharacter({ abilities: { dex: 10 } as never, inventory: [equip(ring)] });
    expect(buildGraph(unattuned, lookupOf(ring)).get('ac')).toBe(10); // no bonus

    const attuned = createCharacter({
      abilities: { dex: 10 } as never,
      inventory: [{ ...equip(ring), attuned: true }]
    });
    expect(buildGraph(attuned, lookupOf(ring)).get('ac')).toBe(11);
  });
});

describe('ability-setting items', () => {
  const belt: NamedEntry = {
    name: 'Belt of Hill Giant Strength',
    source: 'DMG',
    reqAttune: true,
    ability: { static: { str: 21 } }
  };

  it('resolves wondrous items to their equipment slot by name', () => {
    expect(iconForItem({ name: 'Belt of Hill Giant Strength' })).toBe('waist');
    expect(iconForItem({ name: 'Headband of Intellect' })).toBe('head');
    expect(iconForItem({ name: 'Amulet of Health' })).toBe('neck');
    expect(iconForItem({ name: 'Gauntlets of Ogre Power' })).toBe('hands');
    expect(iconForItem({ name: 'Winged Boots' })).toBe('feet');
    expect(iconForItem({ name: 'Ring of Protection', type: 'RG' })).toBe('ring');
    expect(iconForItem({ name: 'Cloak of Protection' })).toBe('shoulders');
  });

  it('falls back to gear (not magic) for unrecognised items', () => {
    expect(iconForItem({ name: 'Mystery Trinket' })).toBe('gear');
    expect(iconForItem({ name: 'Bag of Holding', type: 'G' })).toBe('gear');
  });

  it('icons weapons by type, subtype, and damage type', () => {
    expect(iconForItem({ name: 'Longsword', type: 'M', dmgType: 'S' })).toBe('sword');
    expect(iconForItem({ name: 'Battleaxe', type: 'M', dmgType: 'S' })).toBe('axe');
    expect(iconForItem({ name: 'Warhammer', type: 'M', dmgType: 'B' })).toBe('mace');
    expect(iconForItem({ name: 'Sickle', type: 'M', dmgType: 'S' })).toBe('sickle');
    expect(iconForItem({ name: 'Dagger', type: 'M', dmgType: 'P' })).toBe('dagger');
    expect(iconForItem({ name: 'Spear', type: 'M', dmgType: 'P' })).toBe('spear');
    // Unknown melee falls back to its damage type.
    expect(iconForItem({ name: 'Weird Bludgeon', type: 'M', dmgType: 'B' })).toBe('mace');
  });

  it('icons ranged weapons and ammunition', () => {
    expect(iconForItem({ name: 'Longbow', type: 'R' })).toBe('bow');
    expect(iconForItem({ name: 'Heavy Crossbow', type: 'R' })).toBe('bow');
    expect(iconForItem({ name: 'Sling', type: 'R' })).toBe('sling');
    expect(iconForItem({ name: 'Arrows (20)', type: 'A' })).toBe('arrow');
  });

  it('icons common item types', () => {
    expect(iconForItem({ name: 'Plate Armor', type: 'HA' })).toBe('body');
    expect(iconForItem({ name: 'Shield', type: 'S' })).toBe('shield');
    expect(iconForItem({ name: 'Potion of Healing', type: 'P' })).toBe('potion');
    expect(iconForItem({ name: 'Spell Scroll', type: 'SC' })).toBe('scroll');
    expect(iconForItem({ name: 'Wand of Magic Missiles', type: 'WD' })).toBe('wand');
    expect(iconForItem({ name: 'Staff of Power', type: 'ST' })).toBe('staff');
    expect(iconForItem({ name: "Thieves' Tools", type: 'AT' })).toBe('tools');
    expect(iconForItem({ name: 'Lute', type: 'INS' })).toBe('instrument');
    expect(iconForItem({ name: 'Poison, Basic', type: 'G' })).toBe('poison');
  });

  it('sets the ability score when attuned, only if higher', () => {
    const c = createCharacter({
      abilities: { str: 12 } as never,
      inventory: [{ ...equip(belt), attuned: true }]
    });
    expect(buildGraph(c, lookupOf(belt)).get('ability.str.mod')).toBe(5); // str 21 → +5

    const strong = createCharacter({
      abilities: { str: 24 } as never,
      inventory: [{ ...equip(belt), attuned: true }]
    });
    expect(buildGraph(strong, lookupOf(belt)).get('ability.str.mod')).toBe(7); // keeps 24
  });
});
