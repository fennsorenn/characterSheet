import { describe, it, expect } from 'vitest';
import { asiModifiers, asiTotal } from './abilityChoices.js';
import { buildGraph } from './buildGraph.js';
import { createCharacter } from './schema.js';

describe('asiModifiers', () => {
  it('turns ability choices into score modifiers, labelled by the feature', () => {
    const c = createCharacter({
      abilityChoices: { 'Ability Score Improvement|PHB|Fighter 4': { str: 2 } }
    });
    expect(asiModifiers(c)).toEqual([
      { target: 'ability.str.score', source: 'Fighter 4', value: 2 }
    ]);
  });

  it('sums across features for a total', () => {
    const c = createCharacter({
      abilityChoices: { a: { str: 1, dex: 1 }, b: { str: 2 } }
    });
    expect(asiTotal(c, 'str')).toBe(3);
    expect(asiTotal(c, 'dex')).toBe(1);
  });
});

describe('ASI applied through the graph', () => {
  it('raises the effective score and modifier non-destructively', () => {
    const c = createCharacter({
      abilities: { str: 14 } as never,
      abilityChoices: { 'Ability Score Improvement|PHB|Fighter 4': { str: 2 } }
    });
    const g = buildGraph(c);
    expect(g.get('ability.str.score')).toBe(16); // 14 base + 2 ASI
    expect(g.get('ability.str.mod')).toBe(3);
    expect(c.abilities.str).toBe(14); // base untouched
    expect(g.explain('ability.str.score').modifiers.map((m) => m.source)).toContain('Fighter 4');
  });
});
