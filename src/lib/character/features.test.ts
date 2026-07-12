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

  it('resolves a class feature to the right edition when two share a name', () => {
    // PHB and XPHB Cleric both define "Divine Intervention" at level 10 with
    // different content; the ref carries the source in segment 3 (empty = inherit).
    const c = emptyCatalog('test');
    c.entries.class = [
      { name: 'Cleric', source: 'PHB', classFeatures: ['Divine Intervention|Cleric||10'] },
      { name: 'Cleric', source: 'XPHB', classFeatures: ['Divine Intervention|Cleric|XPHB|10'] }
    ] as never;
    c.classData.classFeature = [
      { name: 'Divine Intervention', source: 'PHB', className: 'Cleric', classSource: 'PHB', level: 10, entries: ['2014 version.'] },
      { name: 'Divine Intervention', source: 'XPHB', className: 'Cleric', classSource: 'XPHB', level: 10, entries: ['2024 version.'] }
    ] as never;
    const phb = resolveFeatures(createCharacter({ classes: [{ name: 'Cleric', source: 'PHB', level: 10 }] }), c)
      .find((f) => f.name === 'Divine Intervention');
    const xphb = resolveFeatures(createCharacter({ classes: [{ name: 'Cleric', source: 'XPHB', level: 10 }] }), c)
      .find((f) => f.name === 'Divine Intervention');
    expect(phb?.entries).toEqual(['2014 version.']);
    expect(xphb?.entries).toEqual(['2024 version.']);
  });

  it('includes header-nested subclass features not in the explicit ref list', () => {
    // A Cleric domain whose level-1 abilities (Domain Spells, bonus feature) are
    // separate subclassFeature entries linked by shortName+source, NOT listed in
    // `subclassFeatures` — as real 5etools domains store them.
    const c = emptyCatalog('test');
    c.entries.class = [{ name: 'Cleric', source: 'PHB', classFeatures: [] } as never];
    c.classData.subclass = [
      {
        name: 'Fate Domain',
        source: 'UAWonders',
        className: 'Cleric',
        classSource: 'PHB',
        shortName: 'Fate',
        subclassFeatures: ['Fate Domain|Cleric||Fate|UAWonders|1']
      } as never
    ];
    c.classData.subclassFeature = [
      { name: 'Fate Domain', source: 'UAWonders', className: 'Cleric', subclassShortName: 'Fate', subclassSource: 'UAWonders', level: 1, entries: ['Flavor.'] },
      { name: 'Domain Spells', source: 'UAWonders', className: 'Cleric', subclassShortName: 'Fate', subclassSource: 'UAWonders', level: 1, header: 1, entries: ['Spells.'] },
      { name: 'Omens and Portents', source: 'UAWonders', className: 'Cleric', subclassShortName: 'Fate', subclassSource: 'UAWonders', level: 1, header: 1, entries: ['Omens.'] }
    ] as never;
    const char = createCharacter({ classes: [{ name: 'Cleric', source: 'PHB', level: 1, subclass: 'Fate' }] });
    const names = resolveFeatures(char, c).filter((f) => f.group === 'Subclass').map((f) => f.name);
    expect(names).toEqual(['Fate Domain', 'Domain Spells', 'Omens and Portents']);
  });

  it('marks isClassFeatureVariant features as optional variants, off by default', () => {
    const c = emptyCatalog('test');
    c.entries.class = [{ name: 'Cleric', source: 'PHB', classFeatures: [] } as never];
    c.classData.subclass = [
      { name: 'Life Domain', source: 'PHB', className: 'Cleric', shortName: 'Life', subclassFeatures: ['Divine Strike|Cleric||Life||8', 'Blessed Strikes|Cleric||Life|UACFV|8'] } as never
    ];
    c.classData.subclassFeature = [
      { name: 'Divine Strike', source: 'PHB', className: 'Cleric', subclassShortName: 'Life', subclassSource: 'PHB', level: 8, entries: ['Strike.'] },
      { name: 'Blessed Strikes', source: 'UACFV', className: 'Cleric', subclassShortName: 'Life', subclassSource: 'PHB', level: 8, isClassFeatureVariant: true, entries: ['Variant.'] }
    ] as never;
    const off = createCharacter({ classes: [{ name: 'Cleric', source: 'PHB', level: 8, subclass: 'Life' }] });
    const bs = resolveFeatures(off, c).find((f) => f.name === 'Blessed Strikes')!;
    expect(bs.isVariant).toBe(true);
    expect(bs.variantEnabled).toBe(false);
    // Enabling it via variantChoices flips it on.
    const on = createCharacter({
      classes: [{ name: 'Cleric', source: 'PHB', level: 8, subclass: 'Life' }],
      variantChoices: { [bs.variantKey!]: true }
    });
    expect(resolveFeatures(on, c).find((f) => f.name === 'Blessed Strikes')!.variantEnabled).toBe(true);
    // Non-variant features are never marked.
    expect(resolveFeatures(off, c).find((f) => f.name === 'Divine Strike')!.isVariant).toBeUndefined();
  });

  it('resolves a 2014-source subclass under a 2024-source class (cross-edition)', () => {
    const c = emptyCatalog('test');
    c.entries.class = [{ name: 'Cleric', source: 'XPHB', classFeatures: [] } as never]; // 2024 class
    c.classData.subclass = [
      { name: 'Fate Domain', source: 'UAWonders', className: 'Cleric', classSource: 'PHB', shortName: 'Fate', subclassFeatures: ['Fate Domain|Cleric||Fate|UAWonders|1'] } as never
    ];
    c.classData.subclassFeature = [
      { name: 'Fate Domain', source: 'UAWonders', className: 'Cleric', subclassShortName: 'Fate', subclassSource: 'UAWonders', level: 1, entries: ['x'] }
    ] as never;
    const char = createCharacter({ classes: [{ name: 'Cleric', source: 'XPHB', level: 1, subclass: 'Fate' }] });
    const names = resolveFeatures(char, c).filter((f) => f.group === 'Subclass').map((f) => f.name);
    expect(names).toEqual(['Fate Domain']);
  });
});

describe('ASI-or-feat slot cascade', () => {
  it('resolves a feat taken in an ASI slot as a Feat feature and grants its spells', () => {
    const c = createCharacter({
      classes: [{ name: 'Fighter', source: 'PHB', level: 4 }],
      featChoices: { 'Ability Score Improvement|PHB|Fighter 4': { name: 'Magic Initiate', source: 'PHB' } }
    });
    const fireBolt = { name: 'Fire Bolt', source: 'PHB' };
    const lookup = { getSpellByName: (n: string) => (n.toLowerCase() === 'fire bolt' ? fireBolt : undefined) };

    const features = resolveFeatures(c, fixtureCatalog());
    expect(features.filter((f) => f.group === 'Feat').map((f) => f.name)).toEqual(['Magic Initiate']);
    expect(featureGrantedSpells(c, fixtureCatalog(), lookup).map((g) => g.name)).toEqual(['Fire Bolt']);
  });

  it('does not double-list a feat held both explicitly and in a slot', () => {
    const c = createCharacter({
      classes: [{ name: 'Fighter', source: 'PHB', level: 4 }],
      feats: [{ name: 'Magic Initiate', source: 'PHB' }],
      featChoices: { 'Ability Score Improvement|PHB|Fighter 4': { name: 'Magic Initiate', source: 'PHB' } }
    });
    const features = resolveFeatures(c, fixtureCatalog());
    expect(features.filter((f) => f.group === 'Feat')).toHaveLength(1);
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
