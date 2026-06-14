import { describe, it, expect } from 'vitest';
import { CalcGraph, abilityModifier, resolveModifiers } from './index.js';

describe('abilityModifier', () => {
  it('floors toward negative infinity', () => {
    expect(abilityModifier(10)).toBe(0);
    expect(abilityModifier(14)).toBe(2);
    expect(abilityModifier(15)).toBe(2);
    expect(abilityModifier(7)).toBe(-2);
  });
});

describe('resolveModifiers', () => {
  it('stacks modifiers by default', () => {
    const { total } = resolveModifiers([
      { source: 'A', value: 2 },
      { source: 'B', value: 1 }
    ]);
    expect(total).toBe(3);
  });

  it('within a non-stacking type keeps only the largest', () => {
    const { total, applied } = resolveModifiers([
      { source: 'Shield of Faith', value: 2, type: 'deflection', stacks: false },
      { source: 'Ring of Protection', value: 1, type: 'deflection', stacks: false }
    ]);
    expect(total).toBe(2);
    expect(applied.find((m) => m.source === 'Ring of Protection')!.applied).toBe(false);
    expect(applied.find((m) => m.source === 'Shield of Faith')!.applied).toBe(true);
  });
});

describe('CalcGraph', () => {
  it('derives ability modifier from a score and reacts to edits', () => {
    const g = new CalcGraph();
    g.set('dex.score', 14);
    g.define('dex.mod', ['dex.score'], (c) => abilityModifier(c.get('dex.score')));

    expect(g.get('dex.mod')).toBe(2);
    g.set('dex.score', 18);
    expect(g.get('dex.mod')).toBe(4);
  });

  it('composes AC from dependencies plus layered modifiers', () => {
    const g = new CalcGraph();
    g.set('dex.score', 14);
    g.define('dex.mod', ['dex.score'], (c) => abilityModifier(c.get('dex.score')));
    g.set('armor.base', 11); // leather
    g.define('ac', ['armor.base', 'dex.mod'], (c) => c.get('armor.base') + c.get('dex.mod'));

    expect(g.get('ac')).toBe(13);

    g.addModifier('ac', { source: 'Ring of Protection', value: 1 });
    g.addModifier('ac', { source: 'Shield spell', value: 5 });
    expect(g.get('ac')).toBe(19);

    g.removeModifiersFrom('ac', 'Shield spell');
    expect(g.get('ac')).toBe(14);
  });

  it('explains how a value is built, down to the inputs', () => {
    const g = new CalcGraph();
    g.set('dex.score', 16);
    g.define('dex.mod', ['dex.score'], (c) => abilityModifier(c.get('dex.score')));
    g.set('armor.base', 11);
    g.define('ac', ['armor.base', 'dex.mod'], (c) => c.get('armor.base') + c.get('dex.mod'));
    g.addModifier('ac', { source: 'Ring of Protection', value: 1 });

    const ex = g.explain('ac');
    expect(ex.value).toBe(15); // 11 + 3 + 1
    expect(ex.base).toBe(14);
    expect(ex.modifiers).toHaveLength(1);
    expect(ex.modifiers[0]).toMatchObject({ source: 'Ring of Protection', applied: true });

    const dexMod = ex.dependencies.find((d) => d.id === 'dex.mod')!;
    expect(dexMod.value).toBe(3);
    const dexScore = dexMod.dependencies.find((d) => d.id === 'dex.score')!;
    expect(dexScore.isInput).toBe(true);
    expect(dexScore.value).toBe(16);
  });

  it('detects cycles instead of looping forever', () => {
    const g = new CalcGraph();
    g.define('a', ['b'], (c) => c.get('b'));
    g.define('b', ['a'], (c) => c.get('a'));
    expect(() => g.get('a')).toThrow(/Cycle detected/);
  });

  it('throws on unknown nodes', () => {
    const g = new CalcGraph();
    expect(() => g.get('nope')).toThrow(/Unknown calculation node/);
  });

  it('refuses to set a computed node as an input', () => {
    const g = new CalcGraph();
    g.define('x', [], () => 1);
    expect(() => g.set('x', 5)).toThrow(/computed node/);
  });
});
