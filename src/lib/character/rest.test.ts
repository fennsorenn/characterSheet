import { describe, it, expect } from 'vitest';
import { applyRest } from './rest.js';
import { createCharacter } from './schema.js';

function sample() {
  return createCharacter({
    hp: { max: 30, current: 12, temp: 0 },
    resources: [
      { id: 'a', name: 'Second Wind', max: 1, used: 1, recharge: 'short' },
      { id: 'b', name: 'Rage', max: 3, used: 2, recharge: 'long' }
    ],
    spellSlots: [
      { max: 4, expended: 3 },
      { max: 2, expended: 2 },
      ...Array.from({ length: 7 }, () => ({ max: 0, expended: 0 }))
    ]
  });
}

describe('applyRest', () => {
  it('short rest refills only short-recharge features', () => {
    const after = applyRest(sample(), 'short');
    expect(after.resources[0].used).toBe(0); // short
    expect(after.resources[1].used).toBe(2); // long: untouched
    expect(after.hp.current).toBe(12); // HP unchanged
    expect(after.spellSlots[0].expended).toBe(3); // slots unchanged
  });

  it('long rest refills everything and restores HP to max', () => {
    const after = applyRest(sample(), 'long');
    expect(after.resources.every((r) => r.used === 0)).toBe(true);
    expect(after.spellSlots.every((s) => s.expended === 0)).toBe(true);
    expect(after.hp.current).toBe(30);
  });

  it('does not mutate the input', () => {
    const c = sample();
    const snap = JSON.stringify(c);
    applyRest(c, 'long');
    expect(JSON.stringify(c)).toBe(snap);
  });
});
