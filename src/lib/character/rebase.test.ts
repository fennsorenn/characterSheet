import { describe, it, expect } from 'vitest';
import { rebase, deepEqual } from './rebase.js';
import { createCharacter } from './schema.js';

const base = () =>
  createCharacter({
    id: 'c1',
    name: 'Bran',
    hp: { max: 30, current: 30, temp: 0 },
    conditions: [],
    resources: [
      { id: 'r1', name: 'Luck', max: 3, used: 0, recharge: 'long' },
      { id: 'r2', name: 'Rage', max: 2, used: 0, recharge: 'long' }
    ]
  });

describe('rebase', () => {
  it('takes the GM’s HP change when the sheet has no unsaved edits', () => {
    const b = base();
    const remote = { ...b, hp: { ...b.hp, current: 12 } };
    expect(rebase(b, b, remote)).toEqual(remote);
  });

  it('keeps unsaved build edits while taking the GM’s status change', () => {
    const b = base();
    const local = { ...b, name: 'Bran the Bold', abilities: { ...b.abilities, str: 16 }, hp: { ...b.hp, max: 34 } };
    const remote = { ...b, hp: { ...b.hp, current: 12, temp: 4 }, conditions: ['Poisoned'], exhaustion: 1 };
    const out = rebase(b, local, remote);
    expect(out.name).toBe('Bran the Bold');
    expect(out.abilities.str).toBe(16);
    // hp merges field by field: the player's max, the GM's current and temp.
    expect(out.hp).toEqual({ max: 34, current: 12, temp: 4 });
    expect(out.conditions).toEqual(['Poisoned']);
    expect(out.exhaustion).toBe(1);
  });

  it('lets the open sheet win when both changed the same value', () => {
    const b = base();
    const local = { ...b, hp: { ...b.hp, current: 25 } };
    const remote = { ...b, hp: { ...b.hp, current: 12 } };
    expect(rebase(b, local, remote).hp.current).toBe(25);
  });

  it('merges resources by id, keeping either side’s use of a different one', () => {
    const b = base();
    const local = { ...b, resources: b.resources.map((r) => (r.id === 'r1' ? { ...r, used: 1 } : r)) };
    const remote = { ...b, resources: b.resources.map((r) => (r.id === 'r2' ? { ...r, used: 2 } : r)) };
    expect(rebase(b, local, remote).resources.map((r) => [r.id, r.used])).toEqual([
      ['r1', 1],
      ['r2', 2]
    ]);
  });

  it('keeps a locally added resource and drops a locally removed one', () => {
    const b = base();
    const added = { id: 'r3', name: 'Ki', max: 5, used: 0, recharge: 'short' as const };
    const local = { ...b, resources: [b.resources[1], added] }; // r1 removed, r3 added
    const remote = { ...b, resources: b.resources.map((r) => ({ ...r, used: 1 })) };
    expect(rebase(b, local, remote).resources).toEqual([{ ...b.resources[1], used: 1 }, added]);
  });

  it('merges spell slots level by level', () => {
    const b = base();
    const slots = (l1: number, l2: number) =>
      b.spellSlots.map((s, i) => (i === 0 ? { max: 4, expended: l1 } : i === 1 ? { max: 3, expended: l2 } : s));
    const b2 = { ...b, spellSlots: slots(0, 0) };
    const local = { ...b2, spellSlots: slots(1, 0) };
    const remote = { ...b2, spellSlots: slots(0, 2) };
    const out = rebase(b2, local, remote);
    expect(out.spellSlots[0].expended).toBe(1);
    expect(out.spellSlots[1].expended).toBe(2);
  });

  it('merges keyed maps such as spent class resources', () => {
    const b = { ...base(), featureResourceUsed: { a: 1 } };
    const local = { ...b, featureResourceUsed: { a: 1, b: 1 } };
    const remote = { ...b, featureResourceUsed: {} }; // the GM restored "a"
    expect(rebase(b, local, remote).featureResourceUsed).toEqual({ b: 1 });
  });

  it('treats condition lists as one value', () => {
    const b = { ...base(), conditions: ['Prone'] };
    const local = { ...b, conditions: ['Prone', 'Blinded'] };
    const remote = { ...b, conditions: [] };
    expect(rebase(b, local, remote).conditions).toEqual(['Prone', 'Blinded']);
    expect(rebase(b, b, remote).conditions).toEqual([]);
  });
});

describe('deepEqual', () => {
  it('ignores undefined-valued keys and compares arrays in order', () => {
    expect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual({ a: [{ x: 1 }] }, { a: [{ x: 1 }] })).toBe(true);
  });
});
