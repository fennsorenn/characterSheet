import { describe, it, expect } from 'vitest';
import { facetsFor, filterEntries, facetOptions, itemTypeLabel } from './facets.js';
import type { NamedEntry } from './catalog.js';

const spells: NamedEntry[] = [
  { name: 'Fireball', source: 'PHB', level: 3, school: 'V', damageInflict: ['fire'], savingThrow: ['dexterity'] },
  { name: 'Fire Bolt', source: 'PHB', level: 0, school: 'V', damageInflict: ['fire'], spellAttack: ['R'] },
  { name: 'Cure Wounds', source: 'PHB', level: 1, school: 'A', miscTags: ['HL'] },
  { name: 'Shield', source: 'PHB', level: 1, school: 'A', duration: [{ concentration: false } as never] }
];

const sel = (o: Record<string, string[]>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, new Set(v)]));

describe('spell facets', () => {
  const facets = facetsFor('spell');

  it('filters by a single facet (school)', () => {
    const got = filterEntries(spells, '', facets, sel({ school: ['Evocation'] }));
    expect(got.map((s) => s.name)).toEqual(['Fireball', 'Fire Bolt']);
  });

  it('combines facets with AND, values with OR', () => {
    const got = filterEntries(spells, '', facets, sel({ school: ['Evocation'], level: ['0', '3'] }));
    expect(got.map((s) => s.name).sort()).toEqual(['Fire Bolt', 'Fireball']);
  });

  it('also applies the name query', () => {
    const got = filterEntries(spells, 'bolt', facets, sel({}));
    expect(got.map((s) => s.name)).toEqual(['Fire Bolt']);
  });

  it('computes option counts cross-filtered by other facets', () => {
    // With school=Abjuration selected, the level facet only counts those two.
    const opts = facetOptions(spells, '', facets, sel({ school: ['Abjuration'] }));
    const levels = Object.fromEntries(opts.level.map((o) => [o.label, o.count]));
    expect(levels).toEqual({ '1st': 2 });
    // The school facet itself ignores its own selection (so all schools still show).
    expect(opts.school.find((o) => o.label === 'Evocation')!.count).toBe(2);
  });

  it('derives resolution and property facet values', () => {
    const opts = facetOptions(spells, '', facets, sel({}));
    expect(opts.resolution.map((o) => o.value).sort()).toEqual(['Saving throw', 'Spell attack']);
    expect(opts.props.map((o) => o.value)).toContain('Healing');
  });
});

describe('item facets', () => {
  const items: NamedEntry[] = [
    { name: 'Longsword', source: 'PHB', type: 'M', rarity: 'none' },
    { name: '+1 Plate', source: 'DMG', type: 'HA', rarity: 'rare' },
    { name: 'Ring of Protection', source: 'DMG', type: 'RG', rarity: 'rare', reqAttune: true },
    { name: 'Bag of Holding', source: 'DMG', rarity: 'uncommon', wondrous: true }
  ];
  const facets = facetsFor('item');

  it('labels item types from codes/wondrous', () => {
    expect(itemTypeLabel(items[0])).toBe('Weapon');
    expect(itemTypeLabel(items[1])).toBe('Armor');
    expect(itemTypeLabel(items[3])).toBe('Wondrous');
  });

  it('filters by type, rarity, and attunement', () => {
    expect(filterEntries(items, '', facets, sel({ type: ['Armor'] })).map((i) => i.name)).toEqual(['+1 Plate']);
    expect(filterEntries(items, '', facets, sel({ rarity: ['rare'] })).length).toBe(2);
    expect(
      filterEntries(items, '', facets, sel({ attune: ['Requires attunement'] })).map((i) => i.name)
    ).toEqual(['Ring of Protection']);
  });
});
