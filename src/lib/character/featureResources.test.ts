import { describe, it, expect } from 'vitest';
import { featureResources, resetFeatureResources } from './featureResources.js';
import { createCharacter } from './schema.js';
import { emptyCatalog, type Catalog } from '../data/catalog.js';

function catalog(): Catalog {
  const c = emptyCatalog('test');
  c.entries.class = [
    {
      name: 'Cleric',
      source: 'PHB',
      classTableGroups: [
        { colLabels: ['Channel Divinity', 'Cantrips', '{@filter Prepared|spells}'], rows: Array.from({ length: 20 }, (_, i) => [i + 1 >= 6 ? 3 : 2, 3, 5]) }
      ]
    },
    {
      name: 'Barbarian',
      source: 'PHB',
      classTableGroups: [
        { colLabels: ['Rages', 'Rage Damage'], rows: Array.from({ length: 20 }, (_, i) => [i + 1 >= 6 ? 4 : 2, { type: 'bonus', value: 2 }]) }
      ]
    },
    { name: 'Fighter', source: 'PHB' }
  ] as never;
  c.classData.subclass = [
    {
      name: 'Battle Master',
      source: 'PHB',
      className: 'Fighter',
      shortName: 'Battle Master',
      classTableGroups: [{ colLabels: ['Superiority Dice'], rows: Array.from({ length: 20 }, () => [4]) }]
    }
  ] as never;
  return c;
}

describe('featureResources', () => {
  it('reads expendable pools from the class table at the character level', () => {
    const c = createCharacter({ classes: [{ name: 'Cleric', source: 'PHB', level: 6 }] });
    expect(featureResources(c, catalog())).toEqual([
      { key: 'short|Cleric|Channel Divinity', name: 'Channel Divinity', owner: 'Cleric', max: 3, recharge: 'short' }
    ]);
  });

  it('ignores non-pool columns (spells, dice scalers, bonuses)', () => {
    const c = createCharacter({ classes: [{ name: 'Barbarian', source: 'PHB', level: 2 }] });
    const res = featureResources(c, catalog());
    expect(res.map((r) => r.name)).toEqual(['Rages']); // not "Rage Damage"
    expect(res[0]).toMatchObject({ max: 2, recharge: 'long' });
  });

  it('includes subclass pools (Battle Master Superiority Dice)', () => {
    const c = createCharacter({ classes: [{ name: 'Fighter', source: 'PHB', level: 5, subclass: 'Battle Master' }] });
    expect(featureResources(c, catalog())).toEqual([
      { key: 'short|Battle Master|Superiority Dice', name: 'Superiority Dice', owner: 'Battle Master', max: 4, recharge: 'short' }
    ]);
  });

  it('multiclass collects each class’s pools', () => {
    const c = createCharacter({
      classes: [
        { name: 'Cleric', source: 'PHB', level: 6 },
        { name: 'Barbarian', source: 'PHB', level: 6 }
      ]
    });
    expect(featureResources(c, catalog()).map((r) => `${r.owner}:${r.name}:${r.max}`)).toEqual([
      'Cleric:Channel Divinity:3',
      'Barbarian:Rages:4'
    ]);
  });
});

describe('resetFeatureResources', () => {
  it('a long rest clears everything; a short rest keeps long-recharge pools', () => {
    const used = { 'short|Cleric|Channel Divinity': 2, 'long|Barbarian|Rages': 1 };
    expect(resetFeatureResources(used, 'long')).toEqual({});
    expect(resetFeatureResources(used, 'short')).toEqual({ 'long|Barbarian|Rages': 1 });
  });
});
