import { describe, it, expect } from 'vitest';
import { resolveFeatures, featureGrantedSpells, additionalSpellNames } from './features.js';
import { createCharacter } from './schema.js';
import { emptyCatalog, type Catalog } from '../data/catalog.js';

function fixtureCatalog(): Catalog {
  const c = emptyCatalog('test');
  c.entries.class = [
    {
      name: 'Fighter',
      source: 'PHB',
      classFeatures: [
        'Second Wind|Fighter||1',
        'Action Surge|Fighter||2',
        { classFeature: 'Martial Archetype|Fighter||3', gainSubclassFeature: true }
      ]
    } as never
  ];
  c.classData.classFeature = [
    { name: 'Second Wind', source: 'PHB', className: 'Fighter', level: 1, entries: ['Heal.'] },
    { name: 'Action Surge', source: 'PHB', className: 'Fighter', level: 2, entries: ['Extra action.'] },
    { name: 'Martial Archetype', source: 'PHB', className: 'Fighter', level: 3, entries: ['Pick one.'] },
    { name: 'Indomitable', source: 'PHB', className: 'Fighter', level: 9, entries: ['Reroll a save.'] }
  ] as never;
  c.classData.subclass = [
    {
      name: 'Battle Master',
      source: 'PHB',
      className: 'Fighter',
      shortName: 'Battle Master',
      subclassFeatures: ['Combat Superiority|Fighter||Battle Master||3']
    } as never
  ];
  c.classData.subclassFeature = [
    {
      name: 'Combat Superiority',
      source: 'PHB',
      className: 'Fighter',
      subclassShortName: 'Battle Master',
      level: 3,
      entries: ['Maneuvers.']
    }
  ] as never;
  c.entries.race = [
    { name: 'Elf', source: 'PHB', entries: ['Pointy ears.'], additionalSpells: [{ innate: { 1: ['detect magic'] } }] }
  ] as never;
  c.entries.feat = [
    { name: 'Magic Initiate', source: 'PHB', entries: ['Learn cantrips.'], additionalSpells: [{ known: { _: ['fire bolt'] } }] }
  ] as never;
  return c;
}

const fighter3 = () =>
  createCharacter({
    classes: [{ name: 'Fighter', source: 'PHB', level: 3, subclass: 'Battle Master' }],
    race: { name: 'Elf', source: 'PHB' },
    feats: [{ name: 'Magic Initiate', source: 'PHB' }]
  });

describe('resolveFeatures', () => {
  it('gathers class features up to level, subclass features, race, and feats', () => {
    const features = resolveFeatures(fighter3(), fixtureCatalog());
    const byGroup = (g: string) => features.filter((f) => f.group === g).map((f) => f.name);
    expect(byGroup('Class')).toEqual(['Second Wind', 'Action Surge', 'Martial Archetype']); // not Indomitable (lvl 9)
    expect(byGroup('Subclass')).toEqual(['Combat Superiority']);
    expect(byGroup('Race')).toEqual(['Elf']);
    expect(byGroup('Feat')).toEqual(['Magic Initiate']);
  });
});

describe('additionalSpellNames', () => {
  it('collects innate/known, gated by character level, skipping choose and expanded', () => {
    const block = [
      { innate: { 1: ['detect magic'], 5: ['fly'] }, known: { _: ['light'] }, expanded: { s1: ['shield'] } }
    ];
    expect(additionalSpellNames(block, 3).sort()).toEqual(['detect magic', 'light']); // fly gated out, shield skipped
    expect(additionalSpellNames([{ known: { _: [{ choose: 'level=0|class=Wizard' }] } }], 20)).toEqual([]);
  });
});

describe('featureGrantedSpells', () => {
  it('derives granted spells from race, feats, and subclass', () => {
    const detectMagic = { name: 'Detect Magic', source: 'PHB' };
    const fireBolt = { name: 'Fire Bolt', source: 'PHB' };
    const lookup = {
      getSpellByName: (n: string) =>
        n.toLowerCase() === 'detect magic' ? detectMagic : n.toLowerCase() === 'fire bolt' ? fireBolt : undefined
    };
    const granted = featureGrantedSpells(fighter3(), fixtureCatalog(), lookup);
    expect(granted.map((g) => `${g.name} <- ${g.grantedBy}`).sort()).toEqual([
      'Detect Magic <- Elf',
      'Fire Bolt <- Magic Initiate'
    ]);
  });
});
