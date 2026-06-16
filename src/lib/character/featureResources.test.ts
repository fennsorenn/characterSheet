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
    {
      name: 'Bard',
      source: 'PHB',
      classFeatures: ['Bardic Inspiration|Bard||1']
    },
    { name: 'Fighter', source: 'PHB' }
  ] as never;
  c.classData.classFeature = [
    {
      name: 'Bardic Inspiration',
      source: 'PHB',
      className: 'Bard',
      level: 1,
      entries: ['You can use it a number of times equal to your Charisma modifier (a minimum of once). You regain any expended uses when you finish a long rest.']
    }
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

describe('stat-scaled feature resources', () => {
  const mod = (a: string) => ({ cha: 3 } as Record<string, number>)[a] ?? 0;

  it('derives a CHA-modifier pool from the feature text (Bardic Inspiration)', () => {
    const c = createCharacter({ classes: [{ name: 'Bard', source: 'PHB', level: 1 }] });
    const res = featureResources(c, catalog(), mod as never, 2);
    const bi = res.find((r) => r.name === 'Bardic Inspiration');
    expect(bi).toMatchObject({ name: 'Bardic Inspiration', max: 3, recharge: 'long', scaledBy: 'cha' });
  });

  it('derives a fixed pool from "Once per day" text (Arcane Recovery)', () => {
    const cat = catalog();
    (cat.entries.class as never[]).push({ name: 'Wizard', source: 'PHB', classFeatures: ['Arcane Recovery|Wizard||1'] } as never);
    (cat.classData.classFeature as never[]).push({
      name: 'Arcane Recovery', source: 'PHB', className: 'Wizard', level: 1,
      entries: ['Once per day when you finish a short rest, you can recover expended spell slots.']
    } as never);
    const c = createCharacter({ classes: [{ name: 'Wizard', source: 'PHB', level: 5 }] });
    const ar = featureResources(c, cat, mod as never, 2).find((r) => r.name === 'Arcane Recovery');
    expect(ar).toMatchObject({ name: 'Arcane Recovery', max: 1, recharge: 'long' }); // "per day" → long rest
    expect(ar?.scaledBy).toBeUndefined();
  });

  it('is at least 1 and omitted without an ability-mod resolver', () => {
    const c = createCharacter({ classes: [{ name: 'Bard', source: 'PHB', level: 1 }] });
    const lowCha = (a: string) => (a === 'cha' ? -1 : 0);
    expect(featureResources(c, catalog(), lowCha as never, 2).find((r) => r.name === 'Bardic Inspiration')?.max).toBe(1);
    // No resolver → only table pools, no stat pools.
    expect(featureResources(c, catalog()).some((r) => r.name === 'Bardic Inspiration')).toBe(false);
  });
});

describe('resetFeatureResources', () => {
  it('a long rest clears everything; a short rest keeps long-recharge pools', () => {
    const used = { 'short|Cleric|Channel Divinity': 2, 'long|Barbarian|Rages': 1 };
    expect(resetFeatureResources(used, 'long')).toEqual({});
    expect(resetFeatureResources(used, 'short')).toEqual({ 'long|Barbarian|Rages': 1 });
  });
});
