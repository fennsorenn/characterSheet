import type { Character, ClassEntry, HitDicePool } from './schema.js';

/**
 * Hit dice follow the classes.
 *
 * A character has one die per class level, of that class's size — so the pools
 * are a function of `classes`, and the only thing worth storing is how many of
 * each have been spent. They used to be stored whole and grown only by the
 * level-up flow, which meant every other way of changing a class (typing a new
 * level, adding one from the catalog, removing one, importing a character) left
 * the pools behind: a Fighter 5 / Cleric 1 still showed a single d10.
 *
 * `syncHitDice` is applied on every write to the character store, so the pools
 * cannot drift again no matter which action changed the classes.
 */

/** Assumed die for a class that arrived without one (older or hand-made data). */
export const DEFAULT_HIT_DIE = 8;

const dieOf = (cl: ClassEntry) => cl.hitDie ?? DEFAULT_HIT_DIE;

/**
 * The pools a set of classes implies, carrying spent dice over from `existing`.
 * Ordered biggest die first, which is the order they are spent in.
 */
export function poolsForClasses(
  classes: ClassEntry[],
  existing: HitDicePool[] = []
): HitDicePool[] {
  const totals = new Map<number, number>();
  for (const cl of classes) {
    const die = dieOf(cl);
    totals.set(die, (totals.get(die) ?? 0) + Math.max(1, cl.level));
  }
  return [...totals.entries()]
    .sort(([a], [b]) => b - a)
    .map(([die, max]) => {
      const was = existing.find((p) => p.die === die);
      // Spent dice survive a level change; losing levels can only un-spend them.
      return { die, max, used: Math.min(Math.max(0, was?.used ?? 0), max) };
    });
}

/** Whether two pool lists say the same thing (so a no-op write stays a no-op). */
function same(a: HitDicePool[], b: HitDicePool[]): boolean {
  return (
    a.length === b.length &&
    a.every((p, i) => p.die === b[i].die && p.max === b[i].max && p.used === b[i].used)
  );
}

/**
 * A character whose hit dice match its classes. Returns the same object when
 * they already do, so this can sit on every store write without invalidating
 * subscribers that would otherwise not have woken.
 */
export function syncHitDice(character: Character): Character {
  const pools = poolsForClasses(character.classes, character.hitDice);
  return same(pools, character.hitDice) ? character : { ...character, hitDice: pools };
}
