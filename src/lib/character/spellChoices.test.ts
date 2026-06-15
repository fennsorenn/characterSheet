import { describe, it, expect } from 'vitest';
import {
  parseChoiceFilter,
  choiceLabel,
  additionalSpellChoices,
  spellMatchesChoice,
  featureSpellChoices,
  choiceGrantedSpells
} from './spellChoices.js';
import { createCharacter } from './schema.js';
import { emptyCatalog } from '../data/catalog.js';
import type { NamedEntry } from '../data/catalog.js';

describe('parseChoiceFilter', () => {
  it('parses level/class/school/ritual specs', () => {
    expect(parseChoiceFilter('level=1|class=Sorcerer')).toEqual({
      levels: [1],
      classes: ['Sorcerer'],
      schools: [],
      ritual: false
    });
    expect(parseChoiceFilter('level=1|class=druid;wizard')).toMatchObject({
      classes: ['Druid', 'Wizard']
    });
    expect(parseChoiceFilter('level=2|school=E;N')).toMatchObject({ schools: ['E', 'N'] });
    expect(parseChoiceFilter('level=1|components & miscellaneous=ritual').ritual).toBe(true);
  });

  it('labels readably', () => {
    expect(choiceLabel(parseChoiceFilter('level=0|class=Wizard'))).toBe('Choose a cantrip (Wizard) spell');
  });
});

describe('additionalSpellChoices', () => {
  it('extracts choose slots, skips ability choices, gates by level', () => {
    const block = [
      {
        known: { _: [{ choose: 'level=0|class=Sorcerer' }] },
        prepared: { 3: [{ choose: 'level=1|class=Sorcerer' }] },
        ability: { choose: ['int', 'wis', 'cha'] }
      }
    ];
    expect(additionalSpellChoices(block, 5).map((f) => f.levels[0]).sort()).toEqual([0, 1]);
    // At level 1 the prepared@3 choice is gated out.
    expect(additionalSpellChoices(block, 1).map((f) => f.levels[0])).toEqual([0]);
  });
});

describe('spellMatchesChoice', () => {
  const wizardCantrip: NamedEntry = { name: 'Fire Bolt', source: 'PHB', level: 0, school: 'V', _classes: ['Wizard', 'Sorcerer'] };
  it('matches by level, class, school', () => {
    const f = parseChoiceFilter('level=0|class=Wizard');
    expect(spellMatchesChoice(wizardCantrip, f)).toBe(true);
    expect(spellMatchesChoice({ ...wizardCantrip, level: 1 }, f)).toBe(false);
    expect(spellMatchesChoice({ ...wizardCantrip, _classes: ['Cleric'] }, f)).toBe(false);
  });
});

describe('featureSpellChoices + choiceGrantedSpells', () => {
  it('surfaces a feat slot and turns a pick into a granted spell', () => {
    const cat = emptyCatalog('t');
    cat.entries.feat = [
      { name: 'Magic Initiate', source: 'PHB', additionalSpells: [{ known: { _: [{ choose: 'level=0|class=Wizard' }] } }] }
    ] as never;
    const c = createCharacter({ feats: [{ name: 'Magic Initiate', source: 'PHB' }] });
    const slots = featureSpellChoices(c, cat);
    expect(slots).toHaveLength(1);
    expect(slots[0].key).toBe('Magic Initiate|PHB|0');

    c.spellChoices = { [slots[0].key]: { name: 'Fire Bolt', source: 'PHB' } };
    expect(choiceGrantedSpells(c)).toEqual([
      { name: 'Fire Bolt', source: 'PHB', grantedBy: 'Magic Initiate' }
    ]);
  });
});
