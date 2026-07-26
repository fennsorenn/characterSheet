import { describe, it, expect } from 'vitest';
import { poolsForClasses, syncHitDice, DEFAULT_HIT_DIE } from './hitDice.js';
import { createCharacter } from './schema.js';
import type { ClassEntry, HitDicePool } from './schema.js';

const cls = (name: string, level: number, hitDie?: number): ClassEntry => ({
  name,
  source: 'PHB',
  level,
  hitDie
});

describe('poolsForClasses', () => {
  it('gives one die per class level', () => {
    expect(poolsForClasses([cls('Fighter', 5, 10)])).toEqual([{ die: 10, max: 5, used: 0 }]);
  });

  it('pools classes that share a die size, biggest die first', () => {
    const pools = poolsForClasses([cls('Fighter', 5, 10), cls('Cleric', 3, 8), cls('Ranger', 2, 10)]);
    expect(pools).toEqual([
      { die: 10, max: 7, used: 0 },
      { die: 8, max: 3, used: 0 }
    ]);
  });

  it('carries spent dice across a level change', () => {
    const existing: HitDicePool[] = [{ die: 10, max: 5, used: 3 }];
    expect(poolsForClasses([cls('Fighter', 8, 10)], existing)).toEqual([
      { die: 10, max: 8, used: 3 }
    ]);
  });

  it('clamps spent dice when levels are lost', () => {
    const existing: HitDicePool[] = [{ die: 10, max: 5, used: 5 }];
    expect(poolsForClasses([cls('Fighter', 2, 10)], existing)).toEqual([
      { die: 10, max: 2, used: 2 }
    ]);
  });

  it('drops the pool of a class that is gone', () => {
    const existing: HitDicePool[] = [
      { die: 10, max: 5, used: 1 },
      { die: 8, max: 1, used: 0 }
    ];
    expect(poolsForClasses([cls('Cleric', 1, 8)], existing)).toEqual([{ die: 8, max: 1, used: 0 }]);
  });

  it('assumes a die for a class that arrived without one', () => {
    expect(poolsForClasses([cls('Homebrew', 3)])).toEqual([
      { die: DEFAULT_HIT_DIE, max: 3, used: 0 }
    ]);
  });

  it('has no dice with no classes', () => {
    expect(poolsForClasses([])).toEqual([]);
  });
});

describe('syncHitDice', () => {
  it('rebuilds pools that no longer match the classes', () => {
    // The bug: levels raised outside the level-up flow left this at one d10.
    const c = createCharacter({
      classes: [cls('Fighter', 5, 10), cls('Cleric', 1, 8)],
      hitDice: [{ die: 10, max: 1, used: 0 }]
    });
    expect(syncHitDice(c).hitDice).toEqual([
      { die: 10, max: 5, used: 0 },
      { die: 8, max: 1, used: 0 }
    ]);
  });

  it('returns the very same object when nothing needs changing', () => {
    // Identity matters: this runs on every write, and a fresh object would wake
    // every subscriber on edits that have nothing to do with hit dice.
    const c = createCharacter({
      classes: [cls('Fighter', 3, 10)],
      hitDice: [{ die: 10, max: 3, used: 1 }]
    });
    expect(syncHitDice(c)).toBe(c);
  });

  it('is idempotent', () => {
    const c = createCharacter({ classes: [cls('Bard', 4, 8)], hitDice: [] });
    const once = syncHitDice(c);
    expect(syncHitDice(once)).toBe(once);
  });
});
