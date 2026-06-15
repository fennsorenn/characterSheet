import { describe, it, expect } from 'vitest';
import { applyAdjustment, adjustmentValue } from './adjustments.js';
import type { CharacterModifier } from './schema.js';

const S = 'Manual buff';

describe('applyAdjustment', () => {
  it('adds a new adjustment when none exists', () => {
    const after = applyAdjustment([], 'ac', S, 2);
    expect(after).toEqual([{ target: 'ac', source: S, value: 2 }]);
  });

  it('merges deltas into the existing adjustment', () => {
    let mods: CharacterModifier[] = applyAdjustment([], 'ac', S, 2);
    mods = applyAdjustment(mods, 'ac', S, 1);
    expect(adjustmentValue(mods, 'ac', S)).toBe(3);
    expect(mods).toHaveLength(1);
  });

  it('removes the adjustment when it nets to zero', () => {
    let mods = applyAdjustment([], 'save.dex', S, 2);
    mods = applyAdjustment(mods, 'save.dex', S, -2);
    expect(mods).toHaveLength(0);
  });

  it('keeps adjustments on different nodes separate', () => {
    let mods = applyAdjustment([], 'ac', S, 2);
    mods = applyAdjustment(mods, 'initiative', S, -1);
    expect(adjustmentValue(mods, 'ac', S)).toBe(2);
    expect(adjustmentValue(mods, 'initiative', S)).toBe(-1);
  });

  it('does not touch other modifiers', () => {
    const item: CharacterModifier = { target: 'ac', source: 'Ring', value: 1 };
    const after = applyAdjustment([item], 'ac', S, 2);
    expect(after).toContainEqual(item);
    expect(adjustmentValue(after, 'ac', S)).toBe(2);
  });
});
