import { abilityModifier } from '../calc/index.js';
import type { Character, HitDicePool } from './schema.js';

/**
 * Level-up and hit-dice utilities — pure functions returning a new character.
 *
 * Level-up is split from any randomness: the UI computes the HP gain (average or
 * a roll, plus the CON modifier) and passes it in, so `applyLevelUp` stays
 * deterministic and testable.
 */

/** Fixed average HP for a hit die, per 5e (d10 → 6). */
export function hpGainAverage(die: number): number {
  return Math.ceil((die + 1) / 2);
}

/** A single hit-die roll, 1..die. */
export function hpGainRoll(die: number, rng: () => number = Math.random): number {
  return Math.floor(rng() * die) + 1;
}

/** Total HP added for a level: base (average or roll) + CON mod, minimum 1. */
export function totalHpGain(base: number, conMod: number): number {
  return Math.max(1, base + conMod);
}

/** CON modifier from the character's current score. */
export function conModifier(character: Character): number {
  return abilityModifier(character.abilities.con);
}

export interface LevelUpPlan {
  /** Index of an existing class to advance, or undefined to add a new class. */
  classIndex?: number;
  newClass?: { name: string; source: string };
  /** Hit die faces of the class being advanced. */
  die: number;
  /** Total HP to add (already includes CON and the 1-minimum). */
  hpGain: number;
}

/** Add one die of `size` to the hit-dice pools (new pool if needed). */
function addHitDie(pools: HitDicePool[], size: number): HitDicePool[] {
  if (pools.some((p) => p.die === size)) {
    return pools.map((p) => (p.die === size ? { ...p, max: p.max + 1 } : p));
  }
  return [...pools, { die: size, max: 1, used: 0 }];
}

export function applyLevelUp(character: Character, plan: LevelUpPlan): Character {
  const classes =
    plan.classIndex != null
      ? character.classes.map((c, i) =>
          i === plan.classIndex ? { ...c, level: c.level + 1 } : c
        )
      : [
          ...character.classes,
          {
            name: plan.newClass?.name ?? 'Class',
            source: plan.newClass?.source ?? '',
            level: 1,
            hitDie: plan.die
          }
        ];

  return {
    ...character,
    classes,
    hitDice: addHitDie(character.hitDice, plan.die),
    hp: {
      ...character.hp,
      max: character.hp.max + plan.hpGain,
      current: character.hp.current + plan.hpGain
    }
  };
}

/** Spend one hit die of `size` and heal `heal` HP (clamped to max). */
export function spendHitDie(character: Character, size: number, heal: number): Character {
  const pool = character.hitDice.find((p) => p.die === size);
  if (!pool || pool.used >= pool.max) return character;
  return {
    ...character,
    hitDice: character.hitDice.map((p) =>
      p.die === size ? { ...p, used: p.used + 1 } : p
    ),
    hp: { ...character.hp, current: Math.min(character.hp.max, character.hp.current + heal) }
  };
}

/**
 * Long-rest hit-dice recovery: regain up to half your total hit dice (min 1),
 * spent across the pools.
 */
export function recoverHitDice(pools: HitDicePool[]): HitDicePool[] {
  const total = pools.reduce((sum, p) => sum + p.max, 0);
  let remaining = Math.max(1, Math.floor(total / 2));
  return pools.map((p) => {
    const give = Math.min(p.used, remaining);
    remaining -= give;
    return { ...p, used: p.used - give };
  });
}
