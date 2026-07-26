import { describe, it, expect } from 'vitest';
import { buffLabel, activeBuffs } from './buffs.js';
import { createCharacter, type CharacterModifier } from './schema.js';

const src = 'Manual buff';
const withMods = (modifiers: CharacterModifier[]) => createCharacter({ modifiers });

describe('buffLabel', () => {
  it('names the fixed nodes a player recognises', () => {
    expect(buffLabel('ac')).toBe('Armour Class');
    expect(buffLabel('initiative')).toBe('Initiative');
    expect(buffLabel('spell.dc')).toBe('Spell Save DC');
    expect(buffLabel('prof.bonus')).toBe('Proficiency Bonus');
  });

  it('distinguishes an ability score from its modifier', () => {
    expect(buffLabel('ability.str.score')).toBe('Strength score');
    expect(buffLabel('ability.str.mod')).toBe('Strength modifier');
  });

  it('names saves and skills, un-mangling the dotted skill ids', () => {
    expect(buffLabel('save.dex')).toBe('Dexterity save');
    expect(buffLabel('skill.stealth')).toBe('Stealth');
    // skillNodeId turns spaces into dots, so they have to come back out.
    expect(buffLabel('skill.sleight.of.hand')).toBe('Sleight Of Hand');
  });

  it('uses the attack name when one can be resolved, and copes when it cannot', () => {
    const name = (id: string) => (id === 'a1' ? 'Longsword' : undefined);
    expect(buffLabel('attack.a1.hit', name)).toBe('Longsword attack');
    expect(buffLabel('attack.a1.dmg', name)).toBe('Longsword damage');
    expect(buffLabel('attack.gone.dmg', name)).toBe('Attack damage');
  });

  it('never returns nothing for an unknown node', () => {
    // A buff whose label we cannot derive must still be listable, or it could
    // never be cleared.
    expect(buffLabel('some.future.node')).toBe('Some Future Node');
  });
});

describe('activeBuffs', () => {
  it('lists only buff-mode modifiers, labelled, in order', () => {
    const c = withMods([
      { target: 'ac', source: src, value: 2 },
      { target: 'skill.stealth', source: 'Chain Mail', value: -1 },
      { target: 'ability.str.score', source: src, value: 1 }
    ]);
    expect(activeBuffs(c, src)).toEqual([
      { nodeId: 'ac', label: 'Armour Class', value: 2 },
      { nodeId: 'ability.str.score', label: 'Strength score', value: 1 }
    ]);
  });

  it('keeps negatives and drops a modifier that has netted to zero', () => {
    const c = withMods([
      { target: 'save.wis', source: src, value: -2 },
      { target: 'initiative', source: src, value: 0 }
    ]);
    const out = activeBuffs(c, src);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ nodeId: 'save.wis', label: 'Wisdom save', value: -2 });
  });

  it('is empty when nothing is buffed', () => {
    expect(activeBuffs(withMods([]), src)).toEqual([]);
  });
});
