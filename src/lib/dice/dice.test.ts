import { describe, it, expect } from 'vitest';
import { parseDice, rollTerms, rollD20, partDetail } from './dice.js';

// Deterministic RNG: returns preset [0,1) values so dice land on chosen faces.
const seq = (vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};
// value v on dN: floor(x*N)+1 = v → x = (v-0.5)/N
const face = (v: number, n: number) => (v - 0.5) / n;

describe('parseDice', () => {
  it('parses dice groups and a flat modifier', () => {
    expect(parseDice('2d6 + 3')).toEqual({ terms: [{ count: 2, faces: 6 }], modifier: 3 });
    expect(parseDice('1d20-1')).toEqual({ terms: [{ count: 1, faces: 20 }], modifier: -1 });
    expect(parseDice('d8')).toEqual({ terms: [{ count: 1, faces: 8 }], modifier: 0 });
    expect(parseDice('8d6')).toEqual({ terms: [{ count: 8, faces: 6 }], modifier: 0 });
  });
});

describe('rollTerms', () => {
  it('rolls each die and totals dice + modifier', () => {
    const rng = seq([face(4, 6), face(5, 6)]); // two d6 → 4, 5
    const p = rollTerms([{ count: 2, faces: 6 }], 3, 'Damage', { rng });
    expect(p.dice.map((d) => d.value)).toEqual([4, 5]);
    expect(p.total).toBe(12); // 4 + 5 + 3
    expect(partDetail(p)).toBe('4 + 5 + 3 = 12');
  });
});

describe('rollD20', () => {
  it('normal keeps the first die; both are shown, second dropped', () => {
    const rng = seq([face(5, 20), face(18, 20)]);
    const p = rollD20('normal', 7, 'Attack', { rng });
    expect(p.dice.map((d) => [d.value, !!d.dropped])).toEqual([[5, false], [18, true]]);
    expect(p.total).toBe(12); // 5 + 7
  });
  it('advantage keeps the higher die', () => {
    const p = rollD20('adv', 0, 'Attack', { rng: seq([face(5, 20), face(18, 20)]) });
    expect(p.total).toBe(18);
    expect(p.dice.find((d) => !d.dropped)?.value).toBe(18);
  });
  it('disadvantage keeps the lower die', () => {
    const p = rollD20('disadv', 2, 'Attack', { rng: seq([face(5, 20), face(18, 20)]) });
    expect(p.total).toBe(7); // 5 + 2
  });
});
