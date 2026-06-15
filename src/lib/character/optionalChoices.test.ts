import { describe, it, expect } from 'vitest';
import {
  countAtLevel,
  featureOptionalProgressions,
  optionalFeaturesOfType
} from './optionalChoices.js';
import { createCharacter } from './schema.js';
import { emptyCatalog, type Catalog } from '../data/catalog.js';

function fixtureCatalog(): Catalog {
  const c = emptyCatalog('test');
  c.entries.class = [
    {
      name: 'Fighter',
      source: 'PHB',
      optionalfeatureProgression: [
        { name: 'Fighting Style', featureType: ['FS:F'], progression: { 1: 1 } }
      ]
    } as never
  ];
  c.classData.subclass = [
    {
      name: 'Battle Master',
      source: 'PHB',
      className: 'Fighter',
      shortName: 'Battle Master',
      optionalfeatureProgression: [
        { name: 'Maneuvers', featureType: ['MV:B'], progression: { 3: 3, 7: 5, 10: 7, 15: 9 } }
      ]
    } as never
  ];
  c.entries.optionalfeature = [
    { name: 'Disarming Attack', source: 'PHB', featureType: ['MV:B'], entries: ['Knock a weapon away.'] },
    { name: 'Trip Attack', source: 'PHB', featureType: ['MV:B'], entries: ['Knock prone.'] },
    { name: 'Defense', source: 'PHB', featureType: ['FS:F'], entries: ['+1 AC.'] },
    { name: 'Agonizing Blast', source: 'PHB', featureType: ['EI'], entries: ['Add cha.'] }
  ] as never;
  return c;
}

describe('countAtLevel', () => {
  it('returns the highest cumulative total at or below the level', () => {
    const prog = { 3: 3, 7: 5, 10: 7, 15: 9 };
    expect(countAtLevel(prog, 2)).toBe(0);
    expect(countAtLevel(prog, 3)).toBe(3);
    expect(countAtLevel(prog, 6)).toBe(3);
    expect(countAtLevel(prog, 7)).toBe(5);
    expect(countAtLevel(prog, 20)).toBe(9);
  });
});

describe('featureOptionalProgressions', () => {
  it('collects class and subclass progressions with level-scaled counts', () => {
    const c = createCharacter({
      classes: [{ name: 'Fighter', source: 'PHB', level: 7, subclass: 'Battle Master', hitDie: 10 }]
    });
    const progs = featureOptionalProgressions(c, fixtureCatalog());
    expect(progs).toEqual([
      {
        key: 'Fighter|PHB|Fighting Style',
        name: 'Fighting Style',
        owner: 'Fighter',
        group: 'Class',
        featureType: ['FS:F'],
        count: 1
      },
      {
        key: 'Battle Master|PHB|Maneuvers',
        name: 'Maneuvers',
        owner: 'Battle Master',
        group: 'Subclass',
        featureType: ['MV:B'],
        count: 5
      }
    ]);
  });

  it('omits progressions whose count is still zero at this level', () => {
    const c = createCharacter({
      classes: [{ name: 'Fighter', source: 'PHB', level: 1, subclass: 'Battle Master', hitDie: 10 }]
    });
    const progs = featureOptionalProgressions(c, fixtureCatalog());
    expect(progs.map((p) => p.name)).toEqual(['Fighting Style']);
  });
});

describe('optionalFeaturesOfType', () => {
  it('filters optional features by featureType', () => {
    const got = optionalFeaturesOfType(fixtureCatalog(), ['MV:B']).map((o) => o.name);
    expect(got).toEqual(['Disarming Attack', 'Trip Attack']);
  });
});
