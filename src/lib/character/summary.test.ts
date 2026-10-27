import { describe, it, expect } from 'vitest';
import { buildGraph } from './buildGraph.js';
import { createCharacter } from './schema.js';
import { computeSummary } from './summary.js';
import type { GrantPool } from './grants.js';

const grants: GrantPool = {
  numeric: [
    { target: 'speed.walk', source: 'Dwarf', value: 25, combine: 'max' },
    { target: 'speed.walk', source: 'Boots', value: 30, combine: 'max' },
    { target: 'sense.darkvision', source: 'Dwarf', value: 60, combine: 'max' },
    { target: 'ability.con.score', source: 'Dwarf', value: 2, combine: 'sum' }
  ],
  sets: [
    { category: 'language', member: 'common', source: 'Dwarf' },
    { category: 'language', member: 'dwarvish', source: 'Dwarf' },
    { category: 'resist', member: 'poison', source: 'Dwarf' },
    { category: 'saveProf', member: 'wis', source: 'Cleric' },
    { category: 'skillProf', member: 'perception', source: 'Custom' }
  ],
  choices: []
};

function summaryOf(over = {}) {
  const character = createCharacter({
    name: 'Brakka',
    abilities: { str: 10, dex: 14, con: 14, int: 10, wis: 16, cha: 8 },
    classes: [{ name: 'Cleric', source: 'XPHB', level: 5, subclass: 'Life' }],
    race: { name: 'Dwarf', source: 'XPHB' },
    hp: { max: 38, current: 20, temp: 0 },
    acBase: 16,
    spellcasting: { ability: 'wis' },
    resources: [{ id: 'r1', name: 'Luck', max: 3, used: 1, recharge: 'long' }],
    ...over
  });
  const graph = buildGraph(character, undefined, grants, 'wis');
  return computeSummary({
    character,
    graph,
    grants,
    slots: { slots: [4, 3, 2, 0, 0, 0, 0, 0, 0], pact: null },
    featureResources: [{ key: 'short|Cleric|Channel Divinity', name: 'Channel Divinity', owner: 'Cleric', max: 2, recharge: 'short' }]
  });
}

describe('computeSummary', () => {
  it('reads level, defenses and passives off the calc graph', () => {
    const s = summaryOf();
    expect(s).toMatchObject({
      v: 1,
      name: 'Brakka',
      level: 5,
      classes: [{ name: 'Cleric', subclass: 'Life', level: 5 }],
      race: 'Dwarf',
      maxHp: 38,
      profBonus: 3,
      initiative: 2,
      ac: 16 + 2
    });
    // Con 14 + the Dwarf's +2 (a modifier on the score node) → 16.
    expect(s.abilities.con).toEqual({ score: 16, mod: 3 });
    // Granted save and skill proficiencies count.
    expect(s.saves.wis).toBe(3 + 3);
    expect(s.saves.str).toBe(0);
    expect(s.passive.perception).toBe(10 + 3 + 3);
    expect(s.passive.insight).toBe(10 + 3);
    expect(s.skills.perception).toBe(6);
    expect(s.spell).toEqual({ dc: 8 + 3 + 3, attack: 3 + 3 });
  });

  it('takes the best speed and sense, and lists languages and resistances', () => {
    const s = summaryOf();
    expect(s.speed).toEqual({ walk: 30 });
    expect(s.senses).toEqual({ darkvision: 60 });
    expect(s.languages).toEqual(['Common', 'Dwarvish']);
    expect(s.resistances).toEqual(['Poison']);
  });

  it('lists custom and class resources, and effective slot maxima', () => {
    const s = summaryOf();
    expect(s.resources).toEqual([
      { key: 'r1', name: 'Luck', max: 3, recharge: 'long', kind: 'custom' },
      { key: 'short|Cleric|Channel Divinity', name: 'Channel Divinity', max: 2, recharge: 'short', kind: 'feature' }
    ]);
    expect(s.spellSlots).toEqual([
      { level: 1, max: 4 },
      { level: 2, max: 3 },
      { level: 3, max: 2 }
    ]);
    expect(s.pact).toBeNull();
  });

  it('uses the manual slot table when auto slots are off', () => {
    const spellSlots = Array.from({ length: 9 }, (_, i) => ({ max: i === 0 ? 1 : 0, expended: 0 }));
    expect(summaryOf({ spellSlotsAuto: false, spellSlots }).spellSlots).toEqual([{ level: 1, max: 1 }]);
  });

  it('is stable: the same character summarizes identically', () => {
    expect(JSON.stringify(summaryOf())).toBe(JSON.stringify(summaryOf()));
  });

  it('leaves status out — current HP is not a summary concern', () => {
    expect(JSON.stringify(summaryOf())).toBe(JSON.stringify(summaryOf({ hp: { max: 38, current: 1, temp: 5 } })));
  });
});
