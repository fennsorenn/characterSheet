import { describe, it, expect } from 'vitest';
import { featAbilityModifiers, featAbilityChoices, featAbilityKey } from './featAbilities.js';
import { buildGraph } from './buildGraph.js';
import { createCharacter } from './schema.js';
import type { NamedEntry } from '../data/catalog.js';

const FEATS: NamedEntry[] = [
  { name: 'Actor', source: 'PHB', ability: [{ cha: 1 }] },
  { name: 'Resilient', source: 'PHB', ability: [{ choose: { from: ['str', 'con'] } }] },
  { name: 'Fey Touched', source: 'TCE', ability: [{ choose: { from: ['int', 'wis', 'cha'], amount: 1 } }] },
  { name: 'Ability Score Improvement', source: 'XPHB', ability: [{ choose: { from: ['str', 'dex'], amount: 2 }, hidden: true }] }
] as never;
const getFeat = (n: string) => FEATS.find((f) => f.name.toLowerCase() === n.toLowerCase());

describe('featAbilityModifiers', () => {
  it('applies a fixed half-feat bonus automatically, sourced by feat', () => {
    const c = createCharacter({ feats: [{ name: 'Actor', source: 'PHB' }] });
    expect(featAbilityModifiers(c, getFeat)).toEqual([
      { target: 'ability.cha.score', source: 'Actor', value: 1 }
    ]);
  });

  it('applies a chosen bonus only once the player has picked, gated on holding the feat', () => {
    const key = featAbilityKey('Resilient', 'PHB', 0);
    const c = createCharacter({
      feats: [{ name: 'Resilient', source: 'PHB' }],
      abilityChoices: { [key]: { con: 1 } }
    });
    expect(featAbilityModifiers(c, getFeat)).toEqual([
      { target: 'ability.con.score', source: 'Resilient', value: 1 }
    ]);

    // Same stored pick but the feat is no longer held → no bonus.
    const without = createCharacter({ abilityChoices: { [key]: { con: 1 } } });
    expect(featAbilityModifiers(without, getFeat)).toEqual([]);
  });

  it('ignores hidden ability blocks (handled by the class ASI)', () => {
    const c = createCharacter({ feats: [{ name: 'Ability Score Improvement', source: 'XPHB' }] });
    expect(featAbilityModifiers(c, getFeat)).toEqual([]);
  });
});

describe('featAbilityChoices', () => {
  it('surfaces choose blocks with their from/amount/count', () => {
    const c = createCharacter({ feats: [{ name: 'Fey Touched', source: 'TCE' }] });
    expect(featAbilityChoices(c, getFeat)).toEqual([
      {
        key: featAbilityKey('Fey Touched', 'TCE', 0),
        featName: 'Fey Touched',
        from: ['int', 'wis', 'cha'],
        amount: 1,
        count: 1,
        label: '+1 to Int/Wis/Cha'
      }
    ]);
  });

  it('omits fixed and hidden blocks', () => {
    const c = createCharacter({
      feats: [
        { name: 'Actor', source: 'PHB' },
        { name: 'Ability Score Improvement', source: 'XPHB' }
      ]
    });
    expect(featAbilityChoices(c, getFeat)).toEqual([]);
  });
});

describe('half-feat through the graph', () => {
  it('raises the effective score non-destructively', () => {
    const c = createCharacter({
      abilities: { cha: 13 } as never,
      feats: [{ name: 'Actor', source: 'PHB' }]
    });
    const g = buildGraph(c, { getItem: () => undefined, getFeat });
    expect(g.get('ability.cha.score')).toBe(14);
    expect(c.abilities.cha).toBe(13);
    expect(g.explain('ability.cha.score').modifiers.map((m) => m.source)).toContain('Actor');
  });
});
