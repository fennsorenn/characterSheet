import { describe, it, expect } from 'vitest';
import { statusOf, applyStatusPatch, statusDiff } from './status.mjs';

const doc = () => ({
  id: 'c1',
  hp: { max: 30, current: 22, temp: 0 },
  conditions: ['Prone'],
  exhaustion: 0,
  resources: [{ id: 'r1', name: 'Luck', max: 3, used: 1, recharge: 'long' }],
  featureResourceUsed: { 'short|Fighter|Action Surge': 1 },
  spellSlots: Array.from({ length: 9 }, (_, i) => ({ max: 0, expended: i === 0 ? 1 : 0 })),
  spellSlotsAuto: true,
  pactSlotsExpended: 0
});
const summary = {
  resources: [
    { key: 'r1', name: 'Luck', max: 3, recharge: 'long', kind: 'custom' },
    { key: 'short|Fighter|Action Surge', name: 'Action Surge', max: 1, recharge: 'short', kind: 'feature' },
    { key: 'short|Fighter|Second Wind', name: 'Second Wind', max: 1, recharge: 'short', kind: 'feature' }
  ],
  spellSlots: [{ level: 1, max: 4 }, { level: 2, max: 2 }],
  pact: { level: 3, max: 2 }
};

describe('statusOf', () => {
  it('reads hp, conditions, resources and slot maxima from doc + summary', () => {
    const s = statusOf(doc(), summary);
    expect(s.hp).toEqual({ current: 22, max: 30, temp: 0 });
    expect(s.conditions).toEqual(['Prone']);
    expect(s.resources.map((r) => [r.key, r.used, r.max, r.kind])).toEqual([
      ['r1', 1, 3, 'custom'],
      ['short|Fighter|Action Surge', 1, 1, 'feature'],
      ['short|Fighter|Second Wind', 0, 1, 'feature']
    ]);
    // Auto slots: maxima come from the summary, not the doc's zeros.
    expect(s.spellSlots).toEqual([
      { level: 1, max: 4, expended: 1 },
      { level: 2, max: 2, expended: 0 }
    ]);
    expect(s.pact).toEqual({ level: 3, max: 2, expended: 0 });
  });

  it('falls back to the document without a summary', () => {
    const s = statusOf(doc(), null);
    expect(s.resources.map((r) => r.key)).toEqual(['r1']);
    expect(s.spellSlots).toEqual([{ level: 1, max: 0, expended: 1 }]);
    expect(s.pact).toBeNull();
  });
});

describe('applyStatusPatch', () => {
  it('applies hp, conditions, exhaustion, resources, slots and pact', () => {
    const r = applyStatusPatch(doc(), summary, {
      hp: { current: 10, temp: 5 },
      conditions: ['poisoned', 'Prone', 'Poisoned'],
      exhaustion: 2,
      resources: [
        { key: 'r1', used: 3 },
        { key: 'short|Fighter|Action Surge', used: 0 },
        { key: 'short|Fighter|Second Wind', used: 1 }
      ],
      spellSlots: [{ level: 2, expended: 1 }],
      pact: { expended: 1 }
    });
    expect(r.error).toBeUndefined();
    expect(r.doc.hp).toEqual({ max: 30, current: 10, temp: 5 });
    expect(r.doc.conditions).toEqual(['Poisoned', 'Prone']); // canonical casing, deduped
    expect(r.doc.exhaustion).toBe(2);
    expect(r.doc.resources[0].used).toBe(3);
    expect(r.doc.featureResourceUsed).toEqual({ 'short|Fighter|Second Wind': 1 });
    expect(r.doc.spellSlots[1].expended).toBe(1);
    expect(r.doc.pactSlotsExpended).toBe(1);
    expect(r.changed.sort()).toEqual(['conditions', 'exhaustion', 'hp', 'pact', 'resources', 'spellSlots']);
  });

  it('does not mutate the input document', () => {
    const d = doc();
    applyStatusPatch(d, summary, { hp: { current: 1 }, resources: [{ key: 'r1', used: 0 }] });
    expect(d.hp.current).toBe(22);
    expect(d.resources[0].used).toBe(1);
  });

  it('clamps to known maxima', () => {
    const r = applyStatusPatch(doc(), summary, {
      hp: { current: 999 },
      exhaustion: 9,
      resources: [{ key: 'r1', used: 10 }],
      spellSlots: [{ level: 1, expended: 10 }, { level: 5, expended: 2 }]
    });
    expect(r.doc.hp.current).toBe(30);
    expect(r.doc.exhaustion).toBe(6);
    expect(r.doc.resources[0].used).toBe(3);
    expect(r.doc.spellSlots[0].expended).toBe(4);
    expect(r.doc.spellSlots[4].expended).toBe(0); // no level-5 slots
  });

  it('reports no change for a no-op', () => {
    const r = applyStatusPatch(doc(), summary, { hp: { current: 22 }, conditions: ['prone'] });
    expect(r.changed).toEqual([]);
  });

  it.each([
    [{ hp: { current: -1 } }, /non-negative/],
    [{ hp: { current: 1.5 } }, /integer/],
    [{ hp: { max: 50 } }, /Unknown hp field/],
    [{ conditions: ['Hungry'] }, /Unknown condition/],
    [{ conditions: 'Prone' }, /array/],
    [{ exhaustion: '2' }, /exhaustion/],
    [{ resources: [{ key: 'nope', used: 1 }] }, /Unknown resource/],
    [{ spellSlots: [{ level: 10, expended: 1 }] }, /level/],
    [{ pact: 2 }, /pact/],
    [{ name: 'Evil' }, /Unknown field/],
    [[], /object/]
  ])('rejects %j', (patch, msg) => {
    expect(applyStatusPatch(doc(), summary, patch).error).toMatch(msg);
  });
});

describe('statusDiff', () => {
  it('names the fields that moved', () => {
    const a = statusOf(doc(), summary);
    const b = statusOf({ ...doc(), exhaustion: 1, hp: { max: 30, current: 1, temp: 0 } }, summary);
    expect(statusDiff(a, b)).toEqual(['hp', 'exhaustion']);
  });
});
