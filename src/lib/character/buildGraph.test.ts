import { describe, it, expect } from 'vitest';
import { buildGraph, skillNodeId } from './buildGraph.js';
import { createCharacter } from './schema.js';

describe('buildGraph', () => {
  it('derives ability modifiers', () => {
    const g = buildGraph(createCharacter({ abilities: { dex: 16, con: 14 } as never }));
    expect(g.get('ability.dex.mod')).toBe(3);
    expect(g.get('ability.con.mod')).toBe(2);
    expect(g.get('ability.str.mod')).toBe(0); // default 10
  });

  it('scales proficiency bonus with total level', () => {
    expect(buildGraph(createCharacter()).get('prof.bonus')).toBe(2); // level 1
    const l5 = createCharacter({ classes: [{ name: 'Fighter', source: 'PHB', level: 5 }] });
    expect(buildGraph(l5).get('prof.bonus')).toBe(3);
    const multiclass = createCharacter({
      classes: [
        { name: 'Fighter', source: 'PHB', level: 5 },
        { name: 'Wizard', source: 'PHB', level: 4 }
      ]
    });
    expect(buildGraph(multiclass).get('prof.bonus')).toBe(4); // level 9
  });

  it('adds proficiency bonus only to proficient saves', () => {
    const c = createCharacter({
      abilities: { con: 14, dex: 12 } as never,
      saveProficiencies: ['con'],
      classes: [{ name: 'Fighter', source: 'PHB', level: 5 }] // prof +3
    });
    const g = buildGraph(c);
    expect(g.get('save.con')).toBe(2 + 3); // proficient
    expect(g.get('save.dex')).toBe(1); // not proficient: just the mod
  });

  it('handles expertise and half proficiency on skills', () => {
    const c = createCharacter({
      abilities: { dex: 14, wis: 12, cha: 10 } as never,
      classes: [{ name: 'Bard', source: 'PHB', level: 5 }], // prof +3
      skillProficiencies: {
        stealth: 'expertise',
        perception: 'proficient',
        persuasion: 'half'
      }
    });
    const g = buildGraph(c);
    expect(g.get(skillNodeId('stealth'))).toBe(2 + 3 * 2); // dex mod + double prof
    expect(g.get(skillNodeId('perception'))).toBe(1 + 3); // wis mod + prof
    expect(g.get(skillNodeId('persuasion'))).toBe(0 + Math.floor(3 * 0.5)); // half, floored
  });

  it('computes passive perception and AC', () => {
    const c = createCharacter({
      abilities: { dex: 16, wis: 14 } as never,
      skillProficiencies: { perception: 'proficient' }, // prof +2 at level 1
      acBase: 11
    });
    const g = buildGraph(c);
    expect(g.get('passive.perception')).toBe(10 + (2 + 2)); // 10 + wis mod + prof
    expect(g.get('ac')).toBe(11 + 3); // base + dex mod
    expect(g.get('initiative')).toBe(3);
  });

  it('wires spellcasting DC and attack only when applicable', () => {
    const mundane = buildGraph(createCharacter());
    expect(mundane.has('spell.dc')).toBe(false);

    const caster = buildGraph(
      createCharacter({
        abilities: { int: 18 } as never,
        classes: [{ name: 'Wizard', source: 'PHB', level: 5 }],
        spellcasting: { ability: 'int' }
      })
    );
    expect(caster.get('spell.dc')).toBe(8 + 3 + 4); // 8 + prof + int mod
    expect(caster.get('spell.attack')).toBe(3 + 4);
  });

  it('layers character modifiers and explains them', () => {
    const c = createCharacter({
      abilities: { dex: 14 } as never,
      acBase: 11,
      modifiers: [
        { target: 'ac', source: 'Ring of Protection', value: 1 },
        { target: 'ac', source: 'Inactive Buff', value: 5, active: false }
      ]
    });
    const g = buildGraph(c);
    expect(g.get('ac')).toBe(11 + 2 + 1); // base + dex + ring, inactive ignored

    const ex = g.explain('ac');
    expect(ex.modifiers.map((m) => m.source)).toEqual(['Ring of Protection']);
    const dex = ex.dependencies.find((d) => d.id === 'ability.dex.mod');
    expect(dex?.dependencies[0].id).toBe('ability.dex.score');
  });
});
