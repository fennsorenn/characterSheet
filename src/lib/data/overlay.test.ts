import { describe, it, expect } from 'vitest';
import { parseOverlay, parseOverlayEntries, isEmptyOverlay } from './overlay.js';

/** A minimal UA-shaped document: a subclass with its feature, plus a spell and feat. */
const UA_DOC = {
  _meta: { sources: [{ json: 'XUA2025Psion', full: 'Unearthed Arcana 2025: The Psion' }] },
  subclass: [
    {
      name: 'Psi Warrior',
      shortName: 'Psi Warrior',
      source: 'XUA2025Psion',
      className: 'Fighter',
      classSource: 'PHB',
      subclassFeatures: ['Psi Warrior|Fighter||XUA2025Psion|3']
    }
  ],
  subclassFeature: [
    {
      name: 'Psionic Power',
      source: 'XUA2025Psion',
      className: 'Fighter',
      subclassShortName: 'Psi Warrior',
      level: 3,
      entries: ['You harbour a wellspring of psionic energy.']
    }
  ],
  spell: [{ name: 'Mind Sliver', source: 'XUA2025Psion', level: 0, school: 'E' }],
  feat: [{ name: 'Telepath', source: 'XUA2025Psion' }]
};

describe('parseOverlayEntries', () => {
  it('maps subclass content into classData', () => {
    const { classData } = parseOverlayEntries(UA_DOC);
    expect(classData.subclass.map((s) => s.name)).toEqual(['Psi Warrior']);
    expect(classData.subclassFeature.map((f) => f.name)).toEqual(['Psionic Power']);
  });

  it('maps spells and feats into their categories', () => {
    const { entries } = parseOverlayEntries(UA_DOC);
    expect(entries.spell.map((s) => s.name)).toEqual(['Mind Sliver']);
    expect(entries.feat.map((f) => f.name)).toEqual(['Telepath']);
  });

  it('combines race and subrace into the race category', () => {
    const { entries } = parseOverlayEntries({
      race: [{ name: 'Hexling', source: 'X' }],
      subrace: [{ name: 'Fiendish', source: 'X', raceName: 'Hexling' }]
    });
    expect(entries.race.map((r) => r.name).sort()).toEqual(['Fiendish', 'Hexling']);
  });

  it('combines the condition/disease/status family', () => {
    const { entries } = parseOverlayEntries({
      condition: [{ name: 'Dazed', source: 'X' }],
      disease: [{ name: 'Cackle Fever', source: 'X' }],
      status: [{ name: 'Concentrating', source: 'X' }]
    });
    expect(entries.condition.map((c) => c.name).sort()).toEqual([
      'Cackle Fever',
      'Concentrating',
      'Dazed'
    ]);
  });

  it('expands magic-item variants against overlay base items', () => {
    const { entries } = parseOverlayEntries({
      baseitem: [{ name: 'Longsword', source: 'X', weapon: true, dmg1: '1d8' }],
      magicvariant: [
        {
          name: '+1 Weapon',
          requires: [{ weapon: true }],
          inherits: { namePrefix: '+1 ', source: 'X', bonusWeapon: '+1' }
        }
      ]
    });
    expect(entries.item.map((i) => i.name).sort()).toEqual(['+1 Longsword', 'Longsword']);
  });

  it('gives overlay spells empty class indices (no base lookup covers them)', () => {
    const { entries } = parseOverlayEntries(UA_DOC);
    expect(entries.spell[0]._classes).toEqual([]);
    expect(entries.spell[0]._subclasses).toEqual([]);
  });

  it('ignores entries missing name or source', () => {
    const { entries } = parseOverlayEntries({
      feat: [{ name: 'Valid', source: 'X' }, { name: 'No Source' }, { source: 'X' }, null]
    });
    expect(entries.feat.map((f) => f.name)).toEqual(['Valid']);
  });
});

describe('parseOverlay', () => {
  it('counts each category and carries the source id + label', () => {
    const overlay = parseOverlay(UA_DOC, 'XUA2025Psion', 'UA 2025: The Psion');
    expect(overlay.sourceId).toBe('XUA2025Psion');
    expect(overlay.label).toBe('UA 2025: The Psion');
    expect(overlay.counts.spell).toBe(1);
    expect(overlay.counts.feat).toBe(1);
    expect(overlay.counts.item).toBe(0);
  });

  it('defaults the label to the source id', () => {
    expect(parseOverlay(UA_DOC, 'XUA2025Psion').label).toBe('XUA2025Psion');
  });
});

describe('isEmptyOverlay', () => {
  it('is true when nothing recognised was parsed', () => {
    expect(isEmptyOverlay(parseOverlay({ foo: 'bar' }, 'X'))).toBe(true);
  });

  it('is false when a subclass was parsed', () => {
    expect(isEmptyOverlay(parseOverlay(UA_DOC, 'X'))).toBe(false);
  });
});
