import { describe, it, expect } from 'vitest';
import {
  hpGainAverage,
  hpGainRoll,
  totalHpGain,
  applyLevelUp,
  spendHitDie,
  recoverHitDice
} from './levelup.js';
import { applyRest } from './rest.js';
import { createCharacter } from './schema.js';

describe('hp gain helpers', () => {
  it('uses the 5e fixed averages', () => {
    expect(hpGainAverage(6)).toBe(4);
    expect(hpGainAverage(8)).toBe(5);
    expect(hpGainAverage(10)).toBe(6);
    expect(hpGainAverage(12)).toBe(7);
  });

  it('rolls within range and enforces a 1 HP minimum', () => {
    expect(hpGainRoll(10, () => 0)).toBe(1);
    expect(hpGainRoll(10, () => 0.99)).toBe(10);
    expect(totalHpGain(4, -3)).toBe(1); // 4 + (-3) = 1
    expect(totalHpGain(1, -5)).toBe(1); // clamped up to 1
  });

  it('rolled hit-die heal = roll + CON mod, min 1, within die bounds', () => {
    const con = 3;
    // Across the full range of rolls, the heal stays roll+con and never below 1.
    for (let r = 0; r < 1; r += 0.05) {
      const roll = hpGainRoll(10, () => r);
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(10);
      expect(totalHpGain(roll, con)).toBe(roll + con);
    }
    // A low roll with a big negative CON still heals at least 1.
    expect(totalHpGain(hpGainRoll(6, () => 0), -5)).toBe(1);
  });
});

describe('applyLevelUp', () => {
  it('advances an existing class, adds a hit die, and raises HP', () => {
    const c = createCharacter({ hp: { max: 10, current: 7, temp: 0 } });
    const after = applyLevelUp(c, { classIndex: 0, die: 10, hpGain: 7 });
    expect(after.classes[0].level).toBe(2);
    expect(after.hitDice.find((p) => p.die === 10)!.max).toBe(2);
    expect(after.hp.max).toBe(17);
    expect(after.hp.current).toBe(14); // current also rises by the gain
  });

  it('adds a new class for multiclassing with its own hit die', () => {
    const c = createCharacter();
    const after = applyLevelUp(c, {
      newClass: { name: 'Wizard', source: 'PHB' },
      die: 6,
      hpGain: 4
    });
    expect(after.classes.map((cl) => cl.name)).toEqual(['Fighter', 'Wizard']);
    expect(after.hitDice.map((p) => p.die).sort((a, b) => a - b)).toEqual([6, 10]);
  });
});

describe('hit dice spending and recovery', () => {
  it('spends a die and heals, clamped to max HP', () => {
    const c = createCharacter({ hp: { max: 12, current: 5, temp: 0 } });
    const after = spendHitDie(c, 10, 6);
    expect(after.hp.current).toBe(11);
    expect(after.hitDice[0].used).toBe(1);
    // No die available → unchanged.
    const drained = spendHitDie({ ...after, hitDice: [{ die: 10, max: 1, used: 1 }] }, 10, 6);
    expect(drained.hitDice[0].used).toBe(1);
  });

  it('recovers up to half total hit dice on a long rest', () => {
    const c = createCharacter({
      hitDice: [{ die: 10, max: 6, used: 5 }],
      hp: { max: 40, current: 10, temp: 0 }
    });
    const after = applyRest(c, 'long');
    expect(after.hp.current).toBe(40);
    // 6 total → recover 3; used 5 → 2.
    expect(after.hitDice[0].used).toBe(2);
  });

  it('recovers at least one hit die', () => {
    expect(recoverHitDice([{ die: 8, max: 1, used: 1 }])[0].used).toBe(0);
  });
});
