import { describe, it, expect } from 'vitest';
import {
  gatherGrants,
  grantNumericModifiers,
  setMembers,
  maxNumeric,
  grantKey
} from './grants.js';
import { buildGraph } from './buildGraph.js';
import { createCharacter } from './schema.js';
import { emptyCatalog, type Catalog } from '../data/catalog.js';

function catalog(): Catalog {
  const c = emptyCatalog('test');
  c.entries.race = [
    {
      name: 'Dwarf',
      source: 'PHB',
      ability: [{ con: 2 }],
      resist: ['poison'],
      speed: { walk: 25 },
      darkvision: 60,
      senses: [{ darkvision: 60 }],
      skillProficiencies: [{ choose: { from: ['perception', 'stealth'], count: 1 } }]
    }
  ] as never;
  c.entries.feat = [
    {
      name: 'Resilient',
      source: 'PHB',
      ability: [{ choose: { from: ['str', 'con', 'dex'] } }],
      savingThrowProficiencies: [{ choose: { from: ['str', 'con', 'dex'] } }]
    },
    { name: 'Actor', source: 'PHB', ability: [{ cha: 1 }] }
  ] as never;
  c.entries.background = [
    { name: 'Soldier', source: 'PHB', skillProficiencies: [{ athletics: true, intimidation: true }] }
  ] as never;
  return c;
}

describe('gatherGrants', () => {
  it('gathers fixed numeric (ability), set (resist/skill), and senses/speed by source', () => {
    const c = createCharacter({ race: { name: 'Dwarf', source: 'PHB' } });
    const pool = gatherGrants(c, catalog());

    expect(pool.numeric).toContainEqual({ target: 'ability.con.score', source: 'Dwarf', value: 2, combine: 'sum' });
    expect(pool.numeric).toContainEqual({ target: 'speed.walk', source: 'Dwarf', value: 25, combine: 'max' });
    expect(pool.sets).toContainEqual({ category: 'resist', member: 'poison', source: 'Dwarf' });
    expect(maxNumeric(pool, 'sense.')).toEqual([{ name: 'darkvision', value: 60, sources: ['Dwarf'] }]);
  });

  it('surfaces choose blocks as pending choices and applies the stored pick', () => {
    const base = createCharacter({ feats: [{ name: 'Resilient', source: 'PHB' }] });
    const pool = gatherGrants(base, catalog());
    const abilityChoice = pool.choices.find((ch) => ch.category === 'ability' && ch.source === 'Resilient');
    const saveChoice = pool.choices.find((ch) => ch.category === 'saveProf' && ch.source === 'Resilient');
    expect(abilityChoice?.from).toEqual(['str', 'con', 'dex']);
    expect(saveChoice?.count).toBe(1);

    // Make the picks.
    const picked = createCharacter({
      feats: [{ name: 'Resilient', source: 'PHB' }],
      abilityChoices: { [abilityChoice!.key]: { con: 1 } },
      grantChoices: { [saveChoice!.key]: ['con'] }
    });
    const pool2 = gatherGrants(picked, catalog());
    expect(grantNumericModifiers(pool2)).toContainEqual({ target: 'ability.con.score', source: 'Resilient', value: 1 });
    expect(setMembers(pool2, 'saveProf')).toEqual([{ member: 'con', sources: ['Resilient'] }]);
  });

  it('keys choices stably to source/field/index', () => {
    expect(grantKey('Resilient', 'ability', 0)).toBe('grant:Resilient|ability|0');
  });
});

describe('grants through the graph', () => {
  it('applies a racial ability bonus and a feat-granted save proficiency', () => {
    const c = createCharacter({
      abilities: { con: 14 } as never,
      saveProficiencies: [],
      race: { name: 'Dwarf', source: 'PHB' },
      feats: [{ name: 'Resilient', source: 'PHB' }],
      grantChoices: { [grantKey('Resilient', 'savingThrowProficiencies', 0)]: ['con'] }
    });
    const pool = gatherGrants(c, catalog());
    const g = buildGraph(c, undefined, pool);

    expect(g.get('ability.con.score')).toBe(16); // 14 + Dwarf +2
    // Save proficiency from Resilient → con save includes proficiency bonus.
    expect(g.get('save.con')).toBe(g.get('ability.con.mod') + g.get('prof.bonus'));
    expect(c.abilities.con).toBe(14); // base untouched
  });
});
