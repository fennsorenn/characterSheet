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
  c.entries.class = [
    {
      name: 'Fighter',
      source: 'PHB',
      proficiency: ['str', 'con'],
      startingProficiencies: {
        armor: ['light', 'medium', 'heavy', 'shield'],
        weapons: ['simple', 'martial'],
        skills: [{ choose: { from: ['athletics', 'perception', 'survival'], count: 2 } }]
      },
      multiclassing: { proficienciesGained: { armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'] } }
    },
    {
      name: 'Cleric',
      source: 'PHB',
      proficiency: ['wis', 'cha'],
      startingProficiencies: { armor: ['light', 'medium', 'shield'] },
      multiclassing: { proficienciesGained: { armor: ['light', 'medium', 'shield'] } }
    }
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
      classes: [], // isolate from the default class's starting save proficiencies
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

  it('gathers the first class’s saves, armor/weapon profs, and skill choice', () => {
    const c = createCharacter({ classes: [{ name: 'Fighter', source: 'PHB', level: 1 }] });
    const pool = gatherGrants(c, catalog());
    expect(setMembers(pool, 'saveProf').map((m) => m.member)).toEqual(['str', 'con']);
    expect(setMembers(pool, 'armorProf').map((m) => m.member)).toContain('heavy');
    expect(setMembers(pool, 'weaponProf').map((m) => m.member)).toEqual(['simple', 'martial']);
    const skillChoice = pool.choices.find((ch) => ch.source === 'Fighter' && ch.category === 'skillProf');
    expect(skillChoice?.count).toBe(2);
    expect(skillChoice?.from).toEqual(['athletics', 'perception', 'survival']);
  });

  it('grants only the multiclass subset (no saves, no heavy armor) from additional classes', () => {
    // Cleric as a second class: armor light/medium/shield only — no wis/cha saves.
    const c = createCharacter({
      classes: [
        { name: 'Fighter', source: 'PHB', level: 1 },
        { name: 'Cleric', source: 'PHB', level: 1 }
      ]
    });
    const pool = gatherGrants(c, catalog());
    // Saves come from Fighter (first) only.
    expect(setMembers(pool, 'saveProf').map((m) => m.member).sort()).toEqual(['con', 'str']);
    // Cleric contributes armor but no saving throws.
    const clericArmor = pool.sets.filter((s) => s.source === 'Cleric' && s.category === 'armorProf');
    expect(clericArmor.map((s) => s.member)).toEqual(['light', 'medium', 'shield']);
    expect(pool.sets.some((s) => s.source === 'Cleric' && s.category === 'saveProf')).toBe(false);
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
