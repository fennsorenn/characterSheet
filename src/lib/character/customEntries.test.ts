import { describe, it, expect } from 'vitest';
import { createCharacter, CUSTOM_SOURCE } from './schema.js';
import { gatherCustom, setMembers, maxNumeric } from './grants.js';
import { buildGraph, customSkillNode, customAttackNode } from './index.js';
import type { GrantPool } from './grants.js';

const pool = (): GrantPool => ({ numeric: [], sets: [], choices: [] });

// Movement, senses and proficiencies the player adds by hand go into the same
// pool a race feeds, so everything downstream picks them up unchanged.
describe('custom grants', () => {
  it('adds a speed and a sense as distances', () => {
    const c = createCharacter({
      customGrants: [
        { id: 'a', kind: 'speed', name: 'Fly', feet: 60 },
        { id: 'b', kind: 'sense', name: 'tremorsense', feet: 30 }
      ]
    });
    const p = pool();
    gatherCustom(c, p);
    expect(maxNumeric(p, 'speed.')).toEqual([{ name: 'fly', value: 60, sources: [CUSTOM_SOURCE] }]);
    expect(maxNumeric(p, 'sense.')).toEqual([
      { name: 'tremorsense', value: 30, sources: [CUSTOM_SOURCE] }
    ]);
  });

  it('adds proficiencies to their categories', () => {
    const c = createCharacter({
      customGrants: [
        { id: 'a', kind: 'set', category: 'language', member: "Thieves' Cant" },
        { id: 'b', kind: 'set', category: 'weaponProf', member: 'Bagpipes' }
      ]
    });
    const p = pool();
    gatherCustom(c, p);
    expect(setMembers(p, 'language').map((m) => m.member)).toEqual(["Thieves' Cant"]);
    expect(setMembers(p, 'weaponProf').map((m) => m.member)).toEqual(['Bagpipes']);
  });

  // A race granting the same speed and the player typing it read as one chip at
  // the better value — that is what `max` on the target is for. The losing
  // source drops out, which is why the traits block decides what is removable
  // from the player's own list rather than from the winning source.
  it('shares a target with a granted one rather than doubling it', () => {
    const c = createCharacter({ customGrants: [{ id: 'a', kind: 'speed', name: 'walk', feet: 40 }] });
    const p = pool();
    p.numeric.push({ target: 'speed.walk', source: 'Dwarf', value: 25, combine: 'max' });
    gatherCustom(c, p);
    expect(maxNumeric(p, 'speed.')).toEqual([{ name: 'walk', value: 40, sources: [CUSTOM_SOURCE] }]);

    // …and the other way round the race still wins, so the number never drops.
    const q = pool();
    q.numeric.push({ target: 'speed.walk', source: 'Dwarf', value: 25, combine: 'max' });
    gatherCustom(createCharacter({ customGrants: [{ id: 'a', kind: 'speed', name: 'walk', feet: 10 }] }), q);
    expect(maxNumeric(q, 'speed.')).toEqual([{ name: 'walk', value: 25, sources: ['Dwarf'] }]);
  });

  it('ignores an empty member rather than adding a blank chip', () => {
    const c = createCharacter({
      customGrants: [{ id: 'a', kind: 'set', category: 'language', member: '   ' }]
    });
    const p = pool();
    gatherCustom(c, p);
    expect(p.sets).toEqual([]);
  });
});

describe('custom skills', () => {
  it('computes like any other skill', () => {
    const c = createCharacter({
      abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
      classes: [{ name: 'Wizard', source: 'PHB', level: 5, hitDie: 6 }],
      customSkills: [{ id: 's1', name: 'Lore', ability: 'int', proficiency: 'proficient' }]
    });
    // int +4, proficiency +3 at level 5
    expect(buildGraph(c).get(customSkillNode('s1'))).toBe(7);
  });

  it('honours the tier it is set to', () => {
    const base = {
      abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
      classes: [{ name: 'Wizard', source: 'PHB', level: 5, hitDie: 6 }]
    };
    const at = (proficiency: 'none' | 'half' | 'proficient' | 'expertise') =>
      buildGraph(
        createCharacter({ ...base, customSkills: [{ id: 's1', name: 'Lore', ability: 'int', proficiency }] })
      ).get(customSkillNode('s1'));
    expect(at('none')).toBe(4);
    expect(at('half')).toBe(5); // +1, floored
    expect(at('expertise')).toBe(10);
  });
});

describe('custom attacks', () => {
  const c = (attack: Record<string, unknown>) =>
    createCharacter({
      abilities: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      classes: [{ name: 'Fighter', source: 'PHB', level: 5, hitDie: 10 }],
      customAttacks: [{ id: 'a1', name: 'Bite', ...attack }] as never
    });

  it('adds ability, proficiency and a flat bonus', () => {
    expect(buildGraph(c({ ability: 'str', proficient: true })).get(customAttackNode('a1'))).toBe(6);
    expect(buildGraph(c({ ability: 'str', proficient: false })).get(customAttackNode('a1'))).toBe(3);
    expect(buildGraph(c({ ability: 'str', proficient: true, bonus: 2 })).get(customAttackNode('a1'))).toBe(8);
  });

  // Not everything is an ability + proficiency; a flat "+7 to hit" from a
  // statblock should be expressible without inventing an ability for it.
  it('takes a flat bonus with no ability behind it', () => {
    expect(buildGraph(c({ bonus: 7 })).get(customAttackNode('a1'))).toBe(7);
  });

  it('takes the exhaustion penalty, like every other attack roll', () => {
    const doc = createCharacter({
      abilities: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      classes: [{ name: 'Fighter', source: 'PHB', level: 5, hitDie: 10 }],
      exhaustion: 2,
      customAttacks: [{ id: 'a1', name: 'Bite', ability: 'str', proficient: true }]
    });
    expect(buildGraph(doc).get(customAttackNode('a1'))).toBe(6 - 4);
  });
});
