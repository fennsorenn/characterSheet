import { describe, it, expect } from 'vitest';
import {
  parseChoiceFilter,
  choiceLabel,
  blockSpellChoices,
  spellMatchesChoice,
  featureChoices,
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

describe('blockSpellChoices', () => {
  it('extracts choose slots with count, skips ability choices, gates by level', () => {
    const block = {
      known: { _: [{ choose: 'level=0|class=Sorcerer', count: 2 }] },
      prepared: { 3: [{ choose: 'level=1|class=Sorcerer' }] },
      ability: { choose: ['int', 'wis', 'cha'] }
    };
    const lvl5 = blockSpellChoices(block, 5);
    expect(lvl5.map((s) => `${s.filter.levels[0]}x${s.count}`).sort()).toEqual(['0x2', '1x1']);
    // At level 1 the prepared@3 choice is gated out.
    expect(blockSpellChoices(block, 1).map((s) => s.filter.levels[0])).toEqual([0]);
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

describe('featureChoices', () => {
  it('emits one field per pick (honouring count) for a single-block feat', () => {
    const cat = emptyCatalog('t');
    cat.entries.feat = [
      { name: 'Spell Sniper', source: 'PHB', additionalSpells: [{ known: { _: [{ choose: 'level=0|class=Wizard', count: 1 }] } }] }
    ] as never;
    const c = createCharacter({ feats: [{ name: 'Spell Sniper', source: 'PHB' }] });
    const { options, spells } = featureChoices(c, cat);
    expect(options).toHaveLength(0);
    expect(spells).toHaveLength(1);

    c.spellChoices = { [spells[0].key]: { name: 'Fire Bolt', source: 'PHB' } };
    expect(choiceGrantedSpells(c)).toEqual([{ name: 'Fire Bolt', source: 'PHB', grantedBy: 'Spell Sniper' }]);
  });

  it('gates multi-block features behind an option, then emits its fields', () => {
    const cat = emptyCatalog('t');
    cat.entries.feat = [
      {
        name: 'Magic Initiate',
        source: 'PHB',
        additionalSpells: [
          { name: 'Wizard', known: { _: [{ choose: 'level=0|class=Wizard', count: 2 }] } },
          { name: 'Cleric', known: { _: [{ choose: 'level=0|class=Cleric', count: 2 }] } }
        ]
      }
    ] as never;
    const c = createCharacter({ feats: [{ name: 'Magic Initiate', source: 'PHB' }] });
    // Before choosing a source: one option, no spell fields (not an arbitrary list).
    let fc = featureChoices(c, cat);
    expect(fc.options).toHaveLength(1);
    expect(fc.options[0].options.map((o) => o.label)).toEqual(['Wizard', 'Cleric']);
    expect(fc.spells).toHaveLength(0);
    // After choosing Wizard: exactly 2 cantrip fields.
    c.featureOptions = { [fc.options[0].key]: '0' };
    fc = featureChoices(c, cat);
    expect(fc.spells).toHaveLength(2);
    expect(fc.spells.every((s) => s.filter.classes[0] === 'Wizard')).toBe(true);
  });
});
